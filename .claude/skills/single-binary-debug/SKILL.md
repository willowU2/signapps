---
name: single-binary-debug
description: Use when signapps-platform fails to boot, a service task crashes repeatedly, the supervisor escalates to `failed`, or `just start` behaves differently from `just start-legacy`. Covers reading supervisor logs, sizing PgPool, detecting port conflicts, isolating a suspicious service by falling back to `just start-legacy`, and triaging lazy AI init hangs.
---

# single-binary-debug

Use this skill when debugging the `signapps-platform` single-binary runtime or any difference between it and the legacy 33-process mode.

## Architecture recap

- `signapps-platform` is a Rust binary that imports every `signapps-<svc>` crate as a library and spawns each one as a `tokio::task` bound to its canonical port (`3001`, `3002`, …, `3099`, `8095`, `8096`).
- Shared resources (PgPool, JwtConfig, Keystore, CacheService, PgEventBus) are built **once** by `signapps_service::shared_state::SharedState::init_once()`.
- A supervisor (`signapps_service::supervisor`) restarts crashed tasks with exponential backoff (1/2/4/8/16/30 s) and escalates to `failed` after 5 crashes in under 60 s.
- `signapps-ai` uses `OnceCell` lazy init for providers / tool registry — the router is cheap to build, the first AI request pays the ~5 s cost.
- Migrations run **once** on boot (only in signapps-platform); legacy binaries no longer call `run_migrations`.

## Quick triage

| Symptom | First command |
|---|---|
| Boot hangs at `shared state initialized` | `RUST_LOG=debug cargo run -p signapps-platform 2>&1 | tee /tmp/platform.log` — look for keystore unlock failure |
| One service never reaches `/health` | `just smoke`, then `rtk grep "service = \"signapps-<svc>\"" /tmp/platform.log` |
| Supervisor escalates `failed` | `rtk grep "crash loop detected" /tmp/platform.log` + 50 lines of context above |
| Platform starts but `/api/v1/auth/login` 500 | Migrations skipped because `SIGNAPPS_PLATFORM_EXIT_AFTER_BOOT` is still set — unset it |
| `address already in use: 3001` | `powershell -Command "Get-Process signapps-* | Stop-Process -Force"` then re-run |
| First AI call times out | `MODELS_DIR` unwritable, GPU detect failed — `RUST_LOG=debug` + check `signapps_runtime::gpu` lines |

## Commands

- `just start` — run signapps-platform (default)
- `just start-legacy` — fall back to 33 binaries to isolate an offender
- `just stop` / `just stop-legacy`
- `just smoke` — ping 5 critical /health endpoints
- `./scripts/bench-coldstart.sh` — regression test for cold start (fails if > 3 s)
- `cargo test -p signapps-platform --test boot -- --ignored` — asserts all 34 ports respond
- `cargo test -p signapps-platform --test service_count -- --ignored` — asserts `declare()` returns 34 specs with unique names/ports
- `cargo test -p signapps-platform --test migrations_idempotent -- --ignored` — double boot, zero migration warnings

## PgPool sizing

`SharedState::init_once` uses `signapps_db::create_pool` with default `max_connections = 20`. For 34 services running in-process, raise via `DB_MAX_CONNECTIONS=120` if you see `PoolTimedOut`.

## Port conflicts

Every service port (3001–3034, 3700, 8095, 8096, 3099) is reused by the single-binary. Before launching, stop legacy:

```bash
powershell.exe -Command "Get-Process signapps-* -ErrorAction SilentlyContinue | Stop-Process -Force"
```

Dedicated env flags turn off privileged listeners during dev/CI:

- `PROXY_ENABLED=false` — skip proxy :80/:443 ACME listeners
- `PXE_ENABLE_TFTP=false` / `PXE_ENABLE_PROXY_DHCP=false` / `PXE_ENABLE_DC=false` — skip PXE UDP listeners
- `MAIL_PROTOCOLS_ENABLED=false` — skip SMTP/IMAP/DAV/Sieve
- `CONTAINERS_ENABLED=false` — skip bollard Docker probe
- `DEPLOY_API_ENABLED=false` — skip deploy protected API
- `SCHEDULER_TICK_ENABLED=false` — skip scheduler 60 s CRON tick loop

## Isolating a faulty service

If service X crashes repeatedly in single-binary:

1. Run it legacy: `just start-legacy` then hit that service's health.
2. If legacy works and single-binary fails, the issue is shared-state related. Check: does the service expect its own `PgPool`? Does it call `Keystore::init` twice?
3. Temporarily remove `spec_<svc>` from `services/signapps-platform/src/services.rs` to confirm.

## Lazy AI init

First call to any `POST /api/v1/ai/*` endpoint loads `HardwareProfile::detect` + `ModelManager` (~5 s). Subsequent calls are fast.

If frozen on first call:
- Check `MODELS_DIR` is writable.
- Check GPU detection logs (`signapps_runtime::gpu`).
- Disable via `AI_PROVIDER_ENABLED=false` if needed.

## Related

- Spec: `docs/superpowers/specs/2026-04-18-phase-d2-architectural-perf-design.md`
- Plan: `docs/superpowers/plans/2026-04-18-phase-d2-p1-single-binary.md`
- Architecture: `docs/architecture/single-binary.md`
- Product spec: `docs/product-specs/50-perf-architecturale.md`
