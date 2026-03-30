---
name: enterprise_code_review
description: Revue de code enterprise automatisée — vérifie toutes les directives avant de déclarer terminé
---
# Enterprise Code Review Skill

Gate automatique avant de déclarer une tâche terminée. Vérifie les 5 piliers de gouvernance du projet.

## Quand Utiliser

- AVANT de dire "c'est terminé" ou "c'est fait"
- Après implémentation d'un handler, modèle, ou composant
- Lors d'un `superpowers:verification-before-completion`
- Sur demande explicite de review

## Les 5 Piliers

### Pilier 1 : Observabilité (Zéro-Print)

**Scanner les fichiers modifiés pour :**

```bash
# Détecter les violations
grep -rn "println!\|eprintln!\|dbg!" services/ crates/ --include="*.rs" | grep -v "#\[cfg(test)\]" | grep -v "mod tests"
```

**Violations :**
```rust
// ❌ println! en production
println!("user: {}", user.id);

// ❌ eprintln! pour les erreurs
eprintln!("failed: {}", err);

// ❌ dbg! oublié
dbg!(&response);
```

**Corrections :**
```rust
// ✅ tracing structuré
tracing::info!(user_id = %user.id, "processing user");
tracing::error!(?err, "operation failed");
// dbg! → tracing::debug!(?response, "response received");
```

**Vérifier `#[instrument]` sur les handlers :**
```bash
# Chaque fn pub dans handlers/ doit avoir #[instrument] ou #[tracing::instrument]
grep -B2 "pub async fn" services/*/src/handlers/*.rs | grep -v instrument
```

Si des fonctions publiques de handlers n'ont pas `#[instrument]`, les ajouter :
```rust
#[tracing::instrument(skip(pool, claims))]
pub async fn my_handler(
    State(pool): State<PgPool>,
    claims: Claims,
) -> Result<Json<Response>, AppError> {
```

### Pilier 2 : Gestion des Erreurs

**Scanner pour `.unwrap()` et `.expect()` hors tests :**

```bash
grep -rn "\.unwrap()\|\.expect(" services/ crates/ --include="*.rs" | grep -v "#\[cfg(test)\]" | grep -v "mod tests" | grep -v "// test" | grep -v "_test.rs"
```

**Corrections selon le contexte :**

| Contexte | Remplacement |
|----------|-------------|
| Handler Axum | `?` avec `AppError` : `.map_err(AppError::internal)?` |
| Code applicatif | `anyhow::Context` : `.context("description")?` |
| Code bibliothèque | `thiserror` enum : `return Err(MyError::NotFound)` |
| Initialisation (main) | `.expect()` acceptable UNIQUEMENT dans `main()` pour les configs |

### Pilier 3 : Documentation API (OpenAPI Code-First)

**Pour chaque nouveau handler, vérifier :**

```bash
# Handlers sans #[utoipa::path]
grep -B1 "pub async fn" services/*/src/handlers/*.rs | grep -v "utoipa::path" | grep "pub async"
```

**Chaque handler REST doit avoir :**
```rust
#[utoipa::path(
    post,
    path = "/api/v1/resource",
    request_body = CreateResourceRequest,
    responses(
        (status = 201, body = Resource),
        (status = 400, body = AppError),
        (status = 401),
    ),
    security(("bearer" = [])),
    tag = "Resources"
)]
```

**Chaque struct de requête/réponse doit dériver `ToSchema` :**
```bash
grep -rn "pub struct.*Request\|pub struct.*Response" services/ crates/ --include="*.rs" | grep -v "ToSchema"
```

### Pilier 4 : Documentation Code (rustdoc)

**Structs/enums/traits publics sans `///` :**

```bash
# Trouver les types publics sans doc
grep -B1 "^pub struct\|^pub enum\|^pub trait" crates/*/src/**/*.rs | grep -v "///"
```

**Format minimum :**
```rust
/// Description courte de la struct.
///
/// Détails supplémentaires si nécessaire.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyType {
    /// Description du champ
    pub field: String,
}
```

### Pilier 5 : Tests et Qualité

**Exécuter dans l'ordre :**

```bash
# 1. Format
cargo fmt --all -- --check

# 2. Lint strict
cargo clippy --workspace --all-features -- -D warnings

# 3. Tests
cargo nextest run --workspace

# 4. Sécurité (si deps changées)
cargo audit
cargo deny check
```

**Vérifier la présence de tests :**
```bash
# Chaque nouveau fichier handler doit avoir un module tests
grep -L "#\[cfg(test)\]" services/*/src/handlers/*.rs
```

## Procédure Complète

### Étape 1 : Identifier les fichiers modifiés
```bash
git diff --name-only HEAD~1 -- "*.rs"
```

### Étape 2 : Scanner chaque pilier
Exécuter les commandes de détection des 5 piliers ci-dessus sur les fichiers modifiés.

### Étape 3 : Rapport
Produire un rapport structuré :

```markdown
## Enterprise Review Report

### Observabilité
- ✅ Pas de println!/eprintln!/dbg!
- ⚠️ 2 handlers sans #[instrument] : `leave.rs:45`, `presence.rs:89`

### Erreurs
- ✅ Pas de .unwrap()/.expect() en production

### API Documentation
- ⚠️ 3 handlers sans #[utoipa::path]
- ⚠️ 1 struct sans ToSchema : CreateLeaveRequest

### Rustdoc
- ✅ Tous les types publics documentés

### Tests
- ✅ clippy clean
- ✅ 42/42 tests pass
- ⚠️ Couverture non vérifiée (optionnel)

### Verdict : ⚠️ 5 issues mineures à corriger
```

### Étape 4 : Corriger ou signaler
- **Issues bloquantes** (unwrap, println) → corriger immédiatement
- **Issues mineures** (#[instrument], rustdoc) → corriger dans le même commit
- **Issues advisory** (couverture) → signaler, ne pas bloquer

## Checklist Pré-Commit

- [ ] `grep println!/eprintln!/dbg!` → 0 résultats hors tests
- [ ] `grep .unwrap()/.expect()` → 0 résultats hors tests
- [ ] `cargo clippy -- -D warnings` → clean
- [ ] `cargo fmt -- --check` → clean
- [ ] `cargo nextest run` → tous passent
- [ ] Handlers ont `#[instrument]`
- [ ] Handlers REST ont `#[utoipa::path]`
- [ ] Structs publiques ont `///` et `ToSchema`
- [ ] Commit message = Conventional Commits

## Liens

- CLAUDE.md : sections "Gouvernance et Qualité" + "Review Checklist"
- Skills liés : `claude_md_governance`, `rust_enterprise_handler`, `observability_tracing`
