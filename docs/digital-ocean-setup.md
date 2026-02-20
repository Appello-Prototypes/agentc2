# Digital Ocean Droplet Setup Guide

This guide walks through setting up a Digital Ocean Droplet for the AgentC2 AI Agent Framework.

## Prerequisites

- Digital Ocean account
- Domain name (for HTTPS)
- SSH key pair

## 1. Create Droplet

### Recommended Specifications

| Spec    | Minimum          | Recommended      |
| ------- | ---------------- | ---------------- |
| RAM     | 4GB              | 8GB              |
| vCPUs   | 2                | 4                |
| Storage | 50GB SSD         | 80GB SSD         |
| OS      | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |

### Create via DO Console

1. Go to **Create > Droplets**
2. Select **Ubuntu 24.04 (LTS) x64**
3. Choose **Basic** plan, **Regular SSD**
4. Select **4GB / 2 vCPU** or higher
5. Choose your preferred region (close to your users)
6. Add your SSH key
7. Set hostname (e.g., `mastra-prod`)
8. Click **Create Droplet**

## 2. Initial Server Setup

SSH into your new Droplet:

```bash
ssh root@YOUR_DROPLET_IP
```

### Create Deploy User

```bash
# Create deploy user
adduser deploy
usermod -aG sudo deploy

# Setup SSH for deploy user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Test login (in new terminal)
ssh deploy@YOUR_DROPLET_IP
```

### Configure Firewall

```bash
# Enable UFW firewall
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

## 3. Install Dependencies

### Bun (JavaScript Runtime)

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version  # Should show 1.3.4 or higher
```

### Node.js (Required for npx/MCP servers)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should show v20.x
npm --version
```

### PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 --version
```

### Caddy (Web Server / Reverse Proxy)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
caddy version
```

### Playwright Dependencies

```bash
# Install Playwright browser dependencies
npx playwright install-deps chromium
```

### Git

```bash
sudo apt install -y git
```

## 4. Clone Repository

```bash
# Create application directory
sudo mkdir -p /var/www/agentc2
sudo chown deploy:deploy /var/www/agentc2

# Clone repository
cd /var/www/agentc2
git clone https://github.com/YOUR_ORG/agentc2.git .

# Or if using SSH
git clone git@github.com:YOUR_ORG/agentc2.git .
```

## 5. Configure Environment

Create the production `.env` file:

```bash
cd /var/www/agentc2
cp .env.example .env
nano .env
```

### Required Environment Variables

```bash
# Database (keep using Supabase)
DATABASE_URL="postgresql://..."
DATABASE_SSL=true

# Authentication
NEXT_PUBLIC_APP_URL="https://your-domain.com"
BETTER_AUTH_SECRET="generate-a-secure-secret"

# AI Providers
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."

# Voice (ElevenLabs)
ELEVENLABS_API_KEY="..."
ELEVENLABS_AGENT_ID="..."
ELEVENLABS_WEBHOOK_SECRET="..."
ELEVENLABS_MCP_WEBHOOK_URL="https://your-domain.com/agent/api/demos/live-agent-mcp/tools"

# MCP Servers
FIRECRAWL_API_KEY="..."
HUBSPOT_ACCESS_TOKEN="..."
JIRA_URL="..."
JIRA_USERNAME="..."
JIRA_API_TOKEN="..."

# Inngest
INNGEST_EVENT_KEY="..."
INNGEST_SIGNING_KEY="..."

# Digital Ocean specific
NODE_ENV=production
BEHIND_PROXY=true
```

## 6. Initial Build

```bash
cd /var/www/agentc2

# Install dependencies
bun install

# Generate Prisma client
bun run db:generate

# Push schema (if needed)
bun run db:push

# Build applications
NODE_ENV=production bun run build
```

## 7. Configure Caddy

Edit the Caddy configuration:

```bash
sudo nano /etc/caddy/Caddyfile
```

Copy the contents from `apps/caddy/Caddyfile.production` and replace `YOUR_DOMAIN` with your actual domain:

```caddyfile
your-domain.com {
    encode gzip zstd

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }

    handle_path /agent/* {
        reverse_proxy localhost:3001 {
            transport http {
                read_timeout 300s
                write_timeout 300s
            }
        }
    }

    handle /api/inngest* {
        reverse_proxy localhost:3001 {
            transport http {
                read_timeout 300s
                write_timeout 300s
            }
        }
    }

    handle {
        reverse_proxy localhost:3000 {
            transport http {
                read_timeout 60s
                write_timeout 60s
            }
        }
    }

    log {
        output file /var/log/caddy/access.log
        format json
    }
}
```

Create log directory and reload Caddy:

```bash
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy
sudo systemctl reload caddy
```

## 8. Start Application with PM2

```bash
cd /var/www/agentc2

# Create PM2 log directory
sudo mkdir -p /var/log/pm2
sudo chown deploy:deploy /var/log/pm2

# Start applications
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u deploy --hp /home/deploy
# Run the command it outputs

# Verify processes are running
pm2 status
pm2 logs
```

## 9. Configure DNS

Point your domain to the Droplet IP:

1. Go to your DNS provider
2. Create an A record:
    - **Name**: `@` (or your subdomain)
    - **Type**: A
    - **Value**: Your Droplet IP
    - **TTL**: 300 (5 minutes for initial setup)

Wait for DNS propagation (5-30 minutes).

## 10. Configure Inngest

1. Log into [Inngest Cloud Dashboard](https://app.inngest.com)
2. Go to your app settings
3. Update the webhook URL to: `https://your-domain.com/api/inngest`
4. Verify the connection shows "Connected"

## 11. Verify Deployment

```bash
# Check PM2 status
pm2 status

# Check Caddy status
sudo systemctl status caddy

# Check application logs
pm2 logs

# Test endpoints
curl -I https://your-domain.com
curl -I https://your-domain.com/agent/api/health
```

## Troubleshooting

### Application not starting

```bash
# Check PM2 logs
pm2 logs --lines 100

# Check if ports are in use
sudo lsof -i :3000
sudo lsof -i :3001
```

### Caddy not serving HTTPS

```bash
# Check Caddy logs
sudo journalctl -u caddy -f

# Verify DNS is pointing to the server
dig your-domain.com

# Reload Caddy configuration
sudo systemctl reload caddy
```

### Database connection issues

```bash
# Test connection
cd /var/www/agentc2
bun run db:studio  # Opens Prisma Studio if connection works
```

### MCP servers not working

```bash
# Test MCP server manually
npx -y @hubspot/mcp-server --help

# Check if Node.js is accessible
which node
which npx
```

## Maintenance

### Deploy updates

```bash
cd /var/www/agentc2
./scripts/deploy-do.sh
```

Or manually:

```bash
git pull origin main
bun install
bun run db:generate
bun run build
pm2 restart all
```

### View logs

```bash
# Application logs
pm2 logs

# Caddy access logs
sudo tail -f /var/log/caddy/access.log

# System logs
sudo journalctl -u caddy -f
```

### Backup

```bash
# Database is on Supabase - use their backup features
# Application code is in Git - no backup needed

# Environment file backup (store securely!)
cp /var/www/agentc2/.env ~/backups/.env.$(date +%Y%m%d)
```
