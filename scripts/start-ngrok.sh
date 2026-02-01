#!/bin/bash

# Start ngrok with static domain for ElevenLabs webhook
# This script is run by turbo during `bun run dev`

NGROK_PATH="$HOME/bin/ngrok"
NGROK_DOMAIN="${NGROK_DOMAIN:-cheliform-claylike-eleni.ngrok-free.dev}"
PORT="${1:-3001}"

# Check if ngrok is installed
if [ ! -f "$NGROK_PATH" ]; then
    echo "[ngrok] Not installed at $NGROK_PATH - skipping"
    echo "[ngrok] Install with: curl -s -O https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-arm64.zip && unzip ngrok*.zip && mv ngrok ~/bin/"
    exit 0
fi

# Check if ngrok is already running
if curl -s http://127.0.0.1:4040/api/tunnels > /dev/null 2>&1; then
    echo "[ngrok] Already running"
    curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | head -1
    exit 0
fi

echo "[ngrok] Starting tunnel to port $PORT with domain $NGROK_DOMAIN"
exec "$NGROK_PATH" http "$PORT" --url="$NGROK_DOMAIN"
