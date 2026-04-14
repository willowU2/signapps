#!/usr/bin/env bash
#
# Report the OAuth refresh queue status:
#  - total rows in queue
#  - rows currently disabled (operator action needed)
#  - rows with consecutive_failures > 3 (warning sign)
# Exit 0 always - this is informational, not a blocker.

set -u

PSQL="docker exec signapps-postgres psql -U signapps -d signapps -tAq"

total=$($PSQL -c "SELECT COUNT(*) FROM identity.oauth_refresh_queue" 2>/dev/null || echo "?")
disabled=$($PSQL -c "SELECT COUNT(*) FROM identity.oauth_refresh_queue WHERE disabled = true" 2>/dev/null || echo "?")
warning=$($PSQL -c "SELECT COUNT(*) FROM identity.oauth_refresh_queue WHERE consecutive_failures BETWEEN 3 AND 9" 2>/dev/null || echo "?")

echo "OAuth refresh queue: $total rows ($disabled disabled, $warning warning)"
exit 0
