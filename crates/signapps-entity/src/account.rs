//! Account Entity
//!
//! Represents a user account in the SignApps Platform.
//! This is a demonstration entity to prove SeaORM integration.

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Account entity representing the `accounts` table
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "accounts")]
pub struct Model {
    /// Primary key - UUID
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,

    /// Account username (unique)
    #[sea_orm(unique)]
    pub username: String,

    /// Account email address (unique)
    #[sea_orm(unique)]
    pub email: String,

    /// Hashed password (argon2)
    pub password_hash: String,

    /// Display name
    pub display_name: Option<String>,

    /// Account status: active, suspended, pending
    #[sea_orm(default_value = "pending")]
    pub status: String,

    /// Role level: 0=user, 1=admin, 2=superadmin
    #[sea_orm(default_value = "0")]
    pub role: i16,

    /// Account creation timestamp
    pub created_at: DateTimeUtc,

    /// Last update timestamp
    pub updated_at: DateTimeUtc,

    /// Last login timestamp
    pub last_login_at: Option<DateTimeUtc>,
}

/// Relation definitions for the Account entity
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::EntityTrait;

    #[test]
    fn test_entity_name() {
        assert_eq!(Entity::default().table_name(), "accounts");
    }

    #[test]
    fn test_column_names() {
        assert_eq!(Column::Id.to_string(), "id");
        assert_eq!(Column::Username.to_string(), "username");
        assert_eq!(Column::Email.to_string(), "email");
    }
}
