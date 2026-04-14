# OAuth Unifié — Spec de design

**Date** : 2026-04-14
**Statut** : Design approuvé, en attente de plan d'implémentation
**Inspiration** : [simov/grant](https://github.com/simov/grant) (patterns uniquement, pas de réutilisation de code)

## 1. Contexte et motivations

### 1.1 État actuel

Aujourd'hui l'authentification OAuth est fragmentée sur plusieurs services de SignApps :

- `signapps-mail` : flows Google / Microsoft pour IMAP/SMTP
- `signapps-calendar` : flows Google / Microsoft pour provider connections
- `signapps-social` : flows Twitter / LinkedIn / Facebook
- `signapps-identity` : SSO (SAML/OIDC) partiel, OIDC stubbed
- `signapps-drive` (prévu) : devrait supporter Google Drive, OneDrive, Dropbox

Cette fragmentation crée plusieurs problèmes :

1. **Tokens stockés en clair** dans PostgreSQL (`mail_accounts.access_token`, etc.) — exposition en cas de breach DB ou backup non chiffré
2. **Logique de refresh dupliquée** dans chaque service (ou absente, provoquant des tokens expirés non renouvelés)
3. **Pas de machine à états commune** : bugs subtils de CSRF / PKCE différents selon le service
4. **Impossible d'ajouter un nouveau provider sans toucher 3 services** : l'ajout de Dropbox demande du code dans mail/drive/social
5. **SAML signature verification cassée** dans signapps-identity (issue connue)
6. **OIDC stubbed** : le champ `id_token` n'est jamais validé, `nonce` n'est pas vérifié
7. **Admin UI inexistante** : les credentials OAuth sont des variables d'env, pas de différenciation par tenant

### 1.2 Objectifs

Unifier toute la logique OAuth/OIDC/SAML dans un crate unique réutilisé par tous les services, avec :

- **Stockage chiffré** AES-256-GCM pour tous les tokens
- **Une machine à états commune** pour OAuth2/OIDC (v2), OAuth1a (legacy), SAML (POST binding)
- **Catalogue de ~200+ providers** embarqué dans le binaire
- **Admin UI granulaire** : activation par tenant, visibilité par groupe/département/rôle, purpose `login` vs `integration` séparés
- **Refresh proactif** toutes les 5 min + refresh lazy juste avant usage
- **Zero re-OAuth requis** lors du déploiement (migration offline des tokens existants)

### 1.3 Non-objectifs

- Pas de **re-écriture** des clients OAuth côté frontend (ils continueront d'appeler les nouvelles routes unifiées)
- Pas de **support nouveau provider** qui ne soit pas déjà dans grant's catalog au moment de l'implémentation (on reste sur un catalogue figé, re-synchronisé manuellement 2x/an)
- Pas de **rotation automatique** de la master key au MVP (le format la supporte via byte de version, mais l'outillage vient en V2)
- Pas de **OAuth1.0** (préhistorique, distinct de OAuth1.0a qu'on supporte pour Twitter legacy)

## 2. Principes directeurs

1. **Stateless** : l'état d'un flow voyage dans le `state` param signé HMAC, aucune session serveur
2. **Events-driven** : `signapps-identity` ne touche jamais aux tables métier ; il émet `oauth.tokens.acquired` sur PgEventBus
3. **Zéro token en clair** : tous les tokens chiffrés AES-256-GCM avant écriture DB, déchiffrés uniquement juste avant usage
4. **Granularité org** : visibilité d'un provider = OR entre (org_nodes ∪ groupes ∪ rôles ∪ users nommés), override nominatif prioritaire
5. **Séparation login / integration** : un user peut avoir le droit de se logger via Google mais pas d'intégrer Gmail (ou l'inverse)
6. **Idempotence et observabilité** : toute opération (refresh, migration, flow) est idempotente et tracée via `#[instrument]`

## 3. Architecture globale

### 3.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────┐
│ signapps-identity (host de l'engine OAuth)                         │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ crates/signapps-oauth                                           ││
│ │  ├─ catalog.rs        — Embedded catalog + DB overrides        ││
│ │  ├─ provider.rs       — ProviderDefinition / ProviderConfig    ││
│ │  ├─ state.rs          — FlowState signé HMAC                   ││
│ │  ├─ engine_v2.rs      — OAuth2 + OIDC (99% des providers)      ││
│ │  ├─ engine_v1a.rs     — OAuth 1.0a (legacy Twitter/Trello)     ││
│ │  ├─ engine_saml.rs    — SAML 2.0 (samael)                      ││
│ │  └─ scope_resolver.rs — Visibilité org / scopes / purposes     ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ HTTP endpoints :                                                    │
│   GET  /api/v1/oauth/providers          (user visible providers)   │
│   POST /api/v1/oauth/:provider/start    (start a flow)             │
│   GET  /api/v1/oauth/:provider/callback (OAuth2/OIDC/OAuth1a)      │
│   POST /api/v1/oauth/:provider/callback (SAML POST binding)        │
│   POST /api/v1/oauth/internal/refresh   (internal, for lazy pull)  │
│                                                                     │
│ Admin endpoints :                                                   │
│   GET/POST/PATCH/DELETE /api/v1/admin/oauth-providers              │
└─────────────────────────────────────────────────────────────────────┘
         │ émet via PgEventBus
         │ oauth.tokens.acquired
         │ oauth.tokens.invalidated
         ▼
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ mail         │ calendar     │ social       │ drive        │
│ s'abonne,    │ s'abonne,    │ s'abonne,    │ s'abonne,    │
│ stocke dans  │ stocke dans  │ stocke dans  │ stocke dans  │
│ mail_accounts│ calendar_*   │ social_*     │ drive_*      │
│ (chiffré)    │ (chiffré)    │ (chiffré)    │ (chiffré)    │
└──────────────┴──────────────┴──────────────┴──────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ signapps-scheduler                                                  │
│  └─ OAuthRefreshJob (toutes les 5min)                              │
│     ├─ Scan oauth_refresh_queue pour tokens expirants < 15min      │
│     ├─ Dispatch via trait TokenTable (mail/calendar/social/drive)  │
│     └─ Update tokens + queue atomiquement                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ signapps-vault                                                      │
│  └─ MasterKey (AES-256, chargée au boot)                           │
│     ├─ Backend EnvVar (dev)                                        │
│     ├─ Backend File (prod self-hosted)                             │
│     └─ Backend Remote (HashiCorp Vault / AWS KMS / Azure KV)       │
│     Dérive DEKs via HKDF-SHA256 (oauth-tokens-v1, saml-assertions-v1)│
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Responsabilités

| Composant | Responsabilité |
|-----------|---------------|
| `signapps-oauth` (crate) | State machine, catalogue, engines v2/v1a/saml, scope resolver |
| `signapps-identity` (service) | Expose les endpoints HTTP, orchestre les flows, émet les events |
| `signapps-vault` (crate + service) | Source de vérité pour la master key, dérive les DEKs |
| `signapps-common::crypto` | Trait `EncryptedField` (AES-GCM), pas de dépendance vault |
| `signapps-scheduler` (service) | Job de refresh toutes les 5min via la `oauth_refresh_queue` |
| `mail/calendar/social/drive` | S'abonnent à `oauth.tokens.acquired`, stockent tokens chiffrés, utilisent `checkout_token()` pour les déchiffrer |

## 4. Modèle de données

### 4.1 Catalogue hybride

**Partie embedded** : `crates/signapps-oauth/catalog.json` intégré via `include_str!`, ~200 providers issus du catalogue grant + enrichissements SignApps.

**Partie DB** : table `oauth_providers` pour les providers custom (Keycloak tenant-level, OIDC generique, SAML avec metadata XML uploadé).

```sql
CREATE TABLE oauth_providers (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key           TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    protocol      TEXT NOT NULL CHECK (protocol IN ('OAuth2', 'OAuth1a', 'Oidc', 'Saml')),
    authorize_url TEXT NOT NULL,
    access_url    TEXT NOT NULL,
    refresh_url   TEXT,
    profile_url   TEXT,
    revoke_url    TEXT,
    scope_delimiter TEXT NOT NULL DEFAULT ' ',
    default_scopes TEXT[] NOT NULL DEFAULT '{}',
    pkce_required  BOOLEAN NOT NULL DEFAULT false,
    supports_refresh BOOLEAN NOT NULL DEFAULT true,
    categories    TEXT[] NOT NULL DEFAULT '{}',
    user_id_field TEXT NOT NULL DEFAULT '$.sub',
    user_email_field TEXT,
    user_name_field  TEXT,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, key)
);
```

### 4.2 Configuration par tenant

```sql
CREATE TABLE oauth_provider_configs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_key  TEXT NOT NULL,

    -- Credentials chiffrés
    client_id_enc     BYTEA,
    client_secret_enc BYTEA,
    extra_params_enc  BYTEA,  -- JSON chiffré (Apple key, SAML cert, Microsoft tenant, ...)

    -- Activation
    enabled       BOOLEAN NOT NULL DEFAULT false,
    -- purposes : subset of {'login', 'integration'} — sérialisé depuis l'enum Rust OAuthPurpose
    -- Un provider peut avoir les deux activés ; les restrictions par purpose vont dans oauth_provider_purpose_overrides.
    purposes      TEXT[] NOT NULL DEFAULT '{}' CHECK (purposes <@ ARRAY['login','integration']),

    -- Scopes autorisés
    allowed_scopes TEXT[] NOT NULL DEFAULT '{}',

    -- Visibilité
    visibility    TEXT NOT NULL DEFAULT 'all' CHECK (visibility IN ('all', 'restricted')),
    visible_to_org_nodes UUID[] NOT NULL DEFAULT '{}',
    visible_to_groups    UUID[] NOT NULL DEFAULT '{}',
    visible_to_roles     TEXT[] NOT NULL DEFAULT '{}',
    visible_to_users     UUID[] NOT NULL DEFAULT '{}',

    -- Customisation user
    allow_user_override  BOOLEAN NOT NULL DEFAULT false,

    -- SSO entreprise
    is_tenant_sso        BOOLEAN NOT NULL DEFAULT false,
    auto_provision_users BOOLEAN NOT NULL DEFAULT false,
    default_role         TEXT,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, provider_key)
);

CREATE INDEX idx_oauth_provider_configs_tenant ON oauth_provider_configs(tenant_id);
CREATE INDEX idx_oauth_provider_configs_enabled ON oauth_provider_configs(tenant_id, enabled);
```

### 4.3 Override par purpose

Permet "Login pour tout le monde, integration pour R&D uniquement" :

```sql
CREATE TABLE oauth_provider_purpose_overrides (
    provider_config_id UUID NOT NULL REFERENCES oauth_provider_configs(id) ON DELETE CASCADE,
    purpose            TEXT NOT NULL,
    visibility         TEXT NOT NULL DEFAULT 'all',
    visible_to_org_nodes UUID[] NOT NULL DEFAULT '{}',
    visible_to_groups    UUID[] NOT NULL DEFAULT '{}',
    visible_to_roles     TEXT[] NOT NULL DEFAULT '{}',
    visible_to_users     UUID[] NOT NULL DEFAULT '{}',
    PRIMARY KEY (provider_config_id, purpose)
);
```

### 4.4 Overrides utilisateur

Si `allow_user_override = true`, l'utilisateur peut utiliser ses propres credentials (ex : son propre client Google Cloud) :

```sql
CREATE TABLE oauth_user_overrides (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_key    TEXT NOT NULL,
    client_id_enc   BYTEA NOT NULL,
    client_secret_enc BYTEA NOT NULL,
    extra_params_enc BYTEA,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, provider_key)
);
```

### 4.5 Colonnes chiffrées dans les tables existantes

Pour chaque service concerné, les colonnes `access_token` / `refresh_token` / `id_token` passent de `TEXT` à `BYTEA` :

- `mail_accounts.access_token`, `mail_accounts.refresh_token`
- `calendar_provider_connections.google_access_token`, `.google_refresh_token`, `.microsoft_access_token`, `.microsoft_refresh_token`
- `social_accounts.access_token`, `social_accounts.refresh_token`
- `drive_cloud_accounts.access_token`, `drive_cloud_accounts.refresh_token`
- `sso_connections.access_token`, `sso_connections.refresh_token`, `sso_connections.id_token`

### 4.6 Table de queue de refresh

Vue dénormalisée alimentée par triggers sur chaque table de tokens :

```sql
CREATE TABLE oauth_refresh_queue (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_table    TEXT NOT NULL,
    source_id       UUID NOT NULL,
    tenant_id       UUID NOT NULL,
    user_id         UUID NOT NULL,
    provider_key    TEXT NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    last_refresh_attempt_at TIMESTAMPTZ,
    consecutive_failures INT NOT NULL DEFAULT 0,
    last_error      TEXT,
    disabled        BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_table, source_id)
);

CREATE INDEX idx_oauth_refresh_queue_expiring
    ON oauth_refresh_queue(expires_at)
    WHERE disabled = false AND consecutive_failures < 10;
```

Un trigger `sync_oauth_refresh_queue()` s'applique à chaque table de tokens pour maintenir la queue synchro (INSERT/UPDATE/DELETE).

### 4.7 Event bus payload

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokensAcquired {
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    pub provider_key: String,
    pub purpose: OAuthPurpose,
    pub category: ProviderCategory,
    pub access_token_enc: Vec<u8>,
    pub refresh_token_enc: Option<Vec<u8>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub scopes_granted: Vec<String>,
    pub provider_user_id: String,
    pub provider_user_email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokenInvalidated {
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    pub provider_key: String,
    pub source_table: String,
    pub source_id: Uuid,
    pub reason: String,
}
```

## 5. Machine à états

### 5.1 State signé HMAC

Stateless : aucun Redis, aucune session serveur. Le state transporte tout ce dont le callback a besoin, signé HMAC-SHA256 avec `OAUTH_STATE_SECRET` (distinct de `JWT_SECRET`).

```rust
pub struct FlowState {
    pub flow_id: Uuid,
    pub user_id: Option<Uuid>,          // None pour purpose=login (pas encore loggé)
    pub tenant_id: Uuid,
    pub provider_key: String,
    pub purpose: OAuthPurpose,           // Login | Integration
    pub redirect_after: Option<String>,
    pub pkce_verifier: Option<String>,
    pub nonce: String,                   // 32 octets aléatoires
    pub issued_at: i64,
    pub expires_at: i64,                 // issued_at + 10min
    pub requested_scopes: Vec<String>,
    pub override_client_id: Option<Uuid>,
}
```

Format encodé : `base64url(payload_json).base64url(hmac_sha256(secret, payload_json))`.

### 5.2 Engine v2 (OAuth2 + OIDC)

```rust
impl EngineV2 {
    pub async fn start(&self, req: StartRequest) -> Result<StartResponse, OAuthError>;
    pub async fn callback(&self, cb: CallbackRequest) -> Result<CallbackResponse, OAuthError>;
}
```

**Étapes `start`** :
1. Résoudre provider (catalogue embedded ou DB `oauth_providers`)
2. Charger `ProviderConfig` du tenant, vérifier `enabled`
3. `ScopeResolver::check_user_access` (visibilité globale) + `check_purpose_allowed` + `filter_scopes`
4. Résoudre credentials (override user ? sinon tenant config)
5. Si `pkce_required` : générer verifier + challenge S256
6. Construire `FlowState`, signer HMAC
7. Construire URL d'authorization avec `state`, `code_challenge` (si PKCE), `nonce` (si OIDC)
8. Retourner `{authorization_url, flow_id}`

**Étapes `callback`** :
1. `FlowState::verify` (signature + expiration)
2. Re-charger provider + config + credentials
3. Form-POST vers `access_url` avec `code`, `client_id/secret`, `code_verifier` si PKCE
4. Fetch `profile_url` avec access_token (extraire user_id, email, name via JSONPath)
5. Si OIDC : valider `id_token` (signature JWK depuis `jwks_uri`, `nonce`, `aud`)
6. Chiffrer tokens via `EncryptedField` + DEK `oauth-tokens-v1`
7. Émettre `oauth.tokens.acquired` sur PgEventBus
8. Si `purpose = Login` : provisionning user (ou update), émettre JWT, redirect
9. Sinon : redirect vers `redirect_after`

### 5.3 Engine v1a (OAuth 1.0a legacy)

Trois endpoints (`request_token` → `authorize` → `access_token`), chaque requête signée HMAC-SHA1 avec `oauth_consumer_secret + oauth_token_secret`. Même interface que v2, mais le state porte aussi `oauth_token_secret`. Utilisé uniquement pour Twitter v1a et Trello (deprecated).

### 5.4 Engine SAML

Utilise la crate `samael` (MIT) pour parsing + signature XML. Le module `engine_saml.rs` encapsule `samael` derrière une interface identique aux autres engines (`start` / `callback`), de sorte que le handler HTTP unifié puisse dispatcher dynamiquement sans connaître les spécificités SAML.

**Flow** :
1. `start` : construire `AuthnRequest` XML, encoder base64+deflate, redirect vers l'IdP avec `SAMLRequest` + `RelayState` signé (équivalent du `state`)
2. `callback` (POST binding) : recevoir `SAMLResponse` + `RelayState`, valider signature XML avec cert IdP, extraire NameID + attributs
3. Pas de refresh (SAML n'en a pas). L'assertion chiffrée est stockée en `access_token_enc` pour relogin rapide

### 5.5 Gestion d'erreurs RFC 7807

```rust
#[derive(Debug, thiserror::Error)]
pub enum OAuthError {
    #[error("provider not configured for this tenant")]
    ProviderNotConfigured,
    #[error("provider disabled")]
    ProviderDisabled,
    #[error("user not allowed to use this provider")]
    UserAccessDenied,
    #[error("purpose {0:?} not allowed for this provider")]
    PurposeNotAllowed(OAuthPurpose),
    #[error("invalid state: {0}")]
    InvalidState(#[from] StateError),
    #[error("provider returned error: {error}: {description:?}")]
    ProviderError { error: String, description: Option<String> },
    #[error("token exchange failed: {0}")]
    TokenExchange(#[from] reqwest::Error),
    #[error("id_token validation failed: {0}")]
    IdTokenInvalid(String),
    #[error("saml assertion invalid: {0}")]
    SamlInvalid(String),
    #[error("scope {0} not in allowed_scopes")]
    ScopeNotAllowed(String),
}
```

Chaque variante a un status HTTP + `problem_type` URL pour la réponse RFC 7807.

## 6. Catalogue des providers

### 6.1 Format `catalog.json`

```json
{
  "version": "1.0",
  "providers": {
    "google": {
      "display_name": "Google",
      "protocol": "OAuth2",
      "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
      "access_url": "https://oauth2.googleapis.com/token",
      "refresh_url": "https://oauth2.googleapis.com/token",
      "profile_url": "https://www.googleapis.com/oauth2/v3/userinfo",
      "revoke_url": "https://oauth2.googleapis.com/revoke",
      "scope_delimiter": " ",
      "default_scopes": ["openid", "email", "profile"],
      "pkce_required": false,
      "supports_refresh": true,
      "token_placement": "Header",
      "user_id_field": "$.sub",
      "user_email_field": "$.email",
      "user_name_field": "$.name",
      "categories": ["Mail", "Calendar", "Drive", "Sso"],
      "notes": "Use access_type=offline + prompt=consent to get refresh_token"
    }
  }
}
```

### 6.2 Template vars pour providers multi-tenant

Microsoft, Keycloak, Auth0 ont des URLs paramétrées. Le catalogue déclare `template_vars: ["tenant"]`, et `ConfigStore` les remplit depuis `extra_params_enc` :

```rust
let url = provider.authorize_url.replace("{tenant}", &extra.get("tenant")?);
```

### 6.3 Liste des providers embarqués

~200 providers répartis en 12 catégories :

- **Mail** (5) : google, microsoft, fastmail, zoho, yahoo
- **Calendar** (4) : google, microsoft, apple, zoho
- **Drive** (6) : google, microsoft (onedrive), dropbox, box, pcloud, mega
- **SSO Entreprise** (11) : okta, auth0, keycloak, authentik, azure_ad, google_workspace, onelogin, ping_identity, jumpcloud, saml_generic, oidc_generic
- **SSO Consumer** (8) : google, apple, microsoft, facebook, github, gitlab, discord, twitter
  _Note : certains providers (google, microsoft) apparaissent dans plusieurs catégories car ils servent à la fois en mail/calendar/drive ET en SSO. Le `categories` array dans `catalog.json` est inclusif._
- **Social** (11) : twitter, linkedin, facebook, instagram, reddit, mastodon, bluesky, threads, tiktok, youtube, pinterest
- **Dev** (6) : github, gitlab, bitbucket, atlassian, gitea, codeberg
- **Chat** (5) : slack, discord, microsoft (teams), zoom, webex
- **CRM** (6) : salesforce, hubspot, pipedrive, zendesk, freshdesk, intercom
- **E-commerce** (5) : shopify, stripe, square, paypal, woocommerce
- **Cloud** (6) : aws, gcp, azure, digitalocean, linode, heroku
- **Autre** (25+) : spotify, twitch, notion, asana, airtable, figma, miro, etc.

### 6.4 Script de génération

One-shot, relancé manuellement ~2x/an :

```bash
node scripts/convert-grant-catalog.js \
  --input https://raw.githubusercontent.com/simov/grant/master/config/oauth.json \
  --output crates/signapps-oauth/catalog.json \
  --enrich-with scripts/oauth-catalog-enrichments.json
```

### 6.5 Validation à la compilation

`build.rs` du crate `signapps-oauth` valide le catalogue au compile-time : URLs parseables, JSONPath valides, cohérence `pkce_required` ↔ protocole. Build échoue si catalogue malformé.

## 7. Chiffrement

### 7.1 Architecture des clés

```
VAULT_MASTER_KEY (32 octets, via signapps-vault)
    │
    │ HKDF-SHA256 (info = "oauth-tokens-v1")
    ▼
DATA_ENCRYPTION_KEY (DEK, 32 octets, en mémoire uniquement)
    │
    │ AES-256-GCM
    ▼
Format : version(1) || nonce(12) || ciphertext || tag(16)
```

Une DEK par usage (`oauth-tokens-v1`, `saml-assertions-v1`, `extra-params-v1`) — compromission d'une DEK n'expose pas les autres domaines.

### 7.2 `signapps-vault`

```rust
pub struct Vault {
    master_key: MasterKey,
    deks: DashMap<&'static str, DataEncryptionKey>,
}

pub enum VaultBackend {
    EnvVar,                                      // Dev/test
    File(PathBuf),                               // Prod self-hosted
    Remote(Box<dyn RemoteVaultClient>),          // HashiCorp Vault / KMS
}
```

### 7.3 Trait `EncryptedField`

Dans `signapps-common::crypto`, basé sur la crate `aes-gcm` (RustCrypto, MIT/Apache — pas d'OpenSSL) :

```rust
pub trait EncryptedField: Sized {
    fn encrypt(plaintext: &[u8], dek: &DataEncryptionKey) -> Result<Vec<u8>, CryptoError>;
    fn decrypt(ciphertext: &[u8], dek: &DataEncryptionKey) -> Result<Vec<u8>, CryptoError>;
}
```

### 7.4 Pattern d'utilisation dans un service

```rust
let dek = state.vault.dek("oauth-tokens-v1");
let access_token = String::from_utf8(<()>::decrypt(&row.access_token, dek)?)?;
// Use token...
// Le plaintext est drop à la fin du scope
```

### 7.5 Rotation future (non-MVP)

Le byte de version 0x01 en tête du ciphertext permet une rotation de master key sans downtime : charger deux clés, déchiffrer avec l'une ou l'autre, re-chiffrer avec la nouvelle, retirer l'ancienne une fois la migration finie.

### 7.6 Guardrail au démarrage

À chaque boot d'un service qui manipule des tokens :

```rust
async fn assert_tokens_encrypted(pool: &PgPool) -> Result<(), DbError> {
    let leaks = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM mail_accounts
         WHERE access_token IS NOT NULL
           AND (get_byte(access_token, 0) != 1 OR length(access_token) < 13)"
    ).fetch_one(pool).await?;

    if leaks.unwrap_or(0) > 0 {
        return Err(DbError::UnencryptedTokensDetected(leaks.unwrap()));
    }
    Ok(())
}
```

Le service refuse de démarrer si des tokens en clair sont détectés.

## 8. Job de refresh

### 8.1 Double stratégie

- **Push** : `OAuthRefreshJob` dans `signapps-scheduler`, exécuté toutes les 5 min, scanne tokens expirant dans < 15 min
- **Pull** : helper `checkout_token()` côté services, refresh synchrone si token expire dans < 60s

### 8.2 Scanner

```rust
#[instrument(skip(self), fields(batch_id = %Uuid::new_v4()))]
pub async fn run(&self) -> Result<RefreshReport, JobError> {
    let expiring = sqlx::query_as!(
        RefreshQueueRow,
        "SELECT * FROM oauth_refresh_queue
         WHERE disabled = false
           AND consecutive_failures < 10
           AND expires_at < NOW() + INTERVAL '15 minutes'
           AND (last_refresh_attempt_at IS NULL OR last_refresh_attempt_at < NOW() - INTERVAL '2 minutes')
         ORDER BY expires_at ASC
         LIMIT 200"
    ).fetch_all(&self.pool).await?;

    let results = futures::stream::iter(expiring)
        .map(|row| self.refresh_one(row))
        .buffer_unordered(10)  // Parallélisme borné
        .collect::<Vec<_>>().await;

    // ...
}
```

### 8.3 Trait `TokenTable`

Pour supporter N tables sans hardcoder, registry avec impl par table :

```rust
pub trait TokenTable: Send + Sync {
    fn name(&self) -> &'static str;
    async fn load(&self, pool: &PgPool, id: Uuid) -> Result<(Vec<u8>, Vec<u8>), DbError>;
    async fn update(&self, pool: &PgPool, id: Uuid, access: &[u8], refresh: &[u8], expires: DateTime<Utc>) -> Result<(), DbError>;
}

// Impls : MailAccountsTable, CalendarProviderConnectionsTable,
// SocialAccountsTable, DriveCloudAccountsTable, SsoConnectionsTable
```

Ajouter un nouveau service qui consomme OAuth = implémenter `TokenTable` + enregistrer dans le registry.

### 8.4 Escalade

- **Succès** : `consecutive_failures = 0`, `last_error = NULL`
- **Erreur réseau / 5xx** : `consecutive_failures += 1`
- **Erreur 4xx (refresh_token invalidé)** : `disabled = true` immédiatement
- **`consecutive_failures >= 10`** : `disabled = true`
- **Sur `disabled = true`** : émettre `oauth.tokens.invalidated` → `signapps-notifications` crée une notif in-app, le service métier marque le compte `status = 'disconnected'`

### 8.5 Pull lazy (`checkout_token`)

```rust
#[instrument(skip(pool, vault, table))]
pub async fn checkout_token<T: TokenTable>(
    pool: &PgPool,
    vault: &Vault,
    table: &T,
    id: Uuid,
    identity_api_url: &str,
) -> Result<TokenCheckout, CheckoutError>
```

Si expires_at > now + 60s : déchiffre et retourne direct. Sinon : appelle `POST /api/v1/oauth/internal/refresh` sur identity, qui orchestre le refresh et met à jour la table.

### 8.6 Métriques Prometheus

- `oauth_refresh_attempts_total{provider}`
- `oauth_refresh_duration_seconds`
- `oauth_refresh_failures_total{provider, kind}`
- `oauth_tokens_disabled_total`

## 9. Admin UI

### 9.1 Page `/admin/oauth-providers`

Liste des providers par catégorie, avec statut (activé / non configuré / erreurs récentes), nombre d'utilisateurs connectés, taux de refresh success sur 30 jours.

Filtres : catégorie, statut, recherche texte. Bouton `[+ Provider custom]` pour ajouter OIDC/SAML non-catalogué.

### 9.2 Drawer de configuration

5 onglets par provider :

**Général** : toggle `enabled`, purposes autorisés (`login`/`integration`), toggle `allow_user_override`, affichage de la callback URL à enregistrer chez le provider.

**Credentials** : champs `client_id` / `client_secret` masqués (affichage `••••`), bouton `[Modifier]` pour rotation, bouton `[Tester la connexion]` qui déclenche un flow OAuth de bout en bout sans persister.

**Visibilité** : toggle `all` / `restricted`. Si restricted :
- `VisibilityPicker` (org_nodes, groups, roles, users nommés) pour la visibilité globale
- Table de granularité par purpose : chaque purpose peut overrider la visibilité globale (via `oauth_provider_purpose_overrides`)

**Scopes** : liste des `allowed_scopes` avec checkboxes, warnings UI pour scopes sensibles (`gmail.modify`, `drive` full, contacts full).

**Audit** : stats (connexions actives, flows réussis 30j, échecs refresh, tokens désactivés), lien vers audit log complet.

### 9.3 Ajout d'un provider custom

Dialog avec choix du type (OIDC / OAuth2 / SAML) :

- **OIDC** : input URL discovery, `[Importer]` fetch `.well-known/openid-configuration` et pré-remplit authorize_url/access_url/userinfo_url/jwks_uri
- **OAuth2** : formulaire manuel des URLs
- **SAML** : upload du metadata XML de l'IdP, extraction automatique SSO URL / cert / entity_id

### 9.4 Vue utilisateur `/account/connections`

Liste des connexions actives de l'user (`mail`, `calendar`, `social`, `drive` agrégés) avec statut (connecté / reconnexion requise), bouton `[Reconnecter]` / `[Déconnecter]`.

Section `[+ Ajouter une connexion]` liste les providers visibles pour l'user (filtrés via `ScopeResolver::list_visible_providers`).

Section `[Credentials personnels (avancé)]` si l'admin a activé `allow_user_override`, permet à l'user d'utiliser ses propres client_id/secret pour ce provider.

### 9.5 Endpoints API

```
GET    /api/v1/oauth/providers                         (user)
GET    /api/v1/oauth/my-connections                    (user)
POST   /api/v1/oauth/my-connections/:id/disconnect     (user)

GET    /api/v1/admin/oauth-providers                   (admin)
POST   /api/v1/admin/oauth-providers                   (admin)
PATCH  /api/v1/admin/oauth-providers/:id               (admin)
DELETE /api/v1/admin/oauth-providers/:id               (admin)
POST   /api/v1/admin/oauth-providers/:id/test          (admin)
POST   /api/v1/admin/oauth-providers/custom            (admin)
POST   /api/v1/admin/oauth-providers/:id/purpose-overrides (admin)
GET    /api/v1/admin/oauth-providers/:id/stats         (admin)
```

### 9.6 Audit log

Toute action admin OAuth est loggée dans `audit_log` avec action, actor_id, target_type, target_id, metadata (changes diff). Actions trackées : create, enable/disable, credentials rotated, visibility changed, scopes added/removed, test triggered, custom provider created, purpose override changed.

### 9.7 Arborescence frontend

```
client/src/app/admin/oauth-providers/
  page.tsx
  components/
    ProviderCard.tsx
    ProviderCategorySection.tsx
    ProviderConfigDrawer.tsx
    tabs/
      GeneralTab.tsx
      CredentialsTab.tsx
      VisibilityTab.tsx
      ScopesTab.tsx
      AuditTab.tsx
    CustomProviderDialog.tsx
    VisibilityPicker.tsx       # Réutilisable (GPO, content perms, ...)
    ScopePicker.tsx
  hooks/
    useOAuthProviders.ts
    useOidcDiscovery.ts
  lib/
    oauth-api.ts

client/src/app/account/connections/
  page.tsx
  components/
    ConnectionCard.tsx
    AddConnectionDialog.tsx
    UserCredentialsDialog.tsx
```

## 10. Migration offline

### 10.1 Vue d'ensemble

Script one-shot qui :
1. Stoppe tous les services
2. Backup complet de la DB
3. Applique les nouvelles migrations SQL
4. Chiffre les tokens existants in-place
5. Seed `oauth_refresh_queue`
6. Rebuilds binaires
7. Valide (tokens chiffrés, déchiffrement échantillon, queue populée)
8. Redémarre services

**Downtime** : 5-10 min pour 100-10000 utilisateurs. **Aucune re-OAuth requise**.

### 10.2 Script principal

`scripts/migrate-oauth-unified.sh` orchestre les 8 phases. Idempotent : chaque phase détecte si elle a déjà tourné (via byte de version 0x01, via existence des tables, etc.).

### 10.3 Les 3 binaires de migration

**`oauth-migrate-encrypt`** : parcourt chaque `(table, column)` de tokens, détecte les lignes non-chiffrées (byte de version != 0x01), chiffre en batch de 500.

**`oauth-migrate-seed-queue`** : `INSERT ... SELECT` depuis chaque table vers `oauth_refresh_queue` avec `ON CONFLICT DO NOTHING`.

**`oauth-migrate-verify`** : vérifie que (a) aucune ligne n'est en clair, (b) un échantillon aléatoire se déchiffre correctement, (c) la queue contient autant d'entries que de refresh_tokens non-NULL dans les tables source.

### 10.4 Rollback

`scripts/rollback-oauth-migration.sh <backup_dir>` :
1. Stop services
2. Drop + recreate DB
3. `pg_restore` depuis `full.dump`
4. Git checkout commit précédent
5. Rebuild + restart

### 10.5 Test préalable

`scripts/test-oauth-migration-on-dump.sh` : restore dump prod sur DB de test, anonymise les tokens (valeurs factices conformes au format), lance la migration, vérifie. À faire J-1.

### 10.6 Communication et fenêtre de maintenance

- **J-7** : notification utilisateurs + banner admin
- **J-1** : test sur dump anonymisé
- **Jour J** : maintenance mode (503) → migration → doctor 21/21 → off maintenance mode
- **J+1** : surveiller `oauth_refresh_queue.consecutive_failures`
- **J+7** : si OK, purge des backups anciens (> 3 mois)

## 11. Sécurité

### 11.1 Threat model

| Menace | Mitigation |
|--------|-----------|
| Breach DB | Tokens AES-GCM, master key hors DB (vault ou env) |
| Backup non chiffré | Même chose — backup contient les ciphertexts |
| Compromission master key | Rotation possible via byte de version ; DEKs isolées par usage |
| CSRF sur callback | `state` param HMAC-signé avec expiration 10 min |
| Replay d'un callback | `flow_id` unique, on peut ajouter une table de nonces consommés si nécessaire (pas MVP — la date d'expiration suffit) |
| Interception HTTPS | PKCE (S256) activé sur tous les providers qui le supportent |
| id_token spoofing (OIDC) | Signature JWK validée depuis `jwks_uri`, `nonce` vérifié, `aud` matché |
| XML signature bypass (SAML) | `samael` avec vérification stricte, cert IdP chargé via config tenant (pas dans le XML lui-même) |
| Admin malveillant change visibility | Audit log complet ; alertes Prometheus sur `oauth_provider_configs` UPDATE |
| User malveillant demande scope non-autorisé | `ScopeResolver::filter_scopes` rejette ; aucune escalation possible côté client |

### 11.2 Zéro trust dans le state

Le `state` est HMAC-signé, **pas chiffré**. Ce qu'il contient (PKCE verifier) doit être acceptable en transit :
- HTTPS protège la confidentialité
- Expiration 10 min limite la fenêtre d'exploitation
- Le PKCE verifier seul ne permet rien (il faut aussi le `code`)

### 11.3 Logs

- Tokens **jamais** loggés (ni access, ni refresh, ni id_token)
- `#[instrument(skip(tokens, secret))]` sur toute fonction qui les manipule
- Les erreurs OAuth loggent le type + provider, jamais le body complet de la réponse (peut contenir des tokens partiels)

## 12. Assertions E2E clés

Les tests Playwright doivent couvrir :

1. `admin.oauth.enable_google` : admin active Google pour le tenant, config apparaît dans `/account/connections`
2. `admin.oauth.visibility_restricted` : provider visible pour Commercial uniquement, user R&D ne le voit pas
3. `admin.oauth.purpose_override` : Google activé pour login (tous), integration (R&D uniquement) → user Commercial voit Google dans login, pas dans `/account/connections/add`
4. `admin.oauth.custom_oidc` : ajout Keycloak via discovery URL, config persistée, flow de login réussit
5. `admin.oauth.custom_saml` : upload metadata XML, config persistée, POST SAML callback validé
6. `admin.oauth.test_connection` : bouton `[Tester]` déclenche flow admin, pas de persistance de tokens
7. `admin.oauth.rotate_credentials` : changer client_secret, flow en cours (state déjà émis) échoue, nouveau flow réussit
8. `user.oauth.connect_gmail` : user démarre flow Gmail, redirect Google, callback, voit la connexion dans `/account/connections`
9. `user.oauth.reconnect_after_revoke` : provider révoque (4xx), compte marqué `disconnected`, user reconnecte, compte re-actif
10. `user.oauth.user_override` : admin active `allow_user_override`, user entre ses client_id/secret perso, flow utilise les creds user
11. `oauth.refresh.proactive` : job scheduler refresh un token expirant dans 10 min, `expires_at` mis à jour
12. `oauth.refresh.lazy` : service fait `checkout_token` sur token expiré, refresh synchrone réussit, token à jour
13. `oauth.refresh.disabled_after_10_failures` : 10 échecs consécutifs, `disabled = true`, event `oauth.tokens.invalidated` émis
14. `oauth.csrf.tampered_state` : flow démarré, attaquant modifie le state, callback rejeté avec `InvalidState::BadSignature`
15. `oauth.csrf.expired_state` : state reçu 11 min après émission, callback rejeté avec `InvalidState::Expired`
16. `oauth.pkce.verifier_mismatch` : attaquant réutilise code avec mauvais verifier, provider rejette, `ProviderError` remonté
17. `oauth.oidc.invalid_nonce` : id_token reçu avec nonce absent ou faux, `IdTokenInvalid("nonce mismatch")`
18. `oauth.oidc.invalid_signature` : id_token signé avec clé non-JWK, `IdTokenInvalid("signature")`
19. `oauth.saml.unsigned_assertion` : SAML response sans signature, rejeté avec `SamlInvalid`
20. `migration.idempotent` : relancer `oauth-migrate-encrypt` une 2e fois ne re-chiffre pas les tokens déjà chiffrés
21. `migration.verify_catches_cleartext` : token en clair laissé par erreur, `oauth-migrate-verify` sort en erreur
22. `vault.no_plaintext_at_boot` : seed un token en clair, le service refuse de démarrer avec `UnencryptedTokensDetected`

## 13. Sources

### 13.1 Inspiration

- **[simov/grant](https://github.com/simov/grant)** (MIT) — catalogue de 200+ providers, patterns de stateless state machine, convention `authorize_url` / `access_url` / `scope_delimiter`. **Pas de réutilisation de code**, uniquement les patterns.

### 13.2 Librairies Rust utilisées

| Crate | Licence | Usage |
|-------|---------|-------|
| `reqwest` | MIT/Apache | HTTP client pour échanges OAuth |
| `aes-gcm` | MIT/Apache | Chiffrement AES-256-GCM |
| `hkdf` | MIT/Apache | Dérivation DEK depuis master key |
| `hmac` + `sha2` | MIT/Apache | Signature HMAC du state |
| `jsonwebtoken` | MIT | Validation id_token OIDC |
| `jsonpath_lib` | MIT | Extraction user_id_field depuis profile |
| `samael` | MIT | Parsing + signature XML SAML |
| `url` | MIT/Apache | Construction des URLs d'authorization |
| `sqlx` | MIT/Apache | Requêtes DB typées |
| `tracing` | MIT | Observabilité |
| `base64` | MIT/Apache | Encoding state |
| `rand` | MIT/Apache | PKCE verifier + nonces |
| `utoipa` | MIT/Apache | OpenAPI spec |

### 13.3 Librairies frontend

| Package | Licence | Usage |
|---------|---------|-------|
| `swr` | MIT | Fetching / caching API admin |
| `react-hook-form` | MIT | Formulaires de config |
| `zod` | MIT | Validation schema des configs |
| `@radix-ui/react-*` | MIT | Primitives (Drawer, Tabs, Dialog, Popover) |
| `lucide-react` | ISC | Icônes |

Aucune dépendance GPL/AGPL/LGPL/SSPL/BSL.

## 14. Ce qu'il ne faut PAS faire

- **Ne pas stocker la master key en DB** (même chiffrée)
- **Ne pas logger les tokens** (ni access, ni refresh, ni id_token, ni assertions SAML)
- **Ne pas implémenter le refresh dans chaque service** — tout passe par `POST /api/v1/oauth/internal/refresh` ou le scheduler
- **Ne pas ajouter un provider sans l'enrichir** avec `user_id_field`, `categories`, `notes` — un provider incomplet génère des bugs
- **Ne pas désactiver PKCE** sur un provider qui le supporte
- **Ne pas skip la validation id_token** (signature JWK, nonce, aud) — c'est non-négociable en OIDC
- **Ne pas router les events `oauth.tokens.acquired`** ailleurs que via PgEventBus — sinon on recrée le couplage direct qu'on essaie d'éliminer
- **Ne pas faire de `UPDATE ... SET client_secret = ''`** pour "désactiver" un provider — utiliser `enabled = false`
- **Ne pas re-générer `catalog.json`** en CI — c'est un fichier versionné dans git, maintenu manuellement

## 15. Roadmap d'implémentation

Les blocs suivants doivent être construits dans cet ordre pour permettre des tests incrémentaux :

1. **Foundation** : `signapps-vault` + `EncryptedField` trait dans `signapps-common::crypto`
2. **Crate OAuth** : `signapps-oauth` avec catalog + state + scope_resolver, sans engine
3. **Engine v2** : OAuth2 + OIDC, handlers HTTP dans identity
4. **Migration offline** : 3 binaires + script bash + rollback + tests sur dump
5. **Event bus** : `OAuthTokensAcquired` + consommateurs mail/calendar/social/drive
6. **Scheduler refresh** : `oauth_refresh_queue` + triggers + `OAuthRefreshJob`
7. **Admin UI** : page + drawer + tabs + `VisibilityPicker` réutilisable
8. **Engine SAML** : `samael` + POST binding + tests E2E
9. **Engine v1a** : OAuth 1.0a pour Twitter legacy (optionnel)
10. **Observabilité** : métriques Prometheus + audit log complet

La spec complète guide l'implémentation — le plan détaillé tâche-par-tâche sera généré via `writing-plans`.
