# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Turborepo monorepo** for the Catalyst application, built with Next.js 16 (App Router), React 19, Prisma (MySQL), and Better Auth for authentication. The project uses **Bun** as the package manager and runtime.

## Monorepo Structure

- **apps/frontend**: Next.js 16 application with App Router
    - **src/components/ui**: shadcn UI components
    - **src/lib**: Utility functions (cn function, auth, etc.)
    - **src/app/(Public)/api/auth**: Better Auth API endpoints
- **apps/agent**: Next.js 16 agent application with App Router
    - Configured with `basePath: "/agent"` for path-based routing
    - Shares authentication with frontend via cookies
    - **src/app/page.tsx**: Agent home page (served at `/agent`)
- **packages/database**: Prisma schema and client configuration
- **packages/typescript-config**: Shared TypeScript configurations

## Development Commands

All commands should be run from the **root directory** using Bun:

```bash
# Development
bun run dev                 # Start all apps in development mode

# Build
bun run build              # Build all apps and packages

# Code Quality
bun run lint               # Run ESLint across all workspaces
bun run type-check         # TypeScript type checking
bun run format             # Format code with Prettier

# Database (Prisma)
bun run db:generate        # Generate Prisma client
bun run db:push            # Push schema changes to database (development only)
bun run db:migrate         # Create and apply migrations (uses root credentials)
bun run db:migrate:reset   # Reset database and apply all migrations (destructive)
bun run db:migrate:deploy  # Apply migrations in production
bun run db:studio          # Open Prisma Studio
bun run db:seed            # Seed the database

# Cleanup
bun run clean              # Clean build artifacts
```

### Running Single Workspace Commands

To run commands in a specific workspace:

```bash
cd apps/frontend
bun run dev                # Run only frontend in dev mode
bun run build              # Build only frontend
```

### Database Setup

1. Start MySQL container: `docker compose up -d`
2. Copy `.env.example` to `.env` and configure database credentials
3. Generate Prisma client: `bun run db:generate`
4. Choose your database workflow:
    - **For rapid development**: `bun run db:push` (syncs schema without migrations)
    - **For production-ready migrations**: `bun run db:migrate` (creates migration files)
5. (Optional) Seed database: `bun run db:seed`

**Note**: Migration commands use `DATABASE_URL_MIGRATE` which connects as the root user. This is required because Prisma Migrate needs CREATE DATABASE privileges to create shadow databases for migration validation.

## Development with Caddy

This project uses **Caddy** as a reverse proxy for local development to enable cookie sharing between the frontend and agent apps.

### Prerequisites

1. **Install Caddy**:

    ```bash
    brew install caddy  # macOS
    ```

2. **Trust Caddy's root CA** (for HTTPS):

    ```bash
    caddy trust
    # Requires sudo password
    ```

3. **Add to `/etc/hosts`**:
    ```bash
    echo "127.0.0.1 catalyst.local" | sudo tee -a /etc/hosts
    ```

### Starting Development

**Default (with Caddy - HTTPS):**

```bash
bun run dev
```

Access at: **https://catalyst.local**

The `bun run dev` command:

1. Runs pre-flight checks (Caddy installation, /etc/hosts, CA certificate)
2. Starts Caddy reverse proxy via Turbo (appears in TUI as separate service)
3. Starts all Next.js apps via Turbo

**Fallback (without Caddy - localhost):**

```bash
bun run dev:local
```

Access at: **http://localhost:3000**

Use this if Caddy setup is not complete or you want to bypass the proxy.

### Turbo TUI

When running `bun run dev`, you'll see all services in the Turbo TUI:

- **caddy**: Reverse proxy (only shows errors, not request logs)
- **frontend**: Main Next.js app
- **agent**: Agent Next.js app
- **database**: Prisma tasks

You can collapse/expand individual service logs in the TUI for better organization.

### Caddy Management

```bash
bun run caddy:start   # Start Caddy only
bun run caddy:stop    # Stop Caddy only
bun run caddy:reload  # Reload Caddyfile configuration
```

### URL Structure

- **Frontend**: `https://catalyst.local` → `localhost:3000`
- **Agent**: `https://catalyst.local/agent` → `localhost:3001/agent`
- **Auth API**: `https://catalyst.local/api/auth` → `localhost:3000/api/auth`

All apps share cookies automatically via same domain (`catalyst.local`).

### How Cookie Sharing Works

1. **Single Domain**: Both apps are accessed via `catalyst.local`
2. **Better Auth Configuration**:
    - Server config in `apps/frontend/src/lib/auth.ts` sets `baseURL: "https://catalyst.local"`
    - Client config in both apps uses `NEXT_PUBLIC_APP_URL="https://catalyst.local"`
    - Cookies are set with domain=`catalyst.local` and path=`/`
3. **Path-Based Routing**: Caddy routes requests to appropriate apps while preserving cookies
4. **Result**: Login on frontend → automatically authenticated on agent

### Agent App Configuration

The agent app requires specific Next.js configuration for path-based routing:

**File: `apps/agent/next.config.ts`**

```typescript
const nextConfig: NextConfig = {
    basePath: "/agent" // Critical for asset loading
};
```

**Why `basePath` is Required:**

- Without it, assets load from `https://catalyst.local/_next/...` (404)
- With it, assets load from `https://catalyst.local/agent/_next/...` (✓)
- Next.js automatically prefixes all URLs (links, images, scripts) with `/agent`

**File Structure:**

```
apps/agent/src/app/
├── layout.tsx       # Root layout
└── page.tsx         # Home page (served at /agent, not /agent/agent)
```

**Important**: With `basePath: "/agent"`, pages should be at the root of `app/`, not in an `app/agent/` subdirectory.

### Troubleshooting

**Browser shows certificate warning:**

- Run `caddy trust` to install Caddy's root CA
- Restart browser after trusting

**Caddy not starting:**

- Check if port 443 is available: `lsof -i :443`
- Verify Caddyfile syntax: `caddy validate --config ./Caddyfile`

**DNS not resolving:**

- Verify `/etc/hosts` entry: `cat /etc/hosts | grep catalyst`
- Clear DNS cache (macOS): `sudo dscacheutil -flushcache`

**Cookies not working:**

- Ensure accessing via `https://catalyst.local`, not `localhost`
- Check browser DevTools > Application > Cookies
- Verify `.env` has `NEXT_PUBLIC_APP_URL="https://catalyst.local"`

## Architecture

### Authentication Flow

The app uses **Better Auth** (v1.4+) with email/password authentication and cross-app session sharing:

- Auth configuration: `apps/frontend/src/lib/auth.ts`
- Auth API endpoints: `apps/frontend/src/app/(Public)/api/auth/[...all]/route.ts`
- Session management via Better Auth with 7-day expiry
- Middleware proxy pattern in `apps/frontend/src/proxy.ts` handles route protection
- Public routes: `/`, `/signup`, `/api/auth/*`
- All other routes require authentication and redirect to `/` if unauthenticated

**Cross-App Authentication:**

- Frontend hosts the auth API at `/api/auth/*`
- Agent app uses auth client pointing to `https://catalyst.local/api/auth`
- Both apps share the same `NEXT_PUBLIC_APP_URL` environment variable
- Cookies are set on `catalyst.local` domain with path `/`, accessible to both apps
- Login on frontend → session automatically available on agent app

### Next.js App Router Structure

The frontend uses Next.js **route groups** for organization:

- `app/(Public)/`: Unauthenticated routes (signup, login)
- `app/(Authenticated)/`: Protected routes (dashboard, etc.)
- Root `app/page.tsx`: Landing/login page

### Database Schema

Prisma schema located at `packages/database/prisma/schema.prisma`. Models:

- **User**: Core user data with email/password authentication
- **Session**: Better Auth session management
- **Account**: OAuth provider accounts (for future OAuth support)
- **Verification**: Email verification tokens

The Prisma client is exported from `packages/database/src/index.ts` and used throughout the monorepo as `@repo/database`.

### Styling and UI Components

- **Tailwind CSS 4**: Configured at workspace root
- **shadcn/ui**: Component library in `apps/frontend/src/components/ui/`
    - Components are imported using `@/components/ui` alias
    - shadcn configuration in `apps/frontend/components.json`
- Uses `@base-ui/react` for headless components
- Theme support via `next-themes` (dark mode configured)
- Utility function `cn()` located at `apps/frontend/src/lib/utils.ts` for className merging

### TypeScript Configuration

- Shared configs in `packages/typescript-config`
- Workspace imports use `workspace:*` protocol
- Path aliases configured in frontend (`apps/frontend/tsconfig.json`):
    - `@/components`: Frontend components directory
    - `@/lib`: Utility functions and configurations
    - `@/hooks`: Custom React hooks
    - `@/styles`: Global styles

## Important Notes

### Environment Variables

Required environment variables (see `.env.example`):

- `DATABASE_URL`: MySQL connection string (used by application code)
- `DATABASE_URL_MIGRATE`: MySQL connection string with root user (used by Prisma Migrate)
- `MYSQL_ROOT_PASSWORD`: Root password for MySQL (used in DATABASE_URL_MIGRATE)
- `MYSQL_DATABASE`: Database name
- `MYSQL_USER`: Application database user
- `MYSQL_PASSWORD`: Application database password
- `MYSQL_PORT`: MySQL port (default: 3306)
- `BETTER_AUTH_SECRET`: Auth secret key (generate with Better Auth CLI)
- `NEXT_PUBLIC_APP_URL`: Application URL for callbacks (use `https://catalyst.local` with Caddy, `http://localhost:3000` for dev:local)

**Important Notes:**

- `DATABASE_URL` uses a limited user for application security, while `DATABASE_URL_MIGRATE` uses root for migration operations that require elevated privileges
- `NEXT_PUBLIC_APP_URL` must be explicitly exposed in `next.config.ts` files under the `env` key for both frontend and agent apps
- Environment variables are loaded from root `.env` file using `dotenv` in each app's `next.config.ts`

### Prettier Configuration

Code formatting is enforced via Prettier with:

- 4 spaces indentation (2 for JSON/YAML)
- No semicolons for trailing commas
- Tailwind class sorting plugin enabled
- Prisma schema formatting plugin enabled

### Package Manager

This project **requires Bun** (v1.3.4+). Do not use npm, yarn, or pnpm as the lockfile is `bun.lock`.

### Turbo Configuration

Build dependencies are configured in `turbo.json`:

- Tasks like `lint` and `type-check` depend on `^build` (dependencies must build first)
- Database tasks are not cached
- `dev` task runs persistently without caching

## Database Migrations

### Development Workflow

When modifying the Prisma schema, choose between two workflows:

**Quick iteration (db:push):**

1. Edit `packages/database/prisma/schema.prisma`
2. Run `bun run db:generate` to update the Prisma client
3. Run `bun run db:push` to sync schema (no migration files created)
4. Good for rapid prototyping; doesn't preserve migration history

**Production-ready migrations (db:migrate):**

1. Edit `packages/database/prisma/schema.prisma`
2. Run `bun run db:migrate` to create migration files and apply them
3. Prisma will prompt for a migration name
4. Migration files are created in `packages/database/prisma/migrations/`
5. Run `bun run db:generate` to update the Prisma client

### Migration Commands

- `bun run db:migrate`: Create and apply a new migration (uses root credentials)
- `bun run db:migrate:reset`: Reset database and reapply all migrations (destructive, development only)
- `bun run db:migrate:deploy`: Apply pending migrations (production use)

### Important Notes

- Migration commands use `DATABASE_URL_MIGRATE` which connects as root user
- Root access is required for Prisma to create shadow databases during migration validation
- Application code uses `DATABASE_URL` with limited privileges for security
- Always commit migration files to version control
- Never run `db:migrate:reset` on production databases

## Adding New Features

### Frontend Features

When adding authenticated features:

1. Create routes in `apps/frontend/src/app/(Authenticated)/`
2. They will automatically be protected by the middleware
3. Access user session via Better Auth hooks or API

When adding public features:

1. Create routes in `apps/frontend/src/app/(Public)/`
2. Or add to `publicRoutes` array in `apps/frontend/src/proxy.ts`

### Agent App Features

When adding routes to the agent app:

1. **Remember `basePath`**: All routes are automatically prefixed with `/agent`
2. **File structure**: Pages go in `apps/agent/src/app/`, NOT in `apps/agent/src/app/agent/`
3. **Example**:
    - File: `apps/agent/src/app/dashboard/page.tsx`
    - URL: `https://catalyst.local/agent/dashboard`
4. **Links**: Use Next.js `<Link href="/dashboard">` (basePath is automatic)
5. **Assets**: All `_next` assets automatically served from `/agent/_next/`
6. **Auth**: Use `useSession()` from `@/lib/auth-client` - sessions shared automatically

## Component Development

### shadcn Components

UI components are managed using shadcn and located in `apps/frontend/src/components/ui/`. To add new shadcn components:

1. Use the shadcn CLI from the frontend directory:

    ```bash
    cd apps/frontend
    bunx shadcn@latest add <component-name>
    ```

2. Components will be automatically added to `src/components/ui/` and can be imported using the `@/components/ui` alias

3. Components are re-exported in `src/components/ui/index.ts` for easier imports

### Custom Components

Custom shared components should be added to `apps/frontend/src/components/` and can be organized into subdirectories as needed. Import them using the `@/components` alias.
