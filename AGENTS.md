# AGENTS.md

## Cursor Cloud specific instructions

### Overview

AgentC2 is a Turborepo monorepo with three Next.js apps and several shared packages. See `CLAUDE.md` for full technology stack, environment variables, and development commands.

### Services

| Service | Port | Start Command |
|---------|------|---------------|
| Frontend (marketing) | 3000 | `cd apps/frontend && bun run dev` |
| Agent app (core) | 3001 | `cd apps/agent && bun run dev` |
| Admin dashboard | 3003 | `cd apps/admin && bun run dev` |

All three start together via `bun run dev:local` (without Caddy) or `bun run dev` (with Caddy/HTTPS). In Cloud Agent environments, use `dev:local` since Caddy is not installed.

### Key Gotchas

- **Memory**: TypeScript type-checking and builds require `NODE_OPTIONS="--max-old-space-size=8192"` to avoid OOM on the `agent` app.
- **PostgreSQL + pgvector**: The Prisma schema requires the `vector` extension. After creating a fresh database, run `CREATE EXTENSION IF NOT EXISTS vector;` before `prisma db push`.
- **Prisma db push**: The turbo `db:push` task uses `scripts/safe-db-push.sh` which prompts interactively. For non-interactive push use: `cd packages/database && bunx dotenv-cli -e ../../.env -- bun run --bun prisma db push --accept-data-loss` (safe on empty databases).
- **Caddy predev hook**: The root `predev` script runs `scripts/check-caddy-setup.sh` which exits non-zero if Caddy is missing. Use `dev:local` to skip it: `bun run dev:local`.
- **Lint**: There is a pre-existing `ajv` version conflict (`ajv: ^8.18.0` override in root `package.json`) causing ESLint to fail with `Cannot set properties of undefined (setting 'defaultMeta')` in apps using `eslint-config-next`.
- **Test user creation**: Use `bun run scripts/create-test-user.ts` to create a test user for E2E testing (default: `e2e-test@catalyst.local` / `E2ETestPassword123!`).
- **`.env` setup**: Copy `.env.example` to `.env`. At minimum set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`, and `BEHIND_PROXY=false`.
- **Turbo TUI**: `bun run dev` uses Turbo's TUI mode which is interactive. When starting services in background for testing, start individual apps directly instead.

### Standard Commands

See `README.md` and `CLAUDE.md` for the full list. Key ones:
- `bun run build` — build all apps
- `bun run lint` — lint all workspaces
- `bun run type-check` — TypeScript checking
- `bun run db:generate` — generate Prisma client
- `bun run test` — run Vitest tests
