# Technical Design: Google SSO Integration

**Feature Request:** Add SSO with Google  
**GitHub Issue:** #108  
**Priority:** Medium  
**Complexity:** Medium  
**Status:** Design Phase  
**Author:** AI Design Agent  
**Date:** 2026-03-08

---

## Executive Summary

This design document outlines the implementation of Google Single Sign-On (SSO) across the AgentC2 platform. The agent application (`apps/agent`) already has Google OAuth integrated via Better Auth, but the frontend application (`apps/frontend`) lacks Google SSO support, creating an inconsistent user experience. This design addresses that gap and provides recommendations for hardening the existing implementation.

### Key Findings

1. **Backend Infrastructure**: Google OAuth is fully configured in Better Auth with comprehensive scopes (Gmail, Calendar, Drive)
2. **Agent App**: Has complete Google SSO UI implementation in sign-in and sign-up flows
3. **Frontend App**: Only supports email/password authentication (marketing/docs site)
4. **Gap**: Frontend app needs Google SSO buttons added to match agent app UX

### Proposed Solution

**Phase 1** (Primary Scope): Add Google SSO UI to frontend app sign-in/sign-up forms  
**Phase 2** (Enhancement): Validate and document Google Cloud Console configuration  
**Phase 3** (Optional): Add account linking UI for post-signup Google connection

---

## Current State Analysis

### Authentication Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Better Auth (v1.4.17+)                   │
│  Providers: Email/Password, Google OAuth, Microsoft OAuth   │
│  Session: 30-min idle timeout, 2-min refresh                │
│  Storage: PostgreSQL (User, Session, Account tables)        │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┴───────────────────┐
        │                                       │
┌───────▼──────────┐                  ┌────────▼─────────┐
│   Agent App      │                  │  Frontend App    │
│  (port 3001)     │                  │  (port 3000)     │
│                  │                  │                  │
│  ✅ Google SSO   │                  │  ❌ Google SSO   │
│  ✅ Microsoft    │                  │  ❌ Microsoft    │
│  ✅ Email/Pass   │                  │  ✅ Email/Pass   │
└──────────────────┘                  └──────────────────┘
```

### Existing Google OAuth Configuration

**Location:** `packages/auth/src/auth.ts`

```typescript
socialProviders: {
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        accessType: "offline",        // Request refresh tokens
        prompt: "consent",             // Force consent screen
        scope: [...GOOGLE_OAUTH_SCOPES], // Gmail, Calendar, Drive
        disableImplicitSignUp: true   // Require explicit signup
    }
}
```

**Scopes Requested** (`packages/auth/src/google-scopes.ts`):
- `gmail.modify` - Full Gmail access (read, compose, send, labels)
- `calendar.events` - Calendar CRUD operations
- `drive.readonly` - Read/search Drive files
- `drive.file` - Create Google Docs

### Agent App Implementation

**Sign-In Form** (`apps/agent/src/components/auth/sign-in-form.tsx`):
```typescript
<Button onClick={() => handleSocialSignIn("google")}>
    <GoogleLogo />
    Continue with Google
</Button>
```

**Features:**
- Google logo SVG component
- Loading states during OAuth redirect
- Error handling for failed authentication
- Callback URL support for post-login redirects
- Automatic Gmail/Microsoft sync on login via `AppProvidersWrapper`

**Sign-Up Form** (`apps/agent/src/components/auth/sign-up-form.tsx`):
- Same Google OAuth button
- Invite code support (stored in sessionStorage before OAuth redirect)
- Post-signup organization bootstrapping

### Frontend App Implementation

**Sign-In Form** (`apps/frontend/src/components/auth/sign-in-form.tsx`):
- ❌ **No Google OAuth button**
- Only email/password fields
- Simple form submission

**Sign-Up Form** (`apps/frontend/src/components/auth/sign-up-form.tsx`):
- ❌ **No Google OAuth button**
- Only email/password fields

### Database Schema

**Better Auth Tables** (already configured):

```prisma
model User {
    id            String   @id @default(cuid())
    name          String
    email         String   @unique
    emailVerified Boolean  @default(false)
    image         String?
    // ... other fields
    sessions      Session[]
    accounts      Account[]
}

model Account {
    id                    String    @id @default(cuid())
    accountId             String    // Google user ID
    providerId            String    // "google"
    userId                String
    accessToken           String?
    refreshToken          String?
    idToken               String?
    accessTokenExpiresAt  DateTime?
    scope                 String?
    // ...
}
```

**Key Points:**
- Schema already supports OAuth providers via `Account` table
- `providerId` stores "google" for Google OAuth accounts
- Tokens stored for API access (Gmail, Calendar, Drive)
- No schema changes required

### Environment Variables

**Required** (`.env.example` lines 32-38):
```bash
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
```

**Redirect URIs** (must be configured in Google Cloud Console):
- Local: `http://localhost:3001/api/auth/callback/google`
- Production: `https://{domain}/api/auth/callback/google`

### OAuth Flow Architecture

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌────────────┐
│  User    │────▶│ Sign-In Form│────▶│ Better Auth  │────▶│   Google   │
│  Browser │     │  (Click SSO)│     │  /sign-in/   │     │   OAuth    │
└──────────┘     └─────────────┘     │  social      │     │   Server   │
     ▲                                └──────────────┘     └────────────┘
     │                                       │                    │
     │                                       ▼                    │
     │                                ┌──────────────┐            │
     │                                │   Callback   │◀───────────┘
     │                                │   Handler    │
     │                                │  /callback/  │
     │                                │   google     │
     │                                └──────────────┘
     │                                       │
     │                                       ▼
     │                                ┌──────────────┐
     │                                │ Bootstrap    │
     │                                │ Organization │
     │                                │   + Sync     │
     │                                └──────────────┘
     │                                       │
     └───────────────────────────────────────┘
                  Redirect to workspace
```

**Flow Steps:**
1. User clicks "Continue with Google"
2. Client calls `signIn.social({ provider: "google", scopes: [...] })`
3. Better Auth redirects to Google OAuth consent screen
4. User approves scopes
5. Google redirects to `/api/auth/callback/google`
6. Better Auth:
   - Exchanges code for tokens
   - Creates/updates User record
   - Creates Account record with tokens
   - Creates Session
7. Auth hook triggers:
   - Bootstrap organization (if new user)
   - Run post-bootstrap callbacks (Gmail sync, etc.)
8. User redirected to workspace

### Auto-Sync on Login

**Agent App Only** (`apps/agent/src/components/AppProvidersWrapper.tsx`):

```typescript
<GmailSyncOnLogin />    // Syncs Gmail on login, triggers re-auth if scopes missing
<MicrosoftSyncOnLogin />
```

**How it works:**
1. On mount, checks if user has Gmail/Calendar scopes
2. If scopes missing, calls `linkSocial({ provider: "google", scopes: [...] })`
3. Re-authenticates user with full scope set
4. Creates `IntegrationConnection` record for Gmail API access

**Frontend App**: No auto-sync (doesn't need it for marketing site)

---

## Gap Analysis

### What's Missing

| Component | Agent App | Frontend App | Impact |
|-----------|-----------|--------------|--------|
| **Google SSO Button (Sign-In)** | ✅ Implemented | ❌ Missing | High - Inconsistent UX |
| **Google SSO Button (Sign-Up)** | ✅ Implemented | ❌ Missing | High - Inconsistent UX |
| **Microsoft SSO Button** | ✅ Implemented | ❌ Missing | Medium - Out of scope |
| **Auto-Sync on Login** | ✅ Implemented | ❌ Not needed | Low - Marketing site |
| **Google Logo Component** | ✅ Implemented | ❌ Missing | High - Required for UI |
| **Microsoft Logo Component** | ✅ Implemented | ❌ Missing | Medium - Out of scope |

### Why This Matters

1. **User Experience**: Users expect consistent authentication options across all platform entry points
2. **Conversion Rate**: Social login reduces friction in the signup flow (industry avg: 20-30% higher conversion)
3. **Security**: OAuth is more secure than password-based auth (no password reuse, MFA support via Google)
4. **Brand Perception**: Modern SaaS platforms standard is to offer Google/Microsoft SSO

### Scope Clarification

**In Scope:**
- Add Google SSO button to frontend app sign-in form
- Add Google SSO button to frontend app sign-up form
- Add GoogleLogo component to frontend app
- Ensure error handling matches agent app patterns
- Test OAuth flow end-to-end on frontend app
- Validate Google Cloud Console configuration

**Out of Scope:**
- Microsoft SSO for frontend app (can be added later using same pattern)
- Auto-sync functionality for frontend app (not needed for marketing site)
- Changes to Better Auth configuration (already correct)
- Database schema changes (none required)
- Admin portal OAuth (separate system)

---

## Technical Design

### Architecture Overview

The solution requires **zero backend changes** - only frontend UI modifications. Better Auth already handles all OAuth logic including:
- Authorization URL generation
- State management (CSRF protection)
- Token exchange
- Session creation
- Account linking
- Organization bootstrapping

### Component Architecture

```
Frontend App Authentication
├── SignInForm (UPDATE)
│   ├── GoogleLogo (NEW COMPONENT)
│   ├── Google SSO Button (NEW)
│   ├── Divider (EXISTING)
│   └── Email/Password Form (EXISTING)
│
└── SignUpForm (UPDATE)
    ├── GoogleLogo (NEW COMPONENT)
    ├── Google SSO Button (NEW)
    ├── Divider (EXISTING)
    └── Email/Password Form (EXISTING)
```

### Required Changes

#### 1. Create GoogleLogo Component

**File:** `apps/frontend/src/components/auth/GoogleLogo.tsx` (NEW)

```typescript
export function GoogleLogo({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            {/* Google 4-color logo paths */}
        </svg>
    );
}
```

**Rationale:**
- Extracting to separate file for reusability
- Matches agent app pattern but as standalone component
- Can be imported and reused across multiple forms

#### 2. Update SignInForm

**File:** `apps/frontend/src/components/auth/sign-in-form.tsx` (MODIFY)

**Changes:**
1. Import `GOOGLE_OAUTH_SCOPES` from `@repo/auth/google-scopes`
2. Import `GoogleLogo` component
3. Add `socialLoading` state
4. Add `handleSocialSignIn` function (copy from agent app)
5. Add Google SSO button above email form
6. Add divider between social and email options
7. Update button disabled states to include `socialLoading`

**Key Code Addition:**
```typescript
const handleSocialSignIn = async (provider: "google") => {
    setError("");
    setSocialLoading(true);
    
    try {
        await signIn.social({
            provider,
            callbackURL: callbackUrl,
            errorCallbackURL: "/?error=auth_failed",
            scopes: [...GOOGLE_OAUTH_SCOPES]
        });
    } catch (err) {
        setError("An unexpected error occurred");
        setSocialLoading(false);
    }
};
```

**UI Structure:**
```
┌─────────────────────────────────────────┐
│  [Google Logo] Continue with Google     │  ← New
├─────────────────────────────────────────┤
│        or continue with email           │  ← New divider
├─────────────────────────────────────────┤
│  Email: [________________]              │  ← Existing
│  Password: [____________]               │
│  [Sign In]                              │
└─────────────────────────────────────────┘
```

#### 3. Update SignUpForm

**File:** `apps/frontend/src/components/auth/sign-up-form.tsx` (MODIFY)

**Changes:**
1. Import `GOOGLE_OAUTH_SCOPES` from `@repo/auth/google-scopes`
2. Import `GoogleLogo` component
3. Add `socialLoading` state
4. Add `handleSocialSignUp` function
5. Add Google SSO button above email form toggle
6. Add divider between social and email options
7. Update disabled states

**Key Difference from Agent App:**
- Frontend app doesn't have invite code requirement (public signup)
- Simpler flow without organization bootstrapping complexity on frontend

**UI Structure:**
```
┌─────────────────────────────────────────┐
│  [Google Logo] Continue with Google     │  ← New
├─────────────────────────────────────────┤
│        or continue with email           │  ← New divider
├─────────────────────────────────────────┤
│  [Sign up with email instead]           │  ← Existing toggle
│                                         │
│  (Collapsible email form below)         │
└─────────────────────────────────────────┘
```

### Integration Points

#### 1. Better Auth Configuration

**File:** `packages/auth/src/auth.ts`  
**Status:** ✅ Already configured correctly  
**No changes required**

The Google OAuth provider is conditionally enabled based on environment variables:
```typescript
socialProviders: {
    ...(googleClientId && googleClientSecret ? {
        google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            accessType: "offline",
            prompt: "consent",
            scope: [...GOOGLE_OAUTH_SCOPES],
            disableImplicitSignUp: true
        }
    } : {})
}
```

#### 2. OAuth Callback Handler

**Route:** `/api/auth/callback/google`  
**Status:** ✅ Handled by Better Auth automatically  
**No changes required**

Better Auth's catch-all route handler (`/api/auth/[...all]/route.ts`) processes OAuth callbacks.

#### 3. Organization Bootstrapping

**File:** `packages/auth/src/bootstrap.ts`  
**Status:** ✅ Already integrated via auth hooks  
**No changes required**

When a new user signs in via Google OAuth:
1. Better Auth creates User record
2. Auth hook detects new user (no Membership)
3. Calls `bootstrapUserOrganization()` with `deferOrgCreation: true`
4. User is presented with organization options (create new, join via invite, join via domain)

#### 4. Post-Bootstrap Hooks

**File:** `apps/agent/src/components/AppProvidersWrapper.tsx`  
**Status:** ✅ Agent app only (not needed for frontend)  
**No changes required**

The agent app automatically syncs Gmail/Microsoft after Google sign-in. Frontend app doesn't need this since it's a marketing site without integration features.

---

## Data Model Analysis

### Existing Schema

**No schema changes required.** Better Auth's existing tables handle Google OAuth:

**User Table:**
```prisma
model User {
    id            String   @id @default(cuid())
    name          String   // From Google profile
    email         String   @unique // From Google profile
    emailVerified Boolean  @default(false) // Auto-verified for OAuth
    image         String?  // Google profile picture URL
    // ...
    accounts      Account[]
}
```

**Account Table** (OAuth tokens):
```prisma
model Account {
    id                    String    @id @default(cuid())
    accountId             String    // Google user ID (sub claim)
    providerId            String    // "google"
    userId                String
    accessToken           String?   // Short-lived OAuth token
    refreshToken          String?   // Long-lived refresh token
    idToken               String?   // JWT ID token
    accessTokenExpiresAt  DateTime? // Token expiry
    scope                 String?   // Granted scopes
    // ...
}
```

**How It Works:**
1. First Google sign-in creates:
   - User record (if email doesn't exist)
   - Account record with `providerId: "google"`
   - Session record
2. Subsequent sign-ins:
   - Find existing User by email
   - Update Account tokens
   - Create new Session

**Email Uniqueness:** Better Auth enforces email uniqueness across all providers. If a user signs up with email/password first, they can later link Google OAuth using `linkSocial()`.

---

## API Changes

### No New API Routes Required

All OAuth functionality is handled by existing Better Auth routes:

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/auth/sign-in/social` | POST | Initiate OAuth flow | ✅ Exists |
| `/api/auth/callback/google` | GET | OAuth callback | ✅ Exists |
| `/api/auth/link-social` | POST | Link OAuth to existing account | ✅ Exists |
| `/api/auth/sign-out` | POST | Sign out | ✅ Exists |

### API Behavior Notes

**Sign-In Flow:**
```
POST /api/auth/sign-in/social
Body: { provider: "google", scopes: [...], callbackURL: "/dashboard" }
Response: Redirect to Google OAuth consent screen
```

**Callback Flow:**
```
GET /api/auth/callback/google?code=xxx&state=yyy
Response: 
  - Success: Redirect to callbackURL with session cookie
  - Error: Redirect to errorCallbackURL with error param
```

**Error Handling:**
- `disableImplicitSignUp: true` means users must sign up explicitly first
- If user clicks "Sign in with Google" but has no account, Better Auth returns error
- Frontend must handle this and redirect to signup flow

---

## Security Considerations

### OAuth Security Best Practices

✅ **Already Implemented:**
1. **PKCE (Proof Key for Code Exchange)**: Better Auth uses PKCE by default
2. **CSRF Protection**: State parameter validated on callback
3. **Token Storage**: Refresh tokens stored in database (encrypted at rest via PostgreSQL)
4. **HTTPS Only**: Production requires HTTPS (via Caddy reverse proxy)
5. **Scope Minimization**: Only requests necessary scopes
6. **Consent Enforcement**: `prompt: "consent"` forces user approval

### Additional Security Measures

#### 1. Rate Limiting

**Current Implementation** (`apps/agent/src/app/api/auth/[...all]/route.ts`):
```typescript
export const { GET, POST } = toNextJsHandler(auth, {
    rateLimit: RATE_LIMIT_POLICIES.auth
});
```

**Recommendation**: Add same rate limiting to frontend app's auth routes.

**File to Create:** `apps/frontend/src/app/(Public)/api/auth/[...all]/route.ts`

#### 2. Error Logging

**Recommendation**: Log failed OAuth attempts for security monitoring.

**Implementation:**
```typescript
hooks: {
    after: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-in/social" && ctx.context.error) {
            await emitAuthEvent({
                type: "login_failure",
                email: ctx.context.email,
                ip: ctx.context.request.headers.get("x-forwarded-for")
            });
        }
    })
}
```

#### 3. Scope Validation

**Current Implementation**: `GmailSyncOnLogin` component validates scopes post-login and triggers re-auth if missing.

**Recommendation**: Add scope validation logging to monitor partial consent issues.

### Threat Model

| Threat | Mitigation | Status |
|--------|------------|--------|
| **CSRF on OAuth callback** | State parameter validation | ✅ Better Auth default |
| **Authorization code interception** | PKCE code challenge | ✅ Better Auth default |
| **Token theft** | HTTPS only, HttpOnly cookies | ✅ Caddy + Better Auth |
| **Scope creep** | Explicit scope list, consent enforcement | ✅ Configured |
| **Account takeover** | Email uniqueness, verified email from Google | ✅ Better Auth default |
| **Session fixation** | New session on login | ✅ Better Auth default |
| **Brute force OAuth attempts** | Rate limiting on auth endpoints | ⚠️ Agent app only |

---

## Impact Assessment

### User Impact

**Positive:**
- ✅ Faster signup/login (no password to remember)
- ✅ Improved security (Google's MFA, device trust)
- ✅ Automatic email verification (Google accounts are verified)
- ✅ Profile picture from Google (better UX)
- ✅ Consistent experience across agent and frontend apps

**Neutral:**
- Users with existing email/password accounts can continue using them
- Can link Google OAuth later via account settings (using `linkSocial()`)

**Negative:**
- None expected (email/password remains available as fallback)

### System Impact

**Backend:**
- ✅ No changes required
- ✅ Database schema already supports OAuth
- ✅ Better Auth configuration already correct

**Frontend:**
- 🔄 Two component files modified (sign-in, sign-up)
- 🔄 One new component file (GoogleLogo)
- ✅ No routing changes
- ✅ No API route changes

**Performance:**
- ✅ No performance impact (OAuth redirect is async)
- ✅ Database queries unchanged (Better Auth handles all DB operations)

### Deployment Impact

**Risk Level:** **Low**

**Why:**
- Frontend-only changes (UI components)
- No breaking changes to existing auth flows
- Email/password remains functional
- Can be deployed incrementally (frontend app only)
- Easy rollback (revert component changes)

**Rollback Plan:**
1. Revert `SignInForm` and `SignUpForm` changes
2. Delete `GoogleLogo` component
3. No database rollback needed (data model unchanged)

### Compatibility

**Browser Support:**
- Google OAuth works on all modern browsers
- Better Auth client SDK supports React 19
- No polyfills required

**Mobile Support:**
- OAuth redirects work on mobile browsers
- Google's OAuth consent screen is mobile-responsive
- Session cookies work correctly on mobile

### Breaking Changes

**None.** This is purely additive functionality.

---

## Google Cloud Console Configuration

### Prerequisites

To enable Google SSO, the following must be configured in Google Cloud Console:

#### 1. Create OAuth 2.0 Credentials

**Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project (or create new project)
3. Navigate to: **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Name: "AgentC2 Production" (or "AgentC2 Development")

#### 2. Configure Authorized Redirect URIs

**Development:**
```
http://localhost:3001/api/auth/callback/google
```

**Production:**
```
https://agentc2.ai/api/auth/callback/google
https://your-production-domain.com/api/auth/callback/google
```

**Important Notes:**
- Use port 3001 for development (agent app port, where Better Auth is hosted)
- Frontend app (port 3000) redirects to agent app for auth
- Production uses single domain via Caddy reverse proxy

#### 3. Configure OAuth Consent Screen

**Required Fields:**
- App name: "AgentC2"
- User support email
- Developer contact email
- App logo (512x512 px)
- App domain: `agentc2.ai`
- Authorized domains: `agentc2.ai`, `localhost` (for dev)

**Publishing Status:**
- **Development:** "Testing" mode (max 100 test users)
- **Production:** "In Production" mode (requires verification for sensitive scopes)

#### 4. Add Scopes to Consent Screen

**Scopes to Add** (from `GOOGLE_OAUTH_SCOPES`):

| Scope | Description | Sensitivity |
|-------|-------------|-------------|
| `https://www.googleapis.com/auth/gmail.modify` | Read, compose, send, and manage email | Sensitive |
| `https://www.googleapis.com/auth/calendar.events` | Manage calendar events | Sensitive |
| `https://www.googleapis.com/auth/drive.readonly` | View Drive files | Sensitive |
| `https://www.googleapis.com/auth/drive.file` | Create and edit files | Sensitive |

**Verification Required:**
- These are **sensitive and restricted** scopes
- Requires Google OAuth verification process (can take 4-6 weeks)
- Must provide privacy policy, terms of service, demo video, and justification

**Workaround for Development:**
- Use "Testing" mode with whitelisted test users
- No verification required for testing
- Max 100 test users

#### 5. Enable Required APIs

**APIs to Enable:**
- Gmail API
- Google Calendar API
- Google Drive API

**Steps:**
1. Go to **APIs & Services → Library**
2. Search for each API
3. Click **Enable**

#### 6. Copy Credentials to .env

After creating OAuth client:
```bash
GOOGLE_CLIENT_ID="1234567890-abc123.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-abc123..."
```

### Verification Checklist

Before going live with Google SSO:

- [ ] OAuth 2.0 Client ID created
- [ ] Redirect URIs configured for all environments
- [ ] OAuth consent screen completed with all required fields
- [ ] Scopes added to consent screen
- [ ] Gmail API, Calendar API, Drive API enabled
- [ ] Credentials added to `.env` file
- [ ] Verification submitted (for production with sensitive scopes)
- [ ] Privacy policy and terms of service published at public URLs
- [ ] Test with real Google account

---

## Implementation Plan

### Phase 1: Frontend App Google SSO UI (Primary Scope)

**Duration Estimate:** Small implementation (2-4 hours)  
**Priority:** High  
**Risk:** Low

#### Tasks:

1. **Create GoogleLogo Component**
   - File: `apps/frontend/src/components/auth/GoogleLogo.tsx`
   - Copy SVG from agent app's sign-in form
   - Export as standalone component
   - Test rendering in Storybook

2. **Update SignInForm Component**
   - File: `apps/frontend/src/components/auth/sign-in-form.tsx`
   - Add imports: `GOOGLE_OAUTH_SCOPES`, `GoogleLogo`
   - Add `socialLoading` state
   - Add `handleSocialSignIn` function
   - Add Google SSO button with logo
   - Add divider ("or continue with email")
   - Update button disabled logic
   - Test error handling

3. **Update SignUpForm Component**
   - File: `apps/frontend/src/components/auth/sign-up-form.tsx`
   - Add imports: `GOOGLE_OAUTH_SCOPES`, `GoogleLogo`
   - Add `socialLoading` state
   - Add `handleSocialSignUp` function
   - Add Google SSO button with logo
   - Add divider
   - Update button disabled logic
   - Test error handling

4. **Update AppProvidersWrapper (Optional)**
   - File: `apps/frontend/src/components/AppProvidersWrapper.tsx`
   - Consider adding `GmailSyncOnLogin` if frontend app needs Gmail access
   - **Recommendation:** Skip this for frontend app (marketing site doesn't need Gmail integration)

5. **Testing**
   - Test Google OAuth flow on frontend app locally
   - Verify session cookies work across both apps (via Caddy)
   - Test error cases:
     - User cancels OAuth consent
     - User with no account tries to sign in (should redirect to signup)
     - Network errors during OAuth flow
   - Test existing email/password flow still works
   - Test on mobile browsers

6. **Documentation**
   - Update `.env.example` comments if needed
   - Update README with Google OAuth setup instructions
   - Document Google Cloud Console configuration steps

#### Success Criteria:

- [ ] Frontend app sign-in page shows "Continue with Google" button
- [ ] Frontend app sign-up page shows "Continue with Google" button
- [ ] Clicking Google button redirects to Google OAuth consent screen
- [ ] After approval, user is signed in and redirected to `/dashboard`
- [ ] New Google users get User and Account records created
- [ ] Existing Google users can sign in successfully
- [ ] Email/password auth still works
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] `bun run build` succeeds

---

### Phase 2: Configuration Validation & Documentation (Enhancement)

**Duration Estimate:** Small (1-2 hours)  
**Priority:** Medium  
**Risk:** Low

#### Tasks:

1. **Validate Environment Variables**
   - Check if `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
   - Add runtime validation in auth configuration
   - Log warning if Google OAuth is not configured

2. **Google Cloud Console Checklist**
   - Create Google Cloud Console setup guide
   - Document OAuth consent screen requirements
   - Document scope verification process
   - Add troubleshooting guide for common errors

3. **Add Better Auth Rate Limiting to Frontend**
   - File: `apps/frontend/src/app/(Public)/api/auth/[...all]/route.ts`
   - Add rate limiting to match agent app
   - Prevents brute force attacks on frontend auth endpoint

4. **Environment Variable Documentation**
   - Update `.env.example` with detailed Google OAuth comments
   - Add redirect URI examples for different environments
   - Document scope justification for Google verification

5. **Testing Checklist Document**
   - Create QA checklist for Google OAuth testing
   - Include test cases for new users, existing users, errors
   - Add browser compatibility matrix

#### Success Criteria:

- [ ] Comprehensive Google Cloud Console setup guide in docs
- [ ] Environment variable validation added
- [ ] Rate limiting added to frontend auth routes
- [ ] Troubleshooting guide for common OAuth errors
- [ ] Testing checklist completed

---

### Phase 3: Account Linking UI (Optional Enhancement)

**Duration Estimate:** Medium (4-8 hours)  
**Priority:** Low  
**Risk:** Low

**Purpose:** Allow users who signed up with email/password to link their Google account later.

#### Tasks:

1. **Account Settings Page**
   - File: `apps/frontend/src/app/(Authenticated)/settings/account/page.tsx` (or similar)
   - Show connected accounts (email/password, Google, Microsoft)
   - Add "Connect Google" button for users without Google linked
   - Add "Disconnect Google" button for users with Google linked

2. **Link Social Action**
   - Use `authClient.linkSocial()` method
   - Redirect back to settings page after linking
   - Show success/error toast

3. **Unlink Social Action**
   - Use Better Auth's unlink social endpoint
   - Confirm before unlinking (prevent accidental lockout)
   - Ensure user has at least one auth method remaining

4. **UI Components**
   - Connected account card (shows provider logo + email)
   - Connection status indicator (connected, disconnected, error)
   - Re-auth button if scopes missing

#### Success Criteria:

- [ ] Users can link Google to existing email/password accounts
- [ ] Users can unlink Google (if they have another auth method)
- [ ] UI clearly shows connected accounts
- [ ] Re-auth flow works if scopes are missing

---

### Phase 4: Microsoft SSO (Future Enhancement)

**Scope:** Out of scope for this issue, but follows identical pattern.

**To implement:**
1. Copy Google SSO implementation
2. Replace `"google"` with `"microsoft"`
3. Replace `GOOGLE_OAUTH_SCOPES` with `MICROSOFT_OAUTH_SCOPES`
4. Use `MicrosoftLogo` component instead of `GoogleLogo`

**Files to modify:**
- `apps/frontend/src/components/auth/sign-in-form.tsx`
- `apps/frontend/src/components/auth/sign-up-form.tsx`
- Create `apps/frontend/src/components/auth/MicrosoftLogo.tsx`

---

## Code Quality Standards

### Pre-Commit Checklist

Before pushing any code:

```bash
# 1. Format code
bun run format

# 2. Run linting
bun run lint

# 3. Type check
bun run type-check

# 4. Build all apps
bun run build

# 5. Review changes
git diff
```

### Testing Requirements

**Unit Tests:** Not required (UI components, Better Auth handles logic)

**Integration Tests:** Manual testing required for OAuth flow

**Test Cases:**

1. **Happy Path - New User:**
   - Click "Continue with Google"
   - Approve all scopes
   - Redirected to onboarding/dashboard
   - User and Account records created
   - Session cookie set

2. **Happy Path - Existing User:**
   - User with email/password account
   - Click "Continue with Google" (same email)
   - Google OAuth links to existing user
   - Redirected to workspace
   - Account record created with `providerId: "google"`

3. **Error Case - User Cancels:**
   - Click "Continue with Google"
   - Click "Cancel" on Google consent screen
   - Redirected back with error message
   - No User or Account created

4. **Error Case - Partial Consent:**
   - User approves only some scopes
   - Sign-in succeeds (Better Auth doesn't validate scopes)
   - Agent app's `GmailSyncOnLogin` detects missing scopes
   - Triggers re-auth flow with full scope set

5. **Error Case - Network Failure:**
   - Click "Continue with Google"
   - Network interruption during OAuth flow
   - Error message displayed
   - User can retry

6. **Email Mismatch:**
   - User A signs up with email/password (alice@example.com)
   - User A tries "Sign in with Google" using different Google account (bob@example.com)
   - Better Auth creates new user for bob@example.com
   - Alice's original account remains separate

### Styling Consistency

**shadcn/ui Base-Nova Theme:**
- Button variant: `outline`
- Button size: `lg`
- Gap: `gap-3` between icon and text
- Border: `border-slate-200` (light), `dark:border-slate-700` (dark)
- Hover: `hover:border-slate-300 hover:bg-slate-50`
- Shadow: `shadow-sm`
- Padding: `py-5` (larger touch target)

**Copy from Agent App:**
The frontend forms should match the agent app's styling exactly for consistency.

---

## Risks & Mitigations

### Risk 1: Google OAuth Not Configured

**Risk:** Environment variables `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` not set.

**Impact:** Google SSO button appears but fails on click.

**Probability:** Medium (depends on deployment environment)

**Mitigation:**
1. Add runtime check in Better Auth config
2. Conditionally render Google button only if credentials configured
3. Log warning if credentials missing

**Code:**
```typescript
const isGoogleConfigured = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

// In component:
{isGoogleConfigured && (
    <Button onClick={() => handleSocialSignIn("google")}>
        Continue with Google
    </Button>
)}
```

### Risk 2: Scope Verification Delay

**Risk:** Google's OAuth verification process for sensitive scopes (Gmail, Calendar, Drive) can take 4-6 weeks.

**Impact:** Production app can only have 100 test users until verified.

**Probability:** High (if not already verified)

**Mitigation:**
1. Check if current Google OAuth app is already verified
2. If not, submit verification immediately (parallel to implementation)
3. For development, use "Testing" mode with whitelisted emails
4. Document scope justification clearly for Google reviewers

**Verification Requirements:**
- Privacy policy (must be publicly accessible)
- Terms of service (must be publicly accessible)
- Demo video showing how scopes are used
- Homepage with clear app description
- Justification for each scope

### Risk 3: Email Uniqueness Conflicts

**Risk:** User signs up with email/password, later tries to sign in with Google using same email.

**Impact:** Better Auth automatically links accounts, which may be unexpected.

**Probability:** Low (Better Auth handles this correctly)

**Mitigation:**
- Document behavior in user-facing help docs
- Add account linking section to settings page (Phase 3)
- Better Auth enforces email uniqueness correctly

### Risk 4: Session Cookie Issues

**Risk:** Cookies not shared between frontend and agent apps.

**Impact:** User signs in on frontend but not authenticated on agent app.

**Probability:** Very Low (Caddy handles this)

**Mitigation:**
- Ensure both apps use same `NEXT_PUBLIC_APP_URL` in production
- Verify `crossSubDomainCookies: { enabled: true }` in production
- Test cookie sharing via Caddy locally before deploying

### Risk 5: Scope Revocation

**Risk:** User revokes Gmail/Calendar scopes from Google account settings after sign-up.

**Impact:** Agent features requiring Gmail/Calendar fail silently.

**Probability:** Low (most users don't manage app permissions)

**Mitigation:**
- Agent app's `GmailSyncOnLogin` already handles this
- Detects missing scopes and triggers re-auth
- Frontend app doesn't need Gmail access, so unaffected

---

## Testing Strategy

### Local Development Testing

#### Setup:

1. **Ensure Caddy is running:**
   ```bash
   bun run dev
   ```

2. **Configure Google OAuth credentials:**
   - Use development OAuth client from Google Cloud Console
   - Set redirect URI: `http://localhost:3001/api/auth/callback/google`
   - Add test user emails to Testing users list

3. **Set environment variables:**
   ```bash
   GOOGLE_CLIENT_ID="1234567890-abc.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="GOCSPX-abc..."
   NEXT_PUBLIC_APP_URL="https://catalyst.localhost"
   ```

#### Test Scenarios:

**Scenario 1: New User Sign-Up via Google (Frontend App)**

1. Navigate to `https://catalyst.localhost/signup`
2. Click "Continue with Google"
3. Approve all scopes on Google consent screen
4. Verify redirect to `/dashboard`
5. Check database:
   ```sql
   SELECT * FROM "user" WHERE email = 'test@example.com';
   SELECT * FROM "account" WHERE "providerId" = 'google';
   SELECT * FROM "session" WHERE "userId" = '{user_id}';
   ```
6. Verify session cookie set in browser DevTools
7. Verify user profile picture from Google appears in UI

**Scenario 2: Existing User Sign-In via Google (Frontend App)**

1. Create user via email/password: `https://catalyst.localhost/signup`
2. Sign out
3. Navigate to `https://catalyst.localhost` (home page with sign-in form)
4. Click "Continue with Google" (use same email as step 1)
5. Verify redirect to `/dashboard`
6. Check database - Account record created with `providerId: "google"`

**Scenario 3: Cross-App Session Sharing**

1. Sign in via Google on frontend app: `https://catalyst.localhost/signup`
2. Navigate to agent app: `https://catalyst.localhost/agent/workspace`
3. Verify user is authenticated (no login prompt)
4. Check cookies - `better-auth.session_token` domain should be `.catalyst.localhost`

**Scenario 4: Error Handling**

1. Click "Continue with Google"
2. Cancel on Google consent screen
3. Verify error message appears
4. Verify user can retry

**Scenario 5: Missing Environment Variables**

1. Unset `GOOGLE_CLIENT_ID` in `.env`
2. Restart dev server
3. Verify Google button doesn't appear OR shows disabled state
4. Verify email/password form still works

### Staging Environment Testing

1. Deploy to staging with production-like Google OAuth configuration
2. Test with real domain (not localhost)
3. Verify HTTPS redirect URIs work
4. Test cross-app cookie sharing with production Caddy config
5. Load test: simulate 50+ concurrent Google sign-ins

### Production Smoke Tests

**After Deployment:**

1. Sign up new user via Google SSO
2. Sign in existing user via Google SSO
3. Check logs for errors
4. Monitor Better Auth session metrics
5. Verify Gmail sync triggers correctly (agent app)

---

## Deployment Plan

### Pre-Deployment Checklist

- [ ] Google Cloud Console OAuth client configured for production domain
- [ ] Redirect URIs updated with production URL
- [ ] Environment variables set in production `.env`
- [ ] Google OAuth verification completed (or testing mode with whitelisted users)
- [ ] Privacy policy and terms of service published
- [ ] All tests pass locally
- [ ] Code review completed
- [ ] `bun run build` succeeds

### Deployment Steps

**Step 1: Deploy Code Changes**

```bash
# Via GitHub Actions (automatic on push to main)
git push origin main

# Or manual deploy:
ssh user@production-server
cd /var/www/agentc2
git pull origin main
bun install
bun run db:generate
bun run build
pm2 restart frontend
```

**Step 2: Verify Deployment**

1. Check frontend app is running: `pm2 status`
2. Check logs: `pm2 logs frontend --lines 50`
3. Test production URL: `https://agentc2.ai/signup`
4. Verify Google SSO button appears

**Step 3: Smoke Test**

1. Sign up new test user via Google SSO
2. Sign out
3. Sign in via Google SSO
4. Verify redirect to dashboard
5. Check database records created correctly

**Step 4: Monitor**

1. Check error logs for OAuth failures
2. Monitor Better Auth session metrics
3. Monitor Google OAuth API quota usage
4. Set up alerts for authentication errors

### Rollback Plan

**If issues detected:**

```bash
# 1. Revert git commit
git revert HEAD

# 2. Rebuild and restart
bun run build
pm2 restart frontend

# 3. Verify email/password auth works
# (No database rollback needed - schema unchanged)
```

**Rollback Time:** < 5 minutes  
**Risk:** Very Low (frontend-only changes)

---

## Monitoring & Observability

### Metrics to Track

**Authentication Metrics:**
- Google OAuth sign-in success rate
- Google OAuth sign-up success rate
- OAuth flow abandonment rate (started but not completed)
- Email/password vs OAuth ratio
- Time to complete OAuth flow

**Error Metrics:**
- OAuth callback errors (by error type)
- Missing scope errors
- Token refresh failures
- Account linking conflicts

**Business Metrics:**
- Conversion rate improvement (email/password vs Google SSO)
- User activation rate (Google users vs email users)
- Average time to first agent created

### Logging Strategy

**Events to Log:**

```typescript
// Sign-in initiated
{
    event: "oauth.signin.initiated",
    provider: "google",
    userId: null,  // Not yet authenticated
    timestamp: "2026-03-08T10:30:00Z"
}

// Sign-in completed
{
    event: "oauth.signin.completed",
    provider: "google",
    userId: "user_123",
    email: "user@example.com",
    isNewUser: false,
    timestamp: "2026-03-08T10:30:15Z"
}

// Sign-in failed
{
    event: "oauth.signin.failed",
    provider: "google",
    error: "user_cancelled",
    timestamp: "2026-03-08T10:30:10Z"
}
```

**Implementation:** Use Better Auth's `onAuthEvent()` hook registry (already in `packages/auth/src/auth.ts`).

### Dashboard Recommendations

**Metrics Dashboard:**
- OAuth success rate by provider (Google, Microsoft, email/password)
- Daily active users by authentication method
- OAuth error breakdown (user cancelled, network error, scope missing, etc.)
- Average session duration by auth method

**Tools:**
- Use existing logging infrastructure
- Store metrics in PostgreSQL or external analytics service
- Build admin dashboard in agent app for monitoring

---

## Security Hardening (Recommendations)

### 1. Rate Limiting on Frontend Auth Routes

**Current State:** Agent app has rate limiting, frontend app does not.

**Recommendation:** Add rate limiting to frontend auth routes.

**File:** `apps/frontend/src/app/(Public)/api/auth/[...all]/route.ts`

```typescript
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@repo/auth";
import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit";

export const { GET, POST } = toNextJsHandler(auth, {
    rateLimit: RATE_LIMIT_POLICIES.auth
});
```

### 2. OAuth Callback URL Validation

**Current State:** Better Auth validates callback URLs against `trustedOrigins`.

**Recommendation:** Add explicit validation for production domains.

**Implementation:**
```typescript
trustedOrigins: [
    "https://agentc2.ai",
    "https://www.agentc2.ai",
    ...(isDevelopment ? ["http://localhost:3000", "http://localhost:3001"] : [])
]
```

### 3. Scope Change Detection

**Current State:** Agent app's `GmailSyncOnLogin` detects missing scopes.

**Recommendation:** Add audit logging when scopes change between sign-ins.

**Use Case:** Detect if Google revokes scopes or user modifies permissions.

### 4. Account Takeover Prevention

**Current State:** Better Auth links OAuth to existing account if email matches.

**Risk:** If attacker gains access to user's Google account, they can access AgentC2.

**Mitigation:**
- Better Auth requires email verification from Google (already enabled)
- Google enforces MFA and device trust
- Add 2FA requirement for sensitive operations (already available via twoFactor plugin)
- Consider requiring email re-verification for account linking

### 5. Token Encryption

**Current State:** OAuth tokens stored in PostgreSQL `Account` table.

**Question:** Are tokens encrypted at rest in the Account table?

**Recommendation:** Verify Better Auth encrypts tokens using `BETTER_AUTH_SECRET`. If not, consider migrating to `IntegrationConnection` table pattern which uses AES-256-GCM encryption.

---

## Integration Points with Existing Systems

### 1. Organization Bootstrapping

**Component:** `packages/auth/src/bootstrap.ts`  
**Triggered:** After first Google OAuth sign-in (new user)

**Flow:**
```
Google OAuth Success
    ↓
Better Auth creates User + Account
    ↓
Auth hook detects no Membership
    ↓
bootstrapUserOrganization() called with deferOrgCreation: true
    ↓
User prompted to:
    - Enter invite code → Join existing org
    - Match domain → Suggested org (e.g., @company.com coworkers)
    - Create new org → Becomes owner
```

**Impact:** Frontend app needs to handle the post-signup flow for organization selection.

**Recommendation:** 
- Frontend app should redirect to `/onboarding` after Google sign-up
- Onboarding flow prompts for invite code or org creation
- Matches agent app behavior

### 2. Gmail/Calendar Auto-Sync

**Component:** `apps/agent/src/components/AppProvidersWrapper.tsx`  
**Triggered:** After Google sign-in on agent app

**Flow:**
```
User signs in with Google
    ↓
GmailSyncOnLogin component mounts
    ↓
Calls /api/integrations/gmail/sync
    ↓
If missing scopes → linkSocial() re-auth
    ↓
If successful → Creates IntegrationConnection for Gmail
    ↓
Triggers sibling service sync (Calendar, Drive)
```

**Impact:** Frontend app does NOT need this (marketing site, no integrations).

**Recommendation:** Keep auto-sync in agent app only. Frontend users will go through auto-sync when they first access agent app after signing up on frontend.

### 3. Post-Bootstrap Hooks

**Component:** `packages/auth/src/auth.ts` (line 184-196)  
**Purpose:** Run custom logic after org creation (e.g., send welcome email, provision default agents)

**Current Hooks:**
- Gmail sync (registered in `apps/agent/instrumentation.ts`)

**Recommendation:** 
- Add hook for sending welcome email on first Google sign-up
- Add hook for analytics event tracking (new user via Google OAuth)

### 4. Account Linking

**Component:** `authClient.linkSocial()` method  
**Use Case:** User with email/password wants to add Google OAuth

**Impact:** Frontend app should provide account settings page (Phase 3).

**Current State:** 
- Agent app doesn't have UI for this either
- Better Auth supports it programmatically

**Recommendation:** Phase 3 task to add account settings page to both apps.

---

## Documentation Requirements

### User-Facing Documentation

**1. Help Center Article: "Signing in with Google"**

Topics:
- How to sign up with Google
- How to sign in with Google
- What scopes are requested and why
- How to link Google to existing account
- How to unlink Google account
- Troubleshooting common errors

**2. Privacy Policy Update**

Add section:
- "OAuth Providers: We use Google OAuth for authentication. We store your email, name, and profile picture from Google. We request access to Gmail, Calendar, and Drive APIs to provide agent integration features. You can revoke access at any time via Google account settings."

**3. Terms of Service Update**

Add section:
- User responsibilities when using OAuth
- Acceptable use of integrated Google services

### Developer Documentation

**1. Setup Guide: Google OAuth Configuration**

Topics:
- Creating Google Cloud Console project
- Configuring OAuth consent screen
- Adding redirect URIs
- Requesting scope verification
- Setting environment variables

**2. Troubleshooting Guide**

Common errors:
- `redirect_uri_mismatch` - Redirect URI not configured
- `invalid_client` - Client ID/secret incorrect
- `access_denied` - User cancelled OAuth flow
- `insufficient_permissions` - Scopes not granted

**3. Architecture Diagram**

Visual showing:
- Better Auth flow
- Google OAuth integration
- Frontend vs Agent app authentication
- Session cookie sharing via Caddy

---

## Alternative Approaches Considered

### Alternative 1: Separate OAuth Implementation

**Approach:** Implement Google OAuth directly in frontend app without using Better Auth.

**Pros:**
- Independent from Better Auth
- More control over OAuth flow

**Cons:**
- ❌ Duplicates existing Better Auth logic
- ❌ Increases maintenance burden
- ❌ Breaks session sharing between apps
- ❌ Requires separate database tables
- ❌ No benefit over Better Auth approach

**Decision:** ❌ Rejected - Better Auth provides all needed functionality.

---

### Alternative 2: Redirect Frontend to Agent for Auth

**Approach:** Frontend app's sign-in/sign-up buttons redirect to agent app auth pages.

**Pros:**
- Zero code changes to frontend app
- Centralized auth UI in one place

**Cons:**
- ❌ Poor UX (extra redirect, user leaves frontend app)
- ❌ Confusing for users (URL changes to /agent)
- ❌ Doesn't solve the core UX problem

**Decision:** ❌ Rejected - UX is critical for conversion.

---

### Alternative 3: Embedded Agent App Auth via iframe

**Approach:** Frontend app embeds agent app's auth pages in an iframe.

**Pros:**
- Reuses agent app components

**Cons:**
- ❌ Poor UX (iframe scrolling, mobile issues)
- ❌ OAuth doesn't work in iframes (same-origin policy)
- ❌ Session cookies may not work across iframe boundary
- ❌ Accessibility issues

**Decision:** ❌ Rejected - OAuth in iframes is not supported by most providers.

---

### Alternative 4: Shared Auth Component Package

**Approach:** Extract sign-in/sign-up forms to `@repo/auth` package as shared components.

**Pros:**
- ✅ DRY - single source of truth for auth UI
- ✅ Consistent UX across all apps
- ✅ Easier to maintain

**Cons:**
- ⚠️ Requires refactoring both apps
- ⚠️ May break existing customizations
- ⚠️ Increases complexity of auth package

**Decision:** 🟡 Recommended for Phase 4 (future refactoring) - Not required for initial implementation, but good long-term architecture.

---

## Recommended Approach (Selected)

### Copy Agent App Pattern to Frontend App

**Approach:** Copy Google SSO implementation from agent app to frontend app.

**Pros:**
- ✅ Minimal code changes
- ✅ Proven pattern (agent app works)
- ✅ Low risk (no backend changes)
- ✅ Fast implementation (2-4 hours)
- ✅ Easy to test and rollback
- ✅ Maintains consistency with agent app

**Cons:**
- ⚠️ Code duplication (can be refactored later)

**Decision:** ✅ **Selected** - Best balance of speed, risk, and maintainability.

---

## Success Metrics

### Launch Metrics (Week 1)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Google OAuth Success Rate** | > 95% | (Successful sign-ins / Total attempts) |
| **Frontend Google Sign-Ups** | > 0 | Count of new users via Google on frontend |
| **Zero Critical Errors** | 0 | No 500 errors in auth endpoints |
| **Email/Password Unaffected** | No change | Existing auth method still works |

### Growth Metrics (Month 1)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Google OAuth Adoption** | > 40% of new signups | (Google signups / Total signups) |
| **Conversion Rate Improvement** | +15-25% | Compare signup completion rate before/after |
| **Reduced Password Resets** | -30% | Fewer password reset requests |
| **Faster Signup Time** | -50% | Time from landing page to first workspace access |

### Quality Metrics (Ongoing)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **OAuth Token Refresh Success** | > 99% | Refresh attempts that succeed |
| **Session Cookie Sharing** | 100% | Users authenticated on both apps after single login |
| **Scope Grant Rate** | > 90% | Users who approve all requested scopes |

---

## Dependencies

### External Dependencies

| Dependency | Version | Purpose | Status |
|------------|---------|---------|--------|
| `better-auth` | 1.4.17+ | OAuth provider management | ✅ Installed |
| `better-auth/react` | 1.4.17+ | Client-side auth methods | ✅ Installed |
| Google APIs | N/A | Gmail, Calendar, Drive APIs | ✅ Enabled |

### Environment Dependencies

| Variable | Required | Purpose | Status |
|----------|----------|---------|--------|
| `GOOGLE_CLIENT_ID` | Yes | OAuth client ID | ⚠️ Must verify |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth client secret | ⚠️ Must verify |
| `BETTER_AUTH_SECRET` | Yes | Session encryption | ✅ Configured |
| `NEXT_PUBLIC_APP_URL` | Yes | OAuth redirect base | ✅ Configured |

### Google Cloud Platform Configuration

| Item | Status | Action Needed |
|------|--------|---------------|
| OAuth 2.0 Client ID | ⚠️ Unknown | Verify exists |
| Redirect URIs | ⚠️ Unknown | Add frontend URLs |
| OAuth Consent Screen | ⚠️ Unknown | Complete if missing |
| Scopes Added | ⚠️ Unknown | Add Gmail/Calendar/Drive |
| Verification Status | ⚠️ Unknown | Submit if sensitive scopes |
| APIs Enabled | ⚠️ Unknown | Enable Gmail, Calendar, Drive |

---

## Open Questions & Decisions Needed

### Question 1: Is Google OAuth Already Configured?

**Question:** Are `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` already set in production environment?

**If Yes:**
- ✅ Proceed with implementation immediately
- ✅ Test on staging first
- ✅ Deploy to production

**If No:**
- ⚠️ Must create Google Cloud Console project first
- ⚠️ Must configure OAuth consent screen
- ⚠️ Must submit for verification (if using sensitive scopes)
- ⚠️ Implementation blocked until credentials available

**Action Required:** Check production `.env` file or ask platform administrator.

---

### Question 2: OAuth Verification Status

**Question:** Has the Google OAuth app already been verified for sensitive scopes?

**Why It Matters:**
- Unverified apps limited to 100 test users
- Verification process takes 4-6 weeks
- Affects production launch timeline

**If Verified:**
- ✅ Production launch can proceed immediately
- ✅ No user limits

**If Not Verified:**
- ⚠️ Must submit verification before public launch
- ⚠️ Can use "Testing" mode with whitelisted users in meantime
- ⚠️ Affects rollout strategy

**Action Required:** Check Google Cloud Console OAuth verification status.

---

### Question 3: Frontend App Purpose

**Question:** What is the primary purpose of the frontend app vs agent app?

**Current Understanding:**
- Frontend app: Marketing, docs, public landing pages
- Agent app: Main application, workspace, agent management

**Implications:**
- If frontend is marketing only, Google SSO may not be critical priority
- If frontend is alternative entry point to platform, Google SSO is high priority

**Recommendation:** Clarify frontend app's role in overall product strategy.

---

### Question 4: Should We Add Microsoft SSO Too?

**Question:** Agent app has both Google and Microsoft SSO. Should frontend app match?

**Pros of Adding Microsoft:**
- ✅ Consistent with agent app
- ✅ Broader user base (enterprise users)
- ✅ Already configured in Better Auth

**Cons:**
- ⏱️ Adds implementation time (but minimal - same pattern)
- 🎨 UI becomes more crowded with 3 social buttons

**Recommendation:** 
- **Phase 1:** Add Google SSO only (as requested)
- **Phase 2:** Add Microsoft SSO if user feedback requests it
- **Or:** Add both simultaneously (only adds 30 minutes of work)

**Action Required:** Decide if Microsoft should be included in initial implementation.

---

### Question 5: Auto-Sync for Frontend App?

**Question:** Should frontend app auto-sync Gmail/Calendar like agent app does?

**Current State:**
- Agent app: `GmailSyncOnLogin` triggers after Google sign-in
- Frontend app: No auto-sync

**Recommendation:** **No, frontend app doesn't need auto-sync.**

**Rationale:**
- Frontend is marketing site, not a tool that uses Gmail API
- When user navigates to agent app (`/agent/workspace`), agent app's auto-sync will trigger
- Avoids unnecessary API calls from frontend app

---

## Phased Implementation Roadmap

### Phase 1: Core Google SSO UI (Immediate)

**Scope:** Add Google SSO buttons to frontend app  
**Effort:** Small (2-4 hours)  
**Risk:** Low  
**Deliverables:**

- [ ] GoogleLogo component created in frontend app
- [ ] Google SSO button added to SignInForm
- [ ] Google SSO button added to SignUpForm
- [ ] Error handling implemented
- [ ] Loading states implemented
- [ ] Local testing completed
- [ ] Code reviewed and merged

**Validation:**
- User can sign up via Google on frontend app
- User can sign in via Google on frontend app
- Session works across frontend and agent apps
- Email/password auth still works

---

### Phase 2: Configuration & Documentation (Follow-Up)

**Scope:** Validate Google Cloud setup and document  
**Effort:** Small (1-2 hours)  
**Risk:** Low  
**Deliverables:**

- [ ] Google Cloud Console configuration validated
- [ ] Redirect URIs confirmed for all environments
- [ ] OAuth consent screen complete
- [ ] Scope verification status confirmed
- [ ] Developer setup guide written
- [ ] User help documentation written
- [ ] Rate limiting added to frontend auth routes

**Validation:**
- Google OAuth works in all environments (local, staging, production)
- Documentation is clear and complete
- New developers can set up Google OAuth from docs alone

---

### Phase 3: Account Linking UI (Optional Enhancement)

**Scope:** Allow users to link/unlink Google accounts post-signup  
**Effort:** Medium (4-8 hours)  
**Risk:** Low  
**Deliverables:**

- [ ] Account settings page created (or updated)
- [ ] "Connect Google" button added
- [ ] "Disconnect Google" button added (with safeguards)
- [ ] Connected accounts list UI
- [ ] Re-auth flow for missing scopes
- [ ] Success/error notifications

**Validation:**
- User with email/password can link Google
- User with Google can unlink (if email/password exists)
- UI shows current connection status clearly
- Re-auth works if scopes missing

---

### Phase 4: Code Consolidation (Future Refactoring)

**Scope:** Extract auth forms to shared package  
**Effort:** Medium (4-8 hours)  
**Risk:** Medium (refactoring risk)  
**Deliverables:**

- [ ] Create `packages/auth/components/` directory
- [ ] Extract SignInForm to `@repo/auth/components`
- [ ] Extract SignUpForm to `@repo/auth/components`
- [ ] Extract GoogleLogo to `@repo/auth/components`
- [ ] Extract MicrosoftLogo to `@repo/auth/components`
- [ ] Update agent and frontend apps to import from shared package
- [ ] Remove duplicate code

**Benefits:**
- Single source of truth for auth UI
- Easier maintenance
- Automatic consistency across apps

**Risks:**
- May break app-specific customizations
- Requires careful testing of both apps
- Increases coupling between apps and auth package

**Recommendation:** Do this after Phase 1-3 are stable and validated in production.

---

## Implementation Checklist

### Pre-Implementation

- [ ] Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` exist in `.env`
- [ ] Verify Better Auth Google OAuth configuration is correct
- [ ] Check Google Cloud Console redirect URIs include frontend app
- [ ] Review agent app implementation as reference
- [ ] Create implementation plan in GitHub issue

### Implementation

**Frontend App UI Changes:**

- [ ] Create `apps/frontend/src/components/auth/GoogleLogo.tsx`
  - Copy SVG from agent app
  - Export as standalone component
  
- [ ] Update `apps/frontend/src/components/auth/sign-in-form.tsx`
  - Import `GOOGLE_OAUTH_SCOPES`
  - Import `GoogleLogo`
  - Add `socialLoading` state
  - Add `handleSocialSignIn` function
  - Add Google SSO button above email form
  - Add divider with "or continue with email" text
  - Update disabled states to include `socialLoading`
  
- [ ] Update `apps/frontend/src/components/auth/sign-up-form.tsx`
  - Import `GOOGLE_OAUTH_SCOPES`
  - Import `GoogleLogo`
  - Add `socialLoading` state
  - Add `handleSocialSignUp` function
  - Add Google SSO button above email form toggle
  - Add divider
  - Update disabled states

**Configuration & Documentation:**

- [ ] Add rate limiting to frontend auth routes (optional but recommended)
- [ ] Document Google Cloud Console setup steps
- [ ] Update `.env.example` with detailed Google OAuth comments
- [ ] Create troubleshooting guide for OAuth errors

### Testing

- [ ] **Local Testing (Development)**
  - [ ] Start dev environment with `bun run dev`
  - [ ] Test Google sign-up on frontend app
  - [ ] Test Google sign-in on frontend app
  - [ ] Verify session works on agent app after frontend login
  - [ ] Test error cases (cancel OAuth, network error)
  - [ ] Test email/password still works
  - [ ] Test on Chrome, Firefox, Safari
  - [ ] Test on mobile browser

- [ ] **Code Quality**
  - [ ] Run `bun run format`
  - [ ] Run `bun run lint`
  - [ ] Run `bun run type-check`
  - [ ] Run `bun run build`
  - [ ] No TypeScript errors
  - [ ] No ESLint errors

- [ ] **Database Validation**
  - [ ] User record created with Google email
  - [ ] Account record created with `providerId: "google"`
  - [ ] Session record created
  - [ ] Membership and Organization created (via bootstrap)

### Deployment

- [ ] Code reviewed by team
- [ ] Merged to main branch
- [ ] Deployed to staging environment
- [ ] Smoke tested on staging
- [ ] Deployed to production
- [ ] Smoke tested on production

### Post-Deployment

- [ ] Monitor auth error logs for first 24 hours
- [ ] Track Google OAuth success rate
- [ ] Verify no regression in email/password auth
- [ ] Update status in GitHub issue #108
- [ ] Collect user feedback

---

## Cost Analysis

### Implementation Cost

**Development Time:**
- Phase 1 (Core UI): 2-4 hours
- Phase 2 (Docs): 1-2 hours
- Phase 3 (Account Linking): 4-8 hours
- **Total:** 7-14 hours

**No Additional Infrastructure Costs:**
- Google OAuth is free for authentication use
- Gmail/Calendar/Drive API quotas are generous (free tier: 1 billion requests/day for Gmail)
- No new cloud services required
- No database costs (schema unchanged)

### Operational Cost

**Ongoing:**
- Zero additional cost (Better Auth handles OAuth)
- Google API quota monitoring (existing)
- Session storage cost (negligible, already tracked)

### Cost Savings

**Reduced Support Costs:**
- Fewer password reset requests (estimated 30% reduction)
- Fewer account lockout tickets
- Faster user onboarding (less support needed)

---

## Compliance & Privacy

### GDPR Compliance

**Data Collected via Google OAuth:**
- Email address (required for account creation)
- Name (used for user profile)
- Profile picture URL (optional, used for avatar)
- Google user ID (stored as `accountId` in Account table)

**Data Processing:**
- OAuth tokens stored in database (encrypted at application level via PostgreSQL SSL)
- Session cookies used for authentication (30-minute idle timeout)
- No data shared with third parties (beyond Google OAuth flow)

**User Rights:**
- Right to access: User can view connected accounts in settings
- Right to deletion: User can delete account (cascades to Account records)
- Right to portability: User data exportable via admin API
- Right to revoke: User can unlink Google via account settings (Phase 3)

**Legal Basis:** Contractual necessity (authentication required to use platform)

### Privacy Policy Requirements

Must disclose:
- "We use Google OAuth for authentication"
- "We store your email, name, and profile picture from your Google account"
- "We request access to Gmail, Calendar, and Drive APIs to provide integration features"
- "You can revoke our access at any time via your Google account settings"
- "OAuth tokens are stored securely in our database"

### Google OAuth Policy Compliance

**Required by Google:**
1. ✅ Privacy policy publicly accessible
2. ✅ Terms of service publicly accessible
3. ✅ Scope justification documented
4. ✅ User consent obtained (via OAuth consent screen)
5. ✅ Secure token storage (database with encryption)
6. ⚠️ Limited Use disclosure (if using sensitive scopes)

**Limited Use Disclosure:**
For Gmail, Calendar, and Drive scopes, must add to privacy policy:

> "AgentC2's use of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements."

---

## Maintenance & Long-Term Considerations

### Token Refresh

**Current State:** Better Auth automatically refreshes OAuth tokens.

**Monitoring:**
- Track token refresh success rate
- Alert on repeated refresh failures
- Log refresh errors to investigate root cause

**Expiry:**
- Access tokens: 1 hour (Google standard)
- Refresh tokens: No expiry (unless revoked by user)

### Scope Changes

**If Adding New Scopes:**
1. Update `GOOGLE_OAUTH_SCOPES` in `packages/auth/src/google-scopes.ts`
2. Update Google Cloud Console OAuth consent screen
3. Re-submit for verification (if sensitive scopes)
4. Trigger re-auth for existing users (via `linkSocial()`)

**If Removing Scopes:**
1. Update `GOOGLE_OAUTH_SCOPES`
2. Update Google Cloud Console (optional - doesn't break existing)
3. No re-auth needed for existing users

### Upgrading Better Auth

**Process:**
1. Check Better Auth changelog for breaking changes
2. Test OAuth flow on staging after upgrade
3. Verify session cookie format unchanged
4. Test account linking still works

**Risk:** Low - Better Auth is stable, follows semantic versioning

### Decommissioning OAuth

**If Needed in Future:**
1. Remove Google SSO buttons from UI
2. Keep Better Auth configuration (for existing users)
3. Existing Google users can still sign in
4. Prevent new Google sign-ups via `disableImplicitSignUp: true` (already set)

---

## Conclusion

### Summary

This design outlines a **low-risk, high-impact** feature implementation to add Google SSO to the AgentC2 platform's frontend application. The infrastructure is already in place via Better Auth - only UI components need to be added.

### Key Strengths of Approach

1. **Minimal Changes:** Only 2 component files modified, 1 new component file
2. **Zero Backend Changes:** Better Auth handles all OAuth logic
3. **Proven Pattern:** Copy from agent app's working implementation
4. **Low Risk:** Frontend-only changes, easy to rollback
5. **High Impact:** Improves conversion rate, reduces friction, better UX

### Recommended Next Steps

1. **Validate Google OAuth Configuration:**
   - Check if `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
   - Verify Google Cloud Console setup is complete
   - Confirm redirect URIs include all environments

2. **Implement Phase 1:**
   - Create GoogleLogo component
   - Update SignInForm
   - Update SignUpForm
   - Test locally

3. **Deploy to Staging:**
   - Test with real Google accounts
   - Verify session sharing works
   - Load test OAuth flow

4. **Deploy to Production:**
   - Monitor error logs
   - Track adoption metrics
   - Collect user feedback

5. **Follow-Up with Phase 2-3:**
   - Complete documentation
   - Add account linking UI
   - Consider Microsoft SSO

### Timeline Estimate

**Phase 1 (Core Implementation):**
- Development: 2-4 hours
- Testing: 1-2 hours
- Code review: 1 hour
- Deployment: 30 minutes
- **Total: 4-8 hours**

**Phase 2 (Documentation):**
- 1-2 hours

**Phase 3 (Account Linking):**
- 4-8 hours

**Overall: 9-18 hours of development effort**

### Approval Required

This design requires approval before implementation begins. Key decisions needed:

1. Confirm Google OAuth credentials are available
2. Approve Phase 1 scope (Google SSO buttons only)
3. Decide if Microsoft SSO should be included
4. Determine if frontend app auto-sync is needed
5. Set target date for Phase 1 completion

---

## Appendix

### A. Reference Code Snippets

#### Agent App Sign-In Form (Reference)

**File:** `apps/agent/src/components/auth/sign-in-form.tsx` (lines 88-106)

```typescript
const handleSocialSignIn = async (provider: "google" | "microsoft") => {
    setError("");
    setSocialLoading(true);

    try {
        const scopes =
            provider === "google" ? [...GOOGLE_OAUTH_SCOPES] : [...MICROSOFT_OAUTH_SCOPES];
        await signIn.social({
            provider,
            callbackURL: callbackUrl,
            errorCallbackURL: "/login?error=no_account",
            scopes
        });
    } catch (err) {
        setError("An unexpected error occurred");
        console.error(err);
        setSocialLoading(false);
    }
};
```

#### Better Auth Configuration (Reference)

**File:** `packages/auth/src/auth.ts` (lines 84-94)

```typescript
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
        : {})
}
```

### B. File Inventory

**Files to Modify:**
1. `apps/frontend/src/components/auth/sign-in-form.tsx`
2. `apps/frontend/src/components/auth/sign-up-form.tsx`

**Files to Create:**
1. `apps/frontend/src/components/auth/GoogleLogo.tsx`

**Files to Reference (No Changes):**
1. `packages/auth/src/auth.ts` - Better Auth config
2. `packages/auth/src/google-scopes.ts` - Scope definitions
3. `apps/agent/src/components/auth/sign-in-form.tsx` - Reference implementation

**Total Files Changed:** 3 files (2 modified, 1 created)

### C. Environment Variable Reference

```bash
# ==============================
# Google OAuth Configuration
# ==============================

# OAuth 2.0 Client ID from Google Cloud Console
# Create at: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID="1234567890-abc123def456.apps.googleusercontent.com"

# OAuth 2.0 Client Secret from Google Cloud Console
GOOGLE_CLIENT_SECRET="GOCSPX-abc123def456..."

# ==============================
# Redirect URIs (Configure in Google Cloud Console)
# ==============================

# Development:
# http://localhost:3001/api/auth/callback/google

# Production:
# https://agentc2.ai/api/auth/callback/google
```

### D. Testing Scenarios Matrix

| Scenario | User Type | Provider | Expected Outcome | Validated |
|----------|-----------|----------|------------------|-----------|
| Sign up via Google (frontend) | New user | Google | User created, redirected to onboarding | [ ] |
| Sign in via Google (frontend) | Existing user | Google | User authenticated, redirected to dashboard | [ ] |
| Sign up via email (frontend) | New user | Email/Password | User created, redirected to dashboard | [ ] |
| Sign in via email (frontend) | Existing user | Email/Password | User authenticated, redirected to dashboard | [ ] |
| OAuth cancel | Any | Google | Error shown, user can retry | [ ] |
| OAuth error | Any | Google | Error shown, user can retry | [ ] |
| Cross-app session | Any | Any | Session works on both apps | [ ] |
| Missing env vars | Any | Google | Button hidden or disabled | [ ] |
| Partial scopes | Existing user | Google | Sign-in succeeds, agent app triggers re-auth | [ ] |

### E. Troubleshooting Guide

#### Error: "redirect_uri_mismatch"

**Cause:** Redirect URI not configured in Google Cloud Console.

**Solution:**
1. Go to Google Cloud Console → Credentials
2. Edit OAuth 2.0 Client ID
3. Add redirect URI: `{NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
4. Save and retry

#### Error: "invalid_client"

**Cause:** `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` incorrect.

**Solution:**
1. Verify credentials in Google Cloud Console
2. Copy correct values to `.env`
3. Restart dev server
4. Clear browser cookies
5. Retry

#### Error: "access_denied"

**Cause:** User clicked "Cancel" on Google consent screen.

**Solution:**
- Expected behavior
- Show user-friendly error message
- Allow user to retry

#### Issue: Google Button Doesn't Appear

**Cause:** Environment variables not set or Better Auth config error.

**Solution:**
1. Check `.env` has `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
2. Check Better Auth logs for configuration errors
3. Verify `socialProviders.google` is defined in auth config

#### Issue: Session Not Shared Between Apps

**Cause:** Cookie domain mismatch or Caddy not running.

**Solution:**
1. Ensure `NEXT_PUBLIC_APP_URL` is same for both apps
2. Verify `crossSubDomainCookies: { enabled: true }` in production
3. Check Caddy is proxying both apps correctly
4. Verify cookie domain in browser DevTools

---

## Related Issues & PRs

**GitHub Issue:** #108 - Add SSO with Google

**Related:**
- None found (first Google SSO issue)

**Future Enhancements:**
- Microsoft SSO for frontend app (same pattern)
- Account linking UI (Phase 3)
- Shared auth component package (Phase 4)
- OAuth scope management UI
- Multi-factor authentication enforcement for OAuth users

---

## Approval & Sign-Off

This design requires approval from:

- [ ] **Product Manager** - Confirm scope and priority
- [ ] **Engineering Lead** - Approve technical approach
- [ ] **Security Lead** - Approve OAuth security measures
- [ ] **DevOps** - Confirm Google Cloud Console access and configuration

**Approved By:** _Pending_  
**Approval Date:** _Pending_  
**Implementation Start Date:** _Pending_

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-08  
**Next Review:** After Phase 1 completion