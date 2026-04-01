/// OpenAPI documentation for signapps-social (port 3019).
use utoipa::{
    openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme},
    Modify, OpenApi,
};

pub struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearer",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            );
        }
    }
}

#[derive(OpenApi)]
#[openapi(
    paths(
        // ── Accounts ─────────────────────────────────────────────────────────
        crate::handlers::accounts::list_accounts,
        crate::handlers::accounts::create_account,
        crate::handlers::accounts::get_account,
        crate::handlers::accounts::update_account,
        crate::handlers::accounts::delete_account,
        crate::handlers::accounts::refresh_token,
        // ── Posts ────────────────────────────────────────────────────────────
        crate::handlers::posts::list_posts,
        crate::handlers::posts::create_post,
        crate::handlers::posts::get_post,
        crate::handlers::posts::update_post,
        crate::handlers::posts::delete_post,
        crate::handlers::posts::publish_post,
        crate::handlers::posts::schedule_post,
        crate::handlers::posts::submit_for_review,
        crate::handlers::posts::approve_post,
        crate::handlers::posts::reject_post,
        crate::handlers::posts::list_review_queue,
        // ── Inbox ────────────────────────────────────────────────────────────
        crate::handlers::inbox::list_inbox,
        crate::handlers::inbox::mark_read,
        crate::handlers::inbox::reply_inbox,
        // ── Analytics ────────────────────────────────────────────────────────
        crate::handlers::analytics::overview,
        crate::handlers::analytics::post_analytics,
        crate::handlers::analytics::followers_timeline,
        crate::handlers::analytics::by_platform,
        crate::handlers::analytics::top_posts,
        // ── Automation / RSS / Templates / AI ────────────────────────────────
        crate::handlers::automation::list_rss_feeds,
        crate::handlers::automation::create_rss_feed,
        crate::handlers::automation::delete_rss_feed,
        crate::handlers::automation::check_rss_feed_now,
        crate::handlers::automation::list_templates,
        crate::handlers::automation::create_template,
        crate::handlers::automation::update_template,
        crate::handlers::automation::delete_template,
        crate::handlers::automation::ai_generate,
        crate::handlers::automation::ai_hashtags,
        crate::handlers::automation::ai_best_time,
        crate::handlers::automation::ai_smart_replies,
        // ── Signatures ───────────────────────────────────────────────────────
        crate::handlers::signatures::list_signatures,
        crate::handlers::signatures::create_signature,
        crate::handlers::signatures::update_signature,
        crate::handlers::signatures::delete_signature,
        // ── Media ────────────────────────────────────────────────────────────
        crate::handlers::media::list_media,
        crate::handlers::media::create_media,
        crate::handlers::media::delete_media,
        // ── Short URLs ───────────────────────────────────────────────────────
        crate::handlers::short_urls::list_short_urls,
        crate::handlers::short_urls::create_short_url,
        crate::handlers::short_urls::track_click,
        crate::handlers::short_urls::delete_short_url,
        // ── Webhooks ─────────────────────────────────────────────────────────
        crate::handlers::webhooks::list_webhooks,
        crate::handlers::webhooks::create_webhook,
        crate::handlers::webhooks::update_webhook,
        crate::handlers::webhooks::delete_webhook,
        crate::handlers::webhooks::test_webhook,
        // ── Workspaces ───────────────────────────────────────────────────────
        crate::handlers::workspaces::list_workspaces,
        crate::handlers::workspaces::create_workspace,
        crate::handlers::workspaces::get_workspace,
        crate::handlers::workspaces::delete_workspace,
        crate::handlers::workspaces::list_members,
        crate::handlers::workspaces::invite_member,
        crate::handlers::workspaces::remove_member,
        // ── Post Comments ────────────────────────────────────────────────────
        crate::handlers::post_comments::list_comments,
        crate::handlers::post_comments::create_comment,
        crate::handlers::post_comments::delete_comment,
        // ── Time Slots ───────────────────────────────────────────────────────
        crate::handlers::time_slots::list_time_slots,
        crate::handlers::time_slots::create_time_slot,
        crate::handlers::time_slots::delete_time_slot,
        // ── Content Sets ─────────────────────────────────────────────────────
        crate::handlers::content_sets::list_content_sets,
        crate::handlers::content_sets::create_content_set,
        crate::handlers::content_sets::delete_content_set,
        // ── API Keys ─────────────────────────────────────────────────────────
        crate::handlers::api_keys::list_api_keys,
        crate::handlers::api_keys::create_api_key,
        crate::handlers::api_keys::revoke_api_key,
        // ── AI Threads ───────────────────────────────────────────────────────
        crate::handlers::ai_threads::list_ai_threads,
        crate::handlers::ai_threads::create_ai_thread,
        crate::handlers::ai_threads::get_ai_thread,
        crate::handlers::ai_threads::update_ai_thread,
        crate::handlers::ai_threads::delete_ai_thread,
    ),
    components(schemas(
        // Accounts
        crate::models::SocialAccount,
        crate::models::CreateAccountRequest,
        crate::models::UpdateAccountRequest,
        // Posts
        crate::models::Post,
        crate::models::CreatePostRequest,
        crate::models::UpdatePostRequest,
        crate::models::SchedulePostRequest,
        crate::models::ApproveRejectRequest,
        // Inbox
        crate::models::InboxItem,
        crate::models::ReplyRequest,
        // RSS Feeds
        crate::models::RssFeed,
        crate::models::CreateRssFeedRequest,
        // Templates
        crate::models::PostTemplate,
        crate::models::CreateTemplateRequest,
        // AI
        crate::models::AiGenerateRequest,
        crate::models::AiHashtagsRequest,
        crate::models::AiBestTimeRequest,
        // Signatures
        crate::models::Signature,
        crate::models::CreateSignatureRequest,
        crate::models::UpdateSignatureRequest,
        // Media
        crate::models::MediaItem,
        crate::models::CreateMediaRequest,
        // Short URLs
        crate::models::ShortUrl,
        crate::models::CreateShortUrlRequest,
        // Webhooks
        crate::models::Webhook,
        crate::models::CreateWebhookRequest,
        crate::models::UpdateWebhookRequest,
        // Workspaces
        crate::models::Workspace,
        crate::models::CreateWorkspaceRequest,
        crate::models::WorkspaceMember,
        crate::models::InviteMemberRequest,
        // Post Comments
        crate::models::PostComment,
        crate::models::CreatePostCommentRequest,
        // Time Slots
        crate::models::TimeSlot,
        crate::models::CreateTimeSlotRequest,
        // Content Sets
        crate::models::ContentSet,
        crate::models::CreateContentSetRequest,
        // API Keys
        crate::models::ApiKey,
        crate::models::CreateApiKeyRequest,
        // AI Threads
        crate::handlers::ai_threads::AiThread,
        crate::handlers::ai_threads::CreateAiThreadRequest,
        crate::handlers::ai_threads::UpdateAiThreadRequest,
    )),
    modifiers(&SecurityAddon),
    tags(
        (name = "Social Accounts", description = "Social media account management"),
        (name = "Social Posts", description = "Post creation, scheduling and approval workflow"),
        (name = "Social Inbox", description = "Unified inbox for comments and messages"),
        (name = "Social Analytics", description = "Engagement and performance analytics"),
        (name = "Social Automation", description = "RSS feeds, templates, and AI content generation"),
        (name = "Social Signatures", description = "Post signature management"),
        (name = "Social Media", description = "Media library management"),
        (name = "Social Short URLs", description = "Short URL creation and tracking"),
        (name = "Social Webhooks", description = "Outbound webhook management"),
        (name = "Social Workspaces", description = "Multi-user workspace management"),
        (name = "Social Post Comments", description = "Team review comments on posts"),
        (name = "Social Time Slots", description = "Scheduled posting time slots"),
        (name = "Social Content Sets", description = "Reusable content set management"),
        (name = "Social API Keys", description = "API key management"),
        (name = "Social AI Threads", description = "AI chat thread management"),
    ),
    info(
        title = "SignApps Social API",
        version = "1.0.0",
        description = "Social media management — multi-platform posting, analytics, automation, inbox"
    )
)]
pub struct SocialApiDoc;

pub fn swagger_router() -> utoipa_swagger_ui::SwaggerUi {
    utoipa_swagger_ui::SwaggerUi::new("/swagger-ui/{_:.*}")
        .url("/api-docs/openapi.json", SocialApiDoc::openapi())
}
