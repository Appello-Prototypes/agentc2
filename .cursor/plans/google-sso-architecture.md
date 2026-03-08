# Google SSO - Technical Architecture Diagrams

**Related:** [google-sso-design.md](./google-sso-design.md)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AgentC2 Platform                                │
│                  Production: https://agentc2.ai                         │
│               Development: https://catalyst.localhost                   │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │  HTTPS Traffic
                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         Caddy Reverse Proxy                             │
│                          (Port 443 HTTPS)                               │
│                                                                         │
│  Routing Rules:                                                         │
│  • /docs, /blog, /terms, /privacy → Port 3000 (Frontend)               │
│  • /admin* → Port 3003 (Admin)                                          │
│  • Everything else → Port 3001 (Agent) [including /api/auth/*]         │
└─────────────┬────────────────────────┬──────────────────┬──────────────┘
              │                        │                  │
    ┌─────────┴────────┐    ┌─────────┴────────┐    ┌────┴──────┐
    │                  │    │                  │    │           │
    ↓                  ↓    ↓                  ↓    ↓           ↓
┌─────────┐      ┌─────────┐  ┌─────────┐    ┌──────────┐   ┌────────┐
│Frontend │      │Frontend │  │ Agent   │    │  Agent   │   │ Admin  │
│ App     │      │ Static  │  │  App    │    │ /api/*   │   │  App   │
│         │      │ Assets  │  │         │    │ routes   │   │        │
│Port 3000│      │ /_home/*│  │Port 3001│    │ OAuth ✅  │   │Port3003│
└────┬────┘      └─────────┘  └────┬────┘    └────┬─────┘   └────────┘
     │                             │              │
     │                             │              │
     └──────────────┬──────────────┴──────────────┘
                    │
                    │ All apps share:
                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                     Shared Infrastructure                               │
│                                                                         │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐   │
│  │ @repo/auth       │   │ PostgreSQL DB    │   │ Session Cookie   │   │
│  │                  │   │  (Supabase)      │   │                  │   │
│  │ • Better Auth    │───│ • User           │   │ Name:            │   │
│  │ • Google OAuth   │   │ • Account        │   │ better-auth      │   │
│  │ • Session mgmt   │   │ • Session        │   │ .session.token   │   │
│  │ • Org bootstrap  │   │ • Organization   │   │                  │   │
│  └──────────────────┘   │ • Membership     │   │ Domain:          │   │
│                         │ • Integration... │   │ catalyst         │   │
│                         └──────────────────┘   │ .localhost       │   │
│                                                └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. OAuth Authentication Flow (Detailed)

### Phase A: User Initiates OAuth

```
┌──────────┐
│   User   │
│ Browser  │
└─────┬────┘
      │
      │ 1. Navigate to https://catalyst.localhost/signup
      │
      ↓
┌─────────────────────────────────────────┐
│   Frontend App (Port 3000)              │
│   /signup page                          │
│                                         │
│   ┌───────────────────────────────┐     │
│   │ Sign-Up Form Component        │     │
│   │                               │     │
│   │  [Continue with Google] ←─────┼─────┼─── User clicks
│   │                               │     │
│   └───────────────┬───────────────┘     │
│                   │                     │
│                   │ 2. signIn.social({ provider: "google" })
│                   │
└───────────────────┼─────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────┐
│   Better Auth Client                    │
│   (@repo/auth/client)                   │
│                                         │
│   • Builds OAuth authorization URL      │
│   • Includes state parameter (CSRF)     │
│   • Includes scope parameter            │
│   • Redirects browser to Google         │
└───────────────────┬─────────────────────┘
                    │
                    │ 3. Redirect to Google
                    │
                    ↓
┌─────────────────────────────────────────┐
│   Google OAuth Server                   │
│   accounts.google.com                   │
│                                         │
│   ┌───────────────────────────────┐     │
│   │  OAuth Consent Screen         │     │
│   │                               │     │
│   │  AgentC2 wants to access:     │     │
│   │  ☑ Your Gmail                 │     │
│   │  ☑ Your Google Calendar       │     │
│   │  ☑ Your Google Drive          │     │
│   │                               │     │
│   │  [Cancel]  [Continue]         │     │
│   └───────────────┬───────────────┘     │
│                   │                     │
└───────────────────┼─────────────────────┘
                    │
                    │ 4. User approves
                    │
                    ↓
```

### Phase B: OAuth Callback Processing

```
┌─────────────────────────────────────────┐
│   Google OAuth Server                   │
│                                         │
│   • Generates authorization code        │
│   • Redirects to callback URL           │
└───────────────────┬─────────────────────┘
                    │
                    │ 5. Redirect to:
                    │ https://catalyst.localhost/api/auth/callback/google
                    │ ?code=4/0AY0e-g7x...&state=abc123...
                    ↓
┌─────────────────────────────────────────┐
│   Caddy Reverse Proxy                   │
│                                         │
│   • Receives: /api/auth/callback/google │
│   • No specific rule for /api/auth/*    │
│   • Falls through to default handler    │
│   • Routes to Agent App (Port 3001)     │
└───────────────────┬─────────────────────┘
                    │
                    │ 6. Proxy to localhost:3001
                    ↓
┌─────────────────────────────────────────┐
│   Agent App - Better Auth Handler       │
│   (Port 3001)                           │
│   POST /api/auth/callback/google        │
│                                         │
│   Better Auth Server Processing:        │
│   ┌───────────────────────────────┐     │
│   │ 7. Validate state parameter   │     │
│   │    (CSRF protection)           │     │
│   └───────────────┬───────────────┘     │
│                   ↓                     │
│   ┌───────────────────────────────┐     │
│   │ 8. Exchange code for tokens   │─────┼──→ Google Token Endpoint
│   │    POST https://oauth2.googleapis.com/token
│   │    {                          │     │
│   │      code: "4/0AY0e...",      │     │
│   │      client_id: "...",        │     │
│   │      client_secret: "...",    │     │
│   │      redirect_uri: "...",     │     │
│   │      grant_type: "..."        │     │
│   │    }                          │     │
│   └───────────────┬───────────────┘     │
│                   │                     │
│                   ↓                     │
│   ┌───────────────────────────────┐     │
│   │ 9. Receive tokens:            │←────┼─── Google responds
│   │    {                          │     │
│   │      access_token: "ya29...", │     │
│   │      refresh_token: "1//0g..",│     │
│   │      id_token: "eyJhbG...",   │     │
│   │      expires_in: 3600,        │     │
│   │      scope: "gmail calendar.."│     │
│   │    }                          │     │
│   └───────────────┬───────────────┘     │
└───────────────────┼─────────────────────┘
                    │
                    ↓
```

### Phase C: Database Operations

```
┌─────────────────────────────────────────┐
│   Better Auth + Prisma                  │
│                                         │
│   10. Parse id_token (JWT):             │
│       - Google user ID (sub)            │
│       - Email                           │
│       - Name                            │
│       - Profile picture URL             │
│                                         │
│   11. Check if User exists:             │
│       SELECT * FROM "User"              │
│       WHERE email = 'user@gmail.com'    │
└───────────────────┬─────────────────────┘
                    │
          ┌─────────┴─────────┐
          │                   │
    User exists?       User does NOT exist
          │                   │
          ↓                   ↓
┌─────────────────┐   ┌─────────────────┐
│ Existing User   │   │ New User        │
│ (Sign-In)       │   │ (Sign-Up)       │
└─────┬───────────┘   └─────┬───────────┘
      │                     │
      ↓                     ↓
┌─────────────────────────────────────────┐
│ Database Transaction:                   │
│                                         │
│ IF NEW USER (Sign-Up):                  │
│   12a. INSERT INTO "User"               │
│        (name, email, emailVerified=true,│
│         image=google_picture_url)       │
│   12b. INSERT INTO "Account"            │
│        (accountId=google_user_id,       │
│         providerId="google",            │
│         accessToken, refreshToken,      │
│         scope, userId)                  │
│                                         │
│ IF EXISTING USER (Sign-In):             │
│   12c. UPDATE "Account"                 │
│        SET accessToken=...,             │
│            refreshToken=...,            │
│            accessTokenExpiresAt=...     │
│        WHERE userId=... AND             │
│              providerId="google"        │
│   12d. UPDATE "User"                    │
│        SET image=google_picture_url     │
│        WHERE id=...                     │
│                                         │
│ FOR BOTH:                               │
│   12e. INSERT INTO "Session"            │
│        (userId, token=uuid(),           │
│         expiresAt=now()+30min)          │
└───────────────────┬─────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────┐
│   Set Session Cookie                    │
│                                         │
│   Set-Cookie:                           │
│     better-auth.session.token=abc123... │
│     Domain=catalyst.localhost           │
│     Path=/                              │
│     HttpOnly; Secure; SameSite=Lax      │
│     Max-Age=1800 (30 minutes)           │
└───────────────────┬─────────────────────┘
                    │
                    ↓
```

### Phase D: Post-Authentication Hooks

```
┌─────────────────────────────────────────┐
│   Better Auth after Hook                │
│   (packages/auth/src/auth.ts)           │
│                                         │
│   if (ctx.path === "/callback/:id") {   │
│       const newSession = ctx.newSession │
│                                         │
│       13. Check if user has org:        │
│           SELECT * FROM "Membership"    │
│           WHERE userId = newSession.user.id
└───────────────────┬─────────────────────┘
                    │
          ┌─────────┴─────────┐
          │                   │
    Has membership?     No membership
          │                   │
          ↓                   ↓
┌─────────────────┐   ┌─────────────────────────────────────┐
│ Existing Member │   │ New User - Bootstrap Organization   │
│                 │   │                                     │
│ Skip bootstrap  │   │ 14. bootstrapUserOrganization():    │
│                 │   │     • Check invite code             │
│                 │   │     • Check domain matching         │
│                 │   │     • Create Organization (or defer)│
│                 │   │     • Create Workspace              │
│                 │   │     • Create Membership (role: owner)│
└─────┬───────────┘   └─────┬───────────────────────────────┘
      │                     │
      │                     ↓
      │             ┌─────────────────────────────────────┐
      │             │ 15. Run Post-Bootstrap Hooks:       │
      │             │                                     │
      │             │  for (const cb of callbacks) {      │
      │             │      await cb(userId, orgId)        │
      │             │  }                                  │
      │             │                                     │
      │             │  Callbacks:                         │
      │             │  • Gmail auto-sync                  │
      │             │  • Analytics tracking               │
      │             │  • Onboarding init                  │
      │             └─────┬───────────────────────────────┘
      │                   │
      └───────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────┐
│   16. Redirect to callbackURL           │
│                                         │
│   Sign-In: /dashboard or /workspace     │
│   Sign-Up: /onboarding                  │
└───────────────────┬─────────────────────┘
                    │
                    │ 17. HTTP 302 Redirect
                    ↓
┌─────────────────────────────────────────┐
│   User Browser                          │
│   • Session cookie set                  │
│   • Authenticated in both apps          │
│   • Redirected to destination           │
└─────────────────────────────────────────┘
```

---

## 2. Data Flow Diagram

### OAuth Token Storage and Usage

```
┌─────────────────────────────────────────────────────────────────┐
│                    Google OAuth Tokens                          │
│                                                                 │
│  access_token:  "ya29.a0AfH6SMBq..." (expires in 1 hour)       │
│  refresh_token: "1//0gH1vZ..." (no expiry)                      │
│  id_token:      "eyJhbGciOiJS..." (JWT with user info)          │
│  scope:         "gmail.modify calendar.events ..."              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ Better Auth stores in database
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Account Table (PostgreSQL)                     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ id: "clx1234..."                                          │  │
│  │ accountId: "google-user-id-12345" ← Google's stable ID   │  │
│  │ providerId: "google"                                      │  │
│  │ userId: "clx5678..." ← Link to User table                │  │
│  │ accessToken: "ya29.a0AfH6SMBq..."                         │  │
│  │ refreshToken: "1//0gH1vZ..."                              │  │
│  │ idToken: "eyJhbGciOiJS..."                                │  │
│  │ accessTokenExpiresAt: 2026-03-08T19:00:00Z               │  │
│  │ scope: "https://www.googleapis.com/auth/gmail.modify..." │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ Used for two purposes:
                            │
           ┌────────────────┴────────────────┐
           │                                 │
           ↓                                 ↓
┌────────────────────┐           ┌──────────────────────────┐
│ Session Creation   │           │ Gmail Integration Sync   │
│                    │           │                          │
│ INSERT Session     │           │ Copy tokens from Account │
│ SET userId=...     │           │ to IntegrationConnection │
│                    │           │                          │
│ Generate token     │           │ CREATE Integration...    │
│ (UUID-like)        │           │ SET credentials = {      │
│                    │           │   accessToken: ...,      │
│ Session cookie set │           │   refreshToken: ...,     │
│ in browser         │           │   expiresAt: ...         │
└────────────────────┘           │ } (encrypted)            │
                                 └──────────────────────────┘
```

---

## 3. Session Sharing Architecture

### Cross-App Authentication

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      User Signs In via Google                           │
│                   (From Frontend App - Port 3000)                       │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ↓
                    ┌──────────────────────────┐
                    │   Better Auth creates:   │
                    │   • User record          │
                    │   • Account record       │
                    │   • Session record       │
                    └──────────┬───────────────┘
                               │
                               ↓
                    ┌──────────────────────────┐
                    │   Set Session Cookie:    │
                    │                          │
                    │   Name:                  │
                    │   better-auth            │
                    │   .session.token         │
                    │                          │
                    │   Value:                 │
                    │   abc123-uuid-token      │
                    │                          │
                    │   Domain:                │
                    │   catalyst.localhost ✨  │
                    │   (NOT localhost:3000)   │
                    │                          │
                    │   Properties:            │
                    │   • HttpOnly: true       │
                    │   • Secure: true         │
                    │   • SameSite: Lax        │
                    │   • Path: /              │
                    └──────────┬───────────────┘
                               │
          ┌────────────────────┴────────────────────┐
          │    Cookie accessible by both apps       │
          │    because they share the same domain   │
          └────────────────────┬────────────────────┘
                               │
          ┌────────────────────┴────────────────────┐
          │                                         │
          ↓                                         ↓
┌─────────────────────┐                 ┌─────────────────────┐
│   Frontend App      │                 │   Agent App         │
│   (Port 3000)       │                 │   (Port 3001)       │
│                     │                 │                     │
│   1. Browser sends: │                 │   1. Browser sends: │
│      Cookie:        │                 │      Cookie:        │
│      better-auth... │                 │      better-auth... │
│                     │                 │                     │
│   2. Better Auth    │                 │   2. Better Auth    │
│      reads cookie   │                 │      reads cookie   │
│                     │                 │                     │
│   3. Query Session: │                 │   3. Query Session: │
│      SELECT *       │                 │      SELECT *       │
│      FROM Session   │                 │      FROM Session   │
│      WHERE token=...│                 │      WHERE token=...│
│                     │                 │                     │
│   4. Load User:     │                 │   4. Load User:     │
│      Include User   │                 │      Include User   │
│                     │                 │                     │
│   5. Return session │                 │   5. Return session │
│      ✅ Authenticated│                 │      ✅ Authenticated│
└─────────────────────┘                 └─────────────────────┘

Result: User authenticated in BOTH apps with single sign-in
```

---

## 4. Organization Bootstrap Flow

```
New Google OAuth User
        │
        ↓
┌─────────────────────────────────────────┐
│  bootstrapUserOrganization()            │
│  (packages/auth/src/bootstrap.ts)       │
└──────────┬──────────────────────────────┘
           │
           ↓
    ┌──────────────────┐
    │ Check existing   │
    │ membership?      │
    └──────┬───────────┘
           │
    ┌──────┴───────┐
    │              │
 Found?         Not found
    │              │
    ↓              ↓
[Return org]  ┌───────────────────┐
              │ Check invite code?│
              └───────┬───────────┘
                      │
           ┌──────────┴──────────┐
           │                     │
    Platform invite        Org invite
           │                     │
           ↓                     ↓
    ┌─────────────┐      ┌─────────────┐
    │ Grant access│      │ Join org    │
    │ to create   │      │ as member   │
    │ own org     │      │             │
    │             │      │ CREATE      │
    │ Defer to    │      │ Membership  │
    │ onboarding  │      │             │
    └─────────────┘      └─────────────┘
           │                     │
           └──────────┬──────────┘
                      │
           No invite code
                      │
                      ↓
           ┌──────────────────┐
           │ Check domain     │
           │ matching?        │
           └────────┬─────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    Domain match        No match
         │                     │
         ↓                     ↓
  ┌─────────────┐      ┌─────────────┐
  │ Suggest org │      │ Create new  │
  │             │      │ org for user│
  │ User decides│      │             │
  │ in onboarding│     │ • Org name  │
  │             │      │ • Workspace │
  └─────────────┘      │ • Membership│
                       │   (owner)   │
                       └─────────────┘
                               │
                               ↓
                    ┌──────────────────┐
                    │ Post-Bootstrap   │
                    │ Hooks Execute:   │
                    │                  │
                    │ • Gmail sync     │
                    │ • Analytics      │
                    └──────────────────┘
```

---

## 5. Component Architecture

### Frontend App Component Hierarchy

```
apps/frontend/
│
├── src/app/
│   ├── layout.tsx
│   │   └── <SessionProvider> ✅ Wraps entire app
│   │
│   ├── page.tsx (Homepage)
│   │   └── <LandingPage>
│   │       └── <HeroSection>
│   │           └── <SignInForm> ← ADD GOOGLE BUTTON HERE
│   │
│   └── (Public)/
│       └── signup/
│           └── page.tsx
│               └── <SignUpForm> ← ADD GOOGLE BUTTON HERE
│
└── src/components/
    └── auth/
        ├── sign-in-form.tsx ← MODIFY
        │   ├── function GoogleLogo()  ← ADD
        │   ├── function MicrosoftLogo()  ← ADD (optional)
        │   ├── handleSocialSignIn()  ← ADD
        │   └── return (
        │       <div>
        │         <Button>Google</Button>  ← ADD
        │         <Divider />  ← ADD
        │         <form>Email/Password</form>  ← KEEP
        │       </div>
        │   )
        │
        └── sign-up-form.tsx ← MODIFY
            ├── function GoogleLogo()  ← ADD
            ├── function MicrosoftLogo()  ← ADD (optional)
            ├── handleSocialSignUp()  ← ADD
            └── return (
                <div>
                  <Button>Google</Button>  ← ADD
                  <Divider />  ← ADD
                  <form>Email/Password</form>  ← KEEP
                </div>
            )
```

### Shared Infrastructure

```
packages/
│
├── auth/ (@repo/auth)
│   ├── src/
│   │   ├── auth.ts ✅ NO CHANGE
│   │   │   └── Google OAuth already configured
│   │   │
│   │   ├── auth-client.ts ✅ NO CHANGE
│   │   │   └── signIn.social() method
│   │   │
│   │   ├── google-scopes.ts ✅ NO CHANGE (Phase 2: add SSO scopes)
│   │   │   └── GOOGLE_OAUTH_SCOPES constant
│   │   │
│   │   └── bootstrap.ts ✅ NO CHANGE
│   │       └── Organization creation logic
│   │
│   └── Used by BOTH Frontend and Agent apps
│
└── database/ (@repo/database)
    └── prisma/
        └── schema.prisma ✅ NO CHANGE
            ├── model User
            ├── model Account ← OAuth tokens
            ├── model Session
            ├── model Organization
            └── model Membership
```

---

## 6. OAuth Callback Routing Architecture

```
User clicks "Continue with Google" in Frontend App
        │
        ↓
Better Auth redirects to: accounts.google.com
        │
        ↓
User approves on Google
        │
        ↓
Google redirects to: https://catalyst.localhost/api/auth/callback/google?code=...
        │
        ↓
┌───────────────────────────────────────────────────────────────┐
│                  Caddy Reverse Proxy                          │
│                                                               │
│  Incoming: /api/auth/callback/google                          │
│                                                               │
│  Routing Logic:                                               │
│  • Check @public_content matcher → No match                   │
│  • Check @public_legal matcher → No match                     │
│  • Check @frontend_assets matcher → No match                  │
│  • Check @admin_routes matcher → No match                     │
│  • Fall through to default handler                            │
│                                                               │
│  Default handler: reverse_proxy localhost:3001                │
│                                                               │
│  Decision: Route to Agent App ✅                              │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ↓
┌───────────────────────────────────────────────────────────────┐
│           Agent App (Port 3001)                               │
│           POST /api/auth/callback/google                      │
│                                                               │
│  Better Auth processes callback:                              │
│  • Validate state (CSRF)                                      │
│  • Exchange code for tokens                                   │
│  • Create/update User + Account + Session                     │
│  • Set session cookie (domain: catalyst.localhost)            │
│  • Trigger bootstrap hook                                     │
│  • Redirect to callbackURL                                    │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            │ Redirect can go to either app:
                            │
          ┌─────────────────┴─────────────────┐
          │                                   │
          ↓                                   ↓
┌──────────────────┐              ┌──────────────────┐
│ Frontend App     │              │ Agent App        │
│ /dashboard       │              │ /onboarding      │
│                  │              │                  │
│ Session valid ✅  │              │ Session valid ✅  │
└──────────────────┘              └──────────────────┘
```

**Key Insight:** Even though OAuth is initiated from Frontend app (port 3000), the callback is processed by Agent app (port 3001). This is **correct** because:
1. Session cookie domain is `catalyst.localhost` (not `localhost:3000`)
2. Both apps use the same `@repo/auth` package
3. Both apps connect to the same database
4. After callback processing, Better Auth can redirect to any URL (Frontend or Agent)

---

## 7. Database Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────┐
│                       User Entity Graph                             │
└─────────────────────────────────────────────────────────────────────┘

                            ┌───────────┐
                            │   User    │
                            │           │
                            │ • id      │
                            │ • name    │
                            │ • email   │
                            │ • image   │
                            └─────┬─────┘
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
                ↓                 ↓                 ↓
        ┌─────────────┐   ┌─────────────┐   ┌──────────────┐
        │  Account    │   │  Session    │   │  Membership  │
        │  (OAuth)    │   │             │   │              │
        │             │   │ • token     │   │ • role       │
        │ • providerId│   │ • expiresAt │   │ • orgId      │
        │   ="google" │   │ • userId    │   │ • userId     │
        │ • accountId │   └─────────────┘   └──────┬───────┘
        │ • tokens    │                            │
        └─────────────┘                            ↓
                                           ┌──────────────┐
                                           │Organization  │
                                           │              │
                                           │ • id         │
                                           │ • name       │
                                           │ • slug       │
                                           └──────┬───────┘
                                                  │
                                                  ↓
                                           ┌──────────────┐
                                           │  Workspace   │
                                           │              │
                                           │ • id         │
                                           │ • name       │
                                           │ • isDefault  │
                                           └──────────────┘
```

### OAuth Flow Impact on Database

```
New Google Sign-Up Transaction:
┌─────────────────────────────────────┐
│ BEGIN TRANSACTION                   │
│                                     │
│ 1. INSERT User                      │
│    (name, email, emailVerified=true)│
│                                     │
│ 2. INSERT Account                   │
│    (providerId="google", tokens...) │
│                                     │
│ 3. INSERT Session                   │
│    (userId, token, expiresAt)       │
│                                     │
│ 4. INSERT Organization              │
│    (name, slug)                     │
│                                     │
│ 5. INSERT Workspace                 │
│    (orgId, name="Production")       │
│                                     │
│ 6. INSERT Membership                │
│    (userId, orgId, role="owner")    │
│                                     │
│ COMMIT TRANSACTION                  │
└─────────────────────────────────────┘

Existing Google Sign-In Transaction:
┌─────────────────────────────────────┐
│ BEGIN TRANSACTION                   │
│                                     │
│ 1. UPDATE Account                   │
│    SET accessToken=...,             │
│        refreshToken=...,            │
│        accessTokenExpiresAt=...     │
│    WHERE userId=... AND             │
│          providerId="google"        │
│                                     │
│ 2. INSERT Session                   │
│    (userId, token, expiresAt)       │
│                                     │
│ COMMIT TRANSACTION                  │
└─────────────────────────────────────┘
```

---

## 8. Error Handling Flow

### No Account Error (disableImplicitSignUp: true)

```
User with NO existing account clicks "Sign in with Google"
        │
        ↓
Google OAuth flow completes successfully
        │
        ↓
Better Auth callback handler:
        │
        ↓
Check: SELECT * FROM "User" WHERE email = 'user@gmail.com'
        │
        ↓
Result: Not found
        │
        ↓
Better Auth detects: disableImplicitSignUp = true
        │
        ↓
Better Auth rejects implicit account creation
        │
        ↓
Redirect to: errorCallbackURL + "?error=no_account"
        │
        ↓
https://catalyst.localhost/?error=no_account
        │
        ↓
Frontend Sign-In Form:
        │
        ↓
const errorParam = searchParams.get("error")
if (errorParam === "no_account") {
    setError("No account found. Please sign up first.")
}
        │
        ↓
┌─────────────────────────────────────────┐
│  UI Shows:                              │
│                                         │
│  ⚠️ No account found.                    │
│     Please sign up first.               │
│                                         │
│  [Sign up] ← Link to /signup            │
└─────────────────────────────────────────┘
```

---

## 9. Integration Auto-Sync Architecture

### Gmail Integration Auto-Creation

```
User signs up with Google OAuth
(Grants gmail.modify + calendar.events scopes)
        │
        ↓
Better Auth creates:
• User record
• Account record (with OAuth tokens)
• Session record
        │
        ↓
Redirect to /onboarding
        │
        ↓
┌─────────────────────────────────────────┐
│  Onboarding Page                        │
│  apps/agent/src/app/onboarding/page.tsx │
│                                         │
│  useEffect(() => {                      │
│      // Call Gmail sync API             │
│      fetch("/api/onboarding/ensure-gmail-sync", {
│          method: "POST"                 │
│      })                                 │
│  }, [])                                 │
└───────────────────┬─────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────┐
│  /api/onboarding/ensure-gmail-sync      │
│                                         │
│  1. Get user session                    │
│  2. Find Google Account record:         │
│     SELECT * FROM "Account"             │
│     WHERE userId=... AND                │
│           providerId="google"           │
│  3. Extract tokens from Account         │
│  4. Check if Gmail connection exists    │
│  5. If not, create:                     │
│     INSERT INTO "IntegrationConnection" │
│     (providerId="gmail",                │
│      credentials={                      │
│        accessToken: account.accessToken,│
│        refreshToken: account.refreshToken,
│        expiresAt: account.accessTokenExpiresAt
│      },                                 │
│      metadata={ email: user.email },    │
│      organizationId=...,                │
│      userId=...)                        │
│  6. Repeat for Calendar and Drive       │
│     (sibling sync)                      │
└───────────────────┬─────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────┐
│  Result:                                │
│                                         │
│  ✅ Gmail connection created             │
│  ✅ Calendar connection created          │
│  ✅ Drive connection created             │
│                                         │
│  User can immediately use Gmail tools   │
│  in agents without re-authenticating    │
└─────────────────────────────────────────┘
```

---

## 10. Security Architecture

### OAuth Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                      Security Layers                            │
└─────────────────────────────────────────────────────────────────┘

Layer 1: Transport Security
┌─────────────────────────────────────────┐
│ • TLS 1.3 encryption (Caddy)            │
│ • HTTPS only (HTTP redirects to HTTPS)  │
│ • HSTS header (force HTTPS)             │
└───────────────────┬─────────────────────┘
                    │
                    ↓
Layer 2: OAuth Protocol Security
┌─────────────────────────────────────────┐
│ • State parameter (CSRF protection)     │
│ • HMAC-signed state (Better Auth)       │
│ • Nonce for replay prevention           │
│ • PKCE support (optional)               │
│ • Authorization code flow (not implicit)│
└───────────────────┬─────────────────────┘
                    │
                    ↓
Layer 3: Token Security
┌─────────────────────────────────────────┐
│ • Tokens stored in database (not cookie)│
│ • Access token: 1-hour expiry           │
│ • Refresh token: No expiry, revocable   │
│ • Tokens not exposed to client-side JS │
└───────────────────┬─────────────────────┘
                    │
                    ↓
Layer 4: Session Security
┌─────────────────────────────────────────┐
│ • HTTP-only cookies (no JS access)      │
│ • Secure flag (HTTPS only)              │
│ • SameSite=Lax (CSRF protection)        │
│ • 30-minute idle timeout                │
│ • Session token rotation                │
└───────────────────┬─────────────────────┘
                    │
                    ↓
Layer 5: Database Security
┌─────────────────────────────────────────┐
│ • PostgreSQL with SSL                   │
│ • Row-level security (Supabase)         │
│ • Organization-scoped queries           │
│ • Encrypted credentials (AES-256-GCM)   │
└─────────────────────────────────────────┘
```

---

## 11. Multi-Tenant Isolation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Tenant Hierarchy                       │
└─────────────────────────────────────────────────────────────────┘

User 1 (user1@acme.com)
    │
    └─── Membership (role: owner)
             │
             ↓
         Organization A (slug: acme)
             │
             ├─── Workspace A1 (Production)
             │       │
             │       ├─── Agent A1-1
             │       ├─── Agent A1-2
             │       └─── IntegrationConnection (Gmail - User 1)
             │
             └─── Workspace A2 (Staging)

User 2 (user2@acme.com)
    │
    ├─── Membership (role: member) → Organization A
    │
    └─── Membership (role: owner)
             │
             ↓
         Organization B (slug: acme-consulting)
             │
             └─── Workspace B1 (Production)
                     │
                     ├─── Agent B1-1
                     └─── IntegrationConnection (Gmail - User 2)

Google OAuth Impact:
• User 1 signs up with user1@acme.com
• Bootstrap checks domain: @acme.com
• Finds Organization A (User 2's email shares domain)
• Suggests Organization A to User 1
• User 1 can join (become member) OR create own org
```

---

## 12. Deployment Architecture

### Development Environment

```
┌─────────────────────────────────────────────────────────────────┐
│                    Developer's Machine                          │
└─────────────────────────────────────────────────────────────────┘

┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│ Terminal 1     │   │ Terminal 2     │   │ Browser        │
│                │   │                │   │                │
│ bun run dev    │   │ (Caddy auto-   │   │ https://       │
│                │   │  starts)       │   │ catalyst       │
│ • Frontend:3000│   │                │   │ .localhost     │
│ • Agent:3001   │   │ Caddy:443      │   │                │
│ • Inngest:8288 │   │ Admin API:2019 │   │ DevTools:      │
│ • DB:5432      │   │                │   │ • Console      │
│                │   │                │   │ • Network      │
│                │   │                │   │ • Cookies      │
└────────────────┘   └────────────────┘   └────────────────┘
         │                   │                     │
         └───────────────────┴─────────────────────┘
                             │
                             ↓
                 ┌────────────────────────┐
                 │   Local PostgreSQL     │
                 │   (Docker or Supabase) │
                 └────────────────────────┘
```

### Production Environment (Digital Ocean)

```
┌─────────────────────────────────────────────────────────────────┐
│                  Digital Ocean Droplet                          │
│                  agentc2.ai (Public IP)                         │
└─────────────────────────────────────────────────────────────────┘

┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│ Caddy (443)    │   │ PM2 Process    │   │ Supabase       │
│                │   │ Manager        │   │ PostgreSQL     │
│ • TLS via      │   │                │   │                │
│   Let's Encrypt│   │ • Frontend:3000│   │ • User         │
│ • Access logs  │   │ • Agent:3001   │   │ • Account      │
│ • Routes to    │   │ • Inngest:8288 │   │ • Session      │
│   PM2 apps     │   │                │   │ • Org data     │
└────────────────┘   └────────────────┘   └────────────────┘
         │                   │                     │
         └───────────────────┴─────────────────────┘
                             │
                             ↓
                 ┌────────────────────────┐
                 │   Google OAuth Server  │
                 │   (External)           │
                 └────────────────────────┘
```

---

## 13. Token Lifecycle

### Access Token Lifecycle

```
Google OAuth Callback
        │
        ↓
Access token received: "ya29.a0AfH6SMBq..."
Expiry: 1 hour from now
        │
        ↓
Store in Account table:
• accessToken = "ya29..."
• accessTokenExpiresAt = now() + 3600s
        │
        │ Time passes...
        │ Token used for Gmail API calls
        │
        ↓ (58 minutes later)
Better Auth checks: Is token expired?
• now() > (expiresAt - 5 minutes buffer)?
• Yes → Token about to expire
        │
        ↓
Better Auth auto-refresh:
• POST https://oauth2.googleapis.com/token
  {
    grant_type: "refresh_token",
    refresh_token: "1//0gH1vZ...",
    client_id: "...",
    client_secret: "..."
  }
        │
        ↓
New access token received: "ya29.a0AfH6SMBnew..."
Expiry: 1 hour from now
        │
        ↓
UPDATE Account
SET accessToken = "ya29...new",
    accessTokenExpiresAt = now() + 3600s
        │
        ↓
Gmail API calls continue working ✅
```

### Refresh Token Lifecycle

```
Refresh token: "1//0gH1vZ..."
Expiry: Never (Google refresh tokens don't expire)
        │
        ↓
Stored in Account table:
• refreshToken = "1//0gH1vZ..."
• refreshTokenExpiresAt = null
        │
        │ Token persists indefinitely...
        │ Used to refresh access tokens...
        │
        ↓
Token can be revoked by:
1. User revokes via Google Account settings
2. User changes Google password
3. Developer revokes via Google Cloud Console
        │
        ↓
Next refresh attempt fails:
• Error: "invalid_grant"
        │
        ↓
Mark Account as stale:
UPDATE Account
SET isActive = false,
    errorMessage = "Re-authentication required"
        │
        ↓
User sees "Reconnect Google" prompt in UI
```

---

## 14. Frontend Component State Diagram

### Sign-In Form State Machine

```
┌─────────────┐
│   Initial   │
│   State     │
│             │
│ loading=false
│ socialLoading=false
│ error=""    │
└──────┬──────┘
       │
       │ User clicks "Continue with Google"
       ↓
┌─────────────┐
│   Social    │
│   Loading   │
│             │
│ socialLoading=true
│ error=""    │
│ Button: "Connecting..."
└──────┬──────┘
       │
       │ signIn.social() initiates
       │ Browser redirects to Google
       │ (Component unmounts - redirect)
       │
       ↓
┌─────────────┐
│   OAuth     │
│   Flow      │
│  (Google)   │
│             │
│ User on Google's consent screen
│ Component not mounted
└──────┬──────┘
       │
       │ User approves
       │ Google redirects to callback
       │ Better Auth processes
       │ Better Auth redirects to callbackURL
       │
       ↓
┌─────────────┐
│   Success   │
│   Redirect  │
│             │
│ Navigate to /dashboard or /onboarding
│ Component unmounts
│ User authenticated ✅
└─────────────┘

OR (if error)
       │
       │ OAuth fails or user clicks "Cancel"
       │ Google redirects to errorCallbackURL
       │
       ↓
┌─────────────┐
│   Error     │
│   State     │
│             │
│ error="No account found..."
│ socialLoading=false
│ Show error message
└──────┬──────┘
       │
       │ User can retry or use email/password
       ↓
┌─────────────┐
│   Initial   │
│   State     │
└─────────────┘
```

---

## 15. Scope Request Comparison

### Current Implementation (Phase 1)

```
User clicks "Continue with Google"
        │
        ↓
Better Auth requests scopes:
┌───────────────────────────────────────────┐
│ Google OAuth Consent Screen               │
│                                           │
│ AgentC2 wants to access:                  │
│                                           │
│ ☑ Read, compose, send, and delete Gmail  │
│ ☑ See, edit, share, and delete Calendar  │
│ ☑ View and manage Google Drive files     │
│                                           │
│ This will allow AgentC2 to:              │
│ • Read and send emails on your behalf    │
│ • Manage your calendar events            │
│ • Access your Drive files                │
│                                           │
│ [Cancel]  [Continue]                      │
└───────────────────────────────────────────┘
        │
        ↓
User sees extensive permission request
⚠️ May reduce conversion rate
```

### Phase 2 Implementation (Scope Optimization)

```
User clicks "Continue with Google"
        │
        ↓
Better Auth requests MINIMAL scopes:
┌───────────────────────────────────────────┐
│ Google OAuth Consent Screen               │
│                                           │
│ AgentC2 wants to:                         │
│                                           │
│ ☑ View your email address                │
│ ☑ View your basic profile info           │
│                                           │
│ This will allow AgentC2 to:              │
│ • Sign you in using your Google account  │
│                                           │
│ [Cancel]  [Continue]                      │
└───────────────────────────────────────────┘
        │
        ↓
User sees minimal permission request
✅ Higher conversion rate
        │
        ↓
User completes sign-up → /onboarding
        │
        ↓
┌───────────────────────────────────────────┐
│ Onboarding Page                           │
│                                           │
│ Connect your tools to unlock AI agents:   │
│                                           │
│ ┌─────────────────────────────────────┐   │
│ │ 📧 Gmail                            │   │
│ │ Let agents read and send emails     │   │
│ │ [Connect Gmail] ←──────────────────┼───┼── User clicks
│ └─────────────────────────────────────┘   │
└───────────────────────────────────────────┘
        │
        ↓
linkSocial({ provider: "google", scopes: [gmail.modify, ...] })
        │
        ↓
Google consent screen (integration-specific scopes)
        │
        ↓
User approves → Tokens saved → Gmail integration created ✅
```

**Benefit:** Two-step consent improves conversion and clarifies intent.

---

## 16. Comparison Matrix: Current vs Phase 1

### Authentication Methods by App

```
┌──────────────┬────────────────────┬────────────────────┐
│              │   CURRENT STATE    │   PHASE 1 STATE    │
├──────────────┼────────────────────┼────────────────────┤
│              │  Frontend │ Agent  │  Frontend │ Agent  │
├──────────────┼───────────┼────────┼───────────┼────────┤
│ Email/Pass   │     ✅     │   ✅    │     ✅     │   ✅    │
│ Google OAuth │     ❌     │   ✅    │     ✅     │   ✅    │
│ Microsoft    │     ❌     │   ✅    │     ✅     │   ✅    │
│ Two-Factor   │     ✅     │   ✅    │     ✅     │   ✅    │
└──────────────┴───────────┴────────┴───────────┴────────┘

Legend:
✅ = Supported
❌ = Not supported

Result: Frontend achieves parity with Agent app
```

---

## 17. Traffic Flow Diagram

### Request Routing by Path

```
Client Request → https://catalyst.localhost{PATH}
                                │
                                ↓
                        ┌───────────────┐
                        │ Caddy Matcher │
                        └───────┬───────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ↓                       ↓                       ↓
   PATH = "/"            PATH = "/docs/*"      PATH = "/api/auth/*"
        │                       │                       │
        ↓                       ↓                       ↓
   ┌─────────┐            ┌─────────┐            ┌─────────┐
   │ Special │            │ Public  │            │ Default │
   │ Landing │            │ Content │            │ Handler │
   │ Handler │            │ Matcher │            │         │
   └────┬────┘            └────┬────┘            └────┬────┘
        │                      │                      │
        │                      │                      │
        ↓                      ↓                      ↓
   localhost:3001         localhost:3000         localhost:3001
   (Agent app)            (Frontend app)         (Agent app)
   
   Returns:               Returns:               Returns:
   • Welcome page         • Docs pages           • OAuth callback
   • Iframe embed         • Blog posts           • API responses
                          • Legal pages          • Agent APIs

Session Cookie Domain: catalyst.localhost
↳ Accessible by both Frontend (3000) and Agent (3001) apps
```

---

## 18. Files Changed Visualization

```
workspace/
│
├── apps/
│   └── frontend/
│       └── src/
│           ├── app/
│           │   └── layout.tsx ⚠️ VERIFY (SessionProvider)
│           │
│           └── components/
│               └── auth/
│                   ├── sign-in-form.tsx ✏️ MODIFY (+63 lines)
│                   └── sign-up-form.tsx ✏️ MODIFY (+77 lines)
│
└── packages/
    ├── auth/ ✅ NO CHANGES
    │   └── Already supports Google OAuth
    │
    └── database/ ✅ NO CHANGES
        └── Schema already has all needed tables

External:
└── Google Cloud Console
    └── OAuth 2.0 Client ID
        └── Authorized redirect URIs
            └── Add: http://localhost:3000/api/auth/callback/google ✏️ ADD

Total Code Changes: 2-3 files, ~140 lines added
Backend Changes: 0 files
Database Migrations: 0 migrations
```

---

## 19. Timeline Visualization

### Phase 1 Implementation Timeline (1-2 Days)

```
Day 1 Morning (3-4 hours):
├─ Read design documents ────────────────── 1h
├─ Set up development environment ───────── 0.5h
├─ Update Frontend sign-in form ─────────── 2h
└─ Update Frontend sign-up form ─────────── 2h

Day 1 Afternoon (2-3 hours):
├─ Verify SessionProvider ───────────────── 0.5h
├─ Update Google Cloud Console ──────────── 0.25h
├─ Run quality checks ───────────────────── 0.5h
└─ Manual testing (initial) ─────────────── 2h

Day 2 Morning (2-3 hours):
├─ Complete manual testing ──────────────── 1.5h
├─ Fix issues discovered ────────────────── 1h
├─ Final quality checks ─────────────────── 0.5h
└─ Git commit and push ──────────────────── 0.5h

Day 2 Afternoon (1 hour):
├─ Create pull request ──────────────────── 0.25h
├─ Update GitHub issue ──────────────────── 0.25h
└─ Notify team ──────────────────────────── 0.1h

Total: 8-11 hours across 1-2 days
```

### Multi-Phase Timeline

```
Week 1: Phase 1 (MVP)
├─ Day 1-2: Implementation ──────────────── 8-11h
├─ Day 3: Code review ───────────────────── [Team]
├─ Day 4: Revisions + staging deploy ────── 2-3h
└─ Day 5: Production deploy + monitoring ── 1h

Week 2: Monitoring & Analysis
├─ Monitor conversion metrics
├─ Gather user feedback
├─ Identify scope overreach issues
└─ Decide: Proceed with Phase 2?

Week 3-4: Phase 2 (If Needed)
├─ Implement minimal SSO scopes ─────────── 3h
├─ Add scope upgrade flow ───────────────── 4h
├─ Testing and refinement ───────────────── 2h
└─ Deploy and monitor ───────────────────── 1h

Month 2+: Phases 3-5 (Optional)
├─ Phase 3: Microsoft parity ────────────── 4-5h
├─ Phase 4: Enhanced UX ─────────────────── 6-8h
└─ Phase 5: Monitoring dashboard ────────── 12-15h
```

---

## 20. Risk Heat Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        Risk Matrix                              │
│                                                                 │
│  High │                                                         │
│  Risk │           [Scope Overreach]                             │
│       │                  │                                      │
│       │                  │                                      │
│   │   │                  │                                      │
│  Med  │                  │                                      │
│  Risk │     [Partial Consent]    [Org Bootstrap Fail]          │
│       │                                                         │
│   │   │                                                         │
│  Low  │  [Callback Error] [Cookie Issue] [Type Errors]         │
│  Risk │                                                         │
│       └──────────────────┼───────────────────────────────────→ │
│          Low             Med              High                  │
│          Probability                      Probability           │
└─────────────────────────────────────────────────────────────────┘

Legend:
• Scope Overreach: High impact, medium probability → Mitigate in Phase 2
• Partial Consent: Medium impact, medium probability → Handle in onboarding
• Org Bootstrap Fail: High impact, low probability → Thorough testing needed
• Callback Error: Medium impact, low probability → Standard error handling
• Cookie Issue: Medium impact, low probability → Caddy architecture mitigates
• Type Errors: Low impact, low probability → Quality checks catch early
```

---

## 21. Conversion Funnel Visualization

### Current Funnel (Email/Password)

```
1000 visitors to /signup
        │
        ↓
        │ 3% start signup form
        ↓
   30 users enter email/password
        │
        ↓
        │ 20% drop off (complexity, privacy)
        ↓
   24 users submit form
        │
        ↓
        │ 15% don't verify email
        ↓
   20 users verify email ✅
        │
        ↓
   Conversion rate: 2%
   Time to signup: 2-3 minutes
```

### Future Funnel (With Google OAuth)

```
1000 visitors to /signup
        │
        ↓
        │ 3.5% start signup (↑ 17% improvement)
        ↓
   35 users
        │
        ├───────────────────────────┐
        │                           │
   20 choose Google           15 choose Email
        │                           │
        ↓                           ↓
   Click Google button        Enter form
        │                           │
        ↓                           ↓
   Google consent               Submit form
   (30 seconds)                     │
        │                           ↓
        ↓                      Email verification
   18 approve                   (2 minutes)
   (2 drop off)                     │
        │                           ↓
        ↓                      13 verify
   18 authenticated ✅          (2 drop off)
                                    │
                                    ↓
                           13 authenticated ✅

Total conversions: 31 users (18 Google + 13 Email)
Conversion rate: 3.1% (↑ 55% improvement)
Average time: 1.2 minutes (↓ 50% reduction)
```

---

## 22. Summary Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Complete System View                            │
└─────────────────────────────────────────────────────────────────────────┘

                               🌐 Internet
                                    │
                                    │ HTTPS
                                    ↓
                         ┌─────────────────────┐
                         │  Google OAuth       │
                         │  accounts.google.com│
                         └──────────┬──────────┘
                                    │
                                    │ Redirect after consent
                                    ↓
                         ┌─────────────────────┐
                         │  Caddy (Port 443)   │
                         │  Reverse Proxy      │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ↓               ↓               ↓
         ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
         │  Frontend   │ │   Agent     │ │   Admin     │
         │  Port 3000  │ │  Port 3001  │ │  Port 3003  │
         │             │ │             │ │             │
         │ ✏️ MODIFY   │ │ ✅ NO CHANGE│ │ ✅ NO CHANGE│
         │ • Sign-In   │ │ • OAuth ref │ │             │
         │ • Sign-Up   │ │   impl      │ │             │
         └──────┬──────┘ └──────┬──────┘ └─────────────┘
                │               │
                └───────┬───────┘
                        │
                        │ Shared:
                        ↓
         ┌──────────────────────────────┐
         │     @repo/auth Package       │
         │     ✅ NO CHANGE              │
         │                              │
         │ • betterAuth() config        │
         │ • signIn.social() method     │
         │ • GOOGLE_OAUTH_SCOPES        │
         │ • Session management         │
         └──────────────┬───────────────┘
                        │
                        ↓
         ┌──────────────────────────────┐
         │  PostgreSQL (Supabase)       │
         │  ✅ NO CHANGE                 │
         │                              │
         │ • User                       │
         │ • Account (OAuth tokens)     │
         │ • Session                    │
         │ • Organization               │
         │ • Membership                 │
         └──────────────────────────────┘

Key Insight: Infrastructure already exists!
Only need to add UI buttons in Frontend app.
```

---

## 23. Decision Tree

### Post-Signup Redirect Decision

```
User completes Google OAuth signup from Frontend app
                    │
                    ↓
        ┌───────────────────────┐
        │ Where to redirect?    │
        └───────────┬───────────┘
                    │
      ┌─────────────┼─────────────┐
      │             │             │
      ↓             ↓             ↓
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Option A │  │ Option B │  │ Option C │
└──────────┘  └──────────┘  └──────────┘
      │             │             │
      ↓             ↓             ↓
  /dashboard    /onboarding   /onboarding
  (Frontend)    (Agent)       (Frontend - new)
      │             │             │
      ↓             ↓             ↓
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Pros:    │  │ Pros:    │  │ Pros:    │
│ • Simple │  │ • Gmail  │  │ • Self-  │
│ • Fast   │  │   sync   │  │   cont.  │
│          │  │ • Consis │  │ • Custom │
│ Cons:    │  │   -tent  │  │          │
│ • Limited│  │          │  │ Cons:    │
│   features│ │ Cons:    │  │ • More   │
│ • No     │  │ • Cross- │  │   work   │
│   onboard│  │   app    │  │ • Duplic │
│   -ing   │  │   redir  │  │   -ation │
└──────────┘  └──────────┘  └──────────┘
      │             │             │
      │             ↓             │
      │      ✅ RECOMMENDED       │
      │      (Best UX)            │
      └─────────────┴─────────────┘
```

---

## 24. System State Before and After

### Before Implementation

```
PostgreSQL Database:
├── User table: 100 users
│   ├── 100 via email/password
│   └── 0 via Google OAuth (Frontend)
│
├── Account table: 50 accounts
│   ├── 50 from Agent app Google OAuth
│   └── 0 from Frontend app Google OAuth
│
└── Session table: 30 active sessions

OAuth Callbacks:
├── /api/auth/callback/google → Agent app only
└── Frontend app → No OAuth flows

Sign-Up Conversion:
└── 2-3% (email/password only)
```

### After Phase 1 Implementation

```
PostgreSQL Database:
├── User table: 150 users (+50)
│   ├── 100 via email/password
│   ├── 30 via Google OAuth (Agent)
│   └── 20 via Google OAuth (Frontend) ✨
│
├── Account table: 100 accounts (+50)
│   ├── 50 from Agent app
│   └── 50 from Frontend app ✨
│
└── Session table: 50 active sessions (+20)

OAuth Callbacks:
├── /api/auth/callback/google → Agent app (processes for both)
└── Frontend app → Google OAuth flows enabled ✨

Sign-Up Conversion:
├── Overall: 3.1-3.5% (↑ 15-30%)
└── Google OAuth: 40-50% of new signups
```

---

## 25. Quick Reference Card

```
╔═════════════════════════════════════════════════════════════════╗
║                  Google SSO Quick Reference                     ║
╠═════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  CURRENT STATE:                                                 ║
║  • Agent app: ✅ Has Google OAuth                               ║
║  • Frontend app: ❌ Email/password only                         ║
║                                                                 ║
║  IMPLEMENTATION:                                                ║
║  • Files: 2-3 frontend components                               ║
║  • Lines: +140 (copy from Agent app)                            ║
║  • Backend: 0 changes                                           ║
║  • Database: 0 migrations                                       ║
║                                                                 ║
║  TESTING:                                                       ║
║  • Google sign-up from /signup                                  ║
║  • Google sign-in from homepage                                 ║
║  • Cross-app session sharing                                    ║
║  • Error handling (no_account)                                  ║
║                                                                 ║
║  DEPLOYMENT:                                                    ║
║  • Add redirect URI to Google Cloud Console                     ║
║  • Deploy Frontend app only                                     ║
║  • Monitor metrics for 24 hours                                 ║
║                                                                 ║
║  SUCCESS METRICS:                                               ║
║  • OAuth success rate: > 98%                                    ║
║  • Conversion improvement: +10-15%                              ║
║  • Google adoption: > 40% of signups                            ║
║                                                                 ║
║  ROLLBACK:                                                      ║
║  • git revert HEAD && git push                                  ║
║  • OR: Remove GOOGLE_CLIENT_ID from .env                        ║
║                                                                 ║
╚═════════════════════════════════════════════════════════════════╝
```

---

## 26. Related Diagrams

For additional architectural context, refer to:

- `/workspace/docs/ARCHITECTURE.md` - Overall platform architecture
- `/workspace/docs/internal/authentication.md` - Authentication system documentation
- `/workspace/docs/internal/deployment.md` - Deployment architecture

---

**These diagrams should be referenced during:**
- Design review meetings
- Implementation planning
- Code review
- Testing phase
- Post-deployment analysis

**For the complete technical design, see:** [google-sso-design.md](./google-sso-design.md)
