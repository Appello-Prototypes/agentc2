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

# Note: .localhost domains automatically resolve to 127.0.0.1, no /etc/hosts needed

# Start Caddy
"$SCRIPT_DIR/start-caddy.sh"

# Navigate to project root and start Turbo dev
cd "$PROJECT_ROOT"
echo ""
echo "Starting development servers..."
echo ""

# Run turbo dev directly (not via bun run to avoid recursion)
./node_modules/.bin/turbo dev
