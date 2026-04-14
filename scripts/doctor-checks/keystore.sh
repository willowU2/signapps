#!/usr/bin/env bash
#
# Check that KEYSTORE_MASTER_KEY is present and well-formed.
# Called by scripts/doctor.sh.
#
# Exit code: 0 = pass, 1 = fail (output goes to stdout).

set -u

check_keystore() {
    if [ -z "${KEYSTORE_MASTER_KEY:-}" ]; then
        echo "  ❌ KEYSTORE_MASTER_KEY not set (signapps-identity will refuse to start)"
        echo "     Fix: bash scripts/generate-master-key.sh >> .env (then source .env)"
        return 1
    fi

    local len=${#KEYSTORE_MASTER_KEY}
    if [ "$len" -ne 64 ]; then
        echo "  ❌ KEYSTORE_MASTER_KEY is $len characters (expected 64 hex)"
        return 1
    fi

    if ! echo "$KEYSTORE_MASTER_KEY" | grep -qE '^[0-9a-fA-F]{64}$'; then
        echo "  ❌ KEYSTORE_MASTER_KEY contains non-hex characters"
        return 1
    fi

    local fp
    fp=$(echo -n "$KEYSTORE_MASTER_KEY" | sha256sum | cut -c1-8)
    echo "  ✅ KEYSTORE_MASTER_KEY: 64-char hex (sha256 fingerprint: $fp)"
    return 0
}

check_keystore
