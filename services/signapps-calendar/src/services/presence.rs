//! Real-time presence tracking for calendar collaboration
//! Manages connected users, their status, and activity tracking

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;
use tracing::{debug, info};

/// User presence status
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum PresenceStatus {
    /// User just joined
    #[serde(rename = "join")]
    Join,
    /// User is viewing calendar
    #[serde(rename = "viewing")]
    Viewing,
    /// User is editing an event
    #[serde(rename = "editing")]
    Editing,
    /// User is idle (no activity for 30s)
    #[serde(rename = "idle")]
    Idle,
    /// User disconnected
    #[serde(rename = "leave")]
    Leave,
}

/// User presence information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPresence {
    pub user_id: Uuid,
    pub calendar_id: Uuid,
    pub username: String,
    pub status: PresenceStatus,
    pub editing_item_id: Option<Uuid>,
    pub last_activity: u64,
    pub connected_at: u64,
    pub session_id: Uuid,
}

/// Presence manager for a calendar
pub struct CalendarPresenceManager {
    /// Users currently viewing this calendar: user_id -> UserPresence
    users: Arc<DashMap<Uuid, UserPresence>>,
    /// Calendar ID
    calendar_id: Uuid,
}

impl CalendarPresenceManager {
    /// Create new presence manager for a calendar
    pub fn new(calendar_id: Uuid) -> Self {
        info!(calendar_id = %calendar_id, "Created presence manager");
        Self {
            users: Arc::new(DashMap::new()),
            calendar_id,
        }
    }

    /// User joined calendar
    pub fn on_user_join(
        &self,
        user_id: Uuid,
        username: String,
        session_id: Uuid,
    ) -> UserPresence {
        let now = Self::timestamp_now();
        let presence = UserPresence {
            user_id,
            calendar_id: self.calendar_id,
            username: username.clone(),
            status: PresenceStatus::Join,
            editing_item_id: None,
            last_activity: now,
            connected_at: now,
            session_id,
        };

        self.users.insert(user_id, presence.clone());

        info!(
            user_id = %user_id,
            username = %username,
            calendar_id = %self.calendar_id,
            "User joined calendar"
        );

        presence
    }

    /// User left calendar
    pub fn on_user_leave(&self, user_id: Uuid) -> Option<UserPresence> {
        let (_, mut presence) = self.users.remove(&user_id)?;
        presence.status = PresenceStatus::Leave;

        info!(
            user_id = %user_id,
            calendar_id = %self.calendar_id,
            "User left calendar"
        );

        Some(presence)
    }

    /// Update user activity timestamp
    pub fn on_user_activity(&self, user_id: Uuid) {
        if let Some(mut presence) = self.users.get_mut(&user_id) {
            presence.last_activity = Self::timestamp_now();
            presence.status = PresenceStatus::Viewing;
        }
    }

    /// User started editing item
    pub fn on_editing_start(&self, user_id: Uuid, item_id: Uuid) {
        if let Some(mut presence) = self.users.get_mut(&user_id) {
            presence.status = PresenceStatus::Editing;
            presence.editing_item_id = Some(item_id);
            presence.last_activity = Self::timestamp_now();

            debug!(
                user_id = %user_id,
                item_id = %item_id,
                "User started editing"
            );
        }
    }

    /// User finished editing item
    pub fn on_editing_end(&self, user_id: Uuid) {
        if let Some(mut presence) = self.users.get_mut(&user_id) {
            presence.status = PresenceStatus::Viewing;
            presence.editing_item_id = None;
            presence.last_activity = Self::timestamp_now();

            debug!(user_id = %user_id, "User finished editing");
        }
    }

    /// Mark idle users (no activity for 30 seconds)
    pub fn mark_idle_users(&self) {
        let now = Self::timestamp_now();
        let idle_threshold = 30; // seconds

        let mut marked_idle = 0;
        for mut presence in self.users.iter_mut() {
            if now - presence.last_activity > idle_threshold
                && presence.status != PresenceStatus::Idle
            {
                presence.status = PresenceStatus::Idle;
                marked_idle += 1;
            }
        }

        if marked_idle > 0 {
            debug!(
                calendar_id = %self.calendar_id,
                count = marked_idle,
                "Marked idle users"
            );
        }
    }

    /// Get all active users
    pub fn get_active_users(&self) -> Vec<UserPresence> {
        self.users
            .iter()
            .map(|entry| entry.value().clone())
            .collect()
    }

    /// Get users editing specific item
    pub fn get_users_editing(&self, item_id: Uuid) -> Vec<UserPresence> {
        self.users
            .iter()
            .filter(|entry| {
                entry.value().status == PresenceStatus::Editing
                    && entry.value().editing_item_id == Some(item_id)
            })
            .map(|entry| entry.value().clone())
            .collect()
    }

    /// Get presence state for single user
    pub fn get_user_presence(&self, user_id: Uuid) -> Option<UserPresence> {
        self.users.get(&user_id).map(|entry| entry.value().clone())
    }

    /// Get active user count
    pub fn active_user_count(&self) -> usize {
        self.users
            .iter()
            .filter(|entry| {
                matches!(
                    entry.value().status,
                    PresenceStatus::Viewing | PresenceStatus::Editing
                )
            })
            .count()
    }

    /// Clear all presence (for testing)
    #[cfg(test)]
    pub fn clear(&self) {
        self.users.clear();
    }

    /// Get Unix timestamp in seconds
    fn timestamp_now() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    }
}

/// Global presence manager for all calendars
pub struct PresenceManager {
    /// Calendar ID -> Presence Manager
    calendars: Arc<DashMap<Uuid, Arc<CalendarPresenceManager>>>,
}

impl PresenceManager {
    /// Create new global presence manager
    pub fn new() -> Self {
        info!("Created global presence manager");
        Self {
            calendars: Arc::new(DashMap::new()),
        }
    }

    /// Get or create presence manager for calendar
    pub fn get_calendar_presence(&self, calendar_id: Uuid) -> Arc<CalendarPresenceManager> {
        if let Some(entry) = self.calendars.get(&calendar_id) {
            entry.clone()
        } else {
            let manager = Arc::new(CalendarPresenceManager::new(calendar_id));
            self.calendars.insert(calendar_id, manager.clone());
            manager
        }
    }

    /// Clean up idle calendars (no active users)
    pub fn cleanup_empty_calendars(&self) {
        let mut removed = 0;
        self.calendars.retain(|_, manager| {
            let has_users = manager.active_user_count() > 0;
            if !has_users {
                removed += 1;
            }
            has_users
        });

        if removed > 0 {
            debug!(count = removed, "Removed empty calendar presence managers");
        }
    }

    /// Get calendar count
    pub fn calendar_count(&self) -> usize {
        self.calendars.len()
    }
}

impl Default for PresenceManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_join_leave() {
        let calendar_id = Uuid::new_v4();
        let manager = CalendarPresenceManager::new(calendar_id);
        let user_id = Uuid::new_v4();

        // Join
        let presence = manager.on_user_join(user_id, "Alice".to_string(), Uuid::new_v4());
        assert_eq!(presence.status, PresenceStatus::Join);
        assert_eq!(presence.username, "Alice");

        // Check presence
        assert!(manager.get_user_presence(user_id).is_some());

        // Leave
        let left = manager.on_user_leave(user_id);
        assert!(left.is_some());
        assert_eq!(left.unwrap().status, PresenceStatus::Leave);
        assert!(manager.get_user_presence(user_id).is_none());
    }

    #[test]
    fn test_editing_status() {
        let calendar_id = Uuid::new_v4();
        let manager = CalendarPresenceManager::new(calendar_id);
        let user_id = Uuid::new_v4();
        let item_id = Uuid::new_v4();

        manager.on_user_join(user_id, "Bob".to_string(), Uuid::new_v4());

        // Start editing
        manager.on_editing_start(user_id, item_id);
        let presence = manager.get_user_presence(user_id).unwrap();
        assert_eq!(presence.status, PresenceStatus::Editing);
        assert_eq!(presence.editing_item_id, Some(item_id));

        // Stop editing
        manager.on_editing_end(user_id);
        let presence = manager.get_user_presence(user_id).unwrap();
        assert_eq!(presence.status, PresenceStatus::Viewing);
        assert_eq!(presence.editing_item_id, None);
    }

    #[test]
    fn test_multiple_users() {
        let calendar_id = Uuid::new_v4();
        let manager = CalendarPresenceManager::new(calendar_id);

        let user1 = Uuid::new_v4();
        let user2 = Uuid::new_v4();
        let user3 = Uuid::new_v4();

        manager.on_user_join(user1, "Alice".to_string(), Uuid::new_v4());
        manager.on_user_join(user2, "Bob".to_string(), Uuid::new_v4());
        manager.on_user_join(user3, "Charlie".to_string(), Uuid::new_v4());

        assert_eq!(manager.active_user_count(), 3);

        let users = manager.get_active_users();
        assert_eq!(users.len(), 3);

        manager.on_user_leave(user2);
        assert_eq!(manager.active_user_count(), 2);
    }

    #[test]
    fn test_idle_detection() {
        let calendar_id = Uuid::new_v4();
        let manager = CalendarPresenceManager::new(calendar_id);
        let user_id = Uuid::new_v4();

        manager.on_user_join(user_id, "Alice".to_string(), Uuid::new_v4());

        // User not idle yet
        manager.mark_idle_users();
        let presence = manager.get_user_presence(user_id).unwrap();
        assert_ne!(presence.status, PresenceStatus::Idle);

        // Simulate time passage by checking is still "viewing"
        assert_eq!(presence.status, PresenceStatus::Join);
    }

    #[test]
    fn test_global_presence_manager() {
        let manager = PresenceManager::new();
        let calendar_id = Uuid::new_v4();

        let cal_presence = manager.get_calendar_presence(calendar_id);
        assert_eq!(manager.calendar_count(), 1);

        // Get same calendar again
        let cal_presence2 = manager.get_calendar_presence(calendar_id);
        assert_eq!(manager.calendar_count(), 1);

        // Both should be same manager
        assert_eq!(
            Arc::as_ptr(&cal_presence),
            Arc::as_ptr(&cal_presence2)
        );
    }
}
