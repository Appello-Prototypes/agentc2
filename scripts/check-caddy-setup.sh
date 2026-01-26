#!/usr/bin/env bash

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

ISSUES_FOUND=0

echo "🔍 Checking Caddy setup..."
echo ""

# Check if Caddy is installed
if ! command -v caddy &> /dev/null; then
    echo -e "${RED}✗${NC} Caddy is not installed"
    echo "  Install with: ${YELLOW}brew install caddy${NC}"
    ISSUES_FOUND=1
else
    echo -e "${GREEN}✓${NC} Caddy is installed"
fi

# Check if /etc/hosts entry exists
if ! grep -q "catalyst.local" /etc/hosts 2>/dev/null; then
    echo -e "${RED}✗${NC} catalyst.local not in /etc/hosts"
    echo "  Add with: ${YELLOW}echo '127.0.0.1 catalyst.local' | sudo tee -a /etc/hosts${NC}"
    ISSUES_FOUND=1
else
    echo -e "${GREEN}✓${NC} catalyst.local in /etc/hosts"
fi

# Check if Caddy CA is trusted
CADDY_CA_ROOT="$HOME/Library/Application Support/Caddy/pki/authorities/local/root.crt"
if [ ! -f "$CADDY_CA_ROOT" ]; then
    echo -e "${YELLOW}⚠${NC}  Caddy CA certificate not found"
    echo "  Run: ${YELLOW}caddy trust${NC} (will require sudo)"
    ISSUES_FOUND=1
else
    echo -e "${GREEN}✓${NC} Caddy CA certificate exists"
fi

echo ""

if [ $ISSUES_FOUND -eq 1 ]; then
    echo -e "${YELLOW}⚠ Some issues found. Fix them for full functionality.${NC}"
    echo ""
    echo "Quick setup:"
    echo "  brew install caddy"
    echo "  caddy trust"
    echo "  echo '127.0.0.1 catalyst.local' | sudo tee -a /etc/hosts"
    echo ""
    exit 1
else
    echo -e "${GREEN}✓ All checks passed!${NC}"
    exit 0
fi
