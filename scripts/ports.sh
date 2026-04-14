#!/usr/bin/env bash
# ports.sh — Source unique de vérité des ports (lit scripts/ports.json)
# Usage: source scripts/ports.sh && for entry in "${SERVICES[@]}"; do ...
#
# Exporte:
#   - $FRONTEND_PORT
#   - SERVICES[] : tableau de "name:port:health_path"
#   - get_service_port "name" : renvoie le port du service
#   - get_service_health "name" : renvoie le health path

PORTS_JSON="$(dirname "${BASH_SOURCE[0]}")/ports.json"

if [ ! -f "$PORTS_JSON" ]; then
    echo "ERROR: ports.json not found at $PORTS_JSON" >&2
    return 1 2>/dev/null || exit 1
fi

# On Windows/Git Bash, convert /c/Prog/... → C:/Prog/... for python compatibility
case "$PORTS_JSON" in
    /[a-z]/*)
        DRIVE="${PORTS_JSON:1:1}"
        REST="${PORTS_JSON:2}"
        PORTS_JSON_PY="${DRIVE^^}:$REST"
        ;;
    *)
        PORTS_JSON_PY="$PORTS_JSON"
        ;;
esac

# Frontend port
FRONTEND_PORT=$(grep -oE '"port":\s*[0-9]+' "$PORTS_JSON" | head -1 | grep -oE '[0-9]+')

# Build SERVICES array from JSON
SERVICES=()
# Use python to parse cleanly since jq may not be available on Windows
if command -v python3 >/dev/null 2>&1; then
    while IFS= read -r line; do
        SERVICES+=("$line")
    done < <(python3 -c "
import json
with open(r'$PORTS_JSON_PY') as f:
    data = json.load(f)
for s in data['services']:
    print(f\"{s['name']}:{s['port']}:{s.get('health_path','/health')}\")
")
else
    # Fallback: parse with grep/sed (less robust)
    while IFS= read -r line; do
        SERVICES+=("$line")
    done < <(awk '/"name":/ { name=$0 } /"port":/ { port=$0 } /"health_path":/ {
        gsub(/.*"name":\s*"/, "", name); gsub(/".*/, "", name);
        gsub(/.*"port":\s*/, "", port); gsub(/[^0-9].*/, "", port);
        gsub(/.*"health_path":\s*"/, "", $0); gsub(/".*/, "", $0);
        print name ":" port ":" $0
    }' "$PORTS_JSON")
fi

# Helper: get port for a service name
get_service_port() {
    local target="$1"
    for entry in "${SERVICES[@]}"; do
        local name="${entry%%:*}"
        if [ "$name" = "$target" ]; then
            local rest="${entry#*:}"
            echo "${rest%%:*}"
            return 0
        fi
    done
    return 1
}

# Helper: get health path for a service name
get_service_health() {
    local target="$1"
    for entry in "${SERVICES[@]}"; do
        local name="${entry%%:*}"
        if [ "$name" = "$target" ]; then
            echo "${entry##*:}"
            return 0
        fi
    done
    echo "/health"
}

export FRONTEND_PORT
export -f get_service_port
export -f get_service_health
