# Catalyst

A modern, full-stack web application built with Next.js 16, React 19, and Prisma, organized as a Turborepo monorepo.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Authentication**: Better Auth
- **Database**: MySQL with Prisma ORM
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui
- **Monorepo**: Turborepo
- **Package Manager**: Bun
- **Language**: TypeScript

## Project Structure

```
catalyst-agent/
├── apps/
│   ├── frontend/          # Main Next.js application (port 3000)
│   │   └── src/app/(Public)/api/auth/  # Better Auth endpoints
│   └── agent/             # Agent Next.js application (port 3001)
│       └── next.config.ts # Configured with basePath: "/agent"
├── packages/
│   ├── database/          # Prisma schema and client
│   └── typescript-config/ # Shared TS configs
├── scripts/               # Caddy management scripts
├── Caddyfile             # Caddy reverse proxy configuration
├── docker-compose.yml    # MySQL database setup
└── turbo.json           # Turborepo configuration
```

## Prerequisites

- [Bun](https://bun.sh) v1.3.4 or higher
- [Docker](https://www.docker.com/) (for MySQL database)
- [Caddy](https://caddyserver.com/) (for local HTTPS and reverse proxy)

## Getting Started

1. **Clone the repository**

    ```bash
    git clone <repository-url>
    cd catalyst-agent
    ```

2. **Install Caddy**

    ```bash
    brew install caddy
    caddy trust
    ```

    Note: `.localhost` domains automatically resolve to 127.0.0.1, so no `/etc/hosts` modification is needed.

3. **Install dependencies**

    ```bash
    bun install
    ```

4. **Set up environment variables**

    ```bash
    cp .env.example .env
    ```

    Edit `.env` if needed (default values work for local dev).

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

    The command will:
    - Run pre-flight checks for Caddy setup
    - Start all services in Turbo TUI (Caddy, frontend, agent)
    - Show organized logs for each service

9. **Open your browser**

    Navigate to [https://catalyst.localhost](https://catalyst.localhost)

## Available Scripts

### Development

- `bun run dev` - Start all apps with Caddy via Turbo TUI (HTTPS)
    - Runs pre-flight checks automatically
    - Shows all services (Caddy, frontend, agent) in organized TUI
    - Caddy logs only show errors (not request spam)
- `bun run dev:local` - Start all apps without Caddy (localhost only)
- `bun run build` - Build all apps and packages
- `bun run start` - Start production server (in apps/frontend)

### Caddy

- `bun run caddy:start` - Start Caddy reverse proxy only (daemon mode)
- `bun run caddy:stop` - Stop Caddy reverse proxy
- `bun run caddy:reload` - Reload Caddyfile configuration

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

### Cleanup

- `bun run clean` - Clean build artifacts

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="mysql://catalyst_user:catalyst_password@localhost:3306/catalyst"
MYSQL_ROOT_PASSWORD=root_password
MYSQL_DATABASE=catalyst
MYSQL_USER=catalyst_user
MYSQL_PASSWORD=catalyst_password
MYSQL_PORT=3306

# Authentication
NEXT_PUBLIC_APP_URL="https://catalyst.localhost"
BETTER_AUTH_SECRET="your-secret-key-here"
```

**Note**: Generate a secure `BETTER_AUTH_SECRET` using:

```bash
openssl rand -base64 32
```

## Features

- ✅ Authentication with Better Auth (email/password)
- ✅ Cross-app session sharing via Caddy reverse proxy
- ✅ Path-based routing with cookie sharing (`catalyst.localhost` domain)
- ✅ Local HTTPS development with self-signed certificates
- ✅ Protected routes with middleware
- ✅ Dark mode support
- ✅ Responsive design with Tailwind CSS
- ✅ Type-safe database queries with Prisma
- ✅ Monorepo architecture for code sharing

## Architecture

### Caddy Reverse Proxy

This project uses **Caddy** as a reverse proxy to enable cookie sharing between the frontend and agent applications through path-based routing on a single domain.

**URL Structure:**

```
https://catalyst.localhost           → Frontend (localhost:3000)
https://catalyst.localhost/agent     → Agent App (localhost:3001)
https://catalyst.localhost/api/auth  → Better Auth API (via frontend)
```

**How It Works:**

1. **Single Domain**: All apps accessed via `catalyst.localhost` domain
2. **Cookie Sharing**: Better Auth cookies set on `catalyst.localhost` with path `/`
3. **Path Routing**: Caddy routes `/agent*` to agent app, everything else to frontend
4. **HTTPS**: Caddy provides local HTTPS with self-signed certificates
5. **Result**: Login on frontend → automatically authenticated on agent app

### Agent App Configuration

The agent app uses `basePath: "/agent"` in `next.config.ts`:

- **Why**: Tells Next.js to prefix all asset URLs with `/agent`
- **Result**: Assets load from `https://catalyst.localhost/agent/_next/...` ✓
- **File Structure**: Pages go in `apps/agent/src/app/`, NOT `apps/agent/src/app/agent/`
- **Example**: `app/page.tsx` serves at `https://catalyst.localhost/agent`

### Authentication Flow

1. Frontend hosts Better Auth API at `/api/auth/*`
2. Both apps use same `NEXT_PUBLIC_APP_URL="https://catalyst.localhost"`
3. Agent auth client fetches sessions from frontend's auth API
4. Cookies shared automatically via same domain
5. Session state synchronized across all apps

## Development Workflow

### Adding New Features

**Frontend Protected Routes**: Create new routes in `apps/frontend/src/app/(Authenticated)/`

**Frontend Public Routes**: Create new routes in `apps/frontend/src/app/(Public)/`

**Agent App Routes**:

- Add pages in `apps/agent/src/app/` (automatically served at `/agent`)
- Example: `apps/agent/src/app/dashboard/page.tsx` → `https://catalyst.localhost/agent/dashboard`
- Use `useSession()` from `@/lib/auth-client` for authentication

**Shared Components**: Add to `packages/ui/src/` and export via `index.ts`

### Database Changes

1. Modify `packages/database/prisma/schema.prisma`
2. Generate Prisma client: `bun run db:generate`
3. Apply changes: `bun run db:push` (dev) or `bun run db:migrate` (prod)

### Code Formatting

This project uses Prettier with specific formatting rules. Run `bun run format` before committing.

## Project Packages

- **@repo/database**: Prisma client and schema
- **@repo/ui**: Shared UI components built with shadcn/ui
- **@repo/lib**: Shared utility functions
- **@repo/typescript-config**: Shared TypeScript configurations

## Troubleshooting

### Caddy Issues

**Browser shows certificate warning:**

```bash
caddy trust  # Install Caddy's root CA
# Restart browser
```

**Caddy not starting:**

```bash
lsof -i :443  # Check if port 443 is available
caddy validate --config ./Caddyfile  # Verify config
```

Note: `.localhost` domains automatically resolve to 127.0.0.1, so no DNS configuration is needed.

### Authentication Issues

**Agent app shows "Please sign in" after logging in on frontend:**

- Verify `NEXT_PUBLIC_APP_URL="https://catalyst.localhost"` in `.env`
- Check cookies in DevTools > Application > Cookies (should see cookies on `catalyst.localhost`)
- Ensure accessing via `https://catalyst.localhost`, not `localhost`
- Restart dev server after changing `.env`

**Assets (CSS/JS) not loading on agent app:**

- Verify `basePath: "/agent"` is set in `apps/agent/next.config.ts`
- Check page files are in `apps/agent/src/app/`, NOT `apps/agent/src/app/agent/`
- Assets should load from `https://catalyst.localhost/agent/_next/...`

### Development Mode

**Want to bypass Caddy:**

```bash
bun run dev:local  # Uses localhost URLs instead
# Update .env: NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Documentation

- [Agent Platform Vision](./docs/agent-platform-vision.md) - Product vision and architecture
- [System Specification](./SYSTEM-SPECIFICATION.md) - Technical implementation details
- [Agent Workspace Plan](./agentworkspaceplan.md) - Workspace UI and API specification
- [CLAUDE.md](./CLAUDE.md) - Development guidelines and procedures

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Caddy Documentation](https://caddyserver.com/docs)

## License

[Your License Here]
