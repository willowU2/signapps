use crate::jmap;
use axum::{
    routing::{get, post},
    Router,
};

use crate::handlers::accounts::{
    create_account, delete_account, get_account, list_accounts, sync_account_now, test_account,
    update_account,
};
use crate::handlers::aliases::{
    create_alias, delete_alias, list_aliases, set_default_alias, update_alias,
};
use crate::handlers::categorize::{categorize_inbox, save_categorize_settings};
use crate::handlers::delegation::{create_delegation, list_delegations, revoke_delegation};
use crate::handlers::emails::{
    delete_email, get_email, list_attachments, list_emails, send_email, update_email,
};
use crate::handlers::folders::{get_folder, list_folders};
use crate::handlers::import_export::import_mbox;
use crate::handlers::labels::{create_label, delete_label, list_labels, update_label};
use crate::handlers::mailing_lists::{list_mailing_lists, mass_unsubscribe};
use crate::handlers::newsletter::send_newsletter;
use crate::handlers::pgp::{delete_pgp_config, get_pgp_config, upsert_pgp_config};
use crate::handlers::recurring::{
    create_recurring, delete_recurring, list_recurring, update_recurring,
};
use crate::handlers::rules::{create_rule, delete_rule, get_rule, list_rules, update_rule};
use crate::handlers::scheduled::cancel_send;
use crate::handlers::search::search_emails;
use crate::handlers::signatures::{get_signature, upsert_signature};
use crate::handlers::spam::{classify_email, get_spam_settings, train_spam, update_spam_settings};
use crate::handlers::stats::{get_stats, mail_analytics};
use crate::handlers::templates::{
    create_template, delete_template, get_template, list_templates, update_template,
};
use crate::handlers::threads::list_threads;
use crate::handlers::tracking::{list_tracking, tracking_stats};
use crate::AppState;

pub use crate::handlers::scheduled::process_scheduled_emails;

pub fn router() -> Router<AppState> {
    Router::new()
        // Accounts
        .route("/api/v1/mail/accounts", get(list_accounts).post(create_account))
        .route(
            "/api/v1/mail/accounts/:id",
            get(get_account).patch(update_account).delete(delete_account),
        )
        .route("/api/v1/mail/accounts/:id/sync", post(sync_account_now))
        .route("/api/v1/mail/accounts/:id/test", post(test_account))
        // Folders
        .route("/api/v1/mail/folders", get(list_folders))
        .route("/api/v1/mail/folders/:id", get(get_folder))
        // Emails
        .route("/api/v1/mail/emails", get(list_emails).post(send_email))
        .route(
            "/api/v1/mail/emails/:id",
            get(get_email).patch(update_email).delete(delete_email),
        )
        .route("/api/v1/mail/emails/:id/attachments", get(list_attachments))
        // Labels
        .route("/api/v1/mail/labels", get(list_labels).post(create_label))
        .route(
            "/api/v1/mail/labels/:id",
            patch(update_label).delete(delete_label),
        )
        // Signatures
        .route(
            "/api/v1/mail/signatures/me",
            get(get_signature).put(upsert_signature),
        )
        // Rules
        .route("/api/v1/mail/rules", get(list_rules).post(create_rule))
        .route(
            "/api/v1/mail/rules/:id",
            get(get_rule).put(update_rule).delete(delete_rule),
        )
        // Spam Filter
        .route("/api/v1/mail/spam/classify", post(classify_email))
        .route("/api/v1/mail/spam/train", post(train_spam))
        .route(
            "/api/v1/mail/spam/settings/:account_id",
            get(get_spam_settings).patch(update_spam_settings),
        )
        // Email templates — AQ-EMTPL
        .route(
            "/api/v1/mail/templates",
            get(list_templates).post(create_template),
        )
        .route(
            "/api/v1/mail/templates/:id",
            get(get_template).put(update_template).delete(delete_template),
        )
        // Search
        .route("/api/v1/mail/search", get(search_emails))
        // Stats
        .route("/api/v1/mail/stats", get(get_stats))
        // PGP config (public key + settings; private key stays client-side)
        .route(
            "/api/v1/mail/accounts/:account_id/pgp",
            get(get_pgp_config).put(upsert_pgp_config).delete(delete_pgp_config),
        )
        // Priority scoring (IDEA-107)
        .route(
            "/api/v1/mail/emails/:id/priority-score",
            axum::routing::post(crate::handlers::priority::score_single),
        )
        .route(
            "/api/v1/mail/priority-score/batch",
            axum::routing::post(crate::handlers::priority::score_batch),
        )
        // AI Inbox Categorization (Ideas #31 & #33)
        .route(
            "/api/v1/mail/emails/categorize",
            axum::routing::post(categorize_inbox),
        )
        .route(
            "/api/v1/mail/emails/categorize/settings",
            axum::routing::post(save_categorize_settings),
        )
        // Mailing lists — detection & mass unsubscribe
        .route(
            "/api/v1/mail/mailing-lists",
            get(list_mailing_lists),
        )
        .route(
            "/api/v1/mail/mailing-lists/unsubscribe",
            post(mass_unsubscribe),
        )
        // Newsletter send (IDEA-039)
        .route(
            "/api/v1/mail/newsletters/send",
            axum::routing::post(send_newsletter),
        )
        // OAuth provider routes (M7)
        .route("/api/v1/mail/oauth/google/login", axum::routing::get(crate::auth::oauth_google_login))
        .route(
            "/api/v1/mail/oauth/google/callback",
            axum::routing::post(crate::auth::oauth_google_callback),
        )
        .route(
            "/api/v1/mail/oauth/microsoft/login",
            axum::routing::get(crate::auth::oauth_microsoft_login),
        )
        .route(
            "/api/v1/mail/oauth/microsoft/callback",
            axum::routing::post(crate::auth::oauth_microsoft_callback),
        )
        // OAuth app config management (save/read Client ID & Secret from DB)
        .route(
            "/api/v1/mail/oauth/config/:platform",
            axum::routing::get(crate::auth::get_oauth_config)
                .post(crate::auth::save_oauth_config),
        )
        // Legacy routes (backward compat)
        .route("/oauth/google/login", axum::routing::get(crate::auth::oauth_google_login))
        .route(
            "/oauth/google/callback",
            axum::routing::post(crate::auth::oauth_google_callback),
        )
        .route(
            "/oauth/microsoft/login",
            axum::routing::get(crate::auth::oauth_microsoft_login),
        )
        .route(
            "/oauth/microsoft/callback",
            axum::routing::post(crate::auth::oauth_microsoft_callback),
        )
        // Recurring emails (IDEA-263)
        .route(
            "/api/v1/mail/emails/recurring",
            get(list_recurring).post(create_recurring),
        )
        .route(
            "/api/v1/mail/emails/recurring/:id",
            patch(update_recurring).delete(delete_recurring),
        )
        // Read tracking (IDEA-265) — authenticated endpoints
        .route("/api/v1/mail/emails/tracking", get(list_tracking))
        .route("/api/v1/mail/emails/tracking/stats", get(tracking_stats))
        // Email aliases (IDEA-261)
        .route(
            "/api/v1/mail/accounts/:id/aliases",
            get(list_aliases).post(create_alias),
        )
        .route(
            "/api/v1/mail/accounts/:id/aliases/:alias_id",
            patch(update_alias).delete(delete_alias),
        )
        .route(
            "/api/v1/mail/accounts/:id/aliases/:alias_id/set-default",
            post(set_default_alias),
        )
        // Email delegation (IDEA-264)
        .route(
            "/api/v1/mail/accounts/:id/delegations",
            get(list_delegations).post(create_delegation),
        )
        .route(
            "/api/v1/mail/accounts/:id/delegations/:delegation_id",
            axum::routing::delete(revoke_delegation),
        )
        // MG4: MBOX import
        .route("/api/v1/mail/import/mbox", post(import_mbox))
        // Analytics (IDEA-analytics)
        .route("/api/v1/mail/analytics", get(mail_analytics))
        // Thread grouping (IDEA-threads)
        .route("/api/v1/mail/threads", get(list_threads))
        // Undo-send: cancel a pending scheduled email
        .route("/api/v1/mail/emails/:id/cancel-send", post(cancel_send))
        // ── JMAP (RFC 8620/8621) endpoints ──────────────────────────────────
        .route("/.well-known/jmap", get(jmap::session::well_known))
        .route("/jmap", post(jmap::api::handle))
        .route("/jmap/upload/:account_id", post(jmap::api::upload))
        .route(
            "/jmap/download/:account_id/:blob_id/:name",
            get(jmap::api::download),
        )
        // Internal Stalwart Mail Server management
        .route(
            "/api/v1/mail/internal/status",
            get(crate::handlers::internal_server::get_status),
        )
        .route(
            "/api/v1/mail/internal/domains",
            get(crate::handlers::internal_server::list_domains),
        )
        .route(
            "/api/v1/mail/internal/accounts",
            get(crate::handlers::internal_server::list_accounts)
                .post(crate::handlers::internal_server::create_account),
        )
        .route(
            "/api/v1/mail/internal/accounts/:email",
            axum::routing::delete(crate::handlers::internal_server::delete_account),
        )
}

fn patch<H, T, S>(handler: H) -> axum::routing::MethodRouter<S>
where
    H: axum::handler::Handler<T, S>,
    T: 'static,
    S: Clone + Send + Sync + 'static,
{
    axum::routing::patch(handler)
}

#[allow(dead_code)]
fn put<H, T, S>(handler: H) -> axum::routing::MethodRouter<S>
where
    H: axum::handler::Handler<T, S>,
    T: 'static,
    S: Clone + Send + Sync + 'static,
{
    axum::routing::put(handler)
}
