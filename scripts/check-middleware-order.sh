#!/usr/bin/env bash
# check-middleware-order.sh — Verify auth middleware ordering in all services
# In Axum, route_layer applies in reverse declaration order.
# tenant_context must be declared BEFORE auth_middleware so auth runs first.
set -euo pipefail
ERRORS=0
for f in services/*/src/main.rs; do
    svc=$(echo "$f" | sed 's|services/||;s|/src/main.rs||')
    # Find last occurrence of each in route_layer context
    auth_line=$(grep -n "route_layer" "$f" | grep "auth_middleware" | tail -1 | cut -d: -f1 || true)
    tenant_line=$(grep -n "route_layer" "$f" | grep "tenant_context" | tail -1 | cut -d: -f1 || true)
    [ -z "$auth_line" ] || [ -z "$tenant_line" ] && continue
    if [ "$auth_line" -lt "$tenant_line" ]; then
        echo "ERROR: $svc has wrong middleware order (auth@L$auth_line before tenant@L$tenant_line)"
        echo "  Fix: swap the two route_layer declarations so tenant_context is first"
        ERRORS=$((ERRORS+1))
    fi
done
if [ "$ERRORS" -gt 0 ]; then
    echo ""
    echo "$ERRORS service(s) have wrong middleware order. See fix instructions above."
    exit 1
fi
echo "Middleware order OK across all services."
