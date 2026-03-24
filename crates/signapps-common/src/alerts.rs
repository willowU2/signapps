//! Custom alerts system for SignApps Platform.
//!
//! Provides rule-based alerting with multiple notification channels,
//! configurable conditions, and cooldown management to prevent alert fatigue.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Comparison operators for alert conditions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ComparisonOperator {
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    Equal,
    NotEqual,
}

impl ComparisonOperator {
    /// Evaluate the operator against a given value and threshold.
    pub fn evaluate(&self, value: f64, threshold: f64) -> bool {
        match self {
            Self::GreaterThan => value > threshold,
            Self::GreaterThanOrEqual => value >= threshold,
            Self::LessThan => value < threshold,
            Self::LessThanOrEqual => value <= threshold,
            Self::Equal => (value - threshold).abs() < f64::EPSILON,
            Self::NotEqual => (value - threshold).abs() >= f64::EPSILON,
        }
    }
}

/// Condition that triggers an alert.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertCondition {
    /// Metric name to monitor (e.g., "cpu_usage", "error_rate").
    pub metric: String,
    /// Comparison operator.
    pub operator: ComparisonOperator,
    /// Threshold value.
    pub threshold: f64,
}

impl AlertCondition {
    /// Create a new alert condition.
    pub fn new(metric: impl Into<String>, operator: ComparisonOperator, threshold: f64) -> Self {
        Self {
            metric: metric.into(),
            operator,
            threshold,
        }
    }

    /// Check if the condition is met.
    pub fn is_triggered(&self, value: f64) -> bool {
        self.operator.evaluate(value, self.threshold)
    }
}

/// Notification channels for alerts.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AlertChannel {
    /// Email notification.
    #[serde(rename = "email")]
    Email(String),
    /// Chat/Messaging notification (e.g., Slack, Teams).
    #[serde(rename = "chat")]
    Chat(Uuid),
    /// Generic webhook notification.
    #[serde(rename = "webhook")]
    Webhook(String),
}

/// Alert rule defining when and how to notify.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertRule {
    /// Unique identifier for the rule.
    pub id: Uuid,
    /// Human-readable name of the alert rule.
    pub name: String,
    /// Condition that triggers the alert.
    pub condition: AlertCondition,
    /// Notification channels.
    pub channels: Vec<AlertChannel>,
    /// Whether the rule is active.
    pub enabled: bool,
    /// Cooldown period in minutes to prevent alert fatigue.
    pub cooldown_minutes: u32,
}

impl AlertRule {
    /// Create a new alert rule.
    pub fn new(
        name: impl Into<String>,
        condition: AlertCondition,
        channels: Vec<AlertChannel>,
        cooldown_minutes: u32,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            condition,
            channels,
            enabled: true,
            cooldown_minutes,
        }
    }

    /// Check if this rule should trigger an alert for the given value.
    pub fn should_trigger(&self, value: f64) -> bool {
        self.enabled && self.condition.is_triggered(value)
    }
}

/// An alert that has been triggered.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    /// Unique identifier for this alert instance.
    pub id: Uuid,
    /// ID of the rule that triggered this alert.
    pub rule_id: Uuid,
    /// Name of the alert.
    pub name: String,
    /// Metric name and value that triggered the alert.
    pub metric: String,
    /// Metric value at trigger time.
    pub value: f64,
    /// Timestamp when alert was triggered (ISO 8601).
    pub triggered_at: String,
}

impl Alert {
    /// Create a new alert from a triggered rule.
    pub fn from_rule(rule: &AlertRule, value: f64) -> Self {
        Self {
            id: Uuid::new_v4(),
            rule_id: rule.id,
            name: rule.name.clone(),
            metric: rule.condition.metric.clone(),
            value,
            triggered_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

/// Manages alert rules and checks metrics against them.
#[derive(Debug, Clone)]
pub struct AlertManager {
    rules: HashMap<Uuid, AlertRule>,
    last_alert_time: HashMap<Uuid, String>, // ISO 8601 timestamps
}

impl AlertManager {
    /// Create a new alert manager.
    pub fn new() -> Self {
        Self {
            rules: HashMap::new(),
            last_alert_time: HashMap::new(),
        }
    }

    /// Register a new alert rule.
    pub fn add_rule(&mut self, rule: AlertRule) {
        self.rules.insert(rule.id, rule);
    }

    /// Remove an alert rule by ID.
    pub fn remove_rule(&mut self, rule_id: Uuid) -> Option<AlertRule> {
        self.last_alert_time.remove(&rule_id);
        self.rules.remove(&rule_id)
    }

    /// Get a rule by ID.
    pub fn get_rule(&self, rule_id: Uuid) -> Option<&AlertRule> {
        self.rules.get(&rule_id)
    }

    /// Get all registered rules.
    pub fn list_rules(&self) -> Vec<AlertRule> {
        self.rules.values().cloned().collect()
    }

    /// Check a metric value against all rules and return triggered alerts.
    ///
    /// Respects cooldown periods to prevent alert spam.
    pub fn check(&mut self, metric_name: &str, value: f64) -> Vec<Alert> {
        let mut alerts = Vec::new();

        for rule in self.rules.values() {
            if !rule.should_trigger(value) || rule.condition.metric != metric_name {
                continue;
            }

            // Check cooldown
            if let Some(last_time) = self.last_alert_time.get(&rule.id) {
                if let (Ok(last), Ok(now)) = (
                    chrono::DateTime::parse_from_rfc3339(last_time),
                    chrono::DateTime::parse_from_rfc3339(&chrono::Utc::now().to_rfc3339()),
                ) {
                    let elapsed_minutes = (now.timestamp() - last.timestamp()) / 60;
                    if elapsed_minutes < rule.cooldown_minutes as i64 {
                        continue; // Still in cooldown period
                    }
                }
            }

            // Trigger alert
            let alert = Alert::from_rule(rule, value);
            self.last_alert_time
                .insert(rule.id, alert.triggered_at.clone());
            alerts.push(alert);
        }

        alerts
    }
}

impl Default for AlertManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_comparison_operator_evaluation() {
        assert!(ComparisonOperator::GreaterThan.evaluate(10.0, 5.0));
        assert!(!ComparisonOperator::GreaterThan.evaluate(3.0, 5.0));
        assert!(ComparisonOperator::LessThan.evaluate(3.0, 5.0));
        assert!(ComparisonOperator::Equal.evaluate(5.0, 5.0));
    }

    #[test]
    fn test_alert_condition_triggered() {
        let condition = AlertCondition::new("cpu", ComparisonOperator::GreaterThan, 80.0);
        assert!(condition.is_triggered(85.0));
        assert!(!condition.is_triggered(75.0));
    }

    #[test]
    fn test_alert_manager_basic() {
        let mut manager = AlertManager::new();
        let rule = AlertRule::new(
            "High CPU",
            AlertCondition::new("cpu_usage", ComparisonOperator::GreaterThan, 80.0),
            vec![AlertChannel::Email("admin@example.com".into())],
            5,
        );
        manager.add_rule(rule);

        let alerts = manager.check("cpu_usage", 85.0);
        assert_eq!(alerts.len(), 1);
        assert_eq!(alerts[0].metric, "cpu_usage");
        assert_eq!(alerts[0].value, 85.0);
    }
}
