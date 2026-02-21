# Deployment

> **Internal Documentation** — This document covers platform deployment procedures for the AgentC2 engineering team. Not published to the public documentation site.

---

## Server Details

| Detail              | Value                                     |
| ------------------- | ----------------------------------------- |
| **Host**            | 138.197.150.253                           |
| **Specs**           | 32 GB RAM / 8 vCPUs / 640 GB SSD ($96/mo) |
| **OS**              | Ubuntu 24.04 LTS                          |
| **User**            | root                                      |
| **SSH Key**         | `~/.ssh/appello_digitalocean`             |
| **App Directory**   | `/var/www/agentc2`                        |
| **Domain**          | https://agentc2.ai                        |
| **Process Manager** | PM2                                       |
| **Reverse Proxy**   | Caddy                                     |

---

## CI/CD (Primary Method)

Deployments happen automatically via GitHub Actions on push to `main`.

The workflow (`.github/workflows/deploy-do.yml`) does:

1. **Test job** (in CI): type-check + lint
2. **Deploy job** (on server via SSH): pull, install, build, restart

Features:

- Rollback safety — backs up `.next` dirs before building, restores on failure
- Crash-loop detection — verifies PM2 processes are stable after restart
- Slack notifications — posts success/failure to Slack (if `SLACK_WEBHOOK_URL` secret is configured)
- Health checks — pings `agentc2.ai` after deploy

### Required GitHub Secrets

| Secret              | Value                                           |
| ------------------- | ----------------------------------------------- |
| `DO_HOST`           | `138.197.150.253`                               |
| `DO_USERNAME`       | `root`                                          |
| `DO_SSH_KEY`        | SSH private key (`~/.ssh/appello_digitalocean`) |
| `SLACK_WEBHOOK_URL` | _(optional)_ Slack Incoming Webhook URL         |

### Optional CI Secrets

| Secret        | Value                                 |
| ------------- | ------------------------------------- |
| `TURBO_TOKEN` | Vercel Remote Cache token (free tier) |
| `TURBO_TEAM`  | Vercel team slug for remote cache     |

### Skip Tests

To deploy faster (e.g., hotfix), trigger the workflow manually with "Skip tests" checked:

- Go to Actions > "Deploy to Digital Ocean" > Run workflow > check "Skip tests"

### GitHub Actions Workflow

The full CI/CD pipeline in `.github/workflows/deploy-do.yml`:

```yaml
name: Deploy to Digital Ocean

on:
    push:
        branches: [main]
    workflow_dispatch:
        inputs:
            skip_tests:
                description: "Skip tests before deployment"
                required: false
                default: "false"
                type: boolean

concurrency:
    group: deploy-production
    cancel-in-progress: true

env:
    DEPLOY_PATH: /var/www/agentc2
    NODE_OPTIONS: "--max-old-space-size=6144"
```

**Test job** runs type-check and lint in GitHub Actions with Bun 1.3.4. **Deploy job** SSHes into the server and executes the full deploy script with rollback trap, crash-loop detection, and Slack notifications.

---

## First-Time Server Setup

### 1. Create Droplet

#### Recommended Specifications

| Spec    | Minimum          | Recommended      |
| ------- | ---------------- | ---------------- |
| RAM     | 4GB              | 8GB+             |
| vCPUs   | 2                | 4+               |
| Storage | 50GB SSD         | 80GB+ SSD        |
| OS      | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |

#### Create via DO Console

1. Go to **Create > Droplets**
2. Select **Ubuntu 24.04 (LTS) x64**
3. Choose **Basic** plan, **Regular SSD**
4. Select **4GB / 2 vCPU** or higher
5. Choose your preferred region (close to your users)
6. Add your SSH key
7. Set hostname (e.g., `mastra-prod`)
8. Click **Create Droplet**

### 2. Initial Server Setup

SSH into the new Droplet:

```bash
ssh root@YOUR_DROPLET_IP
```

#### Create Deploy User

```bash
adduser deploy
usermod -aG sudo deploy

mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Test login (in new terminal)
ssh deploy@YOUR_DROPLET_IP
```

#### Configure Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

### 3. Install Dependencies

#### Bun (JavaScript Runtime)

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version  # Should show 1.3.4 or higher
```

#### Node.js (Required for npx/MCP servers)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should show v20.x
npm --version
```

#### PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 --version
```

#### Caddy (Web Server / Reverse Proxy)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
caddy version
```

#### Playwright Dependencies

```bash
npx playwright install-deps chromium
```

#### Git

```bash
sudo apt install -y git
```

### 4. Clone Repository

```bash
sudo mkdir -p /var/www/agentc2
sudo chown deploy:deploy /var/www/agentc2

cd /var/www/agentc2
git clone https://github.com/YOUR_ORG/agentc2.git .

# Or if using SSH
git clone git@github.com:YOUR_ORG/agentc2.git .
```

### 5. Configure Environment

Create the production `.env` file:

```bash
cd /var/www/agentc2
cp .env.example .env
nano .env
```

Or copy from local machine:

```bash
scp -i ~/.ssh/appello_digitalocean .env root@138.197.150.253:/var/www/agentc2/.env
```

#### Required Environment Variables

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

### 6. Initial Build

```bash
cd /var/www/agentc2

bun install
bun run db:generate
bun run db:push
NODE_OPTIONS="--max-old-space-size=24576" bunx turbo build
```

Then start PM2 and save:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u deploy --hp /home/deploy
# Run the command it outputs
```

---

## Caddy Configuration

### Production Caddyfile

Located at `apps/caddy/Caddyfile.production`, deployed automatically by CI/CD to `/etc/caddy/Caddyfile`:

```caddyfile
agentc2.ai {
    encode gzip zstd

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }

    # Public landing page
    @landing_page {
        expression `{http.request.uri.path} == "/"`
    }

    handle @landing_page {
        reverse_proxy localhost:3001 {
            flush_interval -1
        }
    }

    # Public legal pages
    @public_legal {
        path /terms /privacy /security
    }

    handle @public_legal {
        reverse_proxy localhost:3000
    }

    # Public docs and blog pages
    @public_content {
        path /docs /docs/* /blog /blog/*
    }

    handle @public_content {
        reverse_proxy localhost:3000
    }

    # Frontend static assets (namespaced via assetPrefix: '/_home')
    @frontend_assets {
        path /_home/*
    }

    handle @frontend_assets {
        reverse_proxy localhost:3000
    }

    # Admin portal routes to admin app (port 3003)
    @admin_routes {
        path /admin*
    }

    handle @admin_routes {
        reverse_proxy localhost:3003 {
            transport http {
                read_timeout 60s
                write_timeout 60s
            }
            flush_interval -1
        }
    }

    # Embed routes -- relax X-Frame-Options for external iframes
    @embed_routes {
        path /embed/* /embed-v2/*
    }

    handle @embed_routes {
        header X-Frame-Options ""
        header Content-Security-Policy "frame-ancestors *"
        reverse_proxy localhost:3001 {
            transport http {
                read_timeout 300s
                write_timeout 300s
            }
            flush_interval -1
        }
    }

    # All other traffic routes to agent app (primary app on port 3001)
    handle {
        reverse_proxy localhost:3001 {
            transport http {
                read_timeout 300s
                write_timeout 300s
            }
            flush_interval -1
        }
    }

    log {
        output file /var/log/caddy/access.log {
            roll_size 100mb
            roll_keep 5
            roll_keep_for 720h
        }
        format json
    }
}

# Redirect www to non-www
www.agentc2.ai {
    redir https://agentc2.ai{uri} permanent
}
```

### Local Development Caddyfile

Located at `apps/caddy/Caddyfile`, used by `bun run dev`:

```caddyfile
{
    local_certs
    admin localhost:2019
}

https://catalyst.localhost {
    tls internal

    log {
        output stdout
        format console
        level ERROR
    }

    @voice_stream {
        path /voice/stream*
    }

    handle @voice_stream {
        reverse_proxy localhost:3002
    }

    @landing_page {
        expression `{http.request.uri.path} == "/"`
    }

    handle @landing_page {
        reverse_proxy localhost:3001 {
            flush_interval -1
        }
    }

    @frontend_assets {
        path /_home/*
    }

    handle @frontend_assets {
        reverse_proxy localhost:3000
    }

    @admin_routes {
        path /admin*
    }

    handle @admin_routes {
        reverse_proxy localhost:3003 {
            flush_interval -1
        }
    }

    @embed_routes {
        path /embed/*
    }

    handle @embed_routes {
        header X-Frame-Options ""
        header Content-Security-Policy "frame-ancestors *"
        reverse_proxy localhost:3001 {
            flush_interval -1
        }
    }

    handle {
        reverse_proxy localhost:3001 {
            flush_interval -1
        }
    }
}
```

### Reload Caddy

```bash
# Production
sudo systemctl reload caddy

# Check status
sudo systemctl status caddy

# View logs
sudo journalctl -u caddy -f
```

---

## PM2 Ecosystem Configuration

The `ecosystem.config.js` at the repo root:

```javascript
module.exports = {
    apps: [
        {
            name: "frontend",
            cwd: "./apps/frontend",
            script: "node_modules/.bin/next",
            args: "start",
            instances: 1,
            exec_mode: "fork",
            env: {
                NODE_ENV: "production",
                PORT: 3000
            },
            max_restarts: 10,
            min_uptime: "10s",
            restart_delay: 4000,
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            error_file: "/var/log/pm2/frontend-error.log",
            out_file: "/var/log/pm2/frontend-out.log",
            merge_logs: true,
            max_memory_restart: "2G"
        },
        {
            name: "agent",
            cwd: "./apps/agent",
            script: "node_modules/.bin/next",
            args: "start",
            instances: 1,
            exec_mode: "fork",
            env: {
                NODE_ENV: "production",
                PORT: 3001,
                BEHIND_PROXY: "true",
                PATH: process.env.PATH + ":/root/.local/bin"
            },
            max_restarts: 10,
            min_uptime: "10s",
            restart_delay: 4000,
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            error_file: "/var/log/pm2/agent-error.log",
            out_file: "/var/log/pm2/agent-out.log",
            merge_logs: true,
            max_memory_restart: "4G"
        },
        {
            name: "admin",
            cwd: "./apps/admin",
            script: "node_modules/.bin/next",
            args: "start",
            instances: 1,
            exec_mode: "fork",
            env: {
                NODE_ENV: "production",
                PORT: 3003
            },
            max_restarts: 10,
            min_uptime: "10s",
            restart_delay: 4000,
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            error_file: "/var/log/pm2/admin-error.log",
            out_file: "/var/log/pm2/admin-out.log",
            merge_logs: true,
            max_memory_restart: "512M"
        }
    ],

    deploy: {
        production: {
            user: "deploy",
            host: "your-droplet-ip",
            ref: "origin/main",
            repo: "git@github.com:your-org/agentc2.git",
            path: "/var/www/agentc2",
            "pre-deploy-local": "",
            "post-deploy":
                "bun install && bun run db:generate && bun run build && pm2 reload ecosystem.config.js --env production",
            "pre-setup": ""
        }
    }
};
```

---

## DNS Setup

Point your domain to the Droplet IP:

1. Go to your DNS provider
2. Create an A record:
    - **Name**: `@` (or your subdomain)
    - **Type**: A
    - **Value**: Your Droplet IP (e.g., `138.197.150.253`)
    - **TTL**: 300 (5 minutes for initial setup)
3. Wait for DNS propagation (5–30 minutes)
4. Caddy will automatically provision a Let's Encrypt TLS certificate

---

## Deployment Procedures

### Automated Deploy (Recommended)

Push to `main` — GitHub Actions handles everything:

1. Type-check + lint in CI
2. SSH to server, pull code, install deps, build, restart PM2
3. Crash-loop detection (15s wait, verify processes online)
4. Health check against `https://agentc2.ai`
5. Slack notification on success/failure

### Manual Deploy (Fallback)

```bash
ssh -i ~/.ssh/appello_digitalocean root@138.197.150.253

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
./scripts/deploy-do.sh 138.197.150.253 root
```

---

## Rollback Plan

### Automatic Rollback

The CI/CD pipeline includes a rollback trap. If the build or PM2 restart fails, it automatically:

1. Restores the `.next` directories from backups (preserving cache)
2. Restarts PM2 with the previous build
3. Reports failure via Slack

### Manual Rollback

If a deploy breaks production and the rollback trap didn't fire:

```bash
ssh -i ~/.ssh/appello_digitalocean root@138.197.150.253
cd /var/www/agentc2

# Restore previous build
[ -d apps/agent/.next.bak ] && rm -rf apps/agent/.next && mv apps/agent/.next.bak apps/agent/.next
[ -d apps/frontend/.next.bak ] && rm -rf apps/frontend/.next && mv apps/frontend/.next.bak apps/frontend/.next

# Restart
pm2 restart ecosystem.config.js --update-env
pm2 status
```

### Git-Based Rollback

```bash
cd /var/www/agentc2
git log --oneline -5  # Find the good commit
git reset --hard <good-commit-sha>
bun install
bun run db:generate
NODE_OPTIONS="--max-old-space-size=24576" bunx turbo build
pm2 restart ecosystem.config.js --update-env
```

---

## Monitoring

### PM2 Commands

```bash
pm2 status            # Process list with status, CPU, memory
pm2 logs              # Tail all logs
pm2 logs agent        # Tail agent app logs
pm2 logs frontend     # Tail frontend app logs
pm2 monit             # Interactive monitoring dashboard
```

### Caddy Logs

```bash
sudo tail -f /var/log/caddy/access.log   # Access log (JSON)
sudo journalctl -u caddy -f              # Caddy system log
```

### System Resources

```bash
free -h    # Memory usage
df -h      # Disk usage
htop       # CPU + processes
```

### Health Checks

```bash
curl -I https://agentc2.ai
curl -I https://agentc2.ai/login
curl https://agentc2.ai/api/mcp -H "X-API-Key: $MCP_API_KEY" -H "X-Organization-Slug: appello"
```

---

## Inngest Configuration (Production)

1. Log into [Inngest Cloud Dashboard](https://app.inngest.com)
2. Go to your app settings
3. Update the webhook URL to: `https://agentc2.ai/api/inngest`
4. Verify the connection shows "Connected"

---

## Troubleshooting

### Application Not Starting

```bash
pm2 logs --lines 100

# Check if ports are in use
sudo lsof -i :3000
sudo lsof -i :3001
sudo lsof -i :3003
```

### Caddy Not Serving HTTPS

```bash
sudo journalctl -u caddy -f

# Verify DNS is pointing to the server
dig agentc2.ai

# Reload Caddy configuration
sudo systemctl reload caddy
```

### Database Connection Issues

```bash
cd /var/www/agentc2
bun run db:studio  # Opens Prisma Studio if connection works
```

### MCP Servers Not Working

```bash
# Test MCP server manually
npx -y @hubspot/mcp-server --help

# Check if Node.js is accessible
which node
which npx
```

### Build Failures on Server

```bash
# Clear build cache
rm -rf apps/agent/.next apps/frontend/.next apps/admin/.next

# Clear node_modules and reinstall
rm -rf node_modules
bun install

# Rebuild
bun run db:generate
NODE_OPTIONS="--max-old-space-size=24576" bunx turbo build
```

### Out of Memory During Build

The 32GB server uses `--max-old-space-size=24576` (24GB heap). If builds still OOM:

```bash
# Check current memory
free -h

# Kill any orphaned processes
pm2 kill
killall node

# Build with even more memory
NODE_OPTIONS="--max-old-space-size=28672" bunx turbo build
```

---

## Maintenance

### Backup

```bash
# Database is on Supabase — use their backup features
# Application code is in Git — no backup needed

# Environment file backup (store securely!)
cp /var/www/agentc2/.env ~/backups/.env.$(date +%Y%m%d)
```

### Updates

```bash
cd /var/www/agentc2

# Standard deploy
git pull origin main
bun install
bun run db:generate
bun run build
pm2 restart all
```

### Log Rotation

PM2 logs are managed by PM2's built-in rotation. Caddy access logs rotate at 100MB, keeping 5 files for 30 days (configured in the Caddyfile).
