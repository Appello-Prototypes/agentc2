# Production Deployment Guide

## Server Details

- **Host:** 138.197.150.253
- **User:** root
- **SSH Key:** ~/.ssh/appello_digitalocean
- **App Directory:** /var/www/mastra
- **Domain:** https://mastra.useappello.app

## Quick Deploy

```bash
# SSH to server
ssh -i ~/.ssh/appello_digitalocean root@138.197.150.253

# Deploy
cd /var/www/mastra
git pull origin main
bun install
bun run build
pm2 restart all
pm2 status
```

## First-Time Setup

1. **Copy .env to server:**

    ```bash
    scp -i ~/.ssh/appello_digitalocean .env root@138.197.150.253:/var/www/mastra/.env
    ```

2. **SSH and install:**
    ```bash
    ssh -i ~/.ssh/appello_digitalocean root@138.197.150.253
    cd /var/www/mastra
    bun install
    bun run db:generate
    bun run build
    pm2 start ecosystem.config.js
    pm2 save
    ```

## Useful Commands

```bash
# View logs
pm2 logs

# View specific app logs
pm2 logs agent
pm2 logs frontend

# Restart specific app
pm2 restart agent

# Check status
pm2 status

# Reload Caddy (after Caddyfile changes)
sudo systemctl reload caddy
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
curl -I https://mastra.useappello.app
curl https://mastra.useappello.app/api/mcp -H "X-API-Key: $MCP_API_KEY" -H "X-Organization-Slug: appello"
```
