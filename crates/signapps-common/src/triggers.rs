//! Trigger rules and execution engine for event-driven automation.

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

/// Represents a single trigger rule with conditions and actions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerRule {
    /// Unique identifier for the trigger
    pub id: String,

    /// Event type that triggers this rule (e.g., "document_created", "user_added")
    pub event_type: String,

    /// Array of conditions that must be met for the trigger to fire
    pub conditions: Vec<String>,

    /// Array of actions to execute when trigger fires
    pub actions: Vec<String>,
}

impl TriggerRule {
    /// Creates a new trigger rule
    pub fn new(event_type: String, conditions: Vec<String>, actions: Vec<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            event_type,
            conditions,
            actions,
        }
    }
}

/// Event-driven trigger execution engine
pub struct TriggerEngine {
    rules: Arc<DashMap<String, TriggerRule>>,
}

impl TriggerEngine {
    /// Creates a new trigger engine
    pub fn new() -> Self {
        Self {
            rules: Arc::new(DashMap::new()),
        }
    }

    /// Registers a new trigger rule
    pub fn register(&self, rule: TriggerRule) -> Result<String, String> {
        let rule_id = rule.id.clone();
        if self.rules.contains_key(&rule_id) {
            return Err(format!("Trigger rule {} already registered", rule_id));
        }
        self.rules.insert(rule_id.clone(), rule);
        Ok(rule_id)
    }

    /// Evaluates an event against registered rules
    pub fn evaluate(&self, event_type: &str) -> Vec<TriggerRule> {
        self.rules
            .iter()
            .filter(|entry| entry.value().event_type == event_type)
            .map(|entry| entry.value().clone())
            .collect()
    }

    /// Removes a trigger rule by ID
    pub fn remove(&self, rule_id: &str) -> Result<(), String> {
        self.rules
            .remove(rule_id)
            .ok_or_else(|| format!("Trigger rule {} not found", rule_id))
            .map(|_| ())
    }
}

impl Default for TriggerEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trigger_rule_creation() {
        let rule = TriggerRule::new(
            "document_created".to_string(),
            vec!["status=draft".to_string()],
            vec!["send_notification".to_string()],
        );
        assert_eq!(rule.event_type, "document_created");
        assert_eq!(rule.conditions.len(), 1);
        assert_eq!(rule.actions.len(), 1);
    }

    #[test]
    fn test_trigger_engine_register() {
        let engine = TriggerEngine::new();
        let rule = TriggerRule::new(
            "user_added".to_string(),
            vec![],
            vec!["send_welcome_email".to_string()],
        );
        let result = engine.register(rule);
        assert!(result.is_ok());
    }

    #[test]
    fn test_trigger_engine_evaluate() {
        let engine = TriggerEngine::new();
        let rule = TriggerRule::new(
            "user_added".to_string(),
            vec![],
            vec!["send_welcome_email".to_string()],
        );
        engine
            .register(rule)
            .expect("rule registration should succeed");
        let results = engine.evaluate("user_added");
        assert_eq!(results.len(), 1);
    }
}
