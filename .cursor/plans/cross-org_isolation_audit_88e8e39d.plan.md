---
name: Cross-Org Isolation Audit
overview: Comprehensive security audit of cross-organization, cross-workspace, and cross-instance isolation across the entire AgentC2 stack, covering 300+ API routes, RAG/vector storage, MCP integrations, credentials, skills, and frontend data access patterns.
todos:
    - id: p0-workflows-networks
      content: "P0: Add requireAuth + org-scoped queries to all workflow and network CRUD routes (~24 routes)"
      status: completed
    - id: p0-sessions-backlogs
      content: "P0: Add requireAuth + org scoping to sessions (4 routes) and backlogs (5 routes)"
      status: completed
    - id: p0-channels
      content: "P0: Add requireAuth + org-scoped IntegrationConnection lookup to all channel routes (~17 routes)"
      status: completed
    - id: p0-other-zero-auth
      content: "P0: Add auth to remaining zero-auth routes: communication-policies, reviews, audit-logs, deployments, org workspaces/credentials, live/stats, skills search/activate/recommend/preview, BIM models, changelog, impersonate, agents resolve/finalize"
      status: completed
    - id: p1-skills-org
      content: "P1: Add organizationId to Skill model, add org-scoping to all skills CRUD and related routes"
      status: completed
    - id: p1-agent-skills-access
      content: "P1: Add requireAgentAccess to /api/agents/[id]/skills route"
      status: completed
    - id: p1-campaign-templates
      content: "P1: Add org scoping to campaign template CRUD"
      status: completed
    - id: p1-live-monitoring
      content: "P1: Fix live automations PATCH ownership check, add org filter to budget alerts and campaign/pulse queries"
      status: completed
    - id: p1-admin-pulse-community
      content: "P1: Add admin role check to admin playbooks, add requirePulseAccess to pulse members PUT/DELETE, fix community posts PATCH ownership"
      status: completed
    - id: p1-coding-triggers
      content: "P1: Remove targetOrganizationId override from coding-pipeline dispatch, add org filter to campaign triggers in triggers/event"
      status: completed
    - id: p2-rag-documents
      content: "P2: Replace x-organization-id header with server-side resolution in RAG documents route"
      status: completed
    - id: p2-document-service
      content: "P2: Thread organizationId through deleteDocument, reembed, versions service functions; fix document chunks vector query"
      status: completed
    - id: p2-agent-post-workspace
      content: "P2: Enforce auth on POST /api/agents, add validateWorkspaceOwnership helper for all user-supplied workspaceId inputs"
      status: completed
    - id: p3-vector-store
      content: "P3: Add organizationId column to vector store table (rag_documents)"
      status: completed
    - id: p3-memory-threads
      content: "P3: Add organizationId metadata to Mastra thread records, validate org prefix on all memory access"
      status: completed
    - id: p3-skill-model-slug
      content: "P3: Add organizationId to Skill model, change Document.slug and Skill.slug to per-org uniqueness"
      status: completed
    - id: p3-mcp-key-deprecation
      content: "P3: Plan deprecation of global MCP_API_KEY in favor of per-org keys; strengthen PLATFORM_ORG_SLUG audit logging"
      status: completed
    - id: p3-credential-encryption
      content: "P3: Implement per-org key derivation for credential encryption"
      status: completed
isProject: false
---

# Cross-Organization & Cross-Instance Isolation Audit

This audit identified **~85 routes with CRITICAL or HIGH severity isolation failures** across the AgentC2 API surface. The findings fall into four tiers: zero-auth routes, auth-present-but-no-org-check routes, weak/partial isolation patterns, and systemic architectural gaps.

---

## Tier 1: CRITICAL -- Zero Authentication Routes

These routes have **no authentication whatsoever**. Any unauthenticated HTTP request can read, create, modify, or delete data across all organizations.

### 1A. Workflows & Networks CRUD (24 routes)

All workflow and network CRUD routes at `[apps/agent/src/app/api/workflows/](apps/agent/src/app/api/workflows/)` and `[apps/agent/src/app/api/networks/](apps/agent/src/app/api/networks/)` are completely open:

- `GET/POST /api/workflows` -- list ALL workflows globally; create in any workspace
- `GET/PUT/PATCH/DELETE /api/workflows/[slug]` -- full CRUD on any workflow by slug
- `POST /api/workflows/[slug]/execute/stream` -- execute any workflow unauthenticated
- `GET/POST /api/workflows/[slug]/execution-triggers` and sub-routes -- manage triggers
- `GET /api/workflows/[slug]/runs/[runId]` and `POST .../resume` -- read/resume any run
- `GET/POST /api/workflows/[slug]/evaluations`, `feedback`, `metrics`, `test-cases`, `versions`
- Same pattern for all `/api/networks/` equivalents
- **Exception**: `/api/workflows/[slug]/execute` (non-stream) and `/api/workflows/[slug]/runs` (list) ARE authenticated

**Fix**: Add `requireAuth` + org-scoped queries (mirroring the execute route pattern) to every workflow and network CRUD handler.

### 1B. Sessions (4 routes)

`[apps/agent/src/app/api/sessions/](apps/agent/src/app/api/sessions/)`

- `GET/POST /api/sessions` -- list all sessions globally; create in any org
- `GET/PATCH /api/sessions/[id]` -- read/modify any session
- `GET /api/sessions/[id]/scratchpad` -- read any scratchpad

**Fix**: Add `requireAuth` + org scoping via `workspace.organizationId`.

### 1C. Backlogs (5 routes)

`[apps/agent/src/app/api/backlogs/](apps/agent/src/app/api/backlogs/)`

- All CRUD on `/api/backlogs/[agentSlug]` and `/api/backlogs/[agentSlug]/tasks` -- completely open

**Fix**: Add `requireAuth` + `requireAgentAccess` (agent already has org scoping).

### 1D. Channels (17+ routes)

`[apps/agent/src/app/api/channels/](apps/agent/src/app/api/channels/)`

- `GET/POST /api/channels/outbound` -- send WhatsApp/Telegram/voice messages via any channel
- `POST /api/channels/whatsapp/send`, `GET/POST .../status`, `GET .../qr`
- `GET /api/channels/status` -- exposes bot usernames, phone numbers, session counts
- `GET/POST /api/channels/voice/status`, `POST/GET .../call`, `GET/POST .../twiml`
- `GET/POST /api/channels/telegram/status`, `POST .../send`

**Fix**: Add `requireAuth` + org-scoped IntegrationConnection lookup for each channel.

### 1E. Communication Policies (5 routes)

`[apps/agent/src/app/api/communication-policies/](apps/agent/src/app/api/communication-policies/)`

- All CRUD completely open -- anyone can create/modify/delete communication policies

**Fix**: Add `requireAuth` + org scoping on all queries.

### 1F. Reviews (3 routes)

`[apps/agent/src/app/api/reviews/](apps/agent/src/app/api/reviews/)`

- `GET /api/reviews` -- lists ALL pending approval requests across all orgs
- `GET /api/reviews/[id]/diff` -- open GitHub proxy, fetches diff for any review

**Fix**: Add `requireAuth` + org scoping.

### 1G. Skills (5 unauthenticated routes)

`[apps/agent/src/app/api/skills/](apps/agent/src/app/api/skills/)`

- `POST /api/skills/search` -- returns all skill names/descriptions globally
- `POST /api/skills/activate` -- activate arbitrary skills on any thread
- `GET /api/skills/active` -- list activated skills for any threadId
- `GET /api/skills/recommend` -- **LEAKS AGENT INSTRUCTIONS** to unauthenticated callers
- `GET /api/skills/[skillId]/preview` -- leaks skill + agent data

**Fix**: Add `requireAuth` to all. Add org-scoping. The `recommend` endpoint is particularly dangerous as it exposes system prompts.

### 1H. Other Critical Zero-Auth Routes

- `GET /api/audit-logs` -- exposes ALL audit logs from ALL orgs
- `GET/POST /api/deployments` and `GET/PUT /api/deployments/[id]`
- `GET/POST /api/organizations/[orgId]/workspaces` -- create workspaces in any org
- `GET/POST /api/organizations/[orgId]/credentials` -- list/inject credentials in any org
- `GET /api/bim/models/[id]/status` and `.../elements`
- `GET /api/live/stats` -- exposes ALL agents' production stats (names, run counts, costs)
- `POST /api/agents/resolve` -- enumerate any agent by slug
- `POST /api/agents/[id]/chat/finalize` -- finalize any conversation
- `GET /api/changelog` -- config diffs for any entity
- `GET /api/impersonate` -- impersonation without admin verification

---

## Tier 2: HIGH -- Auth Present, Missing Org/Ownership Checks

These routes authenticate the user but fail to verify they belong to the target organization.

### 2A. Skills CRUD (All routes)

The `Skill` Prisma model has **no `organizationId` field**. All CRUD operations are globally scoped:

- `GET/PUT/DELETE /api/skills/[skillId]` -- any authenticated user can read/modify/delete any skill
- `POST/DELETE /api/skills/[skillId]/documents` and `.../tools` -- attach/detach to any skill
- `GET /api/skills/[skillId]/versions` -- version history of any skill
- `POST /api/skills/[skillId]/fork` -- fork any skill (leaks instructions)
- `POST /api/skills/marketplace` -- publish any skill (no ownership check)

**Fix**: Add `organizationId` to the Skill model. Add org-scoping to all queries. Add ownership validation.

### 2B. Agent Skills Route

- `POST/DELETE/PATCH /api/agents/[id]/skills` -- authenticated but agent lookup uses raw agentId with no org filter. Any user from any org can attach/detach/toggle skills on ANY agent.

**Fix**: Add `requireAgentAccess` (already used by all other agent sub-routes).

### 2C. Campaign Templates

- `GET/POST /api/campaigns/templates` -- lists ALL templates globally
- `GET/PATCH/DELETE /api/campaigns/templates/[id]` -- no ownership check

**Fix**: Add org scoping. CampaignTemplate needs `organizationId` or derive from workspace.

### 2D. Live Monitoring Gaps

- `PATCH /api/live/automations/[id]` -- can pause/resume any org's schedules/triggers
- `GET /api/live/automations` -- campaign schedules/triggers and pulses have NO org filter
- `GET /api/live/runs` -- `getBudgetAlerts()` subroutine queries budgetPolicy globally

**Fix**: Add org-scoped queries to automation CRUD and budget alerts.

### 2E. Admin Playbooks

- `GET /api/admin/playbooks` -- any authenticated user sees all playbooks (no admin role check)
- `PATCH /api/admin/playbooks/[id]/status` -- any user can approve/suspend/reject any playbook

**Fix**: Add `requireOrgRole("admin")` or a platform admin check.

### 2F. Pulse Members

- `PUT/DELETE /api/pulse/[pulseId]/members/[memberId]` -- uses `requireAuth` only, does NOT call `requirePulseAccess`. Any authenticated user can update/delete any pulse member globally.

**Fix**: Add `requirePulseAccess` call.

### 2G. Coding Pipeline Dispatch

- `POST /api/coding-pipeline/dispatch` -- accepts `targetOrganizationId` in body that overrides the auth org

**Fix**: Remove `targetOrganizationId` body param; always use auth context org.

### 2H. Community

- `PATCH /api/community/posts/[postId]` -- any user can pin/lock any post (no ownership check)
- Board stats, board members -- no org filter on queries

**Fix**: Add `authorUserId` check for PATCH. Add org filter for board queries.

### 2I. Triggers Event

- `POST /api/triggers/event` -- campaign trigger section has NO org filter; `MCP_API_KEY` allows firing events for any org

**Fix**: Add org filter to campaign trigger queries.

---

## Tier 3: MEDIUM -- Weak or Partial Isolation

### 3A. RAG Documents Route -- Client-Controlled Org Header

`[apps/agent/src/app/api/rag/documents/route.ts](apps/agent/src/app/api/rag/documents/route.ts)`

- `GET /api/rag/documents` reads `x-organization-id` from request header instead of server-side resolution
- `DELETE /api/rag/documents` same pattern -- user can forge the header to target any org

**Fix**: Replace `req.headers.get("x-organization-id")` with `getUserOrganizationId(session.user.id)`.

### 3B. Document Service Layer Gaps

- `deleteDocument()` in `[packages/agentc2/src/documents/service.ts](packages/agentc2/src/documents/service.ts)` does NOT pass `organizationId` to `ragDelete()`, causing vectors to be deleted by slug only (cross-org slug collision risk)
- `reembed` and `versions` routes bypass org check when either `organizationId` is null
- Document chunks vector query at `[apps/agent/src/app/api/documents/[documentId]/chunks/route.ts](apps/agent/src/app/api/documents/[documentId]/chunks/route.ts)` filters by `documentId: document.slug` only, no org filter

**Fix**: Thread `organizationId` through all service functions. Make org check mandatory (not conditional on both being truthy).

### 3C. Agent POST Route

- `POST /api/agents` calls `authenticateRequest()` but never returns 401 on failure. Creates agents with `tenantId: undefined`, `workspaceId` from body (unvalidated).

**Fix**: Return 401 if `authenticateRequest()` returns null. Validate `workspaceId` belongs to caller's org.

### 3D. workspaceId Validation

Multiple routes accept user-supplied `workspaceId` (query param or body) without validating it belongs to the caller's organization:

- `POST /api/documents` (body.workspaceId)
- `GET /api/documents` (query param workspaceId)
- `POST /api/rag/ingest` (body.workspaceId)
- `POST /api/sessions` (body.workspaceId)

**Fix**: Add a `validateWorkspaceOwnership(workspaceId, organizationId)` helper and apply it everywhere workspaceId is accepted from client input.

---

## Tier 4: Systemic / Architectural Gaps

### 4A. Vector Store Has No Org Column

The `rag_documents` table (managed by `@mastra/pg`, `@@ignore` in Prisma) stores `organizationId` only in the JSON `metadata` field. There is:

- No dedicated `organizationId` column
- No database-level RLS (Row-Level Security)
- No workspace concept at all
- Isolation depends entirely on application-level metadata filtering in every query

**Recommendation**: Add a dedicated `organizationId` column to the vector table (requires `@mastra/pg` customization or migration). Consider Supabase RLS as defense-in-depth.

### 4B. Memory/Thread Isolation is Convention-Based

Mastra-managed tables (`mastra_threads`, `mastra_messages`, `mastra_resources`) have **no organizationId columns**. Thread isolation relies on a convention: threadId is prefixed with `orgId:` by `bindWorkspaceContext`. If any code path skips this prefix (background jobs, webhooks, system triggers), threads from different orgs share the same namespace.

**Recommendation**: Add `organizationId` metadata to Mastra thread records. Validate org prefix in all memory access.

### 4C. Skills Model Lacks Organization Field

The `Skill` Prisma model has `workspaceId` but **no `organizationId`**. Skills are effectively global. The `slug` has `@@unique` globally, meaning org A can block org B from creating a skill with the same slug.

**Recommendation**: Add `organizationId` to the Skill model. Change slug uniqueness to `@@unique([organizationId, slug])`.

### 4D. MCP_API_KEY is a Universal Skeleton Key

A single env var `MCP_API_KEY` authenticates as any organization by varying `X-Organization-Slug`. Compromise of this key = full cross-org access.

**Recommendation**: Deprecate global key in favor of per-org API keys. If kept, add IP allowlisting and stricter audit logging (non-fire-and-forget).

### 4E. PLATFORM_ORG_SLUG God-Mode

Platform org members can bypass `enforceOrg` on MCP routes. The audit log write is `.catch()`-ed (fire-and-forget), so failed audit writes are silently swallowed.

**Recommendation**: Make audit logging synchronous/mandatory for platform org bypass. Add rate limiting. Consider requiring explicit "impersonation mode" confirmation.

### 4F. Credential Encryption -- Single Global Key

`CREDENTIAL_ENCRYPTION_KEY` is a single AES-256-GCM key encrypting all orgs' credentials. No per-org key derivation or key wrapping exists. Key rotation requires re-encrypting every credential.

**Recommendation**: Implement per-org key derivation (e.g., HKDF with org ID as info) or a key wrapping layer.

### 4G. Document Slug Global Uniqueness

`Document.slug` has `@unique` globally. Org A creating slug "handbook" prevents Org B from using the same slug. This is a namespace collision and potential DoS vector.

**Recommendation**: Change to `@@unique([organizationId, slug])`.

### 4H. No Workspace-Level Isolation

Almost no route enforces workspace-level isolation. All workspaces within an org share:

- MCP tool connections and credentials
- RAG documents and vectors
- Memory threads
- Skills
- Agent visibility

This is by design for now, but blocks multi-workspace use cases (e.g., dev/staging/prod within one org).

---

## Severity Summary

| Severity             | Route Count  | Key Patterns                                                                                                                                                                                   |
| -------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL (zero auth) | ~45 routes   | Workflows/networks CRUD, sessions, backlogs, channels, communication-policies, reviews, skills search/activate/recommend, audit-logs, deployments, org workspaces/credentials, live/stats, BIM |
| HIGH (auth, no org)  | ~25 routes   | Skills CRUD, agent skills, campaign templates, live automations PATCH, admin playbooks, pulse members, coding-pipeline dispatch, community posts                                               |
| MEDIUM (partial)     | ~15 routes   | RAG documents header, document service gaps, agent POST soft auth, workspaceId validation                                                                                                      |
| Architectural        | 8 systemic   | Vector store no org column, memory convention-based, skills no org field, global MCP key, global encryption key, slug uniqueness, no workspace isolation                                       |
| Secure               | ~200+ routes | Agent sub-routes (requireAgentAccess), federation, stripe, partner, embed-partners, instances, vectors, threads, organizations (most), user, onboarding, auth, godmode                         |

---

## Recommended Remediation Order

**Phase 1 (P0 -- Immediate)**: Fix all zero-auth routes. This is the most dangerous class -- any unauthenticated request can access/modify data across all organizations.

**Phase 2 (P1 -- Urgent)**: Fix auth-present-but-no-org-check routes. Add org-scoped queries where auth exists but isolation is missing.

**Phase 3 (P2 -- Important)**: Fix partial isolation patterns. Replace client-controlled headers with server-side resolution. Thread organizationId through service layer.

**Phase 4 (P3 -- Strategic)**: Address architectural gaps. Add org column to vector store, add organizationId to Skill model, implement per-org key derivation, deprecate global MCP_API_KEY.
