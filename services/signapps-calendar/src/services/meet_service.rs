//! HTTP client for creating Meet rooms from calendar events.
//!
//! The calendar service talks to `signapps-meet` over HTTP on port 3014
//! (configurable via `MEET_SERVICE_URL`). The caller's bearer JWT is
//! forwarded so `signapps-meet` can identify the host.

use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};

/// Request payload sent to `signapps-meet` to create a scheduled room.
///
/// `signapps-meet` uses `POST /api/v1/meet/rooms` which accepts optional
/// `scheduled_start` / `scheduled_end`. We fall back to `/instant` if the
/// scheduled endpoint is unavailable.
#[derive(Debug, Serialize)]
pub struct CreateMeetRoomRequest {
    /// Display name of the room (defaults to the event title).
    pub name: String,
    pub description: Option<String>,
    pub is_private: Option<bool>,
    pub scheduled_start: Option<DateTime<Utc>>,
    pub scheduled_end: Option<DateTime<Utc>>,
}

/// Subset of the response we care about — the 6-char / 6-digit room code.
#[derive(Debug, Deserialize)]
struct MeetRoomCodeResponse {
    #[serde(alias = "code")]
    room_code: String,
}

/// Thin HTTP client around the Meet service.
#[derive(Clone)]
pub struct MeetServiceClient {
    client: Client,
    base_url: String,
}

impl MeetServiceClient {
    /// Build a new client from the `MEET_SERVICE_URL` environment variable
    /// (defaults to `http://localhost:3014`).
    pub fn new() -> Self {
        let base_url =
            std::env::var("MEET_SERVICE_URL").unwrap_or_else(|_| "http://localhost:3014".into());

        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(5))
                .build()
                .unwrap_or_else(|_| Client::new()),
            base_url,
        }
    }

    /// Create a scheduled Meet room and return the generated room code.
    ///
    /// The caller's bearer token is forwarded so `signapps-meet` identifies
    /// the host via its own auth middleware (shared JWT secret).
    ///
    /// # Errors
    ///
    /// Returns a string error on network failure, non-2xx responses, or
    /// unparseable JSON bodies.
    pub async fn create_room(
        &self,
        bearer_token: &str,
        req: CreateMeetRoomRequest,
    ) -> Result<String, String> {
        let url = format!("{}/api/v1/meet/rooms", self.base_url);

        let res = self
            .client
            .post(&url)
            .bearer_auth(bearer_token)
            .json(&req)
            .send()
            .await
            .map_err(|e| format!("POST {url} failed: {e}"))?;

        if !res.status().is_success() {
            // Fall back to /rooms/instant when the scheduled endpoint errs
            // (older deployments may not accept scheduled_start/end).
            tracing::warn!(
                status = %res.status(),
                "signapps-meet POST /rooms failed, falling back to /rooms/instant"
            );
            return self.create_instant(bearer_token).await;
        }

        let body: MeetRoomCodeResponse = res
            .json()
            .await
            .map_err(|e| format!("parse meet response: {e}"))?;

        Ok(body.room_code)
    }

    /// Fallback: create an instant (unscheduled) Meet room.
    ///
    /// # Errors
    ///
    /// Returns a string error on network failure or non-2xx responses.
    async fn create_instant(&self, bearer_token: &str) -> Result<String, String> {
        let url = format!("{}/api/v1/meet/rooms/instant", self.base_url);
        let res = self
            .client
            .post(&url)
            .bearer_auth(bearer_token)
            .send()
            .await
            .map_err(|e| format!("POST {url} failed: {e}"))?;

        if !res.status().is_success() {
            return Err(format!("instant room status: {}", res.status()));
        }

        let body: MeetRoomCodeResponse = res
            .json()
            .await
            .map_err(|e| format!("parse instant meet response: {e}"))?;

        Ok(body.room_code)
    }
}

impl Default for MeetServiceClient {
    fn default() -> Self {
        Self::new()
    }
}
