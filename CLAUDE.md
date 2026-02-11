# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and Cursor AI when working with code in this repository.

---

## CRITICAL MINDSET: DO THE JOB RIGHT

**NEVER BE LAZY. NEVER TAKE SHORTCUTS. NEVER DO THE EASY THING TO SAVE TIME.**

This is a production-grade AI agent framework. Every change you make affects real systems with real integrations. When working on this codebase:

1. **Follow the plan completely** - If there's a plan, execute EVERY step. Do not skip steps because they seem tedious.
2. **Read before you write** - ALWAYS read existing code thoroughly before making changes. Understand the context.
3. **Test your changes** - Verify your work compiles, lints, and functions correctly before declaring done.
4. **Be thorough, not fast** - Quality over speed. A proper implementation now saves hours of debugging later.
5. **Ask if uncertain** - When in doubt, ask for clarification rather than guessing.
6. **Complete the task** - Partial implementations are worse than no implementation. Finish what you start.

**Failure to follow these principles wastes the user's time and creates technical debt.**

---

## System Overview

This is the **Mastra AI Agent Framework** - a production-grade Turborepo monorepo for building, deploying, and orchestrating AI agents. The system integrates multiple AI providers, voice capabilities, MCP (Model Context Protocol) servers, RAG (Retrieval Augmented Generation), background job processing, and a comprehensive UI for agent management.

### Primary Purpose

- Build and deploy AI agents with multiple LLM backends (OpenAI, Anthropic)
- Voice-enabled agents using ElevenLabs and OpenAI voice APIs
- MCP integrations for external tools (HubSpot CRM, Jira, Firecrawl, Playwright, JustCall, ATLAS/n8n, Fathom, Slack, Google Drive, GitHub)
- RAG pipeline for document ingestion and semantic search
- Database-driven agent configuration with version control
- Background job processing with Inngest
- Real-time webhooks via ngrok for ElevenLabs live agents

---

## Core Technology Stack

### Framework & Runtime

| Technology     | Version | Purpose                                      |
| -------------- | ------- | -------------------------------------------- |
| **Bun**        | 1.3.4+  | Package manager and JavaScript runtime       |
| **Turborepo**  | 2.3.3+  | Monorepo build system and task orchestration |
| **Next.js**    | 16.1.0  | React framework with App Router              |
| **React**      | 19.2.3  | UI library                                   |
| **TypeScript** | 5.x     | Type-safe JavaScript                         |

### AI & Agent Framework

| Technology        | Package                                  | Purpose                                          |
| ----------------- | ---------------------------------------- | ------------------------------------------------ |
| **Mastra Core**   | `@mastra/core`                           | Agent framework, workflows, orchestration        |
| **Mastra MCP**    | `@mastra/mcp`                            | Model Context Protocol client for external tools |
| **Mastra Memory** | `@mastra/memory`                         | Conversation memory and semantic recall          |
| **Mastra RAG**    | `@mastra/rag`                            | Document ingestion, chunking, vector search      |
| **Mastra Evals**  | `@mastra/evals`                          | Agent evaluation and scoring                     |
| **AI SDK**        | `ai`, `@ai-sdk/openai`, `@mastra/ai-sdk` | AI SDK for streaming and tools                   |

### Voice Capabilities

| Technology            | Package                    | Purpose                       |
| --------------------- | -------------------------- | ----------------------------- |
| **ElevenLabs Voice**  | `@mastra/voice-elevenlabs` | Text-to-speech, voice cloning |
| **OpenAI Voice**      | `@mastra/voice-openai`     | OpenAI Realtime API for voice |
| **ElevenLabs Agents** | ElevenLabs Platform        | Live conversational AI agents |

### Database & ORM

| Technology     | Version      | Purpose                            |
| -------------- | ------------ | ---------------------------------- |
| **PostgreSQL** | Via Supabase | Primary database                   |
| **Prisma**     | 6.2.1+       | ORM and schema management          |
| **Mastra PG**  | `@mastra/pg` | Mastra-specific PostgreSQL storage |

### Authentication

| Technology             | Package               | Purpose                      |
| ---------------------- | --------------------- | ---------------------------- |
| **Better Auth**        | `better-auth` 1.4.17+ | Session-based authentication |
| **Cross-app sessions** | Via Caddy proxy       | Cookie sharing between apps  |

### UI Components

| Technology       | Package            | Purpose                             |
| ---------------- | ------------------ | ----------------------------------- |
| **shadcn/ui**    | Via `@repo/ui`     | Component library (base-nova style) |
| **Tailwind CSS** | 4.x                | Utility-first CSS                   |
| **HugeIcons**    | `@hugeicons/react` | Icon library                        |
| **Storybook**    | 8.6.x              | Component documentation             |

### Background Jobs & Webhooks

| Technology  | Package            | Purpose                                           |
| ----------- | ------------------ | ------------------------------------------------- |
| **Inngest** | `inngest` 3.50.0+  | Background job processing, event-driven workflows |
| **ngrok**   | Via `NGROK_DOMAIN` | Stable webhook URLs for ElevenLabs                |

### Development Tools

| Technology         | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| **Caddy**          | Reverse proxy for local HTTPS and cookie sharing |
| **Prettier**       | Code formatting (4-space indent, no semicolons)  |
| **ESLint**         | Code linting                                     |
| **Docker Compose** | Database container management                    |

---

## Monorepo Structure

```
/
├── apps/
│   ├── agent/          # AI Agent Next.js app (port 3001, basePath: /agent)
│   ├── frontend/       # Main Next.js app (port 3000)
│   ├── inngest/        # Inngest dev server (port 8288)
│   └── ngrok/          # ngrok tunnel management
│
├── packages/
│   ├── auth/           # Better Auth configuration (@repo/auth)
│   ├── database/       # Prisma schema and client (@repo/database)
│   ├── mastra/         # Mastra agents, tools, workflows (@repo/mastra)
│   ├── ui/             # Shared UI components (@repo/ui)
│   ├── next-config/    # Shared Next.js configuration
│   └── typescript-config/  # Shared TypeScript configs
│
├── docs/               # Documentation and migration guides
├── scripts/            # Development and deployment scripts
└── .cursor/plans/      # AI implementation plans
```

---

## Environment Variables - COMPLETE REFERENCE

The `.env` file contains ALL integrations. Here is the complete breakdown:

### Database (PostgreSQL via Supabase)

```bash
DATABASE_URL="postgresql://..."           # Prisma connection string
NEXT_PUBLIC_SUPABASE_URL="https://..."    # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."       # Supabase anonymous key
```

### Authentication (Better Auth)

```bash
NEXT_PUBLIC_APP_URL="https://catalyst.localhost"  # With Caddy
NEXT_PUBLIC_APP_URL="http://localhost:3000"       # Without Caddy
BETTER_AUTH_SECRET="..."                           # Auth encryption key
CADDY_ADMIN_API="http://localhost:2019"           # Caddy admin endpoint
```

### AI Providers

```bash
OPENAI_API_KEY="sk-..."           # OpenAI API key (GPT-4o, Whisper, TTS)
ANTHROPIC_API_KEY="sk-ant-..."    # Anthropic API key (Claude models)
```

### Voice Providers (ElevenLabs)

```bash
ELEVENLABS_API_KEY="sk_..."              # ElevenLabs API key
ELEVENLABS_AGENT_ID="agent_..."          # ElevenLabs Agent ID (e.g., Grace)
ELEVENLABS_WEBHOOK_SECRET="wsec_..."     # Webhook authentication secret
ELEVENLABS_MCP_WEBHOOK_URL="https://..." # ngrok URL for live agent tools
```

### MCP Server Integrations

```bash
# Firecrawl - Web scraping
FIRECRAWL_API_KEY="fc-..."

# HubSpot CRM
HUBSPOT_ACCESS_TOKEN="pat-na1-..."

# Jira - Project management
JIRA_URL="https://your-org.atlassian.net"
JIRA_USERNAME="email@example.com"
JIRA_API_TOKEN="ATATT3x..."
JIRA_PROJECTS_FILTER="PROJECT_KEY"

# JustCall - Phone/SMS
JUSTCALL_AUTH_TOKEN="api_key:api_secret"

# Fathom - Meeting recordings and transcripts
FATHOM_API_KEY="..."

# ATLAS - n8n workflow automation
ATLAS_N8N_SSE_URL="https://your-n8n.app.n8n.cloud/mcp/.../sse"

# GitHub - Repository management
GITHUB_PERSONAL_ACCESS_TOKEN="ghp_..."

# Google Drive - File storage and search
GDRIVE_CREDENTIALS_PATH="./credentials/gdrive-oauth.json"

# Microsoft OAuth (Azure AD - Outlook Mail + Calendar)
MICROSOFT_CLIENT_ID="..."          # Azure AD app client ID
MICROSOFT_CLIENT_SECRET="..."      # Azure AD app client secret
MICROSOFT_TENANT_ID="common"       # "common" for multi-tenant, or specific tenant ID

# Dropbox OAuth
DROPBOX_APP_KEY="..."              # Dropbox app key (= client ID)
DROPBOX_APP_SECRET="..."           # Dropbox app secret
```

### Credential Encryption

```bash
# AES-256-GCM encryption key for OAuth tokens at rest
# Generate with: openssl rand -hex 32
CREDENTIAL_ENCRYPTION_KEY="..."
```

### Slack Integration

```bash
# Slack App Configuration
# Create app at https://api.slack.com/apps
SLACK_BOT_TOKEN="xoxb-..."           # Bot User OAuth Token
SLACK_SIGNING_SECRET="..."           # App Credentials > Signing Secret
SLACK_DEFAULT_AGENT_SLUG="assistant" # Agent to use for Slack conversations
SLACK_TEAM_ID="T..."                 # Workspace ID (for MCP server)
```

### Webhooks & Tunneling (ngrok)

```bash
NGROK_AUTHTOKEN="..."                              # ngrok auth token
NGROK_DOMAIN="your-subdomain.ngrok-free.dev"       # Stable ngrok domain
```

### Background Jobs (Inngest)

```bash
INNGEST_EVENT_KEY="..."       # Event publishing key
INNGEST_SIGNING_KEY="..."     # Webhook verification key
```

### Feature Flags

```bash
FEATURE_DB_AGENTS="true"      # Enable database-driven agents
```

---

## Package-Specific Dependencies

### @repo/mastra (packages/mastra)

This is the core AI package. Key dependencies:

```json
{
    "@mastra/core": "latest", // Agent framework
    "@mastra/mcp": "^1.0.0", // MCP client
    "@mastra/memory": "latest", // Conversation memory
    "@mastra/pg": "latest", // PostgreSQL storage
    "@mastra/rag": "^2.1.0", // RAG pipeline
    "@mastra/evals": "^1.0.1", // Evaluation scorers
    "@mastra/voice-elevenlabs": "^0.12.0",
    "@mastra/voice-openai": "^0.12.0",
    "@ai-sdk/openai": "^3.0.23",
    "ai": "^6.0.64",
    "zod": "^3.24.0"
}
```

### apps/agent

```json
{
    "@mastra/ai-sdk": "latest",
    "@mastra/voice-elevenlabs": "^0.12.0",
    "@mastra/voice-openai": "^0.12.0",
    "@repo/auth": "workspace:*",
    "@repo/database": "workspace:*",
    "@repo/mastra": "workspace:*",
    "@repo/ui": "workspace:*",
    "inngest": "^3.50.0",
    "next": "16.1.0",
    "react": "19.2.3"
}
```

---

## Development Commands

All commands run from the **root directory**:

```bash
# Development
bun run dev               # Start with Caddy (HTTPS)
bun run dev:local         # Start without Caddy (localhost)

# Build & Quality
bun run build             # Build all apps
bun run lint              # Run ESLint
bun run type-check        # TypeScript checking
bun run format            # Format with Prettier

# Database
bun run db:generate       # Generate Prisma client
bun run db:push           # Push schema changes (dev)
bun run db:migrate        # Create migrations (prod-ready)
bun run db:studio         # Open Prisma Studio
bun run db:seed           # Seed database

# UI Development
bun run add-shadcn <name> # Add shadcn component
bun run storybook         # Launch Storybook
```

---

## GitHub Push Procedures

### Pre-Push Checklist

Before pushing ANY code to GitHub, you MUST complete these steps:

1. **Run type checking**:

    ```bash
    bun run type-check
    ```

2. **Run linting and fix errors**:

    ```bash
    bun run lint
    ```

3. **Run formatting**:

    ```bash
    bun run format
    ```

4. **Verify build succeeds**:

    ```bash
    bun run build
    ```

5. **Check for uncommitted changes**:

    ```bash
    git status
    ```

6. **Review diff before committing**:

    ```bash
    git diff --staged
    ```

### Commit Message Standards

Use conventional commits:

```bash
feat: add new MCP tool integration
fix: resolve memory leak in agent resolver
docs: update CLAUDE.md with deployment procedures
refactor: extract tool registry to separate module
chore: update dependencies
```

### Push Workflow

```bash
# Stage changes
git add -A

# Commit with descriptive message
git commit -m "feat: description of what was done"

# Push to remote
git push origin main
```

### NEVER DO

- Push without running `bun run build` first
- Push with linting errors
- Push with type errors
- Force push to main without explicit permission
- Commit .env files or secrets

---

## Production Deployment (Digital Ocean)

**See [`DEPLOY.md`](./DEPLOY.md) for full deployment instructions.**

### Quick Deploy

```bash
ssh -i ~/.ssh/appello_digitalocean root@138.197.150.253
cd /var/www/mastra
git pull origin main
bun install
bun run build
pm2 restart all
pm2 status
```

### Server Details

- **Host:** 138.197.150.253
- **Domain:** https://mastra.useappello.app
- **SSH Key:** ~/.ssh/appello_digitalocean
- **Process Manager:** PM2
- **Reverse Proxy:** Caddy

### Useful Commands

```bash
# View logs
pm2 logs

# Check status
pm2 status

# Restart apps
pm2 restart all

# Reload Caddy
sudo systemctl reload caddy
```

---

## MCP Server Integration Details

The system uses Mastra's MCP client to connect to external tools:

### Available MCP Servers

| Server           | Category      | Tools Provided                                    |
| ---------------- | ------------- | ------------------------------------------------- |
| **Playwright**   | Web           | Browser automation, screenshots, page interaction |
| **Firecrawl**    | Web           | Web scraping, content extraction                  |
| **HubSpot**      | CRM           | Contacts, companies, deals, pipeline              |
| **Jira**         | Productivity  | Issues, sprints, project tracking                 |
| **JustCall**     | Communication | Call logs, SMS messaging                          |
| **ATLAS**        | Automation    | n8n workflow triggers                             |
| **Fathom**       | Knowledge     | Meeting recordings, transcripts, summaries        |
| **Slack**        | Communication | Channels, messages, users, search                 |
| **Google Drive** | Productivity  | File search, list, read (Docs/Sheets/Slides)      |
| **GitHub**       | Productivity  | Repos, issues, PRs, code, actions                 |

### Native OAuth Integrations

| Integration   | Category      | Capabilities                                                              |
| ------------- | ------------- | ------------------------------------------------------------------------- |
| **Gmail**     | Communication | Email ingestion, archive, send (Google OAuth)                             |
| **Microsoft** | Communication | Outlook Mail (send, list, archive) + Calendar (CRUD events) via Graph API |
| **Dropbox**   | Productivity  | File list, read, upload, search, sharing links                            |

OAuth integrations use standalone OAuth2 flows with PKCE, encrypted token storage (AES-256-GCM via `CREDENTIAL_ENCRYPTION_KEY`), automatic token refresh, and webhook-based triggers.

### MCP Tool Execution

```typescript
import { executeMcpTool, listMcpToolDefinitions } from "@repo/mastra";

// List available tools
const tools = await listMcpToolDefinitions();

// Execute a tool
const result = await executeMcpTool("hubspot.hubspot-get-user-details", {
    userId: "12345"
});
```

---

## Agent Architecture

### Database-Driven Agents

Agents are stored in PostgreSQL and resolved at runtime:

```typescript
import { agentResolver, AgentResolver } from "@repo/mastra";

// Resolve agent from database
const agent = await agentResolver.resolve("trip-planner", {
    userId: "user-123"
});
```

### Agent Configuration (Prisma Schema)

```prisma
model Agent {
    id                   String      @id
    slug                 String      @unique
    name                 String
    instructions         String      @db.Text
    instructionsTemplate String?     @db.Text
    modelProvider        String // "openai", "anthropic"
    modelName            String // "gpt-4o", "claude-sonnet-4-20250514"
    temperature          Float?
    memoryEnabled        Boolean
    memoryConfig         Json?
    tools                AgentTool[]
    scorers              String[]
    // ...
}
```

### Tool Registry

Tools are registered in the tool registry and resolved by name:

```typescript
import { toolRegistry, getToolsByNames } from "@repo/mastra";

// Get tools by name
const tools = await getToolsByNames(["calculator", "web-fetch", "memory-recall"]);
```

---

## Workflow System

Mastra workflows enable multi-step agent orchestration:

```typescript
import { humanApprovalWorkflow, parallelWorkflow } from "@repo/mastra";

// Execute workflow
const result = await humanApprovalWorkflow.execute({
    input: { request: "..." }
});

// Wait for human approval
await humanApprovalWorkflow.resume(runId, { approved: true });
```

---

## RAG Pipeline

Document ingestion and semantic search:

```typescript
import { ingestDocument, queryRag, ragGenerate } from "@repo/mastra";

// Ingest document
await ingestDocument({
    content: "...",
    metadata: { source: "manual" }
});

// Query with RAG
const response = await ragGenerate({
    query: "What is...",
    maxResults: 5
});
```

---

## Voice Agent Integration

### ElevenLabs Live Agents

The system supports ElevenLabs conversational agents with MCP tool integration:

1. **Agent Configuration**: Defined in ElevenLabs platform
2. **Webhook Tools**: Exposed via ngrok at `/api/demos/live-agent-mcp/tools`
3. **Authentication**: Verified via `ELEVENLABS_WEBHOOK_SECRET`

### Starting ngrok for Webhooks

```bash
# Start ngrok tunnel
./scripts/start-ngrok.sh

# Or manually
ngrok http 3001 --domain=your-domain.ngrok-free.dev
```

---

## Slack Integration

The system supports two-way Slack conversations where users can talk to agents directly from Slack.

### How It Works

1. **Incoming Messages**: Slack sends webhook events to `/api/slack/events` when:
    - Someone @mentions the bot in a channel
    - Someone sends a direct message to the bot

2. **Agent Processing**: Messages are processed by the configured agent (default: `assistant`)
    - Each Slack thread maintains its own conversation memory
    - The agent generates a response using its configured tools

3. **Response**: The bot replies in the same thread using the Slack Web API

### Setting Up Slack Integration

1. **Create a Slack App** at https://api.slack.com/apps
    - Click "Create New App" > "From scratch"
    - Give it a name and select your workspace

2. **Configure Bot Permissions** (OAuth & Permissions):
    - Add Bot Token Scopes:
        - `app_mentions:read` - Receive @mentions
        - `chat:write` - Send messages
        - `chat:write.customize` - Post with custom username/icon per agent
        - `im:history` - Read DM history
        - `im:read` - Access DM metadata
        - `im:write` - Send DMs
        - `channels:history` - Read channel messages (for @mentions)
        - `channels:read` - Access channel metadata

3. **Enable Event Subscriptions**:
    - Turn on "Enable Events"
    - Set Request URL to: `https://your-domain/agent/api/slack/events`
    - Subscribe to bot events:
        - `app_mention` - When bot is @mentioned
        - `message.im` - Direct messages to bot
    - Note: You'll need ngrok or a public URL for local development

4. **Install to Workspace**:
    - Go to "Install App" and click "Install to Workspace"
    - Copy the "Bot User OAuth Token" (starts with `xoxb-`)

5. **Configure Environment Variables**:

```bash
SLACK_BOT_TOKEN="xoxb-your-bot-token"
SLACK_SIGNING_SECRET="your-signing-secret"  # From App Credentials
SLACK_DEFAULT_AGENT_SLUG="assistant"        # Optional: which agent to use
```

### Usage

Once configured, you can:

- **@mention the bot** in any channel it's added to
- **Send direct messages** to the bot
- The bot will respond in a thread, maintaining conversation context per Slack thread
- **Route to any agent** by prefixing your message with `agent:<slug>`:
    - `@Bot agent:research What is quantum computing?` -- routes to the `research` agent
    - `@Bot What time is it?` -- routes to the default agent
    - `@Bot help` or `@Bot agent:list` -- lists all available agents with their slugs
- Each agent responds with its own **display name and icon** (configured via agent metadata)

### Changing the Default Agent

Set `SLACK_DEFAULT_AGENT_SLUG` to change which agent handles messages without an `agent:` prefix:

```bash
SLACK_DEFAULT_AGENT_SLUG="assistant"  # Default agent for Slack
```

### Per-Agent Display Identity

Each agent can have a custom Slack display name and icon. Set this in the agent's `metadata` JSON field:

```json
{
    "slack": {
        "displayName": "Research Agent",
        "iconEmoji": ":microscope:"
    }
}
```

When no `slack` metadata is set, the agent's `name` field is used as the display name.

---

## Background Jobs with Inngest

### Local Development

The Inngest dev server starts automatically with `bun run dev`. It runs on port 8288 and provides:

- **Dashboard**: http://localhost:8288 - View events, function runs, and debug issues
- **Event Processing**: Processes all Inngest events locally without needing Inngest Cloud

The dev server is started via `apps/inngest/` which runs `scripts/start-inngest.sh`.

**Note**: The Inngest endpoint is at `http://localhost:3001/api/inngest` (not `/agent/api/inngest`) because basePath is only used when running behind Caddy.

**Important**: The learning page (`/workspace/{agent}/learning`) requires Inngest to process learning sessions. Without the Inngest dev server running, clicking "Start Learning Session" will send events that never get processed.

### Event Publishing

```typescript
import { inngest } from "@/lib/inngest";

// Send event
await inngest.send({
    name: "goal/execute",
    data: { goalId: "..." }
});
```

### Function Registration

Functions are registered in `apps/agent/src/lib/inngest-functions.ts` and served via `/api/inngest`.

### Key Learning Events

| Event                         | Purpose                        |
| ----------------------------- | ------------------------------ |
| `learning/session.start`      | Start a new learning session   |
| `learning/signals.extract`    | Extract signals from runs      |
| `learning/proposals.generate` | Generate improvement proposals |
| `learning/experiment.run`     | Run A/B experiments            |
| `learning/approval.request`   | Request human approval         |

---

## Important File Locations

| File                                     | Purpose                            |
| ---------------------------------------- | ---------------------------------- |
| `packages/mastra/src/mastra.ts`          | Main Mastra instance configuration |
| `packages/mastra/src/agents/index.ts`    | Agent exports and factory          |
| `packages/mastra/src/mcp/client.ts`      | MCP server configuration           |
| `packages/mastra/src/tools/registry.ts`  | Tool registry                      |
| `packages/database/prisma/schema.prisma` | Database schema                    |
| `apps/agent/src/app/api/`                | API routes                         |
| `.env`                                   | Environment configuration          |

---

## Troubleshooting

### Agent Not Loading

1. Check `FEATURE_DB_AGENTS` is set to `"true"`
2. Verify database connection with `bun run db:studio`
3. Check agent exists: `SELECT * FROM agent WHERE slug = 'agent-name'`

### MCP Tools Not Available

1. Check API keys in `.env`
2. Test MCP client: `await mcpClient.listTools()`
3. Check server-specific logs

### Voice Agent Issues

1. Verify `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID`
2. Check ngrok tunnel is running for webhooks
3. Verify `ELEVENLABS_WEBHOOK_SECRET` matches ElevenLabs config

### Build Failures

1. Run `bun run type-check` first
2. Run `bun run lint` and fix errors
3. Clear build cache: `bun run clean`
4. Regenerate Prisma: `bun run db:generate`

---

## Code Quality Standards

### Before Completing ANY Task

1. Run `bun run format`
2. Run `bun run lint`
3. Run `bun run type-check`
4. If modified UI: check Storybook renders correctly

### File Formatting

- **Indent**: 4 spaces (2 for JSON/YAML)
- **Semicolons**: None
- **Quotes**: Double quotes for strings
- **Tailwind**: Classes sorted by Prettier plugin

### Import Order

```typescript
// 1. React/Next
import { useState } from "react";
import { NextRequest } from "next/server";

// 2. External packages
import { Agent } from "@mastra/core/agent";

// 3. Internal packages
import { prisma } from "@repo/database";
import { Button } from "@repo/ui";

// 4. Relative imports
import { localHelper } from "./helpers";
```

---

## Final Reminder

**DO THE JOB RIGHT. DO NOT CUT CORNERS.**

When working on this codebase:

- Read the full context before making changes
- Follow existing patterns and conventions
- Test thoroughly before declaring complete
- Update documentation when adding features
- Ask questions when requirements are unclear

Every shortcut creates technical debt. Every incomplete implementation wastes time. Be thorough, be precise, be professional.
