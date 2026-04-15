//! SignApps Gateway - Reverse-Proxy entry point
//!
//! Routes all public traffic to the appropriate backend service using reqwest.
//! Each service runs on its own port; the gateway forwards by path prefix.

mod graphql;
mod openapi;

use axum::{
    body::Body,
    extract::{Request, State},
    http::{HeaderName, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{any, get, post},
    Router,
};
use signapps_common::bootstrap::{env_or, init_tracing, load_env};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;
use tokio::task::JoinHandle;

// ---------------------------------------------------------------------------
// Service port map
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct ServiceMap {
    /// Ordered list of (path_prefix, backend_base_url)
    routes: Vec<(String, String)>,
    client: reqwest::Client,
}

impl ServiceMap {
    fn new(routes: Vec<(&str, &str)>) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .pool_idle_timeout(Duration::from_secs(30))
            .pool_max_idle_per_host(32)
            .build()
            .expect("reqwest client");

        Self {
            routes: routes
                .into_iter()
                .map(|(p, u)| (p.to_string(), u.to_string()))
                .collect(),
            client,
        }
    }

    /// Find the backend URL for a given path.
    fn resolve(&self, path: &str) -> Option<&str> {
        self.routes
            .iter()
            .find(|(prefix, _)| path.starts_with(prefix.as_str()))
            .map(|(_, url)| url.as_str())
    }
}

// ---------------------------------------------------------------------------
// Gateway health
// ---------------------------------------------------------------------------

#[utoipa::path(
    get,
    path = "/gateway/health",
    responses(
        (status = 200, description = "Gateway is healthy", body = inline(serde_json::Value)),
    ),
    tag = "System",
)]
async fn gateway_health() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "gateway": "signapps-gateway",
        "status": "healthy",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

// ---------------------------------------------------------------------------
// App discovery types
// ---------------------------------------------------------------------------

/// App metadata returned by service /health endpoints.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct DiscoveredApp {
    id: String,
    label: String,
    description: String,
    icon: String,
    category: String,
    color: String,
    href: String,
    port: u16,
    /// Service health status at discovery time.
    status: String,
}

/// Response for the app discovery endpoint.
#[derive(Debug, serde::Serialize)]
struct DiscoverResponse {
    apps: Vec<DiscoveredApp>,
    categories: Vec<&'static str>,
}

/// Known service ports for health probing.
const SERVICE_PORTS: &[(&str, u16)] = &[
    ("signapps-identity", 3001),
    ("signapps-containers", 3002),
    ("signapps-proxy", 3003),
    ("signapps-storage", 3004),
    ("signapps-ai", 3005),
    ("signapps-securelink", 3006),
    ("signapps-scheduler", 3007),
    ("signapps-metrics", 3008),
    ("signapps-media", 3009),
    ("signapps-docs", 3010), // also serves collab (port 3013 merged) and office (port 3018 merged)
    ("signapps-calendar", 3011),
    ("signapps-mail", 3012),
    // signapps-collab (3013) merged into signapps-docs (3010)
    ("signapps-meet", 3014), // also serves remote desktop (port 3017 merged)
    ("signapps-forms", 3015),
    ("signapps-pxe", 3016), // also serves DC protocol listeners (LDAP/Kerberos/NTP) merged from signapps-dc
    // signapps-remote (3017) merged into signapps-meet (3014)
    // signapps-office (3018) merged into signapps-docs (3010)
    ("signapps-social", 3019),
    ("signapps-chat", 3020),
    ("signapps-contacts", 3021),
    ("signapps-it-assets", 3022),
    ("signapps-workforce", 3024),
    ("signapps-vault", 3025),
    ("signapps-org", 3026),
    ("signapps-webhooks", 3027),
    ("signapps-signatures", 3028),
    ("signapps-tenant-config", 3029),
    ("signapps-integrations", 3030),
    ("signapps-backup", 3031),
    ("signapps-compliance", 3032),
    ("signapps-gamification", 3033),
    ("signapps-collaboration", 3034),
    ("signapps-notifications", 8095),
    ("signapps-billing", 8096),
];

/// Frontend-only apps that have no backend service.
fn static_frontend_apps() -> Vec<DiscoveredApp> {
    vec![
        DiscoveredApp {
            id: "sheets".into(),
            label: "Sheets".into(),
            description: "Tableurs et analyses de données".into(),
            icon: "Sheet".into(),
            category: "Productivité".into(),
            color: "text-green-500".into(),
            href: "/sheets".into(),
            port: 0,
            status: "static".into(),
        },
        DiscoveredApp {
            id: "slides".into(),
            label: "Slides".into(),
            description: "Présentations et diaporamas".into(),
            icon: "Presentation".into(),
            category: "Productivité".into(),
            color: "text-yellow-500".into(),
            href: "/slides".into(),
            port: 0,
            status: "static".into(),
        },
        DiscoveredApp {
            id: "design".into(),
            label: "Design".into(),
            description: "Création graphique et maquettes".into(),
            icon: "Palette".into(),
            category: "Productivité".into(),
            color: "text-purple-500".into(),
            href: "/design".into(),
            port: 0,
            status: "static".into(),
        },
        DiscoveredApp {
            id: "keep".into(),
            label: "Keep".into(),
            description: "Notes rapides et mémos".into(),
            icon: "StickyNote".into(),
            category: "Productivité".into(),
            color: "text-yellow-400".into(),
            href: "/keep".into(),
            port: 0,
            status: "static".into(),
        },
        DiscoveredApp {
            id: "whiteboard".into(),
            label: "Tableau blanc".into(),
            description: "Dessin et brainstorming visuel".into(),
            icon: "PenTool".into(),
            category: "Productivité".into(),
            color: "text-pink-400".into(),
            href: "/whiteboard".into(),
            port: 0,
            status: "static".into(),
        },
        // vault is now a real backend service (port 3025) — discovered dynamically via SERVICE_PORTS
        DiscoveredApp {
            id: "wiki".into(),
            label: "Wiki".into(),
            description: "Base de connaissances interne".into(),
            icon: "BookOpen".into(),
            category: "Productivité".into(),
            color: "text-amber-600".into(),
            href: "/wiki".into(),
            port: 0,
            status: "static".into(),
        },
        DiscoveredApp {
            id: "tasks".into(),
            label: "Tasks".into(),
            description: "Tâches et suivi de projets".into(),
            icon: "CheckSquare".into(),
            category: "Organisation".into(),
            color: "text-green-500".into(),
            href: "/tasks".into(),
            port: 0,
            status: "static".into(),
        },
        DiscoveredApp {
            id: "projects".into(),
            label: "Projects".into(),
            description: "Gestion de projets Kanban".into(),
            icon: "KanbanSquare".into(),
            category: "Organisation".into(),
            color: "text-orange-500".into(),
            href: "/projects".into(),
            port: 0,
            status: "static".into(),
        },
        DiscoveredApp {
            id: "resources".into(),
            label: "Resources".into(),
            description: "Ressources et équipements".into(),
            icon: "Package".into(),
            category: "Organisation".into(),
            color: "text-amber-500".into(),
            href: "/resources".into(),
            port: 0,
            status: "static".into(),
        },
        DiscoveredApp {
            id: "crm".into(),
            label: "CRM".into(),
            description: "Gestion des clients et prospects".into(),
            icon: "TrendingUp".into(),
            category: "Business".into(),
            color: "text-red-500".into(),
            href: "/crm".into(),
            port: 0,
            status: "static".into(),
        },
        DiscoveredApp {
            id: "accounting".into(),
            label: "Accounting".into(),
            description: "Comptabilité et finances".into(),
            icon: "Calculator".into(),
            category: "Business".into(),
            color: "text-teal-500".into(),
            href: "/accounting".into(),
            port: 0,
            status: "static".into(),
        },
        DiscoveredApp {
            id: "analytics".into(),
            label: "Analytics".into(),
            description: "Tableaux de bord et métriques".into(),
            icon: "BarChart3".into(),
            category: "Business".into(),
            color: "text-cyan-500".into(),
            href: "/analytics".into(),
            port: 0,
            status: "static".into(),
        },
        DiscoveredApp {
            id: "settings".into(),
            label: "Paramètres".into(),
            description: "Configuration de l'instance".into(),
            icon: "Settings".into(),
            category: "Administration".into(),
            color: "text-slate-500".into(),
            href: "/settings".into(),
            port: 0,
            status: "static".into(),
        },
        DiscoveredApp {
            id: "backups".into(),
            label: "Sauvegardes".into(),
            description: "Sauvegardes automatiques".into(),
            icon: "Archive".into(),
            category: "Administration".into(),
            color: "text-slate-400".into(),
            href: "/admin/backups".into(),
            port: 0,
            status: "static".into(),
        },
        DiscoveredApp {
            id: "bookmarks".into(),
            label: "Favoris".into(),
            description: "Liens et ressources sauvegardés".into(),
            icon: "Star".into(),
            category: "Avancé".into(),
            color: "text-yellow-500".into(),
            href: "/bookmarks".into(),
            port: 0,
            status: "static".into(),
        },
        DiscoveredApp {
            id: "apps".into(),
            label: "App Store".into(),
            description: "Extensions et intégrations".into(),
            icon: "Store".into(),
            category: "Avancé".into(),
            color: "text-indigo-500".into(),
            href: "/apps".into(),
            port: 0,
            status: "static".into(),
        },
    ]
}

/// Probe a single service's /health endpoint and extract app metadata.
async fn probe_service(client: &reqwest::Client, _name: &str, port: u16) -> Option<DiscoveredApp> {
    let url = format!("http://127.0.0.1:{}/health", port);
    let resp = tokio::time::timeout(Duration::from_secs(2), client.get(&url).send())
        .await
        .ok()?
        .ok()?;

    let json: serde_json::Value = resp.json().await.ok()?;

    let app = json.get("app")?;
    let status = json
        .get("status")
        .and_then(|s| s.as_str())
        .unwrap_or("unknown")
        .to_string();

    Some(DiscoveredApp {
        id: app.get("id")?.as_str()?.to_string(),
        label: app.get("label")?.as_str()?.to_string(),
        description: app.get("description")?.as_str()?.to_string(),
        icon: app.get("icon")?.as_str()?.to_string(),
        category: app.get("category")?.as_str()?.to_string(),
        color: app.get("color")?.as_str()?.to_string(),
        href: app.get("href")?.as_str()?.to_string(),
        port: app.get("port").and_then(|p| p.as_u64()).unwrap_or(0) as u16,
        status,
    })
}

/// `GET /api/v1/apps/discover` — query all services and return their app metadata.
///
/// Each service is probed in parallel with a 2-second timeout.
/// Services that don't respond are omitted. Frontend-only apps are always included.
///
/// # Errors
///
/// This endpoint does not fail — unreachable services are silently omitted.
///
/// # Panics
///
/// No panics possible.
#[utoipa::path(
    get,
    path = "/api/v1/apps/discover",
    responses(
        (status = 200, description = "List of discovered applications"),
    ),
    tag = "Discovery",
)]
#[tracing::instrument(skip_all)]
async fn discover_apps() -> axum::Json<DiscoverResponse> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .unwrap_or_default();

    // Probe all services in parallel
    let futures: Vec<_> = SERVICE_PORTS
        .iter()
        .map(|(name, port)| {
            let client = client.clone();
            async move { probe_service(&client, name, *port).await }
        })
        .collect();

    let results = futures::future::join_all(futures).await;

    let mut apps: Vec<DiscoveredApp> = results.into_iter().flatten().collect();

    // Add frontend-only static apps
    apps.extend(static_frontend_apps());

    // Sort by category then label for stable ordering
    apps.sort_by(|a, b| a.category.cmp(&b.category).then(a.label.cmp(&b.label)));

    axum::Json(DiscoverResponse {
        apps,
        categories: vec![
            "Productivité",
            "Communication",
            "Organisation",
            "Business",
            "Infrastructure",
            "Administration",
            "Avancé",
        ],
    })
}

// ---------------------------------------------------------------------------
// Reverse-proxy handler
// ---------------------------------------------------------------------------

#[utoipa::path(
    get,
    path = "/api/v1/{path}",
    params(
        ("path" = String, Path, description = "Path forwarded to the appropriate backend service"),
    ),
    responses(
        (status = 200, description = "Response from upstream backend service"),
        (status = 404, description = "No backend configured for this path"),
        (status = 502, description = "Backend service unreachable"),
    ),
    tag = "Proxy",
)]
async fn proxy_handler(State(svc): State<Arc<ServiceMap>>, req: Request) -> Response {
    let path = req.uri().path();
    let path_query = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or(path);

    let backend = match svc.resolve(path) {
        Some(b) => b,
        None => {
            return (
                StatusCode::NOT_FOUND,
                axum::Json(serde_json::json!({ "error": "No backend for this path" })),
            )
                .into_response();
        },
    };

    let target_url = format!("{}{}", backend.trim_end_matches('/'), path_query);

    let method = req.method().clone();
    let headers = req.headers().clone();

    // Collect body bytes
    let body_bytes = match axum::body::to_bytes(req.into_body(), usize::MAX).await {
        Ok(b) => b,
        Err(e) => {
            tracing::error!("Failed to read request body: {}", e);
            return StatusCode::BAD_GATEWAY.into_response();
        },
    };

    // Build forwarded request
    let mut proxy_req = svc.client.request(method.clone(), &target_url);

    // Copy headers (skip hop-by-hop)
    for (name, value) in &headers {
        let n = name.as_str().to_lowercase();
        if matches!(
            n.as_str(),
            "connection"
                | "keep-alive"
                | "proxy-authenticate"
                | "proxy-authorization"
                | "te"
                | "trailers"
                | "transfer-encoding"
                | "upgrade"
        ) {
            continue;
        }
        proxy_req = proxy_req.header(name.as_str(), value.as_bytes());
    }

    if !body_bytes.is_empty() {
        proxy_req = proxy_req.body(body_bytes.to_vec());
    }

    match proxy_req.send().await {
        Ok(resp) => {
            let status = resp.status();
            let resp_headers = resp.headers().clone();
            let resp_bytes = match resp.bytes().await {
                Ok(b) => b,
                Err(e) => {
                    tracing::error!("Failed to read backend response: {}", e);
                    return StatusCode::BAD_GATEWAY.into_response();
                },
            };

            let mut response = Response::new(Body::from(resp_bytes));
            *response.status_mut() =
                StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);

            for (name, value) in &resp_headers {
                let n = name.as_str().to_lowercase();
                if matches!(
                    n.as_str(),
                    "connection" | "transfer-encoding" | "keep-alive"
                ) {
                    continue;
                }
                if let (Ok(hn), Ok(hv)) = (
                    HeaderName::from_bytes(name.as_str().as_bytes()),
                    HeaderValue::from_bytes(value.as_bytes()),
                ) {
                    response.headers_mut().insert(hn, hv);
                }
            }

            response
        },
        Err(e) => {
            tracing::warn!("Backend {} unreachable: {}", backend, e);
            (
                StatusCode::BAD_GATEWAY,
                axum::Json(serde_json::json!({
                    "error": "Backend service unreachable",
                    "backend": backend
                })),
            )
                .into_response()
        },
    }
}

// ---------------------------------------------------------------------------
// Spawn service helper (kept for future embedded-service mode)
// ---------------------------------------------------------------------------

#[allow(dead_code)]
async fn spawn_service(
    name: &str,
    port: u16,
    router: Router,
    mut shutdown_rx: watch::Receiver<bool>,
) -> JoinHandle<()> {
    let name = name.to_string();
    let addr = format!("0.0.0.0:{}", port);

    tokio::spawn(async move {
        let listener = match tokio::net::TcpListener::bind(&addr).await {
            Ok(l) => {
                tracing::info!("[{}] listening on port {}", name, port);
                l
            },
            Err(e) => {
                tracing::error!("[{}] failed to bind port {}: {}", name, port, e);
                return;
            },
        };

        let shutdown_signal = {
            let name = name.clone();
            async move {
                loop {
                    shutdown_rx.changed().await.ok();
                    if *shutdown_rx.borrow() {
                        break;
                    }
                }
                tracing::info!("[{}] shutting down...", name);
            }
        };

        if let Err(e) = axum::serve(listener, router)
            .with_graceful_shutdown(shutdown_signal)
            .await
        {
            tracing::error!("[{}] server error: {}", name, e);
        }

        tracing::info!("[{}] stopped", name);
    })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_gateway");
    load_env();

    tracing::info!("=== SignApps Gateway - Reverse Proxy ===");

    // Build the service route table from env vars (overridable for testing/docker)
    let identity_url = env_or("IDENTITY_SERVICE_URL", "http://127.0.0.1:3001");
    let docs_url = env_or("DOCS_SERVICE_URL", "http://127.0.0.1:3010");
    let storage_url = env_or("STORAGE_SERVICE_URL", "http://127.0.0.1:3004");
    let ai_url = env_or("AI_SERVICE_URL", "http://127.0.0.1:3005");
    let calendar_url = env_or("CALENDAR_SERVICE_URL", "http://127.0.0.1:3011");
    let forms_url = env_or("FORMS_SERVICE_URL", "http://127.0.0.1:3015");
    let social_url = env_or("SOCIAL_SERVICE_URL", "http://127.0.0.1:3019");
    // Office and collab are now served by signapps-docs on port 3010.
    // OFFICE_SERVICE_URL and COLLAB_SERVICE_URL env vars are kept for compatibility
    // but default to the docs service URL.
    let office_url = env_or("OFFICE_SERVICE_URL", "http://127.0.0.1:3010");
    // Remote desktop is now served by signapps-meet on port 3014 (merged in Refactor 35 Phase 2).
    // REMOTE_SERVICE_URL is kept for compatibility but defaults to the meet service URL.
    let remote_url = env_or("REMOTE_SERVICE_URL", "http://127.0.0.1:3014");
    let mail_url = env_or("MAIL_SERVICE_URL", "http://127.0.0.1:3012");
    let proxy_url = env_or("PROXY_SERVICE_URL", "http://127.0.0.1:3003");
    let chat_url = env_or("CHAT_SERVICE_URL", "http://127.0.0.1:3020");
    let collab_url = env_or("COLLAB_SERVICE_URL", "http://127.0.0.1:3010");
    let meet_url = env_or("MEET_SERVICE_URL", "http://127.0.0.1:3014");
    let notifications_url = env_or("NOTIFICATIONS_SERVICE_URL", "http://127.0.0.1:8095");
    let billing_url = env_or("BILLING_SERVICE_URL", "http://127.0.0.1:8096");
    let workforce_url = env_or("WORKFORCE_SERVICE_URL", "http://127.0.0.1:3024");
    let contacts_url = env_or("CONTACTS_SERVICE_URL", "http://127.0.0.1:3021");
    let metrics_url = env_or("METRICS_SERVICE_URL", "http://127.0.0.1:3008");
    let media_url = env_or("MEDIA_SERVICE_URL", "http://127.0.0.1:3009");
    let scheduler_url = env_or("SCHEDULER_SERVICE_URL", "http://127.0.0.1:3007");
    let securelink_url = env_or("SECURELINK_SERVICE_URL", "http://127.0.0.1:3006");
    let it_assets_url = env_or("IT_ASSETS_SERVICE_URL", "http://127.0.0.1:3022");
    let containers_url = env_or("CONTAINERS_SERVICE_URL", "http://127.0.0.1:3002");
    let pxe_url = env_or("PXE_SERVICE_URL", "http://127.0.0.1:3016");
    let vault_url = env_or("VAULT_SERVICE_URL", "http://127.0.0.1:3025");
    let org_url = env_or("ORG_SERVICE_URL", "http://127.0.0.1:3026");
    let webhooks_url = env_or("WEBHOOKS_SERVICE_URL", "http://127.0.0.1:3027");
    let signatures_url = env_or("SIGNATURES_SERVICE_URL", "http://127.0.0.1:3028");
    let tenant_config_url = env_or("TENANT_CONFIG_SERVICE_URL", "http://127.0.0.1:3029");
    let integrations_url = env_or("INTEGRATIONS_SERVICE_URL", "http://127.0.0.1:3030");
    let backup_url = env_or("BACKUP_SERVICE_URL", "http://127.0.0.1:3031");
    let compliance_url = env_or("COMPLIANCE_SERVICE_URL", "http://127.0.0.1:3032");
    let gamification_url = env_or("GAMIFICATION_SERVICE_URL", "http://127.0.0.1:3033");
    let collaboration_url = env_or("COLLABORATION_SERVICE_URL", "http://127.0.0.1:3034");

    // Ordered: more-specific prefixes first
    let service_map = Arc::new(ServiceMap::new(vec![
        ("/api/v1/auth", &identity_url),
        // Compliance: data-export is under /api/v1/users/me/export — must appear before /api/v1/users
        ("/api/v1/users/me/export", &compliance_url),
        ("/api/v1/users", &identity_url),
        ("/api/v1/workspaces", &identity_url),
        ("/api/v1/tenant", &identity_url),
        ("/api/v1/docs", &docs_url),
        ("/api/v1/channels", &docs_url),
        ("/api/v1/dms", &docs_url),
        ("/api/v1/files", &storage_url),
        ("/api/v1/buckets", &storage_url),
        ("/api/v1/preview", &storage_url),
        ("/api/v1/search", &storage_url),
        ("/api/v1/trash", &storage_url),
        ("/api/v1/favorites", &storage_url),
        ("/api/v1/quotas", &storage_url),
        ("/api/v1/permissions", &storage_url),
        ("/api/v1/ai", &ai_url),
        ("/api/v1/calendar", &calendar_url),
        ("/api/v1/forms", &forms_url),
        ("/api/v1/social", &social_url),
        ("/api/v1/office", &office_url),
        ("/api/v1/remote", &remote_url),
        ("/api/v1/mail", &mail_url),
        ("/api/v1/proxy", &proxy_url),
        ("/api/v1/chat", &chat_url),
        ("/api/v1/collab", &collab_url),
        ("/api/v1/meet", &meet_url),
        ("/api/v1/notifications", &notifications_url),
        ("/api/v1/billing", &billing_url),
        ("/api/v1/workforce", &workforce_url),
        ("/api/v1/contacts", &contacts_url),
        ("/api/v1/metrics", &metrics_url),
        ("/api/v1/media", &media_url),
        ("/api/v1/scheduler", &scheduler_url),
        ("/api/v1/securelink", &securelink_url),
        ("/api/v1/it-assets", &it_assets_url),
        // Containers service
        ("/api/v1/containers", &containers_url),
        ("/api/v1/images", &containers_url),
        ("/api/v1/networks", &containers_url),
        ("/api/v1/quotas", &containers_url),
        ("/api/v1/store", &containers_url),
        ("/api/v1/compose", &containers_url),
        // PXE service
        ("/api/v1/pxe", &pxe_url),
        // Vault service (extracted from identity — Refactor 3 Phase 5)
        ("/api/v1/vault", &vault_url),
        // Org service (extracted from identity — Refactor 34 Phase 5)
        ("/api/v1/org", &org_url),
        ("/api/v1/assignments", &org_url),
        // Webhooks service (extracted from identity — Refactor 34 Phase 6)
        ("/api/v1/webhooks", &webhooks_url),
        // Signatures service (extracted from identity — Refactor 34 Phase 6)
        ("/api/v1/signatures", &signatures_url),
        ("/api/v1/user-signatures", &signatures_url),
        // Tenant config service (extracted from identity — Refactor 34 Phase 6)
        // /api/v1/admin/tenants/:id/css routes are cleanly routed here.
        // Branding routes under /api/v1/tenants/:id/branding remain in identity
        // due to shared prefix with tenant CRUD — they are duplicated in tenant-config
        // for future migration when the gateway supports parameterized routing.
        ("/api/v1/admin/tenants", &tenant_config_url),
        // Feature flags (moved from identity — Refactor 34 Phase 9)
        ("/api/v1/admin/feature-flags", &tenant_config_url),
        // Workspace features GET (moved from identity — Refactor 34 Phase 9)
        // /api/v1/workspace (singular) → tenant-config; PUT /workspaces/:id/features stays in identity
        ("/api/v1/workspace/features", &tenant_config_url),
        // Storage supplemental paths
        ("/api/v1/drive", &storage_url),
        ("/api/v1/tags", &storage_url),
        // Accounting (extracted from identity — Refactor 34 Phase 3)
        ("/api/v1/accounting", &billing_url),
        // CRM + Persons (extracted from identity — Refactor 34 Phase 2)
        ("/api/v1/crm", &contacts_url),
        ("/api/v1/persons", &contacts_url),
        // Sites + Resources + Reservations (extracted from identity — Refactor 34 Phase 4)
        ("/api/v1/sites", &it_assets_url),
        ("/api/v1/resources", &it_assets_url),
        ("/api/v1/reservations", &it_assets_url),
        ("/api/v1/resource-types", &it_assets_url),
        // LMS + Supply Chain (extracted from identity — Refactor 34 Phase 4)
        ("/api/v1/lms", &workforce_url),
        ("/api/v1/supply-chain", &workforce_url),
        // Integrations service (extracted from identity — Refactor 34 Phase 7)
        ("/api/v1/integrations", &integrations_url),
        // Backup service (extracted from identity — Refactor 34 Phase 7)
        ("/api/v1/admin/backup", &backup_url),
        // Compliance service (extracted from identity — Refactor 34 Phase 7)
        ("/api/v1/compliance", &compliance_url),
        // Audit logs (moved from identity to compliance — Refactor 34 Phase 8)
        ("/api/v1/audit-logs", &compliance_url),
        ("/api/v1/audit", &compliance_url),
        // Activity feed (moved from identity to compliance — Refactor 34 Phase 9)
        ("/api/v1/activities", &compliance_url),
        ("/api/v1/activity", &compliance_url),
        // Gamification service (port 3033)
        ("/api/v1/gamification", &gamification_url),
        // Collaboration service (port 3034)
        ("/api/v1/collaboration", &collaboration_url),
        // Sharing engine — global routes (templates, audit, bulk-grant, shared-with-me).
        // Must appear BEFORE the identity catch-all so they are not swallowed by /api/v1.
        // Per-resource grant routes (/api/v1/files/:id/grants, etc.) are forwarded to the
        // service that owns the resource type (storage, calendar, docs…) via the
        // more-specific prefixes registered above.
        ("/api/v1/sharing", &storage_url),
        ("/api/v1/shared-with-me", &storage_url),
        // Identity catch-all: any /api/v1/* not matched above → identity
        ("/api/v1", &identity_url),
        // Health check fallback
        ("/health", &identity_url),
    ]));

    let gateway_port: u16 = env_or("GATEWAY_PORT", "3099").parse().unwrap_or(3099);

    // DA3: GraphQL gateway state (service URLs for resolvers)
    let graphql_state = Arc::new(graphql::ServiceUrls::from_env());

    // CORS for discovery endpoint (accessed directly from frontend on port 3000)
    let discover_cors = tower_http::cors::CorsLayer::new()
        .allow_origin(tower_http::cors::AllowOrigin::list([
            "http://localhost:3000"
                .parse()
                .expect("valid localhost origin"),
            "http://127.0.0.1:3000"
                .parse()
                .expect("valid localhost origin"),
        ]))
        .allow_methods([axum::http::Method::GET, axum::http::Method::OPTIONS])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
        ]);

    let app = Router::new()
        .route("/gateway/health", get(gateway_health))
        // Dynamic app discovery
        .route("/api/v1/apps/discover", get(discover_apps))
        // DA3: Minimal GraphQL gateway endpoint
        .route("/api/v1/graphql", post(graphql::graphql_handler).with_state(graphql_state.clone()))
        .route("/api/v1/graphql/schema", get(graphql::graphql_schema))
        .merge(openapi::swagger_router())
        .merge(signapps_common::version::router("signapps-gateway"))
        .layer(discover_cors)
        .fallback(any(proxy_handler))
        .with_state(service_map);

    let (shutdown_tx, _shutdown_rx) = watch::channel(false);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", gateway_port)).await?;
    tracing::info!("Gateway listening on port {}", gateway_port);

    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            tokio::signal::ctrl_c().await.ok();
            tracing::info!("Shutdown signal received");
            let _ = shutdown_tx.send(true);
        })
        .await?;

    tracing::info!("=== SignApps Gateway stopped ===");
    Ok(())
}
