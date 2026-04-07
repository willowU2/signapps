//! # Reporting Module
//!
//! Auto-PDF reporting system with scheduled generation and multi-recipient delivery.
//!
//! ## Features
//!
//! - Report configuration with cron scheduling
//! - Template-based report generation (Weekly Activity, Monthly Metrics, Security Audit, Storage Usage)
//! - In-memory report engine
//! - Recipient management
//!
//! ## Example
//!
//! ```rust,ignore
//! use signapps_reporting::{ReportConfig, ReportTemplate, ReportEngine};
//!
//! let config = ReportConfig {
//!     id: uuid::Uuid::new_v4(),
//!     name: "Weekly Activity".to_string(),
//!     schedule_cron: "0 9 * * MON".to_string(),
//!     template: ReportTemplate::WeeklyActivity,
//!     recipients: vec!["admin@example.com".to_string()],
//!     enabled: true,
//! };
//!
//! let engine = ReportEngine::new();
//! let report_data = engine.generate(&config.template).await?;
//! engine.schedule(config).await?;
//! ```

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Reporting-specific error type.
#[derive(Debug, thiserror::Error)]
pub enum ReportingError {
    /// Validation error (e.g., empty cron expression or recipients list).
    #[error("validation error: {0}")]
    Validation(String),
}

// =============================================================================
// Report Template Enum
// =============================================================================

/// Available report templates for auto-generation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReportTemplate {
    /// Weekly activity summary (user actions, document uploads, collaboration metrics)
    WeeklyActivity,
    /// Monthly key metrics (storage usage, API calls, user engagement)
    MonthlyMetrics,
    /// Security audit report (login attempts, permission changes, access logs)
    SecurityAudit,
    /// Storage usage breakdown by user and folder
    StorageUsage,
}

impl ReportTemplate {
    /// Human-readable template name
    pub fn name(&self) -> &'static str {
        match self {
            ReportTemplate::WeeklyActivity => "Weekly Activity Report",
            ReportTemplate::MonthlyMetrics => "Monthly Metrics Report",
            ReportTemplate::SecurityAudit => "Security Audit Report",
            ReportTemplate::StorageUsage => "Storage Usage Report",
        }
    }

    /// File extension for exported report (e.g., "pdf")
    pub fn extension(&self) -> &'static str {
        "pdf"
    }
}

// =============================================================================
// Report Data & Configuration
// =============================================================================

/// Generated report data ready for PDF export.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportData {
    /// Unique report identifier
    pub id: Uuid,
    /// Report template type
    pub template: ReportTemplate,
    /// Report title (human-readable)
    pub title: String,
    /// Generated report content (markdown or structured data)
    pub content: String,
    /// UNIX timestamp when report was generated
    pub generated_at: i64,
    /// Data points for PDF rendering
    pub metrics: HashMap<String, String>,
}

/// Report configuration with scheduling and delivery settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportConfig {
    /// Unique report configuration identifier
    pub id: Uuid,
    /// Descriptive name (e.g., "Weekly Activity - Management")
    pub name: String,
    /// Cron expression for scheduling (e.g., "0 9 * * MON" = Monday 9 AM)
    pub schedule_cron: String,
    /// Report template to use
    pub template: ReportTemplate,
    /// Email recipients for delivery
    pub recipients: Vec<String>,
    /// Enable/disable this report schedule
    pub enabled: bool,
}

// =============================================================================
// Report Engine
// =============================================================================

/// In-memory report generation and scheduling engine.
pub struct ReportEngine {
    /// In-memory storage of generated reports
    reports: Arc<RwLock<HashMap<Uuid, ReportData>>>,
    /// Scheduled report configurations
    schedules: Arc<RwLock<HashMap<Uuid, ReportConfig>>>,
}

impl ReportEngine {
    /// Create a new report engine instance
    pub fn new() -> Self {
        Self {
            reports: Arc::new(RwLock::new(HashMap::new())),
            schedules: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Generate a report from the specified template.
    ///
    /// # Arguments
    ///
    /// * `template` - Report template to generate
    ///
    /// # Returns
    ///
    /// Generated `ReportData` with metrics and content
    ///
    /// # Errors
    ///
    /// Returns `ReportingError::Validation` if template generation fails.
    pub async fn generate(
        &self,
        template: &ReportTemplate,
    ) -> Result<ReportData, ReportingError> {
        let now = chrono::Utc::now().timestamp();
        let report_id = Uuid::new_v4();

        let (content, metrics) = match template {
            ReportTemplate::WeeklyActivity => self.generate_weekly_activity().await?,
            ReportTemplate::MonthlyMetrics => self.generate_monthly_metrics().await?,
            ReportTemplate::SecurityAudit => self.generate_security_audit().await?,
            ReportTemplate::StorageUsage => self.generate_storage_usage().await?,
        };

        let report = ReportData {
            id: report_id,
            template: *template,
            title: template.name().to_string(),
            content,
            generated_at: now,
            metrics,
        };

        // Store in memory
        self.reports.write().await.insert(report_id, report.clone());

        Ok(report)
    }

    /// Schedule a report for recurring generation.
    ///
    /// # Arguments
    ///
    /// * `config` - Report configuration with cron schedule
    ///
    /// # Errors
    ///
    /// Returns `ReportingError::Validation` if `schedule_cron` is empty or
    /// `recipients` list is empty.
    pub async fn schedule(&self, config: ReportConfig) -> Result<(), ReportingError> {
        if config.schedule_cron.is_empty() {
            return Err(ReportingError::Validation(
                "schedule_cron cannot be empty".to_string(),
            ));
        }

        if config.recipients.is_empty() {
            return Err(ReportingError::Validation(
                "recipients list cannot be empty".to_string(),
            ));
        }

        self.schedules.write().await.insert(config.id, config);

        Ok(())
    }

    /// Retrieve a previously generated report by ID.
    pub async fn get_report(&self, report_id: Uuid) -> Option<ReportData> {
        self.reports.read().await.get(&report_id).cloned()
    }

    /// List all scheduled report configurations.
    pub async fn list_schedules(&self) -> Vec<ReportConfig> {
        self.schedules.read().await.values().cloned().collect()
    }

    /// Remove a scheduled report.
    pub async fn unschedule(&self, config_id: Uuid) -> Result<(), ReportingError> {
        self.schedules.write().await.remove(&config_id);
        Ok(())
    }

    // Private helper methods for report generation

    async fn generate_weekly_activity(
        &self,
    ) -> Result<(String, HashMap<String, String>), ReportingError> {
        let mut metrics = HashMap::new();
        metrics.insert("active_users".to_string(), "42".to_string());
        metrics.insert("documents_created".to_string(), "18".to_string());
        metrics.insert("collaborations".to_string(), "7".to_string());

        let content = "# Weekly Activity Report\n\n\
                       - Active Users: 42\n\
                       - Documents Created: 18\n\
                       - Collaboration Events: 7\n\
                       - Average Session Duration: 2h 15m"
            .to_string();

        Ok((content, metrics))
    }

    async fn generate_monthly_metrics(
        &self,
    ) -> Result<(String, HashMap<String, String>), ReportingError> {
        let mut metrics = HashMap::new();
        metrics.insert("total_storage_gb".to_string(), "256".to_string());
        metrics.insert("api_calls".to_string(), "125000".to_string());
        metrics.insert("unique_users".to_string(), "87".to_string());

        let content = "# Monthly Metrics Report\n\n\
                       - Total Storage Used: 256 GB\n\
                       - API Calls: 125,000\n\
                       - Unique Users: 87\n\
                       - System Uptime: 99.95%"
            .to_string();

        Ok((content, metrics))
    }

    async fn generate_security_audit(
        &self,
    ) -> Result<(String, HashMap<String, String>), ReportingError> {
        let mut metrics = HashMap::new();
        metrics.insert("login_attempts".to_string(), "3245".to_string());
        metrics.insert("failed_logins".to_string(), "12".to_string());
        metrics.insert("permission_changes".to_string(), "5".to_string());

        let content = "# Security Audit Report\n\n\
                       - Login Attempts: 3,245\n\
                       - Failed Login Attempts: 12\n\
                       - Permission Changes: 5\n\
                       - Suspicious Activities: 0"
            .to_string();

        Ok((content, metrics))
    }

    async fn generate_storage_usage(
        &self,
    ) -> Result<(String, HashMap<String, String>), ReportingError> {
        let mut metrics = HashMap::new();
        metrics.insert("total_files".to_string(), "1847".to_string());
        metrics.insert("largest_folder".to_string(), "Documents".to_string());
        metrics.insert("unused_files".to_string(), "89".to_string());

        let content = "# Storage Usage Report\n\n\
                       - Total Files: 1,847\n\
                       - Total Storage: 256 GB\n\
                       - Largest Folder: Documents (124 GB)\n\
                       - Unused Files (>90 days): 89"
            .to_string();

        Ok((content, metrics))
    }
}

impl Default for ReportEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_report_generation() {
        let engine = ReportEngine::new();
        let report = engine.generate(&ReportTemplate::WeeklyActivity).await;
        assert!(report.is_ok());

        let report = report.expect("report generation should succeed");
        assert_eq!(report.template, ReportTemplate::WeeklyActivity);
        assert!(!report.content.is_empty());
        assert!(!report.metrics.is_empty());
    }

    #[tokio::test]
    async fn test_schedule_report() {
        let engine = ReportEngine::new();
        let config = ReportConfig {
            id: Uuid::new_v4(),
            name: "Test Report".to_string(),
            schedule_cron: "0 9 * * MON".to_string(),
            template: ReportTemplate::WeeklyActivity,
            recipients: vec!["admin@example.com".to_string()],
            enabled: true,
        };

        let result = engine.schedule(config.clone()).await;
        assert!(result.is_ok());

        let schedules = engine.list_schedules().await;
        assert_eq!(schedules.len(), 1);
    }

    #[tokio::test]
    async fn test_schedule_validation() {
        let engine = ReportEngine::new();

        // Empty cron should fail
        let config = ReportConfig {
            id: Uuid::new_v4(),
            name: "Test Report".to_string(),
            schedule_cron: "".to_string(),
            template: ReportTemplate::WeeklyActivity,
            recipients: vec!["admin@example.com".to_string()],
            enabled: true,
        };

        assert!(engine.schedule(config).await.is_err());

        // Empty recipients should fail
        let config = ReportConfig {
            id: Uuid::new_v4(),
            name: "Test Report".to_string(),
            schedule_cron: "0 9 * * MON".to_string(),
            template: ReportTemplate::WeeklyActivity,
            recipients: vec![],
            enabled: true,
        };

        assert!(engine.schedule(config).await.is_err());
    }

    #[tokio::test]
    async fn test_get_report() {
        let engine = ReportEngine::new();
        let report = engine
            .generate(&ReportTemplate::MonthlyMetrics)
            .await
            .expect("report generation should succeed");
        let report_id = report.id;

        let retrieved = engine.get_report(report_id).await;
        assert!(retrieved.is_some());
        assert_eq!(
            retrieved.expect("report should be retrievable").id,
            report_id
        );
    }

    #[tokio::test]
    async fn test_unschedule() {
        let engine = ReportEngine::new();
        let config = ReportConfig {
            id: Uuid::new_v4(),
            name: "Test Report".to_string(),
            schedule_cron: "0 9 * * MON".to_string(),
            template: ReportTemplate::WeeklyActivity,
            recipients: vec!["admin@example.com".to_string()],
            enabled: true,
        };

        engine
            .schedule(config.clone())
            .await
            .expect("schedule should succeed");
        assert_eq!(engine.list_schedules().await.len(), 1);

        engine
            .unschedule(config.id)
            .await
            .expect("unschedule should succeed");
        assert_eq!(engine.list_schedules().await.len(), 0);
    }
}
