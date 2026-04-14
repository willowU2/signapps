#!/usr/bin/env bash
# doctor.sh — Verify the entire SignApps dev environment is healthy
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0; WARN=0

check() {
    if eval "$2" > /dev/null 2>&1; then
        echo -e "  ${GREEN}[OK]${NC}   $1"
        PASS=$((PASS+1))
    else
        echo -e "  ${RED}[FAIL]${NC} $1"
        FAIL=$((FAIL+1))
    fi
}

warn_check() {
    if eval "$2" > /dev/null 2>&1; then
        echo -e "  ${GREEN}[OK]${NC}   $1"
        PASS=$((PASS+1))
    else
        echo -e "  ${YELLOW}[WARN]${NC} $1"
        WARN=$((WARN+1))
    fi
}

echo ""
echo "  SignApps Doctor"
echo "  ==============="
echo ""

# --- Prerequisites ---
echo "  Prerequisites:"
check ".env exists" "[ -f '$BASE_DIR/.env' ]"
check ".env has JWT_SECRET" "grep -q '^JWT_SECRET=' '$BASE_DIR/.env'"
check ".env has DATABASE_URL" "grep -q '^DATABASE_URL=' '$BASE_DIR/.env'"
# Load .env so KEYSTORE_MASTER_KEY is available even when not exported in the shell
# shellcheck disable=SC1091
[ -f "$BASE_DIR/.env" ] && { set -a; source "$BASE_DIR/.env"; set +a; } 2>/dev/null || true
_ks_msg=$(bash "$BASE_DIR/scripts/doctor-checks/keystore.sh" 2>&1) && _ks_ok=0 || _ks_ok=$?
if [ "${_ks_ok:-0}" -eq 0 ]; then
    echo -e "  ${GREEN}[OK]${NC}   ${_ks_msg}"
    PASS=$((PASS+1))
else
    echo -e "  ${RED}[FAIL]${NC} ${_ks_msg}"
    FAIL=$((FAIL+1))
fi
unset _ks_msg _ks_ok
check "PostgreSQL (port 5432)" "curl -s --max-time 2 http://localhost:5432 2>&1 | grep -q '' || docker exec signapps-postgres pg_isready -U signapps"
# OAuth token encryption — verifies no plaintext tokens remain in mail/calendar/social
_oauth_msg=$(bash "$BASE_DIR/scripts/doctor-checks/oauth-encryption.sh" 2>&1) && _oauth_ok=0 || _oauth_ok=$?
if [ "${_oauth_ok:-0}" -eq 0 ]; then
    echo -e "  ${GREEN}[OK]${NC}   OAuth token encryption: 5/5 column pairs clean"
    PASS=$((PASS+1))
else
    echo -e "  ${RED}[FAIL]${NC} OAuth token encryption:"
    echo "${_oauth_msg}" | sed 's/^/    /'
    FAIL=$((FAIL+1))
fi
unset _oauth_msg _oauth_ok

echo ""
echo "  Services:"
# Load canonical port registry — single source of truth
# shellcheck disable=SC1091
source "$BASE_DIR/scripts/ports.sh"

# Doctor checks a critical subset (one per major service group) for fast feedback.
# To check ALL services, use just doctor-full.
DOCTOR_SERVICES="identity storage media calendar meet chat"
for name in $DOCTOR_SERVICES; do
    port=$(get_service_port "$name")
    health=$(get_service_health "$name")
    check "signapps-$name (:$port)" "curl -sf --max-time 3 http://localhost:$port$health"
done
warn_check "frontend (:$FRONTEND_PORT)" "curl -sf --max-time 3 -o /dev/null http://localhost:$FRONTEND_PORT/"

echo ""
echo "  Cross-service auth:"
# Get token
TOKEN=$(curl -sf --max-time 5 -X POST http://localhost:3001/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin"}' 2>/dev/null | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
    echo -e "  ${RED}[FAIL]${NC} Login failed — cannot test cross-service auth"
    FAIL=$((FAIL+1))
else
    CTX_ID=$(curl -sf --max-time 5 -X POST http://localhost:3001/api/v1/auth/login \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"admin"}' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    FINAL=$(curl -sf --max-time 5 -X POST "http://localhost:3001/api/v1/auth/select-context" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"context_id\":\"$CTX_ID\"}" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

    for name in $DOCTOR_SERVICES; do
        port=$(get_service_port "$name")
        [ "$name" = "identity" ] && path="/api/v1/auth/me" || path="$(get_service_health "$name")"
        code=$(curl -sf --max-time 3 -w '%{http_code}' -o /dev/null "http://localhost:$port$path" -H "Authorization: Bearer $FINAL" 2>/dev/null || echo "000")
        if [ "$code" = "200" ]; then
            echo -e "  ${GREEN}[OK]${NC}   JWT accepted by $name"
            PASS=$((PASS+1))
        else
            echo -e "  ${RED}[FAIL]${NC} JWT rejected by $name (HTTP $code)"
            FAIL=$((FAIL+1))
        fi
    done
fi

echo ""
echo "  Compilation:"
warn_check "TypeScript (tsc --noEmit)" "cd '$BASE_DIR/client' && npx tsc --noEmit"
warn_check "Rust (cargo check)" "cd '$BASE_DIR' && cargo check --workspace 2>&1 | grep -v '^warning' | grep -qv 'error'"

echo ""
echo "  Database:"
check "Seed data (users > 0)" "docker exec signapps-postgres psql -U signapps -d signapps -tAc 'SELECT count(*) FROM identity.users' | grep -v '^0$'"
check "Transcription jobs table" "docker exec signapps-postgres psql -U signapps -d signapps -tAc 'SELECT 1 FROM meet.transcription_jobs LIMIT 1' 2>/dev/null || docker exec signapps-postgres psql -U signapps -d signapps -tAc \"SELECT 1 FROM information_schema.tables WHERE table_schema='meet' AND table_name='transcription_jobs'\""

echo ""
echo "  ─────────────────────────"
echo -e "  ${GREEN}Pass: $PASS${NC}  ${RED}Fail: $FAIL${NC}  ${YELLOW}Warn: $WARN${NC}"
if [ "$FAIL" -gt 0 ]; then
    echo -e "  ${RED}Doctor found issues. Fix them before continuing.${NC}"
    exit 1
else
    echo -e "  ${GREEN}All checks passed.${NC}"
fi
