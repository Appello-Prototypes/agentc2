# Google SSO - Phase 1 Implementation Guide

**For:** Frontend Engineer assigned to GitHub Issue #91  
**Full Design:** [google-sso-design.md](./google-sso-design.md)  
**Estimated Time:** 8-11 hours (1-2 days)

---

## Quick Start

### Prerequisites

1. **Read the following files first:**
   - `apps/agent/src/components/auth/sign-in-form.tsx` - Reference implementation
   - `packages/auth/src/auth.ts` - Better Auth configuration
   - `.env.example` - Required environment variables

2. **Verify environment setup:**
   ```bash
   # Check Google OAuth credentials are set
   grep GOOGLE .env
   
   # Should show:
   # GOOGLE_CLIENT_ID="..."
   # GOOGLE_CLIENT_SECRET="..."
   ```

3. **Start development environment:**
   ```bash
   # With Caddy (recommended - enables session sharing test)
   bun run dev
   
   # Verify both apps running:
   # - https://catalyst.localhost → Agent app (via Caddy)
   # - Frontend app content served from port 3000
   ```

---

## Implementation Checklist

### Task 1: Update Frontend Sign-In Form (2-3 hours)

**File:** `apps/frontend/src/components/auth/sign-in-form.tsx`

**Steps:**

1. **Add Google Logo component:**
   ```typescript
   // Copy from apps/agent/src/components/auth/sign-in-form.tsx (lines 11-32)
   function GoogleLogo({ className }: { className?: string }) {
       return (
           <svg className={className} viewBox="0 0 24 24" fill="none">
               {/* Copy the four <path> elements */}
           </svg>
       );
   }
   ```

2. **Add imports:**
   ```typescript
   import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";
   ```

3. **Add state management:**
   ```typescript
   const [socialLoading, setSocialLoading] = useState(false);
   ```

4. **Add error handling for no_account:**
   ```typescript
   const searchParams = useSearchParams();
   const [error, setError] = useState(() => {
       const errorParam = searchParams.get("error");
       if (errorParam === "no_account") {
           return "No account found. Please sign up first.";
       }
       return "";
   });
   ```

5. **Add social sign-in handler:**
   ```typescript
   const handleSocialSignIn = async (provider: "google") => {
       setError("");
       setSocialLoading(true);
       try {
           await signIn.social({
               provider,
               callbackURL: callbackUrl,
               errorCallbackURL: "/?error=no_account",
               scopes: [...GOOGLE_OAUTH_SCOPES]
           });
       } catch (err) {
           setError("An unexpected error occurred");
           console.error(err);
           setSocialLoading(false);
       }
   };
   ```

6. **Update JSX structure:**
   ```typescript
   return (
       <div className="space-y-4">
           {/* Add Google button */}
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
           
           {/* Add divider */}
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
           
           {/* Existing email form */}
           <form onSubmit={handleSubmit}>
               {/* ... existing form fields ... */}
           </form>
       </div>
   );
   ```

7. **Update button disabled state:**
   ```typescript
   <Button 
       type="submit" 
       disabled={loading || socialLoading}  // Add socialLoading
   >
   ```

**Verification:**
```bash
bun run type-check
bun run lint
```

---

### Task 2: Update Frontend Sign-Up Form (2-3 hours)

**File:** `apps/frontend/src/components/auth/sign-up-form.tsx`

**Steps:**

1. **Add GoogleLogo component** (same as Task 1.1)

2. **Add imports:**
   ```typescript
   import { signIn } from "@repo/auth/client";  // Add signIn (already has signUp)
   import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";
   import { useSearchParams } from "next/navigation";  // If not already imported
   ```

3. **Add state:**
   ```typescript
   const [socialLoading, setSocialLoading] = useState(false);
   const searchParams = useSearchParams();
   ```

4. **Add social sign-up handler:**
   ```typescript
   const handleSocialSignUp = async (provider: "google") => {
       setError("");
       setSocialLoading(true);
       try {
           const scopes = [...GOOGLE_OAUTH_SCOPES];
           await signIn.social({
               provider,
               requestSignUp: true,
               callbackURL: "/onboarding",  // Or "/dashboard" - see Decision Point below
               scopes
           });
       } catch (err) {
           setError("An unexpected error occurred");
           console.error(err);
           setSocialLoading(false);
       }
   };
   ```

5. **Update JSX structure:**
   ```typescript
   return (
       <div className="space-y-4">
           {/* Add Google button at the top */}
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
           
           {/* Add divider */}
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
           
           {/* Existing email form */}
           <form onSubmit={handleSubmit}>
               {/* ... existing fields ... */}
           </form>
       </div>
   );
   ```

**Decision Point - callbackURL:**
- **Option A:** `/dashboard` - Stay in Frontend app (simpler)
- **Option B:** `/onboarding` - Redirect to Agent app (better UX, consistent)

**Recommended:** Option B - Use `/onboarding` to match Agent app. The session cookie is shared, so the redirect is seamless.

**Verification:**
```bash
bun run type-check
bun run lint
```

---

### Task 3: Verify Session Provider (0.5 hours)

**File:** `apps/frontend/src/app/layout.tsx`

**Action:** Ensure Better Auth session provider is present.

**Expected Code:**
```typescript
import { SessionProvider } from "@repo/auth/providers";

export default function RootLayout({ children }) {
    return (
        <html>
            <body>
                <SessionProvider>
                    {children}
                </SessionProvider>
            </body>
        </html>
    );
}
```

**If Missing:** Add SessionProvider wrapper.

**If Already Present:** ✅ No changes needed.

**Verification:**
```bash
# Check if SessionProvider is imported
grep -n "SessionProvider" apps/frontend/src/app/layout.tsx
```

---

### Task 4: Update Google Cloud Console (15 minutes)

**Portal:** https://console.cloud.google.com/apis/credentials

**Actions:**

1. **Navigate to OAuth 2.0 Client IDs**
2. **Select:** "AgentC2 - Better Auth" (or existing OAuth client)
3. **Add Authorized Redirect URI:**
   ```
   http://localhost:3000/api/auth/callback/google
   ```
4. **Verify existing URIs:**
   ```
   http://localhost:3001/api/auth/callback/google  ✅ Should exist
   https://agentc2.ai/api/auth/callback/google     ✅ Should exist
   ```
5. **Save**

**Important:** Production callback URL (`https://agentc2.ai/api/auth/callback/google`) works for both apps because Caddy routes all traffic through a single domain.

---

### Task 5: Local Testing (2-3 hours)

**Test Environment:** `https://catalyst.localhost` (with Caddy)

#### Test 5.1: New User Sign-Up via Google

1. Navigate to: `https://catalyst.localhost/signup`
2. Click "Continue with Google"
3. **Expected:** Redirect to Google consent screen
4. Authenticate with test Google account
5. Approve all scopes (gmail, calendar, drive)
6. **Expected:** Redirect to `/onboarding` (Agent app)
7. **Verify:**
   - User record created in database
   - Account record created with `providerId: "google"`
   - Session cookie set (`better-auth.session.token`)
   - Gmail IntegrationConnection auto-created
8. Complete onboarding
9. **Verify:** Can access both Frontend and Agent apps without re-login

#### Test 5.2: Existing User Sign-In via Google

1. Navigate to: `https://catalyst.localhost/` (homepage)
2. Scroll to sign-in form in hero section
3. Click "Continue with Google"
4. **Expected:** Quick OAuth flow (Google remembers consent)
5. **Expected:** Redirect to `/dashboard`
6. **Verify:** User authenticated, profile picture from Google visible

#### Test 5.3: No Account Error

1. Open incognito browser
2. Navigate to: `https://catalyst.localhost/` (homepage)
3. Click "Continue with Google"
4. Authenticate with Google account that has **no existing AgentC2 account**
5. **Expected:** Redirect to `/?error=no_account`
6. **Verify:** Error message shown: "No account found. Please sign up first."
7. Click "Sign up" link
8. **Verify:** Navigate to `/signup` page

#### Test 5.4: Cross-App Session Sharing

1. Sign in via Google on Frontend app (`https://catalyst.localhost/`)
2. In same browser, navigate to Agent app (`https://catalyst.localhost/workspace`)
3. **Verify:** User is already authenticated (no login prompt)
4. Open browser DevTools → Application → Cookies
5. **Verify:** `better-auth.session.token` cookie exists with domain `catalyst.localhost`
6. Sign out from Agent app
7. Navigate back to Frontend app
8. **Verify:** User is signed out from Frontend app as well

#### Test 5.5: Partial Consent

1. Start Google OAuth flow from `/signup`
2. On Google consent screen, **deselect** "Gmail" permission
3. Approve other permissions
4. Complete authentication
5. **Expected:** User signed in, but Gmail integration NOT created
6. Navigate to `/onboarding`
7. **Verify:** Onboarding detects missing scopes (if implemented)

**Testing Tools:**
```bash
# View database records
bun run db:studio

# Monitor logs
tail -f apps/frontend/.next/trace

# Check Caddy routing
curl -I https://catalyst.localhost/api/auth/callback/google
# Should return 404 or 405 (method not allowed) - route exists but requires POST
```

---

### Task 6: Code Quality & Build (1 hour)

**Pre-Commit Checklist:**

```bash
# 1. Format code
bun run format

# 2. Fix linting errors
bun run lint

# 3. Type check
bun run type-check

# 4. Build all apps
bun run build

# 5. Verify no errors
echo "If all commands succeeded, ready to commit!"
```

**Expected Output:**
- `format` - Files formatted, no changes if already formatted
- `lint` - No errors, 0 warnings
- `type-check` - No TypeScript errors
- `build` - All apps build successfully

**If Errors:**
- Linting: Fix import order, unused variables, etc.
- Type errors: Usually missing imports or type mismatches
- Build errors: Often Tailwind class issues or missing dependencies

---

### Task 7: Git Commit & Push (30 minutes)

**Branch Strategy:**
```bash
# Create feature branch
git checkout -b feature/google-sso-frontend

# Stage changes
git add apps/frontend/src/components/auth/sign-in-form.tsx
git add apps/frontend/src/components/auth/sign-up-form.tsx
# Add any other modified files

# Review changes
git diff --staged

# Commit with conventional commit message
git commit -m "feat: add Google OAuth to Frontend app sign-in and sign-up forms

- Add Google OAuth button to sign-in form with Better Auth integration
- Add Google OAuth button to sign-up form with scope configuration
- Copy UI patterns from Agent app for consistency
- Handle no_account error scenario with clear user messaging
- Support cross-app session sharing via shared cookie domain

Closes #91"

# Push to remote
git push origin feature/google-sso-frontend
```

**Create Pull Request:**
- Title: `feat: Add Google OAuth to Frontend App`
- Description: Link to design doc and summary
- Labels: `authentication`, `frontend`, `enhancement`
- Reviewers: Engineering Lead, Product Manager

---

## Implementation Details

### Sign-In Form Changes

**Before:**
```typescript
export function SignInForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        await signIn.email({ email, password });
        router.push(callbackUrl);
    };

    return <form onSubmit={handleSubmit}>...</form>;
}
```

**After:**
```typescript
export function SignInForm() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
    
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(() => {
        const errorParam = searchParams.get("error");
        if (errorParam === "no_account") {
            return "No account found. Please sign up first.";
        }
        return "";
    });
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        /* ... existing email/password logic ... */
    };

    const handleSocialSignIn = async (provider: "google") => {
        setError("");
        setSocialLoading(true);
        try {
            await signIn.social({
                provider,
                callbackURL: callbackUrl,
                errorCallbackURL: "/?error=no_account",
                scopes: [...GOOGLE_OAUTH_SCOPES]
            });
        } catch (err) {
            setError("An unexpected error occurred");
            console.error(err);
            setSocialLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Google button */}
            <Button onClick={() => handleSocialSignIn("google")} disabled={loading || socialLoading}>
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
            
            {/* Existing email form */}
            <form onSubmit={handleSubmit}>
                {/* ... existing fields ... */}
            </form>
        </div>
    );
}
```

**Key Changes:**
- Added `searchParams` for callback URL and error handling
- Added `socialLoading` state
- Added `handleSocialSignIn` function
- Added Google button and divider before email form
- Updated disabled states to include `socialLoading`

### Sign-Up Form Changes

**Similar pattern** - Add Google button, social loading state, and handler. Key difference:

```typescript
await signIn.social({
    provider: "google",
    requestSignUp: true,  // ← Key difference: explicitly request sign-up
    callbackURL: "/onboarding",  // ← Redirect to onboarding (vs /dashboard for sign-in)
    scopes: [...GOOGLE_OAUTH_SCOPES]
});
```

---

## Common Pitfalls

### Pitfall 1: Missing useSearchParams Hook

**Error:**
```
ReferenceError: searchParams is not defined
```

**Fix:**
```typescript
import { useSearchParams } from "next/navigation";

export function SignInForm() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
    // ...
}
```

### Pitfall 2: Callback URL Not Working

**Symptom:** OAuth succeeds but user redirected to wrong page.

**Causes:**
1. `callbackURL` parameter missing or incorrect
2. Better Auth `baseURL` misconfigured
3. Caddy not routing correctly

**Debug:**
```typescript
// Add console log before OAuth call
console.log("OAuth callback URL:", callbackUrl);
console.log("Better Auth base URL:", process.env.NEXT_PUBLIC_APP_URL);
```

### Pitfall 3: Session Cookie Not Shared

**Symptom:** User authenticated in Frontend but not in Agent app (or vice versa).

**Causes:**
1. Caddy not running (apps on different origins)
2. Cookie domain misconfigured
3. Different `BETTER_AUTH_SECRET` values (breaks session validation)

**Debug:**
```bash
# Check Caddy status
ps aux | grep caddy

# Verify cookie in DevTools
# Should have domain: catalyst.localhost (not localhost:3000)

# Check Better Auth secret consistency
grep BETTER_AUTH_SECRET .env
# Should be the same value for both apps
```

### Pitfall 4: Type Errors After Adding Google Scopes

**Error:**
```
Type 'readonly string[]' is not assignable to type 'string[]'
```

**Fix:**
```typescript
// Use spread operator to convert readonly array to mutable
scopes: [...GOOGLE_OAUTH_SCOPES]  // ✅ Correct
// NOT:
scopes: GOOGLE_OAUTH_SCOPES        // ❌ Type error
```

### Pitfall 5: OAuth Callback 404

**Symptom:** Google redirects to callback URL but gets 404 error.

**Causes:**
1. Better Auth not initialized in Frontend app
2. API routes not exported correctly
3. Caddy routing misconfigured

**Debug:**
```bash
# Check if Better Auth API route exists
curl http://localhost:3000/api/auth/callback/google
# Should return 405 Method Not Allowed (not 404) - means route exists

# Check Better Auth export in Frontend app
grep "export.*auth" apps/frontend/src/lib/auth.ts
# Should export auth instance from @repo/auth
```

---

## Testing Script

**Copy this test plan and check off as you test:**

```
Manual Testing Checklist:

Frontend Sign-In Form:
[ ] Navigate to https://catalyst.localhost/
[ ] Google OAuth button visible
[ ] Click Google button → redirect to Google consent screen
[ ] Approve → redirect back to Frontend app
[ ] User authenticated (check session cookie in DevTools)
[ ] Can navigate to Agent app without re-login
[ ] Sign out → cookie cleared

Frontend Sign-Up Form:
[ ] Navigate to https://catalyst.localhost/signup
[ ] Google OAuth button visible
[ ] Click Google button → redirect to Google
[ ] Approve → redirect to /onboarding (Agent app)
[ ] Organization created (or joined via invite/domain match)
[ ] Gmail integration auto-created (verify in Settings)
[ ] Complete onboarding → redirect to /workspace
[ ] Session persists across both apps

Error Handling:
[ ] Existing user clicks "Sign in with Google" → succeeds
[ ] Non-existent user clicks "Sign in with Google" → error=no_account
[ ] Error message displayed clearly
[ ] "Sign up" link navigates to /signup
[ ] User completes sign-up → successfully creates account

Cross-Browser:
[ ] Test in Chrome/Edge
[ ] Test in Firefox
[ ] Test in Safari (if available)

Cross-App:
[ ] Sign in via Frontend → navigate to Agent → authenticated
[ ] Sign in via Agent → navigate to Frontend → authenticated
[ ] Sign out from Frontend → Agent also signed out
[ ] Sign out from Agent → Frontend also signed out
```

---

## Debugging Guide

### Issue: Google Button Not Appearing

**Checklist:**
1. Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
2. Verify imports: `import { signIn } from "@repo/auth/client"`
3. Check Better Auth config: `grep -A 10 "google:" packages/auth/src/auth.ts`
4. Restart dev server: `bun run dev`

### Issue: OAuth Redirect Fails

**Symptoms:**
- "redirect_uri_mismatch" error from Google
- User stuck on Google OAuth page

**Fix:**
1. Verify redirect URI in Google Cloud Console matches exactly:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - **Not:** `https://catalyst.localhost/api/auth/callback/google` (Caddy proxies to localhost)
2. Check Better Auth `baseURL` configuration
3. Verify no trailing slashes in URLs

### Issue: Session Cookie Not Set

**Symptoms:**
- OAuth succeeds but user not authenticated
- No `better-auth.session.token` cookie in DevTools

**Debug:**
1. Check Better Auth secret is set:
   ```bash
   grep BETTER_AUTH_SECRET .env
   ```
2. Check database connection (Session table):
   ```bash
   bun run db:studio
   # Navigate to Session table, verify recent records
   ```
3. Check browser console for errors
4. Verify Caddy is running:
   ```bash
   ps aux | grep caddy
   ```

### Issue: Organization Not Created

**Symptoms:**
- User authenticated but has no organization membership
- Redirected to onboarding but stuck

**Debug:**
1. Check organization bootstrap hook in auth.ts (line 161-202)
2. Verify Membership table in database
3. Check for bootstrap errors in terminal output:
   ```bash
   grep -i "bootstrap" apps/frontend/.next/trace
   ```
4. Manually trigger bootstrap:
   ```typescript
   // In browser console (after sign-in)
   await fetch("/api/auth/bootstrap", { method: "POST" });
   ```

---

## Rollback Instructions

**If critical issues occur after deployment:**

### Option 1: Code Revert (Full Rollback)

```bash
# Revert the commit
git revert HEAD
git push origin main

# GitHub Actions auto-deploys revert
# Frontend app returns to email/password only
```

### Option 2: Environment Variable Disable

```bash
# SSH to production server
ssh deploy@agentc2.ai

# Edit .env
vim /var/www/agentc2/.env

# Comment out Google OAuth credentials
# GOOGLE_CLIENT_ID="..."
# GOOGLE_CLIENT_SECRET="..."

# Restart apps
pm2 restart frontend
pm2 restart agent

# Verify: Google buttons disappear, email/password still works
```

### Option 3: Feature Flag (Future Enhancement)

Add to both forms:
```typescript
const googleOAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_SSO !== "false";

{googleOAuthEnabled && (
    <Button onClick={() => handleSocialSignIn("google")}>
        Continue with Google
    </Button>
)}
```

---

## Post-Deployment Monitoring

**First 24 Hours:**

```bash
# Monitor error logs
pm2 logs frontend --lines 100 | grep -i "oauth\|google"

# Check OAuth callback success rate
# In database:
SELECT COUNT(*) FROM "Session" WHERE "createdAt" > NOW() - INTERVAL '24 hours';
SELECT COUNT(*) FROM "Account" WHERE "providerId" = 'google' AND "createdAt" > NOW() - INTERVAL '24 hours';

# Monitor sign-up conversion rate
# Compare: Google signups vs total signups
```

**Metrics to Track:**
- OAuth callback success rate (target: > 98%)
- Sign-up conversion rate (expect: +10-15% improvement)
- Cross-app session sharing success (target: > 99%)
- OAuth-related error rate (target: < 2%)

**Alerts to Configure:**
- OAuth callback failure rate > 5% → Page on-call engineer
- Session creation failure rate > 3% → Investigate database
- User reports OAuth errors → Triage within 1 hour

---

## FAQs

### Q: Do I need to modify the Backend/API?

**A:** No. Better Auth handles all OAuth logic server-side. The `/api/auth/callback/google` endpoint exists automatically in both apps via the `@repo/auth` package.

### Q: Will this break existing email/password sign-ins?

**A:** No. Email/password authentication continues to work exactly as before. Google OAuth is an additional option.

### Q: How do I test without real Google OAuth credentials?

**A:** You'll need valid Google OAuth credentials from Google Cloud Console. Consider:
- Create a test Google OAuth app
- Use organization's shared OAuth app (if available)
- Mock OAuth responses (advanced - requires Better Auth internals knowledge)

### Q: What if user signs up with Google but email already exists with password?

**A:** Better Auth will link the Google account to the existing user via the `Account` table. The user can then sign in with either method (Google or password).

### Q: Do I need to handle token refresh?

**A:** No. Better Auth handles OAuth token refresh automatically for social providers.

### Q: What about GDPR compliance?

**A:** Privacy policy already covers OAuth data usage (verify at `/privacy` page). Google OAuth tokens are stored in the database (not exposed to client). Users can revoke access via Google account settings.

### Q: How do I add Microsoft OAuth later?

**A:** Follow the same pattern:
1. Add `MicrosoftLogo` component
2. Update `handleSocialSignIn` to accept `"google" | "microsoft"`
3. Add Microsoft button
4. Import `MICROSOFT_OAUTH_SCOPES`
5. Better Auth already supports Microsoft (when env vars set)

---

## Success Criteria

**Phase 1 Complete When:**

- ✅ Google OAuth button appears on Frontend sign-in form
- ✅ Google OAuth button appears on Frontend sign-up form
- ✅ New user can sign up with Google from `/signup`
- ✅ Existing user can sign in with Google from homepage
- ✅ Cross-app session sharing works (Frontend ↔ Agent)
- ✅ Error handling works (no_account scenario)
- ✅ All tests pass: `type-check`, `lint`, `build`
- ✅ Code reviewed and merged
- ✅ Deployed to production
- ✅ Monitoring shows > 98% OAuth success rate

---

## Resources

- **Full Design Doc:** [google-sso-design.md](./google-sso-design.md)
- **Executive Summary:** [google-sso-design-summary.md](./google-sso-design-summary.md)
- **Reference Implementation:** `apps/agent/src/components/auth/sign-in-form.tsx`
- **Better Auth Docs:** https://better-auth.com/docs/authentication/social
- **Google OAuth Docs:** https://developers.google.com/identity/protocols/oauth2

---

## Contact

**Questions about design decisions?** → Product Manager or Engineering Lead  
**Questions about implementation?** → Senior Frontend Engineer (reference implementation author)  
**Questions about Better Auth?** → Check docs or #engineering Slack channel  
**Questions about testing?** → QA Engineer or follow testing checklist above

---

**Good luck with implementation!** This is a well-scoped, low-risk feature with clear success criteria. Follow the checklist, test thoroughly, and you'll have Google OAuth working in the Frontend app in 1-2 days.
