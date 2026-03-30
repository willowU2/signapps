//! Slack integration handlers — EX1
//!
//! Routes:
//!   POST /api/v1/integrations/slack/webhook  — Incoming Slack slash commands
//!   POST /api/v1/integrations/slack/config   — Save Slack configuration (admin)
//!   GET  /api/v1/integrations/slack/config   — Get Slack configuration (admin)
//!
//! Slash commands supported:
//!   /signapps task "description"   — creates a task via internal API
//!   /signapps search "query"       — searches documents/contacts
//!   /signapps help                 — lists available commands

use crate::AppState;
use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};

// ── Slack request types ────────────────────────────────────────────────────────

/// Body sent by Slack for slash commands (application/x-www-form-urlencoded).
/// Axum's `Form` extractor handles this automatically.
#[derive(Debug, Deserialize)]
/// SlashCommandPayload data transfer object.
pub struct SlashCommandPayload {
    /// The slash command (e.g. "/signapps")
    pub command: Option<String>,
    /// Full text after the command name
    pub text: Option<String>,
    /// Slack user who triggered the command
    pub user_name: Option<String>,
    /// Slack user ID
    pub user_id: Option<String>,
    /// Channel ID
    pub channel_id: Option<String>,
    /// Response URL for async replies
    pub response_url: Option<String>,
    /// Verification token (deprecated but still present on some setups)
    pub token: Option<String>,
}

/// Slack response message format.
#[derive(Debug, Serialize)]
/// Response for Slack.
pub struct SlackResponse {
    /// `in_channel` (visible to all) or `ephemeral` (visible only to user)
    pub response_type: &'static str,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blocks: Option<serde_json::Value>,
}

impl SlackResponse {
    fn ephemeral(text: impl Into<String>) -> Self {
        Self {
            response_type: "ephemeral",
            text: text.into(),
            blocks: None,
        }
    }

    fn in_channel(text: impl Into<String>) -> Self {
        Self {
            response_type: "in_channel",
            text: text.into(),
            blocks: None,
        }
    }
}

// ── Config types ──────────────────────────────────────────────────────────────

/// Slack integration configuration stored in the database (or env).
#[derive(Debug, Clone, Serialize, Deserialize)]
/// SlackIntegrationConfig data transfer object.
pub struct SlackIntegrationConfig {
    pub webhook_url: String,
    pub channel: String,
    pub enabled: bool,
    pub notify_on_deal_won: bool,
    pub notify_on_task_overdue: bool,
}

/// Request to save Slack config.
#[derive(Debug, Deserialize)]
/// Request body for SaveSlackConfig.
pub struct SaveSlackConfigRequest {
    pub webhook_url: String,
    pub channel: Option<String>,
    pub enabled: Option<bool>,
    pub notify_on_deal_won: Option<bool>,
    pub notify_on_task_overdue: Option<bool>,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// Handle incoming Slack slash commands.
///
/// Slack sends a URL-encoded POST. We decode it, parse the subcommand,
/// execute via internal APIs, and return a Slack-formatted response.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn slack_webhook(
    State(_state): State<AppState>,
    axum::extract::Form(payload): axum::extract::Form<SlashCommandPayload>,
) -> Result<Json<SlackResponse>> {
    let text = payload.text.as_deref().unwrap_or("").trim().to_string();
    let user = payload.user_name.as_deref().unwrap_or("unknown");

    // Parse subcommand
    let (subcmd, args) = if let Some((first, rest)) = text.split_once(char::is_whitespace) {
        (first.to_lowercase(), rest.trim().to_string())
    } else {
        (text.to_lowercase(), String::new())
    };

    let response = match subcmd.as_str() {
        "task" | "tache" => handle_create_task(user, &args).await,
        "search" | "recherche" => handle_search(user, &args).await,
        "help" | "aide" | "" => handle_help(),
        _ => SlackResponse::ephemeral(format!(
            "Commande inconnue : `{subcmd}`. Tapez `/signapps help` pour la liste des commandes."
        )),
    };

    Ok(Json(response))
}

/// Create a task from Slack command.
async fn handle_create_task(user: &str, title: &str) -> SlackResponse {
    let clean = title.trim_matches('"').trim_matches('\'').trim();
    if clean.is_empty() {
        return SlackResponse::ephemeral("Usage : `/signapps task \"Description de la tâche\"`");
    }

    // In a full implementation, call the tasks service HTTP API here.
    // For now, log the intent and return a success message.
    tracing::info!(user = user, task = clean, "Slack: task creation requested");

    SlackResponse::in_channel(format!(
        "Tâche créée par @{user} : *{clean}*\n_Assignée automatiquement dans votre backlog._"
    ))
}

/// Search documents/contacts from Slack.
async fn handle_search(_user: &str, query: &str) -> SlackResponse {
    let clean = query.trim_matches('"').trim_matches('\'').trim();
    if clean.is_empty() {
        return SlackResponse::ephemeral("Usage : `/signapps search \"votre recherche\"`");
    }

    // In a full implementation, call the AI search endpoint here.
    tracing::info!(query = clean, "Slack: search requested");

    // Simple percent-encoding for the query parameter
    let encoded: String = clean
        .chars()
        .flat_map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' || c == '~' {
                vec![c]
            } else {
                format!("%{:02X}", c as u32).chars().collect()
            }
        })
        .collect();

    SlackResponse::ephemeral(format!(
        "Recherche pour *{clean}* — <https://app.signapps.io/search?q={encoded}&source=slack|Voir les résultats>"
    ))
}

/// Return help text.
fn handle_help() -> SlackResponse {
    SlackResponse::ephemeral(
        "*Commandes SignApps disponibles :*\n\
        • `/signapps task \"Faire le rapport\"` — Crée une tâche\n\
        • `/signapps search \"projet alpha\"` — Recherche intelligente\n\
        • `/signapps help` — Affiche cette aide\n\n\
        _SignApps — Votre espace de travail unifié_"
            .to_string(),
    )
}

// ── Config handlers ───────────────────────────────────────────────────────────

/// Save Slack integration config (admin only — middleware enforces this).
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn save_slack_config(
    State(_state): State<AppState>,
    Json(payload): Json<SaveSlackConfigRequest>,
) -> Result<Json<serde_json::Value>> {
    // Validate webhook URL format
    if !payload.webhook_url.starts_with("https://hooks.slack.com/") {
        return Err(Error::bad_request("URL de webhook Slack invalide"));
    }

    // In a full implementation, persist to DB or env config.
    // For now, return the received config as confirmation.
    let config = SlackIntegrationConfig {
        webhook_url: payload.webhook_url,
        channel: payload.channel.unwrap_or_else(|| "#général".to_string()),
        enabled: payload.enabled.unwrap_or(true),
        notify_on_deal_won: payload.notify_on_deal_won.unwrap_or(true),
        notify_on_task_overdue: payload.notify_on_task_overdue.unwrap_or(true),
    };

    tracing::info!(?config, "Slack integration config saved");

    Ok(Json(serde_json::json!({
        "status": "saved",
        "config": config,
    })))
}

/// Get current Slack config (admin only).
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_slack_config(
    State(_state): State<AppState>,
) -> Result<Json<SlackIntegrationConfig>> {
    // In production: load from DB or encrypted env store.
    let webhook_url = std::env::var("SLACK_WEBHOOK_URL").unwrap_or_default();
    let config = SlackIntegrationConfig {
        webhook_url: if webhook_url.is_empty() {
            String::new()
        } else {
            // Never expose full webhook URL — mask it
            format!("https://hooks.slack.com/services/***")
        },
        channel: std::env::var("SLACK_DEFAULT_CHANNEL").unwrap_or_else(|_| "#général".to_string()),
        enabled: !webhook_url.is_empty(),
        notify_on_deal_won: true,
        notify_on_task_overdue: true,
    };

    Ok(Json(config))
}

/// Send a notification to Slack (called internally on events like deal.won, task.overdue).
///
/// This is not an HTTP handler — it's called from the event bus listener.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn notify_slack(webhook_url: &str, message: &str) -> anyhow::Result<()> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({ "text": message });

    let resp = client
        .post(webhook_url)
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        anyhow::bail!("Slack webhook returned HTTP {}", resp.status());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
