# SignApps Identity Service - Dockerfile
# Multi-stage build for minimal image size

# Build stage
FROM rust:1.75-slim-bookworm AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY services/signapps-identity ./services/signapps-identity

# Build the service
RUN cargo build --release --package signapps-identity

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy the binary
COPY --from=builder /app/target/release/signapps-identity /app/signapps-identity

# Copy migrations
COPY migrations ./migrations

# Set environment
ENV RUST_LOG=info,signapps=debug

# Expose port
EXPOSE 3000

# Run the service
CMD ["./signapps-identity"]
