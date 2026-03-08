# Google SSO - Architecture Diagram

**Related Documents:**
- [Technical Design](./google-sso-technical-design.md)
- [Implementation Checklist](./google-sso-implementation-checklist.md)
- [Executive Summary](./google-sso-executive-summary.md)

---

## OAuth 2.0 Flow Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          GOOGLE SSO AUTHENTICATION FLOW                      │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐                                          ┌──────────────────┐
│             │  1. User clicks                          │                  │
│   Browser   │     "Continue with Google"               │  AgentC2 Client  │
│             │─────────────────────────────────────────>│  (React Form)    │
│             │                                          │                  │
└─────────────┘                                          └────────┬─────────┘
       │                                                          │
       │                                                          │ 2. signIn.social()
       │                                                          │    provider: "google"
       │                                                          │    scopes: [gmail, calendar, drive]
       │                                                          │
       │                                                          ▼
       │                                          ┌──────────────────────────────┐
       │                                          │   Better Auth Client         │
       │                                          │   @repo/auth/client          │
       │                                          └────────┬─────────────────────┘
       │                                                   │
       │                                                   │ 3. POST /api/auth/sign-in/social
       │                                                   │
       │                                                   ▼
       │                                          ┌──────────────────────────────┐
       │  4. Redirect to Google ◄─────────────────│   Better Auth Server         │
       │     OAuth consent                        │   packages/auth/src/auth.ts  │
       │                                          │                              │
       │                                          │  - Generate state (CSRF)     │
       │                                          │  - Build auth URL            │
       │                                          │  - Set state cookie          │
       │                                          └──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       GOOGLE OAUTH CONSENT SCREEN                            │
│  accounts.google.com/o/oauth2/v2/auth                                       │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │  AgentC2 wants to access your Google Account                   │        │
│  │                                                                 │        │
│  │  This will allow AgentC2 to:                                   │        │
│  │  ✓ Read, compose, send, and manage email                       │        │
│  │  ✓ See and edit events on all your calendars                   │        │
│  │  ✓ See and download your Google Drive files                    │        │
│  │  ✓ Create new files in Google Drive                            │        │
│  │                                                                 │        │
│  │  [ user@gmail.com ▼ ]                                          │        │
│  │                                                                 │        │
│  │  [Cancel]  [Continue]                                          │        │
│  └────────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
       │
       │ 5. User clicks "Continue"
       │    Google generates authorization code
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  REDIRECT: https://agentc2.ai/api/auth/callback/google?code=XXX&state=YYY  │
└─────────────────────────────────────────────────────────────────────────────┘
       │
       │ 6. Better Auth Callback Handler
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│   Better Auth OAuth Callback                                                 │
│   /api/auth/callback/google                                                  │
│                                                                               │
│   6a. Validate state (CSRF check)                                            │
│   6b. Exchange code for tokens:                                              │
│       POST https://oauth2.googleapis.com/token                               │
│       {                                                                      │
│         code: "authorization-code",                                          │
│         client_id: "...",                                                    │
│         client_secret: "...",                                                │
│         redirect_uri: "https://agentc2.ai/api/auth/callback/google",        │
│         grant_type: "authorization_code"                                     │
│       }                                                                      │
│                                                                               │
│   6c. Google responds with:                                                  │
│       {                                                                      │
│         access_token: "ya29...",                                             │
│         refresh_token: "1//0g...",                                           │
│         expires_in: 3599,                                                    │
│         scope: "gmail.modify calendar.events ...",                           │
│         token_type: "Bearer",                                                │
│         id_token: "eyJhb..."  // JWT with user profile                      │
│       }                                                                      │
│                                                                               │
│   6d. Decode ID token (OpenID Connect):                                      │
│       {                                                                      │
│         sub: "1234567890",        // Google user ID                          │
│         email: "user@gmail.com",                                             │
│         email_verified: true,                                                │
│         name: "John Doe",                                                    │
│         picture: "https://..."                                               │
│       }                                                                      │
└──────────────────────────────────────────────────────────────────────────────┘
       │
       │ 7. User & Account Management
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│   Database Operations (PostgreSQL)                                           │
│                                                                               │
│   7a. Find or create User record:                                            │
│       User.findUnique({ where: { email: "user@gmail.com" } })               │
│       → If not exists: User.create({                                         │
│           email: "user@gmail.com",                                           │
│           name: "John Doe",                                                  │
│           emailVerified: true,                                               │
│           image: "https://...",                                              │
│         })                                                                   │
│                                                                               │
│   7b. Create or update Account record:                                       │
│       Account.upsert({                                                       │
│         where: {                                                             │
│           providerId: "google",                                              │
│           accountId: "1234567890"  // Google user ID                         │
│         },                                                                   │
│         update: {                                                            │
│           accessToken: "ya29...",                                            │
│           refreshToken: "1//0g...",                                          │
│           accessTokenExpiresAt: new Date(Date.now() + 3599 * 1000),         │
│           scope: "gmail.modify calendar.events ..."                          │
│         },                                                                   │
│         create: {                                                            │
│           userId: user.id,                                                   │
│           providerId: "google",                                              │
│           accountId: "1234567890",                                           │
│           accessToken: "ya29...",                                            │
│           refreshToken: "1//0g...",                                          │
│           accessTokenExpiresAt: ...,                                         │
│           scope: "..."                                                       │
│         }                                                                    │
│       })                                                                     │
│                                                                               │
│   7c. Create Session record:                                                 │
│       Session.create({                                                       │
│         userId: user.id,                                                     │
│         token: "random-session-token",                                       │
│         expiresAt: new Date(Date.now() + 30 * 60 * 1000),  // 30 min        │
│         ipAddress: req.ip,                                                   │
│         userAgent: req.headers["user-agent"]                                 │
│       })                                                                     │
└──────────────────────────────────────────────────────────────────────────────┘
       │
       │ 8. Set session cookie
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│   Set-Cookie Header                                                          │
│                                                                               │
│   better-auth.session_token=<session-token>;                                │
│   HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1800;                     │
│   Domain=.agentc2.ai (production only)                                       │
└──────────────────────────────────────────────────────────────────────────────┘
       │
       │ 9. Trigger bootstrap hook
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│   Organization Bootstrapping                                                 │
│   packages/auth/src/bootstrap.ts                                             │
│                                                                               │
│   bootstrapUserOrganization(userId, name, email, inviteCode, options)       │
│                                                                               │
│   9a. Check existing membership → if exists, return                          │
│   9b. Try invite code (platform or org-scoped) → join org                    │
│   9c. Try domain matching (email domain → org) → suggest org                 │
│   9d. Create new org (if not deferred)                                       │
│                                                                               │
│   Creates:                                                                   │
│   - Organization (e.g., "John's Organization")                               │
│   - Workspace (default: "Production")                                        │
│   - Membership (role: "owner")                                               │
└──────────────────────────────────────────────────────────────────────────────┘
       │
       │ 10. Post-bootstrap hooks
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│   Post-Bootstrap Hook: Gmail Sync                                            │
│   apps/agent/src/lib/gmail-sync.ts                                           │
│                                                                               │
│   onPostBootstrap(async (userId, organizationId) => {                       │
│     await syncGmailFromAccount(userId, organizationId);                     │
│   });                                                                        │
│                                                                               │
│   syncGmailFromAccount():                                                    │
│   10a. Read tokens from Account table (providerId: "google")                 │
│   10b. Encrypt tokens (AES-256-GCM)                                          │
│   10c. Create IntegrationConnection for Gmail:                               │
│       {                                                                      │
│         providerId: "gmail",                                                 │
│         organizationId: org.id,                                              │
│         userId: user.id,                                                     │
│         name: "Gmail (user@gmail.com)",                                      │
│         credentials: { __enc: "v1", iv: "...", data: "..." },               │
│         metadata: { email: "user@gmail.com" },                               │
│         isActive: true                                                       │
│       }                                                                      │
│   10d. Create IntegrationConnection for Google Calendar (same tokens)       │
│   10e. Create IntegrationConnection for Google Drive (same tokens)          │
│   10f. Trigger blueprint auto-provisioning (if blueprints exist)            │
└──────────────────────────────────────────────────────────────────────────────┘
       │
       │ 11. Final redirect
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│   Redirect to Application                                                    │
│                                                                               │
│   New user: /onboarding (complete profile, select plan, etc.)               │
│   Existing user: /workspace (or callbackURL)                                 │
└──────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                          USER IS NOW AUTHENTICATED
═══════════════════════════════════════════════════════════════════════════════
```

---

## Data Storage Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        POSTGRESQL DATABASE SCHEMA                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐
│   User Table             │
│                          │
│  id: "usr_abc123"        │◄───┐
│  email: "user@gmail.com" │    │
│  name: "John Doe"        │    │
│  emailVerified: true     │    │
│  image: "https://..."    │    │
│  status: "active"        │    │
│  createdAt: 2026-03-08   │    │
└──────────────────────────┘    │
                                 │  Foreign Key: userId
                                 │
┌──────────────────────────┐    │
│   Account Table          │    │
│   (OAuth Providers)      │    │
│                          │    │
│  id: "acc_xyz789"        │    │
│  userId: "usr_abc123" ───┼────┘
│  providerId: "google"    │
│  accountId: "1234567890" │  ← Google user ID (sub claim)
│                          │
│  accessToken: "ya29..." ────┐
│  refreshToken: "1//0g..."   │  OAuth Tokens (Plain Text)
│  idToken: "eyJhb..."      ──┤  Stored in Better Auth Account table
│  accessTokenExpiresAt:      │  Used for user authentication
│    2026-03-08 12:34:56    ──┘
│                          │
│  scope: "gmail.modify..." │
│  createdAt: 2026-03-08   │
│  updatedAt: 2026-03-08   │
└──────────────────────────┘
       │
       │ Synced by post-bootstrap hook
       │ (syncGmailFromAccount)
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│   IntegrationConnection Table (Agent Tool Authentication)                │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │  Gmail Connection                                            │        │
│  │  id: "conn_gmail_001"                                        │        │
│  │  providerId: "gmail"                                         │        │
│  │  organizationId: "org_company"                               │        │
│  │  userId: "usr_abc123"                                        │        │
│  │  name: "Gmail (user@gmail.com)"                              │        │
│  │  isActive: true                                              │        │
│  │                                                               │        │
│  │  credentials: {                                              │        │
│  │    __enc: "v1",                                              │        │
│  │    iv: "base64-iv",                ◄─ AES-256-GCM Encrypted │        │
│  │    tag: "base64-tag",                 (CREDENTIAL_ENCRYPTION_KEY)   │
│  │    data: "base64-encrypted-json"                             │        │
│  │  }                                                            │        │
│  │                                                               │        │
│  │  Decrypted credentials: {                                    │        │
│  │    accessToken: "ya29...",                                   │        │
│  │    refreshToken: "1//0g...",                                 │        │
│  │    expiresAt: 1709900096000,  // Unix timestamp ms           │        │
│  │    email: "user@gmail.com",                                  │        │
│  │    scope: "gmail.modify calendar.events ..."                 │        │
│  │  }                                                            │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │  Google Calendar Connection                                  │        │
│  │  id: "conn_calendar_002"                                     │        │
│  │  providerId: "google-calendar"                               │        │
│  │  credentials: { __enc: "v1", ... }  ◄─ Same tokens as Gmail │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │  Google Drive Connection                                     │        │
│  │  id: "conn_drive_003"                                        │        │
│  │  providerId: "google-drive"                                  │        │
│  │  credentials: { __enc: "v1", ... }  ◄─ Same tokens as Gmail │        │
│  └─────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────┘
       │
       │ Used by Agent Tools
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│   Agent Tool Execution                                                    │
│   packages/agentc2/src/tools/gmail/                                       │
│                                                                           │
│   When agent needs to call Gmail API:                                    │
│   1. Fetch IntegrationConnection (providerId: "gmail")                   │
│   2. Decrypt credentials                                                  │
│   3. Check if accessToken expired (compare with Date.now())              │
│   4. If expired: refresh using refreshToken                              │
│   5. Make Gmail API call with fresh accessToken                          │
│   6. Return result to agent                                               │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Component Interaction Map

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    AGENTC2 AUTHENTICATION COMPONENTS                        │
└────────────────────────────────────────────────────────────────────────────┘

Frontend (Client-Side)              Backend (Server-Side)
═══════════════════════════         ═══════════════════════════════════════

┌─────────────────────┐             ┌─────────────────────────────────────┐
│  SignInForm         │────────────>│  Better Auth Server                 │
│  sign-in-form.tsx   │  API Call   │  packages/auth/src/auth.ts          │
│                     │             │                                     │
│  - Google button    │             │  socialProviders: {                 │
│  - Email form       │             │    google: {                        │
│  - Error display    │             │      clientId: env.GOOGLE_CLIENT_ID │
└─────────────────────┘             │      clientSecret: env...           │
                                    │      accessType: "offline"          │
┌─────────────────────┐             │      scope: [gmail, cal, drive]     │
│  SignUpForm         │             │    }                                │
│  sign-up-form.tsx   │             │  }                                  │
│                     │             └─────────────────────────────────────┘
│  - Google button    │                          │
│  - Invite code      │                          │ Uses
│  - Email form       │                          ▼
└─────────────────────┘             ┌─────────────────────────────────────┐
          │                         │  Google Scopes Config               │
          │ Uses                    │  google-scopes.ts                   │
          ▼                         │                                     │
┌─────────────────────┐             │  GOOGLE_OAUTH_SCOPES = [            │
│  Auth Client        │             │    "gmail.modify",                  │
│  auth-client.ts     │             │    "calendar.events",               │
│                     │             │    "drive.readonly",                │
│  signIn.social()    │             │    "drive.file"                     │
│  signUp.email()     │             │  ]                                  │
│  useSession()       │             └─────────────────────────────────────┘
└─────────────────────┘                          │
                                                 │ Referenced by
                                                 ▼
                                    ┌─────────────────────────────────────┐
Database Layer                      │  Bootstrap System                   │
══════════════                      │  bootstrap.ts                       │
                                    │                                     │
┌─────────────────────┐             │  1. Check existing membership       │
│  User               │◄────────────│  2. Try invite code                 │
│  ┌─────────────┐    │             │  3. Try domain matching             │
│  │ id          │    │             │  4. Create new org (if not deferred)│
│  │ email       │    │             └─────────────────────────────────────┘
│  │ name        │    │                          │
│  │ emailVerified│   │                          │ Triggers
│  └─────────────┘    │                          ▼
└─────────────────────┘             ┌─────────────────────────────────────┐
         ▲                          │  Post-Bootstrap Hook                │
         │ Foreign Key              │  instrumentation.ts                 │
         │                          │                                     │
┌─────────────────────┐             │  onPostBootstrap(async () => {      │
│  Account            │             │    await syncGmailFromAccount()     │
│  ┌─────────────┐    │             │  })                                 │
│  │ userId      │────┘             └─────────────────────────────────────┘
│  │ providerId  │                               │
│  │ accessToken │                               │ Creates
│  │ refreshToken│                               ▼
│  │ expiresAt   │                  ┌─────────────────────────────────────┐
│  └─────────────┘                  │  IntegrationConnection              │
└─────────────────────┘             │  ┌─────────────────────────────┐    │
         │                          │  │ Gmail Connection            │    │
         │ Synced to                │  │ providerId: "gmail"         │    │
         │                          │  │ credentials: {encrypted}    │    │
         ▼                          │  └─────────────────────────────┘    │
┌─────────────────────┐             │  ┌─────────────────────────────┐    │
│  IntegrationConnection│           │  │ Calendar Connection         │    │
│  ┌─────────────┐    │             │  │ providerId: "google-calendar"│   │
│  │ providerId  │    │             │  │ credentials: {encrypted}    │    │
│  │ orgId       │    │             │  └─────────────────────────────┘    │
│  │ userId      │    │             │  ┌─────────────────────────────┐    │
│  │ credentials │    │◄────────────│  │ Drive Connection            │    │
│  │  (encrypted)│    │   Used by   │  │ providerId: "google-drive"  │    │
│  │ isActive    │    │   Agents    │  │ credentials: {encrypted}    │    │
│  └─────────────┘    │             │  └─────────────────────────────┘    │
└─────────────────────┘             └─────────────────────────────────────┘
         ▲
         │ Used by Agent Tools
         │
┌─────────────────────┐
│  Agent Tools        │
│  @repo/agentc2      │
│                     │
│  - Gmail tools      │
│  - Calendar tools   │
│  - Drive tools      │
└─────────────────────┘
```

---

## Token Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         OAUTH TOKEN LIFECYCLE                             │
└──────────────────────────────────────────────────────────────────────────┘

1. TOKEN ACQUISITION
═══════════════════════

User signs in with Google
         │
         ▼
┌────────────────────────┐
│  Authorization Code    │  (short-lived, single-use)
│  Valid for: 10 minutes │
└───────────┬────────────┘
            │ Exchange for tokens
            ▼
┌────────────────────────────────────────────┐
│  Access Token                              │
│  - Format: "ya29.a0AfB_by..."              │
│  - Expires: 1 hour                         │
│  - Scope: gmail.modify calendar.events ... │
│  - Used for: Gmail/Calendar/Drive API calls│
└────────────────────────────────────────────┘
            │
            │ Stored with
            ▼
┌────────────────────────────────────────────┐
│  Refresh Token                             │
│  - Format: "1//0gPBv..."                   │
│  - Expires: Never (until revoked)          │
│  - Used for: Obtaining new access tokens   │
└────────────────────────────────────────────┘


2. TOKEN STORAGE (DUAL LOCATIONS)
═══════════════════════════════════

┌─────────────────────────┐         ┌──────────────────────────────┐
│  Account Table          │         │  IntegrationConnection Table │
│  (Better Auth)          │  Sync   │  (Agent Tools)               │
│                         │ ──────> │                              │
│  accessToken: "ya29..." │         │  credentials: {              │
│  refreshToken: "1//0g..." │       │    __enc: "v1",              │
│  expiresAt: <timestamp> │         │    iv: "...",                │
│                         │         │    tag: "...",               │
│  Plain text storage     │         │    data: "{encrypted JSON}"  │
│  (database-level        │         │  }                           │
│   encryption only)      │         │                              │
└─────────────────────────┘         │  AES-256-GCM encrypted       │
                                    │  (CREDENTIAL_ENCRYPTION_KEY) │
                                    └──────────────────────────────┘


3. TOKEN REFRESH (AUTOMATIC)
═══════════════════════════════

Time: T+0           Agent needs Gmail API access
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Check Token Expiry │
                    │  Is token expired?  │
                    └──────┬──────────────┘
                           │
                ┌──────────┴───────────┐
                │ YES                  │ NO
                ▼                      ▼
    ┌───────────────────────┐   ┌─────────────────┐
    │  Refresh Token        │   │  Use Existing   │
    │                       │   │  Access Token   │
    │  POST /token          │   └─────────────────┘
    │  grant_type=refresh   │
    │  refresh_token=...    │
    └───────┬───────────────┘
            │
            ▼
    ┌───────────────────────┐
    │  New Access Token     │
    │  expires_in: 3599     │
    └───────┬───────────────┘
            │
            │ Save to database
            ▼
    ┌───────────────────────────────────┐
    │  Update Account.accessToken       │
    │  Update Account.accessTokenExpiresAt│
    │  Update IntegrationConnection     │
    └───────────────────────────────────┘
            │
            ▼
    ┌───────────────────────┐
    │  Make Gmail API Call  │
    │  with fresh token     │
    └───────────────────────┘


4. TOKEN REVOCATION (USER-INITIATED)
═══════════════════════════════════════

User visits Google Account Settings
  https://myaccount.google.com/permissions
         │
         ▼
    Remove AgentC2 access
         │
         ▼
┌─────────────────────────────┐
│  Refresh Token Revoked      │
│  (Google-side)              │
└─────────┬───────────────────┘
          │
          │ Next API call fails
          ▼
┌─────────────────────────────────┐
│  Token Refresh Attempt Fails    │
│  Error: invalid_grant           │
└─────────┬───────────────────────┘
          │
          │ Handle error
          ▼
┌─────────────────────────────────────────┐
│  Mark Connection Inactive               │
│  IntegrationConnection.isActive = false │
└─────────┬───────────────────────────────┘
          │
          │ Notify user
          ▼
┌───────────────────────────────────────────┐
│  UI Notification                          │
│  "Gmail connection expired. Reconnect?"   │
│  [Reconnect Button] → Start OAuth flow    │
└───────────────────────────────────────────┘
```

---

## Security Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      SECURITY LAYERS & PROTECTIONS                         │
└────────────────────────────────────────────────────────────────────────────┘

Layer 1: CSRF Protection (OAuth State Parameter)
═══════════════════════════════════════════════════

OAuth Start:
  state = {
    organizationId: "org-id",
    userId: "user-id",
    nonce: randomBytes(16),
    expiresAt: Date.now() + 10min
  }
         │ Encode to base64url
         ▼
  stateParam = base64url(JSON.stringify(state))
         │ Sign with HMAC
         ▼
  signature = HMAC-SHA256(stateParam, BETTER_AUTH_SECRET)
         │ Combine
         ▼
  signedState = stateParam + "." + signature
         │ Store in cookie
         ▼
  Cookie: oauth_state=signedState; HttpOnly; SameSite=Lax; Secure


OAuth Callback:
  1. Read state from cookie
  2. Compare with state param in URL
  3. Verify HMAC signature (timing-safe comparison)
  4. Check expiration (< 10 minutes old)
  5. Reject if any check fails


Layer 2: Token Encryption at Rest
═══════════════════════════════════

IntegrationConnection.credentials:

┌─────────────────────┐
│  Plain JSON         │
│  {                  │
│    accessToken: "ya29...",
│    refreshToken: "1//0g...",
│    expiresAt: 1709900096000
│  }                  │
└──────┬──────────────┘
       │ Encrypt with AES-256-GCM
       │ Key: CREDENTIAL_ENCRYPTION_KEY (32 bytes)
       ▼
┌─────────────────────────────────────┐
│  Encrypted JSON                     │
│  {                                  │
│    __enc: "v1",                     │
│    iv: "base64(random 12 bytes)",   │  ← Initialization Vector
│    tag: "base64(16-byte auth tag)", │  ← Authentication Tag (integrity)
│    data: "base64(encrypted JSON)"   │  ← Ciphertext
│  }                                  │
└─────────────────────────────────────┘
       │ Stored in database
       ▼
┌──────────────────────────────┐
│  PostgreSQL (Supabase)       │
│  - Database-level encryption │
│  - Network encryption (TLS)  │
│  - Access controls (IAM)     │
└──────────────────────────────┘


Layer 3: Session Cookie Security
═══════════════════════════════════

Set-Cookie: better-auth.session_token=<token>;
  HttpOnly               ← JavaScript cannot read cookie
  Secure                 ← HTTPS only (production)
  SameSite=Lax           ← CSRF protection
  Path=/                 ← Available across entire app
  Domain=.agentc2.ai     ← Cross-subdomain (production)
  Max-Age=1800           ← 30-minute expiration


Layer 4: Database Access Control
═══════════════════════════════════

┌─────────────────────────┐
│  Application            │
│  - Uses Prisma ORM      │
│  - Connection pooling   │
│  - Prepared statements  │  ← SQL injection prevention
└─────────┬───────────────┘
          │ TLS connection
          ▼
┌─────────────────────────────────┐
│  PostgreSQL (Supabase)          │
│  - Row-level security (RLS)     │
│  - Role-based access control    │
│  - Network restrictions (IP)    │
│  - Audit logging                │
└─────────────────────────────────┘


Layer 5: Token Transmission
═══════════════════════════════

All token transmissions use HTTPS/TLS 1.3:

Browser ←─TLS─→ AgentC2 Server ←─TLS─→ Google APIs
         │                      │
         │ Encrypted            │ Encrypted
         │ (Certificate)        │ (Google CA)
```

---

## Multi-Tenant Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│              MULTI-TENANT GOOGLE OAUTH ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────────────┘

Organization A                      Organization B
══════════════                      ══════════════

┌──────────────────┐                ┌──────────────────┐
│  User: Alice     │                │  User: Bob       │
│  alice@companyA  │                │  bob@companyB    │
└────────┬─────────┘                └────────┬─────────┘
         │ Signs in with Google              │ Signs in with Google
         │                                   │
         ▼                                   ▼
┌──────────────────────────────────────────────────────────────┐
│                    Shared Better Auth Instance               │
│  - Single OAuth Client ID (from Google Cloud Console)        │
│  - Handles all user authentications                          │
│  - Creates User + Account records per user                   │
└──────────────────────────────────────────────────────────────┘
         │                                   │
         │ Bootstrap                         │ Bootstrap
         ▼                                   ▼
┌─────────────────────┐             ┌─────────────────────┐
│  Organization A     │             │  Organization B     │
│  id: org-aaa        │             │  id: org-bbb        │
│  slug: companyA     │             │  slug: companyB     │
└──────┬──────────────┘             └──────┬──────────────┘
       │                                   │
       │ Sync tokens                       │ Sync tokens
       ▼                                   ▼
┌────────────────────────────┐      ┌────────────────────────────┐
│  IntegrationConnection     │      │  IntegrationConnection     │
│  Gmail (alice@companyA)    │      │  Gmail (bob@companyB)      │
│  - Organization-scoped     │      │  - Organization-scoped     │
│  - Alice's tokens only     │      │  - Bob's tokens only       │
└────────────────────────────┘      └────────────────────────────┘
       │                                   │
       │ Used by                           │ Used by
       ▼                                   ▼
┌────────────────────┐              ┌────────────────────┐
│  Agents (Org A)    │              │  Agents (Org B)    │
│  - Can read Alice's│              │  - Can read Bob's  │
│    Gmail only      │              │    Gmail only      │
│  - Isolated from   │              │  - Isolated from   │
│    Org B           │              │    Org A           │
└────────────────────┘              └────────────────────┘

═══════════════════════════════════════════════════════════════
KEY INSIGHT: Single OAuth app, multi-tenant token isolation
═══════════════════════════════════════════════════════════════

✅ One Google OAuth Client ID serves all organizations
✅ Each user's tokens isolated to their organization
✅ No cross-tenant data access possible
✅ Agent tools respect organization boundaries
```

---

## Comparison: Agent App vs. Admin Portal

```
┌─────────────────────────────────────────────────────────────────────────┐
│            AGENT APP vs. ADMIN PORTAL GOOGLE OAUTH                       │
└─────────────────────────────────────────────────────────────────────────┘

Feature                  Agent App              Admin Portal
═══════════════════════════════════════════════════════════════════════════

Framework                Better Auth            Custom OAuth2
Implementation           Social Provider         google-auth-library
Scopes                   Gmail, Calendar,       openid, email, profile
                         Drive (extensive)      (minimal)
Access Type              offline (refresh)       online (no refresh)
Purpose                  User auth + Tool auth   Admin authentication
Redirect URI             /api/auth/callback/     /admin/api/auth/google/
                         google                  callback
Token Storage            Account + Integration   Admin session (memory)
                         Connection (DB)         
Refresh Tokens           ✅ Yes                  ❌ No
Integration Sync         ✅ Auto-syncs           ❌ Not needed
User Allowlist           ❌ Open to all          ✅ AdminUser table
Multi-Tenant             ✅ Yes                  ❌ Single tenant (platform)

═══════════════════════════════════════════════════════════════════════════

KEY DIFFERENCES:

Agent App:
- Public-facing user authentication
- Requests extensive scopes for agent tool access
- Syncs tokens to IntegrationConnection for Gmail/Calendar/Drive tools
- Part of Better Auth social provider system
- Shares same Google OAuth app with admin portal

Admin Portal:
- Internal-only authentication
- Minimal scopes (profile only)
- No token storage (session-based)
- Custom implementation (not Better Auth)
- Checks AdminUser allowlist for access control
```

---

## Integration Points

```
┌────────────────────────────────────────────────────────────────────────────┐
│                  GOOGLE SSO INTEGRATION TOUCHPOINTS                         │
└────────────────────────────────────────────────────────────────────────────┘

1. AUTHENTICATION LAYER
   ├─ Better Auth Server (packages/auth/src/auth.ts)
   ├─ Auth Client (packages/auth/src/auth-client.ts)
   ├─ Google Scopes (packages/auth/src/google-scopes.ts)
   └─ Bootstrap Logic (packages/auth/src/bootstrap.ts)

2. USER INTERFACE
   ├─ Login Page (apps/agent/src/app/login/page.tsx)
   ├─ Sign-In Form (apps/agent/src/components/auth/sign-in-form.tsx)
   └─ Sign-Up Form (apps/agent/src/components/auth/sign-up-form.tsx)

3. DATABASE LAYER
   ├─ User Model (schema.prisma)
   ├─ Account Model (schema.prisma)
   ├─ Session Model (schema.prisma)
   └─ IntegrationConnection Model (schema.prisma)

4. INTEGRATION SYNC
   ├─ Gmail Sync (apps/agent/src/lib/gmail-sync.ts)
   ├─ Gmail OAuth Client (apps/agent/src/lib/gmail.ts)
   └─ Post-Bootstrap Hook (apps/agent/instrumentation.ts)

5. AGENT TOOLS
   ├─ Gmail Tools (packages/agentc2/src/tools/gmail/)
   ├─ Calendar Tools (packages/agentc2/src/tools/calendar/)
   └─ Drive Tools (packages/agentc2/src/tools/drive/)

6. SECURITY & ENCRYPTION
   ├─ Credential Crypto (apps/agent/src/lib/credential-crypto.ts)
   └─ OAuth Security (apps/agent/src/lib/oauth-security.ts)

7. ADMIN PORTAL (SEPARATE)
   ├─ Admin Auth (packages/admin-auth/src/google.ts)
   ├─ Admin Login (apps/admin/src/app/login/page.tsx)
   └─ Admin Callbacks (apps/admin/src/app/api/auth/google/)

8. CONFIGURATION
   ├─ Environment Variables (.env)
   ├─ Google Cloud Console (OAuth app)
   └─ Redirect URI Registration

═══════════════════════════════════════════════════════════════════════════

TOTAL FILES INVOLVED: ~20 files
TOTAL LINES OF CODE: ~3000 lines (across all components)

NEW FILES REQUIRED: 0 (everything exists)
NEW CODE REQUIRED: 0 (only configuration needed)
```

---

## Deployment Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION DEPLOYMENT                                │
└────────────────────────────────────────────────────────────────────────────┘

External Services                 AgentC2 Infrastructure
══════════════════               ═══════════════════════════════

┌─────────────────┐               ┌──────────────────────────────┐
│  Google OAuth   │               │  Digital Ocean Droplet       │
│  accounts.google│◄─────TLS─────>│  Ubuntu 22.04                │
│  .com           │  OAuth Flow   │  IP: XXX.XXX.XXX.XXX         │
└─────────────────┘               │                              │
                                  │  ┌────────────────────────┐  │
┌─────────────────┐               │  │  Caddy Reverse Proxy  │  │
│  Google APIs    │               │  │  :443 (HTTPS)         │  │
│  - Gmail API    │◄─────TLS─────>│  │                       │  │
│  - Calendar API │  Token-based  │  │  agentc2.ai/*         │  │
│  - Drive API    │  Auth         │  │  ├─ /agent/* → 3001  │  │
└─────────────────┘               │  │  ├─ /admin/* → 3003  │  │
                                  │  │  └─ /* → 3000        │  │
                                  │  └────────┬───────────────┘  │
                                  │           │                  │
                                  │  ┌────────┴────────┐         │
                                  │  │  PM2 Processes  │         │
                                  │  │                 │         │
                                  │  │ ┌─────────────┐ │         │
                                  │  │ │ Agent App   │ │         │
                                  │  │ │ (port 3001) │ │         │
                                  │  │ │ • Better Auth│ │        │
                                  │  │ │ • OAuth      │ │         │
                                  │  │ │ • API routes │ │         │
                                  │  │ └─────────────┘ │         │
                                  │  │                 │         │
                                  │  │ ┌─────────────┐ │         │
                                  │  │ │ Frontend    │ │         │
                                  │  │ │ (port 3000) │ │         │
                                  │  │ └─────────────┘ │         │
                                  │  │                 │         │
                                  │  │ ┌─────────────┐ │         │
                                  │  │ │ Admin       │ │         │
                                  │  │ │ (port 3003) │ │         │
                                  │  │ └─────────────┘ │         │
                                  │  └─────────────────┘         │
                                  │           │                  │
                                  │           │ Connects to      │
                                  │           ▼                  │
                                  │  ┌─────────────────┐         │
                                  │  │  PostgreSQL     │         │
                                  │  │  (Supabase)     │         │
                                  │  │  :5432          │         │
                                  │  │                 │         │
                                  │  │  Tables:        │         │
                                  │  │  - user         │         │
                                  │  │  - account      │         │
                                  │  │  - session      │         │
                                  │  │  - integration_ │         │
                                  │  │    connection   │         │
                                  │  └─────────────────┘         │
                                  └──────────────────────────────┘

Environment Variables (Secure Storage):
┌──────────────────────────────────────┐
│  .env file (encrypted at rest)       │
│  or                                  │
│  Environment variable system         │
│                                      │
│  GOOGLE_CLIENT_ID                    │
│  GOOGLE_CLIENT_SECRET                │
│  BETTER_AUTH_SECRET                  │
│  CREDENTIAL_ENCRYPTION_KEY           │
└──────────────────────────────────────┘
```

---

## User Journey Map

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          NEW USER SIGNUP JOURNEY                            │
└────────────────────────────────────────────────────────────────────────────┘

Step 1: Landing              Step 2: OAuth           Step 3: Consent
═══════════════              ═══════════════         ═══════════════

┌────────────────┐           ┌────────────────┐     ┌──────────────────┐
│  agentc2.ai/   │ Click     │  Google OAuth  │ User│  Google Consent  │
│  signup        │ Google    │  Redirect      │ logs│  Screen          │
│                │ button    │                │ in  │                  │
│ [Continue with │──────────>│  Loading...    │────>│ [Continue]       │
│  Google]       │           │                │     │ [Cancel]         │
│                │           │                │     │                  │
│ [Continue with │           │                │     │ Scopes:          │
│  Microsoft]    │           │                │     │ • Gmail          │
│                │           │                │     │ • Calendar       │
│ or continue    │           │                │     │ • Drive          │
│ with email     │           │                │     │                  │
└────────────────┘           └────────────────┘     └──────────────────┘
                                                              │
                                                              │ Grant
Step 4: Callback             Step 5: Onboarding              ▼
═══════════════              ═══════════════════════════════════════

┌────────────────┐           ┌────────────────────────────────────┐
│  Processing... │           │  agentc2.ai/onboarding             │
│                │           │                                    │
│  Creating      │───────────>│  Welcome, John!                    │
│  account...    │           │                                    │
│                │           │  [Complete Profile]                │
│  Syncing Gmail │           │                                    │
│  Calendar...   │           │  Integrations connected:           │
│                │           │  ✓ Gmail (john@gmail.com)          │
│                │           │  ✓ Google Calendar                 │
└────────────────┘           │  ✓ Google Drive                    │
                             │                                    │
                             │  [Continue to Workspace]           │
                             └────────────────────────────────────┘
                                                │
                                                │ Complete
Step 6: Workspace                               ▼
═══════════════              ┌────────────────────────────────────┐
                             │  agentc2.ai/workspace              │
                             │                                    │
                             │  Welcome to your workspace!        │
                             │                                    │
                             │  [Create Agent] [View Integrations]│
                             │                                    │
                             │  Agents can now access:            │
                             │  • Your Gmail inbox                │
                             │  • Your calendar                   │
                             │  • Your Drive files                │
                             └────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════
TOTAL TIME: ~30 seconds (excluding user interaction time)
USER ACTIONS: 2 clicks (Google button + Consent)
AUTOMATION: Account creation, org setup, integration sync
═══════════════════════════════════════════════════════════════════════════
```

---

## Error Handling Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          ERROR HANDLING SCENARIOS                           │
└────────────────────────────────────────────────────────────────────────────┘

Error Type 1: User Denies Consent
═══════════════════════════════════

Google Consent Screen
         │
         │ User clicks "Cancel"
         ▼
Redirect: /signup?error=access_denied
         │
         ▼
┌────────────────────────────────────┐
│  UI: Error Message                 │
│  "Google sign-in was cancelled.    │
│   Try again or use email instead." │
└────────────────────────────────────┘


Error Type 2: Redirect URI Mismatch
═══════════════════════════════════════

Better Auth generates OAuth URL
         │
         ▼
Google validates redirect_uri parameter
         │
         │ URI not in allowlist
         ▼
Google Error Page:
  "Error 400: redirect_uri_mismatch
   The redirect URI in the request,
   https://agentc2.ai/api/auth/callback/google,
   does not match the ones authorized for the
   OAuth client."
         │
         ▼
User sees error page (no redirect)
         │
         │ Developer action required
         ▼
Fix: Add URI to Google Cloud Console


Error Type 3: Invalid Client Credentials
═══════════════════════════════════════════

Better Auth exchanges code for tokens
         │
         │ POST /token with client_id + client_secret
         ▼
Google validates credentials
         │
         │ Credentials invalid
         ▼
Google responds: { error: "invalid_client" }
         │
         ▼
Better Auth logs error, returns generic message
         │
         ▼
┌────────────────────────────────────┐
│  UI: Error Message                 │
│  "Authentication failed.           │
│   Please try again."               │
└────────────────────────────────────┘
         │
         │ Developer action required
         ▼
Fix: Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET


Error Type 4: Token Refresh Failure
═══════════════════════════════════════

Agent calls Gmail tool
         │
         ▼
Check if access token expired
         │
         │ YES - token expired
         ▼
Attempt token refresh with refresh_token
         │
         │ POST /token grant_type=refresh_token
         ▼
Google validates refresh token
         │
         │ Token revoked by user
         ▼
Google responds: { error: "invalid_grant" }
         │
         ▼
Mark IntegrationConnection as inactive
         │
         ▼
┌────────────────────────────────────┐
│  UI: Notification                  │
│  "Gmail connection expired.        │
│   [Reconnect]"                     │
└────────────────────────────────────┘
         │
         │ User clicks Reconnect
         ▼
Start new OAuth flow (re-authorize)
```

---

## Comparison with Existing OAuth Implementations

```
┌────────────────────────────────────────────────────────────────────────────┐
│          OAUTH PATTERNS: GOOGLE vs. MICROSOFT vs. DROPBOX                  │
└────────────────────────────────────────────────────────────────────────────┘

Feature              Google (Better)   Microsoft (Better)   Dropbox (Standalone)
═══════════════════════════════════════════════════════════════════════════════

Framework            Better Auth       Better Auth          Custom OAuth2 + PKCE
Implementation       Social Provider   Social Provider      Manual OAuth flow
Scopes               Gmail, Calendar,  Mail, Calendar,      Full Dropbox access
                     Drive             Teams (extensive)    
PKCE                 ❌ No (Better     ❌ No (Better        ✅ Yes (code_challenge)
                     Auth handles)     Auth handles)
State Parameter      ✅ Yes (HMAC)     ✅ Yes (HMAC)        ✅ Yes (HMAC + JSON)
Refresh Tokens       ✅ Yes            ✅ Yes               ✅ Yes
Token Storage        Account table     Account table        IntegrationConnection
UI Integration       sign-in-form.tsx  sign-in-form.tsx     Standalone setup page
Callback Route       /api/auth/        /api/auth/           /api/integrations/
                     callback/google   callback/microsoft   dropbox/callback
Auto-Sync            ✅ Yes (Gmail)    ✅ Yes (Outlook)     ✅ Yes (Dropbox)
Blueprint Provision  ✅ Yes            ✅ Yes               ✅ Yes
Multi-Tenant         ✅ Yes            ✅ Yes               ✅ Yes

KEY INSIGHT:
• Google and Microsoft use Better Auth (consistent, easy to maintain)
• Dropbox uses custom OAuth2 (predates Better Auth migration)
• All three encrypt tokens and support refresh
• All three auto-provision integrations after successful auth
```

---

## Configuration Matrix

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     ENVIRONMENT CONFIGURATION MATRIX                        │
└────────────────────────────────────────────────────────────────────────────┘

Environment           Local (No Caddy)        Local (Caddy)           Production
═══════════════════════════════════════════════════════════════════════════════

App URL               localhost:3001          catalyst.localhost      agentc2.ai
Protocol              http://                 https://                https://
Redirect URI          localhost:3001/         catalyst.localhost/     agentc2.ai/
                      api/auth/callback/      api/auth/callback/      api/auth/callback/
                      google                  google                  google

NEXT_PUBLIC_APP_URL   http://localhost:3001   https://catalyst        https://agentc2.ai
                                              .localhost

BETTER_AUTH_SECRET    dev-secret-key          dev-secret-key          prod-secret-key
                      (any value)             (any value)             (secure random)

GOOGLE_CLIENT_ID      Same for all            Same for all            Same for all
                      (from Google Cloud Console OAuth credentials)

GOOGLE_CLIENT_SECRET  Same for all            Same for all            Same for all

Database              Local PostgreSQL        Local PostgreSQL        Supabase
                      (Docker) or Supabase    (Docker) or Supabase    (managed)

Caddy Enabled         ❌ No                   ✅ Yes                  ✅ Yes (systemd)
Cross-Subdomain       ❌ No                   ❌ No                   ✅ Yes
Cookies

Email Verification    ❌ Disabled             ❌ Disabled             ✅ Enabled
Required              (dev convenience)       (dev convenience)       (production)

═══════════════════════════════════════════════════════════════════════════════

REDIRECT URI REGISTRATION:
All three redirect URIs must be added to Google Cloud Console OAuth app:
• http://localhost:3001/api/auth/callback/google
• https://catalyst.localhost/api/auth/callback/google
• https://agentc2.ai/api/auth/callback/google
• https://agentc2.ai/admin/api/auth/google/callback  (admin portal)
```

---

## Feature Flags & Conditional Behavior

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    GOOGLE SSO CONDITIONAL ACTIVATION                        │
└────────────────────────────────────────────────────────────────────────────┘

Environment Variable Check:
═══════════════════════════

packages/auth/src/auth.ts (line 84-94):

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

socialProviders: {
  ...(googleClientId && googleClientSecret
    ? {
        google: { /* config */ }  ← Enabled
      }
    : {}                            ← Disabled
  )
}

═══════════════════════════════════════════════════════════════════════════

UI Conditional Rendering:
═══════════════════════════

apps/agent/src/components/auth/sign-in-form.tsx:

<Button onClick={() => handleSocialSignIn("google")}>
  Continue with Google
</Button>

→ Button ALWAYS rendered in component
→ signIn.social() will fail gracefully if provider not configured
→ Error shown to user: "Provider not available"

Better Approach (Future Enhancement):
Check if provider is enabled server-side, conditionally render button:

const enabledProviders = await auth.api.listProviders();
if (enabledProviders.includes("google")) {
  // Render Google button
}

═══════════════════════════════════════════════════════════════════════════

Admin Portal Check:
═══════════════════

apps/admin/src/app/login/page.tsx:

useEffect(() => {
  fetch("/admin/api/auth/google/enabled")
    .then(r => r.json())
    .then(data => setGoogleEnabled(data.enabled))
}, []);

{googleEnabled && (
  <button onClick={handleGoogleSignIn}>
    Sign in with Google
  </button>
)}

→ Button conditionally rendered based on API check
→ API checks: isGoogleSsoEnabled() from packages/admin-auth/src/google.ts
→ Returns true only if both client ID and secret are set

═══════════════════════════════════════════════════════════════════════════

BEST PRACTICE:
Agent app should adopt admin portal pattern (server-side provider check)
to avoid showing Google button when credentials are missing.
```

---

## Summary Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GOOGLE SSO - FULL SYSTEM OVERVIEW                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────┐
│  User          │
└───────┬────────┘
        │ Wants to sign in
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│  AgentC2 Login/Signup Page                                             │
│  • "Continue with Google" button                                       │
│  • "Continue with Microsoft" button                                    │
│  • Email/Password form                                                 │
└───────┬────────────────────────────────────────────────────────────────┘
        │ Clicks Google
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Better Auth OAuth Flow                                                 │
│  1. Generate state (CSRF token)                                        │
│  2. Redirect to Google with scopes                                     │
│  3. User grants consent                                                │
│  4. Callback with authorization code                                   │
│  5. Exchange code for tokens                                           │
└───────┬────────────────────────────────────────────────────────────────┘
        │ Success
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Database: User + Account + Session                                     │
│  • User: email, name, emailVerified=true                               │
│  • Account: providerId="google", tokens                                │
│  • Session: 30-minute expiry, auto-refresh                             │
└───────┬────────────────────────────────────────────────────────────────┘
        │ Trigger hooks
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Organization Bootstrap                                                 │
│  • Create organization (e.g., "John's Organization")                   │
│  • Create workspace (default: "Production")                            │
│  • Create membership (role: "owner")                                   │
└───────┬────────────────────────────────────────────────────────────────┘
        │ Post-bootstrap
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Integration Sync (Gmail, Calendar, Drive)                              │
│  • Copy tokens from Account to IntegrationConnection                   │
│  • Encrypt credentials (AES-256-GCM)                                   │
│  • Auto-provision agents via blueprints                                │
└───────┬────────────────────────────────────────────────────────────────┘
        │ Complete
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│  User Redirected to App                                                 │
│  • New user: /onboarding                                               │
│  • Existing user: /workspace                                           │
│  • Session cookie set (HttpOnly, Secure)                               │
└────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════
RESULT: User authenticated + Gmail/Calendar/Drive ready for agent tools
═══════════════════════════════════════════════════════════════════════════
```

---

**Document Purpose:** Visual reference for understanding Google SSO architecture  
**Intended Audience:** Engineering team, technical reviewers  
**Related Files:** See [Technical Design](./google-sso-technical-design.md) for detailed specifications
