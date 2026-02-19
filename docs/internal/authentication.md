# Authentication (Internal)

> **Internal Documentation** — This document covers Better Auth implementation details for the AgentC2 engineering team. Not published to the public documentation site.

---

## Overview

AgentC2 uses [Better Auth](https://better-auth.com/) for session-based authentication, with a Prisma adapter for PostgreSQL storage, social OAuth providers (Google, Microsoft), and cross-app cookie sharing via Caddy reverse proxy.

### Key Files

| File                                    | Purpose                                  |
| --------------------------------------- | ---------------------------------------- |
| `packages/auth/src/auth.ts`             | Better Auth server configuration         |
| `packages/auth/src/auth-client.ts`      | Client-side auth hooks and methods       |
| `packages/auth/src/bootstrap.ts`        | Organization bootstrapping for new users |
| `packages/auth/src/env.ts`              | Environment variable validation          |
| `packages/auth/src/providers/index.ts`  | Session provider component               |
| `packages/auth/src/google-scopes.ts`    | Google OAuth scope definitions           |
| `packages/auth/src/microsoft-scopes.ts` | Microsoft OAuth scope definitions        |
| `packages/auth/src/index.ts`            | Package exports                          |

---

## Better Auth Server Configuration

The core auth instance is configured in `packages/auth/src/auth.ts`:

```typescript
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@repo/database";
import { getAppUrl } from "./env";
import { bootstrapUserOrganization } from "./bootstrap";
import { GOOGLE_OAUTH_SCOPES } from "./google-scopes";
import { MICROSOFT_OAUTH_SCOPES } from "./microsoft-scopes";

const isProduction = process.env.NODE_ENV === "production";
const appUrl = isProduction ? getAppUrl("http://localhost:3000") : "http://localhost:3001";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql"
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: isProduction
    },
    socialProviders: {
        ...(googleClientId && googleClientSecret
            ? {
                  google: {
                      clientId: googleClientId,
                      clientSecret: googleClientSecret,
                      accessType: "offline",
                      prompt: "consent",
                      scope: [...GOOGLE_OAUTH_SCOPES],
                      disableImplicitSignUp: true
                  }
              }
            : {}),
        ...(microsoftClientId && microsoftClientSecret
            ? {
                  microsoft: {
                      clientId: microsoftClientId,
                      clientSecret: microsoftClientSecret,
                      tenantId: microsoftTenantId,
                      scope: [...MICROSOFT_OAUTH_SCOPES],
                      disableImplicitSignUp: true
                  }
              }
            : {})
    },
    session: {
        expiresIn: 60 * 60 * 24, // 24 hours
        updateAge: 60 * 60 * 6, // Update every 6 hours
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5 // 5-minute cookie cache
        }
    },
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: appUrl,
    trustedOrigins,
    advanced: {
        cookiePrefix: "better-auth",
        crossSubDomainCookies: {
            enabled: isProduction
        }
    },
    hooks: {
        after: createAuthMiddleware(async (ctx) => {
            // Auto-bootstrap org for new social sign-up users
            if (ctx.path === "/callback/:id") {
                const newSession = ctx.context.newSession;
                if (newSession) {
                    const existing = await prisma.membership.findFirst({
                        where: { userId: newSession.user.id }
                    });
                    if (!existing) {
                        await bootstrapUserOrganization(
                            newSession.user.id,
                            newSession.user.name,
                            newSession.user.email,
                            undefined,
                            { deferOrgCreation: true }
                        );
                    }
                }
            }
        })
    }
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
```

---

## Session Management

### Session Configuration

| Parameter            | Value       | Description                       |
| -------------------- | ----------- | --------------------------------- |
| `expiresIn`          | 86400 (24h) | Session lifetime                  |
| `updateAge`          | 21600 (6h)  | Session refresh interval          |
| `cookieCache.maxAge` | 300 (5min)  | Client-side cookie cache duration |

Sessions are stored in PostgreSQL via the Prisma adapter. The session cookie is set with the `better-auth` prefix and uses `crossSubDomainCookies` in production for cookie sharing across apps.

### Trusted Origins

```typescript
const trustedOrigins = [appUrl];
if (!isProduction) {
    trustedOrigins.push(
        "http://localhost:3000",
        "http://localhost:3001",
        "https://catalyst.localhost"
    );
}
```

In development, all local ports and the Caddy HTTPS domain are trusted. In production, only the configured `NEXT_PUBLIC_APP_URL` is trusted.

---

## Client-Side Auth

The client-side auth is configured in `packages/auth/src/auth-client.ts`:

```typescript
"use client";

import { createAuthClient } from "better-auth/react";

const baseURL =
    typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const authClient = createAuthClient({
    baseURL
});

export const signIn = authClient.signIn;
export const signUp = authClient.signUp;
export const signOut = authClient.signOut;
export const linkSocial = authClient.linkSocial;
export const useSession = authClient.useSession;
```

The client auto-detects the base URL from the browser's `window.location.origin`, which works seamlessly behind the Caddy reverse proxy.

---

## Cross-App Cookie Sharing via Caddy

### The Problem

The monorepo runs multiple Next.js apps on different ports:

| App      | Port | Path                                      |
| -------- | ---- | ----------------------------------------- |
| Frontend | 3000 | `/docs`, `/blog`, `/_home/*`, legal pages |
| Agent    | 3001 | `/` (everything else)                     |
| Admin    | 3003 | `/admin*`                                 |

Users need to be authenticated across all apps with a single login.

### The Solution

Caddy reverse proxy serves all apps under a single domain (`agentc2.ai` in production, `catalyst.localhost` in development). Since all apps share the same domain, the `better-auth` session cookie is automatically shared.

**Production:**

- `crossSubDomainCookies` is enabled, allowing the cookie to work across subdomains if needed
- All apps are proxied through `agentc2.ai`

**Development:**

- Caddy uses `local_certs` with `tls internal` for self-signed HTTPS at `catalyst.localhost`
- The Caddy admin API runs on `localhost:2019`

### Cookie Settings

```typescript
advanced: {
    cookiePrefix: "better-auth",
    crossSubDomainCookies: {
        enabled: isProduction
    }
}
```

---

## Organization Bootstrapping (RBAC)

When a user signs up via social auth, the system automatically bootstraps their organization membership. The logic is in `packages/auth/src/bootstrap.ts`.

### Bootstrap Flow

1. **Check existing membership** — if user already belongs to an org, return it
2. **Try invite code** — if provided:
    - Check platform-level invites (grants access to create own org)
    - Check org-scoped invites (joins user into existing org)
3. **Try domain matching** — if user's email domain matches:
    - Check `OrganizationDomain` table for explicit domain → org mapping
    - Fallback: check if any existing user shares the same email domain
    - Returns `suggestedOrg` instead of auto-joining (user confirms on onboarding page)
4. **Create new org** — if none of the above apply and `deferOrgCreation` is not set

### Bootstrap Options

```typescript
export interface BootstrapOptions {
    deferOrgCreation?: boolean;
}
```

When `deferOrgCreation` is `true` (used by the social signup hook), the system will not auto-create an org — instead, the onboarding page handles org selection/creation.

### Key Functions

```typescript
export async function bootstrapUserOrganization(
    userId: string,
    userName: string | null,
    userEmail: string | null,
    inviteCode?: string,
    options?: BootstrapOptions
): Promise<BootstrapResult>;

export async function createNewOrganizationForUser(
    userId: string,
    userName: string | null
): Promise<BootstrapResult>;

export function getEmailDomain(email: string): string | null;
```

### New Organization Creation

When creating a new org, the system:

1. Generates an org name from the user's name (e.g., "John's Organization")
2. Creates a unique slug (e.g., `johns-organization`, `johns-organization-2`)
3. Creates a default "Production" workspace
4. Creates an "owner" membership for the user

```typescript
export async function createNewOrganizationForUser(
    userId: string,
    userName: string | null
): Promise<BootstrapResult> {
    const baseName = userName?.trim() || "New Organization";
    const orgName = baseName.endsWith("Organization") ? baseName : `${baseName}'s Organization`;
    const baseSlug = slugify(orgName) || "organization";
    const orgSlug = await generateUniqueOrgSlug(baseSlug);

    const { organization, workspace, membership } = await prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
            data: { name: orgName, slug: orgSlug }
        });
        const workspace = await tx.workspace.create({
            data: {
                organizationId: organization.id,
                name: "Production",
                slug: "production",
                environment: "production",
                isDefault: true
            }
        });
        const membership = await tx.membership.create({
            data: { userId, organizationId: organization.id, role: "owner" }
        });
        return { organization, workspace, membership };
    });

    return { success: true, organization, workspace, membership };
}
```

---

## Session Lifecycle Hooks

### Post-Bootstrap Hook Registry

The auth package exposes a hook registry pattern so consuming apps can register callbacks that run after a new user's org is bootstrapped. This avoids circular dependencies between the auth package and app-specific code.

```typescript
type PostBootstrapCallback = (userId: string, organizationId: string) => Promise<void>;
const postBootstrapCallbacks: PostBootstrapCallback[] = [];

export function onPostBootstrap(cb: PostBootstrapCallback): void {
    postBootstrapCallbacks.push(cb);
}
```

**Usage in the agent app** (e.g., `instrumentation.ts`):

```typescript
import { onPostBootstrap } from "@repo/auth";

onPostBootstrap(async (userId, organizationId) => {
    // Trigger Gmail sync, provision integrations, etc.
});
```

### Social Auth Callback Hook

The `after` hook in the Better Auth config fires on every `/callback/:id` response (social auth callback):

1. Checks if the user has a new session (first-time sign-up)
2. If no existing membership, runs `bootstrapUserOrganization` with `deferOrgCreation: true`
3. If bootstrap succeeds and an org was created/joined (invite code path), runs all registered post-bootstrap callbacks

---

## Social Auth Provider Configuration

### Google OAuth

Scopes are defined in `packages/auth/src/google-scopes.ts`:

```typescript
export const GOOGLE_OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file"
] as const;

export const GOOGLE_REQUIRED_SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar.events"
] as const;
```

| Scope             | Purpose                                            |
| ----------------- | -------------------------------------------------- |
| `gmail.modify`    | Gmail read, compose, draft, send, label (superset) |
| `calendar.events` | Full CRUD on Google Calendar events                |
| `drive.readonly`  | Read/search Google Drive files                     |
| `drive.file`      | Create Google Docs                                 |

> **Note:** `gmail.modify` is a superset covering `gmail.send`, `gmail.readonly`, `gmail.compose`, and `gmail.labels`.

### Microsoft OAuth

Scopes are defined in `packages/auth/src/microsoft-scopes.ts`:

```typescript
export const MICROSOFT_OAUTH_SCOPES = [
    "User.Read",
    "Mail.Read",
    "Mail.ReadWrite",
    "Mail.Send",
    "Calendars.Read",
    "Calendars.ReadWrite",
    "Team.ReadBasic.All",
    "Channel.ReadBasic.All",
    "ChannelMessage.Send",
    "Chat.ReadWrite",
    "offline_access"
] as const;

export const MICROSOFT_REQUIRED_SCOPES = [
    "User.Read",
    "Mail.Read",
    "Mail.ReadWrite",
    "Mail.Send",
    "Calendars.Read",
    "Calendars.ReadWrite",
    "offline_access"
] as const;

export const MICROSOFT_TEAMS_SCOPES = [
    "Team.ReadBasic.All",
    "Channel.ReadBasic.All",
    "ChannelMessage.Send",
    "Chat.ReadWrite"
] as const;
```

| Scope Category | Scopes                                                                                 | Purpose                      |
| -------------- | -------------------------------------------------------------------------------------- | ---------------------------- |
| User           | `User.Read`                                                                            | User profile                 |
| Mail           | `Mail.Read`, `Mail.ReadWrite`, `Mail.Send`                                             | Outlook Mail                 |
| Calendar       | `Calendars.Read`, `Calendars.ReadWrite`                                                | Calendar CRUD                |
| Teams          | `Team.ReadBasic.All`, `Channel.ReadBasic.All`, `ChannelMessage.Send`, `Chat.ReadWrite` | Teams integration (optional) |
| Auth           | `offline_access`                                                                       | Refresh token support        |

> **Note:** Teams scopes are optional — agents work without Teams.

### Provider Configuration

Both providers use:

- `accessType: "offline"` / `offline_access` scope — for refresh tokens
- `prompt: "consent"` — always show consent screen to ensure all scopes are granted
- `disableImplicitSignUp: true` — prevents automatic account creation for unknown emails

---

## Environment Variable Validation

The `packages/auth/src/env.ts` module validates required auth configuration at runtime:

```typescript
export function validateAuthEnv() {
    const required = {
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
        DATABASE_URL: process.env.DATABASE_URL
    } as const;

    const missing: string[] = [];
    for (const [key, value] of Object.entries(required)) {
        if (!value || value.trim() === "") {
            missing.push(key);
        }
    }

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables for authentication:\n` +
                `${missing.map((key) => `  - ${key}`).join("\n")}\n\n` +
                `Please check your .env file.`
        );
    }
}

export function getAppUrl(fallback = "http://localhost:3000"): string {
    const url = process.env.NEXT_PUBLIC_APP_URL?.trim() || fallback;
    try {
        new URL(url);
        return url;
    } catch {
        console.warn(`Invalid app URL: "${url}", using fallback: "${fallback}"`);
        return fallback;
    }
}
```

### Required Environment Variables

| Variable                  | Required | Description                                                         |
| ------------------------- | -------- | ------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`      | Yes      | Encryption key for session data                                     |
| `DATABASE_URL`            | Yes      | PostgreSQL connection string                                        |
| `NEXT_PUBLIC_APP_URL`     | No       | Base URL for auth callbacks (falls back to `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID`        | No       | Google OAuth client ID (enables Google sign-in)                     |
| `GOOGLE_CLIENT_SECRET`    | No       | Google OAuth client secret                                          |
| `MICROSOFT_CLIENT_ID`     | No       | Microsoft OAuth client ID (enables Microsoft sign-in)               |
| `MICROSOFT_CLIENT_SECRET` | No       | Microsoft OAuth client secret                                       |
| `MICROSOFT_TENANT_ID`     | No       | Azure AD tenant ID (defaults to `common` for multi-tenant)          |

---

## Package Exports

The `@repo/auth` package exports everything needed for both server-side and client-side auth:

```typescript
// Server-side auth
export { auth, onPostBootstrap } from "./auth";
export type { Session, User } from "./auth";

// Client-side auth
export { authClient, signIn, signUp, signOut, linkSocial, useSession } from "./auth-client";

// Bootstrap utility
export {
    bootstrapUserOrganization,
    createNewOrganizationForUser,
    getEmailDomain
} from "./bootstrap";
export type { BootstrapResult, BootstrapOptions } from "./bootstrap";

// Environment utilities
export { validateAuthEnv, getAppUrl } from "./env";
```
