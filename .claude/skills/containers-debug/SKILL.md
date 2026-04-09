---
name: containers-debug
description: Debug skill for the Containers module. Backend on signapps-containers port 3002. Covers Docker container management, images, volumes, networks, and container logs via bollard.
---

# Containers — Debug Skill

## Source of truth

**`docs/product-specs/39-containers.md`** — read spec first.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-containers/` — port **3002**
- **Main**: `services/signapps-containers/src/main.rs`
- **Handlers**: `services/signapps-containers/src/handlers/`
- **Docker API**: via `bollard` crate (async Docker Engine API)
- **DB models**: `crates/signapps-db/src/models/container*.rs`

### Frontend (Next.js)
- **Pages**: `client/src/app/containers/` (list, details, images, logs)
- **Components**: `client/src/components/containers/`
- **API client**: `client/src/lib/api/containers.ts`

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `containers-root` | Containers page container |
| `container-{id}` | Container row |
| `container-start-{id}` | Start button |
| `container-stop-{id}` | Stop button |
| `container-logs-{id}` | Logs viewer |
| `container-create-btn` | Create container button |
| `image-{id}` | Image row |

## Key E2E journeys

1. **List containers** — verify running/stopped containers displayed with status
2. **Start/stop container** — stop a running container, verify status change
3. **View logs** — open container logs, verify streaming output
4. **Pull image** — pull a Docker image, verify appears in images list

## Common bug patterns

1. **Docker socket permission** — bollard cannot connect to Docker daemon; needs socket access
2. **Container log streaming** — WebSocket disconnects on long-running log tail
3. **Image pull timeout** — large images exceed default timeout; needs progress reporting

## Dependencies (license check)

- **bollard** — Apache-2.0
- **Backend**: axum, tokio — MIT/Apache-2.0
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
