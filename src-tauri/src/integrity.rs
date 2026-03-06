use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::PathBuf;

use hmac::{Hmac, Mac};
use rand::rngs::OsRng;
use rand::RngCore;
use sha2::Sha256;
use tauri::Manager;

use crate::models::RegisteredCommand;

type HmacSha256 = Hmac<Sha256>;

/// Result of verifying the commands file integrity.
pub enum VerifyResult {
    /// Signature is valid — commands are safe to load.
    Valid(HashMap<String, RegisteredCommand>),
    /// Signature mismatch or missing — file may have been tampered with.
    Tampered(HashMap<String, RegisteredCommand>),
    /// No commands file exists (fresh install or key was lost).
    Empty,
}

pub fn get_or_create_hmac_key(_app_handle: &tauri::AppHandle) -> (Vec<u8>, bool) {
    let entry_result = keyring::Entry::new("command-kosh", "hmac-key");
    let entry = match entry_result {
        Ok(e) => e,
        Err(_) => return (generate_key(), true), // Fallback if keyring init fails
    };

    match entry.get_password() {
        Ok(hex_key) => {
            if let Ok(key) = hex::decode(&hex_key) {
                if key.len() == 32 {
                    return (key, false);
                }
            }
            // Invalid key in keyring -> new key
            let new_key = generate_key();
            let _ = entry.set_password(&hex::encode(&new_key));
            (new_key, true)
        }
        Err(_) => {
            // Key missing or other error -> new key
            let new_key = generate_key();
            let _ = entry.set_password(&hex::encode(&new_key));
            (new_key, true)
        }
    }
}

fn generate_key() -> Vec<u8> {
    let mut key = vec![0u8; 32];
    OsRng.fill_bytes(&mut key);
    key
}

/// Compute HMAC-SHA256 over data using the given key, return hex string.
pub fn compute_hmac(data: &[u8], key: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key can be any size");
    mac.update(data);
    let result = mac.finalize();
    hex::encode(result.into_bytes())
}

/// Verify an HMAC-SHA256 signature. Returns true if valid.
pub fn verify_hmac(data: &[u8], key: &[u8], expected_hex: &str) -> bool {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key can be any size");
    mac.update(data);
    match hex::decode(expected_hex) {
        Ok(expected_bytes) => mac.verify_slice(&expected_bytes).is_ok(),
        Err(_) => false,
    }
}

/// Serialize commands into canonical JSON using BTreeMap for consistent key ordering.
pub fn canonical_json(commands: &HashMap<String, RegisteredCommand>) -> Result<String, String> {
    // Convert HashMap to BTreeMap for deterministic key ordering
    let ordered: BTreeMap<&String, &RegisteredCommand> = commands.iter().collect();
    serde_json::to_string_pretty(&ordered).map_err(|e| e.to_string())
}

fn get_commands_file_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let mut path = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let _ = fs::create_dir_all(&path);
    path.push("commands.json");
    path
}

fn get_sig_file_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let mut path = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    path.push("commands.json.sig");
    path
}

/// Sign the commands map and write both commands.json and commands.json.sig.
pub async fn sign_and_save(
    app_handle: &tauri::AppHandle,
    commands: &HashMap<String, RegisteredCommand>,
) -> Result<(), String> {
    let app_handle_clone = app_handle.clone();
    let (key, _) = tokio::task::spawn_blocking(move || get_or_create_hmac_key(&app_handle_clone))
        .await
        .map_err(|e| e.to_string())?;

    if let Ok(json) = canonical_json(commands) {
        let cmd_path = get_commands_file_path(app_handle);
        let sig_path = get_sig_file_path(app_handle);

        let _ = fs::write(&cmd_path, &json);
        let written = fs::read(&cmd_path).unwrap_or_else(|_| json.as_bytes().to_vec());
        let sig = compute_hmac(&written, &key);
        let _ = fs::write(&sig_path, &sig);
    }

    Ok(())
}

/// Verify the commands file integrity and load commands.
pub async fn verify_and_load(app_handle: &tauri::AppHandle) -> VerifyResult {
    let cmd_path = get_commands_file_path(app_handle);
    let sig_path = get_sig_file_path(app_handle);

    // Read raw bytes from disk
    let raw_bytes = match fs::read(&cmd_path) {
        Ok(b) if !b.is_empty() => b,
        _ => return VerifyResult::Empty,
    };

    let data = match String::from_utf8(raw_bytes.clone()) {
        Ok(s) => {
            if s.trim().is_empty() {
                return VerifyResult::Empty;
            }
            s
        }
        _ => return VerifyResult::Empty,
    };

    // Parse the commands
    let commands: HashMap<String, RegisteredCommand> = match serde_json::from_str(&data) {
        Ok(c) => c,
        Err(_) => return VerifyResult::Empty,
    };

    // Get or create key in blocking task
    let app_handle_clone = app_handle.clone();
    let (key, key_is_new) = match tokio::task::spawn_blocking(move || {
        get_or_create_hmac_key(&app_handle_clone)
    })
    .await
    {
        Ok(res) => res,
        Err(_) => return VerifyResult::Tampered(commands),
    };

    // If the key was just created (first install or key file was deleted),
    // sign the existing commands and return Valid.
    if key_is_new {
        let _ = sign_and_save(app_handle, &commands).await;
        return VerifyResult::Valid(commands);
    }

    // Read signature file
    let sig = match fs::read_to_string(&sig_path) {
        Ok(s) if !s.trim().is_empty() => s.trim().to_string(),
        _ => return VerifyResult::Tampered(commands),
    };

    // Verify against raw file bytes
    if verify_hmac(&raw_bytes, &key, &sig) {
        VerifyResult::Valid(commands)
    } else {
        VerifyResult::Tampered(commands)
    }
}

