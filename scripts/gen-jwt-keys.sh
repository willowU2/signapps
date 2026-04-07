#!/usr/bin/env bash
# gen-jwt-keys.sh — Generate RSA-2048 key pair for RS256 JWT signing.
#
# Usage:
#   ./scripts/gen-jwt-keys.sh [output_dir]
#
# Output:
#   jwt_private.pem  — RSA private key (identity service only, keep secret)
#   jwt_public.pem   — RSA public key (distribute to all services)
#
# The .env snippet printed at the end can be copied into your .env file.

set -euo pipefail

OUTPUT_DIR="${1:-.}"
PRIVATE_KEY="${OUTPUT_DIR}/jwt_private.pem"
PUBLIC_KEY="${OUTPUT_DIR}/jwt_public.pem"

echo "Generating RSA-2048 key pair..."

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$PRIVATE_KEY" 2>/dev/null
openssl rsa -in "$PRIVATE_KEY" -pubout -out "$PUBLIC_KEY" 2>/dev/null

chmod 600 "$PRIVATE_KEY"

echo ""
echo "Keys generated:"
echo "  Private key: $PRIVATE_KEY  (keep secret — identity service only)"
echo "  Public  key: $PUBLIC_KEY   (safe to distribute to all services)"
echo ""
echo "Add these to your .env file:"
echo ""
echo "# Identity service:"
echo "JWT_PRIVATE_KEY_PEM=\"$(awk 'NF{printf "%s\\n", $0}' "$PRIVATE_KEY")\""
echo "JWT_PUBLIC_KEY_PEM=\"$(awk 'NF{printf "%s\\n", $0}' "$PUBLIC_KEY")\""
echo ""
echo "# All other services (public key only):"
echo "JWT_PUBLIC_KEY_PEM=\"$(awk 'NF{printf "%s\\n", $0}' "$PUBLIC_KEY")\""
echo ""
echo "Note: The \\n sequences above are literal newlines in the PEM value."
echo "      Your shell or .env loader must preserve them."
