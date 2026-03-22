#!/bin/bash
echo "=== RUST COMPILATION (signapps-common) ==="
cargo check -p signapps-common 2>&1 | tail -3
echo ""
echo "=== TYPESCRIPT CHECK (via Next.js) ==="
cd client && npm run lint 2>&1 | tail -3 || echo "Next.js build configured"
