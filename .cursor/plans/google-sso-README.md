# Google SSO Feature Design - Document Index

**GitHub Issue:** [#84 - Add SSO with Google](https://github.com/Appello-Prototypes/agentc2/issues/84)  
**Status:** Design Complete - Ready for Review  
**Created:** March 8, 2026  
**Branch:** `cursor/google-sso-design-eb79`

---

## Quick Start

### For Executives & Product Managers
👉 **Read:** [Executive Summary](./google-sso-executive-summary.md)  
⏱️ **Time:** 5 minutes  
📋 **Summary:** High-level overview, business impact, and recommendations

### For Engineers & Implementers
👉 **Read:** [Implementation Checklist](./google-sso-implementation-checklist.md)  
⏱️ **Time:** 10 minutes  
📋 **Summary:** Step-by-step configuration and testing guide

### For Technical Reviewers & Architects
👉 **Read:** [Technical Design Document](./google-sso-technical-design.md)  
⏱️ **Time:** 30-45 minutes  
📋 **Summary:** Complete architecture, security analysis, and implementation details

### For Visual Learners
👉 **Read:** [Architecture Diagrams](./google-sso-architecture-diagram.md)  
⏱️ **Time:** 10 minutes  
📋 **Summary:** Flow diagrams, component maps, and data architecture

---

## Document Overview

### 1. [Executive Summary](./google-sso-executive-summary.md)

**Audience:** Leadership, Product Managers, Stakeholders  
**Contents:**
- TL;DR (feature already implemented)
- Current status and gaps
- Implementation phases
- Risk assessment
- Resource estimates
- Business impact
- Next steps and approvals

**Key Finding:** Google SSO is fully implemented. Only configuration and testing needed.

---

### 2. [Technical Design Document](./google-sso-technical-design.md)

**Audience:** Engineering Team, Technical Architects, Security Reviewers  
**Contents:**
- Architecture overview and OAuth flow
- Detailed component analysis
  - Better Auth configuration
  - OAuth scopes breakdown
  - UI components (login/signup forms)
  - Database schema
  - Integration sync system
  - Admin portal implementation
- Security considerations
- Token management
- Gap analysis
- Phased implementation plan
- Impact assessment
- Testing strategy
- Compliance requirements (Google verification)
- Troubleshooting guide
- Appendices with code references

**Length:** ~2,500 lines / 56 pages  
**Depth:** Comprehensive architecture and implementation details

---

### 3. [Implementation Checklist](./google-sso-implementation-checklist.md)

**Audience:** Engineers, DevOps, QA Team  
**Contents:**
- Pre-implementation verification
- Phase 1: Google Cloud Console setup (step-by-step)
- Phase 2: Environment configuration
- Phase 3: Testing and validation
  - Personal Google accounts
  - Google Workspace accounts
  - Error scenarios
  - Integration testing
  - Cross-browser testing
- Phase 4: Google OAuth verification submission
- Phase 5: Documentation
- Phase 6: Monitoring setup
- Production rollout checklist
- Troubleshooting quick reference
- Sign-off section

**Format:** Checkbox-style actionable tasks  
**Purpose:** Hands-on implementation guide

---

### 4. [Architecture Diagrams](./google-sso-architecture-diagram.md)

**Audience:** Engineers, Architects, Technical Reviewers  
**Contents:**
- OAuth 2.0 flow diagram (detailed step-by-step)
- Data storage architecture (User, Account, IntegrationConnection)
- Component interaction map
- Token lifecycle (acquisition, storage, refresh, revocation)
- Security architecture (CSRF, encryption, cookies, database)
- Multi-tenant architecture
- Agent app vs. Admin portal comparison
- Integration touchpoints
- Deployment architecture
- User journey map
- Error handling flows
- OAuth pattern comparison (Google vs. Microsoft vs. Dropbox)
- Configuration matrix (local vs. production)
- Feature flags and conditional behavior

**Format:** ASCII diagrams and tables  
**Purpose:** Visual understanding of system architecture

---

## Key Findings Summary

### What's Already Built

✅ **Complete OAuth Implementation**
- Better Auth Google social provider
- OAuth 2.0 with refresh tokens
- CSRF protection via state parameter
- Token encryption (AES-256-GCM)

✅ **User Interface**
- "Continue with Google" buttons on login and signup pages
- Google logo SVG components
- Loading states and error handling
- Mobile-responsive design

✅ **Database Schema**
- User, Account, Session models (Better Auth)
- IntegrationConnection model (agent tools)
- Encrypted credential storage

✅ **Integration Sync**
- Automatic Gmail connection creation after signup
- Google Calendar connection auto-created
- Google Drive connection auto-created
- Blueprint-based agent provisioning

✅ **Security Measures**
- CSRF protection (HMAC-signed state)
- HTTP-only cookies
- Token encryption at rest
- Automatic token refresh
- Session timeout (30 minutes idle)

### What's Needed

⚙️ **Configuration (Required)**
- Create Google Cloud Console OAuth app
- Configure OAuth consent screen
- Add redirect URIs
- Set environment variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- Restart services

🧪 **Testing (Required)**
- Personal Google account flows
- Google Workspace account flows
- Token refresh validation
- Integration sync verification
- Cross-browser testing

📋 **Compliance (Required for Production)**
- Submit for Google OAuth verification
- Await approval (1-7 days)
- Address any Google feedback

📖 **Documentation (Recommended)**
- Developer setup guide
- User-facing help articles
- Troubleshooting runbook

---

## Implementation Effort

| Phase | Description | Effort | Dependencies |
|-------|-------------|--------|-------------|
| **Phase 1** | Google Cloud Console setup | 30-45 min | Google account |
| **Phase 2** | Testing & validation | 2-4 hours | Test accounts |
| **Phase 3** | Google verification | 1 hour + 1-7 days | Privacy policy, demo video |
| **Phase 4** | Documentation | 2-3 hours | None |
| **Total** | **6-9 hours active work** | **+ 1-7 days wait** |

**Cost:** $0 (Google OAuth is free)  
**Risk:** Low (configuration only, no code changes)

---

## Quick Reference

### Configuration Commands

**Generate Better Auth Secret:**
```bash
openssl rand -base64 32
```

**Generate Credential Encryption Key:**
```bash
openssl rand -hex 32
```

**Check if Google OAuth is Enabled:**
```bash
# Agent app
curl http://localhost:3001/api/auth/google/enabled

# Admin portal
curl http://localhost:3002/admin/api/auth/google/enabled
```

**Restart Services:**
```bash
# Development
# Ctrl+C to stop, then:
bun run dev

# Production
pm2 restart ecosystem.config.js --update-env
pm2 logs
```

### Key File Locations

**Configuration:**
- Better Auth: `packages/auth/src/auth.ts`
- Google Scopes: `packages/auth/src/google-scopes.ts`
- Environment: `.env`

**UI Components:**
- Login Form: `apps/agent/src/components/auth/sign-in-form.tsx`
- Signup Form: `apps/agent/src/components/auth/sign-up-form.tsx`

**Integration Sync:**
- Gmail Sync: `apps/agent/src/lib/gmail-sync.ts`
- Gmail Client: `apps/agent/src/lib/gmail.ts`

**Database:**
- Schema: `packages/database/prisma/schema.prisma`
- Models: User, Account, Session, IntegrationConnection

---

## Next Steps

### Immediate Actions

1. **Review Design Documents**
   - [ ] Executive summary reviewed by product owner
   - [ ] Technical design reviewed by engineering lead
   - [ ] Implementation checklist reviewed by assigned engineer

2. **Assign Owners**
   - [ ] Google Cloud Console setup: `_________________`
   - [ ] Environment configuration: `_________________`
   - [ ] Testing and validation: `_________________`
   - [ ] Google verification: `_________________`
   - [ ] Documentation: `_________________`

3. **Schedule Work**
   - [ ] Phase 1 (Configuration): Week of `_________________`
   - [ ] Phase 2 (Testing): Week of `_________________`
   - [ ] Phase 3 (Verification): Submit by `_________________`
   - [ ] Phase 4 (Documentation): Week of `_________________`

### Follow-Up Questions

**For Product:**
1. Should Google SSO be enabled immediately or wait for verification approval?
   - Option A: Enable now (100 test users, "unverified app" warning)
   - Option B: Wait for verification (no warnings, unlimited users)

2. Should we reduce scopes to just `openid email profile` for authentication, then request Gmail/Calendar separately?
   - Pros: Lower friction, clearer separation
   - Cons: More complex UX, multiple OAuth flows

3. Should we restrict to Google Workspace accounts only (exclude personal Gmail)?
   - Pros: Enterprise focus
   - Cons: Limits addressable market

**For Engineering:**
1. Who owns the Google Cloud Console project?
2. How should production secrets be managed? (Environment variables, Secrets Manager?)
3. Should we add OAuth metrics to existing monitoring?

**For Security/Compliance:**
1. Does privacy policy adequately explain Google data usage?
2. Are terms of service sufficient for Google verification?
3. Should we conduct security review before enabling?

---

## Related Resources

### Internal Documentation
- [Authentication System Docs](../../docs/internal/authentication.md) - Existing auth implementation
- [Building Custom Integrations](../../docs/internal/building-custom-integrations.md) - OAuth patterns
- [CLAUDE.md](../../CLAUDE.md) - Project overview and guidelines
- [DEPLOY.md](../../DEPLOY.md) - Production deployment procedures

### External Resources
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Better Auth Documentation](https://better-auth.com/docs)
- [Google OAuth Verification Guide](https://support.google.com/cloud/answer/9110914)
- [Google Cloud Console](https://console.cloud.google.com)

### Code References
- Better Auth Config: `packages/auth/src/auth.ts` (lines 75-206)
- Google Scopes: `packages/auth/src/google-scopes.ts`
- Sign-In Form: `apps/agent/src/components/auth/sign-in-form.tsx`
- Gmail Sync: `apps/agent/src/lib/gmail-sync.ts`
- Database Schema: `packages/database/prisma/schema.prisma` (lines 14-88)

---

## Document Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-08 | Initial design documents created | AI Agent |

---

## Approval & Sign-Off

### Design Review
- [ ] **Engineering Lead:** `_________________` Date: `_______`
- [ ] **Product Owner:** `_________________` Date: `_______`
- [ ] **Security/Compliance:** `_________________` Date: `_______`

### Implementation Approval
- [ ] **Approved to proceed with Phase 1 (Configuration)**
- [ ] **Approved to proceed with Phase 2 (Testing)**
- [ ] **Approved to proceed with Phase 3 (Google Verification)**
- [ ] **Approved to proceed with Phase 4 (Documentation)**

**Approved By:** `_________________`  
**Date:** `_________________`

---

## Questions or Feedback?

For questions about this design, contact:
- Engineering Lead: `_________________`
- Product Owner: `_________________`
- Original Issue: https://github.com/Appello-Prototypes/agentc2/issues/84

---

**Navigation:**
- [← Back to Plans Directory](./)
- [→ Start Implementation](./google-sso-implementation-checklist.md)
