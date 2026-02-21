# AgentC2

A production-grade AI agent framework built with Next.js 16, React 19, and Prisma, organized as a Turborepo monorepo. Built on the open-source [Mastra](https://mastra.ai) framework.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Authentication**: Better Auth
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui
- **Monorepo**: Turborepo
- **Package Manager**: Bun
- **Language**: TypeScript
- **AI**: Mastra Core, MCP, Memory, RAG, Evals
- **Voice**: ElevenLabs, OpenAI Realtime
- **Background Jobs**: Inngest

## Project Structure

```
agentc2/
├── apps/
│   ├── agent/             # AI Agent Next.js app (port 3001, basePath: /agent)
│   ├── frontend/          # Marketing & docs site (port 3000)
│   ├── admin/             # Admin dashboard (port 3003)
│   ├── caddy/             # Reverse proxy configuration
│   ├── inngest/           # Background job dev server (port 8288)
│   └── ngrok/             # Webhook tunnel management
├── packages/
│   ├── agentc2/           # Core agent framework (@repo/agentc2)
│   ├── database/          # Prisma schema and client (@repo/database)
│   ├── auth/              # Better Auth configuration (@repo/auth)
│   ├── ui/                # Shared UI components (@repo/ui)
│   ├── next-config/       # Shared Next.js configuration
│   └── typescript-config/ # Shared TypeScript configs
├── docs/                  # Technical documentation
└── scripts/               # Development and deployment scripts
```

## Prerequisites

- [Bun](https://bun.sh) v1.3.4 or higher
- [Docker](https://www.docker.com/) (for PostgreSQL database)
- [Caddy](https://caddyserver.com/) (for local HTTPS and reverse proxy)

## Getting Started

1. **Clone the repository**

    ```bash
    git clone <repository-url>
    cd agentc2
    ```

2. **Install Caddy**

    ```bash
    brew install caddy
    caddy trust
    ```

3. **Install dependencies**

    ```bash
    bun install
    ```

4. **Set up environment variables**

    ```bash
    cp .env.example .env
    ```

    Edit `.env` with your database connection string and API keys.

5. **Start the database**

    ```bash
    docker compose up -d
    ```

6. **Set up the database schema**

    ```bash
    bun run db:generate
    bun run db:push
    ```

7. **Seed the database (optional)**

    ```bash
    bun run db:seed
    ```

8. **Start the development server**

    ```bash
    bun run dev
    ```

    This starts all services via Turbo TUI (Caddy, agent, frontend, inngest).

9. **Open your browser**

    Navigate to [https://catalyst.localhost](https://catalyst.localhost)

## Available Scripts

### Development

- `bun run dev` - Start all apps with Caddy via Turbo TUI (HTTPS)
- `bun run dev:local` - Start all apps without Caddy (localhost only)
- `bun run build` - Build all apps and packages
- `bun run start` - Start production server

### Code Quality

- `bun run lint` - Run ESLint across all workspaces
- `bun run type-check` - Run TypeScript type checking
- `bun run format` - Format code with Prettier

### Database

- `bun run db:generate` - Generate Prisma client
- `bun run db:push` - Push schema changes to database (development)
- `bun run db:migrate` - Create and run migrations (production)
- `bun run db:studio` - Open Prisma Studio (database GUI)
- `bun run db:seed` - Seed the database with initial data

### Testing

- `bun run test` - Run all tests
- `bun run test:unit` - Run unit tests
- `bun run test:integration` - Run integration tests

### Cleanup

- `bun run clean` - Clean build artifacts

## Environment Variables

Create a `.env` file in the root directory. See `.env.example` for all available variables.

Key variables:

```env
# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/agentc2"

# Authentication
NEXT_PUBLIC_APP_URL="https://catalyst.localhost"
BETTER_AUTH_SECRET="your-secret-key"

# AI Providers
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
```

## Architecture

### Caddy Reverse Proxy

Caddy enables cookie sharing between apps through path-based routing on a single domain.

**URL Structure:**

```
https://catalyst.localhost           → Frontend (localhost:3000)
https://catalyst.localhost/agent     → Agent App (localhost:3001)
https://catalyst.localhost/admin     → Admin App (localhost:3003)
https://catalyst.localhost/api/auth  → Better Auth API
```

### Agent App

The agent app uses `basePath: "/agent"` in `next.config.ts`. Pages go in `apps/agent/src/app/`, NOT `apps/agent/src/app/agent/`.

### Authentication Flow

1. Frontend hosts Better Auth API at `/api/auth/*`
2. Both apps use the same `NEXT_PUBLIC_APP_URL`
3. Cookies shared automatically via same domain
4. Session state synchronized across all apps

## Development Workflow

### Adding Features

- **Agent routes**: `apps/agent/src/app/` (served at `/agent`)
- **Frontend routes**: `apps/frontend/src/app/`
- **Admin routes**: `apps/admin/src/app/`
- **Shared components**: `packages/ui/src/`

### Database Changes

1. Modify `packages/database/prisma/schema.prisma`
2. Generate Prisma client: `bun run db:generate`
3. Apply changes: `bun run db:push` (dev) or `bun run db:migrate` (prod)

### Code Formatting

Uses Prettier with 4-space indent and no semicolons. Run `bun run format` before committing.

## Packages

- **@repo/agentc2**: Core agent framework -- agents, tools, workflows, MCP, RAG, memory
- **@repo/database**: Prisma client and schema
- **@repo/auth**: Better Auth configuration
- **@repo/ui**: Shared UI components (shadcn/ui)
- **@repo/next-config**: Shared Next.js configuration
- **@repo/typescript-config**: Shared TypeScript configs

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Development guidelines and complete reference
- [DEPLOY.md](./DEPLOY.md) - Production deployment procedures
- [docs/](./docs/) - Technical documentation

## Troubleshooting

### Caddy Issues

```bash
caddy trust                              # Install Caddy root CA
lsof -i :443                             # Check port availability
caddy validate --config ./Caddyfile      # Verify config
```

### Authentication Issues

- Verify `NEXT_PUBLIC_APP_URL` matches your Caddy domain in `.env`
- Check cookies in DevTools > Application > Cookies
- Ensure accessing via `https://catalyst.localhost`, not `localhost`

### Build Failures

```bash
bun run type-check    # Check for type errors
bun run lint          # Check for lint errors
bun run clean         # Clear build cache
bun run db:generate   # Regenerate Prisma client
```

### Want to bypass Caddy?

```bash
bun run dev:local  # Uses localhost URLs instead
# Update .env: NEXT_PUBLIC_APP_URL="http://localhost:3000"
```
