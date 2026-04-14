#!/usr/bin/env bash
#
# Generate a new 32-byte master key for signapps-keystore.
# Output: 64-char hex string to stdout (no trailing metadata).
#
# Usage:
#   bash scripts/generate-master-key.sh                    # print to stdout
#   bash scripts/generate-master-key.sh > .keystore-key    # save to file (chmod 600!)
#
# Security notes:
#   - The master key is the root of trust for all encrypted fields.
#   - NEVER commit the output to git (.gitignore should cover .keystore-key).
#   - For dev, export as env var: KEYSTORE_MASTER_KEY=$(bash scripts/generate-master-key.sh)
#   - For prod, write to a file readable only by the service user (chmod 600).

set -euo pipefail

if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
elif [ -r /dev/urandom ]; then
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
    echo
else
    echo "ERROR: neither openssl nor /dev/urandom available" >&2
    exit 1
fi
