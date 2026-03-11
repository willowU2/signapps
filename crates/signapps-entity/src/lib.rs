//! SignApps Entity Crate
//!
//! This crate contains SeaORM entity definitions for the SignApps Platform.
//! Each module represents a database table with its corresponding entity model.

pub mod account;

pub use account::Entity as Account;

/// Re-export SeaORM prelude for convenience
pub mod prelude {
    pub use super::account::{
        ActiveModel as AccountActiveModel, Column as AccountColumn, Entity as Account,
        Model as AccountModel,
    };
    pub use sea_orm::entity::prelude::*;
}
