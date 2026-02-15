#!/bin/bash
#
# Digital Ocean Deployment Script (manual fallback)
#
# Deploys the Mastra AI Agent Framework to a Digital Ocean Droplet.
# Includes rollback safety — backs up .next dirs before building.
#
# The primary deploy method is GitHub Actions (.github/workflows/deploy-do.yml).
# Use this script for manual deployments when CI is not available.
#
# Prerequisites:
# - SSH access to the Droplet (32GB / 8 vCPU)
# - Bun, Node.js, PM2, and Caddy installed on the Droplet
# - Repository cloned to /var/www/mastra
# - .env file configured on the Droplet
#
# Usage:
#   ./scripts/deploy-do.sh [droplet-ip] [ssh-user]
#
# Examples:
#   ./scripts/deploy-do.sh 138.197.150.253 root
#   ./scripts/deploy-do.sh  # Uses DO_HOST and DO_USER from environment

set -euo pipefail

# Configuration
DROPLET_IP="${1:-${DO_HOST:-}}"
SSH_USER="${2:-${DO_USER:-${DO_USERNAME:-root}}}"
SSH_KEY="${DO_SSH_KEY:-}"
DEPLOY_PATH="/var/www/mastra"
BRANCH="${DEPLOY_BRANCH:-main}"

# Build SSH options
SSH_OPTS="-o StrictHostKeyChecking=accept-new"
if [ -n "$SSH_KEY" ]; then
    # Expand tilde if present
    SSH_KEY="${SSH_KEY/#\~/$HOME}"
    SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate inputs
if [ -z "$DROPLET_IP" ]; then
    log_error "Droplet IP not provided. Usage: ./deploy-do.sh [droplet-ip] [ssh-user]"
    log_error "Or set DO_HOST environment variable"
    exit 1
fi

log_info "Starting deployment to $SSH_USER@$DROPLET_IP"
log_info "Deploy path: $DEPLOY_PATH"
log_info "Branch: $BRANCH"
if [ -n "$SSH_KEY" ]; then
    log_info "Using SSH key: $SSH_KEY"
fi

# Run deployment commands on the Droplet
ssh $SSH_OPTS "$SSH_USER@$DROPLET_IP" << 'ENDSSH'
    set -euo pipefail
    export PATH="$HOME/.bun/bin:$PATH"

    DEPLOY_PATH="/var/www/mastra"

    # Rollback on failure
    rollback() {
        echo ""
        echo "!! DEPLOY FAILED — rolling back..."
        cd "$DEPLOY_PATH"
        if [ -d apps/agent/.next.bak ]; then
            rm -rf apps/agent/.next
            mv apps/agent/.next.bak apps/agent/.next
            echo "   Restored apps/agent/.next"
        fi
        if [ -d apps/frontend/.next.bak ]; then
            rm -rf apps/frontend/.next
            mv apps/frontend/.next.bak apps/frontend/.next
            echo "   Restored apps/frontend/.next"
        fi
        pm2 restart ecosystem.config.js --update-env || true
        echo "!! Rollback complete."
    }
    trap rollback ERR

    echo "=========================================="
    echo "Deploying Mastra AI Agent Framework"
    echo "=========================================="

    cd "$DEPLOY_PATH"

    echo ""
    echo "1. Pulling latest code..."
    git fetch origin
    git reset --hard origin/main

    echo ""
    echo "2. Installing dependencies..."
    bun install

    echo ""
    echo "3. Generating Prisma client..."
    bun run db:generate

    echo ""
    echo "4. Running database migrations..."
    bun run db:push || echo "Note: No schema changes"

    echo ""
    echo "5. Backing up current build..."
    rm -rf apps/agent/.next.bak apps/frontend/.next.bak
    [ -d apps/agent/.next ] && cp -r apps/agent/.next apps/agent/.next.bak
    [ -d apps/frontend/.next ] && cp -r apps/frontend/.next apps/frontend/.next.bak

    echo ""
    echo "6. Building applications..."
    NODE_OPTIONS="--max-old-space-size=8192" bunx turbo build --concurrency=1

    echo ""
    echo "7. Updating Caddy configuration..."
    sudo cp apps/caddy/Caddyfile.production /etc/caddy/Caddyfile
    sudo systemctl reload caddy || sudo systemctl restart caddy

    echo ""
    echo "8. Restarting PM2 processes..."
    pm2 restart ecosystem.config.js --update-env || pm2 start ecosystem.config.js
    pm2 save

    echo ""
    echo "9. Verifying processes (15s wait)..."
    sleep 15
    pm2 status

    echo ""
    echo "10. Cleaning up backups..."
    rm -rf apps/agent/.next.bak apps/frontend/.next.bak

    echo ""
    echo "=========================================="
    echo "Deployment complete!"
    echo "=========================================="
ENDSSH

log_info "Deployment finished successfully!"
log_info "Check the application at https://agentc2.ai"
