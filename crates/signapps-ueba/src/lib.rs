//! User and Entity Behavior Analytics (UEBA) module.
//!
//! Provides behavior tracking and anomaly detection for user activities.
//! Records user actions and compares them against established baselines
//! to identify suspicious behavior patterns.

use chrono::{DateTime, Timelike, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

/// A user behavior event record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserBehavior {
    /// User identifier.
    pub user_id: Uuid,
    /// Action performed (e.g., "login", "download", "upload", "share").
    pub action: String,
    /// Timestamp when the action occurred.
    pub timestamp: DateTime<Utc>,
    /// IP address from which the action originated.
    pub ip: String,
    /// Additional contextual metadata (resource accessed, size, etc.).
    #[serde(default)]
    pub metadata: HashMap<String, String>,
}

impl UserBehavior {
    /// Create a new behavior record.
    pub fn new(user_id: Uuid, action: String, ip: String) -> Self {
        Self {
            user_id,
            action,
            timestamp: Utc::now(),
            ip,
            metadata: HashMap::new(),
        }
    }

    /// Add metadata to this behavior record.
    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }
}

/// Baseline of typical user behavior patterns.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorBaseline {
    /// User identifier.
    pub user_id: Uuid,
    /// Average number of logins per day.
    pub avg_logins_per_day: f64,
    /// Average number of downloads per day.
    pub avg_downloads_per_day: f64,
    /// Typical hours of activity (0-23 in UTC).
    pub typical_hours: Vec<u32>,
    /// Known IP addresses (whitelist).
    pub known_ips: Vec<String>,
    /// Last updated timestamp.
    pub last_updated: DateTime<Utc>,
}

impl BehaviorBaseline {
    /// Create a new behavior baseline.
    pub fn new(user_id: Uuid) -> Self {
        Self {
            user_id,
            avg_logins_per_day: 1.0,
            avg_downloads_per_day: 0.0,
            typical_hours: vec![8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
            known_ips: Vec::new(),
            last_updated: Utc::now(),
        }
    }
}

/// An anomaly detected in user behavior.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Anomaly {
    /// User where anomaly was detected.
    pub user_id: Uuid,
    /// Type of anomaly (e.g., "unusual_ip", "off_hours_access", "excessive_downloads").
    pub anomaly_type: String,
    /// Risk score 0-100 (higher = more suspicious).
    pub risk_score: u32,
    /// Description of the anomaly.
    pub description: String,
    /// When the anomaly was detected.
    pub detected_at: DateTime<Utc>,
}

/// Detector for behavioral anomalies.
pub struct AnomalyDetector {
    baselines: Arc<Mutex<HashMap<Uuid, BehaviorBaseline>>>,
    behaviors: Arc<Mutex<Vec<UserBehavior>>>,
}

impl AnomalyDetector {
    /// Create a new anomaly detector.
    pub fn new() -> Self {
        Self {
            baselines: Arc::new(Mutex::new(HashMap::new())),
            behaviors: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Register or update a baseline for a user.
    pub fn set_baseline(&self, baseline: BehaviorBaseline) {
        if let Ok(mut baselines) = self.baselines.lock() {
            baselines.insert(baseline.user_id, baseline);
        }
    }

    /// Record a user behavior event.
    pub fn record_behavior(&self, behavior: UserBehavior) {
        if let Ok(mut behaviors) = self.behaviors.lock() {
            behaviors.push(behavior);
            // Keep only recent behaviors (last 10k)
            if behaviors.len() > 10_000 {
                behaviors.drain(0..5_000);
            }
        }
    }

    /// Check for anomalies for a specific user.
    /// Returns an Anomaly if suspicious behavior is detected, None otherwise.
    pub fn check_anomaly(&self, user_id: Uuid) -> Option<Anomaly> {
        let baselines = self.baselines.lock().ok()?;
        let baseline = baselines.get(&user_id)?;

        let behaviors = self.behaviors.lock().ok()?;

        // Get recent behaviors for this user (last 24 hours)
        let now = Utc::now();
        let recent_behaviors: Vec<_> = behaviors
            .iter()
            .filter(|b| {
                b.user_id == user_id && (now.signed_duration_since(b.timestamp)).num_hours() < 24
            })
            .collect();

        if recent_behaviors.is_empty() {
            return None;
        }

        // Check for unusual IP addresses
        for behavior in &recent_behaviors {
            if !baseline.known_ips.contains(&behavior.ip) && !baseline.known_ips.is_empty() {
                return Some(Anomaly {
                    user_id,
                    anomaly_type: "unusual_ip".to_string(),
                    risk_score: 75,
                    description: format!("Login from unknown IP: {}", behavior.ip),
                    detected_at: Utc::now(),
                });
            }
        }

        // Check for off-hours access
        for behavior in &recent_behaviors {
            let hour = behavior.timestamp.hour();
            if !baseline.typical_hours.contains(&hour)
                && behavior.action.to_lowercase().contains("access")
            {
                return Some(Anomaly {
                    user_id,
                    anomaly_type: "off_hours_access".to_string(),
                    risk_score: 50,
                    description: format!("Suspicious access at hour {}", hour),
                    detected_at: Utc::now(),
                });
            }
        }

        // Check for excessive downloads
        let download_count = recent_behaviors
            .iter()
            .filter(|b| b.action.to_lowercase().contains("download"))
            .count();

        if (download_count as f64) > baseline.avg_downloads_per_day * 3.0 {
            return Some(Anomaly {
                user_id,
                anomaly_type: "excessive_downloads".to_string(),
                risk_score: 60,
                description: format!("Excessive downloads detected: {} in 24h", download_count),
                detected_at: Utc::now(),
            });
        }

        None
    }

    /// Get all recorded behaviors for a user.
    pub fn get_user_behaviors(&self, user_id: Uuid) -> Option<Vec<UserBehavior>> {
        self.behaviors.lock().ok().map(|behaviors| {
            behaviors
                .iter()
                .filter(|b| b.user_id == user_id)
                .cloned()
                .collect()
        })
    }

    /// Clear all recorded behaviors (for testing).
    #[cfg(test)]
    #[allow(dead_code)]
    fn clear_behaviors(&self) {
        if let Ok(mut behaviors) = self.behaviors.lock() {
            behaviors.clear();
        }
    }
}

impl Default for AnomalyDetector {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_anomaly_detector_creation() {
        let detector = AnomalyDetector::new();
        let user_id = Uuid::new_v4();
        let baseline = BehaviorBaseline::new(user_id);
        detector.set_baseline(baseline.clone());
        assert_eq!(baseline.user_id, user_id);
    }

    #[test]
    fn test_record_behavior() {
        let detector = AnomalyDetector::new();
        let user_id = Uuid::new_v4();
        let behavior = UserBehavior::new(user_id, "login".to_string(), "192.168.1.1".to_string());
        detector.record_behavior(behavior.clone());

        let behaviors = detector.get_user_behaviors(user_id);
        assert!(behaviors.is_some());
        assert_eq!(behaviors.expect("behaviors should be present").len(), 1);
    }

    #[test]
    fn test_detect_unusual_ip() {
        let detector = AnomalyDetector::new();
        let user_id = Uuid::new_v4();

        let mut baseline = BehaviorBaseline::new(user_id);
        baseline.known_ips = vec!["192.168.1.1".to_string(), "10.0.0.1".to_string()];
        detector.set_baseline(baseline);

        let behavior = UserBehavior::new(user_id, "login".to_string(), "203.0.113.5".to_string());
        detector.record_behavior(behavior);

        let anomaly = detector.check_anomaly(user_id);
        assert!(anomaly.is_some());
        assert_eq!(
            anomaly.expect("anomaly should be detected").anomaly_type,
            "unusual_ip"
        );
    }

    #[test]
    fn test_no_anomaly_with_known_ip() {
        let detector = AnomalyDetector::new();
        let user_id = Uuid::new_v4();

        let mut baseline = BehaviorBaseline::new(user_id);
        baseline.known_ips = vec!["192.168.1.1".to_string()];
        detector.set_baseline(baseline);

        let behavior = UserBehavior::new(user_id, "read".to_string(), "192.168.1.1".to_string());
        detector.record_behavior(behavior);

        let anomaly = detector.check_anomaly(user_id);
        assert!(anomaly.is_none());
    }
}
