#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Cleanup function
cleanup() {
    echo ""
    echo "Shutting down..."
    "$SCRIPT_DIR/stop-caddy.sh"
    exit 0
}

# Trap SIGINT and SIGTERM
trap cleanup SIGINT SIGTERM

# Check /etc/hosts entry
if ! grep -q "catalyst.local" /etc/hosts 2>/dev/null; then
    echo ""
    echo "WARNING: catalyst.local not found in /etc/hosts"
    echo "Add it with: echo '127.0.0.1 catalyst.local' | sudo tee -a /etc/hosts"
    echo ""
    read -p "Do you want to add it now? (requires sudo) (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "127.0.0.1 catalyst.local" | sudo tee -a /etc/hosts
        echo "Added catalyst.local to /etc/hosts"
    else
        echo "Continuing without /etc/hosts entry (DNS may not work)"
    fi
fi

# Start Caddy
"$SCRIPT_DIR/start-caddy.sh"

# Navigate to project root and start Turbo dev
cd "$PROJECT_ROOT"
echo ""
echo "Starting development servers..."
echo ""

# Run turbo dev directly (not via bun run to avoid recursion)
./node_modules/.bin/turbo dev
