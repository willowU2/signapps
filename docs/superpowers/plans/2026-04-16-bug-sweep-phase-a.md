# Bug Sweep Phase A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auditer et fixer tous les bugs P0/P1/P2 + nettoyer le bruit P3 cosmétique sur **tout le codebase** SignApps (frontend + backend), en 3 passes automatisées : cleanup auto → modules ciblés → validation finale.

**Architecture:** Pass 1 exécute 5 outils automatiques (prettier / eslint --fix / cargo fmt / knip / clippy --fix) en 1 commit. Pass 2 traite 10 modules en séquence, chacun avec un subagent `feature-dev:code-reviewer` qui liste les findings, puis application des fixes + validation automatique du module + 1 commit par module. Pass 3 valide globalement (clippy -D / tsc / nextest / build / smoke) puis tag.

**Tech Stack:** Existant — Next.js 16 + Webpack, React 19, TypeScript strict, Tailwind v4, Rust 1.75+, Axum, sqlx, tokio. Outils Pass 1 : prettier, eslint, cargo fmt, knip, cargo clippy.

**Auto-chain:** Conformément à la préférence utilisateur (`memory/feedback_auto_chain.md`), ce plan s'exécute **sans checkpoints humains intermédiaires** — les validations sont automatiques (tests + type-check + build + services health). Stop uniquement sur blocker réel.

**Spec :** `docs/superpowers/specs/2026-04-16-bug-sweep-phase-a-design.md`

---

## File Structure

### Fichiers créés

| Fichier | Responsabilité |
|---|---|
| `docs/superpowers/logs/bug-sweep-2026-04-16.md` | Journal d'exécution : 1 entrée par module (findings, fixed, skipped, validation status) |
| `docs/superpowers/logs/bug-sweep-todo.md` | Items skippés (rollback double-échec, P2 non-atteints) à reprendre plus tard |

### Fichiers modifiés

Variable par module. Enregistré dans le journal au fur et à mesure. Estimation : 100-400 fichiers touchés au total (Pass 1 + Pass 2 combinés).

---

# PASS 1 — CLEANUP AUTOMATIQUE

## Task 1: Preflight baseline

**Files:**
- Create: `docs/superpowers/logs/bug-sweep-2026-04-16.md` (header only)

- [ ] **Step 1: Create journal header**

Écrire dans `docs/superpowers/logs/bug-sweep-2026-04-16.md` :

```markdown
# Bug Sweep Phase A — Journal 2026-04-16

Started: <YYYY-MM-DDTHH:MM:SSZ>
Spec: docs/superpowers/specs/2026-04-16-bug-sweep-phase-a-design.md
Plan: docs/superpowers/plans/2026-04-16-bug-sweep-phase-a.md

## Baseline (pre-Pass 1)

- Frontend TS/TSX files: <N>
- Frontend lines: <L>
- Backend Rust files: <M>
- Backend lines: <K>
- ESLint warnings: <E>
- Clippy warnings: <C>
- Tests passing (workspace): <T>
```

Commandes pour remplir les valeurs :

```bash
find client/src -name "*.tsx" -o -name "*.ts" | wc -l
find client/src -name "*.tsx" -o -name "*.ts" | xargs wc -l 2>/dev/null | tail -1
find services crates -name "*.rs" | wc -l
find services crates -name "*.rs" | xargs wc -l 2>/dev/null | tail -1
cd client && npx eslint src/ --max-warnings 99999 2>&1 | grep -cE "^\s+[0-9]+:[0-9]+\s+(warning|error)"
cd .. && cargo clippy --workspace --all-features 2>&1 | grep -cE "^warning"
cargo nextest run --workspace --no-run 2>&1 | grep -E "^\s+[0-9]+ " | tail -1
```

- [ ] **Step 2: Commit baseline journal**

```bash
rtk git checkout -b feat/bug-sweep-phase-a
rtk git add docs/superpowers/logs/bug-sweep-2026-04-16.md
rtk git commit -m "chore(bug-sweep): baseline journal for Phase A"
```

---

## Task 2: Pass 1 — Prettier + ESLint --fix (frontend)

**Files:** variable (all `client/src/**/*.{ts,tsx,js,jsx,json,css,md}`)

- [ ] **Step 1: Run Prettier**

```bash
cd client && npx prettier --write "src/**/*.{ts,tsx,js,jsx,json,css,md}" --log-level=warn 2>&1 | tail -5
```
Expected: "N files unchanged" ou une liste de fichiers reformatés. Pas d'erreurs.

- [ ] **Step 2: Run ESLint auto-fix**

```bash
cd client && npx eslint src/ --fix --max-warnings 99999 2>&1 | tail -5
```
Expected: count de warnings diminué. Les rules auto-fixables (unused-imports, sort-imports, prefer-const) appliquées.

- [ ] **Step 3: Verify frontend still type-checks**

```bash
cd client && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: `0`. Si ≠ 0, revert les changements Prettier/ESLint et revenir à `git restore .`.

- [ ] **Step 4: Verify frontend builds**

```bash
cd client && npm run build 2>&1 | tail -5
```
Expected: "✓ Compiled successfully" ou équivalent. Si build fail et que le message mentionne un fichier que Prettier a touché, revert ce fichier précis et retry.

- [ ] **Step 5: Log progress (append to journal)**

Ajouter à `docs/superpowers/logs/bug-sweep-2026-04-16.md` :

```markdown
## Pass 1 — Frontend automated cleanup

Files touched by prettier: <N>
ESLint warnings fixed: <before - after>
ESLint remaining: <after>
tsc: 0 errors ✓
build: SUCCESS ✓
```

- [ ] **Step 6: Do NOT commit yet** — Task 5 va tout commiter ensemble pour grouper Pass 1 en 1 seul commit.

---

## Task 3: Pass 1 — Cargo fmt + Clippy --fix (backend)

**Files:** variable (all `services/**/*.rs`, `crates/**/*.rs`, `tools/**/*.rs`)

- [ ] **Step 1: Run cargo fmt**

```bash
cargo fmt --all 2>&1 | tail -3
```
Expected: pas d'output si déjà formaté, sinon liste des fichiers reformatés.

- [ ] **Step 2: Run cargo clippy --fix**

```bash
cargo clippy --workspace --all-features --fix --allow-dirty --allow-staged 2>&1 | tail -10
```
Expected: "X warnings fixed" ou équivalent. Continue même si 0 fixes (clippy est déjà à 3 warnings globalement).

- [ ] **Step 3: Verify backend compiles**

```bash
cargo check --workspace 2>&1 | grep -E "^error" | head -3
```
Expected: 0 erreurs. Si erreurs, revert avec `git restore .` et documenter dans `bug-sweep-todo.md`.

- [ ] **Step 4: Verify tests still run**

```bash
cargo nextest run --workspace --no-run 2>&1 | tail -3
```
Expected: "N tests" with tests count ≥ baseline. Pas de compilation errors.

- [ ] **Step 5: Log progress (append to journal)**

```markdown
## Pass 1 — Backend automated cleanup

Files touched by rustfmt: <N>
Clippy warnings fixed: <before - after>
Clippy remaining: <after>
cargo check: 0 errors ✓
cargo nextest --no-run: N tests compiled ✓
```

---

## Task 4: Pass 1 — Knip dead code report + safe removal

**Files:** variable (potentially remove unused exports/deps)

- [ ] **Step 1: Generate knip report**

```bash
cd client && npx knip --production --reporter markdown > /tmp/knip-report.md 2>&1 || true
head -60 /tmp/knip-report.md
```
Knip lists unused dependencies, files, exports. Important: certaines entries sont faux positifs (imports dynamiques, app router conventions).

- [ ] **Step 2: Filter and apply safe removals only**

Appliquer UNIQUEMENT les catégories suivantes :
1. **Unused dependencies** dans `package.json` SI elles n'apparaissent nulle part via `rtk grep -rn "<dep-name>" src/`
2. **Unused exports** dans des fichiers qui ne sont pas des layouts / pages / server actions
3. **Unlisted files** si confirmés orphelins via `rtk grep -rn "<filename>" src/`

**NE PAS SUPPRIMER** :
- Fichiers sous `app/**/(layout|page|loading|error|not-found|default).tsx` (App Router conventions)
- Fichiers exportés par un `index.ts` même si l'import chain semble vide
- Server actions (`"use server"` ou files in `app/**/actions/`)
- Tests et stories

Pour chaque suppression candidate, Claude lit le rapport, vérifie via grep, et supprime un fichier à la fois puis `npm run build` après chaque ~5 suppressions pour détecter les faux positifs.

- [ ] **Step 3: Run knip for backend unused deps (Cargo)**

```bash
cargo install cargo-udeps --locked 2>&1 | tail -1
cargo +nightly udeps --workspace 2>&1 | tail -20 || echo "nightly not available, skip"
```
Si nightly disponible: appliquer les removes de deps inutilisées dans `Cargo.toml` (attention, parfois faux positifs si deps utilisés uniquement en feature-gated code). Commit reverté si `cargo check --workspace` échoue.

- [ ] **Step 4: Verify both stacks still green**

```bash
cd client && npx tsc --noEmit 2>&1 | grep -c "error TS"    # 0
cd client && npm run build 2>&1 | tail -3                  # SUCCESS
cd .. && cargo check --workspace 2>&1 | grep -c "^error"   # 0
cargo nextest run --workspace 2>&1 | tail -3               # ≥ baseline
```

- [ ] **Step 5: Log progress**

Ajouter au journal :

```markdown
## Pass 1 — Dead code removal (knip + udeps)

Frontend:
- Unused deps removed: <list>
- Unused files removed: <count>
- Unused exports removed: <count>
- False positives rejected: <count>

Backend:
- Unused deps removed: <list> (or "skipped: nightly unavailable")
```

---

## Task 5: Pass 1 — Single grouped commit

**Files:** combined diff of Tasks 2-4

- [ ] **Step 1: Verify all green state**

```bash
cd client && npx tsc --noEmit && echo "TS OK"
cd client && npm run build 2>&1 | grep -q "Compiled successfully\|success" && echo "build OK"
cd .. && cargo check --workspace && echo "Rust OK"
cargo nextest run --workspace 2>&1 | tail -1
```

- [ ] **Step 2: Commit combined**

```bash
rtk git add -A
rtk git commit -m "chore: automated P3 cleanup (prettier/eslint/cargo fmt/clippy/knip)

Pass 1 of the bug sweep — automated tooling only, no hand-written fixes.

- Prettier formatted all client/src/**/*.{ts,tsx,...}
- ESLint --fix applied safe rules (unused imports, sort imports)
- cargo fmt --all reformatted all Rust files
- cargo clippy --fix applied safe suggestions
- knip removed unused frontend dependencies + orphan files
- cargo udeps removed unused Cargo dependencies (if nightly available)

Validation: tsc 0, cargo check 0, build SUCCESS, tests ≥ baseline.
See docs/superpowers/logs/bug-sweep-2026-04-16.md for details."
```

- [ ] **Step 3: Capture metrics for Pass 2**

```bash
cd client && npx eslint src/ --max-warnings 99999 2>&1 | grep -cE "^\s+[0-9]+:" > /tmp/post-pass1-eslint.txt
cat /tmp/post-pass1-eslint.txt
```
Expected: warnings count significantly lower than 298 baseline.

---

# PASS 2 — AUDIT + FIX PAR MODULE

## Task 6: Module "calendar"

**Scope:**
- Frontend: `client/src/app/cal/`, `client/src/app/calendar/`, `client/src/components/calendar/`, `client/src/hooks/use-events.ts`, `client/src/hooks/use-calendar-*.ts`, `client/src/stores/calendar-store.ts`, `client/src/lib/api/calendar.ts`, `client/src/types/calendar.ts`
- Backend: `services/signapps-calendar/`, `crates/signapps-db/src/models/calendar/`, `crates/signapps-db/src/repositories/calendar_repository.rs`, migrations touchant calendar/events/leaves/shifts

- [ ] **Step 1: Dispatch reviewer subagent**

Invoke `feature-dev:code-reviewer` with this prompt:

```
Audit P0-P2 issues in the CALENDAR module of SignApps Platform.

Scope frontend:
 - client/src/app/cal/
 - client/src/app/calendar/ (if exists)
 - client/src/components/calendar/
 - client/src/hooks/use-events.ts + use-calendar-*.ts
 - client/src/stores/calendar-store.ts
 - client/src/lib/api/calendar.ts
 - client/src/types/calendar.ts

Scope backend:
 - services/signapps-calendar/
 - crates/signapps-db/src/models/calendar/
 - crates/signapps-db/src/repositories/calendar_repository.rs

Sévérités:
 P0 Critical — crashes, broken menus, runtime errors, auth bypass, infinite loops
 P1 Important — broken features, unsafe types that will crash, inconsistent state, perf issues
 P2 Quality — dead code, duplication, bad naming, unjustified `any`, magic numbers

Skip P3 (already done in Pass 1). Only report HIGH-CONFIDENCE findings.

Format:
 ## CRITICAL (P0)
  - file:line — bug 1-line — fix 1-line
 ## IMPORTANT (P1)
 ## QUALITY (P2)

Under 500 words total.
```

- [ ] **Step 2: Parse findings + apply fixes**

For each finding (in order P0 → P1 → P2):
1. Read the file referenced
2. Verify the bug actually exists (reject false positives with a one-line log)
3. Apply the suggested fix or a better equivalent
4. After every 5 fixes OR at the end of a category: run `npx tsc --noEmit` or `cargo check -p signapps-calendar` to catch regressions early

Budget: fix all P0 + all P1 + P2 where the file is already being touched (co-incidental cleanup).

- [ ] **Step 3: Module validation**

```bash
cd /c/Prog/signapps-platform/client && npx tsc --noEmit 2>&1 | grep -c "error TS"    # 0
cd .. && cargo check -p signapps-calendar 2>&1 | grep -c "^error"                    # 0
cargo nextest run -p signapps-calendar 2>&1 | tail -3                                # pass
cd client && npx vitest run src/components/calendar 2>&1 | tail -5 || true          # pass if tests exist
```

Si validation fail : `git reset --hard HEAD` (discard module fixes), re-dispatch reviewer avec note "previous attempt failed on <error>", retry 1 fois. Si 2ème échec : skip + log dans `bug-sweep-todo.md`, continue.

- [ ] **Step 4: Commit**

```bash
rtk git add -A
rtk git commit -m "chore(calendar): bug sweep — N P0 + M P1 + K P2 fixes

Audited by feature-dev:code-reviewer subagent.
Findings: P0=<X>, P1=<Y>, P2=<Z>, false positives=<F>.
Fixed: all P0, all P1, <K> P2 (co-incidental).
Validation: tsc 0, cargo check 0, tests pass.

See docs/superpowers/logs/bug-sweep-2026-04-16.md#calendar"
```

- [ ] **Step 5: Journal entry**

Append to `docs/superpowers/logs/bug-sweep-2026-04-16.md`:

```markdown
## calendar (YYYY-MM-DDTHH:MM:SSZ)

Commit: <SHA>
Reviewer findings: P0=<X>, P1=<Y>, P2=<Z>
Fixed: <X> P0 + <Y> P1 + <K> P2
Skipped: <Z-K> P2 (noted for future cleanup)
False positives rejected: <F>
Validation: tsc ✓, cargo check ✓, nextest ✓
Duration: <min>
```

- [ ] **Step 6: Tag module completion (optional)**

```bash
rtk git tag bug-sweep-calendar-complete
```

---

## Task 7: Module "mail"

**Scope:**
- Frontend: `client/src/app/mail/`, `client/src/components/mail/`, `client/src/lib/api/mail*.ts`, `client/src/hooks/use-mail*.ts`
- Backend: `services/signapps-mail/`, `crates/signapps-db-mail/`

- [ ] **Step 1: Dispatch reviewer subagent**

Same prompt template as Task 6, substituting scope:

```
Scope frontend:
 - client/src/app/mail/
 - client/src/components/mail/
 - client/src/lib/api/mail*.ts
 - client/src/hooks/use-mail*.ts

Scope backend:
 - services/signapps-mail/
 - crates/signapps-db-mail/
```

- [ ] **Step 2-6:** Same workflow as Task 6 (parse → fix → validate → commit → journal). Validation:

```bash
cd client && npx tsc --noEmit 2>&1 | grep -c "error TS"
cd .. && cargo check -p signapps-mail 2>&1 | grep -c "^error"
cargo nextest run -p signapps-mail 2>&1 | tail -3
cd client && npx vitest run src/components/mail 2>&1 | tail -5 || true
```

Commit: `chore(mail): bug sweep — <counts>`. Tag: `bug-sweep-mail-complete`.

---

## Task 8: Module "org-structure"

**Scope:**
- Frontend: `client/src/app/admin/org-structure/`, `client/src/components/admin/org-*.tsx`, `client/src/types/org.ts`, `client/src/lib/api/org*.ts`
- Backend: `services/signapps-org/`

- [ ] **Step 1-6:** Same workflow.

Dispatch prompt scope :
```
Scope frontend:
 - client/src/app/admin/org-structure/ (page + components + hooks)
 - client/src/components/admin/ (files with "org" in name)
 - client/src/types/org.ts
 - client/src/lib/api/org*.ts

Scope backend:
 - services/signapps-org/
```

Validation:
```bash
cargo check -p signapps-org
cargo nextest run -p signapps-org
```

Commit: `chore(org): bug sweep — <counts>`. Tag: `bug-sweep-org-complete`.

---

## Task 9: Module "storage + drive"

**Scope:**
- Frontend: `client/src/app/storage/`, `client/src/app/drive/`, `client/src/components/storage/`, `client/src/components/drive/`, `client/src/lib/api/storage.ts`, `client/src/lib/api/drive.ts`
- Backend: `services/signapps-storage/`, `crates/signapps-db-storage/`

- [ ] **Step 1-6:** Same workflow.

Validation:
```bash
cd client && npx tsc --noEmit 2>&1 | grep -c "error TS"
cargo check -p signapps-storage
cargo nextest run -p signapps-storage
```

Commit: `chore(storage): bug sweep — <counts>`. Tag: `bug-sweep-storage-complete`.

---

## Task 10: Module "docs" (text/sheet/slide/board)

**Scope:**
- Frontend: `client/src/app/docs/`, `client/src/components/docs/`, `client/src/components/slides/`, `client/src/components/sheets/`, `client/src/components/board/`
- Backend: `services/signapps-docs/` (absorbs collab + office)

- [ ] **Step 1-6:** Same workflow.

Validation:
```bash
cd client && npx tsc --noEmit 2>&1 | grep -c "error TS"
cargo check -p signapps-docs
cargo nextest run -p signapps-docs
```

Commit: `chore(docs): bug sweep — <counts>`. Tag: `bug-sweep-docs-complete`.

---

## Task 11: Module "chat"

**Scope:**
- Frontend: `client/src/app/chat/`, `client/src/components/chat/`, `client/src/lib/api/chat.ts`, `client/src/hooks/use-chat*.ts`
- Backend: `services/signapps-chat/`

- [ ] **Step 1-6:** Same workflow.

Validation:
```bash
cargo check -p signapps-chat
cargo nextest run -p signapps-chat
```

Commit: `chore(chat): bug sweep — <counts>`. Tag: `bug-sweep-chat-complete`.

---

## Task 12: Module "meet"

**Scope:**
- Frontend: `client/src/app/meet/`, `client/src/components/meet/`, `client/src/lib/api/meet*.ts`
- Backend: `services/signapps-meet/`

- [ ] **Step 1-6:** Same workflow.

Validation:
```bash
cargo check -p signapps-meet
cargo nextest run -p signapps-meet
```

Commit: `chore(meet): bug sweep — <counts>`. Tag: `bug-sweep-meet-complete`.

---

## Task 13: Module "identity + auth"

**Scope:**
- Frontend: `client/src/app/(auth)/`, `client/src/app/login/`, `client/src/app/logout/`, `client/src/app/register/`, `client/src/app/account/`, `client/src/components/auth/`, `client/src/lib/api/auth.ts`, `client/src/lib/api/factory.ts`, `client/src/hooks/use-auth*.ts`, `client/src/stores/auth-store.ts`
- Backend: `services/signapps-identity/`, `crates/signapps-common/src/auth.rs`, `crates/signapps-db-identity/`

- [ ] **Step 1-6:** Same workflow.

Validation:
```bash
cd client && npx tsc --noEmit 2>&1 | grep -c "error TS"
cargo check -p signapps-identity -p signapps-common
cargo nextest run -p signapps-identity -p signapps-common
```

Commit: `chore(identity): bug sweep — <counts>`. Tag: `bug-sweep-identity-complete`.

---

## Task 14: Module "admin/*" (hors org, hors deploy)

**Scope:**
- Frontend: `client/src/app/admin/` (all subpaths **except** `org-structure/` done in Task 8 et `deploy/` done in earlier Phase 3b work)
- Backend: `services/signapps-tenant-config/`, `services/signapps-compliance/`, `services/signapps-backup/`, `services/signapps-webhooks/`, `services/signapps-metrics/`

- [ ] **Step 1-6:** Same workflow. **Note: ce module est potentiellement le plus gros** (66 sub-pages dans `app/admin/`). Si le reviewer trouve > 30 findings, split en sous-modules:
  - 14a: `admin/users` + `admin/roles` + `admin/organizations`
  - 14b: `admin/oauth` + `admin/integrations` + `admin/webhooks`
  - 14c: `admin/backup` + `admin/compliance` + `admin/audit`
  - 14d: le reste

Each sub-batch = 1 commit.

Validation:
```bash
cd client && npx tsc --noEmit 2>&1 | grep -c "error TS"
cargo check -p signapps-tenant-config -p signapps-compliance -p signapps-backup -p signapps-webhooks -p signapps-metrics
```

Commit(s): `chore(admin): bug sweep — <counts>`. Tag: `bug-sweep-admin-complete`.

---

## Task 15: Module "remaining"

**Scope:** tout ce qui n'a pas été couvert — workflows, tasks, contacts, it-assets, vault, notifications, billing, gateway, proxy, media, social, scheduler, securelink, pxe, ai, collaboration, gamification, signatures, workforce, et tous les `client/src/components/` non couverts par un module dédié.

- [ ] **Step 1: Enumerate remaining services + frontend zones**

```bash
ls services/ | grep -v "^signapps-\(calendar\|mail\|org\|storage\|docs\|chat\|meet\|identity\|tenant-config\|compliance\|backup\|webhooks\|metrics\)$"
ls client/src/app/ | grep -v "^\(cal\|calendar\|mail\|admin\|storage\|drive\|docs\|chat\|meet\|(auth)\|login\|logout\|register\|account\|maintenance\)$"
```

- [ ] **Step 2: Dispatch reviewer (or split into sub-batches if > 30 findings)**

Scope broadly: "all files under services/signapps-{workforce,contacts,it-assets,vault,notifications,billing,gateway,proxy,media,social,scheduler,securelink,pxe,ai,collaboration,gamification,signatures} + any frontend page/component not touched by earlier tasks".

- [ ] **Step 3-6:** Same workflow. Split en 15a/15b/15c si nécessaire.

Validation:
```bash
cargo check --workspace 2>&1 | grep -c "^error"  # 0
cd client && npx tsc --noEmit 2>&1 | grep -c "error TS"  # 0
```

Commit(s): `chore(remaining): bug sweep — <counts>`. Tag: `bug-sweep-remaining-complete`.

---

# PASS 3 — VALIDATION GLOBALE

## Task 16: Global quality pipeline

- [ ] **Step 1: Format check**

```bash
cargo fmt --all -- --check 2>&1 | tail -3
```
Expected: pas d'output. Si drift: `cargo fmt --all` + commit `style: apply cargo fmt post-sweep`.

- [ ] **Step 2: Clippy strict**

```bash
cargo clippy --workspace --all-features -- -D warnings 2>&1 | tail -5
```
Expected: pas d'erreurs sur le code SignApps (les warnings upstream sur `sqlx-postgres 0.7.4` / `imap-proto` / `redis 0.25` sont externes, acceptables).

Si warnings internes restants: les fixer, commit `fix: remaining clippy warnings post-sweep`.

- [ ] **Step 3: TypeScript strict**

```bash
cd client && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: `0`.

- [ ] **Step 4: ESLint residual count**

```bash
cd client && npx eslint src/ --max-warnings 99999 2>&1 | grep -cE "^\s+[0-9]+:"
```
Expected: ≤ 50 (de 298 baseline → réduction significative). Si > 50, noter dans journal; le reste sera adressé en Phase C (standards stricts).

- [ ] **Step 5: Full test suite**

```bash
cargo nextest run --workspace 2>&1 | tail -3
cd client && npx vitest run 2>&1 | tail -5 || echo "vitest tests absent ou partiels, OK"
```
Expected: ≥ baseline tests passing.

- [ ] **Step 6: Production build**

```bash
cd client && npm run build 2>&1 | tail -10
```
Expected: "Compiled successfully" ou équivalent. Si fail: **BLOCKER** — investiguer le dernier module touché.

---

## Task 17: Smoke E2E + services health

- [ ] **Step 1: Playwright smoke (chromium only, fast)**

```bash
cd client && npx playwright test --project=chromium --grep=smoke --reporter=list 2>&1 | tail -10
```
Expected: all smoke tests pass. Si fail: identifier quelle page casse → si régression Bug Sweep, revert le commit coupable du module concerné.

- [ ] **Step 2: Services boot check**

```bash
bash scripts/start-all.sh --skip-build 2>&1 | tail -5
```

Wait 30s puis :

```bash
netstat -ano -p TCP 2>&1 | grep LISTENING | grep -E "0\.0\.0\.0:(3[0-9]{3}|8095|8096)" | wc -l
```
Expected: `34` (33 services + gateway + deploy-server).

Tester les healthchecks principaux :

```bash
for port in 3001 3011 3012 3025 3099 3700 8095 8096; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:$port/health 2>/dev/null)
  echo "port $port: $code"
done
```
Expected: majorité 200 (certains services peuvent retourner 401 si auth — OK).

- [ ] **Step 3: Stop services**

```bash
tasklist | grep -i "signapps-" | awk '{print $2}' | xargs -I {} powershell.exe -c "Stop-Process -Id {} -Force -ErrorAction SilentlyContinue" 2>&1 | tail -1
```

---

## Task 18: Finalize — tag + summary + merge

- [ ] **Step 1: Final journal entry**

Append to `docs/superpowers/logs/bug-sweep-2026-04-16.md`:

```markdown
## Summary

Completed: <YYYY-MM-DDTHH:MM:SSZ>
Duration total: <hours>

Modules swept: 10 (calendar, mail, org, storage, docs, chat, meet, identity, admin, remaining)
Commits: <N>
Fixes applied total: P0=<X>, P1=<Y>, P2=<Z>
False positives rejected: <F>
Items in bug-sweep-todo.md: <T>

Metrics delta:
- ESLint warnings: 298 → <N>
- Clippy warnings: 3 → <M>
- Tests passing: <before> → <after>

Validation finale:
- cargo clippy -D warnings: ✓
- tsc --noEmit: 0 errors
- npm run build: SUCCESS
- cargo nextest --workspace: ≥ baseline
- playwright smoke: ✓
- services health: 34/34 ✓
```

- [ ] **Step 2: Tag**

```bash
rtk git tag -a bug-sweep-complete -m "Phase A bug sweep — all modules clean, validation ✓"
```

- [ ] **Step 3: Commit final journal + push**

```bash
rtk git add docs/superpowers/logs/bug-sweep-2026-04-16.md docs/superpowers/logs/bug-sweep-todo.md
rtk git commit -m "docs(bug-sweep): finalize Phase A journal + TODO follow-ups"
```

- [ ] **Step 4: Merge into main (fast-forward)**

```bash
rtk git checkout main
rtk git merge --ff-only feat/bug-sweep-phase-a
rtk git push origin main
rtk git push origin bug-sweep-complete
```

**NOTE : Push requires explicit user consent per CLAUDE.md safety.** Stop here and ask user "push now or hold?" before step 4 push.

---

## Review Checklist

Avant de déclarer Phase A complète, valider :

- [ ] Pass 1 commit créé et validation auto passée
- [ ] 10 modules Pass 2 committed (ou split sub-modules si nécessaire)
- [ ] Pass 3 validation globale : clippy -D, tsc 0, build SUCCESS, tests ≥ baseline, 34/34 services
- [ ] `bug-sweep-2026-04-16.md` journal rempli pour chaque module
- [ ] `bug-sweep-todo.md` ne contient AUCUN P0 ou P1 (que des P2 skipped acceptés)
- [ ] Tag `bug-sweep-complete` créé localement
- [ ] (Si autorisé) push main + tag
