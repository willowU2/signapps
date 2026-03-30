#!/bin/bash
# DX3: Auto-generate CHANGELOG.md from conventional commits
#
# Usage:
#   ./scripts/generate-changelog.sh                  # Last month (default)
#   ./scripts/generate-changelog.sh "3 months ago"  # Custom period
#   ./scripts/generate-changelog.sh "2025-01-01"    # Since a specific date
#
# Convention: commit messages must follow Conventional Commits format:
#   feat(scope): description
#   fix: description
#   refactor: description
#   perf: description
#   docs: description
#
# Output: CHANGELOG.md at project root

set -euo pipefail

SINCE="${1:-1 month ago}"
OUTPUT="${2:-CHANGELOG.md}"

echo "Generating $OUTPUT from commits since: $SINCE"

# Build the changelog header
cat > "$OUTPUT" << EOF
# Changelog

Generated from git history since: $SINCE
Date: $(date '+%Y-%m-%d')

EOF

# Helper: emit section if it has entries
emit_section() {
  local heading="$1"
  local pattern="$2"

  local entries
  entries=$(git log \
    --pretty=format:"%s (%h)" \
    --since="$SINCE" \
    | grep -E "^${pattern}" || true)

  if [ -n "$entries" ]; then
    echo "## $heading" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
    while IFS= read -r line; do
      # Strip the type prefix for cleaner display
      local message
      message=$(echo "$line" | sed -E "s/^${pattern}(\([^)]+\))?:?\s*//")
      echo "- $message" >> "$OUTPUT"
    done <<< "$entries"
    echo "" >> "$OUTPUT"
  fi
}

emit_section "Features"    "feat"
emit_section "Bug Fixes"   "fix"
emit_section "Refactoring" "refactor|ref"
emit_section "Performance" "perf"
emit_section "Docs"        "docs"

# Count total commits processed
TOTAL=$(git log --oneline --since="$SINCE" | wc -l | tr -d ' ')
CONV=$(git log --pretty=format:"%s" --since="$SINCE" | grep -cE "^(feat|fix|refactor|ref|perf|docs)" || true)

cat >> "$OUTPUT" << EOF
---
_$CONV conventional commits processed out of $TOTAL total commits_
EOF

echo "Done. Written to $OUTPUT"
