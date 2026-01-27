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

## Next.js MCP (Model Context Protocol) Integration

This project uses **Next.js 16** which has built-in MCP (Model Context Protocol) support. MCP provides direct access to the Next.js dev server's runtime information, making it the **preferred method** for investigating issues, understanding the application state, and planning changes.

### What is Next.js MCP?

Next.js 16+ automatically exposes an MCP endpoint at `/_next/mcp` when the dev server starts. No configuration needed - it's enabled by default and provides real-time access to:

- Compilation errors and runtime diagnostics
- Complete route information and structure
- Build status and cache state
- Component hierarchy and data flows
- Browser console messages and errors

### Available MCP Tools

#### Core Development Tools

**`mcp__next-devtools__init`** - Initialize Next.js DevTools MCP context

- **When to use**: At the start of every Next.js development session
- **Purpose**: Establishes documentation-first approach and lists all available MCP tools
- **Important**: This resets AI knowledge baseline to rely on official Next.js docs

**`mcp__next-devtools__nextjs_docs`** - Fetch Next.js official documentation

- **When to use**: For ANY Next.js-related questions or before implementing Next.js features
- **Workflow**:
    1. First read the `nextjs-docs://llms-index` MCP resource to get documentation paths
    2. Find the relevant path for your query
    3. Call this tool with the exact path
- **Example**: `nextjs_docs({ path: "/docs/app/api-reference/functions/refresh" })`
- **Critical**: Do NOT guess documentation paths - always consult the index first

**`mcp__next-devtools__nextjs_index`** - Discover running Next.js dev servers

- **When to use**: FIRST CHOICE for investigating or understanding the running application
- **Use proactively when**:
    - Before implementing ANY changes to the app (check current structure first)
    - For diagnostic questions ("What's happening?", "Why isn't this working?")
    - For agentic codebase search (try this before static file search)
    - When asked about routes, errors, or build status
- **Returns**: List of running servers with ports, PIDs, and available MCP tools
- **Fallback**: If auto-discovery fails, ask user for port and call with `port` parameter

**`mcp__next-devtools__nextjs_call`** - Call specific MCP tools on dev server

- **When to use**: After discovering servers with `nextjs_index`
- **Requirements**:
    - Port number of target dev server
    - Tool name to execute
    - Optional arguments object (if required)
- **CRITICAL**:
    - `args` parameter MUST be an object `{key: "value"}`, NOT a string
    - If tool doesn't require arguments, OMIT the `args` parameter entirely - do NOT pass `{}` or `"{}"`
- **Common tools**:
    - Error diagnostics (compilation/runtime errors)
    - Route information (list all routes)
    - Build status (check compilation state)
    - Cache management (clear caches)

**`mcp__next-devtools__browser_eval`** - Browser automation with Playwright

- **When to use**: For verifying pages, testing user flows, or detecting runtime issues
- **CRITICAL for Next.js projects**: Use Next.js MCP tools (`nextjs_index`/`nextjs_call`) FIRST for error reporting
    - Only use browser console forwarding as fallback when Next.js MCP isn't available
    - Next.js MCP provides superior error reporting directly from the dev server
- **Use browser automation when**:
    - Verifying pages in Next.js projects (especially during upgrades)
    - Testing client-side behavior that Next.js runtime cannot capture
    - Detecting hydration issues, runtime errors, or client-side problems
- **Why better than curl**: Executes JavaScript, detects runtime errors, verifies full user experience
- **Available actions**: start, navigate, click, type, fill_form, evaluate, screenshot, console_messages, close, drag, upload_file

#### Migration and Upgrade Tools

**`mcp__next-devtools__upgrade_nextjs_16`** - Upgrade to Next.js 16

- **When to use**: When upgrading from Next.js 15 or earlier
- **Features**:
    - Runs official codemod FIRST (requires clean git state)
    - Automatically upgrades Next.js, React, and React DOM
    - Handles async API changes (params, searchParams, cookies, headers)
    - Config migration and deprecated API removals
    - React 19 compatibility
- **Requirements**: Clean git working directory, Node.js 18+, package manager installed

**`mcp__next-devtools__enable_cache_components`** - Migrate to Cache Components mode

- **When to use**: Migrating to or enabling Cache Components in Next.js 16+
- **Handles ALL migration steps**:
    - Configuration updates (cacheComponents flag)
    - Dev server startup (MCP enabled by default)
    - Error detection via browser automation + Next.js MCP
    - Automated fixing (Suspense boundaries, "use cache" directives, cacheLife, cache tags)
    - Verification (validates all routes work)
- **Requirements**: Next.js 16.0.0+ (stable or canary only), clean working directory preferred

### Workflow Best Practices

#### Investigation and Planning Workflow

**ALWAYS use Next.js MCP before making changes:**

1. **Start with MCP discovery**: Call `nextjs_index` to see available servers and tools
2. **Gather runtime context**: Use `nextjs_call` to get current errors, routes, and build status
3. **Understand current state**: Check component hierarchy, data flows, and runtime diagnostics
4. **Plan changes**: Now that you understand the current state, plan your implementation
5. **Verify changes**: Use browser automation or MCP tools to verify fixes work

**Example workflow for "Add loading state to dashboard":**

```
1. Call nextjs_index to discover dev server
2. Call nextjs_call to get current routes and component structure
3. Read relevant files based on MCP information
4. Plan and implement loading state
5. Use browser_eval to verify loading state works
6. Check for errors via nextjs_call
```

#### Documentation-First Approach

**CRITICAL**: The Next.js MCP tools establish a **mandatory documentation-first workflow**:

1. **Initialize MCP context**: Call `mcp__next-devtools__init` at session start
2. **Consult docs for ALL Next.js questions**: Use `nextjs_docs` tool instead of relying on prior knowledge
3. **Always check the index**: Read `nextjs-docs://llms-index` resource before calling `nextjs_docs`
4. **No guessing**: Never guess documentation paths or Next.js behavior

#### Prioritization Rules

**When investigating issues or planning changes:**

1. **Next.js MCP FIRST**: Use `nextjs_index` and `nextjs_call` for runtime information
2. **Browser automation SECOND**: Use `browser_eval` for client-side verification
3. **Static file search LAST**: Only use file-based search if MCP tools don't provide the answer

**When researching Next.js features:**

1. **Official docs FIRST**: Use `nextjs_docs` tool (never guess paths)
2. **Runtime inspection SECOND**: Use MCP tools to see how it's currently implemented
3. **Web search LAST**: Only if docs don't cover the specific scenario

### MCP vs. Traditional Debugging

**Use Next.js MCP instead of:**

- ❌ `curl` or HTTP requests to check pages (use `browser_eval` with Playwright)
- ❌ Reading build logs manually (use `nextjs_call` for build status)
- ❌ Guessing which routes exist (use `nextjs_call` for route information)
- ❌ Manually checking console in browser (use `browser_eval` console_messages)
- ❌ Relying on outdated Next.js knowledge (use `nextjs_docs` with documentation index)

**Benefits of MCP approach:**

- ✅ Real-time runtime information directly from dev server
- ✅ Faster diagnosis with structured error data
- ✅ Complete route and component hierarchy
- ✅ Browser automation for full user experience testing
- ✅ Documentation-first approach ensures accuracy
- ✅ No need to restart dev server - Fast Refresh applies changes instantly

### Common MCP Workflows

**Check for compilation errors:**

```typescript
// 1. Discover server
mcp__next - devtools__nextjs_index();

// 2. Get errors from port 3000
mcp__next - devtools__nextjs_call({ port: "3000", toolName: "get_errors" });
```

**List all available routes:**

```typescript
mcp__next - devtools__nextjs_call({ port: "3000", toolName: "list_routes" });
```

**Clear Next.js caches:**

```typescript
mcp__next - devtools__nextjs_call({ port: "3000", toolName: "clear_cache" });
```

**Verify page loads correctly:**

```typescript
// 1. Start browser
mcp__next - devtools__browser_eval({ action: "start", headless: true });

// 2. Navigate to page
mcp__next -
    devtools__browser_eval({ action: "navigate", url: "https://catalyst.localhost/dashboard" });

// 3. Check console messages
mcp__next - devtools__browser_eval({ action: "console_messages", errorsOnly: true });

// 4. Take screenshot
mcp__next - devtools__browser_eval({ action: "screenshot", fullPage: true });
```

**Look up Next.js documentation:**

```typescript
// 1. Read documentation index (use ReadMcpResourceTool)
ReadMcpResourceTool({ server: "next-devtools", uri: "nextjs-docs://llms-index" });

// 2. Find relevant path in index (e.g., "/docs/app/api-reference/functions/refresh")

// 3. Fetch documentation
mcp__next - devtools__nextjs_docs({ path: "/docs/app/api-reference/functions/refresh" });
```

### Important Notes

- **MCP requires Next.js 16+**: If on Next.js 15 or earlier, use `upgrade_nextjs_16` first
- **MCP is enabled by default**: No configuration needed in Next.js 16+
- **Dev server must be running**: MCP tools require an active development server
- **Port discovery**: If auto-discovery fails, ask user for port number
- **Clean git state**: Upgrade and migration tools require clean working directory
- **Browser automation**: Playwright is auto-installed if needed

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

### DRY Methodology for Multiple Apps

This monorepo follows strict **Don't Repeat Yourself (DRY)** principles to maintain a single source of truth for shared functionality between the frontend and agent apps.

#### Centralized Navigation Configuration

**Location**: `packages/ui/src/config/navigation.ts`

**Purpose**: Single source of truth for all navigation items across Sidebar, TopBar, and CommandPalette.

**Structure**:

```typescript
export const navigationItems: NavigationItem[] = [
    {
        label: "Dashboard",
        icon: DashboardSpeed01Icon,
        href: "/dashboard",
        app: "frontend", // Which app this item belongs to
        keywords: ["home", "overview"], // For command palette search
        children: [
            {
                label: "Overview",
                href: "/dashboard",
                keywords: ["home", "overview", "main"]
            },
            {
                label: "Sales",
                href: "/dashboard/sales",
                keywords: ["sales", "revenue"]
            }
        ]
    }
    // ... more items
];
```

**Key Properties**:

- `app`: Specifies which app the item belongs to ("frontend" or "agent")
- `keywords`: Array of search terms for command palette fuzzy search
- `children`: Optional nested navigation items

**Helper Functions**:

- `getNavigationItemsForApp(app)`: Filter items for a specific app
- `getAllNavigationItems()`: Get all items (for cross-app navigation)

**Usage**:

- **Sidebar**: Uses `navigationItems` directly to show all navigation
- **CommandPalette**: Uses `getAllNavigationItems()` to build navigation groups with smart routing:
    - Current app items use internal routing (`path`)
    - Other app items use cross-app navigation (`href`)

**Adding New Navigation**:

```typescript
// Add to packages/ui/src/config/navigation.ts
{
    label: "Settings",
    icon: SettingsIcon,
    href: "/settings",
    app: "frontend",
    keywords: ["config", "preferences", "options"]
}
```

This single addition automatically updates Sidebar, CommandPalette, and any other components that consume the navigation config.

#### Centralized User Menu Configuration

**Location**: `packages/ui/src/config/user-menu.ts`

**Purpose**: Single source of truth for user actions (Settings, Sign out, etc.) across UserMenu dropdown and CommandPalette.

**Structure**:

```typescript
export const userMenuItems: UserMenuItem[] = [
    {
        label: "Settings",
        action: "settings",
        icon: Settings02Icon,
        keywords: ["settings", "preferences", "config"]
    },
    {
        label: "Sign out",
        action: "signout",
        variant: "destructive",
        icon: Logout03Icon,
        keywords: ["logout", "signout", "exit"]
    }
];
```

**Key Properties**:

- `action`: Unique identifier for the action ("settings", "signout", etc.)
- `icon`: Icon component for command palette
- `keywords`: Array of search terms for command palette
- `variant`: Visual variant ("default" or "destructive")

**Usage**:

- **UserMenu dropdown**: Renders items with click handlers
- **CommandPalette**: Automatically includes user menu items with default behaviors:
    - `onSignOut`: Calls Better Auth `signOut()` and redirects to home
    - `onSettings`: Opens built-in settings dialog

**Default Behaviors**: The CommandPalette component provides automatic implementations for common actions. Apps don't need to pass handlers unless they want to override defaults.

**Adding New User Actions**:

```typescript
// 1. Add to packages/ui/src/config/user-menu.ts
{
    label: "Profile",
    action: "profile",
    icon: UserIcon,
    keywords: ["user", "account", "profile"]
}

// 2. Update UserMenuItem type
export type UserMenuItem = {
    action: "settings" | "signout" | "profile"; // Add new action
    // ... other properties
};

// 3. Optionally override default behavior in app layout
const userActions: UserActions = {
    onProfile: () => router.push("/profile")
};
<CommandPalette appNavigation={appNavigation} userActions={userActions} />
```

#### CommandPalette Component Architecture

**Location**: `packages/ui/src/components/command-palette.tsx`

The CommandPalette is the central hub for navigation and user actions, consuming both centralized configs.

**Automatic Features**:

1. **Navigation Groups**: Built from `packages/ui/src/config/navigation.ts`
    - Automatically groups by app (Frontend, Agent)
    - Smart routing: internal `path` for current app, `href` for cross-app
    - Includes nested children as flattened commands

2. **Quick Switch**: Optional cross-app switcher
    - Filters out current app
    - Provides fast switching between Frontend and Agent

3. **User Menu**: Built from `packages/ui/src/config/user-menu.ts`
    - Appears in "Account" group
    - Default implementations provided (no boilerplate needed)
    - Optional custom handlers via `userActions` prop

**Minimal Setup**:

```typescript
// apps/frontend/src/app/(Authenticated)/layout.tsx
const appNavigation: AppNavigationConfig = {
    currentApp: "frontend",
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://catalyst.localhost"
};

<CommandPalette appNavigation={appNavigation} />
```

That's it! Navigation, user menu, and cross-app switching all work automatically.

**Override Defaults** (only when needed):

```typescript
const userActions: UserActions = {
    onSignOut: async () => {
        await doCustomCleanup();
        await signOut();
        router.push("/goodbye");
    }
};

<CommandPalette appNavigation={appNavigation} userActions={userActions} />
```

#### Best Practices for Multi-App Features

When adding features that appear in both frontend and agent apps:

1. **Check if it's navigation**: Add to `packages/ui/src/config/navigation.ts`
2. **Check if it's a user action**: Add to `packages/ui/src/config/user-menu.ts`
3. **Check if it's a UI component**: Add to `packages/ui/src/components/`
4. **Check if it's shared logic**: Add to appropriate shared package (`@repo/auth`, `@repo/database`, etc.)
5. **Check if it's app-specific**: Only then add to individual app directories

**Never duplicate**:

- Navigation items between apps
- User menu items between apps
- Auth logic (use `@repo/auth`)
- Database queries (use `@repo/database`)
- UI components (use `@repo/ui`)

**Key Principle**: If the same code appears in more than one place, it should be in a shared package.

### Authentication Flow

The app uses **Better Auth** (v1.4+) with email/password authentication and cross-app session sharing:

- **Shared Auth Package**: `packages/auth`
    - Server config: `packages/auth/src/auth.ts`
    - Client config: `packages/auth/src/auth-client.ts`
    - SessionProvider: `packages/auth/src/providers/session-provider.tsx`
    - Imported in both apps via `@repo/auth`
- Auth API endpoints: `apps/frontend/src/app/(Public)/api/auth/[...all]/route.ts`
- Session management via Better Auth with 7-day expiry
- Uses Better Auth's recommended integration pattern (Note: Next.js 16 renamed middleware to proxy)

**Proxy Configuration (Route Protection):**

Each Next.js app requires its own `proxy.ts` file to handle authentication:

- **Frontend**: `apps/frontend/src/proxy.ts`
    - Public routes: `/`, `/signup`, `/api/auth/*`
    - All other routes require authentication and redirect to `/` if unauthenticated
- **Agent**: `apps/agent/src/proxy.ts`
    - All routes require authentication (entire agent app is protected)
    - Redirects to frontend root if unauthenticated
    - Important: With `basePath="/agent"`, the proxy sees routes AFTER the basePath is stripped

**Cross-App Authentication:**

- Frontend hosts the auth API at `/api/auth/*`
- Agent app uses auth client pointing to `https://catalyst.localhost/api/auth`
- Both apps share the same `NEXT_PUBLIC_APP_URL` environment variable
- Both apps import from `@repo/auth` package
- Cookies are set on `catalyst.localhost` domain with path `/`, accessible to both apps
- Login on frontend → session automatically available on agent app

**IMPORTANT: When adding a new app to the monorepo:**

1. Create a `proxy.ts` file in the app's `src/` directory
2. Use the agent app's proxy as a template if the entire app requires authentication
3. Use the frontend app's proxy as a template if the app has both public and authenticated routes
4. Import from `@repo/auth` for session validation
5. Configure the matcher to exclude static assets (`_next/static`, `_next/image`, `favicon.ico`)

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

### ShadCN MCP (Model Context Protocol) Integration

This project has built-in MCP support for working with ShadCN components. The ShadCN MCP provides direct access to component registries, examples, and automation tools, making it easier to discover and add components.

#### What is ShadCN MCP?

The ShadCN MCP connects to component registries (like `@shadcn`) and provides tools to:

- Search and discover available components
- View component details and source code
- Find usage examples and demos
- Generate CLI commands for adding components
- Validate component installations

#### Available ShadCN MCP Tools

**`mcp__shadcn__get_project_registries`** - Get configured registries

- **When to use**: To see which component registries are configured in the project
- **Returns**: List of registry names from `components.json`
- **Note**: Requires `components.json` to exist (use `init_project` if missing)

**`mcp__shadcn__search_items_in_registries`** - Search for components

- **When to use**: When looking for a component but unsure of exact name
- **Features**: Fuzzy matching against component names and descriptions
- **Parameters**:
    - `registries`: Array of registry names (e.g., `['@shadcn']`)
    - `query`: Search query string
    - `limit`: Optional max results
    - `offset`: Optional pagination offset
- **Example**: Search for "button" to find Button, ButtonGroup, etc.
- **Follow-up**: After finding a component, use `get_item_examples_from_registries` for usage examples

**`mcp__shadcn__list_items_in_registries`** - List all available components

- **When to use**: To browse all components in a registry
- **Parameters**:
    - `registries`: Array of registry names
    - `limit`: Optional max items to return
    - `offset`: Optional pagination offset

**`mcp__shadcn__view_items_in_registries`** - View component details

- **When to use**: To see detailed information about specific components
- **Returns**: Component name, description, type, and file contents
- **Parameters**:
    - `items`: Array of item names with registry prefix (e.g., `['@shadcn/button', '@shadcn/card']`)
- **Note**: For usage examples, use `get_item_examples_from_registries` instead

**`mcp__shadcn__get_item_examples_from_registries`** - Find usage examples

- **When to use**: To see how to use a component with complete implementation code
- **Search patterns**:
    - `{component-name}-demo` (e.g., "accordion-demo")
    - `{component-name} example` (e.g., "button example")
    - `example-{feature}` (e.g., "example-booking-form")
- **Returns**: Full implementation code with dependencies
- **Parameters**:
    - `registries`: Array of registry names
    - `query`: Search query for examples

**`mcp__shadcn__get_add_command_for_items`** - Get CLI add command

- **When to use**: To get the exact `shadcn` CLI command for adding components
- **Returns**: Complete command ready to run (e.g., `bunx --bun shadcn@latest add button card`)
- **Parameters**:
    - `items`: Array of items with registry prefix (e.g., `['@shadcn/button', '@shadcn/card']`)

**`mcp__shadcn__get_audit_checklist`** - Get post-installation checklist

- **When to use**: After creating new components or generating code files
- **Returns**: Checklist to verify everything is working correctly
- **Important**: Run this after all required installation steps are complete

#### ShadCN MCP Workflow

**Standard component addition workflow:**

1. **Search for component**: Use `search_items_in_registries` to find the component
2. **View examples**: Use `get_item_examples_from_registries` to see usage patterns
3. **Get add command**: Use `get_add_command_for_items` to get the CLI command
4. **Run the command**: Execute the command in the terminal (or use the automated script)
5. **Audit installation**: Use `get_audit_checklist` to verify everything works

**Example workflow - Adding a dialog component:**

```typescript
// 1. Search for dialog components
mcp__shadcn__search_items_in_registries({
    registries: ["@shadcn"],
    query: "dialog"
});

// 2. View dialog component details
mcp__shadcn__view_items_in_registries({
    items: ["@shadcn/dialog"]
});

// 3. Find usage examples
mcp__shadcn__get_item_examples_from_registries({
    registries: ["@shadcn"],
    query: "dialog-demo"
});

// 4. Get the add command
mcp__shadcn__get_add_command_for_items({
    items: ["@shadcn/dialog"]
});

// 5. After installation, verify
mcp__shadcn__get_audit_checklist();
```

#### When to Use ShadCN MCP vs. Manual Installation

**Use ShadCN MCP when:**

- ✅ Discovering what components are available
- ✅ Searching for components by keyword or feature
- ✅ Looking for usage examples and demos
- ✅ Unsure of exact component names
- ✅ Want to see component implementation before adding
- ✅ Need to verify registries are configured correctly

**Use manual workflow when:**

- ✅ You already know the exact component name
- ✅ Using the automated `bun run add-shadcn` script (recommended)
- ✅ Adding multiple related components at once

#### Integration with Existing Workflow

The ShadCN MCP **complements** the existing component addition workflow documented below:

- **Discovery phase**: Use ShadCN MCP to search and explore components
- **Installation phase**: Use the automated `bun run add-shadcn` script (recommended)
- **Verification phase**: Use ShadCN MCP audit checklist

**Best practice workflow:**

1. Use `mcp__shadcn__search_items_in_registries` to find components
2. Use `mcp__shadcn__get_item_examples_from_registries` to see usage examples
3. Run `bun run add-shadcn <component-name>` (automated script handles everything)
4. Export component in `packages/ui/src/components/index.ts`
5. Use `mcp__shadcn__get_audit_checklist` to verify installation

#### Important Notes

- **Requires components.json**: All ShadCN MCP tools require a valid `components.json` file
- **Registry configuration**: Default registry is `@shadcn`, additional registries can be configured
- **Monorepo setup**: ShadCN MCP understands the project structure and registries
- **Examples are separate items**: Component examples are stored as separate registry items (e.g., `accordion-demo`, `button-example`)
- **Item naming convention**: Items must include registry prefix when viewing or getting commands (e.g., `@shadcn/button`, not just `button`)

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

### Using HugeIcons

This project uses [HugeIcons](https://hugeicons.com/) free collection (4,600+ icons) for all icon needs. HugeIcons are rendered via the `HugeiconsIcon` component from `@hugeicons/react`.

#### Correct Import Pattern

**CRITICAL**: Icons must be imported individually, NOT via namespace imports.

**CORRECT:**

```typescript
import { HomeIcon, Settings02Icon, UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

function MyComponent() {
    return <HugeiconsIcon icon={HomeIcon} className="size-6" />;
}
```

**INCORRECT (Will cause runtime errors):**

```typescript
// ❌ DO NOT USE namespace imports
import * as Icons from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

function MyComponent() {
    // ❌ This will fail with "currentIcon is not iterable"
    return <HugeiconsIcon icon={Icons.HomeIcon} className="size-6" />;
}
```

#### Icon Sizing

Icons are sized using Tailwind's `size-*` utilities:

```typescript
<HugeiconsIcon icon={HomeIcon} className="size-4" />   {/* 16px */}
<HugeiconsIcon icon={HomeIcon} className="size-6" />   {/* 24px */}
<HugeiconsIcon icon={HomeIcon} className="size-8" />   {/* 32px */}
<HugeiconsIcon icon={HomeIcon} className="size-12" />  {/* 48px - default in stories */}
```

#### Icon Colors

Icons inherit text color and can be themed:

```typescript
<HugeiconsIcon icon={HomeIcon} className="size-6 text-foreground" />
<HugeiconsIcon icon={HomeIcon} className="size-6 text-muted-foreground" />
<HugeiconsIcon icon={HomeIcon} className="size-6 text-primary" />
<HugeiconsIcon icon={HomeIcon} className="size-6 text-destructive" />
```

#### Finding Available Icons

1. **Browse in Storybook**: Run `bun run storybook` and navigate to "Foundation/Icons" to see commonly used icons
2. **Check the package**: Look at `packages/ui/src/components/icons.stories.tsx` for verified icon names
3. **HugeIcons website**: Visit [hugeicons.com](https://hugeicons.com/) to search the full collection
4. **Common icons in this project**:
    - Navigation: `HomeIcon`, `DashboardSpeed01Icon`, `Settings02Icon`, `ChevronDown`
    - Files: `FileIcon`, `FolderIcon`, `FolderOpenIcon`
    - User: `UserIcon`, `Logout03Icon`
    - Communication: `MessageMultiple01Icon`
    - Time: `CalendarIcon`, `ClockIcon`
    - Status: `LockIcon`, `StarIcon`
    - Commerce: `ShoppingCart01Icon`
    - AI: `AiNetworkIcon`

#### Adding Icons to Navigation Config

When adding icons to navigation items in `packages/ui/src/config/navigation.ts` or `packages/ui/src/config/user-menu.ts`:

```typescript
import { Settings02Icon, HomeIcon } from "@hugeicons/core-free-icons";

export const navigationItems: NavigationItem[] = [
    {
        label: "Home",
        icon: HomeIcon, // Pass the icon directly, not as JSX
        href: "/",
        app: "frontend",
        keywords: ["home", "dashboard"]
    },
    {
        label: "Settings",
        icon: Settings02Icon,
        href: "/settings",
        app: "frontend",
        keywords: ["settings", "config"]
    }
];
```

**Important**: Pass the icon component reference (e.g., `HomeIcon`), NOT JSX (e.g., `<HomeIcon />`).

#### Common Mistakes to Avoid

1. **Namespace imports**: `import * as Icons` - This doesn't work with HugeiconsIcon
2. **Non-existent icon names**: Not all icon names you might expect exist. Verify names first.
3. **Using icons directly**: Don't use HugeIcons components directly - always wrap with `HugeiconsIcon`
4. **Typos in icon names**: Icon names are case-sensitive and follow specific patterns (e.g., `Settings02Icon`, not `SettingsIcon`)

#### Icon Naming Conventions

HugeIcons use numbered suffixes when multiple variants exist:

- `DashboardSpeed01Icon` (variant 01)
- `Settings02Icon` (variant 02)
- `Message01Icon`, `MessageMultiple01Icon` (different types)

If an icon import fails, try:

1. Check the exact name in the package or Storybook
2. Try different variant numbers (01, 02, 03)
3. Search for similar names (e.g., "MessageIcon" might be "Message01Icon")

#### Example: Complete Component with Icons

```typescript
import { HugeiconsIcon } from "@hugeicons/react";
import { HomeIcon, Settings02Icon, UserIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/ui";

export function Navigation() {
    return (
        <nav className="flex gap-2">
            <Button variant="ghost" size="icon">
                <HugeiconsIcon icon={HomeIcon} className="size-5" />
            </Button>
            <Button variant="ghost" size="icon">
                <HugeiconsIcon icon={Settings02Icon} className="size-5" />
            </Button>
            <Button variant="ghost" size="icon">
                <HugeiconsIcon icon={UserIcon} className="size-5" />
            </Button>
        </nav>
    );
}
```

#### Storybook Icon Showcase

The UI package includes an icon showcase story at `packages/ui/src/components/icons.stories.tsx` with:

- **CommonIcons**: Curated collection organized by category
- **IconSizes**: Visual reference for all size utilities
- **IconColors**: Theme color examples

The showcase uses a constant `ICON_SIZE = "size-12"` that can be easily changed to adjust all icon sizes at once.

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
