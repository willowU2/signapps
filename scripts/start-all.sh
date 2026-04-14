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

# ── Load .env ───────────────────────────────────────────────────────────────
# Source .env so all services inherit the same JWT_SECRET, DATABASE_URL, etc.
ENV_FILE="$BASE_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$')
    set +a
    echo -e "  ${GREEN}[OK]${NC}   Loaded .env ($(grep -c -v '^\s*#\|^\s*$' "$ENV_FILE") vars)"
else
    echo -e "  ${YELLOW}[!!]${NC}   No .env file found — services will use defaults"
fi

# ── Service registry (loaded from scripts/ports.json) ───────────────────────
# Source the canonical ports registry — single source of truth across all scripts.
# Any port change or new service MUST update scripts/ports.json (not this file).
# shellcheck disable=SC1091
source "$BASE_DIR/scripts/ports.sh"

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

# ── Step 5: Wait for backend services to grab their ports ───────────────────
# Critical: give identity (port 3001) time to bind BEFORE starting the frontend,
# because Next.js dev server HMR can steal port 3001 if it starts first.
echo ""
echo -e "  Waiting for backend services to bind ports..."
sleep 3

# ── Step 6: Start frontend ──────────────────────────────────────────────────
if ! $SKIP_FRONTEND; then
    echo ""
    echo -e "  Starting frontend..."
    if [[ -d "$BASE_DIR/client" ]]; then
        # Use PORT=3000 explicitly. The --experimental-https or turbo HMR may
        # try to grab other ports; this is unavoidable in dev mode but identity
        # should already hold port 3001 by now.
        (cd "$BASE_DIR/client" && PORT=3000 npm run dev) > "$LOG_DIR/frontend.log" 2> "$LOG_DIR/frontend.err.log" &
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
