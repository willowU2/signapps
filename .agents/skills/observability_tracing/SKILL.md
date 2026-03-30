---
name: observability_tracing
description: Standards d'observabilité — tracing structuré, spans, métriques, zéro-print policy enforcement
---
# Observability & Tracing Skill

Impose les standards d'observabilité du projet : tracing structuré, spans hiérarchiques, métriques Prometheus. Aucun println/eprintln/dbg en production.

## Quand Utiliser

- Ajout de logging à du code existant ou nouveau
- Refactoring de println! vers tracing
- Configuration des spans et instruments
- Debugging qui nécessite plus de visibilité

## Zéro-Print Policy — Enforcement

### Détection automatique

```bash
# Trouver TOUTES les violations dans le code Rust (hors tests)
grep -rn "println!\|eprintln!\|dbg!" services/ crates/ --include="*.rs" \
  | grep -v "#\[cfg(test)\]" \
  | grep -v "mod tests" \
  | grep -v "_test.rs" \
  | grep -v "// allowed:"
```

Si des résultats sont trouvés → les corriger AVANT de committer.

### Table de conversion

| Avant (interdit) | Après (obligatoire) | Quand |
|-------------------|---------------------|-------|
| `println!("msg")` | `tracing::info!("msg")` | Information normale |
| `println!("value: {}", v)` | `tracing::info!(value = %v, "context")` | Valeur à logger |
| `eprintln!("err: {}", e)` | `tracing::error!(?e, "context")` | Erreur |
| `dbg!(value)` | `tracing::debug!(?value, "debug point")` | Debug temporaire |
| `eprintln!("warn: {}", w)` | `tracing::warn!(?w, "context")` | Avertissement |
| `println!("{:#?}", obj)` | `tracing::trace!(?obj, "detailed dump")` | Dump détaillé |

### Niveaux de log

| Niveau | Usage | Exemple |
|--------|-------|---------|
| `error!` | Échecs qui impactent l'utilisateur | Erreur DB, auth failure, panic attrapé |
| `warn!` | Situations anormales mais gérées | Rate limit approché, retry, fallback |
| `info!` | Événements métier significatifs | User login, event created, service started |
| `debug!` | Détails utiles pour le dev | Query params, response body, cache hit/miss |
| `trace!` | Très verbeux, rarement activé | Chaque itération de boucle, raw bytes |

## Spans et `#[instrument]`

### Règle : chaque handler public a `#[instrument]`

```rust
// ✅ Standard — skip les champs volumineux/sensibles
#[tracing::instrument(
    skip(pool, claims),
    fields(user_id = %claims.sub)
)]
pub async fn create_event(
    State(pool): State<PgPool>,
    claims: Claims,
    Json(input): Json<CreateEvent>,
) -> Result<Json<Event>, AppError> {
    tracing::info!(event_title = %input.title, "creating event");

    let event = EventRepository::create(&pool, &input)
        .await
        .map_err(|e| {
            tracing::error!(?e, "failed to create event");
            AppError::internal("Database error")
        })?;

    tracing::info!(event_id = %event.id, "event created");
    Ok(Json(event))
}
```

### Champs à toujours `skip`

| Champ | Raison |
|-------|--------|
| `pool: PgPool` | Volumineux, pas de Display |
| `claims: Claims` | Contient le token JWT (sensible) |
| `input: Json<...>` | Peut contenir des données utilisateur (RGPD) |
| `state: AppState` | Contient le pool + caches |

### Champs à toujours inclure via `fields`

| Champ | Pattern |
|-------|---------|
| `user_id` | `fields(user_id = %claims.sub)` |
| `entity_id` | `fields(entity_id = %id)` (quand Path(id)) |
| `request_id` | Injecté automatiquement par le middleware |

## Spans imbriqués (fonctions internes)

```rust
// ✅ Span sur une opération interne critique
pub async fn process_batch(pool: &PgPool, items: &[Item]) -> Result<(), AppError> {
    let span = tracing::info_span!("process_batch", count = items.len());
    let _guard = span.enter();

    for (i, item) in items.iter().enumerate() {
        let _item_span = tracing::debug_span!("process_item", index = i, item_id = %item.id).entered();
        // ... traitement
    }
    Ok(())
}
```

## Configuration du subscriber (main.rs)

```rust
// ✅ Pattern standard dans chaque main.rs
tracing_subscriber::fmt()
    .with_env_filter(
        tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "info,signapps=debug,sqlx=warn".into())
    )
    .with_target(true)
    .with_thread_ids(false)
    .with_file(true)
    .with_line_number(true)
    .init();
```

Variable d'environnement : `RUST_LOG=info,signapps=debug,sqlx=warn` (définie dans `.cargo/config.toml`).

## Métriques Prometheus

Le service `signapps-metrics` expose les métriques sur `/metrics`. Chaque service peut enregistrer ses propres compteurs :

```rust
use prometheus::{IntCounter, register_int_counter};

lazy_static! {
    static ref EVENTS_CREATED: IntCounter = register_int_counter!(
        "calendar_events_created_total",
        "Number of events created"
    ).unwrap();
}

// Dans le handler :
EVENTS_CREATED.inc();
```

## Checklist Observabilité

- [ ] Zéro `println!`/`eprintln!`/`dbg!` hors tests
- [ ] `#[instrument(skip(pool, claims))]` sur chaque handler public
- [ ] `fields(user_id = %claims.sub)` quand Claims est disponible
- [ ] Niveaux de log appropriés (error/warn/info/debug)
- [ ] Messages structurés avec champs nommés (pas de format strings)
- [ ] Erreurs loggées avec `?e` (Debug) au point de capture
- [ ] `RUST_LOG` documenté dans `.cargo/config.toml`

## Liens

- Config : `.cargo/config.toml` (RUST_LOG)
- CLAUDE.md : "Gouvernance et Qualité" → "Zéro-Print Policy"
- Skills liés : `enterprise_code_review`, `rust_enterprise_handler`
- Crate : `tracing`, `tracing-subscriber`, `tracing-opentelemetry`
