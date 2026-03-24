use crate::AppState;
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use signapps_common::Claims;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuleCondition {
    pub field: String,    // "from" | "subject" | "body"
    pub operator: String, // "contains" | "equals" | "starts_with"
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum RuleAction {
    #[serde(rename = "move_to")]
    MoveTo { folder: String },
    #[serde(rename = "label")]
    Label { tag: String },
    #[serde(rename = "forward")]
    Forward { email: String },
    #[serde(rename = "delete")]
    Delete,
    #[serde(rename = "mark_read")]
    MarkRead,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MailRule {
    pub id: Uuid,
    pub account_id: Uuid,
    pub name: String,
    pub conditions: Vec<RuleCondition>,
    pub actions: Vec<RuleAction>,
    pub enabled: bool,
}

#[derive(Clone)]
pub struct RuleStore {
    rules: Arc<RwLock<Vec<MailRule>>>,
}

impl Default for RuleStore {
    fn default() -> Self {
        Self::new()
    }
}

impl RuleStore {
    pub fn new() -> Self {
        Self {
            rules: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn get_all_rules(&self, account_id: Uuid) -> Vec<MailRule> {
        self.rules
            .read()
            .await
            .iter()
            .filter(|r| r.account_id == account_id)
            .cloned()
            .collect()
    }

    pub async fn get_rule(&self, rule_id: Uuid) -> Option<MailRule> {
        self.rules
            .read()
            .await
            .iter()
            .find(|r| r.id == rule_id)
            .cloned()
    }

    pub async fn create_rule(&self, rule: MailRule) -> MailRule {
        self.rules.write().await.push(rule.clone());
        rule
    }

    pub async fn update_rule(&self, rule_id: Uuid, updated: MailRule) -> Option<MailRule> {
        let mut rules = self.rules.write().await;
        if let Some(pos) = rules.iter().position(|r| r.id == rule_id) {
            rules[pos] = updated.clone();
            Some(updated)
        } else {
            None
        }
    }

    pub async fn delete_rule(&self, rule_id: Uuid) -> bool {
        let mut rules = self.rules.write().await;
        if let Some(pos) = rules.iter().position(|r| r.id == rule_id) {
            rules.remove(pos);
            true
        } else {
            false
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateRuleRequest {
    pub name: String,
    pub conditions: Vec<RuleCondition>,
    pub actions: Vec<RuleAction>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRuleRequest {
    pub name: Option<String>,
    pub conditions: Option<Vec<RuleCondition>>,
    pub actions: Option<Vec<RuleAction>>,
    pub enabled: Option<bool>,
}

pub async fn list_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let rules = state.rules.get_all_rules(claims.sub).await;
    Json(rules).into_response()
}

pub async fn get_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Path(rule_id): axum::extract::Path<Uuid>,
) -> impl IntoResponse {
    match state.rules.get_rule(rule_id).await {
        Some(rule) if rule.account_id == claims.sub => Json(rule).into_response(),
        _ => (StatusCode::NOT_FOUND, "Rule not found").into_response(),
    }
}

pub async fn create_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateRuleRequest>,
) -> impl IntoResponse {
    let rule = MailRule {
        id: Uuid::new_v4(),
        account_id: claims.sub,
        name: payload.name,
        conditions: payload.conditions,
        actions: payload.actions,
        enabled: payload.enabled.unwrap_or(true),
    };

    let created = state.rules.create_rule(rule).await;
    (StatusCode::CREATED, Json(created)).into_response()
}

pub async fn update_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Path(rule_id): axum::extract::Path<Uuid>,
    Json(payload): Json<UpdateRuleRequest>,
) -> impl IntoResponse {
    if let Some(current) = state.rules.get_rule(rule_id).await {
        if current.account_id != claims.sub {
            return (StatusCode::FORBIDDEN, "Not authorized").into_response();
        }

        let updated = MailRule {
            id: current.id,
            account_id: current.account_id,
            name: payload.name.unwrap_or(current.name),
            conditions: payload.conditions.unwrap_or(current.conditions),
            actions: payload.actions.unwrap_or(current.actions),
            enabled: payload.enabled.unwrap_or(current.enabled),
        };

        match state.rules.update_rule(rule_id, updated.clone()).await {
            Some(rule) => (StatusCode::OK, Json(rule)).into_response(),
            None => (StatusCode::INTERNAL_SERVER_ERROR, "Update failed").into_response(),
        }
    } else {
        (StatusCode::NOT_FOUND, "Rule not found").into_response()
    }
}

pub async fn delete_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Path(rule_id): axum::extract::Path<Uuid>,
) -> impl IntoResponse {
    if let Some(rule) = state.rules.get_rule(rule_id).await {
        if rule.account_id != claims.sub {
            return (StatusCode::FORBIDDEN, "Not authorized").into_response();
        }

        if state.rules.delete_rule(rule_id).await {
            StatusCode::NO_CONTENT.into_response()
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, "Delete failed").into_response()
        }
    } else {
        (StatusCode::NOT_FOUND, "Rule not found").into_response()
    }
}
