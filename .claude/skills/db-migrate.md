# Database Migration

**Trigger**: User asks to change the database schema, add a model, modify columns, or run migrations.

**Description**: Safe Prisma schema changes with proper migration workflow.

## Instructions

### Step 1: Read the current schema

```bash
Read packages/database/prisma/schema.prisma
```

Understand the current state before making ANY changes.

### Step 2: Make schema changes

Edit `packages/database/prisma/schema.prisma` with the requested changes.

Key conventions:

- Use `String @id` with `cuid()` or `uuid()` defaults for IDs
- Always include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`
- Scope with `workspaceId String` (non-nullable) for tenant isolation
- Use `@@unique([workspaceId, slug])` for slug-based lookups
- No `tenantId` — use `organizationId` or `workspaceId`
- No `isSystem` flags — all entities are user-owned
- No `SYSTEM` enum values

### Step 3: Generate Prisma client

```bash
bun run db:generate
```

### Step 4: For development — push schema

```bash
bun run db:push
```

This directly applies changes without creating a migration file. Good for rapid iteration.

### Step 5: For production — create migration

```bash
bun run db:migrate
```

This creates a migration file in `packages/database/prisma/migrations/`. Review it carefully.

### Step 6: Type-check

```bash
bun run type-check
```

Ensure the schema changes don't break any existing code.

### Step 7: Update consuming code

If you added/removed/renamed fields, update all code that queries those models:

- Search for the model name across the codebase
- Update any API routes, resolvers, or services that reference changed fields

## Important Notes

- NEVER delete columns without checking for data dependencies
- NEVER rename columns in production without a multi-step migration (add new, copy data, remove old)
- Always check for existing data before adding NOT NULL constraints
- Use `@db.Text` for long string fields (instructions, descriptions)
