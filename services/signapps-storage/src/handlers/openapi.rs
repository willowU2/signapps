//! OpenAPI 3.1 spec — code-first via utoipa.
//!
//! `StorageApiDoc` derives `OpenApi` and collects all annotated paths and schemas.
//! The spec is served at `GET /api/v1/openapi.json` and Swagger UI at `/swagger-ui/`.

use utoipa::OpenApi;

/// Top-level OpenAPI document for the Storage service.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "SignApps Storage Service",
        version = "1.0.0",
        description = "File storage, Drive VFS, RAID management, and NAS features for the SignApps Platform.",
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0"),
    ),
    servers(
        (url = "http://localhost:3004", description = "Local development"),
    ),
    paths(
        // Health
        crate::handlers::health::health_check,
        // Buckets
        crate::handlers::buckets::list,
        crate::handlers::buckets::get,
        crate::handlers::buckets::create,
        crate::handlers::buckets::delete,
        // Files
        crate::handlers::files::list,
        crate::handlers::files::get_info,
        crate::handlers::files::download,
        crate::handlers::files::upload,
        crate::handlers::files::upload_with_key,
        crate::handlers::files::delete,
        crate::handlers::files::delete_many,
        crate::handlers::files::copy,
        crate::handlers::files::move_file,
        // Drive VFS
        crate::handlers::drive::create_node,
        crate::handlers::drive::update_node,
        crate::handlers::drive::delete_node,
        // Drive ACL
        crate::handlers::acl::list_acl,
        crate::handlers::acl::create_acl,
        crate::handlers::acl::update_acl,
        crate::handlers::acl::delete_acl,
        crate::handlers::acl::break_inheritance,
        crate::handlers::acl::restore_inheritance,
        crate::handlers::acl::effective_acl,
        // Shares
        crate::handlers::shares::create_share,
        crate::handlers::shares::list_shares,
        crate::handlers::shares::get_share,
        crate::handlers::shares::update_share,
        crate::handlers::shares::delete_share,
        crate::handlers::shares::access_share,
        crate::handlers::shares::download_shared,
        // Trash
        crate::handlers::trash::move_to_trash,
        crate::handlers::trash::list_trash,
        crate::handlers::trash::get_trash_stats,
        crate::handlers::trash::restore_from_trash,
        crate::handlers::trash::empty_trash,
        crate::handlers::trash::get_trash_item,
        crate::handlers::trash::delete_trash_item_handler,
        // Favorites
        crate::handlers::favorites::add_favorite,
        crate::handlers::favorites::list_favorites,
        crate::handlers::favorites::get_favorite,
        crate::handlers::favorites::update_favorite,
        crate::handlers::favorites::remove_favorite,
        crate::handlers::favorites::remove_favorite_by_path,
        crate::handlers::favorites::reorder_favorites,
        crate::handlers::favorites::check_favorite,
        // Search
        crate::handlers::search::search,
        crate::handlers::search::quick_search,
        crate::handlers::search::recent_files,
        crate::handlers::search::suggest,
        crate::handlers::search::omni_search,
        // Quotas
        crate::handlers::quotas::get_my_quota,
        crate::handlers::quotas::get_user_quota,
        crate::handlers::quotas::set_user_quota,
        crate::handlers::quotas::delete_user_quota,
        crate::handlers::quotas::get_quota_alerts,
        crate::handlers::quotas::recalculate_usage,
        crate::handlers::quotas::get_users_over_quota,
        // Permissions
        crate::handlers::permissions::get_permissions,
        crate::handlers::permissions::set_permissions,
        crate::handlers::permissions::reset_permissions,
        // Stats
        crate::handlers::stats::get_stats,
        // Mounts
        crate::handlers::mounts::list_mounts,
        crate::handlers::mounts::mount,
        crate::handlers::mounts::unmount,
        // External storage
        crate::handlers::external::list_external,
        crate::handlers::external::connect_external,
        crate::handlers::external::disconnect_external,
        // RAID arrays
        crate::handlers::raid::list_arrays,
        crate::handlers::raid::get_array,
        crate::handlers::raid::get_array_by_name,
        crate::handlers::raid::delete_array,
        crate::handlers::raid::list_disks,
        crate::handlers::raid::get_disk,
        crate::handlers::raid::scan_disks,
        crate::handlers::raid::list_events,
        crate::handlers::raid::get_array_events,
        crate::handlers::raid::get_health,
        crate::handlers::raid::rebuild_array,
        crate::handlers::raid::add_disk_to_array,
        crate::handlers::raid::remove_disk_from_array,
        // Audit
        crate::handlers::audit::list_audit,
        crate::handlers::audit::verify_chain,
        crate::handlers::audit::export_audit,
        crate::handlers::audit::list_alerts,
        crate::handlers::audit::get_alert_config,
        crate::handlers::audit::update_alert_config,
        // Storage settings
        crate::handlers::storage_settings::list_storage_rules,
        crate::handlers::storage_settings::create_storage_rule,
        crate::handlers::storage_settings::update_storage_rule,
        crate::handlers::storage_settings::delete_storage_rule,
        crate::handlers::storage_settings::list_indexing_rules,
        crate::handlers::storage_settings::create_indexing_rule,
        crate::handlers::storage_settings::update_indexing_rule,
        crate::handlers::storage_settings::delete_indexing_rule,
        crate::handlers::storage_settings::get_system_setting,
        crate::handlers::storage_settings::update_system_setting,
        // Backups
        crate::handlers::backups::list_plans,
        crate::handlers::backups::create_plan,
        crate::handlers::backups::update_plan,
        crate::handlers::backups::delete_plan,
        crate::handlers::backups::run_plan,
        crate::handlers::backups::list_snapshots,
        crate::handlers::backups::get_snapshot,
        crate::handlers::backups::delete_snapshot,
        crate::handlers::backups::restore,
        // Tags
        crate::handlers::tags::list_tags,
        crate::handlers::tags::create_tag,
        crate::handlers::tags::update_tag,
        crate::handlers::tags::delete_tag,
        crate::handlers::tags::list_file_tags,
        crate::handlers::tags::add_file_tag,
        crate::handlers::tags::remove_file_tag,
        // Versions
        crate::handlers::versions::list_versions,
        crate::handlers::versions::restore_version,
        // Preview
        crate::handlers::preview::get_thumbnail,
        crate::handlers::preview::generate_preview,
        crate::handlers::preview::get_preview,
        crate::handlers::preview::get_preview_info,
        crate::handlers::preview::get_archive_listing,
        crate::handlers::preview::get_document_metadata,
        // WebDAV config
        crate::handlers::webdav::get_webdav_config,
        crate::handlers::webdav::update_webdav_config,
    ),
    components(
        schemas(
            // Health
            crate::handlers::health::HealthResponse,
            // Bucket schemas
            crate::handlers::buckets::CreateBucketRequest,
            crate::handlers::buckets::BucketResponse,
            // File schemas
            crate::handlers::files::UploadResponse,
            crate::handlers::files::DeleteFilesRequest,
            // Share schemas
            crate::handlers::shares::ShareLink,
            crate::handlers::shares::ShareAccessType,
            crate::handlers::shares::CreateShareRequest,
            crate::handlers::shares::CreateShareResponse,
            crate::handlers::shares::UpdateShareRequest,
            crate::handlers::shares::ListSharesResponse,
            crate::handlers::shares::AccessShareRequest,
            crate::handlers::shares::AccessShareResponse,
            // Trash schemas
            crate::handlers::trash::TrashItem,
            crate::handlers::trash::MoveToTrashRequest,
            crate::handlers::trash::MoveToTrashResponse,
            crate::handlers::trash::TrashFailure,
            crate::handlers::trash::RestoreRequest,
            crate::handlers::trash::RestoreDestination,
            crate::handlers::trash::RestoreResponse,
            crate::handlers::trash::RestoredItem,
            crate::handlers::trash::RestoreFailure,
            crate::handlers::trash::ListTrashResponse,
            crate::handlers::trash::TrashStats,
            // Favorites schemas
            crate::handlers::favorites::Favorite,
            crate::handlers::favorites::AddFavoriteRequest,
            crate::handlers::favorites::UpdateFavoriteRequest,
            crate::handlers::favorites::ReorderFavoritesRequest,
            crate::handlers::favorites::ListFavoritesResponse,
            crate::handlers::favorites::FavoriteWithInfo,
            // Search schemas
            crate::handlers::search::SearchResponse,
            crate::handlers::search::QuickSearchResponse,
            crate::handlers::search::OmniSearchResponse,
            // Quota schemas
            crate::handlers::quotas::QuotaUsage,
            crate::handlers::quotas::UsageInfo,
            crate::handlers::quotas::BucketUsage,
            crate::handlers::quotas::QuotaAlert,
            crate::handlers::quotas::QuotaAlertType,
            crate::handlers::quotas::SetQuotaRequest,
            // Permissions schemas
            crate::handlers::permissions::FilePermissions,
            crate::handlers::permissions::SetPermissionsRequest,
            crate::handlers::permissions::PermissionsResponse,
            // Stats schemas
            crate::handlers::stats::StorageStatsResponse,
            // Mount schemas
            crate::handlers::mounts::MountPoint,
            crate::handlers::mounts::MountRequest,
            crate::handlers::mounts::MountResponse,
            // External storage schemas
            crate::handlers::external::ExternalStorageType,
            crate::handlers::external::ConnectionStatus,
            crate::handlers::external::ExternalStorage,
            crate::handlers::external::ConnectRequest,
            crate::handlers::external::ConnectOptions,
            crate::handlers::external::ConnectResponse,
            // RAID schemas
            crate::handlers::raid::ArrayResponse,
            crate::handlers::raid::DiskActionRequest,
            // Audit schemas
            crate::handlers::audit::UpdateAlertConfigRequest,
            // Storage settings schemas
            crate::handlers::storage_settings::StorageRule,
            crate::handlers::storage_settings::UpsertStorageRule,
            crate::handlers::storage_settings::IndexingRule,
            crate::handlers::storage_settings::UpsertIndexingRule,
            crate::handlers::storage_settings::SystemSetting,
            crate::handlers::storage_settings::UpsertSystemSetting,
            // Backup schemas
            crate::handlers::backups::SnapshotDetailResponse,
            crate::handlers::backups::RestoreResponse,
            // Preview schemas
            crate::handlers::preview::PreviewInfo,
            crate::handlers::preview::PreviewType,
        )
    ),
    tags(
        (name = "health", description = "Service health check"),
        (name = "buckets", description = "Object storage bucket management"),
        (name = "files", description = "File upload, download, and management"),
        (name = "drive", description = "Drive VFS — virtual filesystem nodes"),
        (name = "drive_acl", description = "Drive ACL — node-level access control"),
        (name = "shares", description = "Public share links"),
        (name = "trash", description = "Recycle bin — soft delete and restore"),
        (name = "favorites", description = "User favorites and bookmarks"),
        (name = "search", description = "Full-text and faceted search"),
        (name = "quotas", description = "Storage quota management"),
        (name = "permissions", description = "POSIX file permissions"),
        (name = "stats", description = "Aggregated storage statistics"),
        (name = "mounts", description = "Filesystem mount management"),
        (name = "external", description = "External storage connections (S3, SMB, etc.)"),
        (name = "raid", description = "RAID array and disk management"),
        (name = "audit", description = "Forensic audit log"),
        (name = "storage_settings", description = "Admin storage routing and indexing rules"),
        (name = "backups", description = "Backup plans, snapshots, and restore"),
        (name = "tags", description = "User-defined file tags"),
        (name = "versions", description = "File version history and restore"),
        (name = "preview", description = "Thumbnails, previews, and document metadata"),
        (name = "webdav", description = "WebDAV protocol configuration"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct StorageApiDoc;

/// Adds the Bearer JWT security scheme to the OpenAPI spec.
struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
            components.add_security_scheme(
                "bearerAuth",
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
