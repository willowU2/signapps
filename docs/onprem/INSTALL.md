# SignApps Platform — On-premise Installation Guide

This guide walks you through installing SignApps on your own server using the `signapps-installer` binary.

## Prerequisites

- A Linux server (or Windows with Docker Desktop / WSL2) with :
  - Docker Engine ≥ 24.0 OR Docker Desktop
  - 16 GB RAM minimum (32 GB recommended for the full stack)
  - 50 GB disk
  - Port 80, 443, 3000, 3001-3099, 8095, 8096 free
- A `ghcr.io` pull credential (if the images are private) — ask SignApps support.

## 1. Download the installer

From the release page provided by SignApps, download `signapps-installer-<os>-<arch>`.

```bash
chmod +x signapps-installer
sudo mv signapps-installer /usr/local/bin/
```

## 2. Initialise

```bash
sudo signapps-installer init
```

This creates `/etc/signapps/` with :
- `config.toml` — installer metadata
- `docker-compose.prod.yml` — the service stack
- `.env` — environment file you'll fill in
- `data/` — bind mount for container volumes
- `backups/` — auto-backup destination

## 3. Configure secrets

Edit `/etc/signapps/.env` :

```bash
sudo $EDITOR /etc/signapps/.env
```

Required :
- `POSTGRES_PASSWORD` — generate a strong random value
- `JWT_PRIVATE_KEY_PEM` + `JWT_PUBLIC_KEY_PEM` — generate via `scripts/gen-jwt-keys.sh` (available in the SignApps repo), OR `openssl genrsa -out jwt.pem 4096 && openssl rsa -in jwt.pem -pubout -out jwt.pub.pem`
- `SIGNAPPS_VERSION` — the version to deploy (e.g. `v1.2.3`)

Optional (defaults are sensible) :
- `LDAP_*`, `OAUTH_*`, `GHCR_TOKEN` (if images are private)

## 4. Start

```bash
sudo signapps-installer start
```

Wait ~60 seconds for all containers to become healthy, then :

```bash
sudo signapps-installer status
```

Expected : `33/33 containers healthy`.

## 5. Update

```bash
sudo signapps-installer update --version v1.2.4
```

## 6. Backup

```bash
sudo signapps-installer backup
```

Creates `/etc/signapps/backups/signapps-pg-<timestamp>.sql.gz`.

**Restore :**

```bash
gunzip -c /etc/signapps/backups/signapps-pg-XXXX.sql.gz | \
  docker exec -i signapps-postgres psql -U signapps -d signapps
```

**Note :** the built-in `backup` command only covers the Postgres database. Docker volumes (`storage_data`, `models_data`) must be snapshotted separately :

```bash
docker run --rm \
  -v signapps-prod_storage_data:/data \
  -v $(pwd):/out \
  busybox tar czf /out/storage_data-$(date +%Y%m%d).tgz /data
```

## 7. Stop

```bash
sudo signapps-installer stop
```

## Troubleshooting

- **"Cannot connect to Docker daemon"** : ensure Docker service is running (`systemctl start docker` on Linux, launch Docker Desktop on Windows/Mac).
- **Port already in use** : check with `ss -tlnp | grep :<port>`. On Windows, the Hyper-V reserved range may claim some ports — use `netsh interface ipv4 show excludedportrange protocol=tcp`.
- **Containers unhealthy** : run `docker logs signapps-<name>-1` to inspect. Share with SignApps support if unsure.
- **Backup fails on Windows** : the command shells out to `bash` for the `pg_dump | gzip` pipe. Ensure Git Bash or WSL2 is available on PATH.

## Windows-specific notes

- Default config dir : `C:\ProgramData\signapps` (override via `--config-dir`).
- Reserved port range (Hyper-V) : 2953-3653 is typically unusable for native binds. The SignApps stack runs inside Docker containers so its services are unaffected, but the installer's own HTTP endpoints (deploy server) use port 3700 by default.

## Getting help

Contact : support@signapps.example
Issue tracker : github.com/your-org/signapps-platform/issues
