# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Turborepo monorepo** for the Catalyst application, built with Next.js 16 (App Router), React 19, Prisma (MySQL), and Better Auth for authentication. The project uses **Bun** as the package manager and runtime.

## Claude Code Workflow

When working on files in this repository, follow these practices:

### Code Quality

- **Formatting**: After completing work on any file, run `bun run format` to ensure proper Prettier formatting is applied
- **Linting**: After completing work on any file, run `bun run lint` to catch and fix any linting issues
- Always ensure code passes both formatting and linting checks before considering the task complete

### Development Server

- **Assume the dev server is running**: Do not ask to start `bun run dev` or `bun run dev:local` - assume the development server is already running during active development sessions
- **Only ask to start if needed**: If you detect that the development server is not running (e.g., through error messages or explicit user indication), then ask if you should start it
- The user will start/stop the server as needed for their workflow

## Monorepo Structure

- **apps/frontend**: Next.js 16 application with App Router
    - **src/components**: App-specific components (auth forms, dashboards, etc.)
    - **src/app/(Public)/api/auth**: Better Auth API endpoints
- **apps/agent**: Next.js 16 agent application with App Router
    - Configured with `basePath: "/agent"` for path-based routing
    - Shares authentication with frontend via cookies
    - **src/app/page.tsx**: Agent home page (served at `/agent`)
- **packages/auth**: Shared authentication configuration and providers
    - Server and client auth configurations
    - SessionProvider component
- **packages/database**: Prisma schema and client configuration
- **packages/ui**: Shared UI component library (shadcn/ui)
    - All shadcn components, utilities, hooks, and styles
    - Includes Tailwind CSS configuration and dependencies
    - Consumed by both frontend and agent apps
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

# UI Components
bun run add-shadcn <name>  # Add ShadCN component(s) to shared UI package

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

**Note**: `.localhost` domains automatically resolve to 127.0.0.1, so no `/etc/hosts` modification is needed.

### Starting Development

**Default (with Caddy - HTTPS):**

```bash
bun run dev
```

Access at: **https://catalyst.localhost**

The `bun run dev` command:

1. Runs pre-flight checks (Caddy installation, CA certificate)
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

- **Frontend**: `https://catalyst.localhost` → `localhost:3000`
- **Agent**: `https://catalyst.localhost/agent` → `localhost:3001/agent`
- **Auth API**: `https://catalyst.localhost/api/auth` → `localhost:3000/api/auth`

All apps share cookies automatically via same domain (`catalyst.localhost`).

### How Cookie Sharing Works

1. **Single Domain**: Both apps are accessed via `catalyst.localhost`
2. **Better Auth Configuration**:
    - Server config in `apps/frontend/src/lib/auth.ts` sets `baseURL: "https://catalyst.localhost"`
    - Client config in both apps uses `NEXT_PUBLIC_APP_URL="https://catalyst.localhost"`
    - Cookies are set with domain=`catalyst.localhost` and path=`/`
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

- Without it, assets load from `https://catalyst.localhost/_next/...` (404)
- With it, assets load from `https://catalyst.localhost/agent/_next/...` (✓)
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

**Note**: `.localhost` domains automatically resolve to 127.0.0.1, so no DNS configuration is needed.

**Cookies not working:**

- Ensure accessing via `https://catalyst.localhost`, not `localhost`
- Check browser DevTools > Application > Cookies
- Verify `.env` has `NEXT_PUBLIC_APP_URL="https://catalyst.localhost"`

## Architecture

### Authentication Flow

The app uses **Better Auth** (v1.4+) with email/password authentication and cross-app session sharing:

- **Shared Auth Package**: `packages/auth`
    - Server config: `packages/auth/src/auth.ts`
    - Client config: `packages/auth/src/auth-client.ts`
    - SessionProvider: `packages/auth/src/providers/session-provider.tsx`
    - Imported in both apps via `@repo/auth`
- Auth API endpoints: `apps/frontend/src/app/(Public)/api/auth/[...all]/route.ts`
- Session management via Better Auth with 7-day expiry
- Middleware proxy pattern in `apps/frontend/src/proxy.ts` handles route protection
- Public routes: `/`, `/signup`, `/api/auth/*`
- All other routes require authentication and redirect to `/` if unauthenticated

**Cross-App Authentication:**

- Frontend hosts the auth API at `/api/auth/*`
- Agent app uses auth client pointing to `https://catalyst.localhost/api/auth`
- Both apps share the same `NEXT_PUBLIC_APP_URL` environment variable
- Both apps import from `@repo/auth` package
- Cookies are set on `catalyst.localhost` domain with path `/`, accessible to both apps
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

This project follows the **ShadCN monorepo pattern** with a shared UI package:

- **Shared UI Package**: `packages/ui` - Contains all shadcn/ui components
    - 23+ UI components (Button, Card, Dialog, Sidebar, etc.)
    - Utility functions (`cn()` for className merging)
    - Hooks (`useIsMobile()`)
    - ThemeProvider component
    - **Global styles** (`packages/ui/src/styles/globals.css`):
        - All Tailwind CSS imports and configuration
        - Complete theme with CSS variables (light/dark modes)
        - Base layer styles
        - Imported by both apps to ensure consistent styling
    - Consumed by both frontend and agent apps via `@repo/ui`
- **Tailwind CSS 4**: Configured at workspace root
    - **Shared styles**: All Tailwind imports, theme variables, and base styles are in `packages/ui/src/styles/globals.css`
    - **App-specific CSS**: Each app imports the shared styles and adds its own `@source` directive
    - Example in `apps/frontend/src/styles/globals.css`:

        ```css
        /* Import shared UI styles and theme from packages/ui */
        @import "../../../../packages/ui/src/styles/globals.css";

        /* Scan frontend app source files for Tailwind classes */
        @source "../../**/*.{js,ts,jsx,tsx}";
        ```

    - The shared `packages/ui/src/styles/globals.css` includes:
        - `@source "../**/*.{js,ts,jsx,tsx}"` to scan UI components
        - All Tailwind imports (@import "tailwindcss", etc.)
        - Complete theme configuration (CSS variables, dark mode, base layer)

- **shadcn/ui Configuration**:
    - Base style: `base-nova`
    - Icon library: `hugeicons`
    - Each app has its own `components.json` that points to the shared UI package
    - Shared package: `packages/ui/components.json`
- Uses `@base-ui/react` for headless component primitives
- Theme support via `next-themes` (dark mode configured)

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
- `NEXT_PUBLIC_APP_URL`: Application URL for callbacks (use `https://catalyst.localhost` with Caddy, `http://localhost:3000` for dev:local)

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
    - URL: `https://catalyst.localhost/agent/dashboard`
4. **Links**: Use Next.js `<Link href="/dashboard">` (basePath is automatic)
5. **Assets**: All `_next` assets automatically served from `/agent/_next/`
6. **Auth**: Import from `@repo/auth` - sessions shared automatically
7. **UI Components**: Import from `@repo/ui` - shares the same component library as frontend

## Component Development

### ShadCN UI Components in Monorepo

This project follows the **ShadCN monorepo pattern** where all UI components are centralized in a shared package (`packages/ui`). This allows both the frontend and agent apps to use the same component library.

#### Package Structure

```
packages/ui/
├── components.json          # ShadCN configuration for the UI package
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts            # Main exports
    ├── components/         # All ShadCN UI components
    │   ├── button.tsx
    │   ├── card.tsx
    │   ├── dialog.tsx
    │   ├── sidebar.tsx
    │   ├── providers/
    │   │   └── theme-provider.tsx
    │   └── index.ts        # Component re-exports
    ├── lib/
    │   └── utils.ts        # cn() utility
    ├── hooks/
    │   └── use-mobile.tsx
    └── styles/
        └── globals.css     # Theme CSS variables
```

#### Adding New ShadCN Components

**IMPORTANT**: ShadCN components should be added to the **shared UI package**, not individual apps.

##### Automated Script (Recommended)

The easiest way to add components is using the automated script from the **root directory**:

```bash
bun run add-shadcn <component-name> [additional-components...]
```

**Examples**:

```bash
bun run add-shadcn accordion
bun run add-shadcn accordion tabs form
```

This script automatically handles all steps: adding the component, fixing imports, formatting, and linting.

**Don't forget**: After the script completes, export the component in `packages/ui/src/components/index.ts`.

##### Manual Workflow

If you prefer to run the steps manually:

**Step 1: Navigate to the UI Package**

```bash
cd packages/ui
```

##### Step 2: Add Component Using ShadCN CLI

```bash
bunx --bun shadcn@latest add <component-name>
```

Examples:

```bash
bunx --bun shadcn@latest add accordion
bunx --bun shadcn@latest add tabs
bunx --bun shadcn@latest add form
```

The CLI will automatically:

- Install the component in `packages/ui/src/components/`
- Resolve internal dependencies
- Generate imports using `@/` aliases (e.g., `import { cn } from "@/lib/utils"`)

##### Step 3: Fix Imports (CRITICAL)

**IMPORTANT**: Immediately run the fix-imports script to convert `@/` alias imports to relative imports:

```bash
bun run fix-imports
```

**Why this is necessary**: The ShadCN CLI generates components with `@/` alias imports that would collide with the frontend and agent apps' own `@/` aliases, causing build errors. The fix-imports script converts these to relative imports that work correctly in the monorepo:

- `from "@/lib/utils"` → `from "../lib/utils"`
- `from "@/components/button"` → `from "./button"`
- `from "@/hooks/use-mobile"` → `from "../hooks/use-mobile"`

**Complete workflow** (can be run as a one-liner):

```bash
cd packages/ui && bunx --bun shadcn@latest add <component-name> && bun run fix-imports
```

##### Step 4: Export the Component

Add the component to `packages/ui/src/components/index.ts`:

```typescript
export * from "./accordion";
export * from "./tabs";
export * from "./form";
```

##### Step 5: Format and Lint

From the root directory, format and lint the code:

```bash
cd ../.. && bun run format && bun run lint
```

##### Step 6: Use in Apps

Import from the shared package in both frontend and agent apps:

```typescript
// In apps/frontend or apps/agent
import { Accordion, Tabs, Form } from "@repo/ui";
```

#### Configuration Notes

- Each workspace has its own `components.json`:
    - `packages/ui/components.json` - Uses `@/` aliases for ShadCN CLI compatibility
    - `apps/frontend/components.json` - Points to `@repo/ui`
    - `apps/agent/components.json` - Points to `@repo/ui`
- All `components.json` files must have the same:
    - `style`: `base-nova`
    - `iconLibrary`: `hugeicons`
    - `baseColor`: `zinc`
- The `tailwind.config` field is left empty (Tailwind CSS v4)
- **Important**: `packages/ui/components.json` does NOT have a `resolvedPaths` field (causes validation errors)
- **Monorepo Path Alias Issue**: The UI package uses `@/` aliases in `components.json` for ShadCN CLI compatibility, but these must be converted to relative imports using the `fix-imports` script to avoid collisions with app-level `@/` aliases

#### Importing Components

All apps import components from the shared package:

```typescript
// Import individual components
import { Button, Card, Dialog } from "@repo/ui";

// Import utilities
import { cn } from "@repo/ui";

// Import hooks
import { useIsMobile } from "@repo/ui";

// Import ThemeProvider
import { ThemeProvider } from "@repo/ui";
```

#### App-Specific Components

Custom components that are specific to an app (not shared UI primitives) should stay in the app's component directory:

**Frontend-specific components:**

- Location: `apps/frontend/src/components/`
- Examples: `auth/sign-in-form.tsx`, `dashboard/header.tsx`, `AppSidebar.tsx`
- Import alias: `@/components`

**Agent-specific components:**

- Location: `apps/agent/src/components/`
- Import alias: `@/components`

#### When to Add to Shared UI Package

Add to `packages/ui` when:

- It's a primitive ShadCN component (Button, Card, Dialog, etc.)
- It's a reusable utility or hook used by UI components
- Both apps need the same component

Keep in app directory when:

- It's business logic specific to that app
- It contains app-specific routing or state management
- It's a composed component using multiple UI primitives for a specific feature

### Troubleshooting

**Component imports not working:**

- Run `bun install` from the root to ensure workspace dependencies are linked
- Verify `@repo/ui` is in the app's `package.json` dependencies

**Error: "Invalid configuration found in components.json":**

- Ensure `packages/ui/components.json` does NOT have a `resolvedPaths` field
- Verify aliases use `@/` format (e.g., `"utils": "@/lib/utils"`)
- Check that all required fields are present: `style`, `rsc`, `tsx`, `tailwind`, `iconLibrary`, `aliases`

**Error: "Module not found: Can't resolve '@/components/...' or '@/lib/utils'":**

- You forgot to run `bun run fix-imports` after adding the component
- Navigate to `packages/ui` and run `bun run fix-imports` now
- Then rebuild the app
- This error occurs because the ShadCN CLI generates `@/` alias imports that collide with app-level aliases

**Error: "Validation failed: resolvedPaths: Required,Required,...":**

- Remove the `resolvedPaths` field from `packages/ui/components.json` entirely
- The newer ShadCN CLI version doesn't work well with this field in monorepos

**ShadCN CLI not finding components:**

- Make sure you're in the correct directory (`packages/ui` or app directory)
- Verify `components.json` exists in the current directory
- Check that aliases in `components.json` point to the correct paths

**Tailwind classes not working or missing:**

- Verify that the app's `globals.css` imports the shared UI styles:
    ```css
    @import "../../../../packages/ui/src/styles/globals.css";
    @source "../../**/*.{js,ts,jsx,tsx}";
    ```
- The `@import` must come **before** the app's `@source` directive
- Each app's CSS file should be minimal - just import shared styles and scan its own source
- The shared `packages/ui/src/styles/globals.css` contains all Tailwind configuration
- Restart the dev server after changing CSS imports or `@source` directives
- Clear the Next.js build cache if styles still don't appear: `rm -rf apps/[app]/.next`
