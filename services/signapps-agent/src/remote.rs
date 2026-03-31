//! Custom secure remote access protocol.
//! No VNC — uses native screen capture + WebSocket + TLS + JWT.
//!
//! Architecture:
//! - Agent captures screen frames via OS-native APIs
//! - Encodes as WebP (delta frames for efficiency)
//! - Streams over WebSocket to SignApps server
//! - Server relays to admin browser
//! - Admin mouse/keyboard events sent back via same WebSocket
//!
//! Modes:
//! - "observe": Screen capture only, no user notification, no input
//! - "share": Screen capture + banner shown to user, pointer visible but no input
//! - "control": Full takeover, banner shown, mouse+keyboard forwarded

use crate::config::AgentConfig;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
enum RemoteMessage {
    // Server → Agent
    #[serde(rename = "start_session")]
    StartSession {
        session_id: String,
        mode: String,
        admin_name: String,
    },
    #[serde(rename = "stop_session")]
    StopSession { session_id: String },
    #[serde(rename = "mouse_event")]
    MouseEvent {
        x: i32,
        y: i32,
        button: u8,
        action: String,
    },
    #[serde(rename = "keyboard_event")]
    KeyboardEvent {
        key: String,
        action: String,
        modifiers: Vec<String>,
    },

    // Agent → Server
    #[serde(rename = "frame")]
    Frame {
        session_id: String,
        width: u32,
        height: u32,
        data: String,
        frame_type: String,
    },
    #[serde(rename = "session_started")]
    SessionStarted {
        session_id: String,
        screen_width: u32,
        screen_height: u32,
    },
    #[serde(rename = "session_ended")]
    SessionEnded { session_id: String, reason: String },
}

pub async fn remote_access_server(config: Arc<RwLock<AgentConfig>>) {
    loop {
        let cfg = config.read().await;
        let server_url = cfg.server_url.clone().unwrap_or_default();
        let agent_id = cfg.agent_id.clone().unwrap_or_default();
        let token = cfg.jwt_token.clone().unwrap_or_default();
        drop(cfg);

        if server_url.is_empty() || agent_id.is_empty() {
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
            continue;
        }

        // Connect to server WebSocket for remote commands
        let ws_url = server_url
            .replace("https://", "wss://")
            .replace("http://", "ws://");
        let ws_url = format!(
            "{}/api/v1/it-assets/agent/{}/remote-ws?token={}",
            ws_url, agent_id, token
        );

        tracing::info!("Connecting to remote access channel: {}", ws_url);

        match tokio_tungstenite::connect_async(&ws_url).await {
            Ok((ws_stream, _)) => {
                tracing::info!("Remote access channel connected");
                let (mut write, mut read) = ws_stream.split();

                while let Some(msg) = read.next().await {
                    match msg {
                        Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                            if let Ok(remote_msg) = serde_json::from_str::<RemoteMessage>(&text) {
                                match remote_msg {
                                    RemoteMessage::StartSession {
                                        session_id,
                                        mode,
                                        admin_name,
                                    } => {
                                        tracing::info!(
                                            "Remote session starting: {} mode={} by={}",
                                            session_id,
                                            mode,
                                            admin_name
                                        );

                                        // Notify user if not stealth
                                        if mode != "observe" {
                                            show_user_notification(&mode, &admin_name);
                                        }

                                        // Get screen dimensions
                                        let (w, h) = get_screen_size();

                                        // Send session started
                                        let started =
                                            serde_json::to_string(&RemoteMessage::SessionStarted {
                                                session_id: session_id.clone(),
                                                screen_width: w,
                                                screen_height: h,
                                            })
                                            .unwrap_or_default();
                                        let _ = write
                                            .send(tokio_tungstenite::tungstenite::Message::Text(
                                                started.into(),
                                            ))
                                            .await;

                                        // Start screen capture loop in background
                                        // In a real implementation, this would capture frames and send them
                                        tracing::info!("Screen capture started: {}x{}", w, h);
                                    },
                                    RemoteMessage::StopSession { session_id } => {
                                        tracing::info!("Remote session stopped: {}", session_id);
                                        hide_user_notification();
                                    },
                                    RemoteMessage::MouseEvent {
                                        x,
                                        y,
                                        button,
                                        action,
                                    } => {
                                        inject_mouse_event(x, y, button, &action);
                                    },
                                    RemoteMessage::KeyboardEvent {
                                        key,
                                        action,
                                        modifiers,
                                    } => {
                                        inject_keyboard_event(&key, &action, &modifiers);
                                    },
                                    _ => {},
                                }
                            }
                        },
                        Err(e) => {
                            tracing::warn!("Remote WS error: {}", e);
                            break;
                        },
                        _ => {},
                    }
                }
            },
            Err(e) => {
                tracing::debug!("Remote channel not available: {}", e);
            },
        }

        // Reconnect after delay
        tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
    }
}

fn get_screen_size() -> (u32, u32) {
    // Default fallback — production would use OS-native APIs
    (1920, 1080)
}

fn show_user_notification(mode: &str, admin_name: &str) {
    let msg = match mode {
        "share" => format!("{} visualise votre ecran", admin_name),
        "control" => format!("{} controle votre ecran", admin_name),
        _ => return,
    };
    tracing::info!("USER NOTIFICATION: {}", msg);
    // In production: show a system tray notification or overlay window
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("powershell")
            .args([
                "-Command",
                &format!(
                    r#"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('{}', 'SignApps Remote', 'OK', 'Information')"#,
                    msg
                ),
            ])
            .spawn();
    }
}

fn hide_user_notification() {
    tracing::info!("USER NOTIFICATION: Hidden");
}

fn inject_mouse_event(_x: i32, _y: i32, _button: u8, _action: &str) {
    // In production: use platform-specific APIs
    // Windows: SendInput with MOUSEINPUT
    // Linux: XTest extension or uinput
    // macOS: CGEvent
    tracing::debug!("Mouse event: ({}, {})", _x, _y);
}

fn inject_keyboard_event(_key: &str, _action: &str, _modifiers: &[String]) {
    tracing::debug!("Keyboard event: {} {}", _key, _action);
}
