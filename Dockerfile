# ─────────────────────────────────────────────────────────────────────────────
# SignApps Platform — Multi-stage production Dockerfile
#
# Produces a single slim image containing all Rust service binaries.
# Each service is started via its own `command:` in docker-compose.prod.yml.
#
# Build:
#   docker build --target runtime -t signapps-platform .
#
# Stages:
#   chef     — installs cargo-chef once (cached layer)
#   planner  — generates recipe.json for dependency fingerprint
#   builder  — compiles deps from recipe, then the full workspace
#   frontend — builds the Next.js production bundle
#   runtime  — minimal debian:bookworm-slim image with all binaries + static files
# ─────────────────────────────────────────────────────────────────────────────

# ─── Stage 1: cargo-chef base ────────────────────────────────────────────────
FROM rust:1.82-slim-bookworm AS chef

RUN apt-get update && apt-get install -y --no-install-recommends \
        pkg-config \
        libssl-dev \
        libpq-dev \
        protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Install cargo-chef for layer-cached dependency builds
RUN cargo install cargo-chef --locked --version 0.1.68

WORKDIR /app

# ─── Stage 2: dependency planner ─────────────────────────────────────────────
FROM chef AS planner

COPY . .

# Generate the recipe — captures the full workspace dependency tree.
# cargo-chef prepare walks Cargo.toml and produces a minimal recipe.json
# that can be used to pre-build all dependencies before copying source.
RUN cargo chef prepare --recipe-path recipe.json

# ─── Stage 3: dependency cache ───────────────────────────────────────────────
FROM chef AS builder

# Restore dependency cache using the recipe (unchanged if deps haven't changed)
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

# Copy full source and build the workspace (skipping Tauri desktop app)
COPY . .

# SQLX offline mode: use pre-generated query metadata so we don't need a live DB
ENV SQLX_OFFLINE=true

RUN cargo build --release --workspace \
        --exclude src-tauri \
    && ls -lh target/release/signapps-* | grep -v '\.d$'

# ─── Stage 4: frontend builder ───────────────────────────────────────────────
FROM node:22-slim AS frontend-builder

WORKDIR /app/client

# Install dependencies first (cached layer when only source changes)
COPY client/package.json client/pnpm-lock.yaml ./
RUN npm install -g pnpm@9 && pnpm install --frozen-lockfile

# Copy source and build
COPY client/ .

# Standalone output for minimal runtime footprint
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ─── Stage 5: production runtime ─────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

# Runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        libssl3 \
        libpq5 \
        wget \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r signapps \
    && useradd -r -g signapps -d /app -s /sbin/nologin signapps

WORKDIR /app

# Copy all service binaries from builder stage
COPY --from=builder --chown=signapps:signapps \
    /app/target/release/signapps-identity \
    /app/target/release/signapps-containers \
    /app/target/release/signapps-proxy \
    /app/target/release/signapps-storage \
    /app/target/release/signapps-ai \
    /app/target/release/signapps-securelink \
    /app/target/release/signapps-scheduler \
    /app/target/release/signapps-metrics \
    /app/target/release/signapps-media \
    /app/target/release/signapps-docs \
    /app/target/release/signapps-calendar \
    /app/target/release/signapps-mail \
    /app/target/release/signapps-meet \
    /app/target/release/signapps-forms \
    /app/target/release/signapps-pxe \
    /app/target/release/signapps-social \
    /app/target/release/signapps-chat \
    /app/target/release/signapps-contacts \
    /app/target/release/signapps-it-assets \
    /app/target/release/signapps-workforce \
    /app/target/release/signapps-vault \
    /app/target/release/signapps-org \
    /app/target/release/signapps-webhooks \
    /app/target/release/signapps-signatures \
    /app/target/release/signapps-tenant-config \
    /app/target/release/signapps-integrations \
    /app/target/release/signapps-backup \
    /app/target/release/signapps-compliance \
    /app/target/release/signapps-notifications \
    /app/target/release/signapps-billing \
    /app/target/release/signapps-gateway \
    /app/target/release/signapps-agent \
    /app/bin/

# Default entrypoint runs the API gateway (overridden per-service in compose)
USER signapps
EXPOSE 3099
CMD ["/app/bin/signapps-gateway"]

LABEL org.opencontainers.image.title="SignApps Platform" \
      org.opencontainers.image.description="SignApps microservices — all Rust binaries" \
      org.opencontainers.image.vendor="SignApps" \
      org.opencontainers.image.licenses="MIT"
