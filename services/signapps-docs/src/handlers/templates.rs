use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

struct BuiltinTemplate {
    id: &'static str,
    name: &'static str,
    category: &'static str,
    content: &'static str,
}

const DEFAULT_TEMPLATES: &[BuiltinTemplate] = &[
    BuiltinTemplate {
        id: "blank",
        name: "Document vierge",
        category: "general",
        content: "",
    },
    BuiltinTemplate {
        id: "meeting-notes",
        name: "Notes de reunion",
        category: "business",
        content: "# Notes de Reunion\n\n**Date:** \n**Participants:** \n\n## Ordre du jour\n\n## Decisions\n\n## Actions",
    },
    BuiltinTemplate {
        id: "invoice",
        name: "Facture",
        category: "business",
        content: "# Facture\n\n**Numero:** \n**Date:** \n**Echeance:** \n\n## Emetteur\n\n## Destinataire\n\n## Prestations\n\n| Description | Quantite | Prix unitaire | Total |\n|-------------|----------|---------------|-------|\n| | | | |\n\n**Total HT:** \n**TVA:** \n**Total TTC:** ",
    },
    BuiltinTemplate {
        id: "report",
        name: "Rapport",
        category: "business",
        content: "# Rapport\n\n**Date:** \n**Auteur:** \n\n## Resume\n\n## Analyse\n\n## Conclusions\n\n## Recommandations",
    },
    BuiltinTemplate {
        id: "cv",
        name: "Curriculum Vitae",
        category: "personal",
        content: "# [Nom]\n\n**Email:** | **Tel:** | **Localite:** \n\n## Experience\n\n### [Poste] — [Entreprise] (AAAA–AAAA)\n- \n\n## Formation\n\n### [Diplome] — [Etablissement] (AAAA)\n\n## Competences\n\n- ",
    },
    BuiltinTemplate {
        id: "quote",
        name: "Devis",
        category: "business",
        content: "# DEVIS\n\n**Devis No.:** [XXXX-2026]\n**Date:** [Date]\n**Validite:** 30 jours\n\n## De\n\n[Nom Entreprise]\n[Adresse]\n[Tel] | [Email]\nSIREN: [SIRET]\n\n## Client\n\n[Nom Client]\n[Adresse]\n[Contact]\n\n## Description des prestations\n\n| Prestation | Quantite | Unite | P.U. HT | Total HT |\n|-----------|----------|-------|--------|----------|\n| | | | | |\n\n**Total HT:** [Montant]\n**TVA (20%):** [Montant]\n**Total TTC:** [Montant]\n\n## Conditions\n\n- Validite: 30 jours\n- Delai de realisation: [X jours]\n- Conditions de paiement: Net [X jours]\n- Acompte requis: [X%]",
    },
];

// ---------------------------------------------------------------------------
// DB-backed custom template model
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, sqlx::FromRow)]
/// CustomTemplate data transfer object.
pub struct CustomTemplate {
    pub id: Uuid,
    pub slug: String,
    pub name: String,
    pub category: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize)]
/// TemplateSummary data transfer object.
pub struct TemplateSummary {
    pub id: String,
    pub name: String,
    pub category: String,
    pub builtin: bool,
}

#[derive(Serialize)]
/// TemplateDetail data transfer object.
pub struct TemplateDetail {
    pub id: String,
    pub name: String,
    pub category: String,
    pub content: String,
    pub builtin: bool,
}

#[derive(Deserialize)]
/// Request body for CreateTemplate.
pub struct CreateTemplateRequest {
    pub name: String,
    pub category: String,
    pub content: String,
}

/// GET /api/v1/docs/templates — list built-in + custom templates
#[tracing::instrument(skip_all)]
pub async fn list_templates(State(state): State<AppState>) -> Json<Vec<TemplateSummary>> {
    let mut summaries: Vec<TemplateSummary> = DEFAULT_TEMPLATES
        .iter()
        .map(|t| TemplateSummary {
            id: t.id.to_string(),
            name: t.name.to_string(),
            category: t.category.to_string(),
            builtin: true,
        })
        .collect();

    // Append DB-persisted custom templates
    let custom = sqlx::query_as::<_, CustomTemplate>(
        r#"SELECT id, slug, name, category, content, created_at
           FROM docs.custom_templates ORDER BY created_at ASC"#,
    )
    .fetch_all(state.pool.inner())
    .await;

    if let Ok(rows) = custom {
        for t in rows {
            summaries.push(TemplateSummary {
                id: t.id.to_string(),
                name: t.name,
                category: t.category,
                builtin: false,
            });
        }
    }

    Json(summaries)
}

/// GET /api/v1/docs/templates/:id — get full template content (built-in or custom)
#[tracing::instrument(skip_all)]
pub async fn get_template(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<TemplateDetail>, (StatusCode, String)> {
    // Check built-in first
    if let Some(t) = DEFAULT_TEMPLATES.iter().find(|t| t.id == id.as_str()) {
        return Ok(Json(TemplateDetail {
            id: t.id.to_string(),
            name: t.name.to_string(),
            category: t.category.to_string(),
            content: t.content.to_string(),
            builtin: true,
        }));
    }

    // Try UUID lookup in DB
    if let Ok(uuid) = id.parse::<Uuid>() {
        let row = sqlx::query_as::<_, CustomTemplate>(
            r#"SELECT id, slug, name, category, content, created_at
               FROM docs.custom_templates WHERE id = $1"#,
        )
        .bind(uuid)
        .fetch_optional(state.pool.inner())
        .await;

        if let Ok(Some(t)) = row {
            return Ok(Json(TemplateDetail {
                id: t.id.to_string(),
                name: t.name,
                category: t.category,
                content: t.content,
                builtin: false,
            }));
        }
    }

    // Try slug lookup
    let row = sqlx::query_as::<_, CustomTemplate>(
        r#"SELECT id, slug, name, category, content, created_at
           FROM docs.custom_templates WHERE slug = $1"#,
    )
    .bind(&id)
    .fetch_optional(state.pool.inner())
    .await;

    match row {
        Ok(Some(t)) => Ok(Json(TemplateDetail {
            id: t.id.to_string(),
            name: t.name,
            category: t.category,
            content: t.content,
            builtin: false,
        })),
        _ => Err((
            StatusCode::NOT_FOUND,
            format!("Template '{}' not found", id),
        )),
    }
}

/// POST /api/v1/docs/templates — create a custom template (persisted in DB)
#[tracing::instrument(skip_all)]
pub async fn create_template(
    State(state): State<AppState>,
    Json(payload): Json<CreateTemplateRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if payload.name.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "name is required" })),
        );
    }

    // Generate a URL-safe slug from the name
    let slug = payload
        .name
        .to_lowercase()
        .replace(|c: char| !c.is_alphanumeric(), "-")
        .trim_matches('-')
        .to_string();
    let slug = format!("{}-{}", slug, Uuid::new_v4().simple());

    let row = sqlx::query_as::<_, CustomTemplate>(
        r#"INSERT INTO docs.custom_templates (id, slug, name, category, content)
           VALUES (gen_random_uuid(), $1, $2, $3, $4)
           RETURNING id, slug, name, category, content, created_at"#,
    )
    .bind(&slug)
    .bind(&payload.name)
    .bind(&payload.category)
    .bind(&payload.content)
    .fetch_one(state.pool.inner())
    .await;

    match row {
        Ok(t) => (
            StatusCode::CREATED,
            Json(serde_json::json!({
                "id": t.id,
                "slug": t.slug,
                "name": t.name,
                "category": t.category,
                "content": t.content,
                "builtin": false,
                "created_at": t.created_at
            })),
        ),
        Err(e) => {
            tracing::error!("Failed to create custom template: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to create template" })),
            )
        },
    }
}

/// DELETE /api/v1/docs/templates/:id — delete a custom template
#[tracing::instrument(skip_all)]
pub async fn delete_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> (StatusCode, Json<serde_json::Value>) {
    let result = sqlx::query("DELETE FROM docs.custom_templates WHERE id = $1")
        .bind(id)
        .execute(state.pool.inner())
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => (StatusCode::NO_CONTENT, Json(serde_json::json!({}))),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Template not found" })),
        ),
        Err(e) => {
            tracing::error!("Failed to delete template: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to delete template" })),
            )
        },
    }
}
