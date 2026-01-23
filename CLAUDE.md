# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Turborepo monorepo** for the Appello application, built with Next.js 16 (App Router), React 19, Prisma (MySQL), and Better Auth for authentication. The project uses **Bun** as the package manager and runtime.

## Monorepo Structure

- **apps/frontend**: Next.js 16 application with App Router
- **packages/database**: Prisma schema and client configuration
- **packages/ui**: Shared UI components (shadcn-based)
- **packages/lib**: Shared utilities (cn function, etc.)
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
bun run db:push            # Push schema changes to database
bun run db:migrate         # Run migrations
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
4. Push schema to database: `bun run db:push`
5. (Optional) Seed database: `bun run db:seed`

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
- **shadcn/ui**: Component library in `packages/ui/src/`
- Uses `@base-ui/react` for headless components
- Theme support via `next-themes` (dark mode configured)
- Utility function `cn()` from `packages/lib` for className merging

### TypeScript Configuration

- Shared configs in `packages/typescript-config`
- Workspace imports use `workspace:*` protocol
- Path aliases configured per workspace (e.g., `@/` in frontend)

## Important Notes

### Environment Variables

Required environment variables (see `.env.example`):
- `DATABASE_URL`: MySQL connection string
- `BETTER_AUTH_SECRET`: Auth secret key (generate with Better Auth CLI)
- `NEXT_PUBLIC_APP_URL`: Application URL for callbacks

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

When modifying the Prisma schema:
1. Edit `packages/database/prisma/schema.prisma`
2. Run `bun run db:generate` to update the Prisma client
3. Run `bun run db:push` for development (schema sync without migrations)
4. For production: `bun run db:migrate` to create migration files

## Adding New Features

When adding authenticated features:
1. Create routes in `apps/frontend/src/app/(Authenticated)/`
2. They will automatically be protected by the middleware
3. Access user session via Better Auth hooks or API

When adding public features:
1. Create routes in `apps/frontend/src/app/(Public)/`
2. Or add to `publicRoutes` array in `apps/frontend/src/proxy.ts`

## Component Development

Shared components should be added to `packages/ui/src/` and exported via `packages/ui/src/index.ts`. These components can then be imported in any workspace using `@repo/ui`.
