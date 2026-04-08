#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# check-all.sh — E2E health check for all SignApps services (Linux/macOS/WSL)
# ──────────────────────────────────────────────────────────────────────────────
# Usage:
#   ./scripts/check-all.sh               # health only
#   ./scripts/check-all.sh --api         # health + one API smoke test per service
#   ./scripts/check-all.sh --timeout 10  # custom curl timeout (seconds, default 5)
#   ./scripts/check-all.sh --help
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Parse arguments ──────────────────────────────────────────────────────────
CHECK_API=false
CURL_TIMEOUT=5

while [[ $# -gt 0 ]]; do
    case "$1" in
        --api)              CHECK_API=true; shift ;;
        --timeout)          CURL_TIMEOUT="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 [--api] [--timeout <seconds>]"
            echo ""
            echo "  --api       Also run one API smoke test per major service"
            echo "  --timeout   curl timeout in seconds (default: 5)"
            exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ── Service registry ─────────────────────────────────────────────────────────
# Format: "short_name:port:description"
SERVICES=(
    "identity:3001:Auth, LDAP/AD, MFA, RBAC"
    "containers:3002:Docker container lifecycle"
    "proxy:3003:Reverse proxy, TLS/ACME"
    "storage:3004:File storage (OpenDAL)"
    "ai:3005:AI Gateway (RAG, LLM, Vision)"
    "securelink:3006:Web tunnels, DNS"
    "scheduler:3007:CRON job management"
    "metrics:3008:System monitoring, Prometheus"
    "media:3009:STT/TTS/OCR processing"
    "docs:3010:Document editing"
    "calendar:3011:Calendar & scheduling"
    "mail:3012:Email service"
    "meet:3014:Video conferencing"
    "forms:3015:Form builder & submissions"
    "pxe:3016:PXE network boot"
    "social:3019:Social media management"
    "chat:3020:Team messaging & channels"
    "contacts:3021:Contact management"
    "it-assets:3022:IT asset management"
    "workforce:3024:HR & workforce"
    "vault:3025:Password vault & credential store"
    "org:3026:Organizational structure"
    "webhooks:3027:Outbound webhook management"
    "signatures:3028:Electronic signature workflow"
    "tenant-config:3029:Tenant branding & CSS"
    "integrations:3030:External integrations"
    "backup:3031:Database & file backups"
    "compliance:3032:Compliance, RGPD, retention"
    "notifications:8095:Push notifications"
    "billing:8096:Billing & invoicing"
    "gateway:3099:API gateway aggregator"
)

# ── API smoke tests ───────────────────────────────────────────────────────────
# Format: "port:method:path:description"
# These use the admin JWT from the environment or a default dev token.
# They expect HTTP 200 or 401 (401 = auth works, endpoint exists).
API_TESTS=(
    "3001:GET:/api/v1/users:List users"
    "3002:GET:/api/v1/containers:List containers"
    "3004:GET:/api/v1/storage/buckets:List buckets"
    "3005:GET:/api/v1/ai/models:List AI models"
    "3011:GET:/api/v1/calendars:List calendars"
    "3012:GET:/api/v1/mail/accounts:List mail accounts"
    "3015:GET:/api/v1/forms:List forms"
    "3020:GET:/api/v1/channels:List chat channels"
    "3021:GET:/api/v1/contacts:List contacts"
    "3022:GET:/api/v1/assets:List IT assets"
    "3024:GET:/api/v1/employees:List employees"
    "3025:GET:/api/v1/vault/entries:List vault entries"
    "3026:GET:/api/v1/org/trees:List org trees"
    "3027:GET:/api/v1/webhooks:List webhooks"
    "3028:GET:/api/v1/signatures:List signatures"
    "3032:GET:/api/v1/compliance/policies:List compliance policies"
    "8096:GET:/api/v1/invoices:List invoices"
    "3099:GET:/api/v1/status:Gateway status"
)

# ── Color helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'; GRAY='\033[0;90m'; BLUE='\033[0;34m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}[OK]${NC}    $1"; }
fail() { echo -e "  ${RED}[FAIL]${NC}  $1"; }
warn() { echo -e "  ${YELLOW}[SKIP]${NC}  $1"; }
info() { echo -e "  ${CYAN}[..]${NC}    $1"; }

# ── Utilities ─────────────────────────────────────────────────────────────────
check_port() {
    (echo >/dev/tcp/127.0.0.1/"$1") 2>/dev/null
}

http_health() {
    local port="$1"
    local status
    status=$(curl -sf --max-time "$CURL_TIMEOUT" -o /dev/null -w "%{http_code}" \
             "http://localhost:${port}/health" 2>/dev/null) || status="000"
    echo "$status"
}

http_api() {
    local method="$1" url="$2" token="$3"
    local status
    status=$(curl -sf --max-time "$CURL_TIMEOUT" -o /dev/null -w "%{http_code}" \
             -X "$method" \
             -H "Authorization: Bearer ${token}" \
             -H "Accept: application/json" \
             "$url" 2>/dev/null) || status="000"
    echo "$status"
}

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${MAGENTA}╔══════════════════════════════════════════╗${NC}"
echo -e "  ${MAGENTA}║     SignApps Platform — Health Check     ║${NC}"
echo -e "  ${MAGENTA}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: PostgreSQL ────────────────────────────────────────────────────────
echo -e "  ${CYAN}Checking PostgreSQL...${NC}"
echo -e "  ${GRAY}─────────────────────────────────────────${NC}"
if check_port 5432; then
    ok "PostgreSQL is running on port 5432"
else
    fail "PostgreSQL is NOT running on port 5432"
    echo ""
    echo -e "  ${RED}Fatal: database not available. Services will report unhealthy.${NC}"
    echo ""
fi

# ── Step 2: Frontend ─────────────────────────────────────────────────────────
echo ""
echo -e "  ${CYAN}Checking frontend (Next.js)...${NC}"
echo -e "  ${GRAY}─────────────────────────────────────────${NC}"
frontend_ok=true
if check_port 3000; then
    fstatus=$(curl -sf --max-time "$CURL_TIMEOUT" -o /dev/null -w "%{http_code}" \
              "http://localhost:3000" 2>/dev/null) || fstatus="000"
    if [[ "$fstatus" =~ ^(200|301|302|307|308)$ ]]; then
        ok "$(printf '%-22s %-8s %s' "frontend" ":3000" "Next.js dev server")"
    else
        fail "$(printf '%-22s %-8s HTTP %s' "frontend" ":3000" "$fstatus")"
        frontend_ok=false
    fi
else
    warn "$(printf '%-22s %-8s %s' "frontend" ":3000" "not running")"
    frontend_ok=false
fi

# ── Step 3: Backend services ──────────────────────────────────────────────────
echo ""
echo -e "  ${CYAN}Checking backend services (/health)...${NC}"
echo -e "  ${GRAY}─────────────────────────────────────────${NC}"

ok_count=0
fail_count=0
skip_count=0
failed_services=()

for entry in "${SERVICES[@]}"; do
    IFS=':' read -r name port desc <<< "$entry"

    if ! check_port "$port"; then
        warn "$(printf '%-22s %-8s %s' "signapps-$name" ":$port" "not running")"
        skip_count=$((skip_count + 1))
        continue
    fi

    http_status=$(http_health "$port")

    if [[ "$http_status" =~ ^2 ]]; then
        ok  "$(printf '%-22s %-8s HTTP %-6s %s' "signapps-$name" ":$port" "$http_status" "$desc")"
        ok_count=$((ok_count + 1))
    else
        fail "$(printf '%-22s %-8s HTTP %-6s %s' "signapps-$name" ":$port" "$http_status" "$desc")"
        fail_count=$((fail_count + 1))
        failed_services+=("$name:$port")
    fi
done

# ── Step 4: API smoke tests (optional) ───────────────────────────────────────
api_ok_count=0
api_fail_count=0

if $CHECK_API; then
    echo ""
    echo -e "  ${CYAN}Running API smoke tests...${NC}"
    echo -e "  ${GRAY}─────────────────────────────────────────${NC}"

    # Use token from environment or a default dev token (unsigned, dev only)
    API_TOKEN="${SIGNAPPS_TOKEN:-dev-admin-token}"
    if [[ -z "${SIGNAPPS_TOKEN:-}" ]]; then
        echo -e "  ${YELLOW}[!!]${NC}    SIGNAPPS_TOKEN not set — using dev token (may 401)"
    fi

    for test_entry in "${API_TESTS[@]}"; do
        IFS=':' read -r port method path desc <<< "$test_entry"

        if ! check_port "$port"; then
            warn "$(printf '%-22s %-8s %s' "$desc" ":$port" "service not running")"
            continue
        fi

        http_status=$(http_api "$method" "http://localhost:${port}${path}" "$API_TOKEN")

        # 200/201 = success, 401 = auth works (endpoint exists), 403 = authed but forbidden
        if [[ "$http_status" =~ ^(200|201|401|403)$ ]]; then
            if [[ "$http_status" =~ ^(200|201)$ ]]; then
                ok   "$(printf '%-30s %-8s HTTP %s' "$desc" ":$port" "$http_status")"
            else
                echo -e "  ${BLUE}[AUTH]${NC}  $(printf '%-30s %-8s HTTP %s (auth required)' "$desc" ":$port" "$http_status")"
            fi
            api_ok_count=$((api_ok_count + 1))
        else
            fail "$(printf '%-30s %-8s HTTP %s' "$desc" ":$port" "$http_status")"
            api_fail_count=$((api_fail_count + 1))
        fi
    done
fi

# ── Step 5: Summary ───────────────────────────────────────────────────────────
echo ""
echo -e "  ${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "  ${CYAN}║              Summary                     ║${NC}"
echo -e "  ${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

total=$((ok_count + fail_count + skip_count))
echo -e "  ${GRAY}Services checked : $total${NC}"

if (( ok_count > 0 )); then
    echo -e "  ${GREEN}Healthy          : $ok_count${NC}"
fi
if (( fail_count > 0 )); then
    echo -e "  ${RED}Unhealthy        : $fail_count${NC}"
fi
if (( skip_count > 0 )); then
    echo -e "  ${YELLOW}Not running      : $skip_count${NC}"
fi

if $CHECK_API; then
    echo ""
    echo -e "  ${GRAY}API smoke tests  : $((api_ok_count + api_fail_count))${NC}"
    if (( api_ok_count > 0 ));   then echo -e "  ${GREEN}Passed           : $api_ok_count${NC}"; fi
    if (( api_fail_count > 0 )); then echo -e "  ${RED}Failed           : $api_fail_count${NC}"; fi
fi

if (( ${#failed_services[@]} > 0 )); then
    echo ""
    echo -e "  ${RED}Failed services:${NC}"
    for svc in "${failed_services[@]}"; do
        IFS=':' read -r sname sport <<< "$svc"
        echo -e "    ${RED}• signapps-$sname (port $sport)${NC}"
    done
fi

echo ""
echo -e "  ${GRAY}─────────────────────────────────────────${NC}"

# ── Exit code ─────────────────────────────────────────────────────────────────
if (( fail_count > 0 || api_fail_count > 0 )); then
    echo -e "  ${RED}Result: UNHEALTHY${NC}"
    echo ""
    exit 1
else
    if (( ok_count == 0 && skip_count > 0 )); then
        echo -e "  ${YELLOW}Result: NO SERVICES RUNNING${NC}"
    else
        echo -e "  ${GREEN}Result: ALL HEALTHY${NC}"
    fi
    echo ""
    exit 0
fi
