#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CADDY_PID_FILE="$PROJECT_ROOT/.caddy.pid"

# Stop Caddy gracefully
if command -v caddy &> /dev/null; then
    echo "Stopping Caddy..."
    caddy stop 2>/dev/null || true
    echo "Caddy stopped"
fi

# Clean up PID file
if [ -f "$CADDY_PID_FILE" ]; then
    rm "$CADDY_PID_FILE"
fi
