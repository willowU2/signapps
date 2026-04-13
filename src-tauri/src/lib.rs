//! SignApps Tauri Library
//!
//! This module provides Tauri commands and integration for the SignApps desktop application.
//! Includes audio capture and local transcription via the media service.

pub mod capture;
pub mod transcribe;

use serde::{Deserialize, Serialize};
use tauri::{Manager, State};

/// Application state
pub struct AppState {
    // Db connection removed as part of SeaORM removal
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
async fn init_database(_state: State<'_, AppState>) -> Result<String, String> {
    Err("Direct DB connection via SeaORM was removed. Use API instead.".into())
}

/// Create a new account
#[tauri::command]
async fn create_account(
    _state: State<'_, AppState>,
    _request: CreateAccountRequest,
) -> Result<AccountResponse, String> {
    Err("SeaORM removed. Connect through backend API.".into())
}

/// Get account by ID
#[tauri::command]
async fn get_account(_state: State<'_, AppState>, _id: String) -> Result<AccountResponse, String> {
    Err("SeaORM removed. Connect through backend API.".into())
}

/// List all accounts
#[tauri::command]
async fn list_accounts(_state: State<'_, AppState>) -> Result<Vec<AccountResponse>, String> {
    Err("SeaORM removed. Connect through backend API.".into())
}

/// Get account by username
#[tauri::command]
async fn get_account_by_username(
    _state: State<'_, AppState>,
    _username: String,
) -> Result<AccountResponse, String> {
    Err("SeaORM removed. Connect through backend API.".into())
}

/// Delete account by ID
#[tauri::command]
async fn delete_account(_state: State<'_, AppState>, _id: String) -> Result<String, String> {
    Err("SeaORM removed. Connect through backend API.".into())
}

/// Verify database connection status
#[tauri::command]
async fn verify_db_connection(_state: State<'_, AppState>) -> Result<bool, String> {
    Ok(false)
}

/// Run the Tauri application
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            // DB state removed
        })
        .manage(capture::CaptureState::new())
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
            verify_db_connection,
            capture::list_audio_sources,
            capture::start_capture,
            capture::stop_capture,
            transcribe::transcribe_captured_audio,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
