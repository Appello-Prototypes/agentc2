#!/usr/bin/env bash
# setup-docker-sandbox.sh — Install Docker and build the agentc2-sandbox image
# Run on the production server as root.
# Usage: bash scripts/setup-docker-sandbox.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKERFILE="$REPO_ROOT/packages/mastra/docker/Dockerfile.sandbox"

echo "=========================================="
echo "AgentC2 Sandbox Setup"
echo "=========================================="

# ── 1. Install Docker if missing ─────────────────────────────────────
if command -v docker &>/dev/null; then
    echo "1. Docker already installed: $(docker --version)"
else
    echo "1. Installing Docker Engine..."
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin
    systemctl enable docker
    systemctl start docker
    echo "   Docker installed: $(docker --version)"
fi

# ── 2. Ensure Docker socket is accessible ────────────────────────────
echo ""
echo "2. Configuring Docker socket access..."
if id -nG root | grep -qw docker; then
    echo "   root already in docker group."
else
    usermod -aG docker root 2>/dev/null || true
    echo "   Added root to docker group."
fi

# ── 3. Create workspace directory ────────────────────────────────────
echo ""
echo "3. Creating workspace directory..."
mkdir -p /var/lib/agentc2/workspaces
chmod 755 /var/lib/agentc2/workspaces
echo "   /var/lib/agentc2/workspaces ready."

# ── 4. Build sandbox image ───────────────────────────────────────────
echo ""
echo "4. Building agentc2-sandbox Docker image..."
if [ ! -f "$DOCKERFILE" ]; then
    echo "   ERROR: Dockerfile not found at $DOCKERFILE"
    exit 1
fi

cd "$REPO_ROOT"
docker build -t agentc2-sandbox -f "$DOCKERFILE" .

HASH=$(sha256sum "$DOCKERFILE" | cut -d' ' -f1)
echo "$HASH" > /var/lib/agentc2/.sandbox-image-hash
echo "   Image built and hash stored."

# ── 5. Verify ────────────────────────────────────────────────────────
echo ""
echo "5. Verification..."
docker image inspect agentc2-sandbox --format='{{.Id}}' | head -1
echo "   Running quick test..."
docker run --rm agentc2-sandbox "echo 'Hello from agentc2-sandbox' && node --version && bun --version && python3 --version && doctl version && supabase --version"

echo ""
echo "=========================================="
echo "Sandbox setup complete!"
echo "=========================================="
