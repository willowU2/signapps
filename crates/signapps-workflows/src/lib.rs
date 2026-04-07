//! # AI Workflow Automation Engine (V3-10)
//!
//! Foundation for event-driven workflow automation. Workflows define a trigger,
//! a set of conditions, and a list of actions. The [`WorkflowEngine`] evaluates
//! incoming [`DomainEvent`]s against registered workflows, checks conditions,
//! and logs the actions that *would* execute (no actual side-effects yet).
//!
//! ## Usage
//!
//! ```rust,ignore
//! use signapps_workflows::{
//!     WorkflowDefinition, WorkflowTrigger, WorkflowAction, WorkflowEngine,
//! };
//!
//! let mut engine = WorkflowEngine::new();
//! engine.register(WorkflowDefinition {
//!     id: uuid::Uuid::new_v4(),
//!     name: "Notify on upload".into(),
//!     trigger: WorkflowTrigger::OnEvent("FileUploaded".into()),
//!     conditions: vec![],
//!     actions: vec![WorkflowAction::SendNotification {
//!         user_id: uuid::Uuid::new_v4(),
//!         message: "A file was uploaded".into(),
//!     }],
//!     enabled: true,
//!     created_by: uuid::Uuid::new_v4(),
//! });
//! ```

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use signapps_common::events::{DomainEvent, EventEnvelope};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// What causes a workflow to fire.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", content = "value")]
pub enum WorkflowTrigger {
    /// Triggered when a [`DomainEvent`] whose serialized `type` tag matches
    /// the given string is published on the event bus.
    OnEvent(String),
    /// Triggered on a cron-like schedule (e.g. `"0 9 * * MON"`).
    OnSchedule(String),
    /// Triggered by an inbound webhook call.
    OnWebhook,
    /// Triggered only via explicit manual invocation.
    Manual,
}

/// Comparison operators used inside [`Condition`].
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConditionOp {
    /// Field value must exactly equal the condition value.
    Equals,
    /// Field value must differ from the condition value.
    NotEquals,
    /// Field string value must contain the condition string value as a substring.
    Contains,
    /// Field numeric value must be strictly greater than the threshold.
    GreaterThan,
    /// Field numeric value must be strictly less than the threshold.
    LessThan,
}

/// A single predicate that must hold for a workflow to fire.
///
/// The `field` is a dot-separated JSON path applied to the serialized event
/// payload (e.g. `"data.size"`). The `operator` + `value` define the test.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Condition {
    /// Dot-separated JSON path into the event payload (e.g. `"data.size"`).
    pub field: String,
    /// Comparison operator applied between the resolved field value and `value`.
    pub operator: ConditionOp,
    /// The right-hand side value used in the comparison.
    pub value: serde_json::Value,
}

/// An action the workflow engine should perform when a workflow fires.
///
/// In the current *foundation* phase every action is **log-only** — the engine
/// records what *would* happen without producing real side-effects.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action")]
pub enum WorkflowAction {
    /// Send an in-app notification to a specific user.
    SendNotification {
        /// Recipient user UUID.
        user_id: Uuid,
        /// Notification message body.
        message: String,
    },
    /// Move a file from one storage path to another.
    MoveFile {
        /// Source storage path.
        from: String,
        /// Destination storage path.
        to: String,
    },
    /// Create a task and assign it to a user.
    CreateTask {
        /// Title of the new task.
        title: String,
        /// UUID of the user the task should be assigned to.
        assignee: Uuid,
    },
    /// Invoke an AI model with a prompt.
    CallAI {
        /// The prompt to send to the AI model.
        prompt: String,
        /// Identifier of the AI model to use (e.g. `"llama3"`).
        model: String,
    },
    /// Deliver an HTTP webhook request to an external URL.
    CallWebhook {
        /// Target URL for the webhook POST request.
        url: String,
        /// JSON body to send with the request.
        payload: serde_json::Value,
    },
    /// Application-defined action with arbitrary parameters.
    Custom {
        /// Application-defined action type identifier.
        action_type: String,
        /// Arbitrary JSON parameters for the action handler.
        params: serde_json::Value,
    },
}

/// Complete definition of an automation workflow.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDefinition {
    /// Unique identifier for this workflow definition.
    pub id: Uuid,
    /// Human-readable name displayed in the UI.
    pub name: String,
    /// The event or schedule that causes this workflow to evaluate.
    pub trigger: WorkflowTrigger,
    /// All conditions that must pass before actions are executed.
    pub conditions: Vec<Condition>,
    /// Ordered list of actions to perform when the workflow fires.
    pub actions: Vec<WorkflowAction>,
    /// When `false`, this workflow is skipped during evaluation.
    pub enabled: bool,
    /// UUID of the user who created this workflow.
    pub created_by: Uuid,
}

/// Result of evaluating a single workflow against an event.
#[derive(Debug, Clone)]
pub struct WorkflowExecution {
    /// UUID of the workflow definition that was triggered.
    pub workflow_id: Uuid,
    /// Name of the workflow at the time it was triggered.
    pub workflow_name: String,
    /// UTC timestamp when the workflow was evaluated.
    pub triggered_at: DateTime<Utc>,
    /// The actions that were logged (but not yet executed in the foundation phase).
    pub actions_logged: Vec<WorkflowAction>,
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/// In-memory workflow engine.
///
/// Holds registered [`WorkflowDefinition`]s and provides methods to evaluate
/// incoming events and (for now) log which actions would run.
#[derive(Debug, Default)]
pub struct WorkflowEngine {
    workflows: Vec<WorkflowDefinition>,
}

impl WorkflowEngine {
    /// Create an empty engine with no registered workflows.
    pub fn new() -> Self {
        Self {
            workflows: Vec::new(),
        }
    }

    /// Register a workflow definition. Duplicate IDs are **not** checked in
    /// this foundation phase.
    pub fn register(&mut self, definition: WorkflowDefinition) {
        tracing::info!(
            workflow_id = %definition.id,
            name = %definition.name,
            "Workflow registered"
        );
        self.workflows.push(definition);
    }

    /// Return a slice of all registered workflow definitions.
    pub fn list(&self) -> &[WorkflowDefinition] {
        &self.workflows
    }

    /// Evaluate an [`EventEnvelope`] against every **enabled** workflow.
    ///
    /// Returns the list of workflows whose trigger + conditions matched.
    /// Matching workflows are then passed to [`execute`](Self::execute) which
    /// currently only logs the actions.
    pub fn evaluate(&self, envelope: &EventEnvelope) -> Vec<WorkflowExecution> {
        let event_type = event_type_tag(&envelope.event);
        let event_json = serde_json::to_value(&envelope.event).unwrap_or_default();

        self.workflows
            .iter()
            .filter(|w| w.enabled)
            .filter(|w| trigger_matches(&w.trigger, &event_type))
            .filter(|w| conditions_match(&w.conditions, &event_json))
            .map(|w| self.execute(w))
            .collect()
    }

    /// "Execute" a workflow — in foundation phase this only logs actions.
    pub fn execute(&self, workflow: &WorkflowDefinition) -> WorkflowExecution {
        tracing::info!(
            workflow_id = %workflow.id,
            name = %workflow.name,
            action_count = workflow.actions.len(),
            "Workflow triggered (log-only execution)"
        );

        for (i, action) in workflow.actions.iter().enumerate() {
            tracing::info!(
                workflow_id = %workflow.id,
                action_index = i,
                action = ?action,
                "Would execute action"
            );
        }

        WorkflowExecution {
            workflow_id: workflow.id,
            workflow_name: workflow.name.clone(),
            triggered_at: Utc::now(),
            actions_logged: workflow.actions.clone(),
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Extract the serde `type` tag from a [`DomainEvent`].
///
/// Because `DomainEvent` is serialized with `#[serde(tag = "type")]`, the JSON
/// representation contains a `"type"` field (e.g. `"FileUploaded"`).
fn event_type_tag(event: &DomainEvent) -> String {
    let val = serde_json::to_value(event).unwrap_or_default();
    val.get("type")
        .and_then(|t| t.as_str())
        .unwrap_or("Unknown")
        .to_string()
}

/// Check whether a [`WorkflowTrigger`] matches the given event type string.
fn trigger_matches(trigger: &WorkflowTrigger, event_type: &str) -> bool {
    match trigger {
        WorkflowTrigger::OnEvent(expected) => expected == event_type,
        // Schedule, webhook, and manual triggers are never matched by events.
        _ => false,
    }
}

/// Evaluate all [`Condition`]s against the serialized event JSON.
///
/// Returns `true` when **all** conditions pass (logical AND). An empty
/// condition list is always `true`.
fn conditions_match(conditions: &[Condition], event_json: &serde_json::Value) -> bool {
    conditions.iter().all(|c| evaluate_condition(c, event_json))
}

/// Evaluate a single [`Condition`] against a JSON value.
///
/// The `field` is resolved by walking dot-separated segments
/// (e.g. `"data.size"` → `event_json["data"]["size"]`).
fn evaluate_condition(condition: &Condition, json: &serde_json::Value) -> bool {
    let actual = resolve_field(json, &condition.field);
    let actual = match actual {
        Some(v) => v,
        None => return false,
    };

    match &condition.operator {
        ConditionOp::Equals => actual == &condition.value,
        ConditionOp::NotEquals => actual != &condition.value,
        ConditionOp::Contains => match (actual.as_str(), condition.value.as_str()) {
            (Some(haystack), Some(needle)) => haystack.contains(needle),
            _ => false,
        },
        ConditionOp::GreaterThan => compare_numbers(actual, &condition.value, |a, b| a > b),
        ConditionOp::LessThan => compare_numbers(actual, &condition.value, |a, b| a < b),
    }
}

/// Walk a dot-separated path into a [`serde_json::Value`].
fn resolve_field<'a>(json: &'a serde_json::Value, path: &str) -> Option<&'a serde_json::Value> {
    let mut current = json;
    for segment in path.split('.') {
        current = current.get(segment)?;
    }
    Some(current)
}

/// Compare two JSON values as `f64` using the provided comparator.
fn compare_numbers(
    a: &serde_json::Value,
    b: &serde_json::Value,
    cmp: fn(f64, f64) -> bool,
) -> bool {
    match (a.as_f64(), b.as_f64()) {
        (Some(va), Some(vb)) => cmp(va, vb),
        _ => false,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use signapps_common::events::{DomainEvent, EventEnvelope};

    fn sample_workflow(trigger_event: &str) -> WorkflowDefinition {
        WorkflowDefinition {
            id: Uuid::new_v4(),
            name: format!("Test workflow for {trigger_event}"),
            trigger: WorkflowTrigger::OnEvent(trigger_event.to_string()),
            conditions: vec![],
            actions: vec![WorkflowAction::SendNotification {
                user_id: Uuid::new_v4(),
                message: "Hello".into(),
            }],
            enabled: true,
            created_by: Uuid::new_v4(),
        }
    }

    #[test]
    fn register_and_list() {
        let mut engine = WorkflowEngine::new();
        assert!(engine.list().is_empty());

        engine.register(sample_workflow("FileUploaded"));
        assert_eq!(engine.list().len(), 1);
    }

    #[test]
    fn evaluate_matching_event() {
        let mut engine = WorkflowEngine::new();
        engine.register(sample_workflow("FileUploaded"));

        let envelope = EventEnvelope {
            id: Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            event: DomainEvent::FileUploaded {
                id: Uuid::new_v4(),
                user_id: Uuid::new_v4(),
                size: 512,
            },
        };

        let results = engine.evaluate(&envelope);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].actions_logged.len(), 1);
    }

    #[test]
    fn evaluate_non_matching_event() {
        let mut engine = WorkflowEngine::new();
        engine.register(sample_workflow("FileUploaded"));

        let envelope = EventEnvelope {
            id: Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            event: DomainEvent::UserCreated { id: Uuid::new_v4() },
        };

        let results = engine.evaluate(&envelope);
        assert!(results.is_empty());
    }

    #[test]
    fn disabled_workflow_is_skipped() {
        let mut engine = WorkflowEngine::new();
        let mut wf = sample_workflow("UserCreated");
        wf.enabled = false;
        engine.register(wf);

        let envelope = EventEnvelope {
            id: Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            event: DomainEvent::UserCreated { id: Uuid::new_v4() },
        };

        let results = engine.evaluate(&envelope);
        assert!(results.is_empty());
    }

    #[test]
    fn condition_equals_passes() {
        let mut engine = WorkflowEngine::new();
        let mut wf = sample_workflow("FileUploaded");
        wf.conditions = vec![Condition {
            field: "data.size".into(),
            operator: ConditionOp::Equals,
            value: serde_json::json!(1024),
        }];
        engine.register(wf);

        let envelope = EventEnvelope {
            id: Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            event: DomainEvent::FileUploaded {
                id: Uuid::new_v4(),
                user_id: Uuid::new_v4(),
                size: 1024,
            },
        };

        let results = engine.evaluate(&envelope);
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn condition_equals_fails() {
        let mut engine = WorkflowEngine::new();
        let mut wf = sample_workflow("FileUploaded");
        wf.conditions = vec![Condition {
            field: "data.size".into(),
            operator: ConditionOp::Equals,
            value: serde_json::json!(9999),
        }];
        engine.register(wf);

        let envelope = EventEnvelope {
            id: Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            event: DomainEvent::FileUploaded {
                id: Uuid::new_v4(),
                user_id: Uuid::new_v4(),
                size: 1024,
            },
        };

        let results = engine.evaluate(&envelope);
        assert!(results.is_empty());
    }

    #[test]
    fn condition_greater_than() {
        let mut engine = WorkflowEngine::new();
        let mut wf = sample_workflow("FileUploaded");
        wf.conditions = vec![Condition {
            field: "data.size".into(),
            operator: ConditionOp::GreaterThan,
            value: serde_json::json!(100),
        }];
        engine.register(wf);

        let envelope = EventEnvelope {
            id: Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            event: DomainEvent::FileUploaded {
                id: Uuid::new_v4(),
                user_id: Uuid::new_v4(),
                size: 512,
            },
        };

        let results = engine.evaluate(&envelope);
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn condition_contains_string() {
        let mut engine = WorkflowEngine::new();
        let mut wf = sample_workflow("Custom");
        wf.conditions = vec![Condition {
            field: "data.event_type".into(),
            operator: ConditionOp::Contains,
            value: serde_json::json!("invoice"),
        }];
        engine.register(wf);

        let envelope = EventEnvelope {
            id: Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            event: DomainEvent::Custom {
                event_type: "invoice.created".into(),
                payload: serde_json::json!({}),
            },
        };

        let results = engine.evaluate(&envelope);
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn manual_trigger_never_matches_events() {
        let mut engine = WorkflowEngine::new();
        let mut wf = sample_workflow("UserCreated");
        wf.trigger = WorkflowTrigger::Manual;
        engine.register(wf);

        let envelope = EventEnvelope {
            id: Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            event: DomainEvent::UserCreated { id: Uuid::new_v4() },
        };

        let results = engine.evaluate(&envelope);
        assert!(results.is_empty());
    }

    #[test]
    fn serialization_roundtrip() {
        let wf = sample_workflow("FileUploaded");
        let json = serde_json::to_string(&wf).expect("serialize");
        let deserialized: WorkflowDefinition = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(deserialized.name, wf.name);
        assert_eq!(deserialized.enabled, wf.enabled);
    }

    #[test]
    fn all_action_variants_serialize() {
        let actions = vec![
            WorkflowAction::SendNotification {
                user_id: Uuid::new_v4(),
                message: "hi".into(),
            },
            WorkflowAction::MoveFile {
                from: "/a".into(),
                to: "/b".into(),
            },
            WorkflowAction::CreateTask {
                title: "task".into(),
                assignee: Uuid::new_v4(),
            },
            WorkflowAction::CallAI {
                prompt: "summarize".into(),
                model: "llama3".into(),
            },
            WorkflowAction::CallWebhook {
                url: "https://example.com".into(),
                payload: serde_json::json!({"key": "val"}),
            },
            WorkflowAction::Custom {
                action_type: "x".into(),
                params: serde_json::json!(null),
            },
        ];
        for action in &actions {
            let json = serde_json::to_string(action).expect("serialize action");
            let _: WorkflowAction = serde_json::from_str(&json).expect("deserialize action");
        }
    }
}
