# SignApps Platform

> "Le système nerveux central de votre infrastructure"

SignApps est une plateforme de gestion d'infrastructure enterprise moderne, construite en Rust pour des performances optimales et une sécurité maximale.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Reverse Proxy (signapps-proxy)                │
└─────────────────────────────────────────────────────────────────┘
                                  │
    ┌─────────────┬───────────────┼───────────────┬─────────────┐
    │             │               │               │             │
┌───▼───┐   ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐   ┌───▼───┐
│Identity│   │Containers │   │  Storage  │   │   AI/RAG   │   │Metrics│
│Service │   │ Service   │   │  Service  │   │  Service   │   │Service│
└────────┘   └───────────┘   └───────────┘   └───────────┘   └───────┘
    │             │               │               │             │
    └─────────────┴───────────────┼───────────────┴─────────────┘
                                  │
    ┌─────────────┬───────────────┼───────────────┬─────────────┐
    │             │               │               │             │
┌───▼───┐   ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐   ┌───▼───┐
│Postgres│   │   Redis   │   │  Qdrant   │   │   MinIO   │   │ vLLM  │
└────────┘   └───────────┘   └───────────┘   └───────────┘   └───────┘
```

## Services

| Service | Description | Port |
|---------|-------------|------|
| signapps-identity | Auth, AD/LDAP, MFA, RBAC | 3001 |
| signapps-containers | Docker lifecycle management | 3002 |
| signapps-proxy | Reverse proxy, SSL, SmartShield | 3003 |
| signapps-storage | Documents, MinIO, RAID | 3004 |
| signapps-ai | RAG, vLLM, Qdrant | 3005 |
| signapps-securelink | VPN mesh, Zero Trust | 3006 |
| signapps-scheduler | CRON jobs | 3007 |
| signapps-metrics | Monitoring, alertes | 3008 |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Rust 1.75+ (for development)

### Development

```bash
# Clone the repository
git clone https://github.com/signapps/signapps-platform.git
cd signapps-platform

# Copy environment file
cp .env.example .env

# Start infrastructure
docker-compose up -d postgres redis qdrant minio

# Run migrations
cargo run --package signapps-identity -- migrate

# Start a service
cargo run --package signapps-identity
```

### Production

```bash
# Build and start all services
docker-compose up -d

# Check status
docker-compose ps
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | - |
| REDIS_URL | Redis connection string | - |
| JWT_SECRET | Secret for JWT signing | - |
| MINIO_ENDPOINT | MinIO server address | - |
| QDRANT_URL | Qdrant vector DB URL | - |
| VLLM_URL | vLLM server URL | - |

### LDAP/Active Directory

SignApps supports native Active Directory authentication:

```bash
LDAP_URL=ldap://your-dc.domain.local:389
LDAP_BIND_DN=CN=service,OU=Services,DC=domain,DC=local
LDAP_BIND_PASSWORD=your_password
LDAP_BASE_DN=DC=domain,DC=local
```

## Enterprise Features

### Community (Free)
- Core features, open source
- Local authentication + basic LDAP
- Standard container management

### Pro (Self-hosted)
- Advanced LDAP/AD integration
- RBAC with hierarchical groups
- Per-user container management
- Local RAID management
- Priority email support

### Enterprise (Cloud/On-premise)
- Priority Support (SLA 99.9%)
- Custom integrations
- Dedicated account manager
- Annual security audit

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

---

Built with Rust by the SignApps Team.
