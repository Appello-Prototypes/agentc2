# @repo/database

Shared Prisma database package for the Appello monorepo.

## Setup

1. Make sure you have a `.env` file in the root with the `DATABASE_URL`:

    ```
    DATABASE_URL="mysql://appello_user:appello_password@localhost:3306/appello"
    ```

2. Start the MySQL database:

    ```bash
    docker-compose up -d
    ```

3. Generate the Prisma client:

    ```bash
    bun run db:generate
    ```

4. Push the schema to the database:
    ```bash
    bun run db:push
    ```

## Usage

Import the Prisma client in your apps:

```typescript
import { prisma } from "@repo/database";

const users = await prisma.user.findMany();
```

## Available Scripts

- `db:generate` - Generate Prisma client
- `db:push` - Push schema changes to database (dev)
- `db:migrate` - Create and run migrations
- `db:studio` - Open Prisma Studio
- `db:seed` - Seed the database with example data

## Schema Updates

1. Update `prisma/schema.prisma`
2. Run `bun run db:generate` to regenerate the client
3. Run `bun run db:push` (dev) or `bun run db:migrate` (production)
