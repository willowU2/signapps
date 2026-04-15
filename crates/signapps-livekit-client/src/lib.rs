//! # signapps-livekit-client
//!
//! Thin, async HTTP client for the [LiveKit Server](https://livekit.io) REST (Twirp) API.
//!
//! Progressive surface. Phase 1 scaffold only exposes [`LiveKitClient`] plus
//! the error hierarchy; room/participant/egress helpers are wired in
//! subsequent commits.

#![warn(missing_docs)]

use std::time::Duration;

use reqwest::redirect::Policy;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Errors emitted by the LiveKit client.
#[derive(Debug, Error)]
pub enum LiveKitError {
    /// Transport-level HTTP error (connect, timeout, DNS, decoding…).
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    /// JWT encoding/decoding failure.
    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    /// Missing or invalid configuration (env vars, URL, …).
    #[error("config error: {0}")]
    Config(String),

    /// LiveKit server responded with a non-success status.
    #[error("upstream LiveKit error ({status}): {body}")]
    Upstream {
        /// HTTP status code returned by LiveKit.
        status: u16,
        /// Response body (usually a Twirp error payload).
        body: String,
    },
}

/// Convenient `Result` alias bound to [`LiveKitError`].
pub type Result<T> = std::result::Result<T, LiveKitError>;

/// Async client for the LiveKit Server API.
///
/// Build via [`LiveKitClient::new`] or [`LiveKitClient::from_env`]. The
/// client is `Clone`-friendly and designed to be kept in application state
/// (wrap in `Arc` if cloning becomes expensive).
#[derive(Debug, Clone)]
pub struct LiveKitClient {
    /// Base URL of the LiveKit server (e.g. `http://localhost:7880`).
    pub base_url: String,
    /// LiveKit API key (used as JWT `iss`).
    pub api_key: String,
    /// LiveKit API secret (HMAC-SHA256 signing key).
    pub api_secret: String,
    /// Shared reqwest client.
    #[allow(dead_code)]
    pub(crate) http: reqwest::Client,
}

impl LiveKitClient {
    /// Create a new client from explicit parameters.
    ///
    /// # Errors
    ///
    /// Returns [`LiveKitError::Config`] if the internal HTTP client cannot be
    /// built.
    pub fn new(
        base_url: impl Into<String>,
        api_key: impl Into<String>,
        api_secret: impl Into<String>,
    ) -> Result<Self> {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .redirect(Policy::none())
            .build()
            .map_err(|e| LiveKitError::Config(format!("failed to build HTTP client: {e}")))?;
        Ok(Self {
            base_url: base_url.into(),
            api_key: api_key.into(),
            api_secret: api_secret.into(),
            http,
        })
    }

    /// Build a client from `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
    ///
    /// # Errors
    ///
    /// Returns [`LiveKitError::Config`] if any of those env vars are missing
    /// or if the HTTP client cannot be initialised.
    pub fn from_env() -> Result<Self> {
        let base_url = std::env::var("LIVEKIT_URL")
            .map_err(|_| LiveKitError::Config("LIVEKIT_URL must be set".into()))?;
        let api_key = std::env::var("LIVEKIT_API_KEY")
            .map_err(|_| LiveKitError::Config("LIVEKIT_API_KEY must be set".into()))?;
        let api_secret = std::env::var("LIVEKIT_API_SECRET")
            .map_err(|_| LiveKitError::Config("LIVEKIT_API_SECRET must be set".into()))?;
        Self::new(base_url, api_key, api_secret)
    }
}

// --- Token issuance -----------------------------------------------------------

/// Grant payload requested for an access token.
#[derive(Debug, Clone)]
pub struct TokenGrants {
    /// Room name the token is scoped to.
    pub room: String,
    /// Participant identity (must be unique per room).
    pub identity: String,
    /// Optional human-readable display name.
    pub name: Option<String>,
    /// Whether the participant can publish tracks.
    pub can_publish: bool,
    /// Whether the participant can subscribe to other tracks.
    pub can_subscribe: bool,
    /// Whether the participant can publish data messages.
    pub can_publish_data: bool,
    /// Whether the participant has room-admin privileges (kick, mute, …).
    pub room_admin: bool,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct VideoGrant {
    #[serde(skip_serializing_if = "Option::is_none")]
    room: Option<String>,
    #[serde(rename = "roomJoin", skip_serializing_if = "Option::is_none")]
    room_join: Option<bool>,
    #[serde(rename = "roomCreate", skip_serializing_if = "Option::is_none")]
    room_create: Option<bool>,
    #[serde(rename = "roomList", skip_serializing_if = "Option::is_none")]
    room_list: Option<bool>,
    #[serde(rename = "roomAdmin", skip_serializing_if = "Option::is_none")]
    room_admin: Option<bool>,
    #[serde(rename = "roomRecord", skip_serializing_if = "Option::is_none")]
    room_record: Option<bool>,
    #[serde(rename = "canPublish", skip_serializing_if = "Option::is_none")]
    can_publish: Option<bool>,
    #[serde(rename = "canSubscribe", skip_serializing_if = "Option::is_none")]
    can_subscribe: Option<bool>,
    #[serde(rename = "canPublishData", skip_serializing_if = "Option::is_none")]
    can_publish_data: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LiveKitClaims {
    sub: String,
    iss: String,
    iat: i64,
    exp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    video: VideoGrant,
}

impl LiveKitClient {
    /// Generate a LiveKit access token (JWT HS256) with the given grants.
    ///
    /// The resulting token is valid for 6 hours.
    ///
    /// # Errors
    ///
    /// Returns [`LiveKitError::Jwt`] if the JWT cannot be signed.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// # fn demo() -> signapps_livekit_client::Result<()> {
    /// use signapps_livekit_client::{LiveKitClient, TokenGrants};
    /// let c = LiveKitClient::new("http://localhost:7880", "k", "s")?;
    /// let token = c.generate_token(TokenGrants {
    ///     room: "abc".into(), identity: "alice".into(), name: None,
    ///     can_publish: true, can_subscribe: true, can_publish_data: true,
    ///     room_admin: false,
    /// })?;
    /// assert_eq!(token.split('.').count(), 3);
    /// # Ok(()) }
    /// ```
    pub fn generate_token(&self, grants: TokenGrants) -> Result<String> {
        let now = chrono::Utc::now().timestamp();
        let exp = now + 6 * 3600; // 6h

        let video = VideoGrant {
            room: Some(grants.room.clone()),
            room_join: Some(true),
            room_admin: if grants.room_admin { Some(true) } else { None },
            room_record: if grants.room_admin { Some(true) } else { None },
            can_publish: Some(grants.can_publish),
            can_subscribe: Some(grants.can_subscribe),
            can_publish_data: Some(grants.can_publish_data),
            ..Default::default()
        };

        let claims = LiveKitClaims {
            sub: grants.identity,
            iss: self.api_key.clone(),
            iat: now,
            exp,
            name: grants.name,
            video,
        };

        let header = jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256);
        let key = jsonwebtoken::EncodingKey::from_secret(self.api_secret.as_bytes());
        let token = jsonwebtoken::encode(&header, &claims, &key)?;
        Ok(token)
    }

    /// Generate a short-lived service token with `roomAdmin`/`roomCreate`
    /// grants, used to authenticate outbound calls to LiveKit's RoomService
    /// and Egress service.
    ///
    /// # Errors
    ///
    /// Returns [`LiveKitError::Jwt`] if the JWT cannot be signed.
    pub(crate) fn service_token(&self) -> Result<String> {
        let now = chrono::Utc::now().timestamp();
        let exp = now + 600; // 10 min

        let video = VideoGrant {
            room_create: Some(true),
            room_list: Some(true),
            room_admin: Some(true),
            room_record: Some(true),
            ..Default::default()
        };
        let claims = LiveKitClaims {
            sub: "signapps-meet-service".into(),
            iss: self.api_key.clone(),
            iat: now,
            exp,
            name: None,
            video,
        };
        let header = jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256);
        let key = jsonwebtoken::EncodingKey::from_secret(self.api_secret.as_bytes());
        Ok(jsonwebtoken::encode(&header, &claims, &key)?)
    }

    // --- Shared HTTP helpers --------------------------------------------------

    async fn twirp<B: Serialize + ?Sized, R: for<'de> Deserialize<'de>>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<R> {
        let token = self.service_token()?;
        let url = format!("{}{}", self.base_url.trim_end_matches('/'), path);
        let resp = self
            .http
            .post(&url)
            .bearer_auth(token)
            .json(body)
            .send()
            .await?;
        Self::parse_json(resp).await
    }

    async fn twirp_no_content<B: Serialize + ?Sized>(&self, path: &str, body: &B) -> Result<()> {
        let token = self.service_token()?;
        let url = format!("{}{}", self.base_url.trim_end_matches('/'), path);
        let resp = self
            .http
            .post(&url)
            .bearer_auth(token)
            .json(body)
            .send()
            .await?;
        if resp.status().is_success() {
            let _ = resp.bytes().await?;
            Ok(())
        } else {
            Err(Self::upstream_err(resp).await)
        }
    }

    async fn parse_json<R: for<'de> Deserialize<'de>>(resp: reqwest::Response) -> Result<R> {
        if resp.status().is_success() {
            let value: R = resp.json().await?;
            Ok(value)
        } else {
            Err(Self::upstream_err(resp).await)
        }
    }

    async fn upstream_err(resp: reqwest::Response) -> LiveKitError {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        LiveKitError::Upstream { status, body }
    }
}

// --- Room management ----------------------------------------------------------

/// Options used to create a LiveKit room.
#[derive(Debug, Clone, Default, Serialize)]
pub struct RoomOptions {
    /// Seconds to keep an empty room alive.
    pub empty_timeout: Option<u32>,
    /// Optional cap on the number of participants.
    pub max_participants: Option<u32>,
}

/// Summary of a LiveKit room as returned by RoomService.
#[derive(Debug, Clone, Deserialize)]
pub struct RoomInfo {
    /// Globally unique server-assigned id.
    #[serde(default)]
    pub sid: String,
    /// Room name (the one supplied on create).
    #[serde(default)]
    pub name: String,
    /// Empty-timeout value (seconds) effectively applied by the server.
    #[serde(default, rename = "emptyTimeout")]
    pub empty_timeout: u32,
    /// Current participant count.
    #[serde(default, rename = "numParticipants")]
    pub num_participants: u32,
    /// Creation time (unix seconds).
    #[serde(default, rename = "creationTime")]
    pub creation_time: i64,
}

#[derive(Serialize)]
struct CreateRoomReq<'a> {
    name: &'a str,
    #[serde(rename = "emptyTimeout", skip_serializing_if = "Option::is_none")]
    empty_timeout: Option<u32>,
    #[serde(rename = "maxParticipants", skip_serializing_if = "Option::is_none")]
    max_participants: Option<u32>,
}

#[derive(Serialize)]
struct RoomNameReq<'a> {
    room: &'a str,
}

impl LiveKitClient {
    /// Create a LiveKit room.
    ///
    /// # Errors
    ///
    /// Returns [`LiveKitError::Upstream`] if LiveKit rejects the request,
    /// or [`LiveKitError::Http`] on transport failure.
    #[tracing::instrument(skip(self), fields(lk_url = %self.base_url))]
    pub async fn create_room(&self, name: &str, opts: RoomOptions) -> Result<RoomInfo> {
        let body = CreateRoomReq {
            name,
            empty_timeout: opts.empty_timeout,
            max_participants: opts.max_participants,
        };
        self.twirp::<_, RoomInfo>("/twirp/livekit.RoomService/CreateRoom", &body)
            .await
    }

    /// Delete a LiveKit room (disconnects all participants).
    ///
    /// # Errors
    ///
    /// Returns [`LiveKitError::Upstream`] if the room does not exist or
    /// LiveKit rejects the request.
    #[tracing::instrument(skip(self), fields(lk_url = %self.base_url))]
    pub async fn delete_room(&self, name: &str) -> Result<()> {
        self.twirp_no_content(
            "/twirp/livekit.RoomService/DeleteRoom",
            &RoomNameReq { room: name },
        )
        .await
    }
}

// --- Participants -------------------------------------------------------------

/// Info about a participant as returned by LiveKit.
#[derive(Debug, Clone, Deserialize)]
pub struct ParticipantInfo {
    /// Server-assigned session id.
    #[serde(default)]
    pub sid: String,
    /// Participant identity (client-provided).
    #[serde(default)]
    pub identity: String,
    /// Human-readable name.
    #[serde(default)]
    pub name: String,
    /// Participant state (`JOINING`, `JOINED`, `ACTIVE`, `DISCONNECTED`).
    #[serde(default)]
    pub state: String,
    /// Tracks published by this participant.
    #[serde(default)]
    pub tracks: Vec<TrackInfo>,
    /// Join time in unix seconds.
    #[serde(default, rename = "joinedAt")]
    pub joined_at: i64,
}

/// Info about a published track.
#[derive(Debug, Clone, Deserialize)]
pub struct TrackInfo {
    /// Track session id.
    #[serde(default)]
    pub sid: String,
    /// `AUDIO` / `VIDEO` / `DATA`.
    #[serde(default, rename = "type")]
    pub track_type: String,
    /// Track source (camera, microphone, screen_share, …).
    #[serde(default)]
    pub source: String,
    /// Whether the track is currently muted.
    #[serde(default)]
    pub muted: bool,
}

#[derive(Deserialize)]
struct ListParticipantsResp {
    #[serde(default)]
    participants: Vec<ParticipantInfo>,
}

#[derive(Serialize)]
struct RoomIdentityReq<'a> {
    room: &'a str,
    identity: &'a str,
}

#[derive(Serialize)]
struct MuteTrackReq<'a> {
    room: &'a str,
    identity: &'a str,
    #[serde(rename = "trackSid")]
    track_sid: &'a str,
    muted: bool,
}

impl LiveKitClient {
    /// List participants currently in a room.
    ///
    /// # Errors
    ///
    /// Returns [`LiveKitError::Upstream`] on a non-2xx response.
    #[tracing::instrument(skip(self), fields(lk_url = %self.base_url))]
    pub async fn list_participants(&self, room: &str) -> Result<Vec<ParticipantInfo>> {
        let resp: ListParticipantsResp = self
            .twirp(
                "/twirp/livekit.RoomService/ListParticipants",
                &RoomNameReq { room },
            )
            .await?;
        Ok(resp.participants)
    }

    /// Forcibly remove a participant from a room.
    ///
    /// # Errors
    ///
    /// Returns [`LiveKitError::Upstream`] if the participant/room is unknown.
    #[tracing::instrument(skip(self), fields(lk_url = %self.base_url))]
    pub async fn remove_participant(&self, room: &str, identity: &str) -> Result<()> {
        self.twirp_no_content(
            "/twirp/livekit.RoomService/RemoveParticipant",
            &RoomIdentityReq { room, identity },
        )
        .await
    }

    /// Mute (or unmute) a specific published track.
    ///
    /// # Errors
    ///
    /// Returns [`LiveKitError::Upstream`] if the track cannot be muted.
    #[tracing::instrument(skip(self), fields(lk_url = %self.base_url))]
    pub async fn mute_published_track(
        &self,
        room: &str,
        identity: &str,
        track_sid: &str,
        muted: bool,
    ) -> Result<()> {
        self.twirp_no_content(
            "/twirp/livekit.RoomService/MutePublishedTrack",
            &MuteTrackReq {
                room,
                identity,
                track_sid,
                muted,
            },
        )
        .await
    }
}

// --- Egress (recording) -------------------------------------------------------

/// S3-compatible egress destination.
#[derive(Debug, Clone)]
pub struct S3EgressDest {
    /// S3 access key.
    pub access_key: String,
    /// S3 secret key.
    pub secret: String,
    /// Optional S3 endpoint (for S3-compat like MinIO or signapps-storage).
    pub endpoint: Option<String>,
    /// Bucket name.
    pub bucket: String,
    /// Region (e.g. `us-east-1`).
    pub region: String,
    /// Object key (path inside the bucket).
    pub key: String,
}

/// Info about an egress job as returned by LiveKit.
#[derive(Debug, Clone, Deserialize)]
pub struct EgressInfo {
    /// Egress id (used with [`LiveKitClient::stop_egress`]).
    #[serde(default, rename = "egressId")]
    pub egress_id: String,
    /// Room the egress is bound to.
    #[serde(default, rename = "roomName")]
    pub room_name: String,
    /// Current status (`EGRESS_STARTING`, `EGRESS_ACTIVE`, `EGRESS_ENDING`, …).
    #[serde(default)]
    pub status: String,
}

#[derive(Serialize)]
struct FileOutput<'a> {
    filepath: &'a str,
    #[serde(rename = "fileType")]
    file_type: &'a str,
    s3: S3Body<'a>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct S3Body<'a> {
    access_key: &'a str,
    secret: &'a str,
    bucket: &'a str,
    region: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    endpoint: Option<&'a str>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RoomCompositeEgressReq<'a> {
    room_name: &'a str,
    layout: &'a str,
    file_outputs: Vec<FileOutput<'a>>,
}

#[derive(Serialize)]
struct StopEgressReq<'a> {
    #[serde(rename = "egressId")]
    egress_id: &'a str,
}

impl LiveKitClient {
    /// Start a RoomCompositeEgress writing an MP4 to S3 (or S3-compatible).
    ///
    /// # Errors
    ///
    /// Returns [`LiveKitError::Upstream`] if LiveKit rejects the egress
    /// request (egress service unavailable, invalid credentials, …).
    #[tracing::instrument(skip(self, dest), fields(lk_url = %self.base_url))]
    pub async fn start_room_egress(&self, room: &str, dest: S3EgressDest) -> Result<EgressInfo> {
        let body = RoomCompositeEgressReq {
            room_name: room,
            layout: "grid",
            file_outputs: vec![FileOutput {
                filepath: &dest.key,
                file_type: "MP4",
                s3: S3Body {
                    access_key: &dest.access_key,
                    secret: &dest.secret,
                    bucket: &dest.bucket,
                    region: &dest.region,
                    endpoint: dest.endpoint.as_deref(),
                },
            }],
        };
        self.twirp("/twirp/livekit.Egress/StartRoomCompositeEgress", &body)
            .await
    }

    /// Stop an in-progress egress.
    ///
    /// # Errors
    ///
    /// Returns [`LiveKitError::Upstream`] if the egress id is unknown or
    /// already stopped.
    #[tracing::instrument(skip(self), fields(lk_url = %self.base_url))]
    pub async fn stop_egress(&self, egress_id: &str) -> Result<EgressInfo> {
        self.twirp(
            "/twirp/livekit.Egress/StopEgress",
            &StopEgressReq { egress_id },
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::{decode, DecodingKey, Validation};

    fn test_client() -> LiveKitClient {
        LiveKitClient::new("http://localhost:7880", "test-key", "test-secret-key").expect("builds")
    }

    #[derive(Debug, Deserialize)]
    struct DecodedClaims {
        sub: String,
        iss: String,
        iat: i64,
        exp: i64,
        name: Option<String>,
        video: DecodedVideo,
    }

    #[derive(Debug, Deserialize)]
    struct DecodedVideo {
        room: Option<String>,
        #[serde(rename = "roomJoin")]
        room_join: Option<bool>,
        #[serde(rename = "roomAdmin")]
        room_admin: Option<bool>,
        #[serde(rename = "canPublish")]
        can_publish: Option<bool>,
        #[serde(rename = "canSubscribe")]
        can_subscribe: Option<bool>,
        #[serde(rename = "canPublishData")]
        can_publish_data: Option<bool>,
    }

    fn decode_token(client: &LiveKitClient, token: &str) -> DecodedClaims {
        let mut validation = Validation::new(jsonwebtoken::Algorithm::HS256);
        validation.required_spec_claims.clear();
        decode::<DecodedClaims>(
            token,
            &DecodingKey::from_secret(client.api_secret.as_bytes()),
            &validation,
        )
        .expect("decodes")
        .claims
    }

    #[test]
    fn client_builds_with_explicit_params() {
        let c = LiveKitClient::new("http://localhost:7880", "k", "s").expect("builds");
        assert_eq!(c.base_url, "http://localhost:7880");
        assert_eq!(c.api_key, "k");
        assert_eq!(c.api_secret, "s");
    }

    #[test]
    fn token_is_generated_with_valid_claims() {
        let client = test_client();
        let grants = TokenGrants {
            room: "room-42".into(),
            identity: "alice".into(),
            name: Some("Alice".into()),
            can_publish: true,
            can_subscribe: true,
            can_publish_data: true,
            room_admin: false,
        };
        let token = client.generate_token(grants).expect("token");
        assert_eq!(token.split('.').count(), 3, "should be a JWS");

        let c = decode_token(&client, &token);
        assert_eq!(c.sub, "alice");
        assert_eq!(c.iss, "test-key");
        assert!(c.exp > c.iat, "exp must be in the future");
        assert_eq!(c.name.as_deref(), Some("Alice"));
        assert_eq!(c.video.room.as_deref(), Some("room-42"));
        assert_eq!(c.video.room_join, Some(true));
        assert!(c.video.room_admin.is_none(), "non-admin");
        assert_eq!(c.video.can_publish, Some(true));
        assert_eq!(c.video.can_subscribe, Some(true));
        assert_eq!(c.video.can_publish_data, Some(true));
    }

    #[test]
    fn service_token_has_admin_grants() {
        let client = test_client();
        let token = client.service_token().expect("service token");
        let c = decode_token(&client, &token);
        assert_eq!(c.video.room_admin, Some(true), "service token must be admin");
    }
}
