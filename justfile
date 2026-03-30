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

# ─────────────────────────── Run ─────────────────────────────

# Lancer un service
run svc:
    cargo run -p signapps-{{svc}}

# Lancer le frontend
dev:
    cd client && npm run dev

# Lancer tous les services (PowerShell)
start:
    powershell.exe -File scripts/start-all.ps1

# Stopper tous les services
stop:
    powershell.exe -File scripts/stop-test-services.ps1

# Status de tous les services
status:
    @echo "Frontend:  " && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "down"
    @echo "Identity:  " && curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "down"
    @echo "Calendar:  " && curl -s -o /dev/null -w "%{http_code}" http://localhost:3011/health 2>/dev/null || echo "down"

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

# Seed données démo
db-seed:
    bash scripts/seed-demo-data.sh

# ─────────────────────────── Changelog ───────────────────────

# Générer le changelog
changelog:
    git cliff -o CHANGELOG.md

# Preview changelog (sans écrire)
changelog-preview:
    git cliff --unreleased

# ─────────────────────────── CI Local ────────────────────────

# Pipeline CI complète (locale)
ci: fmt-check lint test audit deny
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

# Mise à jour des outils Cargo
update-tools:
    cargo binstall -y cargo-nextest bacon cargo-mutants git-cliff just cargo-deny cargo-audit
