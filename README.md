# Appello

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
appello-monorepo/
├── apps/
│   └── frontend/          # Next.js application
├── packages/
│   ├── database/          # Prisma schema and client
│   ├── ui/                # Shared UI components
│   ├── lib/               # Shared utilities
│   └── typescript-config/ # Shared TS configs
├── docker-compose.yml     # MySQL database setup
└── turbo.json            # Turborepo configuration
```

## Prerequisites

- [Bun](https://bun.sh) v1.3.4 or higher
- [Docker](https://www.docker.com/) (for MySQL database)

## Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ver2
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure your database credentials and auth secret.

4. **Start the database**
   ```bash
   docker compose up -d
   ```

5. **Set up the database schema**
   ```bash
   bun run db:generate
   bun run db:push
   ```

6. **Seed the database (optional)**
   ```bash
   bun run db:seed
   ```

7. **Start the development server**
   ```bash
   bun run dev
   ```

8. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

## Available Scripts

### Development
- `bun run dev` - Start all apps in development mode
- `bun run build` - Build all apps and packages
- `bun run start` - Start production server (in apps/frontend)

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
DATABASE_URL="mysql://appello_user:appello_password@localhost:3306/appello"
MYSQL_ROOT_PASSWORD=root_password
MYSQL_DATABASE=appello
MYSQL_USER=appello_user
MYSQL_PASSWORD=appello_password
MYSQL_PORT=3306

# Authentication
NEXT_PUBLIC_APP_URL="http://localhost:3000"
BETTER_AUTH_SECRET="your-secret-key-here"
```

**Note**: Generate a secure `BETTER_AUTH_SECRET` using:
```bash
openssl rand -base64 32
```

## Features

- ✅ Authentication with Better Auth (email/password)
- ✅ Protected routes with middleware
- ✅ Dark mode support
- ✅ Responsive design with Tailwind CSS
- ✅ Type-safe database queries with Prisma
- ✅ Monorepo architecture for code sharing
- ✅ Shared UI component library

## Development Workflow

### Adding New Features

**Protected Routes**: Create new routes in `apps/frontend/src/app/(Authenticated)/`

**Public Routes**: Create new routes in `apps/frontend/src/app/(Public)/`

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

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## License

[Your License Here]
