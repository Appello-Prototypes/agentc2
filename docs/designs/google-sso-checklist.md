# Google SSO Implementation Checklist

**Feature**: Add SSO with Google  
**GitHub Issue**: [#104](https://github.com/Appello-Prototypes/agentc2/issues/104)  
**Status**: Ready for Configuration

---

## Phase 1: Configuration & Deployment (Critical - Day 1)

**Goal**: Enable existing Google OAuth implementation in production.

### Google Cloud Console Setup

- [ ] Create Google Cloud project (or select existing)
- [ ] Enable required APIs:
  - [ ] Google+ API (OAuth)
  - [ ] Gmail API
  - [ ] Google Calendar API
  - [ ] Google Drive API
- [ ] Create OAuth 2.0 client credentials
  - [ ] Application type: Web application
  - [ ] Name: AgentC2 Production
- [ ] Configure authorized redirect URIs:
  - [ ] `https://agentc2.ai/api/auth/callback/google`
  - [ ] `https://catalyst.localhost/api/auth/callback/google`
  - [ ] `http://localhost:3001/api/auth/callback/google`
- [ ] Save Client ID and Client Secret

### OAuth Consent Screen Configuration

- [ ] Select user type: External (or Internal for Workspace-only)
- [ ] Fill app information:
  - [ ] App name: AgentC2
  - [ ] User support email: support@agentc2.ai
  - [ ] Developer contact: dev@agentc2.ai
  - [ ] App logo: [Upload 120x120px PNG]
  - [ ] App domain: agentc2.ai
  - [ ] Authorized domain: agentc2.ai
  - [ ] Privacy policy: https://agentc2.ai/privacy
  - [ ] Terms of service: https://agentc2.ai/terms
- [ ] Add OAuth scopes:
  - [ ] `https://www.googleapis.com/auth/gmail.modify`
  - [ ] `https://www.googleapis.com/auth/calendar.events`
  - [ ] `https://www.googleapis.com/auth/drive.readonly`
  - [ ] `https://www.googleapis.com/auth/drive.file`
- [ ] Add test users (if unverified):
  - [ ] Internal team members
  - [ ] Beta testers
- [ ] Save and publish app (testing mode)

### Environment Configuration

- [ ] Add to production `.env`:
  ```bash
  GOOGLE_CLIENT_ID="<client-id>"
  GOOGLE_CLIENT_SECRET="<client-secret>"
  ```
- [ ] Verify required variables exist:
  - [ ] `BETTER_AUTH_SECRET`
  - [ ] `CREDENTIAL_ENCRYPTION_KEY`
  - [ ] `NEXT_PUBLIC_APP_URL`
  - [ ] `DATABASE_URL`

### Deployment

- [ ] Push `.env` changes to production server
- [ ] Restart PM2 processes:
  ```bash
  pm2 restart ecosystem.config.js --update-env
  ```
- [ ] Verify processes healthy:
  ```bash
  pm2 status
  ```

### Testing (End-to-End)

- [ ] Visit production site: https://agentc2.ai/signup
- [ ] Verify "Continue with Google" button visible
- [ ] Click button → redirects to Google consent screen
- [ ] Grant all permissions
- [ ] Verify redirect to /onboarding
- [ ] Complete onboarding flow
- [ ] Check database:
  - [ ] User record created
  - [ ] Account record created (providerId: "google")
  - [ ] Session record created
  - [ ] Membership record created
  - [ ] IntegrationConnection created (Gmail)
- [ ] Verify Gmail tools work in agent chat
- [ ] Test sign-in with existing Google account

### Documentation

- [ ] Create setup guide: `docs/google-sso-setup-guide.md` ✅
- [ ] Create design document: `docs/designs/google-sso-design.md` ✅
- [ ] Update privacy policy (Google OAuth section)
- [ ] Update internal docs: `docs/internal/authentication.md`

### Google Verification Submission (Parallel Track)

- [ ] Prepare verification materials:
  - [ ] YouTube video (< 3 minutes) showing scope usage
  - [ ] Screenshots of key features
  - [ ] Scope justification document
- [ ] Submit for verification via Google Cloud Console
- [ ] Track verification status (4-6 week timeline)
- [ ] Respond to Google feedback within 7 days

**Phase 1 Complete**: When Google OAuth works in production for test users.

---

## Phase 2: Scope Management (Week 1-2)

**Goal**: Handle edge cases where users deselect required scopes.

### Scope Validation

- [ ] Create `packages/auth/src/google-scope-validation.ts`
- [ ] Implement `validateScopes()` function
- [ ] Add scope checking to Gmail sync process
- [ ] Return missing scopes to caller

### Re-Authentication UI

- [ ] Create `GoogleReauthCard` component
- [ ] Show missing scopes with human-readable labels
- [ ] Add "Grant Permissions" button
- [ ] Integrate with `linkSocial()` from Better Auth

### Onboarding Integration

- [ ] Modify `ConnectStep` component
- [ ] Detect missing scopes during onboarding
- [ ] Show inline warning if scopes incomplete
- [ ] Prevent completion until required scopes granted

### Settings Integration

- [ ] Add "Google Account" section in Settings → Integrations
- [ ] Show connected scopes status
- [ ] Show "Re-authenticate" button if scopes missing
- [ ] Display last sync timestamp

### Testing

- [ ] Test: Sign up with Google, deselect Gmail scope
- [ ] Verify: Warning shown in onboarding
- [ ] Test: Click "Grant Permissions" and re-auth
- [ ] Verify: Scope granted, Gmail syncs successfully

**Phase 2 Complete**: When scope re-consent flow is fully functional.

---

## Phase 3: Frontend OAuth (Week 3-4)

**Goal**: Add Google OAuth to frontend marketing app.

### Dependencies

- [ ] Add `@repo/auth` to `apps/frontend/package.json`
- [ ] Run `bun install` in frontend app

### UI Components

- [ ] Copy Google logo SVG to frontend components
- [ ] Update `apps/frontend/src/components/auth/sign-up-form.tsx`
  - [ ] Add "Continue with Google" button
  - [ ] Add social loading state
  - [ ] Configure callback: `/agent/onboarding`
- [ ] Update `apps/frontend/src/components/auth/sign-in-form.tsx`
  - [ ] Add "Continue with Google" button
  - [ ] Match styling with agent app

### Testing

- [ ] Test: Sign up from frontend app via Google
- [ ] Verify: Redirects to agent app onboarding
- [ ] Verify: Session cookie shared across apps
- [ ] Test: Sign in from frontend app via Google
- [ ] Verify: Redirects to workspace correctly

**Phase 3 Complete**: When frontend app has full Google OAuth support.

---

## Phase 4: Enterprise Features (Month 2-3)

**Goal**: Add enterprise-grade controls and features.

### Domain Restrictions

- [ ] Create `packages/auth/src/google-domain-validation.ts`
- [ ] Add `GOOGLE_ALLOWED_DOMAINS` env var support
- [ ] Add `GOOGLE_REQUIRE_WORKSPACE_ACCOUNT` env var
- [ ] Validate domain in Better Auth callback hook
- [ ] Add domain management UI in admin portal

### Multiple Google Accounts Per Org

- [ ] Modify Gmail sync to support multiple accounts
- [ ] Add `userId` tracking to IntegrationConnection
- [ ] Create account selection UI in settings
- [ ] Update Gmail tools to accept account parameter
- [ ] Test with multiple members connecting Gmail

### Account Unlinking

- [ ] Create API route: `/api/integrations/google/disconnect`
- [ ] Add disconnect button in settings
- [ ] Show confirmation dialog with warnings
- [ ] Delete Account and IntegrationConnection records
- [ ] Test: Verify agents can't access Gmail after disconnect

### Enhanced Monitoring

- [ ] Add provider-specific auth metrics
- [ ] Track OAuth error rates by provider
- [ ] Alert on token refresh failures
- [ ] Create OAuth health dashboard

**Phase 4 Complete**: When all enterprise features are live.

---

## Success Metrics

### Phase 1 (Configuration)

- [ ] "Continue with Google" button visible: **Yes/No**
- [ ] OAuth flow completion rate: **> 90%**
- [ ] Gmail sync success rate: **> 85%**
- [ ] Google sign-up adoption: **> 20% of total sign-ups**

### Phase 2 (Scope Management)

- [ ] Users with missing scopes prompted: **100%**
- [ ] Re-authentication success rate: **> 80%**
- [ ] Support tickets about Gmail not working: **< 5% of Google sign-ups**

### Phase 3 (Frontend OAuth)

- [ ] Frontend sign-up conversion rate: **+15-25% improvement**
- [ ] Cross-app session sharing: **100% success rate**

### Phase 4 (Enterprise Features)

- [ ] Enterprise customers using domain restrictions: **> 5 orgs**
- [ ] Orgs with multiple Gmail accounts: **> 10 orgs**

---

## Risk Register

| Risk | Mitigation | Owner | Status |
|------|------------|-------|--------|
| Google verification delayed (>6 weeks) | Enable for test users first, communicate timeline | Product | ⏳ |
| Users confused by scope requests | Add explainer modal before OAuth | Design | 📋 |
| Token encryption key leaked | Use env secrets, rotate quarterly, monitor access | Security | ✅ |
| Gmail API quota exceeded | Implement rate limiting, monitor usage | Engineering | ✅ |
| Better Auth Google provider bug | Pin version, test thoroughly, have rollback plan | Engineering | ✅ |

---

## Rollback Plan

### Immediate Rollback (< 5 minutes)

```bash
# SSH to production
ssh deploy@<production-host>

# Remove Google OAuth env vars
cd /var/www/agentc2
sed -i '/GOOGLE_CLIENT_ID=/d' .env
sed -i '/GOOGLE_CLIENT_SECRET=/d' .env

# Restart processes
pm2 restart ecosystem.config.js --update-env
pm2 status
```

**Verification**:
- [ ] "Continue with Google" button hidden
- [ ] Email/password sign-up still works
- [ ] Existing Google sessions remain active
- [ ] No errors in PM2 logs

### Post-Rollback

- [ ] Notify users via status page (if needed)
- [ ] Analyze root cause of rollback
- [ ] Create bug ticket if code issue found
- [ ] Plan re-enablement after fix

---

## Sign-Off

### Phase 1 (Required for Production)

- [ ] **Engineering Lead**: Code audit complete, implementation verified
- [ ] **Product Manager**: User experience reviewed, copy approved
- [ ] **Security Lead**: Security review complete, no blocking issues
- [ ] **Compliance Lead**: Privacy policy updated, GDPR requirements met

### Phase 2-4 (Enhancements)

- [ ] **Product Manager**: Prioritization confirmed
- [ ] **Engineering Lead**: Effort estimates reviewed
- [ ] **Design Lead**: UI mockups approved (if applicable)

---

## Timeline Summary

| Phase | Duration | Dependencies | Status |
|-------|----------|--------------|--------|
| **Phase 1**: Configuration | 1 day | Google Cloud Console access | 🟡 Ready to start |
| **Phase 2**: Scope Management | 1 week | Phase 1 complete | 📋 Planned |
| **Phase 3**: Frontend OAuth | 3 days | Phase 1 complete | 📋 Planned |
| **Phase 4**: Enterprise Features | 2-3 weeks | Phase 2, 3 complete | 📋 Planned |
| **Google Verification** | 4-6 weeks | Phase 1 complete | ⏳ Parallel track |

**Total Time to MVP**: 1 day (Phase 1 only)  
**Total Time to Full Implementation**: 4-5 weeks (all phases)

---

## Notes

- ✅ **Code is production-ready** - no implementation needed for Phase 1
- ✅ **Security reviewed** - Better Auth is battle-tested, encryption in place
- ⚠️ **Google verification required** for >100 users - submit immediately
- 💡 **Quick win** - Phase 1 is configuration-only, can deploy today

**Last Updated**: 2026-03-08  
**Document Owner**: Engineering Team
