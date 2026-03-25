#!/bin/sh
# AQ-HOOKTST: Pre-commit hook with TypeScript type-check.
# Install: cp client/scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

echo "Running pre-commit checks..."

FILES=$(git diff --cached --name-only --diff-filter=ACM)
if [ -z "$FILES" ]; then exit 0; fi

# Secrets scan
SECRET_REGEX="(?i)(password|secret|api_?key|token|bearer|aws_access_key|private_key)\s*[:=]\s*['\"][^'\"]{8,}['\"]"
for FILE in $FILES; do
  if echo "$FILE" | grep -qE "(.lock|.png|.jpg|security_logs.txt|core_prompt.md)$"; then continue; fi
  if git diff --cached "$FILE" | grep -E "^+" | grep -Eq "$SECRET_REGEX"; then
    echo "SECURITY ALERT: Potential secret found in $FILE"
    exit 1
  fi
done
echo "Security scan passed."

# Cargo checks (Rust files)
RUST_FILES=$(echo "$FILES" | grep -E '\.rs$' || true)
if [ -n "$RUST_FILES" ]; then
  cargo fmt --all -- --check 2>/dev/null || { echo "cargo fmt failed"; exit 1; }
  cargo clippy --workspace -- -D warnings 2>/dev/null || { echo "cargo clippy failed"; exit 1; }
  echo "Rust checks passed."
fi

# AQ-HOOKTST: TypeScript type-check (TS/TSX files)
TS_FILES=$(echo "$FILES" | grep -E '\.(ts|tsx)$' || true)
if [ -n "$TS_FILES" ]; then
  echo "Running tsc --noEmit..."
  (cd client && npx tsc --noEmit 2>/dev/null) || {
    echo "TypeScript type errors found. Run: cd client && npx tsc --noEmit"
    exit 1
  }
  echo "tsc passed."
fi

exit 0
