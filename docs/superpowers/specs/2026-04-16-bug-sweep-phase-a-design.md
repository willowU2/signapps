# Bug Sweep Phase A — Design Spec

**Date:** 2026-04-16
**Statut:** Validated, ready for implementation plan
**Auteurs:** Brainstorming Claude + Étienne

---

## 1. Context & Goals

### 1.1 Problem

Après une session intense de merge (50 commits locaux Phase 1-5 deploy × 50 commits remote fonts/mail/docs) + plusieurs rounds de fix (menus perdus, React Flow cassé, Tailwind v4 invalide, Turbopack bugs, etc.), le codebase SignApps contient :

- **Régressions récentes** introduites par la résolution de conflits merge
- **Code mort** accumulé au fil de 828 commits (imports inutiles, exports orphelins, fonctions dead)
- **Warnings non-adressés** : 298 côté frontend (ESLint), 3 côté backend (clippy)
- **Incohérences cosmétiques** : formatting drift, indentation mixte, whitespace trailing

### 1.2 Goals (Phase A de la décomposition globale)

1. **Eliminer tous les bugs P0/P1** visibles côté utilisateur (plantages, menus manquants, features cassées)
2. **Clean le bruit P2/P3** (code mort, imports inutiles, cosmétique) en une passe automatisée
3. **Auditer et fix TOUT le codebase** (frontend + backend), pas juste les zones récemment touchées
4. **Produire un codebase stable, lisible, sans faux positifs de warnings**

### 1.3 Non-goals (Phase A)

- **Pas de nouvelle feature** (refactors architecture = Phase C/D du plan global)
- **Pas de migration de deps** (sauf si bloquant pour P0)
- **Pas d'a11y dédiée** (c'est Phase E)
- **Pas de tests ajoutés** (c'est Phase F) — sauf tests de régression si un fix en nécessite un

---

## 2. Paramètres validés

Décisions prises pendant le brainstorming :

| Axe | Choix |
|---|---|
| Méthode détection | **A** : Review automatisée exhaustive (subagents code-reviewer) |
| Scope géographique | **C** : Frontend + Backend complet (tout le codebase) |
| Seuil de gravité | **D** : Tout (P0 critical → P3 cosmetic) |
| Méthode exécution | **E** : Hybride — Pass 1 automatique, Pass 2 par modules |
| Gouvernance | Auto-enchaîné (pas de checkpoint humain entre modules), validation par tests automatiques |

---

## 3. Architecture du workflow

Trois passes enchaînées automatiquement :

```
┌──────────────────────────────────────────┐
│ PASS 1 — Cleanup automatique (~30 min)    │
│                                          │
│ Objectif : éliminer le bruit P3           │
│ cosmétique avant review humaine.          │
│                                          │
│ Outils (dans cet ordre) :                 │
│  1. prettier --write (frontend)           │
│  2. eslint --fix (frontend, safe rules)   │
│  3. cargo fmt --all (backend)             │
│  4. knip --strict (dead exports/deps)     │
│  5. cargo clippy --fix (backend safe)     │
│                                          │
│ Validation automatique :                  │
│  - tsc --noEmit = 0 errors                │
│  - cargo check --workspace = 0 errors     │
│  - cargo nextest = ≥ baseline             │
│                                          │
│ Fallback : si validation échoue →         │
│  revert + reprendre étape par étape.      │
│                                          │
│ Output : 1 commit                         │
│  "chore: automated P3 cleanup"            │
└──────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────┐
│ PASS 2 — Audit + fix par module          │
│ (~1-2 semaines)                          │
│                                          │
│ Ordre (du plus utilisé au moins) :       │
│                                          │
│   1. calendar                             │
│   2. mail                                 │
│   3. org-structure                        │
│   4. storage + drive                      │
│   5. docs (text/sheet/slide/board)       │
│   6. chat                                 │
│   7. meet                                 │
│   8. identity + auth                      │
│   9. admin/* (hors org)                   │
│  10. remaining (tout le reste)            │
│                                          │
│ Pour chaque module :                      │
│   a. Dispatch subagent code-reviewer      │
│      avec scope strict sur le module      │
│      (frontend path + backend service).   │
│   b. Parse findings par sévérité.         │
│   c. Fix P0/P1 systématiquement.          │
│   d. Fix P2 si fichier déjà touché.       │
│   e. Validation auto du module :          │
│      - tsc, eslint, cargo check,          │
│      - cargo nextest -p <crate>           │
│   f. Commit groupé (1 par module).        │
│   g. Enchaîne sur module suivant          │
│      (sans pause humaine).                │
│                                          │
│ Rollback auto : si validation échoue →    │
│  git reset --hard HEAD → retry 1 fois →   │
│  si échec 2e : skip module + log dans     │
│  TODO-BUGSWEEP et continue.               │
└──────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────┐
│ PASS 3 — Validation globale              │
│                                          │
│  1. cargo fmt --check                     │
│  2. cargo clippy -D warnings              │
│  3. tsc --noEmit                          │
│  4. eslint (≤ 50 warnings résiduels)      │
│  5. cargo nextest run --workspace         │
│  6. npx vitest run                        │
│  7. npm run build (production)            │
│  8. npx playwright test --grep=smoke      │
│  9. start-all.sh + check 34/34 healthy    │
│ 10. tag "bug-sweep-complete"              │
└──────────────────────────────────────────┘
```

---

## 4. Composants

### 4.1 Subagent code-reviewer par module

**Type :** `feature-dev:code-reviewer` (skill existant)

**Prompt template :**
```
Audit all P0-P2 issues in the <module> module of SignApps Platform.
Scope:
 - Frontend: <client/src/app/{module}/, client/src/components/{module}/>
 - Backend: <services/signapps-{module}/, crates/signapps-db/{module}/>

Severity:
 - P0 Critical: crashes, broken menus, auth, infinite loops, runtime errors
 - P1 Important: broken features, type-unsafe that will crash, inconsistent state
 - P2 Quality: dead code, duplication, bad naming, unjustified `any`, magic nums

Format output:
 ## CRITICAL (P0)
  - <file:line> — <1-line bug> — <1-line fix>
 ## IMPORTANT (P1)
 ## QUALITY (P2)

Skip P3 cosmétique (handled separately by automated Pass 1).
Only report high-confidence findings. State uncertainty explicitly.
Under 500 words.
```

### 4.2 Automated validation harness

**Au runtime par module** :
```bash
npx tsc --noEmit -p client/tsconfig.json | grep -c "error TS"      # → 0
cargo check -p signapps-<module>                                   # → 0 errors
cargo nextest run -p signapps-<module>                             # → ≥ baseline
(if frontend tests exist) npx vitest run src/components/<module>/  # → all pass
```

**Au runtime global (Pass 3)** :
Defined in section 3 pipeline above.

### 4.3 Bug journal

Fichier `docs/superpowers/logs/bug-sweep-2026-04-16.md` — 1 entrée par module :

```markdown
## <module> (2026-04-16 HH:MM)
Commit: <SHA>
Subagent findings: P0=N, P1=M, P2=K
Fixed: N P0 + M P1 + J P2 (J ≤ K)
Skipped: (K-J) P2 (noted in follow-up)
False positives rejected: N
Validation: tsc ✓ clippy ✓ nextest ✓
Duration: X min
```

### 4.4 TODO follow-up (si rollback échoue 2 fois)

Fichier `docs/superpowers/logs/bug-sweep-todo.md` :

```markdown
## <module>
- <file:line> — <issue> — rollback failed: <reason>
- (needs manual investigation)
```

---

## 5. Error handling + risks

### 5.1 Matrix de risques

| Risque | Mitigation |
|---|---|
| Fix P1 casse test cross-module | Pass 3 global test détecte. Revert module concerné, investiguer. |
| Subagent reviewer hallucine | Claude vérifie chaque finding en lisant le code avant de fixer. False positives rejetés + loggés. |
| Module > 50 issues | Split (ex: admin → admin/org, admin/oauth, admin/users). Jamais > 30 fixes/commit. |
| Rollback refait le bug | Max 1 retry. 2e échec → skip + TODO-BUGSWEEP, continue. |
| Build prod casse malgré dev OK | Pass 3 étape 7 attrape. Revert dernier module + debug. |
| Contexte saturé | Chaque module = subagent frais. Contexte principal reste léger. |
| Perte de suivi utilisateur | Tag par module + journal markdown + resumé final. |

### 5.2 Safety constraints

- **Jamais de `git push --force`** sur main
- **Jamais de suppression de fichiers** sans review (même si knip les marque dead)
- **Jamais de `--no-verify`** sur commits
- **Toute action destructive** (delete, drop, reset --hard sur autre chose que le commit courant) nécessite confirmation explicite utilisateur

---

## 6. Testing strategy

Pas d'ajout de tests dans le scope Phase A — sauf si un fix introduit un comportement qui nécessite une protection (régression test). Dans ce cas :

- Ajout inline dans le commit du module
- Pattern : `#[cfg(test)] mod tests` pour Rust, colocation `*.test.ts` pour frontend

**Validation existante** (pas ajoutée, utilisée) :
- 64+ tests unitaires signapps-deploy
- 6+ tests signapps-common
- Playwright E2E (smoke suite)
- vitest (où existant)

---

## 7. Phasing

1. **Pass 1** (auto cleanup) — 1 commit, ~30 min
2. **Pass 2** (modules) — 10 commits, 1-2 semaines réelles OR 2-3 jours en session concentrée
3. **Pass 3** (validation globale + tag) — 0-2 commits si fix finaux, ~30 min

Les 10 modules exécutés en séquence (pas en parallèle) car :
- Conflits potentiels sur fichiers partagés (signapps-common, shared components)
- Validation isolée plus fiable
- Contexte Claude reste gérable

---

## 8. Success criteria

À la fin de la Phase A, le codebase doit :

- [ ] `cargo fmt --all --check` passe
- [ ] `cargo clippy --workspace -- -D warnings` passe
- [ ] `npx tsc --noEmit` = 0 erreurs
- [ ] `npx eslint src/` ≤ 50 warnings (de 298 → ≤ 50 residual)
- [ ] `cargo nextest run --workspace` = ≥ baseline tests pass
- [ ] `npm run build` (production) = SUCCESS
- [ ] `scripts/start-all.sh` → 34/34 services healthy
- [ ] Tag `bug-sweep-complete` créé localement
- [ ] `docs/superpowers/logs/bug-sweep-2026-04-16.md` journal complet
- [ ] 0 entries critiques dans `bug-sweep-todo.md` (P2 skipped OK, P0/P1 skipped non)

---

## 9. Out-of-scope (futures phases)

- **Phase B — Code mort strict** (déjà fait dans Pass 1 automatique, mais un passage manuel plus profond resterait)
- **Phase C — Standards stricts** (TypeScript strict, pas de `any`, JSDoc public)
- **Phase D — Performance / bundle** (analyze, lazy loading, memoization)
- **Phase E — Accessibility**
- **Phase F — Tests coverage**

Chacune aura son propre brainstorming → spec → plan au moment voulu.

---

## 10. Glossaire

- **P0/P1/P2/P3** : sévérité des issues (critical/important/quality/cosmetic)
- **Pass 1/2/3** : les 3 passes du workflow (cleanup auto / modules / validation)
- **Module** : une des 10 zones (calendar, mail, org, etc.) auditée séparément
- **Subagent reviewer** : instance de `feature-dev:code-reviewer` dispatchée par module
- **Pass 1** est automatique (tools only), **Pass 2** est semi-automatique (subagent + apply), **Pass 3** est automatique (tests + tag)
