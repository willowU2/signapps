use uuid::Uuid;

/// Append a row to `platform.activities` — fire-and-forget, never fails the request.
pub async fn log_mail_activity(
    pool: &sqlx::PgPool,
    actor_id: Uuid,
    action: &str,
    entity_id: Uuid,
    entity_title: &str,
) {
    let _ = sqlx::query(
        r#"INSERT INTO platform.activities
           (id, actor_id, action, entity_type, entity_id, entity_title, metadata, workspace_id)
           VALUES (gen_uuid_v7(), $1, $2, 'mail_message', $3, $4, '{}', NULL)"#,
    )
    .bind(actor_id)
    .bind(action)
    .bind(entity_id)
    .bind(entity_title)
    .execute(pool)
    .await;
}
