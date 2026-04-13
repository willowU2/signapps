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
check "PostgreSQL (port 5432)" "curl -s --max-time 2 http://localhost:5432 2>&1 | grep -q '' || docker exec signapps-postgres pg_isready -U signapps"

echo ""
echo "  Services:"
SERVICES="identity:3001 storage:3004 media:3009 calendar:3011 meet:3014 chat:3020"
for entry in $SERVICES; do
    name=$(echo "$entry" | cut -d: -f1)
    port=$(echo "$entry" | cut -d: -f2)
    check "signapps-$name (:$port)" "curl -sf --max-time 3 http://localhost:$port/health"
done
warn_check "frontend (:3000)" "curl -sf --max-time 3 -o /dev/null http://localhost:3000/"

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

    for entry in $SERVICES; do
        name=$(echo "$entry" | cut -d: -f1)
        port=$(echo "$entry" | cut -d: -f2)
        [ "$name" = "identity" ] && path="/api/v1/auth/me" || path="/health"
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
