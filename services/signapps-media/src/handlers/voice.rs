//! Voice full-duplex WebSocket handler.
//!
//! Protocol:
//! Client → Server: Binary frames (PCM f32le 16kHz mono audio chunks)
//! Client → Server: Text frames (JSON control: { "type": "config"|"interrupt"|"speech_end" })
//! Server → Client: Binary frames (TTS audio WAV chunks)
//! Server → Client: Text frames (JSON events: transcript, llm_token, tts_start, done, error)

use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::mpsc;

use crate::AppState;

/// WebSocket upgrade handler for voice pipeline.
pub async fn voice_ws(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_voice_session(socket, state))
}

/// Control messages from client.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ClientControl {
    Config {
        #[serde(default)]
        language: Option<String>,
        #[serde(default)]
        voice: Option<String>,
        #[serde(default)]
        system_prompt: Option<String>,
    },
    Interrupt,
    SpeechEnd,
}

/// Events sent to client.
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ServerEvent {
    Transcript { text: String },
    LlmToken { content: String },
    TtsStart,
    Done,
    Error { message: String },
}

struct SessionConfig {
    language: Option<String>,
    voice: String,
    system_prompt: String,
}

async fn handle_voice_session(socket: WebSocket, state: Arc<AppState>) {
    use futures_util::{SinkExt, StreamExt};

    let (mut ws_sender, mut ws_receiver) = socket.split();

    let mut config = SessionConfig {
        language: None,
        voice: state.config.tts_default_voice.clone(),
        system_prompt: "Tu es un assistant vocal utile et concis. Reponds en francais.".to_string(),
    };

    // Channel for sending messages back to the client
    let (tx, mut rx) = mpsc::channel::<Message>(64);

    // Task to forward channel messages to WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Audio buffer for accumulating speech
    let mut audio_buffer: Vec<u8> = Vec::new();

    // Process incoming messages
    while let Some(msg_result) = ws_receiver.next().await {
        let msg = match msg_result {
            Ok(msg) => msg,
            Err(e) => {
                tracing::warn!("WebSocket receive error: {}", e);
                break;
            },
        };

        match msg {
            Message::Binary(data) => {
                // Accumulate audio data
                audio_buffer.extend_from_slice(&data);
            },
            Message::Text(text) => {
                match serde_json::from_str::<ClientControl>(&text) {
                    Ok(ClientControl::Config {
                        language,
                        voice,
                        system_prompt,
                    }) => {
                        if let Some(lang) = language {
                            config.language = Some(lang);
                        }
                        if let Some(v) = voice {
                            config.voice = v;
                        }
                        if let Some(sp) = system_prompt {
                            config.system_prompt = sp;
                        }
                    },
                    Ok(ClientControl::Interrupt) => {
                        // Clear audio buffer, cancel pending operations
                        audio_buffer.clear();
                    },
                    Ok(ClientControl::SpeechEnd) => {
                        // Process accumulated audio
                        if !audio_buffer.is_empty() {
                            let audio_data = Bytes::from(std::mem::take(&mut audio_buffer));
                            let state_clone = state.clone();
                            let tx_clone = tx.clone();
                            let config_lang = config.language.clone();
                            let config_voice = config.voice.clone();
                            let config_prompt = config.system_prompt.clone();
                            let ai_url = state.config.ai_url.clone();

                            tokio::spawn(async move {
                                process_speech_turn(
                                    audio_data,
                                    &state_clone,
                                    &tx_clone,
                                    config_lang.as_deref(),
                                    &config_voice,
                                    &config_prompt,
                                    &ai_url,
                                )
                                .await;
                            });
                        }
                    },
                    Err(e) => {
                        tracing::warn!("Invalid control message: {}", e);
                    },
                }
            },
            Message::Close(_) => break,
            _ => {},
        }
    }

    drop(tx);
    let _ = send_task.await;
}

/// Process a complete speech turn: STT → LLM → TTS.
async fn process_speech_turn(
    audio: Bytes,
    state: &AppState,
    tx: &mpsc::Sender<Message>,
    language: Option<&str>,
    voice: &str,
    system_prompt: &str,
    ai_url: &str,
) {
    // Step 1: STT
    let stt_opts = crate::stt::TranscribeRequest {
        language: language.map(|s| s.to_string()),
        ..Default::default()
    };

    let transcript = match state
        .stt
        .transcribe(audio, "audio.wav", Some(stt_opts))
        .await
    {
        Ok(result) => result.text,
        Err(e) => {
            let _ = tx
                .send(Message::Text(
                    serde_json::to_string(&ServerEvent::Error {
                        message: format!("STT failed: {}", e),
                    })
                    .unwrap(),
                ))
                .await;
            return;
        },
    };

    if transcript.trim().is_empty() {
        return;
    }

    // Send transcript to client
    let _ = tx
        .send(Message::Text(
            serde_json::to_string(&ServerEvent::Transcript {
                text: transcript.clone(),
            })
            .unwrap(),
        ))
        .await;

    // Step 2: LLM (call signapps-ai via HTTP)
    let llm_response = match call_llm_streaming(ai_url, &transcript, system_prompt, tx).await {
        Ok(text) => text,
        Err(e) => {
            let _ = tx
                .send(Message::Text(
                    serde_json::to_string(&ServerEvent::Error {
                        message: format!("LLM failed: {}", e),
                    })
                    .unwrap(),
                ))
                .await;
            return;
        },
    };

    if llm_response.trim().is_empty() {
        let _ = tx
            .send(Message::Text(
                serde_json::to_string(&ServerEvent::Done).unwrap(),
            ))
            .await;
        return;
    }

    // Step 3: TTS
    let _ = tx
        .send(Message::Text(
            serde_json::to_string(&ServerEvent::TtsStart).unwrap(),
        ))
        .await;

    // Split response into sentences for incremental TTS
    let sentences = split_sentences(&llm_response);

    for sentence in sentences {
        if sentence.trim().is_empty() {
            continue;
        }

        let tts_req = crate::tts::TtsRequest {
            text: sentence,
            voice: Some(voice.to_string()),
            speed: None,
            pitch: None,
            output_format: None,
        };

        match state.tts.synthesize(tts_req).await {
            Ok(result) => {
                // Send audio as binary frame
                let _ = tx.send(Message::Binary(result.audio_data)).await;
            },
            Err(e) => {
                tracing::warn!("TTS failed for sentence: {}", e);
            },
        }
    }

    let _ = tx
        .send(Message::Text(
            serde_json::to_string(&ServerEvent::Done).unwrap(),
        ))
        .await;
}

/// Call signapps-ai service for LLM streaming, forwarding tokens to the client.
async fn call_llm_streaming(
    ai_url: &str,
    question: &str,
    system_prompt: &str,
    tx: &mpsc::Sender<Message>,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let payload = serde_json::json!({
        "question": question,
        "system_prompt": system_prompt,
        "include_sources": false
    });

    // Use non-streaming for simplicity; streaming would use SSE
    let response = client
        .post(format!("{}/ai/chat", ai_url))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("LLM error: {}", body));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    let answer = json["answer"].as_str().unwrap_or("").to_string();

    // Send the full response as a token event
    if !answer.is_empty() {
        let _ = tx
            .send(Message::Text(
                serde_json::to_string(&ServerEvent::LlmToken {
                    content: answer.clone(),
                })
                .unwrap(),
            ))
            .await;
    }

    Ok(answer)
}

/// Split text into sentences for incremental TTS.
fn split_sentences(text: &str) -> Vec<String> {
    let mut sentences = Vec::new();
    let mut current = String::new();

    for ch in text.chars() {
        current.push(ch);
        if matches!(ch, '.' | '!' | '?' | '\n') && current.len() > 3 {
            sentences.push(current.trim().to_string());
            current = String::new();
        }
    }

    if !current.trim().is_empty() {
        sentences.push(current.trim().to_string());
    }

    sentences
}
