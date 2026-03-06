use command_kosh_lib::integrity::{canonical_json, compute_hmac, verify_hmac};
use command_kosh_lib::models::RegisteredCommand;
use std::collections::HashMap;

#[test]
fn test_hmac_computation_and_verification() {
    let key = b"my-secret-test-key-1234567890123";
    let data = b"some data to sign";

    // Compute HMAC
    let sig = compute_hmac(data, key);

    // Verify should succeed with correct key and signature
    let is_valid = verify_hmac(data, key, &sig);
    assert!(
        is_valid,
        "HMAC verification should succeed for valid signature"
    );

    // Verify should fail with wrong data
    let wrong_data = b"tampered data";
    assert!(
        !verify_hmac(wrong_data, key, &sig),
        "HMAC verification should fail for tampered data"
    );

    // Verify should fail with wrong key
    let wrong_key = b"wrong-secret-test-key-12345678901";
    assert!(
        !verify_hmac(data, wrong_key, &sig),
        "HMAC verification should fail for wrong key"
    );
}

#[test]
fn test_canonical_json() {
    let mut cmds = HashMap::new();
    cmds.insert(
        "b".to_string(),
        RegisteredCommand {
            id: "b".to_string(),
            name: "Command B".to_string(),
            command_str: "echo b".to_string(),
            interval_secs: 10,
            run_at_secs: None,
            actively_stopped: false,
            auto_start: true,
            notify_on_failure: false,
            notify_on_success: false,
            auto_restart_on_fail: false,
            auto_restart_retries: 0,
            auto_run_on_complete: false,
        },
    );
    cmds.insert(
        "a".to_string(),
        RegisteredCommand {
            id: "a".to_string(),
            name: "Command A".to_string(),
            command_str: "echo a".to_string(),
            interval_secs: 5,
            run_at_secs: None,
            actively_stopped: false,
            auto_start: true,
            notify_on_failure: false,
            notify_on_success: false,
            auto_restart_on_fail: false,
            auto_restart_retries: 0,
            auto_run_on_complete: false,
        },
    );

    let json = canonical_json(&cmds).expect("should serialize");
    // 'a' should appear before 'b' in the resulting JSON string due to BTreeMap ordering
    let pos_a = json.find("\"a\"").unwrap();
    let pos_b = json.find("\"b\"").unwrap();
    assert!(pos_a < pos_b, "Keys should be ordered alphabetically");
}
