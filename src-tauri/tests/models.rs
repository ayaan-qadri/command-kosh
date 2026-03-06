use command_kosh_lib::models::RegisteredCommand;

#[test]
fn test_registered_command_deserialization_defaults() {
    let json_data = r#"{
        "id": "1",
        "name": "Test Command",
        "command_str": "echo test",
        "interval_secs": 60
    }"#;

    let cmd: RegisteredCommand = serde_json::from_str(json_data).expect("Should deserialize");

    // Explicitly provided fields
    assert_eq!(cmd.id, "1");
    assert_eq!(cmd.name, "Test Command");
    assert_eq!(cmd.command_str, "echo test");
    assert_eq!(cmd.interval_secs, 60);

    // Required defaults
    assert_eq!(cmd.auto_start, false, "auto_start should default to false");
    assert_eq!(cmd.run_at_secs, None);
    assert_eq!(cmd.actively_stopped, false);
    assert_eq!(cmd.notify_on_failure, false);
    assert_eq!(cmd.notify_on_success, false);
    assert_eq!(cmd.auto_restart_on_fail, false);
    assert_eq!(cmd.auto_restart_retries, 0);
    assert_eq!(cmd.auto_run_on_complete, false);
}
