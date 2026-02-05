#!/bin/bash
#
# Digital Ocean Deployment Script
#
# Deploys the Mastra AI Agent Framework to a Digital Ocean Droplet
#
# Prerequisites:
# - SSH access to the Droplet
# - Bun, Node.js, PM2, and Caddy installed on the Droplet
# - Repository cloned to /var/www/mastra
# - .env file configured on the Droplet
#
# Usage:
#   ./scripts/deploy-do.sh [droplet-ip] [ssh-user]
#
# Examples:
#   ./scripts/deploy-do.sh 123.45.67.89 deploy
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
ssh $SSH_OPTS "$SSH_USER@$DROPLET_IP" << ENDSSH
    set -euo pipefail

    echo "=========================================="
    echo "Deploying Mastra AI Agent Framework"
    echo "=========================================="

    cd $DEPLOY_PATH

    echo ""
    echo "1. Pulling latest code from $BRANCH..."
    git fetch origin
    git checkout $BRANCH
    git pull origin $BRANCH

    echo ""
    echo "2. Installing dependencies..."
    bun install

    echo ""
    echo "3. Generating Prisma client..."
    bun run db:generate

    echo ""
    echo "4. Running database migrations..."
    bun run db:push || echo "Note: db:push may have no changes"

    echo ""
    echo "5. Building applications..."
    NODE_ENV=production bun run build

    echo ""
    echo "6. Restarting PM2 processes..."
    pm2 restart ecosystem.config.js --update-env || pm2 start ecosystem.config.js

    echo ""
    echo "7. Saving PM2 process list..."
    pm2 save

    echo ""
    echo "8. Checking application status..."
    pm2 status

    echo ""
    echo "=========================================="
    echo "Deployment complete!"
    echo "=========================================="
ENDSSH

log_info "Deployment finished successfully!"
log_info "Check the application at https://your-domain.com"
