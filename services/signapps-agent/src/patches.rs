use crate::config::AgentConfig;
use std::sync::Arc;
use tokio::sync::RwLock;

pub async fn patch_scan_loop(config: Arc<RwLock<AgentConfig>>) {
    let client = reqwest::Client::new();
    tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;

    loop {
        let cfg = config.read().await;
        let url = cfg.api_url("/patches/report");
        let token = cfg.jwt_token.clone().unwrap_or_default();
        let agent_id = cfg.agent_id.clone().unwrap_or_default();
        drop(cfg);

        let patches = detect_available_patches().await;
        if !patches.is_empty() {
            let _ = client
                .post(&url)
                .bearer_auth(&token)
                .json(&serde_json::json!({
                    "agent_id": agent_id,
                    "patches": patches,
                }))
                .send()
                .await;
            tracing::info!("Reported {} available patches", patches.len());
        }

        // Scan every 6 hours
        tokio::time::sleep(tokio::time::Duration::from_secs(6 * 3600)).await;
    }
}

async fn detect_available_patches() -> Vec<serde_json::Value> {
    let mut patches = Vec::new();

    #[cfg(target_os = "linux")]
    {
        // Try apt
        if let Ok(output) = tokio::process::Command::new("apt")
            .args(["list", "--upgradable"])
            .output()
            .await
        {
            for line in String::from_utf8_lossy(&output.stdout).lines().skip(1) {
                if let Some(name) = line.split('/').next() {
                    let version = line.split_whitespace().nth(1).unwrap_or("");
                    patches.push(serde_json::json!({
                        "patch_id": format!("apt-{}-{}", name, version),
                        "title": format!("{} {}", name, version),
                        "severity": "unknown",
                        "category": "os",
                    }));
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Use PowerShell to query Windows Update
        if let Ok(output) = tokio::process::Command::new("powershell")
            .args([
                "-Command",
                r#"
                $Session = New-Object -ComObject Microsoft.Update.Session
                $Searcher = $Session.CreateUpdateSearcher()
                $Results = $Searcher.Search("IsInstalled=0")
                $Results.Updates | ForEach-Object {
                    [PSCustomObject]@{
                        Title = $_.Title
                        KBArticleIDs = ($_.KBArticleIDs -join ',')
                        MsrcSeverity = $_.MsrcSeverity
                        MaxDownloadSize = $_.MaxDownloadSize
                    }
                } | ConvertTo-Json
            "#,
            ])
            .output()
            .await
        {
            if let Ok(updates) = serde_json::from_slice::<Vec<serde_json::Value>>(&output.stdout) {
                for u in updates {
                    let title = u["Title"].as_str().unwrap_or("");
                    let kb = u["KBArticleIDs"].as_str().unwrap_or("");
                    let severity = u["MsrcSeverity"].as_str().unwrap_or("unknown");
                    patches.push(serde_json::json!({
                        "patch_id": format!("KB{}", kb),
                        "title": title,
                        "severity": severity.to_lowercase(),
                        "kb_number": format!("KB{}", kb),
                        "category": "os",
                    }));
                }
            }
        }
    }

    patches
}
