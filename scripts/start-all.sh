#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# start-all.sh — Start all SignApps services for development (Linux/macOS/WSL)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$BASE_DIR/data/logs"
PIDS=()
RELEASE=false
SKIP_BUILD=false
SKIP_FRONTEND=false

# ── Parse arguments ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --release)      RELEASE=true; shift ;;
        --skip-build)   SKIP_BUILD=true; shift ;;
        --skip-frontend) SKIP_FRONTEND=true; shift ;;
        -h|--help)
            echo "Usage: $0 [--release] [--skip-build] [--skip-frontend]"
            exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

BIN_DIR="$BASE_DIR/target/$(if $RELEASE; then echo release; else echo debug; fi)"

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
    "docs:3010:Document editing, real-time collaboration, and office conversion"
    "calendar:3011:Calendar & scheduling"
    "mail:3012:Email service"
    "meet:3014:Video conferencing and remote desktop"
    "forms:3015:Form builder & submissions"
    "pxe:3016:PXE network boot"
    # remote:3017 merged into meet:3014 (Refactor 35 Phase 2)
    "social:3019:Social media management"
    "chat:3020:Team messaging & channels"
    "contacts:3021:Contact management"
    "it-assets:3022:IT asset management"
    "workforce:3024:HR & workforce"
    "vault:3025:Password vault & credential store"
    "org:3026:Organizational structure (nodes, trees, assignments)"
    "webhooks:3027:Outbound webhook management and incoming webhook receiver"
    "signatures:3028:Electronic signature workflow and user stamp management"
    "tenant-config:3029:Tenant branding and CSS customization"
    "integrations:3030:External integrations (Slack, Teams, Discord)"
    "backup:3031:Database & file backup management"
    "notifications:8095:Push notifications"
    "billing:8096:Billing & invoicing"
    "gateway:3099:API gateway (aggregator)"
)

# ── Helpers ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'; GRAY='\033[0;90m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}[OK]${NC}   $1"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $1"; }
info() { echo -e "  ${CYAN}[..]${NC}   $1"; }
warn() { echo -e "  ${YELLOW}[!!]${NC}   $1"; }

check_port() {
    (echo >/dev/tcp/127.0.0.1/"$1") 2>/dev/null
}

cleanup() {
    echo ""
    echo -e "  ${YELLOW}Shutting down...${NC}"
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
    echo -e "  ${GREEN}All services stopped.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${MAGENTA}╔══════════════════════════════════════════╗${NC}"
echo -e "  ${MAGENTA}║       SignApps Platform — Start All      ║${NC}"
echo -e "  ${MAGENTA}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Check PostgreSQL ─────────────────────────────────────────────────
echo -e "  Checking prerequisites..."
if check_port 5432; then
    ok "PostgreSQL is running on port 5432"
else
    fail "PostgreSQL is NOT running on port 5432"
    warn "Services that need a database will fail to start."
fi

# ── Step 2: Build (optional) ─────────────────────────────────────────────────
if ! $SKIP_BUILD; then
    echo ""
    echo -e "  Building workspace..."
    build_args="build --workspace"
    if $RELEASE; then build_args="$build_args --release"; fi
    (cd "$BASE_DIR" && cargo $build_args)
    ok "Build succeeded"
fi

# ── Step 3: Ensure log directory ─────────────────────────────────────────────
mkdir -p "$LOG_DIR"

# ── Step 4: Start backend services ───────────────────────────────────────────
echo ""
echo -e "  Starting services..."
echo -e "  ${GRAY}─────────────────────────────────────────${NC}"

STARTED_NAMES=()
STARTED_PORTS=()
STARTED_DESCS=()

for entry in "${SERVICES[@]}"; do
    IFS=':' read -r name port desc <<< "$entry"
    bin="$BIN_DIR/signapps-$name"

    if [[ ! -x "$bin" ]]; then
        warn "$name — binary not found"
        continue
    fi

    if check_port "$port"; then
        warn "$name — port $port already in use, skipping"
        continue
    fi

    "$bin" > "$LOG_DIR/signapps-$name.log" 2> "$LOG_DIR/signapps-$name.err.log" &
    pid=$!
    PIDS+=("$pid")
    STARTED_NAMES+=("$name")
    STARTED_PORTS+=("$port")
    STARTED_DESCS+=("$desc")
    echo -e "  ${GRAY}Started ${CYAN}signapps-$name${GRAY} (PID $pid, port $port)${NC}"
done

# ── Step 5: Start frontend ──────────────────────────────────────────────────
if ! $SKIP_FRONTEND; then
    echo ""
    echo -e "  Starting frontend..."
    if [[ -d "$BASE_DIR/client" ]]; then
        (cd "$BASE_DIR/client" && npm run dev) > "$LOG_DIR/frontend.log" 2> "$LOG_DIR/frontend.err.log" &
        PIDS+=("$!")
        echo -e "  ${GRAY}Started ${CYAN}frontend${GRAY} (PID $!, port 3000)${NC}"
    else
        warn "client/ directory not found"
    fi
fi

# ── Step 6: Wait for health ─────────────────────────────────────────────────
echo ""
echo -e "  Waiting for services to become healthy..."

TIMEOUT=30
elapsed=0
while (( elapsed < TIMEOUT )); do
    all_healthy=true
    for port in "${STARTED_PORTS[@]}"; do
        if ! check_port "$port"; then
            all_healthy=false
            break
        fi
    done
    if $all_healthy; then break; fi
    sleep 1
    elapsed=$((elapsed + 1))
    echo -n "."
done
echo ""

# ── Step 7: Status report ───────────────────────────────────────────────────
echo ""
echo -e "  ${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "  ${CYAN}║           Service Status                 ║${NC}"
echo -e "  ${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

ok_count=0
fail_count=0

for i in "${!STARTED_NAMES[@]}"; do
    name="${STARTED_NAMES[$i]}"
    port="${STARTED_PORTS[$i]}"
    desc="${STARTED_DESCS[$i]}"

    if check_port "$port"; then
        echo -e "  ${GREEN}$(printf '%-22s %-8s %-10s %s' "signapps-$name" ":$port" "OK" "$desc")${NC}"
        ok_count=$((ok_count + 1))
    else
        echo -e "  ${RED}$(printf '%-22s %-8s %-10s %s' "signapps-$name" ":$port" "FAILED" "$desc")${NC}"
        fail_count=$((fail_count + 1))
    fi
done

if ! $SKIP_FRONTEND; then
    if check_port 3000; then
        echo -e "  ${GREEN}$(printf '%-22s %-8s %-10s %s' "frontend" ":3000" "OK" "Next.js dev server")${NC}"
        ok_count=$((ok_count + 1))
    else
        echo -e "  ${RED}$(printf '%-22s %-8s %-10s %s' "frontend" ":3000" "FAILED" "Next.js dev server")${NC}"
        fail_count=$((fail_count + 1))
    fi
fi

echo ""
echo -e "  ${GRAY}─────────────────────────────────────────${NC}"
color=$GREEN
if (( fail_count > 0 )); then color=$YELLOW; fi
echo -e "  ${color}Healthy: $ok_count  |  Failed: $fail_count${NC}"
echo ""

if (( ok_count > 0 )); then
    echo -e "  ${GREEN}Open http://localhost:3000 to access SignApps${NC}"
    echo -e "  ${GRAY}Logs: $LOG_DIR${NC}"
    echo ""
fi

# ── Step 8: Keep alive ──────────────────────────────────────────────────────
echo -e "  ${GRAY}Press Ctrl+C to stop all services...${NC}"
echo ""

wait
