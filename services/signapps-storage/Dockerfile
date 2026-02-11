# SignApps Storage Service - Dockerfile
FROM rust:latest AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY services ./services
COPY migrations ./migrations

RUN cargo build --release --package signapps-storage

FROM debian:trixie-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/signapps-storage /app/signapps-storage

ENV RUST_LOG=info,signapps=debug

EXPOSE 3000

CMD ["./signapps-storage"]
