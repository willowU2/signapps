# ──────────────────────────────────────────────────────────────────────────────
# SignApps Platform — Makefile
# ──────────────────────────────────────────────────────────────────────────────

.PHONY: help build build-release check test lint fmt start start-release \
        stop status dev clean install logs

# Default target
help: ## Show this help
	@echo ""
	@echo "  SignApps Platform — available targets"
	@echo "  ────────────────────────────────────────────────"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ── Build ────────────────────────────────────────────────────────────────────

build: ## Build all Rust services (debug) + frontend
	cargo build --workspace
	cd client && npm run build

build-release: ## Build all Rust services (release, LTO) + frontend
	cargo build --workspace --release
	cd client && npm run build

check: ## Cargo check entire workspace
	cargo check --workspace --all-features

# ── Quality ──────────────────────────────────────────────────────────────────

test: ## Run all tests (Rust + Playwright E2E)
	cargo test --workspace --all-features
	cd client && npx playwright test

test-rust: ## Run Rust tests only
	cargo test --workspace --all-features

test-e2e: ## Run Playwright E2E tests only
	cd client && npx playwright test

lint: ## Lint Rust (clippy) + TypeScript (ESLint)
	cargo clippy --workspace --all-features -- -D warnings
	cd client && npm run lint

fmt: ## Format Rust + check TypeScript
	cargo fmt --all

fmt-check: ## Check formatting without modifying files
	cargo fmt --all -- --check

audit: ## Security audit of Rust dependencies
	cargo audit

# ── Run ──────────────────────────────────────────────────────────────────────

start: ## Start all services (debug binaries + frontend)
	powershell -ExecutionPolicy Bypass -File scripts/start-all.ps1 -SkipBuild

start-release: ## Start all services (release binaries + frontend)
	powershell -ExecutionPolicy Bypass -File scripts/start-all.ps1 -SkipBuild -Release

start-build: ## Build then start all services
	powershell -ExecutionPolicy Bypass -File scripts/start-all.ps1

stop: ## Stop all running SignApps services
	powershell -ExecutionPolicy Bypass -File scripts/stop-test-services.ps1

status: ## Show status of all service ports
	@echo ""
	@echo "  SignApps Service Status"
	@echo "  ────────────────────────────────────────────────"
	@for port in 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010 \
	             3011 3012 3013 3014 3015 3016 3017 3018 3019 3020 \
	             3099 8095 8096 3000; do \
		if curl -s -o /dev/null -w "" --connect-timeout 1 http://127.0.0.1:$$port/health 2>/dev/null; then \
			printf "  \033[32m%-6s UP\033[0m\n" ":$$port"; \
		else \
			printf "  \033[90m%-6s --\033[0m\n" ":$$port"; \
		fi; \
	done
	@echo ""

dev: ## Start frontend dev server only (port 3000)
	cd client && npm run dev

dev-service: ## Start a single service: make dev-service SVC=identity
	cargo run -p signapps-$(SVC)

# ── Frontend ─────────────────────────────────────────────────────────────────

install: ## Install frontend dependencies
	cd client && npm install

# ── Maintenance ──────────────────────────────────────────────────────────────

clean: ## Clean Rust build artifacts
	cargo clean

logs: ## Tail all service logs
	@echo "Tailing data/logs/*.log — press Ctrl+C to stop"
	@tail -f data/logs/*.log 2>/dev/null || echo "No logs found in data/logs/"

db-migrate: ## Run database migrations
	cargo run -p signapps-db -- migrate

# ── CI (mirrors GitHub Actions) ─────────────────────────────────────────────

ci: check fmt-check lint test-rust audit ## Run full CI pipeline locally
	@echo ""
	@echo "  All CI checks passed!"
	@echo ""
