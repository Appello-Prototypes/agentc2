# Google SSO Implementation Guide

**For:** Developers implementing GitHub Issue #108  
**Related Docs:** [Design](./google-sso-design.md) | [Summary](./google-sso-summary.md) | [Architecture](./google-sso-architecture.md)  
**Estimated Time:** 2-4 hours  
**Difficulty:** Easy

---

## Quick Start

This guide provides step-by-step instructions to add Google SSO to the frontend app. The agent app already has this working - we're just copying the pattern.

---

## Prerequisites

### 1. Verify Google OAuth is Configured

**Check environment variables:**
```bash
grep -E "GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET" .env
```

**Expected output:**
```
GOOGLE_CLIENT_ID="1234567890-abc.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."
```

**If missing:**
- See [Google Cloud Console Setup](#google-cloud-console-setup) section below
- Or ask platform administrator for credentials

### 2. Start Development Environment

```bash
bun run dev
```

**Verify running:**
- Frontend: https://catalyst.localhost
- Agent: https://catalyst.localhost/agent

### 3. Test Agent App Google SSO

**Baseline test to confirm backend works:**

1. Navigate to: https://catalyst.localhost/agent/login
2. Click "Continue with Google"
3. Approve scopes
4. Verify you're signed in

**If this doesn't work:** Backend configuration issue - fix before proceeding.

---

## Implementation Steps

### Step 1: Create GoogleLogo Component

**File:** `apps/frontend/src/components/auth/GoogleLogo.tsx` (NEW)

**Copy from agent app and extract to standalone component:**

```typescript
export function GoogleLogo({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
            />
            <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
            />
            <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
            />
            <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
            />
        </svg>
    );
}
```

**Verify:**
```bash
# File should exist
ls apps/frontend/src/components/auth/GoogleLogo.tsx
```

---

### Step 2: Update SignInForm Component

**File:** `apps/frontend/src/components/auth/sign-in-form.tsx` (MODIFY)

**2.1 Add Imports**

Add these imports at the top:

```typescript
import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";
import { GoogleLogo } from "./GoogleLogo";
```

**2.2 Add State**

Add `socialLoading` state:

```typescript
const [socialLoading, setSocialLoading] = useState(false);
```

**2.3 Add Social Sign-In Handler**

Add this function before the `handleSubmit` function:

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
        console.error(err);
        setSocialLoading(false);
    }
};
```

**2.4 Update JSX**

Replace the form JSX with this structure:

```typescript
return (
    <div className="space-y-4">
        {/* Google SSO Button */}
        <Button
            type="button"
            variant="outline"
            size="lg"
            className="relative w-full justify-center gap-3 border-slate-200 py-5 text-sm font-medium shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-900"
            onClick={() => handleSocialSignIn("google")}
            disabled={loading || socialLoading}
        >
            <GoogleLogo className="size-5" />
            {socialLoading ? "Connecting..." : "Continue with Google"}
        </Button>

        {/* Divider */}
        <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="text-muted-foreground bg-background px-2">
                    or continue with email
                </span>
            </div>
        </div>

        {/* Existing Email Form - Keep as is, just update button disabled */}
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* ... existing email/password fields ... */}
            
            <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || socialLoading}  {/* Add socialLoading */}
            >
                {loading ? "Signing in..." : "Sign In"}
            </Button>
        </form>

        {/* ... rest of JSX ... */}
    </div>
);
```

**Key Changes:**
- ➕ Google SSO button at top
- ➕ Divider between social and email
- 🔄 Update submit button disabled state: `disabled={loading || socialLoading}`

---

### Step 3: Update SignUpForm Component

**File:** `apps/frontend/src/components/auth/sign-up-form.tsx` (MODIFY)

**3.1 Add Imports**

```typescript
import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";
import { GoogleLogo } from "./GoogleLogo";
```

**3.2 Add State**

```typescript
const [socialLoading, setSocialLoading] = useState(false);
```

**3.3 Add Social Sign-Up Handler**

Add this function before `handleSubmit`:

```typescript
const handleSocialSignUp = async (provider: "google") => {
    setError("");
    setSocialLoading(true);

    try {
        await signIn.social({
            provider,
            requestSignUp: true,  // Important: tells Better Auth this is sign-up
            callbackURL: "/dashboard",
            scopes: [...GOOGLE_OAUTH_SCOPES]
        });
    } catch (err) {
        setError("An unexpected error occurred");
        console.error(err);
        setSocialLoading(false);
    }
};
```

**3.4 Update JSX**

Add Google SSO button at the top of the form:

```typescript
return (
    <div className="space-y-4">
        {/* Google SSO Button */}
        <Button
            type="button"
            variant="outline"
            size="lg"
            className="relative w-full justify-center gap-3 border-slate-200 py-5 text-sm font-medium shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-900"
            onClick={() => handleSocialSignUp("google")}
            disabled={loading || socialLoading}
        >
            <GoogleLogo className="size-5" />
            {socialLoading ? "Connecting..." : "Continue with Google"}
        </Button>

        {/* Divider */}
        <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="text-muted-foreground bg-background px-2">
                    or continue with email
                </span>
            </div>
        </div>

        {/* Existing form content - Keep email form toggle logic */}
        {/* ... rest of JSX ... */}
    </div>
);
```

**Key Changes:**
- ➕ Google SSO button at top
- ➕ Divider
- 🔄 Update disabled states to include `socialLoading`

---

### Step 4: Test Locally

**4.1 Start Dev Server**

```bash
bun run dev
```

**4.2 Test Sign-Up Flow**

1. Navigate to: https://catalyst.localhost/signup
2. Verify Google button appears
3. Click "Continue with Google"
4. Approve scopes on Google consent screen
5. Verify redirect to `/dashboard`
6. Check browser DevTools > Application > Cookies:
   - Look for `better-auth.session_token`
   - Domain should be `.catalyst.localhost`

**Expected Database Records:**

```bash
# Open Prisma Studio
bun run db:studio

# Check tables:
# - User: New record with your Google email
# - Account: providerId = "google"
# - Session: New session with token
```

**4.3 Test Sign-In Flow**

1. Sign out
2. Navigate to: https://catalyst.localhost (home page)
3. Scroll to sign-in form
4. Click "Continue with Google"
5. Verify redirect to `/dashboard`

**4.4 Test Cross-App Session**

1. After signing in on frontend
2. Navigate to: https://catalyst.localhost/agent/workspace
3. Verify you're authenticated (no login prompt)

**4.5 Test Error Cases**

**Cancel OAuth:**
1. Click "Continue with Google"
2. Click "Cancel" on Google consent screen
3. Verify error message appears
4. Verify you can retry

**Missing Environment Variables:**
1. Comment out `GOOGLE_CLIENT_ID` in `.env`
2. Restart dev server: `bun run dev`
3. Navigate to sign-in page
4. Verify behavior (button should be hidden or Better Auth shows error)

**4.6 Test Existing Email Auth**

1. Create account with email/password
2. Sign out
3. Sign in with email/password
4. Verify it still works (no regression)

---

### Step 5: Code Quality Checks

**Format code:**
```bash
bun run format
```

**Run linting:**
```bash
bun run lint
```

**Fix any errors**, then:

**Type check:**
```bash
bun run type-check
```

**Build:**
```bash
bun run build
```

**All must pass before committing.**

---

### Step 6: Commit Changes

```bash
git status
git add apps/frontend/src/components/auth/
git diff --staged  # Review changes
git commit -m "feat: add Google SSO to frontend app sign-in/sign-up"
git push origin main
```

---

### Step 7: Deploy & Verify

**If using GitHub Actions:**
- Push triggers automatic deployment
- Monitor deployment logs in GitHub Actions tab

**If manual deploy:**
```bash
ssh user@production-server
cd /var/www/agentc2
git pull origin main
bun install
bun run build
pm2 restart frontend
pm2 logs frontend --lines 50
```

**Smoke Test:**
1. Navigate to production URL: `https://agentc2.ai/signup`
2. Verify Google button appears
3. Test sign-up with test Google account
4. Verify redirect to dashboard
5. Check logs for errors: `pm2 logs frontend`

---

## Troubleshooting

### Issue: Google Button Doesn't Appear

**Possible causes:**
1. Environment variables not set
2. Dev server not restarted after env change
3. TypeScript error preventing build
4. Import path incorrect

**Debug:**
```bash
# Check env vars
grep GOOGLE .env

# Check TypeScript errors
bun run type-check

# Check browser console for errors
# Open DevTools > Console
```

---

### Issue: "redirect_uri_mismatch" Error

**Cause:** Redirect URI not configured in Google Cloud Console.

**Fix:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Edit OAuth 2.0 Client ID
3. Add redirect URI:
   - Development: `http://localhost:3001/api/auth/callback/google`
   - Production: `https://agentc2.ai/api/auth/callback/google`
4. Save and retry

**Note:** Use agent app port (3001) not frontend port (3000) because Better Auth is hosted on agent app.

---

### Issue: "invalid_client" Error

**Cause:** Wrong Client ID or Client Secret.

**Fix:**
1. Verify credentials in Google Cloud Console
2. Copy correct values to `.env`
3. Restart dev server
4. Clear browser cookies
5. Retry

---

### Issue: Session Not Shared Between Apps

**Cause:** Cookie domain issue or Caddy not running.

**Fix:**
1. Verify accessing via `https://catalyst.localhost` (not `http://localhost`)
2. Check Caddy is running: `curl -I https://catalyst.localhost`
3. Check cookie domain in DevTools > Application > Cookies
   - Should be `.catalyst.localhost` (with leading dot)
4. Verify `NEXT_PUBLIC_APP_URL="https://catalyst.localhost"` in `.env`

---

### Issue: TypeScript Error on GOOGLE_OAUTH_SCOPES

**Error:**
```
Cannot find module '@repo/auth/google-scopes' or its corresponding type declarations
```

**Cause:** Package not built or import path incorrect.

**Fix:**
```bash
# Rebuild packages
bun run build --filter=@repo/auth

# Or rebuild everything
bun run build
```

---

### Issue: Button Appears But Click Does Nothing

**Cause:** JavaScript error or Better Auth not initialized.

**Debug:**
1. Open browser console (F12)
2. Check for errors when clicking button
3. Verify `signIn` is imported: `import { signIn } from "@repo/auth/client"`
4. Check network tab - should see redirect to Google

---

## Testing Checklist

### Functional Testing

**Sign-Up (Frontend App):**
- [ ] Navigate to /signup
- [ ] Google button visible
- [ ] Click Google button → Redirects to Google
- [ ] Approve scopes → Redirects back to app
- [ ] User signed in and redirected to dashboard
- [ ] Check database: User, Account, Session created

**Sign-In (Frontend App):**
- [ ] Navigate to / (home page)
- [ ] Google button visible in sign-in form
- [ ] Click Google button → OAuth flow
- [ ] Existing user signed in
- [ ] Redirected to dashboard

**Cross-App Session:**
- [ ] Sign in on frontend app
- [ ] Navigate to /agent/workspace
- [ ] Verify authenticated (no login prompt)

**Error Handling:**
- [ ] Cancel OAuth → Error shown, can retry
- [ ] Invalid credentials → Error shown
- [ ] Network error → Error shown

**Email/Password (Regression):**
- [ ] Sign up with email/password → Works
- [ ] Sign in with email/password → Works

### Code Quality

- [ ] `bun run format` passes
- [ ] `bun run lint` passes (no errors)
- [ ] `bun run type-check` passes (no errors)
- [ ] `bun run build` succeeds

### Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

### Visual QA

- [ ] Google logo displays correctly
- [ ] Button styling matches shadcn/ui theme
- [ ] Spacing consistent with email form
- [ ] Loading state shows "Connecting..."
- [ ] Hover states work
- [ ] Dark mode looks correct
- [ ] Mobile responsive (button not too wide)

---

## Code Review Checklist

**Before requesting review:**

- [ ] All tests pass (see checklist above)
- [ ] No console warnings or errors
- [ ] Code follows existing patterns
- [ ] Imports organized correctly
- [ ] No unused imports
- [ ] TypeScript types correct (no `any`)
- [ ] Error handling implemented
- [ ] Loading states implemented
- [ ] Accessibility: buttons have proper labels
- [ ] Comments added only where necessary (avoid obvious comments)

**Review Criteria:**
- Code matches agent app pattern exactly
- No unnecessary changes to unrelated code
- Styling consistent with shadcn/ui theme
- Error messages user-friendly

---

## Deployment Checklist

### Pre-Deployment

- [ ] All code quality checks pass
- [ ] Code reviewed and approved
- [ ] Merged to main branch
- [ ] Verify Google OAuth credentials set in production `.env`
- [ ] Verify redirect URIs include production domain

### Deployment

- [ ] Push to main (or merge PR)
- [ ] GitHub Actions deploy automatically
- [ ] Or manual: SSH to server, pull, build, restart

### Post-Deployment

- [ ] Smoke test: Sign up with test Google account
- [ ] Verify redirect to dashboard
- [ ] Check logs: `pm2 logs frontend --lines 50`
- [ ] Monitor errors for first 24 hours
- [ ] Update GitHub issue #108 with completion note

---

## Google Cloud Console Setup

**If Google OAuth credentials don't exist, follow these steps:**

### 1. Create Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name: "AgentC2" (or "AgentC2 Dev" for development)
4. Click "Create"

### 2. Enable APIs

1. Navigate to **APIs & Services → Library**
2. Enable these APIs:
   - Gmail API
   - Google Calendar API
   - Google Drive API

### 3. Create OAuth 2.0 Client

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth 2.0 Client ID**
3. If prompted, configure OAuth consent screen first (see next section)
4. Application type: **Web application**
5. Name: "AgentC2 Web" (or "AgentC2 Dev")
6. **Authorized redirect URIs** - Add both:
   - `http://localhost:3001/api/auth/callback/google` (development)
   - `https://agentc2.ai/api/auth/callback/google` (production)
7. Click **Create**
8. Copy Client ID and Client Secret to `.env`

### 4. Configure OAuth Consent Screen

**If not already configured:**

1. Go to **APIs & Services → OAuth consent screen**
2. User Type: **External** (for public app)
3. Click **Create**

**App Information:**
- App name: `AgentC2`
- User support email: `support@agentc2.ai`
- App logo: Upload 512x512 PNG
- App domain: `agentc2.ai`
- Authorized domains: `agentc2.ai`

**Developer contact:**
- Email: `developer@agentc2.ai`

**Scopes:**
1. Click "Add or Remove Scopes"
2. Add these scopes:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/drive.file`

**Privacy Policy:**
- URL: `https://agentc2.ai/privacy`
- Must be publicly accessible

**Terms of Service:**
- URL: `https://agentc2.ai/terms`
- Must be publicly accessible

**Save and Continue**

### 5. Publishing Status

**For Development:**
- Status: **Testing**
- Add test users: Your Google accounts for testing
- No verification needed
- **Limitation:** Max 100 test users

**For Production:**
- Status: **In Production**
- Click "Publish App"
- **Requires verification** for sensitive scopes (Gmail, Calendar, Drive)
- Fill out verification form:
  - Demo video showing how scopes are used
  - Justification for each scope
  - Privacy policy and terms of service links
- **Wait 4-6 weeks for approval**

### 6. Add Credentials to .env

```bash
GOOGLE_CLIENT_ID="1234567890-abc123.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-abc123..."
```

**Restart dev server:**
```bash
# Stop current dev server (Ctrl+C)
bun run dev
```

---

## Reference: Agent App Implementation

**If you need reference code, check these files:**

**GoogleLogo SVG:**
```
apps/agent/src/components/auth/sign-in-form.tsx (lines 11-32)
```

**handleSocialSignIn function:**
```
apps/agent/src/components/auth/sign-in-form.tsx (lines 88-106)
```

**JSX structure:**
```
apps/agent/src/components/auth/sign-in-form.tsx (lines 108-198)
```

**Read reference files:**
```bash
# Sign-in form
cat apps/agent/src/components/auth/sign-in-form.tsx

# Sign-up form
cat apps/agent/src/components/auth/sign-up-form.tsx

# Google scopes
cat packages/auth/src/google-scopes.ts
```

---

## Quick Commands Reference

```bash
# Development
bun run dev                    # Start with Caddy (HTTPS)
bun run dev:local              # Start without Caddy

# Code Quality
bun run format                 # Format code
bun run lint                   # Check linting
bun run type-check             # Check types
bun run build                  # Build all apps

# Database
bun run db:studio              # View database
bun run db:generate            # Regenerate Prisma client

# Git
git status                     # Check status
git diff apps/frontend/        # Review frontend changes
git add apps/frontend/         # Stage frontend changes
git commit -m "feat: ..."      # Commit with message
git push origin main           # Push to remote

# Production
pm2 status                     # Check app status
pm2 logs frontend              # View logs
pm2 restart frontend           # Restart app
```

---

## File Paths Quick Reference

```
apps/frontend/src/components/auth/
├── GoogleLogo.tsx          ← CREATE THIS
├── sign-in-form.tsx        ← MODIFY THIS
└── sign-up-form.tsx        ← MODIFY THIS

packages/auth/src/
├── google-scopes.ts        ← REFERENCE (don't modify)
└── auth.ts                 ← REFERENCE (don't modify)

apps/agent/src/components/auth/
├── sign-in-form.tsx        ← REFERENCE (copy pattern)
└── sign-up-form.tsx        ← REFERENCE (copy pattern)
```

---

## Timeline

**Implementation:**
- Step 1 (GoogleLogo): 15 minutes
- Step 2 (SignInForm): 30 minutes
- Step 3 (SignUpForm): 30 minutes
- Step 4 (Testing): 1 hour
- Step 5 (Code Quality): 15 minutes
- Step 6-7 (Deploy): 30 minutes

**Total: 2.5-3 hours**

**Plus:**
- Code review: 30 minutes
- Production testing: 30 minutes

**Grand Total: ~4 hours**

---

## Success Criteria

**Implementation complete when:**

✅ Google SSO button appears on frontend sign-in page  
✅ Google SSO button appears on frontend sign-up page  
✅ OAuth flow works end-to-end  
✅ New users can sign up via Google  
✅ Existing users can sign in via Google  
✅ Session shared across frontend and agent apps  
✅ Email/password auth still works (no regression)  
✅ All code quality checks pass  
✅ Deployed to production  
✅ Smoke tested successfully  
✅ GitHub issue #108 closed

---

## Getting Help

**If stuck:**

1. **Check agent app** - Copy the exact pattern (it works)
2. **Check Better Auth logs** - Look for errors in terminal
3. **Check browser console** - Look for JavaScript errors
4. **Check Google Cloud Console** - Verify configuration
5. **Ask for help** - Provide error messages and steps to reproduce

**Common Mistakes:**
- ❌ Using frontend app port (3000) for redirect URI instead of agent app port (3001)
- ❌ Not restarting dev server after changing `.env`
- ❌ Forgetting to import `GOOGLE_OAUTH_SCOPES`
- ❌ Not handling `socialLoading` state
- ❌ Testing with `http://localhost` instead of `https://catalyst.localhost`

---

## Next Steps (After Phase 1)

**Phase 2: Documentation & Hardening**
- Document Google Cloud Console setup in detail
- Add rate limiting to frontend auth routes
- Create troubleshooting guide

**Phase 3: Account Linking UI**
- Add settings page to show connected accounts
- Allow linking Google to existing email account
- Allow unlinking Google

**Phase 4: Code Consolidation**
- Extract auth forms to `@repo/auth` package
- Share components between frontend and agent apps
- Reduce code duplication

---

## Additional Resources

**Documentation:**
- [Better Auth Social Provider Docs](https://www.better-auth.com/docs/social-providers)
- [Google OAuth 2.0 Docs](https://developers.google.com/identity/protocols/oauth2)
- [Better Auth React Hooks](https://www.better-auth.com/docs/react)

**Code Examples:**
- Agent app sign-in form: `apps/agent/src/components/auth/sign-in-form.tsx`
- Better Auth config: `packages/auth/src/auth.ts`
- OAuth scopes: `packages/auth/src/google-scopes.ts`

**Internal Docs:**
- [CLAUDE.md](/CLAUDE.md) - Development guidelines
- [Full Design Document](./google-sso-design.md) - Complete technical design
- [Architecture Diagrams](./google-sso-architecture.md) - Visual diagrams

---

**Ready to start?** Follow Step 1 above. Good luck! 🚀

**Questions?** Refer to [full design document](./google-sso-design.md) or ask in team chat.

---

**Last Updated:** 2026-03-08  
**Version:** 1.0  
**Maintainer:** Engineering Team