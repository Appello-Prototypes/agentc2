# Google SSO - Executive Summary

**Feature Request**: Add SSO with Google  
**GitHub Issue**: [#104](https://github.com/Appello-Prototypes/agentc2/issues/104)  
**Date**: 2026-03-08  
**Status**: ✅ **Code Complete** - Configuration Required

---

## TL;DR

**Google SSO is already fully implemented** in the AgentC2 codebase. The feature is production-ready and only requires environment variable configuration to enable.

**Time to production**: < 1 day (4 hours active work)  
**Code changes needed**: None  
**Risk level**: Low

---

## Current State

### What Exists ✅

The platform already has:
- ✅ Better Auth Google OAuth provider configured
- ✅ "Continue with Google" UI in sign-in/sign-up forms
- ✅ Complete OAuth flow (authorization → token exchange → session creation)
- ✅ Automatic Gmail, Calendar, Drive integration sync
- ✅ Token encryption at rest (AES-256-GCM)
- ✅ Organization bootstrapping (multi-tenant support)
- ✅ Cross-app session sharing (via Caddy)
- ✅ Rate limiting and CSRF protection

### What's Missing ❌

1. **Google OAuth client credentials** - Not configured in production `.env`
2. **Google Cloud Console OAuth app** - Needs to be created
3. **OAuth consent screen** - Needs configuration
4. **Scope re-consent flow** - Optional enhancement for better UX
5. **Frontend app OAuth** - Marketing site doesn't have Google button

---

## Architecture

```
User clicks "Continue with Google"
    ↓
Better Auth redirects to Google consent screen
    ↓
User grants permissions (Gmail, Calendar, Drive)
    ↓
Google redirects to /api/auth/callback/google
    ↓
Better Auth exchanges code for tokens (encrypted storage)
    ↓
Auto-bootstrap: Create/join organization
    ↓
Gmail sync: Copy tokens to IntegrationConnection
    ↓
User redirected to /onboarding → /workspace
```

**OAuth Scopes Requested**:
- `gmail.modify` - Full Gmail access (agents read/send emails)
- `calendar.events` - Calendar CRUD (agents schedule meetings)
- `drive.readonly` + `drive.file` - Drive search + doc creation

---

## Implementation Plan

### Phase 1: Enable Google OAuth (Day 1) - **CRITICAL**

**Tasks**:
1. Create Google Cloud Console OAuth app (30 min)
2. Configure consent screen (30 min)
3. Set environment variables (15 min)
4. Deploy and test (30 min)

**Deliverables**:
- Working Google SSO on production site
- "Continue with Google" button visible
- End-to-end OAuth flow functional

**Risk**: Low - code is production-ready

---

### Phase 2: Scope Re-Consent (Week 1-2) - **HIGH PRIORITY**

**Problem**: Users can deselect Gmail/Calendar scopes, breaking integrations.

**Solution**: 
- Detect missing scopes
- Show warning in onboarding
- Provide "Re-authenticate" button
- Block onboarding completion until scopes granted

**Files to Create**:
- `packages/auth/src/google-scope-validation.ts`
- `apps/agent/src/components/settings/GoogleReauthCard.tsx`

**Risk**: Medium - needs thorough testing of Better Auth `linkSocial()`

---

### Phase 3: Frontend App OAuth (Week 3-4) - **OPTIONAL**

**Goal**: Add Google OAuth to marketing site (apps/frontend).

**Benefit**: Consistent sign-up experience across all pages.

**Implementation**: Copy Google OAuth button from agent app to frontend app.

**Risk**: Low - reuses existing code

---

### Phase 4: Enterprise Features (Month 2-3) - **LOW PRIORITY**

**Features**:
- Google Workspace domain restrictions (only @acme.com allowed)
- Multiple Gmail accounts per organization
- Account unlinking UI
- OAuth metrics dashboard

**Benefit**: Enterprise readiness for large customers.

**Risk**: Medium - significant new features

---

## Google Verification

**Required for**: >100 users, remove "unverified app" warning

**Process**:
1. Submit verification request to Google
2. Provide justification for sensitive scopes (Gmail, Drive)
3. Upload YouTube video showing scope usage
4. Wait 4-6 weeks for approval

**Recommendation**: Submit immediately after Phase 1 deployment (parallel track).

---

## Impact Assessment

### User Experience

**Positive**:
- ⚡ **3x faster sign-up** (3 seconds vs. 30+ seconds)
- 🔐 **No password needed** (Google handles auth)
- 🤖 **Auto-configured agents** (Gmail tools work immediately)
- 📧 **Professional experience** (enterprise-grade OAuth)

**Concerns**:
- ⚠️ Users may be confused why AgentC2 needs Gmail access
- ⚠️ "This app isn't verified" warning (until verification complete)
- ⚠️ Some users may distrust broad Gmail scopes

**Mitigation**: Clear explainer text, update privacy policy, fast verification submission.

### Security

**Improvements**:
- ✅ Google handles 2FA (no password storage needed)
- ✅ OAuth tokens encrypted at rest (AES-256-GCM)
- ✅ Automatic token refresh (reduces expired credential exposure)

**Risks**:
- ⚠️ Broad Gmail scope (`gmail.modify` = read, send, delete)
- ⚠️ Token compromise risk (if encryption key leaked)

**Mitigation**: Encrypt tokens at rest, rotate keys quarterly, scope justification in consent screen.

### Compliance

**GDPR**:
- ✅ Consent: User explicitly grants via OAuth
- ✅ Right to erasure: Account deletion implemented
- ⚠️ Privacy policy: Must document Google data usage

**CCPA**:
- ✅ Notice: Users informed via consent screen
- ⚠️ Third-party sharing: Must disclose Google in privacy policy

**Action Required**: Update privacy policy before Phase 1 deployment.

---

## Success Metrics

**Phase 1 Targets** (30 days post-launch):
- Google OAuth adoption: **> 30% of new sign-ups**
- OAuth success rate: **> 95%**
- Gmail sync success rate: **> 90%**
- Support tickets (OAuth issues): **< 5% of Google sign-ups**

**Monitoring**:
- Daily: Google sign-up count, success rate
- Weekly: Scope consent breakdown, sync failures
- Monthly: Adoption trends, compare to email/password

---

## Resource Requirements

### Phase 1 (Day 1)

**Engineering**: 4-6 hours
- Google Cloud Console setup: 1 hour
- Environment configuration: 30 min
- Testing: 1 hour
- Documentation: 1-2 hours

**Infrastructure**: None (uses existing Better Auth)

**Cost**: $0 (Google OAuth is free)

### Phase 2-4 (Weeks 1-8)

**Engineering**: 4-5 weeks total
- Phase 2: 1 week (scope management)
- Phase 3: 3 days (frontend OAuth)
- Phase 4: 2-3 weeks (enterprise features)

**Cost**: Negligible operational cost (<$20/month for logs)

---

## Decision Required

### Option 1: Enable Now (Recommended) ✅

**Pros**:
- ✅ Immediate user value
- ✅ Competitive with other AI platforms
- ✅ Improves conversion rate
- ✅ No code changes needed
- ✅ Low risk (rollback in 5 minutes)

**Cons**:
- ⚠️ "Unverified app" warning (until Google approves)
- ⚠️ 100 user limit (until verified)

**Timeline**: Today

---

### Option 2: Wait for Verification

**Pros**:
- ✅ No "unverified" warning
- ✅ No user limit

**Cons**:
- ❌ 4-6 week delay before any users can use it
- ❌ Verification process blocks other work
- ❌ Can't test with real users until verified

**Timeline**: 4-6 weeks from now

---

### Recommendation: **Option 1** (Enable Immediately)

**Rationale**:
1. Code is production-ready (no risks from new code)
2. Can test with internal team + 100 test users
3. Submit verification in parallel (doesn't block rollout)
4. Easy rollback if issues (remove env vars)
5. Faster feedback loop with real users

**Next Step**: Assign engineer to complete Phase 1 checklist (4 hours).

---

## Questions?

- **Technical Details**: See `docs/designs/google-sso-design.md` (comprehensive 2000+ line design doc)
- **Setup Instructions**: See `docs/google-sso-setup-guide.md` (step-by-step guide)
- **Implementation Checklist**: See `docs/designs/google-sso-checklist.md` (task tracking)

**Contact**: Engineering team for technical questions, Product team for prioritization.

---

## Approval

- [ ] **Product Manager**: Approved to proceed with Phase 1
- [ ] **Engineering Lead**: Resources allocated
- [ ] **Security Lead**: Security review complete
- [ ] **Compliance Lead**: Privacy policy update approved

**Approval Date**: ___________  
**Target Launch**: ___________

---

**Status**: 🟢 Ready to implement - awaiting approval