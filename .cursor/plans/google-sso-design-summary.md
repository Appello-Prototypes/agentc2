# Google SSO Implementation - Executive Summary

**Feature:** Add SSO with Google  
**GitHub Issue:** [#91](https://github.com/Appello-Prototypes/agentc2/issues/91)  
**Full Design:** [google-sso-design.md](./google-sso-design.md)

---

## TL;DR

**Current State:** Agent app has Google OAuth fully implemented. Frontend app only has email/password.

**Goal:** Add Google OAuth buttons to Frontend app sign-in and sign-up forms.

**Complexity:** Low - Infrastructure 90% complete, primarily frontend UI work.

**Effort:** Phase 1 MVP = 8-11 hours (1-2 days)

**Risk:** Low - Additive feature, no breaking changes, clear rollback path.

---

## Key Findings

### ✅ What Already Works

1. **Better Auth Configuration** - Google OAuth fully configured when env vars present
2. **OAuth Callback Handling** - `/api/auth/callback/google` exists in both apps
3. **Session Sharing** - Caddy architecture enables cross-app authentication
4. **Organization Bootstrap** - New Google users automatically assigned to orgs
5. **Gmail Auto-Sync** - Tokens from Better Auth Account converted to Gmail integration
6. **Agent App Implementation** - Complete reference implementation exists

### ❌ What's Missing

1. **Frontend Sign-In Form** - No Google OAuth button
2. **Frontend Sign-Up Form** - No Google OAuth button
3. **Google Cloud Console** - Missing `localhost:3000` redirect URI
4. **Documentation** - Internal docs need minor updates

---

## Implementation Plan

### Phase 1: MVP (Required)
**Effort:** 8-11 hours | **Files:** 2-3 | **Risk:** Low

**Tasks:**
1. Add Google OAuth button to Frontend sign-in form
2. Add Google OAuth button to Frontend sign-up form
3. Copy Agent app UI patterns (logo, styling, error handling)
4. Add `localhost:3000` redirect URI to Google Cloud Console
5. Test cross-app session sharing

**Deliverable:** Users can sign in/sign up with Google from Frontend app homepage and `/signup` page.

### Phase 2: Scope Optimization (High Priority)
**Effort:** 7-9 hours | **Files:** 6-8 | **Risk:** Medium

**Problem:** Current implementation requests Gmail scopes during basic sign-in (scope overreach).

**Solution:**
1. Create minimal SSO scopes (`openid`, `email`, `profile`)
2. Request integration scopes separately during onboarding
3. Use `linkSocial()` for scope upgrades

**Benefit:** +10-15% conversion improvement (cleaner consent screen).

### Phase 3-5: Enhancements (Optional)
- **Phase 3:** Microsoft OAuth parity (4-5 hours)
- **Phase 4:** Error handling polish (6-8 hours)
- **Phase 5:** Analytics and monitoring (12-15 hours)

---

## Critical Decisions Needed

### 1. Scope Strategy (High Priority)

**Question:** What scopes should Frontend app request during initial Google sign-in?

| Option | Scopes | Pros | Cons | Recommendation |
|--------|--------|------|------|----------------|
| **A. Minimal** | `openid`, `email`, `profile` | Cleaner UX, higher conversion | Requires scope upgrade flow (Phase 2) | ✅ Best long-term |
| **B. Full** | Gmail, Calendar, Drive | One-click setup | Complex consent screen | ✅ Quick MVP |

**Recommendation:** Start with Option B (match Agent app), implement Option A in Phase 2.

### 2. Post-Signup Redirect (Medium Priority)

**Question:** Where should users go after Google sign-up from Frontend app?

| Option | Destination | Pros | Cons | Recommendation |
|--------|-------------|------|------|----------------|
| **A. Frontend Dashboard** | `/dashboard` | Simple | Limited features | ❌ Poor UX |
| **B. Agent Onboarding** | `/onboarding` | Consistent, full features | Cross-app redirect | ✅ Best UX |
| **C. Frontend Onboarding** | `/onboarding` (new) | Self-contained | More implementation | ⚠️ If needed |

**Recommendation:** Option B - Redirect to Agent app `/onboarding` (session cookie shared via Caddy).

### 3. Microsoft OAuth Timing (Low Priority)

**Question:** Include Microsoft OAuth in Phase 1, or defer to Phase 3?

**Recommendation:** Include if time permits (adds 30 minutes per form), otherwise Phase 3.

---

## Technical Architecture

### OAuth Flow (Simplified)

```
[User] → Click "Continue with Google"
    ↓
[Frontend App] → signIn.social({ provider: "google" })
    ↓
[Better Auth] → Redirect to Google consent screen
    ↓
[Google] → User approves → Redirect to /api/auth/callback/google
    ↓
[Better Auth] → Exchange code for tokens → Create User + Account + Session
    ↓
[Bootstrap] → Assign user to organization (or defer to onboarding)
    ↓
[Redirect] → callbackURL (/onboarding or /dashboard)
```

### Session Sharing

```
Frontend App (port 3000) ←─┐
                             ├─ Shared Cookie (better-auth.session.token)
Agent App (port 3001) ←──────┘    via Caddy (catalyst.localhost)
```

**Result:** User signs in once on Frontend, automatically authenticated in Agent app.

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Scope overreach reduces conversions | Medium | High | Phase 2: minimal scopes |
| OAuth callback failures | Low | High | Thorough testing, error monitoring |
| Session sharing broken | Low | Medium | Verify Caddy config, test cross-app nav |
| Google verification required | Medium | Medium | Submit for verification or reduce scopes |

**Overall Risk:** 🟢 Low - Proven technology, existing implementation validates approach.

---

## Success Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| OAuth callback success rate | > 98% | Day 1 |
| Google OAuth adoption | > 40% of signups | Week 1 |
| Conversion rate improvement | +10-15% | Week 2 |
| Cross-app session success | > 99% | Day 1 |
| User-reported OAuth issues | < 5 per month | Month 1 |

---

## Pre-Implementation Checklist

**Environment Setup:**
- [ ] `GOOGLE_CLIENT_ID` in `.env`
- [ ] `GOOGLE_CLIENT_SECRET` in `.env`
- [ ] `BETTER_AUTH_SECRET` in `.env`
- [ ] `CREDENTIAL_ENCRYPTION_KEY` in `.env`

**Google Cloud Console:**
- [ ] OAuth 2.0 Client ID created
- [ ] Redirect URIs configured:
  - `http://localhost:3000/api/auth/callback/google`
  - `http://localhost:3001/api/auth/callback/google`
  - `https://agentc2.ai/api/auth/callback/google`
- [ ] OAuth consent screen published
- [ ] Scopes configured (basic or sensitive)

**Development Environment:**
- [ ] Caddy running (`./scripts/start-caddy.sh`)
- [ ] Frontend app running (port 3000)
- [ ] Agent app running (port 3001)
- [ ] Database running (PostgreSQL via Docker or Supabase)
- [ ] `https://catalyst.localhost` resolves to both apps

**Code Quality:**
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds

---

## Go/No-Go Decision

### ✅ Proceed If:
- Better Auth Google OAuth works in Agent app
- Google Cloud Console access available
- Caddy session sharing functional
- Development environment ready

### ❌ Defer If:
- Google verification required but not approved (users see "unverified" warning)
- Caddy session sharing broken (architecture issue)
- Agent app OAuth non-functional (deeper Better Auth issue)

**Current Status:** ✅ All prerequisites met - Ready to implement

---

## Quick Start (For Implementation Engineer)

1. **Read full design:** [google-sso-design.md](./google-sso-design.md) sections 1-8
2. **Review reference implementation:** `apps/agent/src/components/auth/sign-in-form.tsx`
3. **Copy patterns to Frontend app:**
   - Sign-in form: Add Google button + handler
   - Sign-up form: Add Google button + handler
4. **Test locally:** `bun run dev` → test OAuth flows
5. **Update Google Cloud Console:** Add `localhost:3000` redirect URI
6. **Deploy:** Follow deployment checklist in Section 15.2

**Estimated Time:** 1-2 days for complete Phase 1 implementation.

---

## Questions?

Refer to [google-sso-design.md](./google-sso-design.md) Section 17 (Open Questions) for detailed decision trees and recommendations.

**Contact:** Engineering Lead or Product Manager for scope/redirect strategy decisions.
