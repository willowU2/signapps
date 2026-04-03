#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# start-stalwart.sh — Launch Stalwart Mail Server as a Docker container
#
# Stalwart is used as the internal mail server for SignApps Platform.
# It provides SMTP, IMAP, and JMAP with a built-in management API.
#
# Ports:
#   25   → SMTP (inbound mail delivery)
#   587  → SMTP Submission (authenticated outbound)
#   993  → IMAPS (TLS)
#   4190 → ManageSieve
#   8443 → HTTPS / JMAP (mapped from container 443)
#   8580 → Management API (mapped from container 8080)
#
# Volumes:
#   signapps-stalwart-data → /opt/stalwart-mail (config + data + certs)
#
# Network:
#   Joins the signapps-net Docker network so that Rust services running in
#   Docker can reach Stalwart at hostname "signapps-stalwart".
# ---------------------------------------------------------------------------

set -euo pipefail

CONTAINER_NAME="signapps-stalwart"
IMAGE="stalwartlabs/mail-server:latest"
NETWORK="signapps-net"
VOLUME="signapps-stalwart-data"

# Ensure the Docker network exists (shared with PostgreSQL, etc.)
if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  echo "Creating Docker network: $NETWORK"
  docker network create "$NETWORK"
fi

# Stop and remove existing container if present
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Stopping existing container: $CONTAINER_NAME"
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
fi

echo "Starting Stalwart Mail Server..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --network "$NETWORK" \
  -p 25:25 \
  -p 587:587 \
  -p 993:993 \
  -p 4190:4190 \
  -p 8443:443 \
  -p 8580:8080 \
  -v "${VOLUME}:/opt/stalwart-mail" \
  "$IMAGE"

echo ""
echo "Stalwart Mail Server started successfully."
echo ""
echo "  Management API : http://localhost:8580"
echo "  JMAP / HTTPS   : https://localhost:8443"
echo "  IMAP (TLS)     : localhost:993"
echo "  SMTP           : localhost:25"
echo "  SMTP Submission: localhost:587"
echo "  ManageSieve    : localhost:4190"
echo ""
echo "  Default admin credentials are set during first-run setup."
echo "  Visit http://localhost:8580 to configure."
