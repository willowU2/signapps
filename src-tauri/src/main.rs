//! SignApps Platform - Tauri Desktop Application
//!
//! This binary wraps the Next.js frontend in a native desktop application
//! using the Tauri framework.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    signapps_tauri_lib::run();
}
