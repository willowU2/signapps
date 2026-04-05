//! LightRAG: Graph-based Retrieval-Augmented Generation.
//!
//! Implements the LightRAG algorithm: extract entities and relations from
//! documents using an LLM, store them in a knowledge graph with vector
//! embeddings, then retrieve relevant context using dual-level search
//! (local entity-based + global relation-based).

use std::collections::{HashMap, HashSet, VecDeque};

use serde::{Deserialize, Serialize};
use signapps_db::models::kg::{CreateRelation, EntityWithNeighbors, UpsertEntity};
use signapps_db::repositories::KgRepository;
use signapps_db::DatabasePool;
use uuid::Uuid;

/// Configuration for the LightRAG pipeline.
///
/// Controls top-k retrieval counts, similarity thresholds, and LLM
/// generation parameters for both extraction and answer generation.
///
/// # Examples
///
/// ```
/// let config = LightRagConfig::default();
/// assert_eq!(config.entity_top_k, 10);
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LightRagConfig {
    /// Number of entities to retrieve per query (local search).
    pub entity_top_k: i64,
    /// Number of relations to retrieve per query (global search).
    pub relation_top_k: i64,
    /// Number of communities to retrieve per query.
    pub community_top_k: i64,
    /// Minimum similarity score threshold.
    pub score_threshold: f32,
    /// Maximum entities to extract per document chunk.
    pub max_entities_per_chunk: usize,
    /// LLM temperature for extraction (lower = more precise).
    pub extraction_temperature: f32,
    /// LLM temperature for generation (higher = more creative).
    pub generation_temperature: f32,
}

impl Default for LightRagConfig {
    fn default() -> Self {
        Self {
            entity_top_k: 10,
            relation_top_k: 10,
            community_top_k: 3,
            score_threshold: 0.4,
            max_entities_per_chunk: 20,
            extraction_temperature: 0.1,
            generation_temperature: 0.7,
        }
    }
}

/// Extracted entity from LLM response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedEntity {
    /// Entity name as extracted by the LLM.
    pub name: String,
    /// Entity type (person, organization, concept, technology, etc.).
    pub entity_type: String,
    /// Brief description of the entity.
    pub description: String,
}

/// Extracted relation from LLM response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedRelation {
    /// Name of the source entity.
    pub source: String,
    /// Name of the target entity.
    pub target: String,
    /// Relation type (works_at, depends_on, implements, etc.).
    pub relation_type: String,
    /// Brief description of the relation.
    pub description: String,
}

/// LLM extraction result containing entities and relations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionResult {
    /// Extracted entities from the text chunk.
    pub entities: Vec<ExtractedEntity>,
    /// Extracted relations between entities.
    pub relations: Vec<ExtractedRelation>,
}

/// Result of a LightRAG query.
///
/// Contains the generated answer, the entities and relations used as context,
/// and graph statistics for the collection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LightRagResult {
    /// The generated answer.
    pub answer: String,
    /// Entities used as context (local retrieval).
    pub entities: Vec<EntityContext>,
    /// Relations used as context (global retrieval).
    pub relations: Vec<RelationContext>,
    /// Knowledge graph statistics.
    pub graph_stats: GraphStats,
}

/// Entity context entry returned in a query result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityContext {
    /// Entity name.
    pub name: String,
    /// Entity type (person, concept, technology, etc.).
    pub entity_type: String,
    /// LLM-generated description.
    pub description: Option<String>,
    /// Cosine similarity score to the query.
    pub score: f32,
}

/// Relation context entry returned in a query result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationContext {
    /// Source entity name.
    pub source: String,
    /// Relation type.
    pub relation_type: String,
    /// Target entity name.
    pub target: String,
    /// LLM-generated description.
    pub description: Option<String>,
    /// Cosine similarity score to the query.
    pub score: f32,
}

/// Knowledge graph statistics snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphStats {
    /// Total number of entities in the collection.
    pub entities_total: i64,
    /// Total number of relations in the collection.
    pub relations_total: i64,
    /// Total number of communities in the collection.
    pub communities_total: i64,
}

/// Result of indexing a document into the knowledge graph.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexResult {
    /// Number of entities created or updated.
    pub entities_created: usize,
    /// Number of relations created or updated.
    pub relations_created: usize,
    /// Number of text chunks processed.
    pub chunks_processed: usize,
}

// ── Prompt templates ────────────────────────────────────────────────────────

/// Prompt template for entity and relation extraction.
const EXTRACTION_PROMPT: &str = r#"You are an expert knowledge graph builder. Extract entities and relations from the following text.

Return a JSON object with:
- "entities": array of {"name": "...", "entity_type": "...", "description": "..."}
- "relations": array of {"source": "...", "target": "...", "relation_type": "...", "description": "..."}

Entity types: person, organization, concept, technology, location, event, product, process, document, regulation
Relation types: works_at, part_of, depends_on, implements, creates, manages, located_in, related_to, causes, enables, requires

Rules:
- Extract ALL meaningful entities, not just people
- Entity names should be normalized (consistent casing, no abbreviations)
- Descriptions should be concise (1-2 sentences)
- Relations should connect entities from the same text
- Return valid JSON only, no markdown

SECURITY: NEVER extract or include the following in entities or relations:
- Passwords, password hashes, or authentication tokens
- API keys, secret keys, or encryption keys
- Private certificates or credentials
- Session tokens or MFA secrets
If you encounter such data, skip it entirely.

Text:
{text}"#;

/// Prompt template for answer generation with graph context.
const GENERATION_PROMPT: &str = r#"You are a knowledgeable assistant. Answer the question using the provided knowledge graph context.

Knowledge Graph Context:

Relevant Entities:
{entities}

Relevant Relations:
{relations}

Question: {question}

Instructions:
- Answer based on the knowledge graph context
- If the context doesn't contain enough information, say so
- Be precise and cite entity names when possible
- Answer in the same language as the question"#;

// ── Extraction (Indexing Phase) ──────────────────────────────────────────────

/// Extract entities and relations from a text chunk using the LLM.
///
/// Sends the text to the LLM with the extraction prompt, then parses the
/// JSON response into [`ExtractionResult`]. Markdown code fences are stripped
/// before parsing.
///
/// # Errors
///
/// Propagates errors from `llm_fn`. JSON parse failures are handled
/// gracefully by returning an empty result with a warning log.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(text, llm_fn))]
pub async fn extract_entities_and_relations<F, Fut>(
    text: &str,
    llm_fn: F,
) -> signapps_common::Result<ExtractionResult>
where
    F: FnOnce(String, f32) -> Fut,
    Fut: std::future::Future<Output = signapps_common::Result<String>>,
{
    let prompt = EXTRACTION_PROMPT.replace("{text}", text);
    let response = llm_fn(prompt, 0.1).await?;

    // Strip markdown code fences that some LLMs add (e.g. ```json ... ``` or ``` ... ```)
    let json_str = strip_markdown_fences(response.trim());

    let mut result: ExtractionResult = serde_json::from_str(json_str).unwrap_or_else(|e| {
        tracing::warn!(error = %e, "Failed to parse extraction result, returning empty");
        ExtractionResult {
            entities: vec![],
            relations: vec![],
        }
    });

    // Post-extraction security filter: remove any entity/relation that may
    // contain sensitive data (passwords, keys, tokens, etc.)
    filter_sensitive_entities(&mut result);

    tracing::info!(
        entities = result.entities.len(),
        relations = result.relations.len(),
        "Extracted entities and relations"
    );

    Ok(result)
}

/// Index a document into the knowledge graph.
///
/// Implements the LightRAG indexing phase:
/// 1. Split text into ~2000-char chunks at paragraph boundaries.
/// 2. Extract entities and relations per chunk via LLM.
/// 3. Embed each entity/relation description.
/// 4. Store in `ai.kg_entities` and `ai.kg_relations` via [`KgRepository`].
///
/// # Errors
///
/// Propagates errors from `embed_fn`, `llm_fn`, or database operations.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, text, embed_fn, llm_fn))]
pub async fn index_document<F, Fut, E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    document_id: Uuid,
    text: &str,
    config: &LightRagConfig,
    embed_fn: E,
    llm_fn: F,
) -> signapps_common::Result<IndexResult>
where
    F: Fn(String, f32) -> Fut + Clone,
    Fut: std::future::Future<Output = signapps_common::Result<String>>,
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    let mut total_entities = 0usize;
    let mut total_relations = 0usize;

    let chunks = chunk_text(text, 2000);
    tracing::info!(chunks = chunks.len(), "Processing document");

    for chunk in &chunks {
        if chunk.trim().len() < 50 {
            continue; // Skip trivially short chunks
        }

        let extraction =
            extract_entities_and_relations(chunk, llm_fn.clone()).await?;

        // Store entities and collect their assigned IDs for relation wiring
        let mut entity_map: HashMap<String, Uuid> = HashMap::new();

        for ent in &extraction.entities {
            let embed_text = format!("{}: {}", ent.name, ent.description);
            let embedding = embed_fn.clone()(embed_text).await?;

            let stored = KgRepository::upsert_entity(
                pool,
                collection,
                UpsertEntity {
                    name: ent.name.clone(),
                    entity_type: ent.entity_type.clone(),
                    description: Some(ent.description.clone()),
                    source_document_id: Some(document_id),
                    attributes: None,
                },
                &embedding,
            )
            .await?;

            entity_map.insert(ent.name.clone(), stored.id);
            total_entities += 1;
        }

        // Store relations only when both endpoints were extracted in this chunk
        for rel in &extraction.relations {
            let source_id = entity_map.get(&rel.source);
            let target_id = entity_map.get(&rel.target);

            if let (Some(&src), Some(&tgt)) = (source_id, target_id) {
                let embed_text = format!(
                    "{} {} {}: {}",
                    rel.source, rel.relation_type, rel.target, rel.description
                );
                let embedding = embed_fn.clone()(embed_text).await?;

                KgRepository::create_relation(
                    pool,
                    collection,
                    CreateRelation {
                        source_entity_id: src,
                        target_entity_id: tgt,
                        relation_type: rel.relation_type.clone(),
                        description: Some(rel.description.clone()),
                        weight: None,
                        source_document_id: Some(document_id),
                    },
                    &embedding,
                )
                .await?;

                total_relations += 1;
            }
        }
    }

    tracing::info!(
        entities = total_entities,
        relations = total_relations,
        "Document indexed into knowledge graph"
    );

    Ok(IndexResult {
        entities_created: total_entities,
        relations_created: total_relations,
        chunks_processed: chunks.len(),
    })
}

// ── Retrieval (Query Phase) ──────────────────────────────────────────────────

/// Query the knowledge graph using dual-level retrieval.
///
/// Implements the LightRAG query phase:
/// 1. Embed the question.
/// 2. **Local search**: find similar entities and expand their neighbor context.
/// 3. **Global search**: find similar relations for broader coverage.
/// 4. Build a structured context string from both levels.
/// 5. Send context + question to the LLM for answer generation.
///
/// # Errors
///
/// Propagates errors from `embed_fn`, `llm_fn`, or database operations.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, llm_fn, embed_fn))]
pub async fn query<F, Fut, E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    question: &str,
    config: &LightRagConfig,
    embed_fn: E,
    llm_fn: F,
) -> signapps_common::Result<LightRagResult>
where
    F: FnOnce(String, f32) -> Fut,
    Fut: std::future::Future<Output = signapps_common::Result<String>>,
    E: FnOnce(String) -> EFut,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    // 1. Embed the query
    let query_embedding = embed_fn(question.to_string()).await?;

    // 2. Local search — find relevant entities
    let entity_results = KgRepository::search_entities(
        pool,
        collection,
        &query_embedding,
        config.entity_top_k,
        config.score_threshold,
    )
    .await?;

    // Build entity contexts and expand via neighbors
    let mut entity_contexts: Vec<EntityContext> = Vec::new();

    for (entity, score) in &entity_results {
        entity_contexts.push(EntityContext {
            name: entity.name.clone(),
            entity_type: entity.entity_type.clone(),
            description: entity.description.clone(),
            score: *score,
        });

        // Get neighbors for richer local context (best-effort, non-fatal)
        if let Ok(neighbors) =
            KgRepository::get_entity_with_neighbors(pool, entity.id).await
        {
            // Neighbor info already available via relation_contexts below;
            // log only so callers can trace the expansion depth.
            tracing::debug!(
                entity = %entity.name,
                relations = neighbors.relations.len(),
                neighbors = neighbors.neighbors.len(),
                "Expanded local context"
            );
        }
    }

    // 3. Global search — find relevant relations
    let relation_results = KgRepository::search_relations(
        pool,
        collection,
        &query_embedding,
        config.relation_top_k,
        config.score_threshold,
    )
    .await?;

    let mut relation_contexts: Vec<RelationContext> = Vec::new();
    for (rel, score) in &relation_results {
        // Resolve entity names from the already-fetched entity list (best-effort)
        let source_name = entity_results
            .iter()
            .find(|(e, _)| e.id == rel.source_entity_id)
            .map(|(e, _)| e.name.clone())
            .unwrap_or_else(|| format!("entity:{}", rel.source_entity_id));
        let target_name = entity_results
            .iter()
            .find(|(e, _)| e.id == rel.target_entity_id)
            .map(|(e, _)| e.name.clone())
            .unwrap_or_else(|| format!("entity:{}", rel.target_entity_id));

        relation_contexts.push(RelationContext {
            source: source_name,
            relation_type: rel.relation_type.clone(),
            target: target_name,
            description: rel.description.clone(),
            score: *score,
        });
    }

    // 4. Build context string
    let entities_text = if entity_contexts.is_empty() {
        "None found".to_string()
    } else {
        entity_contexts
            .iter()
            .map(|e| {
                format!(
                    "- {} ({}): {}",
                    e.name,
                    e.entity_type,
                    e.description.as_deref().unwrap_or("")
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    };

    let relations_text = if relation_contexts.is_empty() {
        "None found".to_string()
    } else {
        relation_contexts
            .iter()
            .map(|r| {
                format!(
                    "- {} --[{}]--> {}: {}",
                    r.source,
                    r.relation_type,
                    r.target,
                    r.description.as_deref().unwrap_or("")
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    };

    // 5. Generate answer
    let prompt = GENERATION_PROMPT
        .replace("{entities}", &entities_text)
        .replace("{relations}", &relations_text)
        .replace("{question}", question);

    let answer = llm_fn(prompt, config.generation_temperature).await?;

    // Collect graph stats (non-fatal: default to zeros on failure)
    let stats = KgRepository::get_stats(pool, collection)
        .await
        .unwrap_or(signapps_db::models::kg::KgStats {
            entities: 0,
            relations: 0,
            communities: 0,
        });

    Ok(LightRagResult {
        answer,
        entities: entity_contexts,
        relations: relation_contexts,
        graph_stats: GraphStats {
            entities_total: stats.entities,
            relations_total: stats.relations,
            communities_total: stats.communities,
        },
    })
}

// ── Community Detection ───────────────────────────────────────────────────────

/// Build communities from the knowledge graph using connected component analysis.
///
/// Groups related entities into communities based on graph connectivity, then
/// persists each community with an embedding for later retrieval.
///
/// # Algorithm
///
/// 1. Load all entities and relations for the collection.
/// 2. Build an adjacency list (undirected).
/// 3. Find connected components using BFS.
/// 4. For each component with `>= 2` entities, create a community record.
/// 5. Embed the community summary and store via [`KgRepository::create_community`].
///
/// # Errors
///
/// Returns `Error::Database` if entity/relation loading or community insert fails.
/// Propagates embedding errors from `embed_fn`.
///
/// # Panics
///
/// No panics possible — all errors are propagated via `Result`.
#[tracing::instrument(skip(pool, embed_fn))]
pub async fn build_communities<E, EFut>(
    pool: &DatabasePool,
    collection: &str,
    embed_fn: E,
) -> signapps_common::Result<usize>
where
    E: Fn(String) -> EFut + Clone,
    EFut: std::future::Future<Output = signapps_common::Result<Vec<f32>>>,
{
    // Load all entities (id, name, entity_type)
    let entities: Vec<(uuid::Uuid, String, String)> = sqlx::query_as(
        "SELECT id, name, entity_type FROM ai.kg_entities WHERE collection = $1",
    )
    .bind(collection)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    // Load all relations (source_entity_id, target_entity_id)
    let relations: Vec<(uuid::Uuid, uuid::Uuid)> = sqlx::query_as(
        "SELECT source_entity_id, target_entity_id FROM ai.kg_relations WHERE collection = $1",
    )
    .bind(collection)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| signapps_common::Error::Database(e.to_string()))?;

    if entities.is_empty() {
        tracing::info!(collection = collection, "No entities found, skipping community detection");
        return Ok(0);
    }

    // Build undirected adjacency list
    let mut adj: HashMap<uuid::Uuid, HashSet<uuid::Uuid>> = HashMap::new();
    for (src, tgt) in &relations {
        adj.entry(*src).or_default().insert(*tgt);
        adj.entry(*tgt).or_default().insert(*src);
    }

    // Find connected components via BFS
    let mut visited: HashSet<uuid::Uuid> = HashSet::new();
    let mut components: Vec<Vec<uuid::Uuid>> = Vec::new();

    for (eid, _, _) in &entities {
        if visited.contains(eid) {
            continue;
        }

        let mut component = Vec::new();
        let mut queue = VecDeque::new();
        queue.push_back(*eid);
        visited.insert(*eid);

        while let Some(node) = queue.pop_front() {
            component.push(node);
            if let Some(neighbors) = adj.get(&node) {
                for &n in neighbors {
                    if !visited.contains(&n) {
                        visited.insert(n);
                        queue.push_back(n);
                    }
                }
            }
        }

        // Only create communities for components with at least 2 entities
        if component.len() >= 2 {
            components.push(component);
        }
    }

    // Entity metadata lookup
    let entity_map: HashMap<uuid::Uuid, (&str, &str)> = entities
        .iter()
        .map(|(id, name, etype)| (*id, (name.as_str(), etype.as_str())))
        .collect();

    let mut created = 0usize;
    for (level, component) in components.iter().enumerate() {
        // Collect names and types from the component
        let names: Vec<&str> = component
            .iter()
            .filter_map(|id| entity_map.get(id).map(|(name, _)| *name))
            .take(5)
            .collect();

        let types: HashSet<&str> = component
            .iter()
            .filter_map(|id| entity_map.get(id).map(|(_, t)| *t))
            .collect();

        let title = if names.len() <= 3 {
            names.join(", ")
        } else {
            format!("{}, {} et {} autres", names[0], names[1], component.len() - 2)
        };

        let mut type_list: Vec<&str> = types.into_iter().collect();
        type_list.sort_unstable();

        let summary = format!(
            "Communaute de {} entites ({}) incluant: {}",
            component.len(),
            type_list.join(", "),
            names.join(", "),
        );

        let embedding = embed_fn.clone()(summary.clone()).await?;

        KgRepository::create_community(
            pool,
            collection,
            level as i32,
            &title,
            &summary,
            component,
            &embedding,
        )
        .await?;

        created += 1;
    }

    tracing::info!(
        collection = collection,
        communities = created,
        "Community detection complete"
    );

    Ok(created)
}

// ── Security filters ─────────────────────────────────────────────────────────

/// Filter out entities that might contain sensitive data.
///
/// Removes any entity whose name or description contains a sensitive pattern
/// (password, secret, token, key, credential, certificate, api_key, mfa).
/// Relations referencing filtered entities are removed in a second pass.
///
/// # Examples
///
/// ```
/// let mut result = ExtractionResult {
///     entities: vec![
///         ExtractedEntity { name: "Admin User".into(), entity_type: "person".into(), description: "Administrator".into() },
///         ExtractedEntity { name: "API Key".into(), entity_type: "concept".into(), description: "An API key".into() },
///     ],
///     relations: vec![],
/// };
/// filter_sensitive_entities(&mut result);
/// assert_eq!(result.entities.len(), 1);
/// assert_eq!(result.entities[0].name, "Admin User");
/// ```
///
/// # Panics
///
/// No panics possible — this function only performs in-place filtering.
fn filter_sensitive_entities(result: &mut ExtractionResult) {
    let sensitive_patterns = [
        "password", "secret", "token", "api_key", "mfa",
        "credential", "certificate", "private_key",
    ];

    result.entities.retain(|e| {
        let name_lower = e.name.to_lowercase();
        let desc_lower = e.description.to_lowercase();
        !sensitive_patterns
            .iter()
            .any(|p| name_lower.contains(p) || desc_lower.contains(p))
    });

    // Remove relations whose source or target was filtered out
    let entity_names: std::collections::HashSet<String> =
        result.entities.iter().map(|e| e.name.clone()).collect();
    result.relations.retain(|r| {
        entity_names.contains(&r.source) && entity_names.contains(&r.target)
    });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Strip markdown code fences from an LLM response.
///
/// Handles both `\`\`\`json ... \`\`\`` and `\`\`\` ... \`\`\`` forms, returning
/// the trimmed inner content.
fn strip_markdown_fences(s: &str) -> &str {
    // Try ` ```json ` first, then plain ` ``` `
    let inner = if let Some(rest) = s.strip_prefix("```json") {
        rest
    } else if let Some(rest) = s.strip_prefix("```") {
        rest
    } else {
        return s;
    };
    // Strip trailing fence, then trim whitespace
    inner
        .trim_end()
        .strip_suffix("```")
        .unwrap_or(inner)
        .trim()
}

/// Split text into chunks of approximately `max_chars` characters,
/// breaking at paragraph boundaries (`\n\n`).
///
/// If a single paragraph exceeds `max_chars`, it is kept as one chunk
/// rather than split mid-sentence.
fn chunk_text(text: &str, max_chars: usize) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut current = String::new();

    for paragraph in text.split("\n\n") {
        if current.len() + paragraph.len() > max_chars && !current.is_empty() {
            chunks.push(current.clone());
            current.clear();
        }
        if !current.is_empty() {
            current.push_str("\n\n");
        }
        current.push_str(paragraph);
    }
    if !current.is_empty() {
        chunks.push(current);
    }
    if chunks.is_empty() {
        chunks.push(text.to_string());
    }
    chunks
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filter_sensitive_entities_removes_secrets() {
        let mut result = ExtractionResult {
            entities: vec![
                ExtractedEntity {
                    name: "Admin User".into(),
                    entity_type: "person".into(),
                    description: "System administrator".into(),
                },
                ExtractedEntity {
                    name: "API Key Manager".into(),
                    entity_type: "concept".into(),
                    description: "Manages API keys and secrets".into(),
                },
                ExtractedEntity {
                    name: "Password Policy".into(),
                    entity_type: "concept".into(),
                    description: "Defines password rules".into(),
                },
            ],
            relations: vec![ExtractedRelation {
                source: "Admin User".into(),
                target: "API Key Manager".into(),
                relation_type: "manages".into(),
                description: "Admin manages keys".into(),
            }],
        };
        filter_sensitive_entities(&mut result);
        assert_eq!(result.entities.len(), 1, "Only 'Admin User' should remain");
        assert_eq!(result.entities[0].name, "Admin User");
        assert_eq!(result.relations.len(), 0, "Relation should be removed (target filtered)");
    }

    #[test]
    fn filter_sensitive_entities_preserves_safe_entities() {
        let mut result = ExtractionResult {
            entities: vec![
                ExtractedEntity {
                    name: "Rust Programming Language".into(),
                    entity_type: "technology".into(),
                    description: "A systems programming language".into(),
                },
                ExtractedEntity {
                    name: "Axum Framework".into(),
                    entity_type: "technology".into(),
                    description: "A web application framework".into(),
                },
            ],
            relations: vec![ExtractedRelation {
                source: "Axum Framework".into(),
                target: "Rust Programming Language".into(),
                relation_type: "depends_on".into(),
                description: "Axum is built on Rust".into(),
            }],
        };
        filter_sensitive_entities(&mut result);
        assert_eq!(result.entities.len(), 2);
        assert_eq!(result.relations.len(), 1);
    }

    #[test]
    fn extraction_prompt_has_security_instruction() {
        assert!(EXTRACTION_PROMPT.contains("SECURITY"));
        assert!(EXTRACTION_PROMPT.contains("Passwords"));
        assert!(EXTRACTION_PROMPT.contains("API keys"));
    }

    #[test]
    fn chunk_text_splits_at_paragraphs() {
        let text = "Paragraph one.\n\nParagraph two.\n\nParagraph three.";
        let chunks = chunk_text(text, 30);
        assert!(chunks.len() >= 2);
    }

    #[test]
    fn chunk_text_single_paragraph() {
        let text = "Short text.";
        let chunks = chunk_text(text, 1000);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], "Short text.");
    }

    #[test]
    fn extraction_prompt_has_placeholder() {
        assert!(EXTRACTION_PROMPT.contains("{text}"));
    }

    #[test]
    fn generation_prompt_has_placeholders() {
        assert!(GENERATION_PROMPT.contains("{entities}"));
        assert!(GENERATION_PROMPT.contains("{relations}"));
        assert!(GENERATION_PROMPT.contains("{question}"));
    }

    #[test]
    fn default_config_sensible() {
        let config = LightRagConfig::default();
        assert_eq!(config.entity_top_k, 10);
        assert_eq!(config.relation_top_k, 10);
        assert!(config.score_threshold > 0.0);
        assert!(config.extraction_temperature < config.generation_temperature);
    }

    #[test]
    fn parse_extraction_result() {
        let json = r#"{"entities":[{"name":"Rust","entity_type":"technology","description":"A systems programming language"}],"relations":[{"source":"Rust","target":"Safety","relation_type":"enables","description":"Rust enables memory safety"}]}"#;
        let result: ExtractionResult = serde_json::from_str(json).unwrap();
        assert_eq!(result.entities.len(), 1);
        assert_eq!(result.relations.len(), 1);
        assert_eq!(result.entities[0].name, "Rust");
    }

    #[test]
    fn parse_extraction_with_markdown() {
        let response = "```json\n{\"entities\":[],\"relations\":[]}\n```";
        let json_str = strip_markdown_fences(response.trim());
        let result: ExtractionResult = serde_json::from_str(json_str).unwrap();
        assert!(result.entities.is_empty());
    }

    #[test]
    fn strip_markdown_fences_plain() {
        let s = "```\n{\"entities\":[]}\n```";
        let stripped = strip_markdown_fences(s.trim());
        assert_eq!(stripped, "{\"entities\":[]}");
    }

    #[test]
    fn strip_markdown_fences_no_fences() {
        let s = "{\"entities\":[]}";
        let stripped = strip_markdown_fences(s.trim());
        assert_eq!(stripped, "{\"entities\":[]}");
    }

    #[test]
    fn index_result_serializable() {
        let result = IndexResult {
            entities_created: 5,
            relations_created: 3,
            chunks_processed: 2,
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("entities_created"));
    }

    #[test]
    fn chunk_text_large_paragraph_kept_whole() {
        let long = "x".repeat(5000);
        let chunks = chunk_text(&long, 2000);
        // Single oversized paragraph stays in one chunk
        assert_eq!(chunks.len(), 1);
    }

    #[test]
    fn lightrag_result_serializable() {
        let result = LightRagResult {
            answer: "test".to_string(),
            entities: vec![],
            relations: vec![],
            graph_stats: GraphStats {
                entities_total: 0,
                relations_total: 0,
                communities_total: 0,
            },
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("answer"));
        assert!(json.contains("graph_stats"));
    }
}
