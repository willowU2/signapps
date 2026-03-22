# Erreurs Rust - Base de Connaissances

> Chaque erreur corrigée est une leçon apprise. Cette base évite de refaire les mêmes erreurs.

---

## Format d'une Entrée

```markdown
### [ERR-RUST-XXX] Titre court

**Date** : YYYY-MM-DD
**Commit fix** : `abc123`
**Fichier(s)** : `path/to/file.rs`

**Symptôme** :
[Description de l'erreur observée]

**Cause racine** :
[Pourquoi l'erreur s'est produite]

**Solution** :
```rust
// Code corrigé
```

**Prévention** :
- [ ] Vérification à ajouter
- [ ] Pattern à suivre

**Tags** : #axum #async #lifetime
```

---

## Erreurs par Catégorie

### Lifetime & Borrowing

*Aucune erreur enregistrée.*

### Async / Tokio

*Aucune erreur enregistrée.*

### Axum / Web

*Aucune erreur enregistrée.*

### SQLx / Database

### [ERR-RUST-001] Type annotation needed avec sqlx::query!

**Date** : 2026-03-21
**Commit fix** : `pending`
**Fichier(s)** : `crates/signapps-db/src/repositories/storage_tier2_repository.rs`

**Symptôme** :
```
error[E0282]: type annotations needed
   --> crates\signapps-db\src\repositories\storage_tier2_repository.rs:87:13
    |
87 |         let result = sqlx::query!(
   |             ^^^^^^
...
98 |         Ok(result.rows_affected())
   |            ------ type must be known at this point
```

**Cause racine** :
Le compilateur ne peut pas inférer le type de retour de `sqlx::query!` macro quand on accède à `rows_affected()` directement.

**Solution** :
```rust
// Spécifier explicitement le type
let result: sqlx::postgres::PgQueryResult = sqlx::query!(
    // ...
).execute(&self.pool).await?;
Ok(result.rows_affected())
```

**Prévention** :
- [ ] Toujours typer explicitement les résultats de sqlx::query!
- [ ] Utiliser `.execute()` pour les mutations sans retour

**Tags** : #sqlx #type-inference #database

---

### [ERR-RUST-002] SQLx compilation requires running database

**Date** : 2026-03-21
**Commit fix** : N/A (configuration)
**Fichier(s)** : `crates/signapps-db/src/repositories/*.rs`

**Symptôme** :
```
error: error returned from database: relation "storage.tags" does not exist
```

**Cause racine** :
SQLx vérifie les requêtes SQL contre la vraie base de données au moment de la compilation (`cargo check`). Si la DB n'est pas démarrée ou les migrations pas appliquées, la compilation échoue.

**Solution** :
```bash
# Option 1: Démarrer PostgreSQL et appliquer migrations
docker-compose up -d postgres
sqlx migrate run

# Option 2: Mode offline (utilise sqlx-data.json pré-généré)
SQLX_OFFLINE=true cargo check

# Option 3: Générer sqlx-data.json si DB disponible
cargo sqlx prepare --workspace
```

**Prévention** :
- [ ] Toujours avoir `sqlx-data.json` à jour pour CI/CD
- [ ] Documenter le setup DB dans README

**Tags** : #sqlx #database #compilation #offline

### Serde / Serialization

*Aucune erreur enregistrée.*

### Compilation

*Aucune erreur enregistrée.*

---

## Index par Fichier

| Fichier | Erreurs | Dernière |
|---------|---------|----------|
| - | - | - |

---

## Statistiques

| Métrique | Valeur |
|----------|--------|
| Total erreurs | 0 |
| Erreurs lifetime | 0 |
| Erreurs async | 0 |
| Erreurs compile | 0 |

---

*Ce fichier est enrichi automatiquement via l'analyse des `git diff` après chaque correction de bug.*
