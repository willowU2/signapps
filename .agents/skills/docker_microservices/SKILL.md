---
name: docker_microservices
description: Managing the 8 backend microservices via Cargo or Docker Compose
---
# Architecting Microservices & Docker

The backend is composed of 8 unique services. You must be precise about which service you are targeting.

1. **Service Boundaries**:
   - `signapps-identity` (Port 3001): Handles Users, Groups, Devices, Auth.
   - `signapps-containers` (Port 3002): Communicates with Docker via Bollard.
   - `signapps-proxy` (Port 3003): Reverse proxy (Traefik-like) handling auto-TLS.
   - `signapps-storage` (Port 3004): S3 and FS data storage abstraction.
   - `signapps-ai` (Port 3005): Embeddings, vector search, LLMs.
   - `signapps-securelink` (Port 3006): Web tunnel capabilities.
   - `signapps-scheduler` (Port 3007): Cron jobs.
   - `signapps-media` (Port 3009): Audio STT, TTS, OCR.
2. **Local Testing**: To run a single service locally without Docker:
   ```bash
   SERVER_PORT=3001 cargo run -p signapps-identity
   ```
3. **Docker Strategy**: Services should remain stateless where possible. Database state lives in PostgreSQL.
4. **Inter-Service Communication**: Use `reqwest` instances asynchronously. If modifying one service API, make sure to update the callers in another service or the frontend accordingly.
