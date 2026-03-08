# Google SSO Implementation Checklist

**Related:** [Technical Design Document](./google-sso-technical-design.md)  
**GitHub Issue:** [#84](https://github.com/Appello-Prototypes/agentc2/issues/84)  
**Status:** Configuration and Testing Required

---

## Pre-Implementation Verification

- [ ] Read the full [Technical Design Document](./google-sso-technical-design.md)
- [ ] Verify Better Auth Google OAuth implementation exists in `packages/auth/src/auth.ts`
- [ ] Verify UI components exist in `apps/agent/src/components/auth/sign-in-form.tsx`
- [ ] Confirm database schema supports OAuth (User, Account, Session models)

**Current Status:** Implementation is complete. Only configuration needed.

---

## Phase 1: Google Cloud Console Setup

### 1.1 Create/Select Project
- [ ] Go to https://console.cloud.google.com
- [ ] Create new project named "AgentC2 Production" (or select existing)
- [ ] Note project ID: `_________________`

### 1.2 Enable Required APIs
- [ ] Navigate to "APIs & Services" → "Library"
- [ ] Enable **Google+ API** (for user profile)
- [ ] Enable **Gmail API** (for agent tools)
- [ ] Enable **Google Calendar API** (for agent tools)
- [ ] Enable **Google Drive API** (for agent tools)

### 1.3 Configure OAuth Consent Screen
- [ ] Navigate to "APIs & Services" → "OAuth consent screen"
- [ ] Select user type: **External** (for public access)
- [ ] Click "Create"

**App Information:**
- [ ] App name: `AgentC2`
- [ ] User support email: `support@agentc2.ai`
- [ ] Upload app logo (512x512px PNG)

**App Domain:**
- [ ] Application home page: `https://agentc2.ai`
- [ ] Application privacy policy: `https://agentc2.ai/privacy`
- [ ] Application terms of service: `https://agentc2.ai/terms`

**Authorized Domains:**
- [ ] Add domain: `agentc2.ai`
- [ ] Add domain: `ngrok-free.dev` (for development)

**Developer Contact:**
- [ ] Email: `dev@agentc2.ai`

- [ ] Click "Save and Continue"

### 1.4 Configure Scopes
- [ ] Click "Add or Remove Scopes"
- [ ] Search and select the following scopes:
  - [ ] `https://www.googleapis.com/auth/gmail.modify`
  - [ ] `https://www.googleapis.com/auth/calendar.events`
  - [ ] `https://www.googleapis.com/auth/drive.readonly`
  - [ ] `https://www.googleapis.com/auth/drive.file`
- [ ] Click "Update"
- [ ] Click "Save and Continue"

### 1.5 Add Test Users (Optional - for testing before verification)
- [ ] Click "Add Users"
- [ ] Add test email addresses (up to 100 allowed):
  - [ ] `_________________@gmail.com`
  - [ ] `_________________@company.com`
  - [ ] `_________________@agentc2.ai`
- [ ] Click "Save and Continue"

### 1.6 Create OAuth 2.0 Credentials
- [ ] Navigate to "APIs & Services" → "Credentials"
- [ ] Click "Create Credentials" → "OAuth 2.0 Client ID"
- [ ] Application type: **Web application**
- [ ] Name: `AgentC2 Web Client`

**Authorized JavaScript origins:**
- [ ] `http://localhost:3001`
- [ ] `https://catalyst.localhost`
- [ ] `https://agentc2.ai`

**Authorized redirect URIs:**
- [ ] `http://localhost:3001/api/auth/callback/google`
- [ ] `https://catalyst.localhost/api/auth/callback/google`
- [ ] `https://agentc2.ai/api/auth/callback/google`
- [ ] `https://agentc2.ai/admin/api/auth/google/callback`

- [ ] Click "Create"
- [ ] **Copy Client ID:** `_________________`
- [ ] **Copy Client Secret:** `_________________`

---

## Phase 2: Environment Configuration

### 2.1 Update Local Development Environment

**File:** `.env`

```bash
# Add or update these lines:
GOOGLE_CLIENT_ID="paste-client-id-here"
GOOGLE_CLIENT_SECRET="paste-client-secret-here"
```

- [ ] Add `GOOGLE_CLIENT_ID` to `.env`
- [ ] Add `GOOGLE_CLIENT_SECRET` to `.env`
- [ ] Verify `BETTER_AUTH_SECRET` is set
- [ ] Verify `CREDENTIAL_ENCRYPTION_KEY` is set
- [ ] Verify `NEXT_PUBLIC_APP_URL` matches redirect URI

### 2.2 Update Production Environment

**Method 1: SSH + Environment File**
```bash
ssh user@agentc2.ai
cd /path/to/app
nano .env  # or vim .env
# Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
```

**Method 2: PM2 Ecosystem Config**
```javascript
// ecosystem.config.js
env: {
  GOOGLE_CLIENT_ID: "...",
  GOOGLE_CLIENT_SECRET: "..."
}
```

- [ ] Add environment variables to production server
- [ ] Verify variables are set: `echo $GOOGLE_CLIENT_ID`
- [ ] Restart PM2 processes: `pm2 restart ecosystem.config.js --update-env`
- [ ] Verify PM2 status: `pm2 status`

### 2.3 Update CI/CD (GitHub Secrets)

- [ ] Navigate to GitHub repo → Settings → Secrets and variables → Actions
- [ ] Add repository secret: `GOOGLE_CLIENT_ID`
- [ ] Add repository secret: `GOOGLE_CLIENT_SECRET`
- [ ] Update GitHub Actions workflow to use secrets (if needed)

---

## Phase 3: Verification & Testing

### 3.1 Configuration Smoke Test

- [ ] Start development server: `bun run dev`
- [ ] Navigate to `http://localhost:3001/login` (or `https://catalyst.localhost/login`)
- [ ] Verify "Continue with Google" button is visible
- [ ] Open browser DevTools → Network tab
- [ ] Click "Continue with Google" button
- [ ] Verify redirect to `accounts.google.com/o/oauth2/v2/auth`
- [ ] Verify `redirect_uri` parameter in URL matches registered URI
- [ ] **Do not complete OAuth flow yet** (close tab)

**If button doesn't appear:**
- Check server logs for errors
- Verify environment variables loaded: `console.log(process.env.GOOGLE_CLIENT_ID)` in server component
- Restart dev server

---

### 3.2 Personal Google Account Test

**Test Account:** `_________________@gmail.com`

**Signup Flow:**
- [ ] Navigate to `/signup`
- [ ] Click "Continue with Google"
- [ ] Select personal Google account on consent screen
- [ ] Review requested scopes (Gmail, Calendar, Drive)
- [ ] Click "Continue" or "Allow"
- [ ] Verify redirect to `/onboarding`
- [ ] Complete onboarding flow
- [ ] Verify redirect to `/workspace`

**Database Verification:**
```sql
-- Check user created
SELECT id, email, emailVerified, name, image FROM "user" 
WHERE email = 'your-test-email@gmail.com';

-- Check OAuth account created
SELECT id, providerId, scope FROM account WHERE userId = '<user-id>';

-- Check Gmail integration created
SELECT id, provider_id, name, is_active FROM integration_connection 
WHERE organization_id = '<org-id>' AND provider_id = 'gmail';
```

- [ ] User record exists with `emailVerified: true`
- [ ] Account record exists with `providerId: "google"`
- [ ] IntegrationConnection exists for Gmail
- [ ] IntegrationConnection exists for Google Calendar
- [ ] IntegrationConnection exists for Google Drive

**Logout and Sign-In Test:**
- [ ] Sign out of AgentC2
- [ ] Navigate to `/login`
- [ ] Click "Continue with Google"
- [ ] Verify redirect to `/workspace` (skips onboarding)
- [ ] Verify session created

---

### 3.3 Google Workspace Account Test

**Test Account:** `_________________@yourcompany.com`

**Signup Flow:**
- [ ] Navigate to `/signup`
- [ ] Click "Continue with Google"
- [ ] Select Google Workspace account
- [ ] Grant consent
- [ ] Complete onboarding

**Workspace-Specific Checks:**
- [ ] Verify domain-based organization matching (if applicable)
- [ ] Verify Workspace restrictions respected (if configured by admin)

---

### 3.4 Error Scenario Testing

**Scope Denial:**
- [ ] Start OAuth flow
- [ ] Click "Cancel" on consent screen
- [ ] Verify user returns to signup page
- [ ] Verify error message displayed
- [ ] Verify no partial records in database

**Duplicate Email:**
- [ ] Create account with email/password: `test@gmail.com`
- [ ] Sign in with Google using same email
- [ ] Verify account linking works (both auth methods available)

**Invalid Credentials:**
- [ ] Set `GOOGLE_CLIENT_SECRET` to invalid value
- [ ] Attempt Google OAuth
- [ ] Verify appropriate error message
- [ ] Restore correct secret

**Redirect URI Mismatch:**
- [ ] Remove redirect URI from Google Cloud Console
- [ ] Attempt Google OAuth
- [ ] Verify `redirect_uri_mismatch` error
- [ ] Re-add redirect URI
- [ ] Retry successfully

---

### 3.5 Integration Testing

**Gmail Tool Access:**
- [ ] Sign in with Google account
- [ ] Navigate to Settings → Integrations
- [ ] Verify Gmail shows "Connected" status
- [ ] Verify email address matches Google account
- [ ] Create agent with Gmail tools enabled
- [ ] Send message to agent: "Check my inbox for unread emails"
- [ ] Verify agent can read Gmail (returns email list)

**Token Refresh:**
- [ ] Sign in with Google
- [ ] Wait 1 hour (or manually expire token in database)
- [ ] Trigger agent action requiring Gmail API
- [ ] Verify token auto-refreshes without user prompt
- [ ] Check `Account.updatedAt` timestamp is recent

**Calendar Access (if Calendar tools exist):**
- [ ] Send message to agent: "What's on my calendar today?"
- [ ] Verify agent can read calendar events

---

### 3.6 Cross-Browser Testing

- [ ] **Chrome Desktop:** OAuth flow works end-to-end
- [ ] **Safari Desktop:** OAuth flow works end-to-end
- [ ] **Firefox Desktop:** OAuth flow works end-to-end
- [ ] **Chrome Mobile:** OAuth flow works, UI responsive
- [ ] **Safari Mobile (iOS):** OAuth flow works, UI responsive

---

## Phase 4: Google OAuth Verification Submission

### 4.1 Pre-Verification Requirements

**Privacy Policy:**
- [ ] Privacy policy exists at `https://agentc2.ai/privacy`
- [ ] Privacy policy explains Google data usage:
  - [ ] What data is accessed (emails, calendar events, drive files)
  - [ ] How data is used (AI agent actions, search, automation)
  - [ ] How data is stored (encrypted, secure database)
  - [ ] User rights (revoke access, delete data)

**Terms of Service:**
- [ ] Terms of service exists at `https://agentc2.ai/terms`
- [ ] Terms include data handling and user responsibilities

### 4.2 Demo Video

**Recording Checklist:**
- [ ] Record screen capture (1080p, 2-5 minutes)
- [ ] Show AgentC2 login page
- [ ] Click "Continue with Google"
- [ ] Show Google consent screen with scopes
- [ ] Grant consent
- [ ] Show successful login to AgentC2
- [ ] Demonstrate one feature using Google data (e.g., Gmail agent)
- [ ] Upload to YouTube as **unlisted** video
- [ ] Copy YouTube URL: `_________________`

### 4.3 Verification Application

- [ ] Navigate to Google Cloud Console → OAuth consent screen
- [ ] Click "Publish App" → "Prepare for Verification"
- [ ] Fill out verification form:
  - [ ] Paste YouTube demo video URL
  - [ ] Explain scope usage:
    - **gmail.modify:** "AI agents read, send, and organize emails on behalf of users. Users delegate email management to conversational agents."
    - **calendar.events:** "AI agents schedule meetings, check availability, and manage calendar events based on user requests."
    - **drive.readonly:** "AI agents search user's Google Drive for documents and reference files during conversations."
    - **drive.file:** "AI agents create Google Docs for summaries, reports, or meeting notes as requested by users."
  - [ ] Provide privacy policy URL
  - [ ] Provide terms of service URL
  - [ ] Provide app homepage URL
- [ ] Submit verification application
- [ ] Note submission date: `_________________`

### 4.4 Await Google Review

- [ ] Check email daily for Google verification updates
- [ ] Address any feedback from Google
- [ ] Estimated wait time: 1-7 business days
- [ ] Verification approval received: **Date: _________________**

**If Verification Denied:**
- [ ] Review Google's feedback
- [ ] Address concerns (update privacy policy, reduce scopes, etc.)
- [ ] Resubmit application
- [ ] Consider alternative approaches (see Technical Design, Rollback Plan)

---

## Phase 5: Documentation

### 5.1 Developer Documentation

**File:** `docs/google-sso-setup.md`

- [ ] Create developer setup guide covering:
  - [ ] Google Cloud Console configuration steps
  - [ ] Environment variable setup
  - [ ] Local testing instructions
  - [ ] Production deployment checklist
  - [ ] Troubleshooting common errors

### 5.2 User Documentation

- [ ] Create user-facing help article (if applicable):
  - [ ] "How to Sign In with Google"
  - [ ] "What Google Data Does AgentC2 Access?"
  - [ ] "How to Revoke AgentC2's Access to Google"

### 5.3 Internal Runbook

- [ ] Create support runbook for troubleshooting:
  - [ ] OAuth error codes and meanings
  - [ ] How to check token status in database
  - [ ] How to manually trigger integration sync
  - [ ] How to reset user's Google connection

---

## Phase 6: Monitoring & Observability

### 6.1 Logging

- [ ] Verify OAuth events are logged:
  - [ ] Google OAuth flow initiated (user ID, timestamp)
  - [ ] Google OAuth success (user ID, scopes granted)
  - [ ] Google OAuth failure (error code, user ID)
  - [ ] Token refresh events (connection ID, success/failure)

### 6.2 Metrics (Optional)

- [ ] Set up dashboards (Grafana, Datadog, etc.):
  - [ ] Google OAuth success rate
  - [ ] OAuth error breakdown (by error type)
  - [ ] Token refresh success rate
  - [ ] Integration sync success rate

### 6.3 Alerts (Optional)

- [ ] Configure alerts:
  - [ ] Alert if Google OAuth success rate < 90%
  - [ ] Alert if token refresh failure rate > 10%
  - [ ] Alert if integration sync failure rate > 5%

---

## Validation Checklist

### Functional Validation

**Sign-Up Flow:**
- [ ] New user can sign up with personal Google account
- [ ] New user can sign up with Google Workspace account
- [ ] User record created with correct email and name
- [ ] Account record created with `providerId: "google"`
- [ ] Session cookie set with correct domain and flags
- [ ] User redirected to `/onboarding` after signup

**Sign-In Flow:**
- [ ] Existing user can sign in with Google
- [ ] User redirected to `/workspace` (skips onboarding)
- [ ] Session created and persists across page refreshes
- [ ] Sign-out works correctly

**Integration Sync:**
- [ ] Gmail connection auto-created after Google signup
- [ ] Google Calendar connection auto-created
- [ ] Google Drive connection auto-created
- [ ] Credentials encrypted in IntegrationConnection table
- [ ] Agent tools can access Gmail API

**Token Refresh:**
- [ ] Access token refreshes automatically before expiration
- [ ] Refresh token used to obtain new access token
- [ ] Updated tokens saved to database
- [ ] No user intervention required

**Error Handling:**
- [ ] Scope denial returns user to signup with error message
- [ ] Invalid credentials show helpful error
- [ ] Redirect URI mismatch shows error with troubleshooting info
- [ ] Network errors handled gracefully

### Security Validation

- [ ] OAuth state parameter includes HMAC signature
- [ ] State validated on callback (CSRF protection)
- [ ] Tokens encrypted at rest (AES-256-GCM)
- [ ] Session cookie is HTTP-only
- [ ] Session cookie is Secure (in production)
- [ ] Session cookie has SameSite=lax
- [ ] No tokens logged in plain text

### Performance Validation

- [ ] OAuth flow completes in < 5 seconds (excluding user interaction)
- [ ] Token refresh happens in < 2 seconds
- [ ] No memory leaks during OAuth flow
- [ ] Database queries optimized (no N+1 queries)

### Compatibility Validation

- [ ] Works in Chrome (latest)
- [ ] Works in Safari (latest)
- [ ] Works in Firefox (latest)
- [ ] Works on mobile browsers (iOS Safari, Chrome Android)
- [ ] Works with personal Google accounts
- [ ] Works with Google Workspace accounts
- [ ] Works across all deployment environments (local, production)

---

## Production Rollout Checklist

### Pre-Rollout

- [ ] All Phase 1-3 tasks completed
- [ ] Google OAuth verification approved
- [ ] Testing complete (all scenarios pass)
- [ ] Documentation published
- [ ] Support team trained on troubleshooting
- [ ] Rollback plan documented and tested

### Deployment

**Production Environment Variables:**
- [ ] SSH into production server
- [ ] Add environment variables:
  ```bash
  export GOOGLE_CLIENT_ID="production-client-id"
  export GOOGLE_CLIENT_SECRET="production-client-secret"
  ```
- [ ] Or update `.env` file on server
- [ ] Restart services:
  ```bash
  pm2 restart ecosystem.config.js --update-env
  pm2 status
  ```

**Verification:**
- [ ] Visit `https://agentc2.ai/login`
- [ ] Verify "Continue with Google" button appears
- [ ] Test OAuth flow with production Google account
- [ ] Verify no errors in production logs: `pm2 logs`

### Post-Rollout

- [ ] Monitor OAuth success rate for 24 hours
- [ ] Monitor error logs for OAuth-related issues
- [ ] Verify no spike in user support tickets
- [ ] Track adoption rate (% of new users using Google SSO)

**Rollout Success Metrics (7 days post-launch):**
- [ ] Google OAuth success rate > 95%
- [ ] Token refresh success rate > 99%
- [ ] Integration sync success rate > 98%
- [ ] < 5 support tickets related to Google OAuth
- [ ] > 30% of new signups using Google OAuth

---

## Troubleshooting Reference

### Issue: Button Doesn't Appear

**Checklist:**
- [ ] Environment variables set: `echo $GOOGLE_CLIENT_ID`
- [ ] Services restarted after env var change
- [ ] No errors in server startup logs
- [ ] Check Better Auth config loads Google provider: add debug log in `auth.ts`

---

### Issue: Redirect URI Mismatch

**Error Message:** `redirect_uri_mismatch` on Google consent screen

**Checklist:**
- [ ] Verify redirect URI in error message
- [ ] Compare with registered URIs in Google Cloud Console
- [ ] Check for typos (https vs http, port number, trailing slash)
- [ ] Ensure `NEXT_PUBLIC_APP_URL` environment variable matches
- [ ] Wait 5 minutes after adding URI (Google propagation delay)

**Common Mistakes:**
- Using `localhost:3000` instead of `localhost:3001`
- Missing `/api/auth/callback/google` path
- Using `http://` in production instead of `https://`

---

### Issue: Invalid Client Error

**Error Message:** `invalid_client` during token exchange

**Checklist:**
- [ ] Verify `GOOGLE_CLIENT_ID` matches Google Cloud Console
- [ ] Verify `GOOGLE_CLIENT_SECRET` matches Google Cloud Console
- [ ] Check for extra spaces or newlines in environment variables
- [ ] Ensure OAuth credentials are from correct Google Cloud project
- [ ] Verify credentials are not expired or revoked

---

### Issue: Access Denied Error

**Error Message:** `access_denied` after user interaction

**Cause:** User clicked "Cancel" or denied scopes

**Action:**
- [ ] This is expected behavior (user choice)
- [ ] Verify user is returned to signup page with clear message
- [ ] Offer alternative: "Or sign up with email"
- [ ] No action needed unless error persists without user denial

---

### Issue: Gmail Integration Not Created

**Checklist:**
- [ ] Check post-bootstrap hook is registered in `instrumentation.ts`
- [ ] Check server logs for "[Gmail Sync]" entries
- [ ] Verify `syncGmailFromAccount()` function ran
- [ ] Check for errors during sync:
  ```bash
  pm2 logs | grep "Gmail Sync"
  ```
- [ ] Manually trigger sync:
  ```bash
  curl -X POST http://localhost:3001/api/integrations/gmail/sync \
    -H "Content-Type: application/json" \
    -d '{"userId": "user-id", "organizationId": "org-id"}'
  ```
- [ ] Check `Account` table has tokens:
  ```sql
  SELECT accessToken IS NOT NULL, refreshToken IS NOT NULL 
  FROM account WHERE providerId = 'google' AND userId = '<user-id>';
  ```

---

### Issue: Token Refresh Fails

**Error Message:** `invalid_grant` during token refresh

**Cause:** User revoked access in Google account settings

**Solution:**
- [ ] Mark IntegrationConnection as inactive
- [ ] Show notification to user: "Gmail connection expired"
- [ ] Provide "Reconnect" button → restart OAuth flow
- [ ] User must re-grant consent

---

## Sign-Off

### Developer Sign-Off

- [ ] Configuration completed successfully
- [ ] All tests passed
- [ ] No errors in logs
- [ ] Documentation reviewed and approved

**Name:** _________________  
**Date:** _________________

### Product/QA Sign-Off

- [ ] Feature tested in staging environment
- [ ] All user scenarios validated
- [ ] Error handling is user-friendly
- [ ] Ready for production rollout

**Name:** _________________  
**Date:** _________________

---

## Notes & Observations

**Issues Encountered:**

---

**Improvements Identified:**

---

**Follow-Up Tasks:**

---

**Links & Resources:**
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Better Auth Documentation](https://better-auth.com/docs)
- [Google OAuth Verification Process](https://support.google.com/cloud/answer/9110914)
- [Technical Design Document](./google-sso-technical-design.md)
- [GitHub Issue #84](https://github.com/Appello-Prototypes/agentc2/issues/84)
