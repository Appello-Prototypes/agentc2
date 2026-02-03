#!/bin/bash

# Start Inngest Dev Server for local development
# This script is run by turbo during `bun run dev`

# Note: The agent app runs on port 3001 without basePath in local dev
# (basePath /agent is only used when running behind Caddy proxy)
INNGEST_APP_URL="${INNGEST_APP_URL:-http://localhost:3001/api/inngest}"
INNGEST_PORT="${INNGEST_PORT:-8288}"

# Check if Inngest CLI is available via npx
if ! command -v npx &> /dev/null; then
    echo "[inngest] npx not available - skipping"
    exit 0
fi

# Check if Inngest dev server is already running
if curl -s "http://127.0.0.1:$INNGEST_PORT/v0/health" > /dev/null 2>&1; then
    echo "[inngest] Dev server already running on port $INNGEST_PORT"
    echo "[inngest] Dashboard: http://localhost:$INNGEST_PORT"
    exit 0
fi

echo "[inngest] Starting dev server for $INNGEST_APP_URL"
echo "[inngest] Dashboard will be available at http://localhost:$INNGEST_PORT"

# Run Inngest dev server
# Note: We don't use --no-discovery so it can find the app automatically
exec npx inngest-cli@latest dev -u "$INNGEST_APP_URL" --port "$INNGEST_PORT"
