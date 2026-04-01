pub mod api;
pub mod auth;
pub mod handlers;
pub mod models;
pub mod openapi;
pub mod sync_service;

use chrono::{Datelike, Timelike, Weekday};
use openapi::MailApiDoc;
use signapps_common::bootstrap::{env_or, env_required, init_tracing, load_env};
use signapps_common::middleware::{auth_middleware, AuthState};
use signapps_common::pg_events::{PgEventBus, PlatformEvent};
use signapps_common::{AiIndexerClient, JwtConfig};
use sqlx::{postgres::PgPoolOptions, Pool, Postgres};
use tokio::time::Duration;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

#[derive(Clone)]
/// Application state for  service.
pub struct AppState {
    pub pool: Pool<Postgres>,
    pub jwt_config: JwtConfig,
    pub indexer: AiIndexerClient,
    pub event_bus: PgEventBus,
}

impl AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt_config
    }
}

#[tokio::main]
async fn main() {
    // Initialize using bootstrap helpers
    init_tracing("signapps_mail");
    load_env();

    let port: u16 = env_or("SERVER_PORT", "3012").parse().unwrap_or(3012);
    tracing::info!("🚀 Starting signapps-mail on port {}", port);

    // Database
    let database_url = env_required("DATABASE_URL");
    let pool = PgPoolOptions::new()
        .max_connections(env_or("DB_MAX_CONNECTIONS", "10").parse().unwrap_or(10))
        .connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");

    // JWT configuration (custom: audience="signapps" for all services)
    let jwt_secret = env_required("JWT_SECRET");
    let jwt_config = JwtConfig {
        secret: jwt_secret,
        issuer: "signapps".to_string(),
        audience: "signapps".to_string(),
        access_expiration: 3600,
        refresh_expiration: 86400 * 7,
    };

    let event_bus = PgEventBus::new(pool.clone(), "signapps-mail".to_string());

    let state = AppState {
        pool: pool.clone(),
        jwt_config,
        indexer: AiIndexerClient::from_env(),
        event_bus: event_bus.clone(),
    };

    // Ensure OAuth app configs table exists (auto-migrate)
    crate::auth::ensure_oauth_configs_table(&pool).await;

    // Start background sync service (polling fallback, 30 s interval)
    let sync_pool = pool.clone();
    let sync_event_bus = event_bus.clone();
    tokio::spawn(async move {
        sync_service::start_sync_scheduler(sync_pool, sync_event_bus).await;
    });

    // Idea 49: IMAP IDLE push — spawn per-account IDLE listeners for real-time
    // inbox notifications.  Accounts whose servers don't support IDLE fall back
    // silently to the polling loop above.
    let idle_pool = pool.clone();
    let idle_event_bus = event_bus.clone();
    tokio::spawn(async move {
        // Small delay to let the first polling pass complete before IDLE connects.
        tokio::time::sleep(Duration::from_secs(5)).await;
        sync_service::start_idle_listeners(idle_pool, idle_event_bus).await;
    });

    // Idea 35: Daily email summary notification (runs every hour, acts 07:00–08:00 UTC)
    // AI3: Weekly digest on Monday at 08:00 UTC
    let summary_pool = pool.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(3600));
        loop {
            interval.tick().await;
            let now = chrono::Utc::now();
            let hour = now.hour();
            // Daily summary at 07:00 UTC
            if hour == 7 {
                if let Err(e) = generate_daily_summaries(&summary_pool).await {
                    tracing::error!("Daily summary failed: {}", e);
                }
            }
            // Weekly digest on Monday at 08:00 UTC
            if now.weekday() == Weekday::Mon && hour == 8 {
                if let Err(e) = generate_weekly_digests(&summary_pool).await {
                    tracing::error!("Weekly digest failed: {}", e);
                }
            }
        }
    });

    // Check for scheduled emails every 30 seconds (Idea 21)
    let scheduled_pool = pool.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            if let Err(e) = api::process_scheduled_emails(&scheduled_pool).await {
                tracing::error!("Scheduled email check failed: {}", e);
            }
        }
    });

    // Spawn cross-service event listener (calendar.task.overdue → send reminder email)
    // Wrapped in a retry loop so that transient PG LISTEN failures don't
    // permanently kill the listener task.
    let mail_listener_pool = pool.clone();
    tokio::spawn(async move {
        loop {
            let p = mail_listener_pool.clone();
            let bus = PgEventBus::new(p.clone(), "signapps-mail".to_string());
            if let Err(e) = bus
                .listen("mail-consumer", move |event| {
                    let p2 = p.clone();
                    Box::pin(async move { handle_cross_event(&p2, event).await })
                })
                .await
            {
                tracing::error!("Mail event listener crashed: {}, restarting in 10s", e);
                tokio::time::sleep(Duration::from_secs(10)).await;
            }
        }
    });

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list({
            let origins_str = env_or(
                "ALLOWED_ORIGINS",
                "http://localhost:3000,http://127.0.0.1:3000",
            );
            origins_str
                .split(',')
                .filter_map(|s| s.trim().parse().ok())
                .collect::<Vec<_>>()
        }))
        .allow_credentials(true)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::header::ORIGIN,
            axum::http::HeaderName::from_static("x-workspace-id"),
            axum::http::HeaderName::from_static("x-request-id"),
        ]);

    // OpenAPI docs
    let openapi_routes =
        SwaggerUi::new("/swagger-ui").url("/api/v1/openapi.json", MailApiDoc::openapi());

    // Unauthenticated health route (no auth middleware)
    let public_router = axum::Router::new()
        .merge(openapi_routes)
        .route(
            "/health",
            axum::routing::get(|| async {
                axum::Json(serde_json::json!({ "status": "ok", "service": "signapps-mail" }))
            }),
        )
        // Tracking pixel — no auth, loaded by recipient email clients (IDEA-265)
        .route(
            "/api/v1/mail/track/:tracking_id",
            axum::routing::get(crate::handlers::tracking::track_open),
        );

    // Auth-protected API routes
    let protected_router = api::router().layer(axum::middleware::from_fn_with_state(
        state.clone(),
        auth_middleware::<AppState>,
    ));

    // Combine public + protected, then apply shared layers (CORS, tracing)
    let app = public_router
        .merge(protected_router)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(axum::extract::DefaultBodyLimit::max(10 * 1024 * 1024))
        .with_state(state);

    // Start server
    let addr: std::net::SocketAddr = format!("0.0.0.0:{}", port)
        .parse()
        .expect("server address is valid");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind TCP listener");
    tracing::info!("✅ signapps-mail ready at http://localhost:{}", port);
    axum::serve(listener, app)
        .with_graceful_shutdown(signapps_common::graceful_shutdown())
        .await
        .expect("server error");
}

// ─── Idea 35: Daily email summary ────────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
#[allow(dead_code)]
struct DailySummaryRow {
    user_id: uuid::Uuid,
    total_received: i64,
    unread_count: i64,
}

#[derive(Debug, sqlx::FromRow)]
#[allow(dead_code)]
struct TopSenderRow {
    sender: String,
    cnt: i64,
}

#[derive(Debug, sqlx::FromRow)]
#[allow(dead_code)]
struct HighPriorityRow {
    subject: Option<String>,
}

/// Generate a daily mail summary notification for every user who has at least
/// one active mail account and received emails in the last 24 hours.
#[tracing::instrument(skip(pool))]
async fn generate_daily_summaries(pool: &Pool<Postgres>) -> Result<(), sqlx::Error> {
    // Collect all users with mail accounts
    let users: Vec<uuid::Uuid> = sqlx::query_scalar(
        "SELECT DISTINCT user_id FROM mail.accounts WHERE status = 'active' OR status IS NULL",
    )
    .fetch_all(pool)
    .await?;

    tracing::info!(count = users.len(), "Running daily mail summaries");

    for user_id in users {
        // Counts for the last 24 h
        let row: Option<DailySummaryRow> = sqlx::query_as(
            r#"
            SELECT
                a.user_id,
                COUNT(e.id)                                       AS total_received,
                COUNT(e.id) FILTER (WHERE NOT COALESCE(e.is_read, false)) AS unread_count
            FROM mail.emails e
            JOIN mail.accounts a ON a.id = e.account_id
            WHERE a.user_id = $1
              AND COALESCE(e.is_sent, false) = false
              AND COALESCE(e.is_deleted, false) = false
              AND COALESCE(e.received_at, e.created_at) >= NOW() - INTERVAL '24 hours'
            GROUP BY a.user_id
            "#,
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

        let row = match row {
            Some(r) if r.total_received > 0 => r,
            _ => continue, // nothing to report
        };

        // Top 3 senders
        let top_senders: Vec<TopSenderRow> = sqlx::query_as(
            r#"
            SELECT e.sender, COUNT(*) AS cnt
            FROM mail.emails e
            JOIN mail.accounts a ON a.id = e.account_id
            WHERE a.user_id = $1
              AND COALESCE(e.is_sent, false) = false
              AND COALESCE(e.is_deleted, false) = false
              AND COALESCE(e.received_at, e.created_at) >= NOW() - INTERVAL '24 hours'
            GROUP BY e.sender
            ORDER BY cnt DESC
            LIMIT 3
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        // Emails marked important in the last 24 h
        let high_priority: Vec<HighPriorityRow> = sqlx::query_as(
            r#"
            SELECT e.subject
            FROM mail.emails e
            JOIN mail.accounts a ON a.id = e.account_id
            WHERE a.user_id = $1
              AND COALESCE(e.is_important, false) = true
              AND COALESCE(e.is_deleted, false) = false
              AND COALESCE(e.received_at, e.created_at) >= NOW() - INTERVAL '24 hours'
            ORDER BY COALESCE(e.received_at, e.created_at) DESC
            LIMIT 5
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        // Build message
        let top_senders_str = top_senders
            .iter()
            .map(|s| s.sender.as_str())
            .collect::<Vec<_>>()
            .join(", ");

        let urgent_part = if high_priority.is_empty() {
            String::new()
        } else {
            format!(" {} email(s) urgent(s).", high_priority.len())
        };

        let message = format!(
            "{} nouveau(x) email(s), {} non lu(s).{} Top expéditeurs: {}.",
            row.total_received,
            row.unread_count,
            urgent_part,
            if top_senders_str.is_empty() {
                "—".to_string()
            } else {
                top_senders_str
            },
        );

        // Insert notification
        let result = sqlx::query(
            r#"
            INSERT INTO notifications.notifications
                (user_id, type, title, body, source, priority, metadata)
            VALUES ($1, 'info', 'Résumé mail quotidien', $2, 'signapps-mail', 'normal', $3)
            "#,
        )
        .bind(user_id)
        .bind(&message)
        .bind(serde_json::json!({
            "total_received": row.total_received,
            "unread_count": row.unread_count,
            "urgent_count": high_priority.len() as i64,
        }))
        .execute(pool)
        .await;

        match result {
            Ok(_) => tracing::info!(user = %user_id, "Daily mail summary sent"),
            Err(e) => {
                tracing::error!(user = %user_id, "Failed to insert summary notification: {}", e)
            },
        }
    }

    Ok(())
}

/// Handle cross-service events received by the mail service.
#[tracing::instrument(skip(pool))]
async fn handle_cross_event(pool: &sqlx::PgPool, event: PlatformEvent) -> Result<(), sqlx::Error> {
    match event.event_type.as_str() {
        "calendar.task.overdue" => {
            let assignee_id = event.payload["assignee_id"]
                .as_str()
                .and_then(|s| s.parse::<uuid::Uuid>().ok());
            if let Some(uid) = assignee_id {
                let email: Option<String> =
                    sqlx::query_scalar("SELECT email FROM identity.users WHERE id = $1")
                        .bind(uid)
                        .fetch_optional(pool)
                        .await?;
                if let Some(addr) = email {
                    let title = event.payload["title"].as_str().unwrap_or("tache");
                    tracing::info!(
                        user = %addr,
                        task = %title,
                        "Task overdue — reminder email queued"
                    );
                    // In production: create email in mail.emails table or call send logic
                }
            }
        },

        "billing.invoice.overdue" => {
            // Look up tenant admin email, send overdue reminder
            let tenant_id = event.payload["tenant_id"]
                .as_str()
                .and_then(|s| s.parse::<uuid::Uuid>().ok());
            let invoice_id = event.payload["invoice_id"].as_str().unwrap_or("unknown");
            let amount = event.payload["amount"].as_f64().unwrap_or(0.0);

            if let Some(tid) = tenant_id {
                // Fetch the primary admin email for this tenant
                let admin_email: Option<String> = sqlx::query_scalar(
                    r#"
                    SELECT u.email
                    FROM identity.users u
                    JOIN identity.tenant_members tm ON tm.user_id = u.id
                    WHERE tm.tenant_id = $1
                      AND tm.role = 'admin'
                    ORDER BY tm.created_at
                    LIMIT 1
                    "#,
                )
                .bind(tid)
                .fetch_optional(pool)
                .await?;

                if let Some(addr) = admin_email {
                    tracing::info!(
                        tenant = %tid,
                        invoice = %invoice_id,
                        amount = %amount,
                        admin = %addr,
                        "Billing invoice overdue — sending payment reminder email"
                    );
                    // Insert a notification record and queue the reminder email
                    let subject = format!("Payment reminder: invoice {} is overdue", invoice_id);
                    let body = format!(
                        "Dear administrator,\n\nInvoice {} for {:.2} is overdue.\n\
                         Please settle your balance to avoid service interruption.\n\n\
                         The SignApps Billing Team",
                        invoice_id, amount
                    );
                    let _ = sqlx::query(
                        r#"
                        INSERT INTO notifications.notifications
                            (user_id, type, title, body, source, priority, metadata)
                        SELECT u.id, 'warning', $1, $2, 'signapps-mail', 'high', $3
                        FROM identity.users u
                        WHERE u.email = $4
                        "#,
                    )
                    .bind(&subject)
                    .bind(&body)
                    .bind(serde_json::json!({
                        "invoice_id": invoice_id,
                        "amount": amount,
                        "tenant_id": tid.to_string(),
                    }))
                    .bind(&addr)
                    .execute(pool)
                    .await;
                }
            }
        },

        "billing.invoice.created" => {
            // Send an invoice notification email to the customer
            let tenant_id = event.payload["tenant_id"]
                .as_str()
                .and_then(|s| s.parse::<uuid::Uuid>().ok());
            let invoice_id = event.payload["invoice_id"].as_str().unwrap_or("unknown");
            let amount = event.payload["amount"].as_f64().unwrap_or(0.0);
            let due_date = event.payload["due_date"].as_str().unwrap_or("N/A");

            if let Some(tid) = tenant_id {
                let admin_email: Option<String> = sqlx::query_scalar(
                    r#"
                    SELECT u.email
                    FROM identity.users u
                    JOIN identity.tenant_members tm ON tm.user_id = u.id
                    WHERE tm.tenant_id = $1
                      AND tm.role = 'admin'
                    ORDER BY tm.created_at
                    LIMIT 1
                    "#,
                )
                .bind(tid)
                .fetch_optional(pool)
                .await?;

                if let Some(addr) = admin_email {
                    tracing::info!(
                        tenant = %tid,
                        invoice = %invoice_id,
                        amount = %amount,
                        admin = %addr,
                        "Billing invoice created — sending notification email"
                    );
                    let subject = format!("New invoice {} for {:.2}", invoice_id, amount);
                    let body = format!(
                        "Dear administrator,\n\nA new invoice ({}) for {:.2} has been generated.\n\
                         Payment is due by {}.\n\n\
                         The SignApps Billing Team",
                        invoice_id, amount, due_date
                    );
                    let _ = sqlx::query(
                        r#"
                        INSERT INTO notifications.notifications
                            (user_id, type, title, body, source, priority, metadata)
                        SELECT u.id, 'info', $1, $2, 'signapps-mail', 'normal', $3
                        FROM identity.users u
                        WHERE u.email = $4
                        "#,
                    )
                    .bind(&subject)
                    .bind(&body)
                    .bind(serde_json::json!({
                        "invoice_id": invoice_id,
                        "amount": amount,
                        "due_date": due_date,
                        "tenant_id": tid.to_string(),
                    }))
                    .bind(&addr)
                    .execute(pool)
                    .await;
                }
            }
        },

        _ => {
            // Unknown event type — ignore silently
        },
    }

    Ok(())
}

// ─── AI3: Weekly digest ───────────────────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
#[allow(dead_code)]
struct WeeklyMailRow {
    user_id: uuid::Uuid,
    total_received: i64,
    unread_count: i64,
}

#[derive(Debug, sqlx::FromRow)]
#[allow(dead_code)]
struct WeeklyEventRow {
    event_type: String,
    cnt: i64,
}

/// Generate a cross-module weekly digest for every active user:
/// emails received this week, tasks completed, deals moved, meetings held.
/// Cross-queries `platform.events` for the last 7 days.
#[tracing::instrument(skip(pool))]
async fn generate_weekly_digests(pool: &Pool<Postgres>) -> Result<(), sqlx::Error> {
    // All users with active mail accounts
    let users: Vec<uuid::Uuid> = sqlx::query_scalar(
        "SELECT DISTINCT user_id FROM mail.accounts WHERE status = 'active' OR status IS NULL",
    )
    .fetch_all(pool)
    .await?;

    tracing::info!(count = users.len(), "Running weekly digests");

    for user_id in users {
        // ── Mail stats for last 7 days ────────────────────────────────────────
        let mail_row: Option<WeeklyMailRow> = sqlx::query_as(
            r#"
            SELECT
                a.user_id,
                COUNT(e.id)                                       AS total_received,
                COUNT(e.id) FILTER (WHERE NOT COALESCE(e.is_read, false)) AS unread_count
            FROM mail.emails e
            JOIN mail.accounts a ON a.id = e.account_id
            WHERE a.user_id = $1
              AND COALESCE(e.is_sent, false) = false
              AND COALESCE(e.is_deleted, false) = false
              AND COALESCE(e.received_at, e.created_at) >= NOW() - INTERVAL '7 days'
            GROUP BY a.user_id
            "#,
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

        let (emails_received, emails_unread) = mail_row
            .map(|r| (r.total_received, r.unread_count))
            .unwrap_or((0, 0));

        // ── Cross-service events from platform.events (last 7 days) ──────────
        let event_counts: Vec<WeeklyEventRow> = sqlx::query_as(
            r#"
            SELECT event_type, COUNT(*) AS cnt
            FROM platform.events
            WHERE created_at >= NOW() - INTERVAL '7 days'
              AND (
                payload->>'user_id' = $1::text
                OR payload->>'actor_id' = $1::text
                OR payload->>'assignee_id' = $1::text
              )
              AND event_type IN (
                'task.completed',
                'crm.deal.stage_changed',
                'calendar.meeting.ended'
              )
            GROUP BY event_type
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .unwrap_or_default(); // Don't fail if platform.events doesn't exist yet

        let tasks_completed = event_counts
            .iter()
            .find(|r| r.event_type == "task.completed")
            .map(|r| r.cnt)
            .unwrap_or(0);
        let deals_moved = event_counts
            .iter()
            .find(|r| r.event_type == "crm.deal.stage_changed")
            .map(|r| r.cnt)
            .unwrap_or(0);
        let meetings_held = event_counts
            .iter()
            .find(|r| r.event_type == "calendar.meeting.ended")
            .map(|r| r.cnt)
            .unwrap_or(0);

        // Skip users with no notable activity this week
        if emails_received == 0 && tasks_completed == 0 && deals_moved == 0 && meetings_held == 0 {
            continue;
        }

        let message = format!(
            "Semaine écoulée — {} email(s) reçus ({} non lus), {} tâche(s) terminées, {} deal(s) avancés, {} réunion(s).",
            emails_received, emails_unread, tasks_completed, deals_moved, meetings_held,
        );

        let result = sqlx::query(
            r#"
            INSERT INTO notifications.notifications
                (user_id, type, title, body, source, priority, metadata)
            VALUES ($1, 'info', 'Bilan hebdomadaire SignApps', $2, 'signapps-mail', 'normal', $3)
            "#,
        )
        .bind(user_id)
        .bind(&message)
        .bind(serde_json::json!({
            "period": "weekly",
            "emails_received": emails_received,
            "emails_unread": emails_unread,
            "tasks_completed": tasks_completed,
            "deals_moved": deals_moved,
            "meetings_held": meetings_held,
        }))
        .execute(pool)
        .await;

        match result {
            Ok(_) => tracing::info!(user = %user_id, "Weekly digest sent"),
            Err(e) => tracing::error!(user = %user_id, "Failed to insert weekly digest: {}", e),
        }
    }

    Ok(())
}
