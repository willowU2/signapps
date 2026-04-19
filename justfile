# justfile — Commandes modernes pour SignApps Platform
# Run: just <recipe>    List: just --list
# See: https://just.systems/

# Default recipe
default:
    @just --list --unsorted

# ─────────────────────────── Build ───────────────────────────

# Check tout le workspace
check:
    cargo check --workspace --all-features

# Build debug
build:
    cargo build --workspace

# Build release (LTO)
build-release:
    cargo build --release --workspace

# Build un service spécifique
build-svc svc:
    cargo build -p signapps-{{svc}}

# ─────────────────────────── Quality ─────────────────────────

# Lint strict (clippy -D warnings)
lint:
    cargo clippy --workspace --all-features -- -D warnings

# Lint pedantic (warnings only, pour revue)
lint-pedantic:
    cargo clippy --workspace --all-features -- -W clippy::pedantic -W clippy::nursery 2>&1 | head -100

# Format check
fmt-check:
    cargo fmt --all -- --check

# Format fix
fmt:
    cargo fmt --all

# Audit sécurité
audit:
    cargo audit

# Audit licences + vulnérabilités (cargo-deny)
deny:
    cargo deny check

# Audit licences uniquement — rapide, utilisé par les hooks et CI
# Politique : voir deny.toml + memory/feedback_license_policy.md
deny-licenses:
    cargo deny check licenses

# ─────────────────────────── Tests ───────────────────────────

# Tests rapides (nextest)
test:
    cargo nextest run --workspace

# Tests d'un crate
test-crate crate:
    cargo nextest run -p {{crate}}

# Tests avec couverture (llvm-cov)
coverage:
    cargo llvm-cov --workspace --all-features --lcov --output-path lcov.info

# Tests avec couverture HTML
coverage-html:
    cargo llvm-cov --workspace --all-features --html
    @echo "Report: target/llvm-cov/html/index.html"

# Mutation testing (vérifie la pertinence des tests)
mutants:
    cargo mutants --workspace -- --all-features

# Mutation testing sur un crate
mutants-crate crate:
    cargo mutants -p {{crate}} -- --all-features

# Tests E2E frontend (Playwright)
test-e2e:
    cd client && npx playwright test

# Full E2E suite: reset seed, then run Playwright with compact reporter.
# Requires the backend to already be up (just start or just start-legacy).
e2e:
    just db-seed-reset
    cd client && npx playwright test --reporter=list

# Same as e2e but opens the Playwright UI for interactive debugging.
e2e-ui:
    just db-seed-reset
    cd client && npx playwright test --ui

# ─────────────────────────── Run ─────────────────────────────

# Lancer un service (avec .env)
run svc:
    @set -a && . .env && set +a && cargo run -p signapps-{{svc}}

# Lancer le frontend
dev:
    cd client && npm run dev

# Health check complet (DB, services, auth, compilation)
doctor:
    bash scripts/doctor.sh

# Lancer tous les services (legacy: 33 process, PowerShell)
start-legacy:
    powershell.exe -File scripts/start-all.ps1

# Lancer tous les services (single-binary, single process)
start:
    powershell.exe -File scripts/start-platform.ps1

# Stopper tous les services
stop:
    powershell.exe -File scripts/stop-test-services.ps1

# Rebuild + restart specific services (loads .env for JWT_SECRET alignment)
restart-svc +svcs:
    #!/usr/bin/env bash
    set -euo pipefail
    set -a && source .env && set +a
    for svc in {{svcs}}; do
        echo "Stopping signapps-$svc..."
        taskkill //F //IM "signapps-$svc.exe" 2>/dev/null || true
    done
    echo "Building..."
    cargo build --release $(printf -- '-p signapps-%s ' {{svcs}})
    for svc in {{svcs}}; do
        echo "Starting signapps-$svc..."
        nohup target/release/signapps-$svc.exe > data/logs/signapps-$svc.log 2> data/logs/signapps-$svc.err.log &
        echo "  PID: $!"
    done
    sleep 2
    echo "Health check:"
    for svc in {{svcs}}; do
        port=$(grep -o "\"signapps-$svc\".*port.*[0-9]*" services/signapps-$svc/src/main.rs 2>/dev/null | grep -o '[0-9]*' | tail -1 || echo "?")
        status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/health" 2>/dev/null || echo "???")
        echo "  signapps-$svc :$port → HTTP $status"
    done

# Status de tous les services
status:
    @echo "Frontend:  " && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "down"
    @echo "Identity:  " && curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "down"
    @echo "Calendar:  " && curl -s -o /dev/null -w "%{http_code}" http://localhost:3011/health 2>/dev/null || echo "down"

# Smoke check : ping 5 critical /health endpoints
smoke:
    #!/usr/bin/env bash
    for port in 3001 3005 3011 3099 8095; do
        printf "  :%-5s -> " "$port"
        curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:$port/health" || echo "DOWN"
    done

# ─────────────────────────── Database ────────────────────────

# Lancer PostgreSQL Docker
db-start:
    docker start signapps-postgres 2>/dev/null || docker run -d --name signapps-postgres -e POSTGRES_USER=signapps -e POSTGRES_PASSWORD=signapps_dev -e POSTGRES_DB=signapps -p 5432:5432 --restart unless-stopped postgres:17-alpine

# Stopper PostgreSQL
db-stop:
    docker stop signapps-postgres

# Appliquer les migrations
db-migrate:
    @for f in $(ls migrations/*.sql | sort); do echo "Running $$f..."; psql $$DATABASE_URL -f "$$f" 2>/dev/null; done

# Backup
db-backup:
    bash scripts/pg-backup.sh

# Seed données démo (Acme Corp) — signapps-seed crate
db-seed:
    cargo run --bin signapps-seed --release

# Reset + reseed (drops Acme data first)
db-seed-reset:
    cargo run --bin signapps-seed --release -- --reset

# Dry run (connectivity + validation only)
db-seed-dry:
    cargo run --bin signapps-seed --release -- --dry-run

# Run only one seeder (e.g. `just db-seed-only calendar`)
db-seed-only SERVICE:
    cargo run --bin signapps-seed --release -- --only {{SERVICE}}

# ─────────────────────────── App Logos ────────────────────────

# Fetch missing app logos (from store API + favicon APIs)
fetch-logos:
    cd client && python scripts/fetch-app-logos.py

# Fetch ALL logos (force re-download)
fetch-logos-all:
    cd client && python scripts/fetch-app-logos.py --all

# Fetch logo for a specific app
fetch-logo app:
    cd client && python scripts/fetch-app-logos.py --app {{app}}

# ─────────────────────────── Documentation ───────────────────

# Documentation Rust (interne uniquement)
docs:
    cargo doc --no-deps --workspace
    @echo "Documentation: target/doc/signapps_common/index.html"

# Documentation avec items privés
docs-private:
    cargo doc --no-deps --workspace --document-private-items
    @echo "Documentation privée: target/doc/signapps_common/index.html"

# Vérifier que la doc compile sans warnings
docs-check:
    RUSTDOCFLAGS="-D warnings" cargo doc --no-deps --workspace

# Synchroniser les README depuis lib.rs (cargo-rdme)
rdme:
    cargo rdme -w || echo "cargo-rdme: install with 'cargo binstall cargo-rdme'"

# ─────────────────────────── Changelog ───────────────────────

# Générer le changelog
changelog:
    git cliff -o CHANGELOG.md

# Preview changelog (sans écrire)
changelog-preview:
    git cliff --unreleased

# ─────────────────────────── CI Local ────────────────────────

# Pipeline CI complète (locale)
ci: fmt-check lint test audit deny docs-check
    @echo "CI passed"

# Pipeline CI rapide (check + lint)
ci-quick: check lint
    @echo "Quick CI passed"

# Feedback live (bacon)
watch:
    bacon

# ─────────────────────────── Frontend ────────────────────────

# Install dépendances frontend
install:
    cd client && npm install

# Build frontend
build-frontend:
    cd client && npm run build

# Lint frontend
lint-frontend:
    cd client && npm run lint

# ─────────────────────────── Maintenance ─────────────────────

# Clean tout
clean:
    cargo clean
    rm -rf client/.next client/node_modules/.cache

# Rotation des logs
rotate-logs:
    bash scripts/rotate-logs.sh

# Verify middleware order across all services
check-middleware:
    bash scripts/check-middleware-order.sh

# Full quality gate (pre-push check)
quality: check-middleware lint test
    cd client && npx tsc --noEmit
    @echo "Quality gate passed."

# Mise à jour des outils Cargo
update-tools:
    cargo binstall -y cargo-nextest bacon cargo-mutants git-cliff just cargo-deny cargo-audit

# ─────────────────────────── Deploy ──────────────────────────

# Deploy a version to prod (with strict confirmation). Interactive TTY required.
deploy-prod version:
    @[ -t 0 ] || { echo "Interactive terminal required (no piped input allowed)." >&2; exit 1; }
    @echo "Type 'DEPLOY PROD {{version}}' to confirm:"
    @read -r input && [ "$input" = "DEPLOY PROD {{version}}" ] || { echo "Aborted."; exit 1; }
    cargo run --release -p signapps-deploy -- deploy --env prod --version {{version}}

# Deploy a version to dev (no confirmation)
deploy-dev version:
    cargo run --release -p signapps-deploy -- deploy --env dev --version {{version}}

# Roll back the last successful deployment of prod. Interactive TTY required.
rollback-prod:
    @[ -t 0 ] || { echo "Interactive terminal required (no piped input allowed)." >&2; exit 1; }
    @echo "Type 'ROLLBACK PROD' to confirm:"
    @read -r input && [ "$input" = "ROLLBACK PROD" ] || { echo "Aborted."; exit 1; }
    cargo run --release -p signapps-deploy -- rollback --env prod

# Show deployment status
deploy-status env="prod":
    cargo run --release -p signapps-deploy -- status --env {{env}}

# ─── Staging env ────────────────────────────────────────

# Bring up the staging stack side-by-side with prod
staging-up:
    ./scripts/init-staging-db.sh
    docker compose -f docker-compose.staging.yml --env-file .env.dev up -d

# Stop the staging stack
staging-down:
    docker compose -f docker-compose.staging.yml --env-file .env.dev down

# Seed staging with demo data
staging-seed:
    ./scripts/seed-staging-data.sh

# ─── Promotion ──────────────────────────────────────────

# Promote last successful dev deployment to prod (with confirmation)
promote-to-prod:
    @[ -t 0 ] || { echo "Interactive terminal required." >&2; exit 1; }
    @echo "Type 'PROMOTE TO PROD' to confirm:"
    @read -r input && [ "$input" = "PROMOTE TO PROD" ] || { echo "Aborted."; exit 1; }
    cargo run --release -p signapps-deploy -- promote

# ─── Scheduled maintenance ──────────────────────────────

# Schedule a maintenance window
# Usage: just schedule-maintenance prod 2026-04-20T03:00:00Z 15 "DB reindex"
schedule-maintenance env at duration message:
    cargo run --release -p signapps-deploy -- schedule-maintenance \
        --env {{env}} --at {{at}} --duration-minutes {{duration}} --message "{{message}}"

# List upcoming maintenance windows
list-maintenance env="prod":
    cargo run --release -p signapps-deploy -- list-maintenance --env {{env}}

# Run the scheduler worker in the foreground (typically managed as a service)
scheduler-run:
    cargo run --release --bin signapps-deploy-scheduler
