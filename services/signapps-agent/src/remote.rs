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
//! Screen capture backends (platform-specific):
//! - Windows: DXGI Desktop Duplication API (IDXGIOutputDuplication)
//! - Linux:   X11 XShmGetImage or PipeWire (Wayland)
//! - macOS:   CoreGraphics CGDisplayCreateImage
//!
//! Input injection backends:
//! - Windows: SendInput(MOUSEINPUT / KEYBDINPUT)
//! - Linux:   XTest extension (XTestFakeMotionEvent / XTestFakeKeyEvent)
//!            or uinput (/dev/uinput) for Wayland
//! - macOS:   CGEvent (CGEventCreateMouseEvent / CGEventCreateKeyboardEvent)
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

// ─── Protocol messages ───────────────────────────────────────────────────────

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
        /// Base64-encoded WebP frame (full or delta)
        data: String,
        /// "full" | "delta"
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

// ─── Frame capture pipeline ──────────────────────────────────────────────────
//
// Full pipeline: capture → resize → encode WebP → base64 → send
//
// Step 1: capture_screen_raw() → RawFrame { pixels: Vec<u8>, width, height }
// Step 2: resize_frame()       → RawFrame (scaled to target resolution)
// Step 3: encode_webp()        → Vec<u8> (WebP binary)
// Step 4: base64::encode()     → String
// Step 5: send via WebSocket   → RemoteMessage::Frame

#[derive(Debug)]
struct RawFrame {
    pixels: Vec<u8>, // BGRA or RGBA depending on platform
    width: u32,
    height: u32,
}

/// Capture a raw screen frame using the platform-native API.
///
/// # Platform details
/// - **Windows**: Uses DXGI Desktop Duplication (`IDXGIOutputDuplication::AcquireNextFrame`).
///   Returns BGRA pixels. Requires D3D11 device and DXGI adapter enumeration.
/// - **Linux (X11)**: Uses `XShmGetImage` for zero-copy shared memory capture.
///   Falls back to `XGetImage` if MIT-SHM is unavailable.
/// - **macOS**: Uses `CGDisplayCreateImage(CGMainDisplayID())` from CoreGraphics.
///   Returns BGRA pixels via `CGDataProviderCopyData`.
fn capture_screen_raw() -> Option<RawFrame> {
    let (w, h) = get_screen_size();
    // Stub: returns a blank frame; production replaces with OS API call
    Some(RawFrame {
        pixels: vec![0u8; (w * h * 4) as usize],
        width: w,
        height: h,
    })
}

/// Resize the raw frame to a target width/height using bilinear interpolation.
/// Target resolution is typically capped at 1280x720 for low-bandwidth sessions
/// or 1920x1080 for high-quality mode.
fn resize_frame(frame: RawFrame, target_w: u32, target_h: u32) -> RawFrame {
    if frame.width == target_w && frame.height == target_h {
        return frame;
    }
    // Stub: production uses the `image` crate resize or a SIMD-accelerated scaler
    RawFrame {
        pixels: vec![0u8; (target_w * target_h * 4) as usize],
        width: target_w,
        height: target_h,
    }
}

/// Encode a raw BGRA frame to WebP binary.
/// Uses libwebp via the `webp` crate (lossy, quality=75 for delta frames, 85 for keyframes).
/// Returns None if encoding fails.
fn encode_webp(frame: &RawFrame) -> Option<Vec<u8>> {
    // Stub: production uses `webp::Encoder::from_rgba(&frame.pixels, frame.width, frame.height)`
    let _ = (frame.width, frame.height);
    Some(Vec::new())
}

/// Capture one frame, resize, encode to WebP, and return as base64 string.
/// Returns None if capture or encoding fails.
fn capture_and_encode_frame() -> Option<String> {
    let raw = capture_screen_raw()?;
    let resized = resize_frame(raw, 1280, 720);
    let webp = encode_webp(&resized)?;
    Some(base64_encode(&webp))
}

fn base64_encode(data: &[u8]) -> String {
    use std::fmt::Write;
    // Simple hex fallback; production: base64::engine::general_purpose::STANDARD.encode(data)
    let mut s = String::with_capacity(data.len() * 2);
    for b in data {
        let _ = write!(s, "{:02x}", b);
    }
    s
}

// ─── Input injection ─────────────────────────────────────────────────────────
//
// All input injection is gated on session mode == "control".
// "observe" and "share" modes ignore all mouse/keyboard events.

/// Inject a mouse event using the platform-native API.
///
/// # Platform details
/// - **Windows**: `SendInput` with `INPUT_MOUSE` / `MOUSEINPUT` struct.
///   Flags: `MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE` for move, `MOUSEEVENTF_LEFTDOWN` etc.
///   Coordinates are in virtual screen space (0–65535 normalized).
/// - **Linux (X11)**: `XTestFakeMotionEvent(display, screen, x, y, CurrentTime)`.
///   For clicks: `XTestFakeButtonEvent(display, button, True/False, CurrentTime)`.
///   Requires `XOpenDisplay(NULL)` and the XTest extension.
/// - **macOS**: `CGEventCreateMouseEvent(NULL, kCGEventMouseMoved, point, kCGMouseButtonLeft)`.
///   Then `CGEventPost(kCGHIDEventTap, event)`.
fn inject_mouse_event(x: i32, y: i32, button: u8, action: &str) {
    tracing::debug!(
        "Mouse inject: ({}, {}) button={} action={}",
        x,
        y,
        button,
        action
    );
    // Production:
    // #[cfg(target_os = "windows")]  { windows_send_input_mouse(x, y, button, action) }
    // #[cfg(target_os = "linux")]    { xtest_fake_button(x, y, button, action) }
    // #[cfg(target_os = "macos")]    { cgevent_mouse(x, y, button, action) }
}

/// Inject a keyboard event using the platform-native API.
///
/// # Platform details
/// - **Windows**: `SendInput` with `INPUT_KEYBOARD` / `KEYBDINPUT` struct.
///   `wVk` is the virtual key code (e.g. VK_RETURN=0x0D).
///   `dwFlags`: 0 for keydown, `KEYEVENTF_KEYUP` for keyup.
/// - **Linux (X11)**: `XTestFakeKeyEvent(display, XKeysymToKeycode(display, sym), True/False, 0)`.
///   Key symbol lookup: `XStringToKeysym("Return")`.
/// - **macOS**: `CGEventCreateKeyboardEvent(NULL, keyCode, keyDown)`.
///   Key codes from `Carbon/HIToolbox/Events.h` (e.g. kVK_Return=0x24).
fn inject_keyboard_event(key: &str, action: &str, modifiers: &[String]) {
    tracing::debug!("Key inject: {} {} modifiers={:?}", key, action, modifiers);
    // Production:
    // #[cfg(target_os = "windows")]  { windows_send_input_key(key, action, modifiers) }
    // #[cfg(target_os = "linux")]    { xtest_fake_key(key, action, modifiers) }
    // #[cfg(target_os = "macos")]    { cgevent_key(key, action, modifiers) }
}

// ─── Screen size detection ───────────────────────────────────────────────────

fn get_screen_size() -> (u32, u32) {
    // Production:
    // Windows: GetSystemMetrics(SM_CXSCREEN) / GetSystemMetrics(SM_CYSCREEN)
    // Linux:   XDisplayWidth / XDisplayHeight via xlib, or wlr-randr for Wayland
    // macOS:   CGDisplayBounds(CGMainDisplayID()).size
    (1920, 1080)
}

// ─── User notification banner ────────────────────────────────────────────────

fn show_user_notification(mode: &str, admin_name: &str) {
    let msg = match mode {
        "share" => format!("{} visualise votre ecran", admin_name),
        "control" => format!("{} controle votre ecran", admin_name),
        _ => return,
    };
    tracing::info!("USER NOTIFICATION: {}", msg);
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
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("notify-send")
            .args(["SignApps Remote", &msg])
            .spawn();
    }
}

fn hide_user_notification() {
    tracing::info!("USER NOTIFICATION: Hidden");
}

// ─── WebSocket remote access server loop ─────────────────────────────────────

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
                let mut current_session: Option<String> = None;
                let mut current_mode = String::new();

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

                                        if mode != "observe" {
                                            show_user_notification(&mode, &admin_name);
                                        }

                                        let (w, h) = get_screen_size();
                                        current_session = Some(session_id.clone());
                                        current_mode = mode.clone();

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

                                        // Send initial keyframe
                                        if let Some(encoded) = capture_and_encode_frame() {
                                            let frame_msg =
                                                serde_json::to_string(&RemoteMessage::Frame {
                                                    session_id: session_id.clone(),
                                                    width: w,
                                                    height: h,
                                                    data: encoded,
                                                    frame_type: "full".to_string(),
                                                })
                                                .unwrap_or_default();
                                            let _ = write
                                                .send(
                                                    tokio_tungstenite::tungstenite::Message::Text(
                                                        frame_msg.into(),
                                                    ),
                                                )
                                                .await;
                                        }

                                        tracing::info!(
                                            "Screen capture pipeline started: {}x{}",
                                            w,
                                            h
                                        );
                                    },
                                    RemoteMessage::StopSession { session_id } => {
                                        tracing::info!("Remote session stopped: {}", session_id);
                                        hide_user_notification();
                                        current_session = None;
                                        current_mode.clear();
                                    },
                                    RemoteMessage::MouseEvent {
                                        x,
                                        y,
                                        button,
                                        action,
                                    } => {
                                        if current_mode == "control" && current_session.is_some() {
                                            inject_mouse_event(x, y, button, &action);
                                        }
                                    },
                                    RemoteMessage::KeyboardEvent {
                                        key,
                                        action,
                                        modifiers,
                                    } => {
                                        if current_mode == "control" && current_session.is_some() {
                                            inject_keyboard_event(&key, &action, &modifiers);
                                        }
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

        tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
    }
}
