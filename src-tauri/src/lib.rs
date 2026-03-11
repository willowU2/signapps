//! SignApps Tauri Library
//!
//! This module provides Tauri commands and integration for the SignApps desktop application.
//! Demonstrates full integration with SeaORM for database operations.

use sea_orm::{
    ActiveModelTrait, ColumnTrait, Database, DatabaseConnection, EntityTrait, QueryFilter, Set,
};
use serde::{Deserialize, Serialize};
use signapps_entity::prelude::*;
use std::sync::Arc;
use tauri::{Manager, State};
use tokio::sync::Mutex;
use uuid::Uuid;

/// Application state containing the database connection
pub struct AppState {
    pub db: Arc<Mutex<Option<DatabaseConnection>>>,
}

/// Account response DTO for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountResponse {
    pub id: String,
    pub username: String,
    pub email: String,
    pub display_name: Option<String>,
    pub status: String,
    pub role: i16,
    pub created_at: String,
}

impl From<AccountModel> for AccountResponse {
    fn from(model: AccountModel) -> Self {
        Self {
            id: model.id.to_string(),
            username: model.username,
            email: model.email,
            display_name: model.display_name,
            status: model.status,
            role: model.role,
            created_at: model.created_at.to_rfc3339(),
        }
    }
}

/// Create account request DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAccountRequest {
    pub username: String,
    pub email: String,
    pub password: String,
    pub display_name: Option<String>,
}

/// Greet command for testing Tauri integration
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to SignApps Platform.", name)
}

/// Get application version
#[tauri::command]
fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Initialize database connection
#[tauri::command]
async fn init_database(state: State<'_, AppState>) -> Result<String, String> {
    let db_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite::memory:".to_string());

    let conn = Database::connect(&db_url)
        .await
        .map_err(|e| format!("Database connection failed: {}", e))?;

    let mut db_lock = state.db.lock().await;
    *db_lock = Some(conn);

    Ok("Database initialized successfully".to_string())
}

/// Create a new account (SeaORM INSERT)
#[tauri::command]
async fn create_account(
    state: State<'_, AppState>,
    request: CreateAccountRequest,
) -> Result<AccountResponse, String> {
    let db_lock = state.db.lock().await;
    let db = db_lock
        .as_ref()
        .ok_or_else(|| "Database not initialized".to_string())?;

    let now = chrono::Utc::now();
    let password_hash = format!("hashed_{}", request.password); // Simplified for demo

    let account = AccountActiveModel {
        id: Set(Uuid::new_v4()),
        username: Set(request.username),
        email: Set(request.email),
        password_hash: Set(password_hash),
        display_name: Set(request.display_name),
        status: Set("active".to_string()),
        role: Set(0),
        created_at: Set(now),
        updated_at: Set(now),
        last_login_at: Set(None),
    };

    let result = account
        .insert(db)
        .await
        .map_err(|e| format!("Failed to create account: {}", e))?;

    Ok(AccountResponse::from(result))
}

/// Get account by ID (SeaORM SELECT)
#[tauri::command]
async fn get_account(state: State<'_, AppState>, id: String) -> Result<AccountResponse, String> {
    let db_lock = state.db.lock().await;
    let db = db_lock
        .as_ref()
        .ok_or_else(|| "Database not initialized".to_string())?;

    let uuid = Uuid::parse_str(&id).map_err(|e| format!("Invalid UUID: {}", e))?;

    let account = Account::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| format!("Failed to fetch account: {}", e))?
        .ok_or_else(|| "Account not found".to_string())?;

    Ok(AccountResponse::from(account))
}

/// List all accounts (SeaORM SELECT ALL)
#[tauri::command]
async fn list_accounts(state: State<'_, AppState>) -> Result<Vec<AccountResponse>, String> {
    let db_lock = state.db.lock().await;
    let db = db_lock
        .as_ref()
        .ok_or_else(|| "Database not initialized".to_string())?;

    let accounts = Account::find()
        .all(db)
        .await
        .map_err(|e| format!("Failed to list accounts: {}", e))?;

    Ok(accounts.into_iter().map(AccountResponse::from).collect())
}

/// Get account by username (SeaORM SELECT with filter)
#[tauri::command]
async fn get_account_by_username(
    state: State<'_, AppState>,
    username: String,
) -> Result<AccountResponse, String> {
    let db_lock = state.db.lock().await;
    let db = db_lock
        .as_ref()
        .ok_or_else(|| "Database not initialized".to_string())?;

    let account = Account::find()
        .filter(AccountColumn::Username.eq(&username))
        .one(db)
        .await
        .map_err(|e| format!("Failed to fetch account: {}", e))?
        .ok_or_else(|| format!("Account with username '{}' not found", username))?;

    Ok(AccountResponse::from(account))
}

/// Delete account by ID (SeaORM DELETE)
#[tauri::command]
async fn delete_account(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let db_lock = state.db.lock().await;
    let db = db_lock
        .as_ref()
        .ok_or_else(|| "Database not initialized".to_string())?;

    let uuid = Uuid::parse_str(&id).map_err(|e| format!("Invalid UUID: {}", e))?;

    let result = Account::delete_by_id(uuid)
        .exec(db)
        .await
        .map_err(|e| format!("Failed to delete account: {}", e))?;

    if result.rows_affected == 0 {
        return Err("Account not found".to_string());
    }

    Ok(format!("Account {} deleted successfully", id))
}

/// Verify database connection status
#[tauri::command]
async fn verify_db_connection(state: State<'_, AppState>) -> Result<bool, String> {
    let db_lock = state.db.lock().await;
    Ok(db_lock.is_some())
}

/// Run the Tauri application
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            db: Arc::new(Mutex::new(None)),
        })
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_version,
            init_database,
            create_account,
            get_account,
            list_accounts,
            get_account_by_username,
            delete_account,
            verify_db_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
