use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::str::FromStr;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EnvelopeStatus {
    Draft,
    Sent,
    InProgress,
    Completed,
    Declined,
    Expired,
    Voided,
}

impl EnvelopeStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Sent => "sent",
            Self::InProgress => "in_progress",
            Self::Completed => "completed",
            Self::Declined => "declined",
            Self::Expired => "expired",
            Self::Voided => "voided",
        }
    }

    pub fn valid_transitions(&self) -> &[EnvelopeStatus] {
        match self {
            Self::Draft => &[Self::Sent, Self::Voided],
            Self::Sent => &[
                Self::InProgress,
                Self::Declined,
                Self::Voided,
                Self::Expired,
            ],
            Self::InProgress => &[Self::Completed, Self::Declined, Self::Voided, Self::Expired],
            Self::Completed | Self::Declined | Self::Expired | Self::Voided => &[],
        }
    }

    pub fn can_transition_to(&self, target: EnvelopeStatus) -> bool {
        self.valid_transitions().contains(&target)
    }
}

impl FromStr for EnvelopeStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "draft" => Ok(Self::Draft),
            "sent" => Ok(Self::Sent),
            "in_progress" => Ok(Self::InProgress),
            "completed" => Ok(Self::Completed),
            "declined" => Ok(Self::Declined),
            "expired" => Ok(Self::Expired),
            "voided" => Ok(Self::Voided),
            _ => Err(format!("unknown envelope status: {s}")),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StepStatus {
    Pending,
    Notified,
    Viewed,
    Signed,
    Declined,
    Delegated,
    Expired,
}

impl StepStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Notified => "notified",
            Self::Viewed => "viewed",
            Self::Signed => "signed",
            Self::Declined => "declined",
            Self::Delegated => "delegated",
            Self::Expired => "expired",
        }
    }

    pub fn valid_transitions(&self) -> &[StepStatus] {
        match self {
            Self::Pending => &[Self::Notified, Self::Delegated, Self::Expired],
            Self::Notified => &[Self::Viewed, Self::Delegated, Self::Expired],
            Self::Viewed => &[Self::Signed, Self::Declined, Self::Delegated, Self::Expired],
            Self::Signed | Self::Declined | Self::Delegated | Self::Expired => &[],
        }
    }

    pub fn can_transition_to(&self, target: StepStatus) -> bool {
        self.valid_transitions().contains(&target)
    }
}

impl FromStr for StepStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "pending" => Ok(Self::Pending),
            "notified" => Ok(Self::Notified),
            "viewed" => Ok(Self::Viewed),
            "signed" => Ok(Self::Signed),
            "declined" => Ok(Self::Declined),
            "delegated" => Ok(Self::Delegated),
            "expired" => Ok(Self::Expired),
            _ => Err(format!("unknown step status: {s}")),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StepAction {
    Sign,
    Approve,
    Witness,
    Acknowledge,
    Delegate,
}

// --- Structs ---

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SignatureEnvelope {
    pub id: Uuid,
    pub title: String,
    pub document_id: Uuid,
    pub created_by: Uuid,
    pub status: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EnvelopeStep {
    pub id: Uuid,
    pub envelope_id: Uuid,
    pub step_order: i16,
    pub signer_email: Vec<u8>,
    pub signer_user_id: Option<Uuid>,
    pub signer_name: Option<Vec<u8>>,
    pub action: String,
    pub status: String,
    pub signed_at: Option<DateTime<Utc>>,
    pub signature_hash: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub decline_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EnvelopeTransition {
    pub id: Uuid,
    pub envelope_id: Uuid,
    pub step_id: Option<Uuid>,
    pub from_status: String,
    pub to_status: String,
    pub triggered_by: Option<Uuid>,
    pub reason: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEnvelope {
    pub title: String,
    pub document_id: Uuid,
    pub expires_at: Option<DateTime<Utc>>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStep {
    pub signer_email: Vec<u8>,
    pub signer_user_id: Option<Uuid>,
    pub signer_name: Option<Vec<u8>>,
    pub action: Option<String>,
}
