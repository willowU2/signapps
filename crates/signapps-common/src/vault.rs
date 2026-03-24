//! Password manager vault with secure password entry storage and generation.

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// A password vault entry storing credentials with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultEntry {
    /// Unique identifier for the vault entry
    pub id: String,
    /// Display name for the credential (e.g., "Gmail Account")
    pub name: String,
    /// Username or email associated with the credential
    pub username: String,
    /// Encrypted password (base64 encoded)
    pub encrypted_password: String,
    /// URL associated with the credential (optional)
    pub url: Option<String>,
    /// Additional notes (optional)
    pub notes: Option<String>,
    /// Team ID this entry belongs to
    pub team_id: String,
    /// User ID who created this entry
    pub created_by: String,
    /// Timestamp when entry was created
    pub created_at: DateTime<Utc>,
}

/// In-memory thread-safe vault store using DashMap
pub struct VaultStore {
    entries: Arc<DashMap<String, VaultEntry>>,
}

impl VaultStore {
    /// Creates a new empty VaultStore
    pub fn new() -> Self {
        Self {
            entries: Arc::new(DashMap::new()),
        }
    }

    /// Adds a new vault entry
    pub fn add_entry(&self, entry: VaultEntry) -> Result<VaultEntry, String> {
        if self.entries.contains_key(&entry.id) {
            return Err(format!("Entry with id {} already exists", entry.id));
        }
        self.entries.insert(entry.id.clone(), entry.clone());
        Ok(entry)
    }

    /// Retrieves a vault entry by ID
    pub fn get_entry(&self, id: &str) -> Option<VaultEntry> {
        self.entries.get(id).map(|ref_multi| ref_multi.clone())
    }

    /// Lists all vault entries for a specific team
    pub fn list_entries(&self, team_id: &str) -> Vec<VaultEntry> {
        self.entries
            .iter()
            .filter(|entry| entry.team_id == team_id)
            .map(|entry| entry.clone())
            .collect()
    }

    /// Deletes a vault entry by ID
    pub fn delete_entry(&self, id: &str) -> Result<VaultEntry, String> {
        self.entries
            .remove(id)
            .map(|(_, entry)| entry)
            .ok_or_else(|| format!("Entry with id {} not found", id))
    }

    /// Generates a secure random password
    ///
    /// # Arguments
    /// * `length` - Desired password length (minimum 8, maximum 128)
    pub fn generate_password(length: usize) -> String {
        let length = length.clamp(8, 128);
        let mut rng = rand::thread_rng();

        let lowercase = "abcdefghijklmnopqrstuvwxyz".chars().collect::<Vec<_>>();
        let uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".chars().collect::<Vec<_>>();
        let digits = "0123456789".chars().collect::<Vec<_>>();
        let special = "!@#$%^&*()-_=+[]{}|;:,.<>?".chars().collect::<Vec<_>>();

        let mut password = vec![
            lowercase.choose(&mut rng).unwrap(),
            uppercase.choose(&mut rng).unwrap(),
            digits.choose(&mut rng).unwrap(),
            special.choose(&mut rng).unwrap(),
        ];

        // Fill remaining length with random chars from all categories
        let all_chars: Vec<char> = lowercase
            .iter()
            .chain(uppercase.iter())
            .chain(digits.iter())
            .chain(special.iter())
            .copied()
            .collect();

        for _ in 4..length {
            password.push(all_chars.choose(&mut rng).unwrap());
        }

        // Shuffle the password
        password.shuffle(&mut rng);

        password.into_iter().collect()
    }
}

impl Default for VaultStore {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for VaultStore {
    fn clone(&self) -> Self {
        Self {
            entries: Arc::clone(&self.entries),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_and_get_entry() {
        let store = VaultStore::new();
        let entry = VaultEntry {
            id: Uuid::new_v4().to_string(),
            name: "Test Account".to_string(),
            username: "testuser".to_string(),
            encrypted_password: "encrypted_data".to_string(),
            url: Some("https://example.com".to_string()),
            notes: Some("Test notes".to_string()),
            team_id: "team-123".to_string(),
            created_by: "user-456".to_string(),
            created_at: Utc::now(),
        };

        let id = entry.id.clone();
        store.add_entry(entry).unwrap();

        let retrieved = store.get_entry(&id).unwrap();
        assert_eq!(retrieved.name, "Test Account");
    }

    #[test]
    fn test_list_entries_by_team() {
        let store = VaultStore::new();
        let team_id = "team-123";

        for i in 0..3 {
            let entry = VaultEntry {
                id: Uuid::new_v4().to_string(),
                name: format!("Account {}", i),
                username: format!("user{}", i),
                encrypted_password: "encrypted".to_string(),
                url: None,
                notes: None,
                team_id: team_id.to_string(),
                created_by: "creator".to_string(),
                created_at: Utc::now(),
            };
            store.add_entry(entry).unwrap();
        }

        let entries = store.list_entries(team_id);
        assert_eq!(entries.len(), 3);
    }

    #[test]
    fn test_delete_entry() {
        let store = VaultStore::new();
        let entry = VaultEntry {
            id: Uuid::new_v4().to_string(),
            name: "Test".to_string(),
            username: "user".to_string(),
            encrypted_password: "encrypted".to_string(),
            url: None,
            notes: None,
            team_id: "team".to_string(),
            created_by: "creator".to_string(),
            created_at: Utc::now(),
        };

        let id = entry.id.clone();
        store.add_entry(entry).unwrap();
        assert!(store.get_entry(&id).is_some());

        store.delete_entry(&id).unwrap();
        assert!(store.get_entry(&id).is_none());
    }

    #[test]
    fn test_password_generation() {
        let pwd = VaultStore::generate_password(16);
        assert_eq!(pwd.len(), 16);

        // Check it has diverse character types
        let has_lower = pwd.chars().any(|c| c.is_lowercase());
        let has_upper = pwd.chars().any(|c| c.is_uppercase());
        let has_digit = pwd.chars().any(|c| c.is_numeric());
        let has_special = pwd.chars().any(|c| "!@#$%^&*()-_=+[]{}|;:,.<>?".contains(c));

        assert!(has_lower && has_upper && has_digit && has_special);
    }
}
