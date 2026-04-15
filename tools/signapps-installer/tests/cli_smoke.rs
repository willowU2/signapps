//! E2E smoke tests for the installer CLI.

use assert_cmd::Command;
use tempfile::TempDir;

#[test]
fn help_lists_all_commands() {
    let mut cmd = Command::cargo_bin("signapps-installer").unwrap();
    let out = cmd.arg("--help").assert().success();
    let text = String::from_utf8_lossy(&out.get_output().stdout).to_string();
    for subcommand in ["init", "start", "stop", "update", "status", "backup"] {
        assert!(
            text.contains(subcommand),
            "missing subcommand '{subcommand}' in --help"
        );
    }
}

#[test]
fn version_prints_semver() {
    let mut cmd = Command::cargo_bin("signapps-installer").unwrap();
    let out = cmd.arg("--version").assert().success();
    let text = String::from_utf8_lossy(&out.get_output().stdout).to_string();
    assert!(text.contains(env!("CARGO_PKG_VERSION")));
}

#[test]
fn init_in_tempdir_writes_expected_files() {
    let tmp = TempDir::new().unwrap();
    let dir = tmp.path();

    let mut cmd = Command::cargo_bin("signapps-installer").unwrap();
    cmd.args(["--config-dir", dir.to_str().unwrap(), "init"])
        .assert()
        .success();

    assert!(dir.join("config.toml").exists(), "config.toml missing");
    assert!(
        dir.join("docker-compose.prod.yml").exists(),
        "docker-compose.prod.yml missing"
    );
    assert!(dir.join(".env").exists(), ".env missing");
    assert!(dir.join("backups").is_dir(), "backups/ dir missing");
    assert!(dir.join("data").is_dir(), "data/ dir missing");
}

#[test]
fn init_refuses_existing_without_force() {
    let tmp = TempDir::new().unwrap();
    let dir = tmp.path();

    Command::cargo_bin("signapps-installer")
        .unwrap()
        .args(["--config-dir", dir.to_str().unwrap(), "init"])
        .assert()
        .success();

    Command::cargo_bin("signapps-installer")
        .unwrap()
        .args(["--config-dir", dir.to_str().unwrap(), "init"])
        .assert()
        .failure();
}
