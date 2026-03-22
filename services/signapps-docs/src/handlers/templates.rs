use axum::{
    extract::Path,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

struct Template {
    id: &'static str,
    name: &'static str,
    category: &'static str,
    content: &'static str,
}

const DEFAULT_TEMPLATES: &[Template] = &[
    Template {
        id: "blank",
        name: "Document vierge",
        category: "general",
        content: "",
    },
    Template {
        id: "meeting-notes",
        name: "Notes de reunion",
        category: "business",
        content: "# Notes de Reunion\n\n**Date:** \n**Participants:** \n\n## Ordre du jour\n\n## Decisions\n\n## Actions",
    },
    Template {
        id: "invoice",
        name: "Facture",
        category: "business",
        content: "# Facture\n\n**Numero:** \n**Date:** \n**Echeance:** \n\n## Emetteur\n\n## Destinataire\n\n## Prestations\n\n| Description | Quantite | Prix unitaire | Total |\n|-------------|----------|---------------|-------|\n| | | | |\n\n**Total HT:** \n**TVA:** \n**Total TTC:** ",
    },
    Template {
        id: "report",
        name: "Rapport",
        category: "business",
        content: "# Rapport\n\n**Date:** \n**Auteur:** \n\n## Resume\n\n## Analyse\n\n## Conclusions\n\n## Recommandations",
    },
    Template {
        id: "cv",
        name: "Curriculum Vitae",
        category: "personal",
        content: "# [Nom]\n\n**Email:** | **Tel:** | **Localite:** \n\n## Experience\n\n### [Poste] — [Entreprise] (AAAA–AAAA)\n- \n\n## Formation\n\n### [Diplome] — [Etablissement] (AAAA)\n\n## Competences\n\n- ",
    },
];

#[derive(Serialize)]
pub struct TemplateSummary {
    pub id: &'static str,
    pub name: &'static str,
    pub category: &'static str,
}

#[derive(Serialize)]
pub struct TemplateDetail {
    pub id: &'static str,
    pub name: &'static str,
    pub category: &'static str,
    pub content: &'static str,
}

#[derive(Deserialize)]
pub struct CreateTemplateRequest {
    pub id: String,
    pub name: String,
    pub category: String,
    pub content: String,
}

/// GET /api/v1/docs/templates — list all templates with metadata
pub async fn list_templates() -> Json<Vec<TemplateSummary>> {
    let summaries: Vec<TemplateSummary> = DEFAULT_TEMPLATES
        .iter()
        .map(|t| TemplateSummary {
            id: t.id,
            name: t.name,
            category: t.category,
        })
        .collect();
    Json(summaries)
}

/// GET /api/v1/docs/templates/:id — get full template content
pub async fn get_template(
    Path(id): Path<String>,
) -> Result<Json<TemplateDetail>, (StatusCode, String)> {
    DEFAULT_TEMPLATES
        .iter()
        .find(|t| t.id == id.as_str())
        .map(|t| {
            Json(TemplateDetail {
                id: t.id,
                name: t.name,
                category: t.category,
                content: t.content,
            })
        })
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                format!("Template '{}' not found", id),
            )
        })
}

/// POST /api/v1/docs/templates — create a template (admin only, in-memory stub)
pub async fn create_template(
    Json(_payload): Json<CreateTemplateRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    // In-memory implementation: custom templates are not persisted between restarts.
    // A future iteration will store them in the database.
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({
            "error": "Persistent custom templates not yet supported. Use default templates.",
        })),
    )
}
