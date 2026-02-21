# Production Deployment Guide

## Server Details

- **Host:** `$DO_HOST` (set via environment or GitHub Secrets)
- **User:** `$DO_USERNAME` (default: root)
- **SSH Key:** `$DO_SSH_KEY` path
- **App Directory:** /var/www/agentc2
- **Domain:** Your configured domain
- **Process Manager:** PM2
- **Reverse Proxy:** Caddy

## CI/CD (Primary Method)

Deployments happen automatically via GitHub Actions on push to `main`.

The workflow (`.github/workflows/deploy-do.yml`) does:

1. **Test job** (in CI): type-check + lint
2. **Deploy job** (on server via SSH): pull, install, build, restart

Features:

- Rollback safety — backs up `.next` dirs before building, restores on failure
- Crash-loop detection — verifies PM2 processes are stable after restart
- Slack notifications — posts success/failure to Slack (if `SLACK_WEBHOOK_URL` secret is configured)
- Health checks — pings the configured domain after deploy

### Required GitHub Secrets

| Secret              | Value                                     |
| ------------------- | ----------------------------------------- |
| `DO_HOST`           | Your server IP                            |
| `DO_USERNAME`       | `root`                                    |
| `DO_SSH_KEY`        | SSH private key (path to your deploy key) |
| `SLACK_WEBHOOK_URL` | _(optional)_ Slack Incoming Webhook URL   |

### Skip Tests

To deploy faster (e.g., hotfix), trigger the workflow manually with "Skip tests" checked:

- Go to Actions > "Deploy to Digital Ocean" > Run workflow > check "Skip tests"

## Manual Deploy (Fallback)

If CI is unavailable, deploy manually:

```bash
# SSH to server
ssh -i $DO_SSH_KEY $DO_USERNAME@$DO_HOST

# Deploy
export PATH="$HOME/.bun/bin:$PATH"
cd /var/www/agentc2
git pull origin main
bun install
bun run db:generate
bun run db:push
NODE_OPTIONS="--max-old-space-size=24576" bunx turbo build
sudo cp apps/caddy/Caddyfile.production /etc/caddy/Caddyfile
sudo systemctl reload caddy
pm2 restart ecosystem.config.js --update-env
pm2 save
pm2 status
```

Or use the deploy script:

```bash
./scripts/deploy-do.sh $DO_HOST $DO_USERNAME
```

## Rollback

If a deploy breaks production and the rollback trap didn't fire:

```bash
ssh -i $DO_SSH_KEY $DO_USERNAME@$DO_HOST
cd /var/www/agentc2

# Restore previous build
[ -d apps/agent/.next.bak ] && rm -rf apps/agent/.next && mv apps/agent/.next.bak apps/agent/.next
[ -d apps/frontend/.next.bak ] && rm -rf apps/frontend/.next && mv apps/frontend/.next.bak apps/frontend/.next

# Restart
pm2 restart ecosystem.config.js --update-env
pm2 status
```

## First-Time Setup

1. **Copy .env to server:**

    ```bash
    scp -i $DO_SSH_KEY .env $DO_USERNAME@$DO_HOST:/var/www/agentc2/.env
    ```

2. **SSH and install:**
    ```bash
    ssh -i $DO_SSH_KEY $DO_USERNAME@$DO_HOST
    cd /var/www/agentc2
    bun install
    bun run db:generate
    bun run db:push
    NODE_OPTIONS="--max-old-space-size=24576" bunx turbo build
    pm2 start ecosystem.config.js
    pm2 save
    ```

## Useful Commands

```bash
# View logs
pm2 logs
pm2 logs agent
pm2 logs frontend

# Restart specific app
pm2 restart agent

# Check status
pm2 status

# Reload Caddy (after Caddyfile changes)
sudo systemctl reload caddy

# Check memory usage
free -h
```

## Troubleshooting

```bash
# Check if apps are running
pm2 status

# Check Caddy status
sudo systemctl status caddy

# View Caddy logs
sudo journalctl -u caddy -f

# Test endpoints
curl -I https://$DEPLOY_DOMAIN
curl https://$DEPLOY_DOMAIN/api/mcp -H "X-API-Key: $MCP_API_KEY" -H "X-Organization-Slug: $ORG_SLUG"

# Check server resources
free -h          # Memory
df -h            # Disk
htop             # CPU + processes
```
