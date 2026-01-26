#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CADDYFILE="$PROJECT_ROOT/apps/caddy/Caddyfile"
CADDY_PID_FILE="$PROJECT_ROOT/.caddy.pid"

# Check if Caddy is installed
if ! command -v caddy &> /dev/null; then
    echo "Error: Caddy is not installed"
    echo "Install with: brew install caddy (macOS)"
    echo "Then run: caddy trust (to install root CA)"
    exit 1
fi

# Check if Caddyfile exists
if [ ! -f "$CADDYFILE" ]; then
    echo "Error: Caddyfile not found at $CADDYFILE"
    exit 1
fi

# Check if Caddy is already running
if [ -f "$CADDY_PID_FILE" ]; then
    PID=$(cat "$CADDY_PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "Caddy is already running (PID: $PID)"
        exit 0
    else
        rm "$CADDY_PID_FILE"
    fi
fi

# Check if root CA certificate exists
CADDY_CA_ROOT="$HOME/Library/Application Support/Caddy/pki/authorities/local/root.crt"
if [ ! -f "$CADDY_CA_ROOT" ]; then
    echo ""
    echo "Caddy root CA not found. Installing CA certificate..."
    echo "This will require sudo password to trust the certificate"
    echo ""
    if caddy trust; then
        echo "✓ Caddy CA installed successfully"
    else
        echo "⚠ Warning: Failed to install Caddy CA. Browser will show certificate warnings."
        echo "You can manually run 'caddy trust' later to fix this."
    fi
    echo ""
fi

# Start Caddy in background
echo "Starting Caddy reverse proxy..."
caddy start --config "$CADDYFILE" --adapter caddyfile

# Get Caddy PID
CADDY_PID=$(pgrep -f "caddy run" | head -n 1)
if [ -n "$CADDY_PID" ]; then
    echo "$CADDY_PID" > "$CADDY_PID_FILE"
    echo "Caddy started successfully (PID: $CADDY_PID)"
    echo ""
    echo "Access your app at: https://catalyst.local"
    echo ""
else
    echo "Warning: Could not determine Caddy PID"
fi
