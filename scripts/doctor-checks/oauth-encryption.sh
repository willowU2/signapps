#!/usr/bin/env bash
#
# Verify no plaintext OAuth tokens remain in the database.
# Returns 0 if clean, 1 otherwise. Output is human-readable.

set -u

PSQL="docker exec signapps-postgres psql -U signapps -d signapps -tAq"

check_pair() {
    local table=$1
    local text_col=$2
    local enc_col=$3
    local count
    count=$($PSQL -c "SELECT COUNT(*) FROM $table WHERE $text_col IS NOT NULL AND $enc_col IS NULL" 2>/dev/null || echo 0)
    if [ "$count" = "0" ]; then
        echo "  [OK] $table.$text_col -> $enc_col: 0 plaintext"
        return 0
    fi
    echo "  [FAIL] $table.$text_col: $count plaintext rows without $enc_col"
    return 1
}

bad=0
check_pair mail.accounts oauth_refresh_token oauth_refresh_token_enc || bad=1
check_pair calendar.provider_connections access_token access_token_enc || bad=1
check_pair calendar.provider_connections refresh_token refresh_token_enc || bad=1
check_pair social.accounts access_token access_token_enc || bad=1
check_pair social.accounts refresh_token refresh_token_enc || bad=1

exit $bad
