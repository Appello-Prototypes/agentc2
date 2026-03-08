# Google SSO Implementation - Step-by-Step Checklist

**GitHub Issue:** #91  
**Assignee:** [To be assigned]  
**Estimated Time:** 8-11 hours

---

## Pre-Implementation (15 minutes)

### Environment Verification

- [ ] Read full design doc: `.cursor/plans/google-sso-design.md`
- [ ] Read implementation guide: `.cursor/plans/google-sso-implementation-guide.md`
- [ ] Verify Google OAuth credentials in `.env`:
  ```bash
  grep GOOGLE_CLIENT .env
  # Should show GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
  ```
- [ ] Verify Better Auth secret:
  ```bash
  grep BETTER_AUTH_SECRET .env
  # Should be set and consistent
  ```
- [ ] Test current Agent app Google OAuth:
  - Navigate to http://localhost:3001/login
  - Click "Continue with Google"
  - Verify OAuth flow works end-to-end

### Development Environment Setup

- [ ] Start Caddy:
  ```bash
  ./scripts/start-caddy.sh
  # Verify: Caddy started successfully
  ```
- [ ] Start development servers:
  ```bash
  bun run dev
  # Verify: Frontend (3000) and Agent (3001) running
  ```
- [ ] Verify HTTPS access:
  ```bash
  curl -I https://catalyst.localhost
  # Should return 200 OK
  ```
- [ ] Check current Frontend sign-in form:
  - Navigate to https://catalyst.localhost/
  - Scroll to hero section
  - Verify: Only email/password form visible (no Google button yet)

---

## Implementation Phase (6-8 hours)

### Step 1: Update Frontend Sign-In Form (2.5 hours)

**File:** `apps/frontend/src/components/auth/sign-in-form.tsx`

- [ ] Open file in editor
- [ ] Read current implementation (understand structure)
- [ ] Open reference file: `apps/agent/src/components/auth/sign-in-form.tsx`
- [ ] Copy `GoogleLogo` component (lines 11-32) to Frontend sign-in form
- [ ] Copy `MicrosoftLogo` component (lines 34-43) to Frontend sign-in form
- [ ] Add import:
  ```typescript
  import { useSearchParams } from "next/navigation";
  import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";
  import { MICROSOFT_OAUTH_SCOPES } from "@repo/auth/microsoft-scopes";
  ```
- [ ] Add state management:
  ```typescript
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [socialLoading, setSocialLoading] = useState(false);
  ```
- [ ] Update error state initialization:
  ```typescript
  const [error, setError] = useState(() => {
      const errorParam = searchParams.get("error");
      if (errorParam === "no_account") {
          return "No account found. Please sign up first.";
      }
      return "";
  });
  ```
- [ ] Add `handleSocialSignIn` function (copy from Agent app, lines 88-106)
- [ ] Restructure JSX:
  - [ ] Wrap form in `<div className="space-y-4">`
  - [ ] Add Google button at top
  - [ ] Add Microsoft button (optional)
  - [ ] Add divider
  - [ ] Keep existing email form
- [ ] Update button disabled states: `disabled={loading || socialLoading}`
- [ ] Save file
- [ ] Run `bun run type-check` - verify no errors
- [ ] Run `bun run lint` - verify no errors

**Checkpoint:** Google button should appear on sign-in form.

---

### Step 2: Update Frontend Sign-Up Form (2.5 hours)

**File:** `apps/frontend/src/components/auth/sign-up-form.tsx`

- [ ] Open file in editor
- [ ] Open reference: `apps/agent/src/components/auth/sign-up-form.tsx`
- [ ] Copy `GoogleLogo` component
- [ ] Copy `MicrosoftLogo` component
- [ ] Add imports:
  ```typescript
  import { signIn } from "@repo/auth/client";  // Add to existing signUp import
  import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";
  import { MICROSOFT_OAUTH_SCOPES } from "@repo/auth/microsoft-scopes";
  ```
- [ ] Add state:
  ```typescript
  const [socialLoading, setSocialLoading] = useState(false);
  ```
- [ ] Add `handleSocialSignUp` function:
  ```typescript
  const handleSocialSignUp = async (provider: "google" | "microsoft") => {
      setError("");
      setSocialLoading(true);
      try {
          const scopes = provider === "google" 
              ? [...GOOGLE_OAUTH_SCOPES] 
              : [...MICROSOFT_OAUTH_SCOPES];
          await signIn.social({
              provider,
              requestSignUp: true,
              callbackURL: "/onboarding",  // Redirect to Agent onboarding
              scopes
          });
      } catch (err) {
          setError("An unexpected error occurred");
          console.error(err);
          setSocialLoading(false);
      }
  };
  ```
- [ ] Restructure JSX:
  - [ ] Add Google button at top
  - [ ] Add Microsoft button
  - [ ] Add divider
  - [ ] Keep email form (or make collapsible - optional)
- [ ] Update button disabled states
- [ ] Save file
- [ ] Run `bun run type-check`
- [ ] Run `bun run lint`

**Checkpoint:** Google button should appear on sign-up form.

---

### Step 3: Verify Session Provider (30 minutes)

**File:** `apps/frontend/src/app/layout.tsx`

- [ ] Open file in editor
- [ ] Search for `SessionProvider`
- [ ] **If found:** ✅ No changes needed, mark complete
- [ ] **If not found:** Add SessionProvider:
  ```typescript
  import { SessionProvider } from "@repo/auth/providers";
  
  export default function RootLayout({ children }) {
      return (
          <html lang="en">
              <body>
                  <SessionProvider>
                      {children}
                  </SessionProvider>
              </body>
          </html>
      );
  }
  ```
- [ ] Save file
- [ ] Run `bun run type-check`

**Checkpoint:** SessionProvider wraps the app.

---

### Step 4: Update Google Cloud Console (15 minutes)

- [ ] Navigate to: https://console.cloud.google.com/apis/credentials
- [ ] Select the AgentC2 OAuth 2.0 Client ID
- [ ] Under "Authorized redirect URIs", verify existing:
  - [ ] `http://localhost:3001/api/auth/callback/google` ✅
  - [ ] `https://agentc2.ai/api/auth/callback/google` ✅
- [ ] Click "Add URI"
- [ ] Enter: `http://localhost:3000/api/auth/callback/google`
- [ ] Click "Save"
- [ ] Wait 1-2 minutes for Google to propagate changes

**Checkpoint:** Three redirect URIs configured in Google Cloud Console.

---

### Step 5: Build and Format (30 minutes)

- [ ] Format code:
  ```bash
  bun run format
  ```
- [ ] Fix linting issues:
  ```bash
  bun run lint
  # If errors, fix manually then re-run
  ```
- [ ] Type check:
  ```bash
  bun run type-check
  # Should show 0 errors
  ```
- [ ] Build all apps:
  ```bash
  bun run build
  # All apps should build successfully
  ```

**Checkpoint:** All quality checks pass.

---

## Testing Phase (2-3 hours)

### Test 1: Frontend Sign-Up via Google

- [ ] Open browser (incognito/private mode)
- [ ] Navigate to: https://catalyst.localhost/signup
- [ ] **Verify:** "Continue with Google" button visible
- [ ] **Verify:** Google logo displays correctly
- [ ] Click "Continue with Google"
- [ ] **Verify:** Redirect to Google consent screen
- [ ] Authenticate with test Google account
- [ ] **Verify:** Consent screen shows all requested scopes:
  - Gmail
  - Google Calendar
  - Google Drive
- [ ] Click "Continue" or "Allow"
- [ ] **Verify:** Redirect to `/onboarding` (Agent app)
- [ ] **Verify:** URL is `https://catalyst.localhost/onboarding`
- [ ] Open DevTools → Application → Cookies
- [ ] **Verify:** `better-auth.session.token` cookie exists
- [ ] **Verify:** Cookie domain is `catalyst.localhost`
- [ ] Complete onboarding wizard
- [ ] **Verify:** Redirect to `/workspace`
- [ ] **Verify:** User authenticated and profile picture visible

**If Test Fails:**
- Check browser console for errors
- Check terminal logs for OAuth errors
- Verify Google Cloud Console redirect URI configuration
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`

---

### Test 2: Frontend Sign-In via Google (Existing User)

- [ ] Use account created in Test 1 (or create via email/password first)
- [ ] Open new browser window (or clear session)
- [ ] Navigate to: https://catalyst.localhost/
- [ ] Scroll to hero section sign-in form
- [ ] **Verify:** "Continue with Google" button visible
- [ ] Click "Continue with Google"
- [ ] **Verify:** Quick OAuth redirect (Google remembers consent)
- [ ] **Verify:** Redirect to `/dashboard` or `/workspace`
- [ ] **Verify:** User authenticated
- [ ] Check profile dropdown
- [ ] **Verify:** User name and email from Google account

**If Test Fails:**
- Check if user account has linked Google Account record in database
- Verify session cookie is set
- Check Better Auth logs for OAuth errors

---

### Test 3: No Account Error Handling

- [ ] Open browser (incognito mode)
- [ ] Navigate to: https://catalyst.localhost/
- [ ] Click "Continue with Google" in sign-in form
- [ ] Authenticate with Google account that has **no existing AgentC2 account**
- [ ] **Verify:** Redirect to `/?error=no_account`
- [ ] **Verify:** Error message displayed: "No account found. Please sign up first."
- [ ] **Verify:** "Sign up" link visible
- [ ] Click "Sign up" link
- [ ] **Verify:** Navigate to `/signup` page
- [ ] **Verify:** Google sign-up button visible on signup page

**If Test Fails:**
- Check `disableImplicitSignUp: true` in Better Auth config
- Verify error query parameter handling in sign-in form
- Check `errorCallbackURL` parameter in `signIn.social()` call

---

### Test 4: Cross-App Session Sharing

- [ ] Sign in via Google on Frontend app (https://catalyst.localhost/)
- [ ] **Verify:** User authenticated on Frontend
- [ ] In same browser, navigate to: https://catalyst.localhost/workspace
- [ ] **Verify:** Agent app shows authenticated state (no login prompt)
- [ ] **Verify:** User profile visible in Agent app
- [ ] Navigate back to Frontend: https://catalyst.localhost/
- [ ] **Verify:** Still authenticated on Frontend
- [ ] In Agent app, click sign-out
- [ ] Navigate to Frontend app
- [ ] **Verify:** User is signed out from Frontend as well
- [ ] Check cookies in DevTools
- [ ] **Verify:** `better-auth.session.token` cookie removed

**If Test Fails:**
- Verify Caddy is running: `ps aux | grep caddy`
- Check cookie domain (should be `catalyst.localhost`, not `localhost:3000`)
- Verify both apps use same `@repo/auth` package version
- Check `crossSubDomainCookies` setting in Better Auth config

---

### Test 5: Loading States

- [ ] Navigate to sign-in form
- [ ] Click "Continue with Google"
- [ ] **Verify:** Button text changes to "Connecting..."
- [ ] **Verify:** Button is disabled during OAuth redirect
- [ ] **Verify:** Email form fields are disabled (if same component)
- [ ] Complete OAuth flow
- [ ] **Verify:** Loading state clears after redirect

---

### Test 6: Button Styling

- [ ] Sign-in form Google button:
  - [ ] Outline variant (border visible)
  - [ ] Large size (py-5)
  - [ ] Google logo centered with text
  - [ ] Hover effect (background color change)
  - [ ] Disabled state (grayed out when loading)
- [ ] Sign-up form Google button:
  - [ ] Same styling as sign-in
  - [ ] Consistent spacing
- [ ] Divider:
  - [ ] Horizontal line spanning full width
  - [ ] "or continue with email" text centered
  - [ ] Proper spacing above and below

---

### Test 7: Database Verification

- [ ] Run Prisma Studio:
  ```bash
  bun run db:studio
  ```
- [ ] After completing Test 1 (Google sign-up):
  - [ ] Navigate to `User` table
  - [ ] Find newly created user
  - [ ] **Verify:** `email` matches Google account
  - [ ] **Verify:** `emailVerified` is `true`
  - [ ] **Verify:** `image` contains Google profile picture URL
- [ ] Navigate to `Account` table
- [ ] Find account for the user
- [ ] **Verify:** `providerId` is `"google"`
- [ ] **Verify:** `accountId` is set (Google user ID)
- [ ] **Verify:** `accessToken` is populated (not null)
- [ ] **Verify:** `refreshToken` is populated
- [ ] **Verify:** `scope` contains requested scopes
- [ ] Navigate to `Session` table
- [ ] Find session for the user
- [ ] **Verify:** `userId` matches user ID
- [ ] **Verify:** `token` is set (UUID-like)
- [ ] **Verify:** `expiresAt` is in the future

---

## Code Quality Checks (1 hour)

### Pre-Commit Checklist

- [ ] Run type checking:
  ```bash
  bun run type-check
  ```
  **Expected:** `0 errors`

- [ ] Run linting:
  ```bash
  bun run lint
  ```
  **Expected:** `0 errors, 0 warnings`

- [ ] Format code:
  ```bash
  bun run format
  ```
  **Expected:** Files formatted automatically

- [ ] Build all apps:
  ```bash
  bun run build
  ```
  **Expected:** All apps build successfully

- [ ] Review changes:
  ```bash
  git status
  git diff apps/frontend/src/components/auth/
  ```
  **Expected:** Only sign-in-form.tsx and sign-up-form.tsx modified

### Code Review Self-Check

- [ ] No console.log statements left in code (except intentional logging)
- [ ] No commented-out code
- [ ] No TODO comments
- [ ] Proper TypeScript types (no `any`)
- [ ] Error handling present for all async operations
- [ ] Loading states prevent double-clicks
- [ ] Accessibility: buttons have proper labels
- [ ] Consistent naming conventions
- [ ] Imports organized (React, external, internal, relative)

---

## Git Workflow (30 minutes)

### Create Feature Branch

- [ ] Create branch:
  ```bash
  git checkout -b feature/google-sso-frontend
  ```

### Stage Changes

- [ ] Stage modified files:
  ```bash
  git add apps/frontend/src/components/auth/sign-in-form.tsx
  git add apps/frontend/src/components/auth/sign-up-form.tsx
  # If layout.tsx was modified:
  git add apps/frontend/src/app/layout.tsx
  ```

### Review Staged Changes

- [ ] View diff:
  ```bash
  git diff --staged
  ```
- [ ] **Verify:** Only intended files staged
- [ ] **Verify:** No accidental changes (debug code, console.logs, etc.)
- [ ] **Verify:** Proper formatting (4 spaces, no semicolons)

### Commit

- [ ] Commit with descriptive message:
  ```bash
  git commit -m "feat: add Google OAuth to Frontend app sign-in and sign-up forms

  - Add Google OAuth button to sign-in form (homepage hero section)
  - Add Google OAuth button to sign-up form (/signup page)
  - Add Microsoft OAuth button for feature parity with Agent app
  - Copy UI patterns from Agent app for consistency
  - Handle no_account error with clear messaging
  - Support cross-app session sharing via Caddy
  - Add social loading states and error handling

  Closes #91"
  ```

### Push to Remote

- [ ] Push branch:
  ```bash
  git push origin feature/google-sso-frontend
  ```
- [ ] **Verify:** Push successful

---

## Pull Request Creation (15 minutes)

- [ ] Navigate to: https://github.com/Appello-Prototypes/agentc2/pulls
- [ ] Click "New Pull Request"
- [ ] Select: `base: main` ← `compare: feature/google-sso-frontend`
- [ ] Title: `feat: Add Google OAuth to Frontend App`
- [ ] Description:
  ```markdown
  ## Summary
  
  Adds Google OAuth Single Sign-On to the Frontend app sign-in and sign-up forms, achieving feature parity with the Agent app.
  
  ## Changes
  
  - Add Google OAuth button to Frontend sign-in form
  - Add Google OAuth button to Frontend sign-up form
  - Add Microsoft OAuth button for consistency
  - Copy UI patterns from Agent app
  - Handle `no_account` error scenario
  
  ## Design Documents
  
  - Full Design: `.cursor/plans/google-sso-design.md`
  - Summary: `.cursor/plans/google-sso-design-summary.md`
  - Implementation Guide: `.cursor/plans/google-sso-implementation-guide.md`
  
  ## Testing
  
  ✅ Manual testing completed:
  - Google sign-up from Frontend app
  - Google sign-in from Frontend app
  - Cross-app session sharing
  - Error handling (no_account)
  - Loading states
  
  ✅ Quality checks:
  - `bun run type-check` - 0 errors
  - `bun run lint` - 0 errors
  - `bun run build` - Success
  
  ## Deployment Notes
  
  - Google Cloud Console: Add `localhost:3000` redirect URI before testing
  - Production: No additional redirect URI needed (Caddy proxies through agentc2.ai)
  - No backend changes required
  - No database migrations required
  
  Closes #91
  ```
- [ ] Add labels:
  - [ ] `authentication`
  - [ ] `frontend`
  - [ ] `enhancement`
- [ ] Add reviewers:
  - [ ] Engineering Lead
  - [ ] Product Manager (optional)
- [ ] Add to project board (if applicable)
- [ ] Click "Create Pull Request"

---

## Post-PR Actions (30 minutes)

### Update GitHub Issue

- [ ] Navigate to: https://github.com/Appello-Prototypes/agentc2/issues/91
- [ ] Add comment:
  ```markdown
  ## Implementation Complete ✅
  
  Pull Request: #[PR_NUMBER]
  
  **Phase 1 (MVP) implemented:**
  - Google OAuth enabled in Frontend app sign-in and sign-up forms
  - Cross-app session sharing tested and verified
  - Error handling implemented
  
  **Design documents created:**
  - [google-sso-design.md](.cursor/plans/google-sso-design.md) - Full technical design
  - [google-sso-design-summary.md](.cursor/plans/google-sso-design-summary.md) - Executive summary
  - [google-sso-implementation-guide.md](.cursor/plans/google-sso-implementation-guide.md) - Implementation guide
  
  **Next Steps:**
  - Code review
  - Staging deployment
  - Production deployment
  - Monitor conversion metrics
  - Consider Phase 2 (scope optimization) if needed
  ```

### Notify Team

- [ ] Post in #engineering Slack channel (or equivalent):
  ```
  🎉 Google SSO implementation complete for Frontend app!
  
  PR: [link]
  Issue: #91
  
  Ready for review. Once merged, users can sign in/up with Google from the marketing site.
  
  Testing: All manual tests passed, cross-app session sharing verified.
  ```

---

## Staging Deployment (If Applicable)

### Deploy to Staging

- [ ] Merge PR to `staging` branch (or equivalent)
- [ ] SSH to staging server:
  ```bash
  ssh deploy@staging.agentc2.ai
  ```
- [ ] Pull latest code:
  ```bash
  cd /var/www/agentc2
  git pull origin staging
  ```
- [ ] Install dependencies (if package.json changed):
  ```bash
  bun install
  ```
- [ ] Build apps:
  ```bash
  bun run build
  ```
- [ ] Restart Frontend app:
  ```bash
  pm2 restart frontend
  ```
- [ ] Verify deployment:
  ```bash
  pm2 status
  pm2 logs frontend --lines 50
  ```

### Test in Staging

- [ ] Navigate to staging URL (e.g., `https://staging.agentc2.ai`)
- [ ] Repeat all Test 1-6 scenarios above
- [ ] Verify Google Cloud Console redirect URI includes staging domain
- [ ] Check error logs: `pm2 logs frontend | grep -i error`

---

## Production Deployment (After PR Approval)

### Pre-Deployment

- [ ] PR approved by reviewers
- [ ] All CI/CD checks passed
- [ ] Staging testing complete
- [ ] Google Cloud Console production redirect URI verified
- [ ] Production environment variables verified:
  ```bash
  ssh deploy@agentc2.ai
  grep GOOGLE /var/www/agentc2/.env
  ```

### Merge to Main

- [ ] Merge PR to `main` branch
- [ ] **If using GitHub Actions:** Automatic deployment triggered
- [ ] **If manual deployment:**
  ```bash
  ssh deploy@agentc2.ai
  cd /var/www/agentc2
  git pull origin main
  bun install
  bun run build
  pm2 restart frontend
  pm2 status
  ```

### Verify Production

- [ ] Navigate to: https://agentc2.ai
- [ ] **Verify:** Google OAuth button visible
- [ ] Test sign-up flow with test account
- [ ] Test sign-in flow with existing account
- [ ] Test cross-app navigation (Frontend → Agent)
- [ ] Check production logs:
  ```bash
  pm2 logs frontend --lines 100 | grep -i "oauth\|google"
  ```

---

## Post-Deployment Monitoring (First 24 Hours)

### Metrics Dashboard

- [ ] Track sign-up conversions:
  - Total signups (last 24h)
  - Google OAuth signups
  - Email/password signups
  - Conversion rate by method
- [ ] Track OAuth success rate:
  ```sql
  SELECT COUNT(*) FROM "Account" WHERE "providerId" = 'google' 
    AND "createdAt" > NOW() - INTERVAL '24 hours';
  ```
- [ ] Monitor error logs:
  ```bash
  pm2 logs frontend --lines 500 | grep -i error
  ```
- [ ] Check support tickets:
  - Any OAuth-related user reports?
  - Authentication issues?

### Health Checks

- [ ] Hour 1: Check metrics, verify no errors
- [ ] Hour 4: Review conversion rates
- [ ] Hour 12: Analyze sign-up method distribution
- [ ] Hour 24: Full metrics review, prepare summary

### Success Criteria

- [ ] OAuth callback success rate: > 98%
- [ ] No critical errors in logs
- [ ] Sign-up conversion rate: Stable or improved
- [ ] Cross-app session sharing: 100% success
- [ ] User-reported issues: < 5 tickets
- [ ] Google OAuth adoption: > 20% of new signups (Day 1)

---

## Rollback Checklist (If Needed)

### Trigger Conditions

Roll back if ANY of these occur:
- [ ] OAuth callback failure rate > 10%
- [ ] Sign-up conversion rate drops > 20%
- [ ] Critical session sharing bug (users can't access Agent app)
- [ ] Google API quota exceeded
- [ ] Database connection issues

### Rollback Steps

- [ ] Revert merge commit:
  ```bash
  git revert HEAD
  git push origin main
  ```
- [ ] Verify automatic deployment triggered
- [ ] Test production site (Google buttons should disappear)
- [ ] Monitor error logs (should decrease)
- [ ] Notify team in Slack
- [ ] Update GitHub issue with rollback reason
- [ ] Schedule post-mortem to identify root cause

---

## Completion Checklist

### Definition of Done

- [ ] ✅ Code implemented and tested
- [ ] ✅ All quality checks pass (type-check, lint, build)
- [ ] ✅ Pull request created and reviewed
- [ ] ✅ Merged to main branch
- [ ] ✅ Deployed to production
- [ ] ✅ Production testing complete
- [ ] ✅ Monitoring configured
- [ ] ✅ First 24-hour metrics reviewed
- [ ] ✅ GitHub issue closed
- [ ] ✅ Documentation updated
- [ ] ✅ Team notified

### Deliverables

- [ ] ✅ Frontend sign-in form with Google OAuth
- [ ] ✅ Frontend sign-up form with Google OAuth
- [ ] ✅ Design documents (completed pre-implementation)
- [ ] ✅ Implementation guide (completed pre-implementation)
- [ ] ✅ Test results documented
- [ ] ✅ Metrics baseline captured (for Phase 2 comparison)

---

## Next Steps (Post-Phase 1)

### Immediate Follow-Up

- [ ] Monitor conversion metrics for 1 week
- [ ] Gather user feedback on OAuth experience
- [ ] Check for edge cases or bugs
- [ ] Document any issues discovered

### Phase 2 Planning

- [ ] Review metrics: Is scope overreach reducing conversions?
- [ ] Analyze Google consent screen drop-off rate
- [ ] Decide: Implement minimal SSO scopes?
- [ ] If yes, schedule Phase 2 implementation (7-9 hours)

### Future Enhancements

- [ ] Extract shared OAuth components to `@repo/ui`
- [ ] Add GitHub OAuth (developer audience)
- [ ] Add Apple Sign In (privacy-focused users)
- [ ] Implement account linking UI in settings
- [ ] Add OAuth token refresh monitoring
- [ ] Create OAuth consent audit log

---

## Troubleshooting Reference

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Google button not visible | Check env vars, restart dev server |
| OAuth redirect fails | Verify Google Cloud Console redirect URI |
| Session not shared | Verify Caddy running, check cookie domain |
| Type errors | Install `@repo/auth` dependencies: `bun install` |
| Lint errors | Run `bun run lint --fix` |
| Build errors | Check imports, verify package versions |
| No account error not showing | Add error query param handling |
| Callback 404 | Verify Better Auth initialized in Frontend app |
| Token refresh issues | Check `BETTER_AUTH_SECRET` consistency |
| Organization not created | Check bootstrap hook in auth.ts |

### Debug Commands

```bash
# Check Caddy status
ps aux | grep caddy

# View Caddy logs
tail -f /tmp/caddy.log

# Check app status
curl -I https://catalyst.localhost
curl -I https://catalyst.localhost/workspace

# View session cookie
# (In browser DevTools → Application → Cookies)

# Check database
bun run db:studio

# Monitor logs
pm2 logs frontend --lines 50
```

---

## Sign-Off

### Before Marking Complete

- [ ] All tests passed
- [ ] Code reviewed and approved
- [ ] Deployed to production
- [ ] Monitoring shows healthy metrics
- [ ] GitHub issue updated and closed
- [ ] Team notified

### Final Verification

- [ ] Go to https://agentc2.ai
- [ ] Google OAuth button visible on homepage ✅
- [ ] Test sign-up flow with personal Google account ✅
- [ ] Cross-app navigation works ✅
- [ ] No errors in production logs ✅

**Feature complete!** 🎉

---

**Estimated Total Time:** 8-11 hours (1-2 days)

**Confidence Level:** High (90%+) - Infrastructure already exists, low-risk frontend changes only

**Support:** Refer to design docs or contact engineering lead if blocked
