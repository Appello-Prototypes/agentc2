# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Turborepo monorepo** for the Appello application, built with Next.js 16 (App Router), React 19, Prisma (MySQL), and Better Auth for authentication. The project uses **Bun** as the package manager and runtime.

## Monorepo Structure

- **apps/frontend**: Next.js 16 application with App Router
  - **src/components/ui**: shadcn UI components
  - **src/lib**: Utility functions (cn function, auth, etc.)
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

## Architecture

### Authentication Flow

The app uses **Better Auth** (v1.4+) with email/password authentication:

- Auth configuration: `apps/frontend/src/lib/auth.ts`
- Session management via Better Auth with 7-day expiry
- Middleware proxy pattern in `apps/frontend/src/proxy.ts` handles route protection
- Public routes: `/`, `/signup`, `/api/auth/*`
- All other routes require authentication and redirect to `/` if unauthenticated

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
- `NEXT_PUBLIC_APP_URL`: Application URL for callbacks

**Important**: `DATABASE_URL` uses a limited user for application security, while `DATABASE_URL_MIGRATE` uses root for migration operations that require elevated privileges.

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

When adding authenticated features:

1. Create routes in `apps/frontend/src/app/(Authenticated)/`
2. They will automatically be protected by the middleware
3. Access user session via Better Auth hooks or API

When adding public features:

1. Create routes in `apps/frontend/src/app/(Public)/`
2. Or add to `publicRoutes` array in `apps/frontend/src/proxy.ts`

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
