use crate::models::signature::*;
use sqlx::PgPool;
use uuid::Uuid;

/// Repository for signature envelopes, steps, and transition records.
pub struct SignatureRepository {
    pool: PgPool,
}

impl SignatureRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_envelope(
        &self,
        created_by: Uuid,
        input: &CreateEnvelope,
    ) -> Result<SignatureEnvelope, sqlx::Error> {
        sqlx::query_as::<_, SignatureEnvelope>(
            r#"INSERT INTO signature.envelopes (id, title, document_id, created_by, expires_at, metadata)
               VALUES (gen_uuid_v7(), $1, $2, $3, $4, COALESCE($5, '{}'))
               RETURNING *"#,
        )
        .bind(&input.title)
        .bind(input.document_id)
        .bind(created_by)
        .bind(input.expires_at)
        .bind(&input.metadata)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn get_envelope(&self, id: Uuid) -> Result<Option<SignatureEnvelope>, sqlx::Error> {
        sqlx::query_as::<_, SignatureEnvelope>(
            "SELECT * FROM signature.envelopes WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn list_by_user(
        &self,
        user_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<SignatureEnvelope>, sqlx::Error> {
        sqlx::query_as::<_, SignatureEnvelope>(
            r#"SELECT * FROM signature.envelopes
               WHERE created_by = $1 AND deleted_at IS NULL
               ORDER BY created_at DESC LIMIT $2 OFFSET $3"#,
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn transition_envelope(
        &self,
        id: Uuid,
        to_status: EnvelopeStatus,
        triggered_by: Option<Uuid>,
        reason: Option<&str>,
    ) -> Result<SignatureEnvelope, String> {
        let envelope = self
            .get_envelope(id)
            .await
            .map_err(|e| format!("db error: {e}"))?
            .ok_or_else(|| "envelope not found".to_string())?;

        let from: EnvelopeStatus = envelope.status.parse()?;
        if !from.can_transition_to(to_status) {
            return Err(format!(
                "invalid transition: {} -> {}",
                from.as_str(),
                to_status.as_str()
            ));
        }

        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| format!("tx error: {e}"))?;

        sqlx::query("UPDATE signature.envelopes SET status = $1, updated_at = now() WHERE id = $2")
            .bind(to_status.as_str())
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("update error: {e}"))?;

        sqlx::query(
            r#"INSERT INTO signature.transitions (id, envelope_id, from_status, to_status, triggered_by, reason)
               VALUES (gen_uuid_v7(), $1, $2, $3, $4, $5)"#,
        )
        .bind(id)
        .bind(from.as_str())
        .bind(to_status.as_str())
        .bind(triggered_by)
        .bind(reason)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("transition log error: {e}"))?;

        tx.commit()
            .await
            .map_err(|e| format!("commit error: {e}"))?;

        self.get_envelope(id)
            .await
            .map_err(|e| format!("fetch error: {e}"))?
            .ok_or_else(|| "envelope disappeared".to_string())
    }

    pub async fn add_step(
        &self,
        envelope_id: Uuid,
        step_order: i16,
        input: &CreateStep,
    ) -> Result<EnvelopeStep, sqlx::Error> {
        sqlx::query_as::<_, EnvelopeStep>(
            r#"INSERT INTO signature.steps (id, envelope_id, step_order, signer_email, signer_user_id, signer_name, action)
               VALUES (gen_uuid_v7(), $1, $2, $3, $4, $5, COALESCE($6, 'sign'))
               RETURNING *"#,
        )
        .bind(envelope_id)
        .bind(step_order)
        .bind(&input.signer_email)
        .bind(input.signer_user_id)
        .bind(&input.signer_name)
        .bind(&input.action)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn get_steps(&self, envelope_id: Uuid) -> Result<Vec<EnvelopeStep>, sqlx::Error> {
        sqlx::query_as::<_, EnvelopeStep>(
            "SELECT * FROM signature.steps WHERE envelope_id = $1 ORDER BY step_order",
        )
        .bind(envelope_id)
        .fetch_all(&self.pool)
        .await
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn transition_step(
        &self,
        step_id: Uuid,
        to_status: StepStatus,
        triggered_by: Option<Uuid>,
        signature_hash: Option<&str>,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
        decline_reason: Option<&str>,
    ) -> Result<EnvelopeStep, String> {
        let step = sqlx::query_as::<_, EnvelopeStep>("SELECT * FROM signature.steps WHERE id = $1")
            .bind(step_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| format!("db error: {e}"))?
            .ok_or_else(|| "step not found".to_string())?;

        let from: StepStatus = step.status.parse()?;
        if !from.can_transition_to(to_status) {
            return Err(format!(
                "invalid step transition: {} -> {}",
                from.as_str(),
                to_status.as_str()
            ));
        }

        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| format!("tx error: {e}"))?;

        let signed_at = if to_status == StepStatus::Signed {
            Some(chrono::Utc::now())
        } else {
            None
        };

        sqlx::query(
            r#"UPDATE signature.steps
               SET status = $1, updated_at = now(), signed_at = COALESCE($2, signed_at),
                   signature_hash = COALESCE($3, signature_hash),
                   ip_address = COALESCE($4, ip_address),
                   user_agent = COALESCE($5, user_agent),
                   decline_reason = COALESCE($6, decline_reason)
               WHERE id = $7"#,
        )
        .bind(to_status.as_str())
        .bind(signed_at)
        .bind(signature_hash)
        .bind(ip_address)
        .bind(user_agent)
        .bind(decline_reason)
        .bind(step_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("update error: {e}"))?;

        sqlx::query(
            r#"INSERT INTO signature.transitions (id, envelope_id, step_id, from_status, to_status, triggered_by)
               VALUES (gen_uuid_v7(), $1, $2, $3, $4, $5)"#,
        )
        .bind(step.envelope_id)
        .bind(step_id)
        .bind(from.as_str())
        .bind(to_status.as_str())
        .bind(triggered_by)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("transition log error: {e}"))?;

        tx.commit()
            .await
            .map_err(|e| format!("commit error: {e}"))?;

        sqlx::query_as::<_, EnvelopeStep>("SELECT * FROM signature.steps WHERE id = $1")
            .bind(step_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| format!("fetch error: {e}"))
    }

    pub async fn get_transitions(
        &self,
        envelope_id: Uuid,
    ) -> Result<Vec<EnvelopeTransition>, sqlx::Error> {
        sqlx::query_as::<_, EnvelopeTransition>(
            "SELECT * FROM signature.transitions WHERE envelope_id = $1 ORDER BY created_at",
        )
        .bind(envelope_id)
        .fetch_all(&self.pool)
        .await
    }
}
