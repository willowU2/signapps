---
name: claude_md_governance
description: Audit et maintien du CLAUDE.md — structure scannable, directives enterprise, pas de drift
---
# CLAUDE.md Governance Skill

Maintient le CLAUDE.md comme document vivant, scannable, à jour. Invoqué après tout changement structurel du projet.

## Quand Utiliser

- Après ajout d'un nouveau service, crate ou outil
- Après modification du CI, des conventions ou du tooling
- Quand un développeur demande "mets à jour CLAUDE.md"
- En audit périodique (drift detection)

## Structure Canonique

Le CLAUDE.md DOIT contenir ces sections dans cet ordre exact. Chaque section a un rôle précis et une taille cible.

```
## Project Overview              (~5 lignes)  — One-liner projet + stack
## Build Commands                (~25 lignes) — justfile + cargo aliases + frontend
## Test Commands                 (~30 lignes) — nextest, coverage, mutants, E2E, bacon
## Code Style                    (~20 lignes) — Tableau des règles Rust + TS
## Gouvernance et Qualité        (~100 lignes) — Zéro-Print, erreurs, OpenAPI, rustdoc
## Review Checklist              (~30 lignes) — 5 gates checkboxes
## Architecture                  (~80 lignes) — Workspace, patterns, structure features
## Tooling Avancé                (~30 lignes) — Tableau outils + CI jobs
## Automatic Tool Usage          (~30 lignes) — Superpowers, BMAD, local skills
## Key Environment Variables     (~15 lignes) — Variables critiques
## Préférences de développement  (~10 lignes) — Port, auto-login, conventions
```

**Taille totale cible : 350-450 lignes.** Au-delà, compresser. En dessous, il manque du contenu.

## Procédure d'Audit

### Étape 1 : Vérifier la structure

```bash
grep "^## " CLAUDE.md
```

Comparer avec la structure canonique ci-dessus. Signaler les sections manquantes ou dans le mauvais ordre.

### Étape 2 : Vérifier la cohérence avec le repo

| Élément | Vérification |
|---------|-------------|
| Services listés | `ls services/` doit correspondre à la section Architecture |
| Ports listés | Vérifier dans `main.rs` de chaque service |
| Outils listés | `cargo install --list` + `ls *.toml` doit correspondre à Tooling Avancé |
| CI jobs | `.github/workflows/ci.yml` doit correspondre à CI Pipeline |
| Cargo aliases | `.cargo/config.toml` doit correspondre à Build Commands |
| justfile recipes | `just --list` doit correspondre aux commandes documentées |

### Étape 3 : Vérifier les directives enterprise

Chaque directive doit être présente avec un exemple de code ✅/❌ :

- [ ] **Zéro-Print** : `println!`/`eprintln!`/`dbg!` interdits → `tracing` + `#[instrument]`
- [ ] **Erreurs** : `.unwrap()`/`.expect()` interdits → `thiserror`/`anyhow`/`AppError`
- [ ] **OpenAPI** : `#[utoipa::path]` + `utoipa::ToSchema` obligatoires
- [ ] **Rustdoc** : `///` sur types publics
- [ ] **Conventional Commits** : format documenté avec exemples
- [ ] **Review Checklist** : 5 sections avec checkboxes

### Étape 4 : Mettre à jour si nécessaire

Si des écarts sont trouvés :
1. Modifier CLAUDE.md directement (Edit tool)
2. Ne PAS ajouter de nouvelles sections — mettre à jour les existantes
3. Garder la taille dans la cible 350-450 lignes
4. Utiliser des tableaux Markdown pour la densité (pas de prose)
5. Commit : `docs: update CLAUDE.md — sync with current project state`

## Règles de Rédaction

1. **Tableaux > Prose** — Un tableau de 10 lignes remplace 30 lignes de texte
2. **Code ✅/❌ > Description** — Montrer le bon et le mauvais pattern
3. **Justfile > Commandes longues** — Documenter `just test` pas `cargo nextest run --workspace`
4. **Pas de duplication** — Si c'est dans `justfile`, ne pas recopier la commande complète
5. **Français pour les sections** — Le code reste en anglais
6. **Liens vers les configs** — Mentionner `rustfmt.toml`, `clippy.toml`, etc. sans recopier leur contenu

## Checklist Pré-Commit

- [ ] Structure canonique respectée (11 sections dans l'ordre)
- [ ] Taille 350-450 lignes
- [ ] Pas de section vide ou placeholder
- [ ] Services/ports à jour
- [ ] Outils/CI à jour
- [ ] Directives enterprise toutes présentes avec exemples ✅/❌
- [ ] Review Checklist avec checkboxes

## Liens

- Fichier principal : `CLAUDE.md`
- Skills liés : `enterprise_code_review`, `rust_enterprise_handler`
- Config files : `clippy.toml`, `rustfmt.toml`, `deny.toml`, `bacon.toml`, `justfile`
