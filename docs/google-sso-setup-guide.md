# Google SSO Setup Guide

**Quick Reference**: Configuration steps to enable Google OAuth in AgentC2

**Related**: See [google-sso-design.md](./designs/google-sso-design.md) for comprehensive technical design.

---

## Prerequisites

- Access to Google Cloud Console
- Admin access to AgentC2 production environment
- Access to production `.env` file

---

## Setup Steps

### Step 1: Create Google OAuth App (30 minutes)

1. **Go to Google Cloud Console**:
   - Visit: https://console.cloud.google.com/apis/credentials
   - Select project or create new one: "AgentC2 Production"

2. **Enable Required APIs**:
   - Go to **APIs & Services** → **Enabled APIs & services**
   - Click **+ Enable APIs and Services**
   - Search and enable:
     - Google+ API (for OAuth)
     - Gmail API
     - Google Calendar API
     - Google Drive API

3. **Create OAuth Client**:
   - Click **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `AgentC2 Production`
   
4. **Configure Authorized Redirect URIs**:
   ```
   https://agentc2.ai/api/auth/callback/google
   https://catalyst.localhost/api/auth/callback/google
   http://localhost:3001/api/auth/callback/google
   ```

5. **Save Credentials**:
   - Copy **Client ID** (format: `123456789-abc.apps.googleusercontent.com`)
   - Copy **Client Secret** (format: `GOCSPX-abc123xyz789`)

### Step 2: Configure OAuth Consent Screen (30 minutes)

1. **Go to OAuth Consent Screen**:
   - **APIs & Services** → **OAuth consent screen**

2. **Select User Type**:
   - **External** - For all Google accounts (choose this)
   - **Internal** - Only for Google Workspace (enterprise only)

3. **App Information**:
   - **App name**: AgentC2
   - **User support email**: support@agentc2.ai
   - **App logo**: [Upload logo - 120x120px PNG]
   - **Application home page**: https://agentc2.ai
   - **Application privacy policy**: https://agentc2.ai/privacy
   - **Application terms of service**: https://agentc2.ai/terms
   - **Authorized domains**: `agentc2.ai`

4. **Developer Contact**:
   - Email: dev@agentc2.ai

5. **Click**: Save and Continue

### Step 3: Add OAuth Scopes (15 minutes)

1. **Click**: Add or Remove Scopes

2. **Search and Select**:
   ```
   https://www.googleapis.com/auth/gmail.modify
   https://www.googleapis.com/auth/calendar.events
   https://www.googleapis.com/auth/drive.readonly
   https://www.googleapis.com/auth/drive.file
   ```

3. **Scope Descriptions** (as shown to users):
   - **Gmail**: Read, compose, send, and permanently delete all your email
   - **Calendar**: View and edit events on all your calendars
   - **Drive (readonly)**: View files in your Google Drive
   - **Drive (file)**: View and manage files created by this app

4. **Click**: Update → Save and Continue

### Step 4: Add Test Users (If Unverified) (5 minutes)

1. **Add Test Users** page:
   - Click **+ Add Users**
   - Enter email addresses of team members
   - Click **Save**

**Note**: Limit of 100 test users until app is verified.

### Step 5: Publish App (Optional - For Testing)

1. **Review Summary** page:
   - Click **Back to Dashboard**
   - Click **Publish App** button
   - Confirm: "Make app available to test users"

**Note**: For production use with >100 users, must submit for verification.

---

## Configuration

### Environment Variables

Add to production `.env`:

```bash
# Google OAuth (SSO)
GOOGLE_CLIENT_ID="1234567890-abc123def456.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-abc123def456xyz789"

# Verify these are already set
BETTER_AUTH_SECRET="<should-already-exist>"
CREDENTIAL_ENCRYPTION_KEY="<should-already-exist>"
NEXT_PUBLIC_APP_URL="https://agentc2.ai"
```

### Deploy Changes

```bash
# SSH to production server
ssh deploy@<production-host>

# Navigate to deployment directory
cd /var/www/agentc2

# Edit .env file
nano .env
# Paste:
# GOOGLE_CLIENT_ID="<your-client-id>"
# GOOGLE_CLIENT_SECRET="<your-client-secret>"

# Restart PM2 processes with new env vars
pm2 restart ecosystem.config.js --update-env

# Verify processes running
pm2 status
```

---

## Verification

### Manual Testing

1. **Visit Sign-Up Page**:
   ```
   https://agentc2.ai/signup
   ```

2. **Verify Button Visible**:
   - Look for "Continue with Google" button
   - Should have Google logo (4-color icon)
   - Should be above email/password form

3. **Test OAuth Flow**:
   - Click "Continue with Google"
   - Select Google account (or sign in)
   - Review permissions:
     - Gmail
     - Google Calendar
     - Google Drive
   - Click "Allow"

4. **Verify Redirect**:
   - Should redirect to: `https://agentc2.ai/onboarding`
   - Should see onboarding wizard
   - Should show "Gmail connected" status

5. **Complete Onboarding**:
   - Follow onboarding steps
   - Click "Continue to workspace"

6. **Verify Gmail Integration**:
   - Go to workspace
   - Open agent chat
   - Try command: "Show my recent emails"
   - Verify: Agent can access Gmail

### Database Verification

```sql
-- Check user was created
SELECT id, name, email, "createdAt" 
FROM "User" 
WHERE email = 'test@example.com';

-- Check Google account was linked
SELECT "providerId", "accountId", "scope", "accessTokenExpiresAt"
FROM "Account"
WHERE "userId" = '<user-id-from-above>' AND "providerId" = 'google';

-- Check session was created
SELECT token, "expiresAt", "ipAddress"
FROM "Session"
WHERE "userId" = '<user-id-from-above>';

-- Check Gmail integration was synced
SELECT ic."providerId", ic."isActive", ic.metadata->>'gmailAddress'
FROM "IntegrationConnection" ic
JOIN "Membership" m ON ic."organizationId" = m."organizationId"
WHERE m."userId" = '<user-id-from-above>' AND ic."providerId" = 'gmail';
```

### Troubleshooting

#### "Continue with Google" Button Not Visible

**Cause**: Environment variables not set or Better Auth not loaded.

**Fix**:
```bash
# Check env vars are set
pm2 logs agent --lines 50 | grep GOOGLE_CLIENT_ID
# Should see: (logs may redact value)

# Restart with fresh env
pm2 restart ecosystem.config.js --update-env
```

#### OAuth Redirect Error "redirect_uri_mismatch"

**Cause**: Redirect URI not whitelisted in Google Cloud Console.

**Fix**:
1. Go to Google Cloud Console → Credentials
2. Edit OAuth client
3. Add: `https://agentc2.ai/api/auth/callback/google`
4. Save and retry

#### "This app isn't verified" Warning

**Cause**: Normal for unverified apps (< 100 users).

**Options**:
- **Ignore**: Users can click "Advanced" → "Go to AgentC2 (unsafe)" to proceed
- **Submit for verification**: 4-6 week process (see below)
- **Add test users**: Users in test user list don't see warning

#### Gmail Sync Failed After Sign-Up

**Cause**: User deselected Gmail scope on consent screen.

**Fix**:
1. Go to Settings → Integrations
2. Look for "Gmail" section
3. Click "Reconnect" (if implemented)
4. Grant all permissions this time

---

## Google Verification (For Production)

**When to Submit**: After 100 test users OR when ready for public launch.

### Submission Process

1. **Prepare Materials**:
   - ✅ YouTube video (< 3 minutes) showing how AgentC2 uses Gmail/Drive scopes
   - ✅ Screenshots of consent screen and key features
   - ✅ Link to privacy policy (must be publicly accessible)
   - ✅ Link to terms of service
   - ✅ Justification for each sensitive scope (see Appendix B in design doc)

2. **Submit for Review**:
   - Google Cloud Console → OAuth consent screen
   - Click "Prepare for verification"
   - Fill out questionnaire
   - Upload materials
   - Submit

3. **Google Review**:
   - Initial review: 1-2 weeks
   - Feedback rounds: 1-2 iterations
   - **Total time**: 4-6 weeks typically

4. **Post-Approval**:
   - "This app isn't verified" warning disappears
   - No 100 user limit
   - Consent screen shows verified badge

### Verification Tips

- **Be specific**: Explain exactly how each scope is used
- **Show UI**: Include screenshots of features requiring scopes
- **Video quality**: Screen recording with voiceover is sufficient
- **Response time**: Respond to Google feedback within 7 days (or verification expires)

---

## Monitoring

### Key Metrics to Track

```sql
-- Google sign-ups in last 24 hours
SELECT COUNT(*) 
FROM "Account" 
WHERE "providerId" = 'google' 
AND "createdAt" > NOW() - INTERVAL '24 hours';

-- Gmail sync success rate
SELECT 
    COUNT(*) FILTER (WHERE ic.id IS NOT NULL) * 100.0 / COUNT(*) as sync_rate
FROM "Account" a
LEFT JOIN "Membership" m ON a."userId" = m."userId"
LEFT JOIN "IntegrationConnection" ic ON m."organizationId" = ic."organizationId" AND ic."providerId" = 'gmail'
WHERE a."providerId" = 'google';

-- Active Google OAuth sessions
SELECT COUNT(*) 
FROM "Session" s
JOIN "Account" a ON s."userId" = a."userId"
WHERE a."providerId" = 'google' AND s."expiresAt" > NOW();
```

### Alerts to Configure

- Google OAuth callback 5xx rate > 1%
- Gmail sync failure rate > 5%
- Token refresh failure rate > 1%

---

## Support

### Common User Questions

**Q: Why does AgentC2 need access to my Gmail?**  
A: AgentC2 agents automate email workflows - reading, sending, archiving, and organizing emails based on your instructions. Without Gmail access, agents can't help with email-related tasks.

**Q: Can I use Google OAuth without granting Gmail access?**  
A: Currently, no. Gmail and Calendar are core features. You can use email/password sign-up instead if you prefer not to connect Gmail.

**Q: Can I revoke access later?**  
A: Yes. You can disconnect your Google account anytime from Settings → Integrations, or revoke access directly from your Google account settings (myaccount.google.com/permissions).

**Q: Is my data secure?**  
A: Yes. All OAuth tokens are encrypted at rest using AES-256-GCM. AgentC2 only accesses your Gmail when you explicitly ask agents to perform email-related tasks.

**Q: What if I have multiple Google accounts?**  
A: Currently, you can link one Google account per user. Multi-account support is planned for a future release.

---

## Rollback

If issues arise:

```bash
# Quick disable (< 5 minutes)
ssh deploy@<production-host>
cd /var/www/agentc2
nano .env
# Remove or comment out:
# GOOGLE_CLIENT_ID="..."
# GOOGLE_CLIENT_SECRET="..."

pm2 restart ecosystem.config.js --update-env
```

Users will see email/password option only. Existing Google-linked accounts remain active.

---

## Next Steps

1. ✅ Complete this setup guide
2. ⏳ Submit for Google verification (background task)
3. 📊 Monitor adoption metrics for first 2 weeks
4. 🚀 Plan Phase 2 (scope management) based on user feedback

---

**Questions?** Contact the engineering team or refer to the full design document.