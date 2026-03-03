---
name: "Website — Plan 6: Enterprise, Security, Trust & Federation Pages"
overview: "Build and enhance the enterprise-facing pages: Security & Governance (enhance existing), Enterprise landing page, Embed Partners page, and Federation page. These pages address enterprise buyer concerns and unlock new business models."
todos:
    - id: phase-1-security-governance
      content: "Phase 1: Enhance existing Security page with full governance detail"
      status: pending
    - id: phase-2-enterprise
      content: "Phase 2: Enterprise landing page — multi-tenancy, compliance, admin, SLAs"
      status: pending
    - id: phase-3-embed-partners
      content: "Phase 3: Embed Partners page — white-label distribution model"
      status: pending
    - id: phase-4-federation
      content: "Phase 4: Federation page — cross-org agent collaboration deep dive"
      status: pending
isProject: false
---

# Plan 6: Enterprise, Security, Trust & Federation Pages

**Brand Reference:** Security and Enterprise pages follow Template B (Long-form Content) from [docs/brand-style-guide.md](/docs/brand-style-guide.md). Federation and Embed Partners pages use Template A (Hero + Sections). All pages include relevant SVG-style illustration components from the brand guide Section 8.

**Priority:** Medium — critical for enterprise deal progression

**Depends on:** Plan 1 (Foundation)

**Estimated Effort:** Medium (3–4 days)

---

## Phase 1: Enhance Security & Governance Page

**Current state:** `/security` exists with credential encryption, OAuth, transport, audit, and incident response sections.

**Enhancement:** Add comprehensive governance detail that doesn't exist on the current page.

**File:** `apps/frontend/src/app/security/page.tsx` (enhance existing)

### Enhanced Sections

1. **Existing content** — Keep and polish: credential encryption, OAuth security, transport security

2. **Input/Output Guardrails (new section):**
    - Input guardrails: max length, PII blocking, prompt injection detection, blocked patterns
    - Output guardrails: max length, PII blocking, toxicity detection, blocked patterns, automatic secret/credential leak prevention
    - Evasion handling: base64/URL decode, Unicode normalization, zero-width character stripping
    - Org-level guardrail policies as baseline; agent-level policies can only tighten
    - Guardrail events: BLOCKED, MODIFIED, FLAGGED — all logged

3. **Tool Permission System (new section):**
    - Per-agent, per-tool permission categories: read_only, write, spend, full
    - Default permissions with agent-level overrides
    - Permission checks on every tool execution

4. **Network Egress Control (new section):**
    - Per-organization network egress policies
    - Mode: allowlist or denylist
    - Domain matching with wildcard support (`*.example.com`)
    - Checked on every outbound tool call

5. **Budget Enforcement (new section):**
    - Four-tier budget hierarchy: subscription → organization → user → agent
    - Budget reservations before execution
    - `BudgetExceededError` when limits reached
    - Cost tracking with platform markup
    - Budget alerts at configurable thresholds

6. **Audit Trail (enhance existing):**
    - Agent run audit: every run, turn, tool call, and trace step logged
    - Admin audit: tenant lifecycle, user impersonation, flag changes, billing updates
    - Federation audit: cross-org message audit with dual-write (both parties)
    - CRM audit: all CRM mutations logged with notes
    - Retention policies and export capabilities

7. **Compliance Infrastructure (new section):**
    - Consent management: privacy policy, terms of service, marketing, data processing
    - Data subject requests: access, rectification, erasure, portability (GDPR/CCPA/PIPEDA)
    - Request lifecycle: submitted → in_review → in_progress → completed/denied
    - Admin portal for DSR processing

8. **Federation Security (new section — brief, links to federation page):**
    - Ed25519 key pairs per organization
    - AES-GCM encrypted channels per agreement
    - PII scanning with data classification tiers
    - Rate limits and circuit breakers
    - "Learn more about Federation →" link

9. **Trust Center link** — Prominent link to existing Trust Center page

---

## Phase 2: Enterprise Landing Page

**File:** `apps/frontend/src/app/(marketing)/enterprise/page.tsx` (new)

**Purpose:** For enterprise buyers evaluating AgentC2 for organizational deployment. This page should answer: "Is AgentC2 ready for my enterprise?"

### Sections

1. **Hero:** "Built for organizations, not individuals"
    - Subheadline: "AgentC2 is the AI agent platform designed from the ground up for multi-tenant enterprise deployment — with governance, compliance, and administrative control at every layer."
    - CTA: "Talk to Sales" + "Start Free Trial"

2. **Multi-Tenant Architecture:**
    - Organization → Workspace → Agent hierarchy
    - Per-org credentials, connections, and policies
    - Workspace environments: development, staging, production
    - Resource isolation at every level
    - Org-scoped resource IDs and thread IDs

3. **Authentication & Identity:**
    - Better Auth with session-based authentication
    - Google and Microsoft OAuth SSO
    - Role-based access: owner, admin, member, viewer
    - Permissions: configurable per-member (e.g., guardrail_override)
    - Organization domains for automatic membership
    - Invitation system with code-based join

4. **Admin Portal:**
    - Dashboard: MRR, ARR, revenue, platform health, agent runs
    - Tenant management: lifecycle (provisioning → active → trial → suspended → deactivated)
    - User management: view, reset password, force logout, impersonation
    - Feature flags: global flags + per-org overrides with expiry
    - Support tickets: triage, comment, resolve
    - Audit log: all admin actions logged
    - Federation management: view and manage cross-org agreements

5. **Governance & Compliance:**
    - Brief summary linking to Security page (Plan 6 Phase 1)
    - Guardrails, budgets, permissions, egress, audit
    - GDPR/CCPA data subject request handling
    - AI Transparency documentation (link to existing page)

6. **Scalability:**
    - Organization limits: max agents, workspaces, runs/month, seats, storage
    - Background processing: Inngest for event-driven workflows
    - Budget alerts and spending controls
    - Continuous learning pipeline for autonomous improvement

7. **Deployment Options:**
    - Cloud-hosted (managed by AgentC2)
    - Deployment architecture: Digital Ocean, PM2, Caddy
    - CI/CD: GitHub Actions
    - Database: PostgreSQL via Supabase with direct connections

8. **Federation:**
    - Cross-organization agent collaboration
    - Encrypted channels, agent exposure controls
    - Brief summary linking to Federation page (Plan 6 Phase 4)

9. **Support & SLA:**
    - Support ticket system (in-app)
    - Admin audit trail
    - Health checks and monitoring
    - Escalation paths

10. **CTA Banner:**
    - "Ready for enterprise AI agents?"
    - "Talk to Sales" → `mailto:enterprise@agentc2.ai` or contact form
    - "Start Free Trial" → `/signup`

---

## Phase 3: Embed Partners Page

**File:** `apps/frontend/src/app/(marketing)/embed-partners/page.tsx` (new)

**Purpose:** Position the embed system as a distribution model for SaaS companies, consulting firms, and agencies that want to embed AI agents into their products or client environments.

### Sections

1. **Hero:** "White-label AI agents in your product"
    - Subheadline: "Embed intelligent, governed AI agents into your SaaS, client portal, or internal tool — with your branding, your domain, and your security requirements."
    - CTA: "Become a Partner" + "See Documentation"

2. **What is Embed:**
    - Deploy AgentC2 agents as embedded widgets, chat interfaces, or full workspaces
    - Custom branding (colors, logo, name)
    - Domain restrictions for security
    - Your users interact with agents that look and feel like part of your product

3. **Deployment Modes:**
   | Mode | Description |
   |------|-------------|
   | Chat Widget | Minimal chat interface for support or sales |
   | Agent | Full agent interface with tool activity and suggestions |
   | Workspace | Complete AgentC2 workspace under your brand |

4. **Feature Presets:**
    - chat-only: Minimal conversation interface
    - chat-plus: Chat with agent selection
    - workspace: Full workspace features
    - builder: Agent building capabilities
    - full: Everything including settings and integrations

5. **Security:**
    - HMAC-SHA256 authentication with per-partner signing secret
    - Token format: `base64url(payload).hexSignature`
    - Token expiry and max age configuration
    - Domain allowlist for embed deployment
    - JIT (just-in-time) user provisioning — users created on first interaction

6. **Business Model:**
    - Partner management via admin portal
    - Per-partner configuration and deployment tracking
    - Session tracking and usage metrics
    - Signup CTA integration (convert embed users to full users)

7. **Use Cases:**
    - **SaaS Companies:** Embed AI support agents in your product
    - **Consulting Firms:** Deploy agents into client environments
    - **Agencies:** Build and manage agents for multiple clients
    - **Internal Tools:** Add AI capabilities to existing internal apps

8. **Technical Integration:**
    - Embed via iframe or JavaScript SDK
    - Identity token generation (server-side)
    - Configuration API for deployment management
    - Link to full documentation

9. **CTA:** "Apply to become an Embed Partner" + contact form or email

---

## Phase 4: Federation Page

**File:** `apps/frontend/src/app/(marketing)/platform/federation/page.tsx` (new)

**Purpose:** Deep dive into the cross-organization agent collaboration capability — AgentC2's most unique differentiator.

### Sections

1. **Hero:** "The only platform where agents cross organizational boundaries — securely"
    - Subheadline: "AgentC2 Federation enables encrypted, governed, and audited agent-to-agent collaboration across separate organizations. No shared credentials. No data leaks. Full control."
    - CTA: "Learn How It Works" + "Talk to Sales"

2. **Why Federation Matters:**
    - Business increasingly operates across organizational boundaries
    - Partners, suppliers, clients, and consultants need to coordinate
    - Sharing AI credentials or API keys is a security risk
    - Email and spreadsheets are too slow for real-time coordination
    - Federation solves this: secure agent-to-agent communication across orgs

3. **How It Works:**
   Visual flow:

    ```
    Org A requests connection → Org B approves → Encrypted channel established
    → Agents exposed with controls → Communication begins → Fully audited
    ```

    Step-by-step:
    1. **Request:** Organization A initiates a federation agreement with Organization B
    2. **Approve:** Organization B reviews terms (rate limits, data classification, PII policy) and approves
    3. **Configure:** Both orgs choose which agents to expose and with what controls
    4. **Communicate:** Agents can invoke each other's capabilities through the encrypted channel
    5. **Monitor:** All interactions are audited on both sides

4. **Security Model:**
    - **Encryption:** AES-GCM with per-agreement channel key
    - **Signing:** Ed25519 key pairs per organization — every payload signed and verified
    - **Key management:** Organization key pair generation, rotation, and revocation
    - **PII scanning:** Automatic PII detection (email, phone, SSN, credit card, IP) with configurable actions:
        - Restricted: block messages containing PII
        - Confidential: redact PII before transmission
        - Internal: warn but allow
        - Public: no filtering

5. **Policy Enforcement:**
    - **Rate limits:** Per-hour and per-day limits, configurable per agreement
    - **Circuit breaker:** Auto-suspends agreement if error rate exceeds 50% over 5 minutes
    - **Exposure controls:** Fine-grained selection of which agents and skills are accessible
    - **Data classification tiers:** restricted, confidential, internal, public
    - **Human approval gates:** Optional requirement for human approval on cross-org actions
    - **File transfer controls:** Allow or deny file transfer per agreement

6. **Agent Discovery:**
    - `.well-known/agent.json` agent cards for discoverability
    - Federated agents advertise capabilities, input requirements, and constraints
    - Organizations can browse available agents from federated partners

7. **Audit Trail:**
    - Dual-write: both participating organizations receive audit records
    - Every message logged with sender, receiver, timestamp, and status
    - Federation-specific audit log in admin portal
    - Exportable for compliance reporting

8. **Use Cases:**
    - **Supply Chain:** Supplier and buyer agents coordinate orders, delivery, and exceptions
    - **Consulting:** Consultant agents deliver insights to client agents with controlled data classification
    - **Platform Ecosystem:** SaaS company exposes agent capabilities to partner integrations
    - **Franchise Networks:** Central agents coordinate with franchisee agents for policy, training, and reporting
    - **Joint Ventures:** Multiple organizations' agents collaborate on shared projects

9. **Getting Started with Federation:**
    - Step 1: Generate your organization's key pair (automatic on org creation)
    - Step 2: Initiate a federation agreement with a partner org
    - Step 3: Configure exposure controls and data classification
    - Step 4: Start collaborating

10. **CTA:** "Enable Federation for your organization" + "Talk to Sales"

---

## Verification Checklist

- [ ] Enhanced Security page includes all governance sections
- [ ] Enterprise page answers key enterprise buyer questions
- [ ] Embed Partners page explains the full embed system and business model
- [ ] Federation page accurately describes the protocol and security model
- [ ] MCP is explained in context where relevant (Security page tools section)
- [ ] All pages link to existing Trust Center, AI Transparency, and legal pages
- [ ] CTAs include both self-service and sales contact options
- [ ] Pages are consistent with the marketing design system (Plan 1)
- [ ] Each page has unique meta tags
- [ ] Pages are responsive
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
