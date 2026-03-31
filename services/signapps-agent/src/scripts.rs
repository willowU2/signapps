use crate::config::AgentConfig;
use std::sync::Arc;
use tokio::sync::RwLock;

pub async fn script_poll_loop(config: Arc<RwLock<AgentConfig>>) {
    let client = reqwest::Client::new();
    tokio::time::sleep(tokio::time::Duration::from_secs(15)).await;

    loop {
        let cfg = config.read().await;
        let agent_id = cfg.agent_id.clone().unwrap_or_default();
        let pending_url = cfg.api_url(&format!("/agent/{}/scripts/pending", agent_id));
        let result_url = cfg.api_url("/agent/scripts/result");
        let token = cfg.jwt_token.clone().unwrap_or_default();
        let poll = cfg.poll_interval_secs;
        drop(cfg);

        // Poll for pending scripts
        match client.get(&pending_url).bearer_auth(&token).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(scripts) = resp.json::<Vec<serde_json::Value>>().await {
                    for script in scripts {
                        let script_id = script["id"].as_str().unwrap_or("").to_string();
                        let script_type = script["script_type"].as_str().unwrap_or("bash");
                        let content = script["script_content"].as_str().unwrap_or("");
                        let timeout = script["timeout_seconds"].as_u64().unwrap_or(300);

                        tracing::info!("Executing script {} ({})", script_id, script_type);

                        let result = execute_script(script_type, content, timeout).await;

                        let _ = client
                            .post(&result_url)
                            .bearer_auth(&token)
                            .json(&serde_json::json!({
                                "script_id": script_id,
                                "stdout": result.stdout,
                                "stderr": result.stderr,
                                "exit_code": result.exit_code,
                            }))
                            .send()
                            .await;
                    }
                }
            },
            _ => {},
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(poll)).await;
    }
}

struct ScriptResult {
    stdout: String,
    stderr: String,
    exit_code: i32,
}

async fn execute_script(script_type: &str, content: &str, timeout_secs: u64) -> ScriptResult {
    let (cmd, args): (&str, Vec<&str>) = match script_type {
        "powershell" => (
            "powershell",
            vec![
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                content,
            ],
        ),
        "python" => ("python3", vec!["-c", content]),
        _ => {
            if cfg!(target_os = "windows") {
                ("cmd", vec!["/C", content])
            } else {
                ("sh", vec!["-c", content])
            }
        },
    };

    match tokio::time::timeout(
        tokio::time::Duration::from_secs(timeout_secs),
        tokio::process::Command::new(cmd).args(&args).output(),
    )
    .await
    {
        Ok(Ok(output)) => ScriptResult {
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code().unwrap_or(-1),
        },
        Ok(Err(e)) => ScriptResult {
            stdout: String::new(),
            stderr: format!("Failed to execute: {}", e),
            exit_code: -1,
        },
        Err(_) => ScriptResult {
            stdout: String::new(),
            stderr: "Script execution timed out".into(),
            exit_code: -2,
        },
    }
}
