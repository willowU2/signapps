# SignApps Meet — Full Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Livrer l'intégralité de la spec `docs/product-specs/12-meet.md` — module Meet fonctionnel (LiveKit Server containerisé), UI signature SignApps, features avancées (recording, transcription, waiting room, virtual bg, raise hand, polls, Q&A, whiteboard), intégrations Calendar/Chat/Mail/Notifications.

**Architecture:** 5 phases indépendantes, chacune mergeable dès prête. Phase 0 infra (LiveKit container) → Phase 1 core (crate signapps-livekit-client + refacto stubs) → Phase 2 UI (dashboard + lobby + in-meeting) → Phase 3 features → Phase 4 intégrations.

**Tech Stack:** Rust (Axum, sqlx, reqwest, jsonwebtoken, utoipa, tracing) ; nouveau crate `signapps-livekit-client` ; Docker pour LiveKit Server (Go, Apache-2.0) ; Next.js 16 / React 19 / `@livekit/components-react` + `livekit-client` (déjà en place) ; tldraw + Yjs pour whiteboard ; Mediapipe Selfie Segmentation pour virtual bg ; signapps-media existant pour STT.

**Design doc** : `docs/plans/2026-04-15-meet-full-implementation-design.md`

**Branche** : `feat/meet-full-impl` (créer avant Phase 0)

**Préconditions** :

- Docker Desktop installé (LiveKit container)
- Ports UDP 50000-60000 ouverts dans le firewall Windows
- PostgreSQL up, signapps-containers up (port 3002), signapps-storage up (port 3004), signapps-identity up (port 3001)
- Bucket `system-recordings` créé dans signapps-storage avant Phase 3

---

## Phase 0 — Infra LiveKit Server (Tasks 1-4)

### Task 1 : Ajouter la définition container LiveKit

**Files:**
- Create: `services/signapps-containers/src/presets/livekit.rs`
- Modify: `services/signapps-containers/src/presets/mod.rs` (ajouter `pub mod livekit;`)

**Step 1: Créer la preset container**

```rust
//! LiveKit Server preset — SFU WebRTC pour le module Meet.

use crate::types::ContainerPreset;

pub fn preset() -> ContainerPreset {
    ContainerPreset {
        name: "signapps-livekit".into(),
        image: "livekit/livekit-server:latest".into(),
        ports: vec![
            ("7880/tcp".into(), 7880),
            ("7881/tcp".into(), 7881),
            ("50000-60000/udp".into(), 50000),
        ],
        env: vec![
            ("LIVEKIT_KEYS".into(), "signapps-meet: <REPLACED_AT_STARTUP>".into()),
            ("LIVEKIT_PORT".into(), "7880".into()),
            ("LIVEKIT_RTC_TCP_PORT".into(), "7881".into()),
            ("LIVEKIT_RTC_PORT_RANGE_START".into(), "50000".into()),
            ("LIVEKIT_RTC_PORT_RANGE_END".into(), "60000".into()),
        ],
        volumes: vec![],
        auto_start: true,
        description: "LiveKit SFU server for Meet module".into(),
    }
}
```

**Step 2: cargo check**

```bash
cargo check -p signapps-containers
```

**Step 3: Commit**

```bash
git commit -m "feat(containers): add LiveKit server preset"
```

### Task 2 : Générer la config LiveKit au premier démarrage

**Files:**
- Modify: `services/signapps-containers/src/handlers/bootstrap.rs` (ou nouveau fichier)

**Step 1: Ajouter la logique de génération des secrets**

Au démarrage de signapps-containers, si LiveKit n'a jamais été démarré :
1. Générer un `LIVEKIT_API_SECRET` aléatoire (32 chars)
2. Écrire `{api_key: "signapps-meet", api_secret: "<random>"}` dans le `.env` partagé (via une API protégée de l'admin)
3. Démarrer le container LiveKit avec ces valeurs

OU plus simple : générer manuellement dans `.env.example` + demander à l'utilisateur de copier.

**Recommandation pragmatique Phase 0** : hard-code dans `.env.example`, l'utilisateur génère ses propres secrets plus tard :

```env
LIVEKIT_URL=http://localhost:7880
LIVEKIT_API_KEY=signapps-meet
LIVEKIT_API_SECRET=change-me-to-a-random-32-char-string
```

**Step 2: Ajouter dans `.env.example`**

```bash
echo "
# LiveKit — Meet module SFU
LIVEKIT_URL=http://localhost:7880
LIVEKIT_API_KEY=signapps-meet
LIVEKIT_API_SECRET=change-me-to-a-random-32-char-string
" >> .env.example
```

**Step 3: Commit**

```bash
git add .env.example services/signapps-containers/src/handlers/bootstrap.rs
git commit -m "feat(containers): provision LiveKit env config"
```

### Task 3 : Script de démarrage LiveKit

**Files:**
- Create: `scripts/start-livekit.ps1`

```powershell
# Lance le container LiveKit.
# Prérequis : Docker Desktop démarré + .env contient LIVEKIT_API_KEY / SECRET.

param(
  [string]$ApiKey = $env:LIVEKIT_API_KEY,
  [string]$ApiSecret = $env:LIVEKIT_API_SECRET
)

if (-not $ApiKey -or -not $ApiSecret) {
  Write-Host "LIVEKIT_API_KEY / LIVEKIT_API_SECRET non définis"
  exit 1
}

$existing = docker ps -a --filter "name=signapps-livekit" --format "{{.Names}}"
if ($existing -eq "signapps-livekit") {
  docker start signapps-livekit | Out-Null
  Write-Host "Container signapps-livekit démarré (déjà existant)"
} else {
  docker run -d --name signapps-livekit `
    -p 7880:7880 -p 7881:7881 `
    -p 50000-60000:50000-60000/udp `
    -e "LIVEKIT_KEYS=$ApiKey`: $ApiSecret" `
    livekit/livekit-server:latest
  Write-Host "Container signapps-livekit créé et démarré"
}
```

**Step 1: Smoke test manuel**

```bash
powershell -ExecutionPolicy Bypass -File ./scripts/start-livekit.ps1
curl http://localhost:7880/
# Expected : 404 ou html LiveKit (le serveur répond)
```

**Step 2: Commit**

```bash
git commit -m "chore(scripts): add LiveKit start helper"
```

### Task 4 : Créer le bucket `system-recordings`

Via curl avec admin token (comme pour `system-fonts`) :

```bash
TOKEN=<admin_jwt>
curl -X POST http://localhost:3004/api/v1/buckets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"system-recordings"}'
```

Expected : 200 avec `{"name":"system-recordings","creation_date":"..."}`.

Pas de commit (action runtime).

---

## Phase 1 — Core fonctionnel (Tasks 5-16)

### Task 5 : Créer le crate `signapps-livekit-client`

**Files:**
- Create: `crates/signapps-livekit-client/Cargo.toml`
- Create: `crates/signapps-livekit-client/src/lib.rs`
- Modify: `Cargo.toml` root workspace (ajouter le membre)

**Step 1: Cargo.toml du crate**

```toml
[package]
name = "signapps-livekit-client"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { workspace = true, features = ["full"] }
reqwest = { workspace = true, features = ["json"] }
serde = { workspace = true, features = ["derive"] }
serde_json = { workspace = true }
jsonwebtoken = { workspace = true }
thiserror = { workspace = true }
tracing = { workspace = true }
```

**Step 2: lib.rs — struct + from_env**

```rust
//! Thin Rust wrapper around the LiveKit Server REST API + JWT token
//! generation. Consumed by signapps-meet (and eventually calendar/chat)
//! to create rooms, generate participant tokens, and drive recordings.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum LiveKitError {
    #[error("http: {0}")]
    Http(#[from] reqwest::Error),
    #[error("jwt: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),
    #[error("config: {0}")]
    Config(String),
    #[error("upstream {status}: {body}")]
    Upstream { status: u16, body: String },
}

pub type Result<T> = std::result::Result<T, LiveKitError>;

pub struct LiveKitClient {
    pub base_url: String,
    pub api_key: String,
    pub api_secret: String,
    http: reqwest::Client,
}

impl LiveKitClient {
    pub fn from_env() -> Result<Self> {
        let base_url = std::env::var("LIVEKIT_URL")
            .unwrap_or_else(|_| "http://localhost:7880".to_string());
        let api_key = std::env::var("LIVEKIT_API_KEY")
            .map_err(|_| LiveKitError::Config("LIVEKIT_API_KEY missing".into()))?;
        let api_secret = std::env::var("LIVEKIT_API_SECRET")
            .map_err(|_| LiveKitError::Config("LIVEKIT_API_SECRET missing".into()))?;
        Ok(Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key,
            api_secret,
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .redirect(reqwest::redirect::Policy::none())
                .build()?,
        })
    }
}
```

**Step 3: cargo check**

```bash
cargo check -p signapps-livekit-client
```

**Step 4: Commit**

```bash
git add crates/signapps-livekit-client Cargo.toml
git commit -m "feat(livekit-client): scaffold crate with LiveKitClient::from_env"
```

### Task 6 : `generate_token` method

**Files:**
- Modify: `crates/signapps-livekit-client/src/lib.rs`

**Step 1: Ajouter types + méthode**

```rust
use serde::{Deserialize, Serialize};
use jsonwebtoken::{encode, EncodingKey, Header};

#[derive(Debug, Clone, Default, Serialize)]
pub struct TokenGrants {
    pub room: String,
    pub identity: String,
    pub name: Option<String>,
    pub can_publish: bool,
    pub can_subscribe: bool,
    pub can_publish_data: bool,
    pub room_admin: bool,
}

#[derive(Debug, Serialize)]
struct LiveKitClaims {
    sub: String,
    iss: String,
    iat: usize,
    exp: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    video: VideoGrants,
}

#[derive(Debug, Serialize)]
struct VideoGrants {
    room: String,
    #[serde(rename = "roomJoin")]
    room_join: bool,
    #[serde(rename = "canPublish")]
    can_publish: bool,
    #[serde(rename = "canSubscribe")]
    can_subscribe: bool,
    #[serde(rename = "canPublishData")]
    can_publish_data: bool,
    #[serde(rename = "roomAdmin")]
    room_admin: bool,
}

impl LiveKitClient {
    /// Generate a JWT for a participant joining `room` as `identity`.
    /// Token is valid for 6 hours.
    pub fn generate_token(&self, grants: TokenGrants) -> Result<String> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as usize)
            .unwrap_or(0);
        let claims = LiveKitClaims {
            sub: grants.identity.clone(),
            iss: self.api_key.clone(),
            iat: now,
            exp: now + 6 * 3600,
            name: grants.name,
            video: VideoGrants {
                room: grants.room,
                room_join: true,
                can_publish: grants.can_publish,
                can_subscribe: grants.can_subscribe,
                can_publish_data: grants.can_publish_data,
                room_admin: grants.room_admin,
            },
        };
        Ok(encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.api_secret.as_bytes()),
        )?)
    }
}
```

**Step 2: Test unitaire**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_is_generated_with_valid_claims() {
        let client = LiveKitClient {
            base_url: "http://localhost:7880".into(),
            api_key: "test-key".into(),
            api_secret: "test-secret-32-chars-long-abcdef".into(),
            http: reqwest::Client::new(),
        };
        let token = client
            .generate_token(TokenGrants {
                room: "test-room".into(),
                identity: "alice".into(),
                name: Some("Alice".into()),
                can_publish: true,
                can_subscribe: true,
                can_publish_data: true,
                room_admin: false,
            })
            .expect("token");
        assert!(token.starts_with("eyJ"));
        assert!(token.split('.').count() == 3);
    }
}
```

**Step 3: Run tests**

```bash
cargo test -p signapps-livekit-client
```

**Step 4: Commit**

```bash
git commit -m "feat(livekit-client): add generate_token with JWT grants"
```

### Task 7 : `create_room` / `delete_room`

**Files:**
- Modify: `crates/signapps-livekit-client/src/lib.rs`

```rust
#[derive(Debug, Clone, Default, Serialize)]
pub struct RoomOptions {
    pub empty_timeout: u32,       // secondes, 0 = no timeout
    pub max_participants: u32,    // 0 = illimité
}

#[derive(Debug, Deserialize, Clone)]
pub struct RoomInfo {
    pub sid: String,
    pub name: String,
    #[serde(default)]
    pub num_participants: u32,
    #[serde(default)]
    pub creation_time: i64,
}

impl LiveKitClient {
    pub async fn create_room(&self, name: &str, opts: RoomOptions) -> Result<RoomInfo> {
        let token = self.service_token()?;
        let res = self
            .http
            .post(format!("{}/twirp/livekit.RoomService/CreateRoom", self.base_url))
            .bearer_auth(&token)
            .json(&serde_json::json!({
                "name": name,
                "empty_timeout": opts.empty_timeout,
                "max_participants": opts.max_participants,
            }))
            .send()
            .await?;
        self.parse_json(res).await
    }

    pub async fn delete_room(&self, name: &str) -> Result<()> {
        let token = self.service_token()?;
        let res = self
            .http
            .post(format!("{}/twirp/livekit.RoomService/DeleteRoom", self.base_url))
            .bearer_auth(&token)
            .json(&serde_json::json!({ "room": name }))
            .send()
            .await?;
        if res.status().is_success() { Ok(()) } else { Err(self.upstream_err(res).await) }
    }

    fn service_token(&self) -> Result<String> {
        // Service token: roomAdmin + roomCreate privileges.
        self.generate_token(TokenGrants {
            room: "*".into(),
            identity: "__service__".into(),
            name: None,
            can_publish: false,
            can_subscribe: false,
            can_publish_data: false,
            room_admin: true,
        })
    }

    async fn parse_json<T: for<'de> serde::Deserialize<'de>>(&self, res: reqwest::Response) -> Result<T> {
        if res.status().is_success() {
            Ok(res.json().await?)
        } else {
            Err(self.upstream_err(res).await)
        }
    }

    async fn upstream_err(&self, res: reqwest::Response) -> LiveKitError {
        let status = res.status().as_u16();
        let body = res.text().await.unwrap_or_default();
        LiveKitError::Upstream { status, body }
    }
}
```

**Commit:**

```bash
git commit -m "feat(livekit-client): add create_room / delete_room"
```

### Task 8 : Participants API (`list` / `remove` / `mute`)

**Files:**
- Modify: `crates/signapps-livekit-client/src/lib.rs`

```rust
#[derive(Debug, Deserialize, Clone)]
pub struct ParticipantInfo {
    pub identity: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub state: i32,
    #[serde(default)]
    pub tracks: Vec<TrackInfo>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TrackInfo {
    pub sid: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub muted: bool,
}

impl LiveKitClient {
    pub async fn list_participants(&self, room: &str) -> Result<Vec<ParticipantInfo>> {
        #[derive(Deserialize)]
        struct Resp { #[serde(default)] participants: Vec<ParticipantInfo> }
        let token = self.service_token()?;
        let res = self.http
            .post(format!("{}/twirp/livekit.RoomService/ListParticipants", self.base_url))
            .bearer_auth(&token)
            .json(&serde_json::json!({ "room": room }))
            .send().await?;
        Ok(self.parse_json::<Resp>(res).await?.participants)
    }

    pub async fn remove_participant(&self, room: &str, identity: &str) -> Result<()> {
        let token = self.service_token()?;
        let res = self.http
            .post(format!("{}/twirp/livekit.RoomService/RemoveParticipant", self.base_url))
            .bearer_auth(&token)
            .json(&serde_json::json!({ "room": room, "identity": identity }))
            .send().await?;
        if res.status().is_success() { Ok(()) } else { Err(self.upstream_err(res).await) }
    }

    pub async fn mute_published_track(&self, room: &str, identity: &str, track_sid: &str, muted: bool) -> Result<()> {
        let token = self.service_token()?;
        let res = self.http
            .post(format!("{}/twirp/livekit.RoomService/MutePublishedTrack", self.base_url))
            .bearer_auth(&token)
            .json(&serde_json::json!({
                "room": room, "identity": identity, "track_sid": track_sid, "muted": muted
            }))
            .send().await?;
        if res.status().is_success() { Ok(()) } else { Err(self.upstream_err(res).await) }
    }
}
```

**Commit:**

```bash
git commit -m "feat(livekit-client): add participants control (list/remove/mute)"
```

### Task 9 : Egress (recording) API

**Files:**
- Modify: `crates/signapps-livekit-client/src/lib.rs`

```rust
#[derive(Debug, Clone, Serialize)]
pub struct S3EgressDest {
    pub access_key: String,
    pub secret: String,
    pub endpoint: String,
    pub bucket: String,
    pub region: String,
    pub key: String,                // target key in bucket
}

#[derive(Debug, Deserialize, Clone)]
pub struct EgressInfo {
    pub egress_id: String,
    pub room_name: String,
    pub status: String,
}

impl LiveKitClient {
    /// Start a room composite egress to S3-compatible storage.
    pub async fn start_room_egress(&self, room: &str, dest: S3EgressDest) -> Result<EgressInfo> {
        let token = self.service_token()?;
        let res = self.http
            .post(format!("{}/twirp/livekit.Egress/StartRoomCompositeEgress", self.base_url))
            .bearer_auth(&token)
            .json(&serde_json::json!({
                "room_name": room,
                "layout": "grid",
                "file_outputs": [{
                    "filepath": dest.key,
                    "file_type": "MP4",
                    "s3": {
                        "access_key": dest.access_key,
                        "secret": dest.secret,
                        "bucket": dest.bucket,
                        "region": dest.region,
                        "endpoint": dest.endpoint,
                    }
                }]
            }))
            .send().await?;
        self.parse_json(res).await
    }

    pub async fn stop_egress(&self, egress_id: &str) -> Result<EgressInfo> {
        let token = self.service_token()?;
        let res = self.http
            .post(format!("{}/twirp/livekit.Egress/StopEgress", self.base_url))
            .bearer_auth(&token)
            .json(&serde_json::json!({ "egress_id": egress_id }))
            .send().await?;
        self.parse_json(res).await
    }
}
```

**Commit:**

```bash
git commit -m "feat(livekit-client): add start/stop egress for S3 recording"
```

### Task 10 : Refacto `signapps-meet` tokens

**Files:**
- Modify: `services/signapps-meet/Cargo.toml` (add `signapps-livekit-client = { path = "../../crates/signapps-livekit-client" }`)
- Modify: `services/signapps-meet/src/handlers/tokens.rs`
- Modify: `services/signapps-meet/src/livekit.rs` (supprimer le JWT logic maison)

**Step 1: Ajouter la dep**

Dans Cargo.toml de signapps-meet, ajouter la ligne workspace.

**Step 2: Réécrire tokens.rs**

```rust
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use signapps_livekit_client::{LiveKitClient, TokenGrants};
use signapps_common::{auth::Claims, AppError};

#[derive(Deserialize)]
pub struct TokenRequest {
    pub room: String,
}

#[derive(Serialize)]
pub struct TokenResponse {
    pub token: String,
    pub url: String,
}

#[tracing::instrument(skip(state, claims))]
pub async fn issue_token(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(req): Json<TokenRequest>,
) -> Result<Json<TokenResponse>, AppError> {
    let token = state.livekit.generate_token(TokenGrants {
        room: req.room,
        identity: claims.sub.to_string(),
        name: claims.username.clone(),
        can_publish: true,
        can_subscribe: true,
        can_publish_data: true,
        room_admin: false,
    }).map_err(|e| AppError::internal(format!("livekit token: {e}")))?;

    Ok(Json(TokenResponse {
        token,
        url: state.livekit.base_url.clone(),
    }))
}
```

**Step 3: Adapter AppState** pour avoir `pub livekit: std::sync::Arc<LiveKitClient>` initialisé dans `main.rs` via `LiveKitClient::from_env()`.

**Commit:**

```bash
git commit -m "refactor(meet): use signapps-livekit-client for token issuance"
```

### Task 11 : Refacto `participants.rs` stubs

Remplacer les comments `In a real implementation, we would...` par des appels à `state.livekit.remove_participant(...)` et `state.livekit.mute_published_track(...)`.

**Commit:**

```bash
git commit -m "refactor(meet): wire kick/mute to LiveKit RoomService"
```

### Task 12 : Refacto `recordings.rs` stubs

Remplacer le mock par `state.livekit.start_room_egress(room, S3EgressDest { ... })` avec les credentials admin de signapps-storage.

**Stop-point** : l'utilisateur doit valider les credentials S3-like de signapps-storage (OpenDAL expose-t-il un endpoint S3 compatible ? sinon on passera par un adapter).

**Commit:**

```bash
git commit -m "refactor(meet): trigger real LiveKit egress for recordings"
```

### Task 13 : Nouveau endpoint `POST /rooms/instant`

**Files:**
- Modify: `services/signapps-meet/src/handlers/rooms.rs`
- Modify: `services/signapps-meet/src/main.rs` (route)

Crée une salle immédiate (code 6 chiffres généré), retourne `{code, token, url}`.

**Commit:**

```bash
git commit -m "feat(meet): add instant room endpoint"
```

### Task 14 : Endpoints lobby / knock / admit / deny

Ajouter `GET /rooms/:code/lobby`, `POST /rooms/:code/knock`, `POST /rooms/:code/admit/:identity`, `POST /rooms/:code/deny/:identity`.

**Stop-point** : migration SQL `meet_extensions.sql` nécessaire (table `waiting_room_requests`). Demander l'accord de l'utilisateur.

**Commit:**

```bash
git commit -m "feat(meet): add lobby + waiting-room endpoints"
```

### Task 15 : Webhook LiveKit

**Files:**
- Create: `services/signapps-meet/src/handlers/webhooks.rs`
- Modify: `services/signapps-meet/src/main.rs`

Endpoint `POST /meet/webhooks/livekit` qui reçoit les events LiveKit (signed avec la clé partagée) et met à jour `meet.room_participants`, émet PgEventBus.

**Commit:**

```bash
git commit -m "feat(meet): add LiveKit webhook receiver"
```

### Task 16 : Smoke test core

Manuel :

1. Démarrer livekit container + signapps-meet rebuilt
2. `POST /meet/rooms/instant` avec auth admin → récupère `{code, token}`
3. Ouvrir browser : deux onglets `http://localhost:3000/meet/<code>` avec deux tokens différents
4. Vérifier que la vidéo/audio passe entre les deux

**Pas de commit.**

---

## Phase 2 — UI signature SignApps (Tasks 17-23)

### Task 17 : Redesign dashboard `/meet/page.tsx`

**Files:**
- Modify: `client/src/app/meet/page.tsx`

Retirer les 4 KPI cards, ajouter :
- 2 cartes hero (Démarrer appel / Rejoindre avec code)
- Section "À venir" depuis `calendarApi.events({ has_meet_room: true })`
- Section "Mes salles permanentes"
- Section "Récentes (7j)"

Tokens sémantiques `bg-card border-border`, `bg-primary`, `text-foreground`.

**Commit:**

```bash
git commit -m "refactor(meet): redesign dashboard with signature SignApps layout"
```

### Task 18 : Page lobby `/meet/[code]/lobby/page.tsx`

**Files:**
- Create: `client/src/app/meet/[code]/lobby/page.tsx`

Preview caméra live (`getUserMedia`), dropdowns devices, niveau micro en temps réel (Web Audio API analyser), toggle blur bg, input nom, bouton "Rejoindre maintenant" qui fait `POST /meet/rooms/:code/join` + navigate vers `/meet/[code]`.

**Commit:**

```bash
git commit -m "feat(meet): add lobby page with device pre-check"
```

### Task 19 : Top bar in-meeting

**Files:**
- Modify: `client/src/components/meet/meet-room.tsx`

Top bar `h-12` avec bouton ← Quitter à gauche, nom salle + count au centre, menu options à droite.

**Commit:**

```bash
git commit -m "refactor(meet): redesign in-meeting top bar"
```

### Task 20 : Grid layout + tiles participants

**Files:**
- Modify: `client/src/components/meet/meet-room.tsx`

LiveKit `GridLayout` adaptatif, tiles avec ring primary sur active speaker, overlay nom + status bottom-left.

**Commit:**

```bash
git commit -m "refactor(meet): redesign participant tiles with speaker ring"
```

### Task 21 : Bottom controls bar

**Files:**
- Modify: `client/src/components/meet/meeting-controls.tsx`

Boutons ronds (mic, camera, screen share, raise hand, `•••`), end button rouge à droite. Responsive mobile avec drawer sidebar.

**Commit:**

```bash
git commit -m "refactor(meet): redesign bottom controls with SignApps tokens"
```

### Task 22 : Sidebar droite (Chat / Participants / Polls / Q&A / Whiteboard)

**Files:**
- Create: `client/src/components/meet/meet-sidebar.tsx`

Tabs component shadcn avec les 5 onglets, contenu lazy-loaded.

**Commit:**

```bash
git commit -m "feat(meet): add tabbed right sidebar"
```

### Task 23 : Responsive mobile

**Files:**
- Modify: `client/src/components/meet/meet-room.tsx`

Sidebar → Sheet drawer bottom, controls plus compacts, grid 1x1 ou 2x1 max.

**Commit:**

```bash
git commit -m "feat(meet): mobile responsive layout"
```

---

## Phase 3 — Features avancées (Tasks 24-33)

### Task 24 : Migration SQL `meet_extensions`

**STOP-point** : demander validation utilisateur avant d'appliquer.

**Files:**
- Create: `migrations/NNN_meet_extensions.sql`

Colonnes ajoutées sur `meet.rooms` + tables `waiting_room_requests`, `polls`, `raised_hands`, `transcriptions`.

**Commit:**

```bash
git commit -m "feat(meet): add meet extensions schema"
```

### Task 25 : Recording UI + backend start/stop

Button start/stop dans le menu `•••` (host only). Backend appelle `start_room_egress`. Badge "🔴 Enregistrement" visible par tous.

**Commit:**

```bash
git commit -m "feat(meet): recording start/stop with visibility badge"
```

### Task 26 : Recording listing + download

Dashboard `/meet` section "Récentes" affiche les recordings avec bouton download (URL signée 24h via storage share).

**Commit:**

```bash
git commit -m "feat(meet): list recordings with signed download"
```

### Task 27 : Transcription temps réel

Frontend capture audio 2s chunks → WebSocket `signapps-media /stt/stream` → broadcast data channel LiveKit → `live-transcription-overlay.tsx` affiche.

**Commit:**

```bash
git commit -m "feat(meet): real-time transcription via signapps-media STT"
```

### Task 28 : Waiting room flow

Frontend knocker : écran attente + preview caméra. Frontend host : panel latéral avec admit/deny.

**Commit:**

```bash
git commit -m "feat(meet): waiting-room knock-to-enter flow"
```

### Task 29 : Virtual backgrounds

Mediapipe Selfie Segmentation client-side. Toggle dans lobby + menu `•••`. 3 modes : none / blur / image preset.

**Commit:**

```bash
git commit -m "feat(meet): virtual backgrounds via Mediapipe"
```

### Task 30 : Raise hand

Data channel LiveKit publish `{type: 'raise_hand', identity}`. Affichage ✋ overlay tile + toast.

**Commit:**

```bash
git commit -m "feat(meet): raise hand signaling"
```

### Task 31 : Polls

Sidebar tab Polls. Host crée → broadcast data channel → participants votent → results live → persistance DB à la fermeture.

**Commit:**

```bash
git commit -m "feat(meet): polls with DB persistence"
```

### Task 32 : Q&A

Sidebar tab Q&A. Participants posent question, upvote, host répond/ignore. Persistance DB.

**Commit:**

```bash
git commit -m "feat(meet): Q&A with upvotes"
```

### Task 33 : Whiteboard tldraw + Yjs

Sidebar tab Whiteboard. Embed tldraw avec Yjs binding via signapps-collab WebSocket.

**Commit:**

```bash
git commit -m "feat(meet): whiteboard via tldraw + Yjs"
```

---

## Phase 4 — Intégrations (Tasks 34-39)

### Task 34 : Migration SQL `calendar_meet_room`

**STOP-point** : validation migration.

**Files:**
- Create: `migrations/NNN_calendar_meet_room.sql`

```sql
ALTER TABLE calendar.events
  ADD COLUMN IF NOT EXISTS has_meet_room BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS meet_room_code TEXT;
```

**Commit:**

```bash
git commit -m "feat(calendar): add meet_room fields to events"
```

### Task 35 : Calendar → Meet

**Files:**
- Modify: `client/src/components/calendar/event-modal.tsx` (toggle "Ajouter une visio")
- Modify: `services/signapps-calendar/src/handlers/events.rs` (create_event with meet_room)

Flow : toggle → event created → call signapps-meet `/rooms/scheduled` → store code.

**Commit:**

```bash
git commit -m "feat(calendar): create Meet room from event"
```

### Task 36 : Chat → Meet

**Files:**
- Modify: `client/src/components/chat/chat-toolbar.tsx` (bouton "Démarrer appel")
- Modify: `services/signapps-chat/src/handlers/threads.rs` (start_video_call endpoint)

**Commit:**

```bash
git commit -m "feat(chat): start Meet from thread"
```

### Task 37 : Mail → Meet

**Files:**
- Modify: `client/src/app/mail/page.tsx` (compose option "Joindre invitation")
- Modify: `services/signapps-mail/src/handlers/compose.rs` (attach ICS)

**Commit:**

```bash
git commit -m "feat(mail): attach Meet invitation ics to compose"
```

### Task 38 : Notifications Meet

**Files:**
- Modify: `services/signapps-notifications/src/handlers/` (nouveaux types)
- Modify: `services/signapps-meet/src/events.rs` (publish events)

Types : `meet.invited`, `meet.knock_received`, `meet.starting_soon`, `meet.recording_ready`.

**Commit:**

```bash
git commit -m "feat(notifications): add Meet event types"
```

### Task 39 : PgEventBus hooks

Vérifier que `signapps-meet` publie tous les events cités dans le design, et que les consommateurs (calendar, chat, notifications) écoutent bien.

**Commit:**

```bash
git commit -m "feat(meet): wire PgEventBus publishers/consumers"
```

---

## Phase 5 — Validation finale

### Task 40 : Qualité globale

```bash
cargo clippy -p signapps-meet -p signapps-livekit-client -p signapps-calendar -p signapps-chat -p signapps-mail -p signapps-notifications --all-features --no-deps -- -D warnings
cargo fmt --all -- --check
cd client && npx tsc --noEmit
cd client && npm run lint
```

**Commit (si fmt diff):**

```bash
git commit -m "style(meet): apply rustfmt"
```

### Task 41 : Rapport final

**Files:**
- Create: `docs/plans/2026-04-15-meet-full-implementation-report.md`

Bilan : commits, features livrées, features reportées, durée sync, screenshots UI si dispo, bugs trouvés + corrigés, recommandations.

**Commit:**

```bash
git commit -m "docs(meet): add full implementation report"
```

---

## Règles globales d'exécution

1. **Conventional Commits** : `feat(meet)`, `feat(livekit-client)`, `feat(containers)`, `feat(calendar)`, `feat(chat)`, `feat(mail)`, `feat(notifications)`, `refactor(meet)`, `style()`, `docs()`, `chore()`.
2. **Pas de `.unwrap()` / `println!`** hors tests.
3. **`#[tracing::instrument]`** sur handlers publics, **`#[utoipa::path]`** + `ToSchema` sur endpoints REST.
4. **`/// rustdoc`** sur items publics ; sections `# Errors`, `# Panics` si `Result` ou panics possibles.
5. **Tokens Tailwind sémantiques** côté frontend, `"use client"` sur composants browser.
6. **STOP-point obligatoires** :
   - Avant Task 12 (credentials S3-like storage pour egress)
   - Avant Task 24 (migration SQL meet_extensions)
   - Avant Task 34 (migration SQL calendar_meet_room)
   - Avant merge sur main (recommandation : branche `feat/meet-full-impl` + PR ou merge no-ff à la fin de chaque phase).
7. **Sécurité** : webhook LiveKit valide la signature HMAC avec la clé partagée ; URL signées 24h pour download recording ; pas d'exposition directe des credentials LiveKit au frontend (toujours via backend proxy).
