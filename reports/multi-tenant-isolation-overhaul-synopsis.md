# Multi-Tenant Isolation Overhaul -- Synopsis

**Date**: March 9, 2026
**Scope**: Full-stack schema, application code, and architectural overhaul
**Files Changed**: 179 files, +2,106 / -2,414 lines
**Prior Work**: [Cross-Org Isolation Audit](../.cursor/plans/cross-org_isolation_audit_88e8e39d.plan.md) (route-level auth fixes)
**Conversation**: [Tenant Isolation Overhaul](8e231295-f883-43c4-b299-8fd288380e2d)

---

## 1. Problem Statement

After creating a new tenant ("Appello Live") via the admin panel and logging in, workspaces from other tenant instances were visible -- a critical cross-tenant data leakage bug. Investigation revealed this was not an isolated query issue but a systemic architectural problem:

- **Global slug uniqueness** -- Slugs for agents, workflows, networks, etc. were globally unique (`@unique`), meaning Org A's slug "assistant" blocked Org B from using the same slug. This also meant slug-based lookups could return data from the wrong tenant.
- **Nullable foreign keys** -- `workspaceId` was nullable on 14+ models, allowing entities to exist outside any workspace/org boundary.
- **Legacy `tenantId` field** -- 47+ models carried a `tenantId String?` field that was inconsistently used, sometimes set, sometimes null, and never enforced at the database level.
- **SYSTEM entities** -- Agents, workflows, and networks could have `type: SYSTEM`, which meant `workspaceId: null` and global visibility. This created implicit cross-tenant data sharing.
- **`isSystem` flags** -- Campaign templates and scorecard templates had `isSystem` booleans that bypassed org scoping.

---

## 2. The Plan

The plan was developed iteratively through critical analysis with the user, who challenged the necessity of SYSTEM agents and proposed a **playbook-as-seed model**: new instances start blank and are seeded via playbooks from a ground-truth AgentC2 instance, eliminating the need for globally-shared SYSTEM entities.

The plan was organized into 6 phases with 29 discrete tasks:

### Phase 1 -- Schema Changes (7 tasks)

| Task | Description                                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1A   | Change slug uniqueness from `@unique` to `@@unique([workspaceId, slug])` or `@@unique([organizationId, slug])` on 9 models: Agent, Workflow, Network, Pulse, CommunityBoard, Campaign, CampaignTemplate, AgentInstance, EmbedPartner |
| 1B   | Make `workspaceId` non-nullable on Agent, Workflow, Network, Pulse, Skill, Document, CommunityBoard; change `onDelete` to `Restrict`                                                                                                 |
| 1C   | Add `workspaceId` + `organizationId` to Campaign, CampaignTemplate, CampaignSchedule, CampaignTrigger; remove `tenantId` from these models                                                                                           |
| 1D   | Remove `SYSTEM` from `AgentType`, `WorkflowType`, `NetworkType` enums; remove `type` field from Skill/Document; remove `isSystem` from CampaignTemplate/ScorecardTemplate                                                            |
| 1E   | Remove `tenantId String?` and `@@index([tenantId])` from all 47+ models                                                                                                                                                              |
| 1F   | Make `workspaceId` non-nullable on AgentSchedule, AgentTrigger, AgentSession, BimModel, Backlog, GmailIntegration, ApprovalRequest                                                                                                   |
| 1G   | Add org/workspace context to Deployment, ChannelSession; make `organizationId` non-nullable on Skill, Document, CommunityBoard, ChannelSession, ChannelCredentials, VoiceCallLog                                                     |

### Phase 2 -- Data Migrations (4 tasks)

| Task | Description                                                                                                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- |
| 2A   | Backfill SYSTEM entities into org default workspaces, set `type=USER`                                                            |
| 2B   | Backfill Campaign/CampaignTemplate/Schedule/Trigger with `organizationId` + `workspaceId` derived from `tenantId` or `createdBy` |
| 2C   | Backfill `workspaceId` on child entities (AgentSchedule, AgentTrigger, etc.) from parent entities                                |
| 2D   | Verify no duplicate slugs within same workspace before constraint change                                                         |

### Phase 3 -- Application Code (8 tasks)

| Task | Description                                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3A   | Agent Resolver: Remove `workspaceId:null` fallback, `listSystem()`, all `tenantId` references; require `workspaceId` in all queries                               |
| 3B   | Fix ~24+ unscoped slug lookups across agent-crud-tools, backlog-tools, triggers, Slack, Telegram, skill service, channels, networks, federation, community, pulse |
| 3C   | Playbook deployer: Scope slug preloading to target workspace; pass `workspaceId`/`organizationId` on all entity creation                                          |
| 3D   | Campaigns: Add workspace/org context to creation, listing, `invokeCampaignAgent`                                                                                  |
| 3E   | Inngest: Add `workspaceId`/`organizationId` to all event payloads; replace `tenantId` in ~53 locations; scope cron function queries                               |
| 3F   | Run recorder + audit log: Replace `tenantId` with `organizationId` (~89 references)                                                                               |
| 3G   | Budget/guardrails: Replace `tenantId` with `organizationId`/`workspaceId` (~25 references)                                                                        |
| 3H   | Microsoft OAuth: Differentiate Azure AD `tenantId` from platform `organizationId`                                                                                 |

### Phase 4 -- Playbook Infrastructure (2 tasks)

| Task | Description                                                                |
| ---- | -------------------------------------------------------------------------- |
| 4A   | Verify playbook deployer is properly scoped for the playbook-as-seed model |
| 4B   | Verify `deployStarterKit` passes correct workspace/org context             |

### Phase 5 -- SYSTEM Entity Removal (4 tasks)

| Task | Description                                                                                                                                                 |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5A   | Backend: Remove ~100 `type:SYSTEM` references from resolver, skill service, auto-generator, platform-context-tool, agent routes, seed scripts               |
| 5B   | Backend: Remove `isSystem` references from campaign templates, scorecard templates, live automations, triggers, archive/delete actions, channel routing     |
| 5C   | Frontend: Remove SYSTEM badges, filters, delete guards from agents, skills, networks, workflows pages, AgentSelector, TaskSuggestions, ArchiveDeleteActions |
| 5D   | Null workspace: Update ~55 locations that set/check `workspaceId:null` to require workspace context                                                         |

### Phase 6 -- Cleanup & Verification (5 tasks)

| Task | Description                                                                           |
| ---- | ------------------------------------------------------------------------------------- |
| 6A   | Deprecate seed scripts that reference SYSTEM entities                                 |
| 6B   | Drop legacy `StoredAgent` model from schema                                           |
| 6C   | Update all test fixtures, resolver tests, skill service tests, tenant isolation tests |
| 6D   | Update CLAUDE.md, agent-migration docs with deprecation notices                       |
| 6E   | Run `db:generate`, `type-check`, `lint`, `format`, `build` -- zero errors             |

---

## 3. What Was Done

### 3.1 Schema Changes (Phase 1)

**File**: `packages/database/prisma/schema.prisma`

- Replaced `slug String @unique` with `@@unique([workspaceId, slug])` on 9 models
- Changed `workspaceId String?` to `workspaceId String` on 14 models, with `onDelete: Restrict`
- Changed `organizationId String?` to `organizationId String` on 6 models
- Removed `SYSTEM` from 3 enum types (`AgentType`, `WorkflowType`, `NetworkType`)
- Removed `type` field entirely from `Skill` and `Document` models
- Removed `isSystem Boolean` from `CampaignTemplate` and `ScorecardTemplate`
- Removed `tenantId String?` and `@@index([tenantId])` from 47+ models
- Dropped the legacy `StoredAgent` model
- Added `Backlog` -> `Workspace` relation with `onDelete: Restrict`

### 3.2 Migration Scripts (Phase 2)

**Files**: `scripts/migration-backfill-*.ts`

Created 4 migration scripts:

- `migration-backfill-workspaces.ts` -- Backfills `workspaceId`/`organizationId` for Agent, Workflow, Network, Skill, Document, Pulse, BimModel
- `migration-backfill-campaigns.ts` -- Backfills Campaign, CampaignTemplate, CampaignSchedule, CampaignTrigger
- `migration-backfill-context.ts` -- Backfills child entities from parent relations
- `migration-deduplicate-slugs.ts` -- Verifies no duplicate slugs within new scopes

### 3.3 Application Code (Phase 3)

**Agent Resolver** (`packages/agentc2/src/agents/resolver.ts`):

- Removed `listSystem()` method entirely
- Removed all `workspaceId: null` fallback patterns
- All queries now strictly require `workspaceId` or `organizationId`

**Slug Lookups** (9 files across `apps/agent/src/app/api/`):

- Changed `findUnique({ where: { slug } })` to `findFirst({ where: { slug, workspaceId } })` or `findFirst({ where: { slug, organizationId } })` since slugs are no longer globally unique

**Campaign Context** (4 files):

- Added `organizationId` and `workspaceId` to campaign creation, listing, and agent invocation
- Created `getCampaignContext()` helper for deriving org/workspace from campaign records

**Inngest Functions** (`apps/agent/src/lib/inngest-functions.ts`):

- Added `organizationId`/`workspaceId` to all event payloads
- Scoped cron function queries by org/workspace
- Fixed ~53 `tenantId` references

**Run Recorder + Audit Log** (`apps/agent/src/lib/run-recorder.ts`, `audit-log.ts`):

- Replaced all `tenantId` with `organizationId`
- Removed `organizationId` from Prisma `create` calls for models that don't have it (AgentRun, AgentTrace, CostEvent, etc.)
- Moved `organizationId` into AuditLog `metadata` field

**Budget/Guardrails** (3 files in `packages/agentc2/src/`):

- Replaced `tenantId` with `organizationId` in enforcement and event recording
- Removed `organizationId` from GuardrailEvent creates

**Admin Pages** (4 files in `apps/admin/src/`):

- Updated raw SQL and Prisma queries to join through Agent -> Workspace -> Organization instead of using removed `tenantId` fields

### 3.4 SYSTEM Entity Removal (Phase 5)

**Backend** (~30 files across `packages/agentc2/src/` and `apps/agent/src/`):

- Removed `if (existing.type === "SYSTEM")` guards from all CRUD tools
- Changed `z.enum(["USER", "SYSTEM"])` to `z.literal("USER")` in Zod schemas
- Changed `enum: ["USER", "SYSTEM"]` to `enum: ["USER"]` in JSON schemas
- Removed `type: "SYSTEM"` from skill auto-generator and provisioner
- Removed `type: { in: ["SYSTEM", "USER"] }` query patterns from Slack, Telegram, alerts, skill search
- Removed `isSystem: true` from campaign template and scorecard template queries
- Removed `StoredAgent` references and `USE_DB_AGENTS` fallback blocks from 3 agent API routes

**Frontend** (~12 files in `apps/agent/src/`):

- Changed type definitions from `"SYSTEM" | "USER" | "DEMO"` to `"USER" | "DEMO"`
- Removed SYSTEM badge rendering, "System" filter options, SYSTEM agent counts
- Removed `isSystem={entity.type === "SYSTEM"}` prop passing
- Removed SYSTEM-specific warning messages from agent configure page

### 3.5 Null Workspace Fixes (Phase 5D)

**~10 files** across `packages/agentc2/src/` and `apps/agent/src/`:

- Removed `OR: [{ workspaceId }, { workspaceId: null }]` patterns from triggers, automations, skill recommender
- Replaced `workspaceId: null` in creates with derived workspace context
- Made `workspaceId` required in `CreateSessionOptions` interface

### 3.6 Type Error Resolution (Phase 6E)

After schema changes, **186 type errors** surfaced in the agent app. These were fixed across ~40 additional files:

- Removed `agent.organizationId` access (Agent no longer has this field); replaced with `agent.workspace.organizationId`
- Removed `organizationId` from Agent select queries; replaced with `workspace: { select: { organizationId: true } }`
- Removed `organizationId` from creates on models that don't have it: AgentVersion, AgentFeedback, BudgetPolicy, GuardrailPolicy, LearningPolicy, AuditLog
- Removed `type` references from Skill and Document creates/queries
- Fixed `string | null` -> `string` type mismatches from non-nullable `workspaceId`
- Added required `workspaceId`/`organizationId` to Skill, Backlog, Campaign creates in deployer

### 3.7 Documentation Updates (Phase 6D)

- **CLAUDE.md**: Added "Multi-Tenant Isolation" section documenting workspace-scoped slugs, no SYSTEM agents, no `tenantId`, no `isSystem` flags. Updated Agent schema example and resolver usage example.
- **Agent migration docs** (4 files): Added deprecation notices explaining the docs predate the overhaul and reference obsolete concepts.

---

## 4. Testing & Verification

### 4.1 Static Analysis (Automated)

All verification commands were run from the repository root and passed clean:

| Command               | Result                                              |
| --------------------- | --------------------------------------------------- |
| `bun run db:generate` | Prisma client generated successfully (schema valid) |
| `bun run type-check`  | 6/6 packages passed, 0 errors                       |
| `bun run format`      | All files formatted (Prettier)                      |
| `bun run lint`        | 0 errors (89 pre-existing warnings)                 |
| `bun run build`       | 4/4 apps built successfully                         |

### 4.2 Schema Validation

- Prisma schema validated via `prisma generate` -- all model relations, compound unique constraints, and enum values are correct
- The `Backlog` model required an additional `workspace Workspace @relation(...)` field to satisfy the bidirectional relation requirement with Workspace

### 4.3 Test Fixture Updates

All test fixtures and test files were updated to reflect the new schema:

| Test Category         | Files Updated                                                                                                         | Changes                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Fixtures              | `tests/fixtures/{agents,runs,evaluations,simulations,skills}.ts`                                                      | `tenantId` -> `organizationId`, `type: "SYSTEM"` -> `type: "USER"` |
| Unit tests            | `tests/unit/{resolver,inngest-functions,skills-service}.test.ts`                                                      | Same replacements + removed `listSystem()` test block              |
| Integration tests     | `tests/integration/api/{tenant-isolation,versions,guardrails,feedback,budget,runs,test-cases,output-actions}.test.ts` | Same replacements                                                  |
| Integration (Inngest) | `tests/integration/inngest/{guardrail-event,budget-check,run-completed}.test.ts`                                      | Same replacements                                                  |
| E2E                   | `tests/e2e/agent-lifecycle.test.ts`                                                                                   | Same replacements                                                  |

### 4.4 Migration Script Verification

- `migration-deduplicate-slugs.ts` verifies no duplicate slugs exist within the same workspace/org scope before compound unique constraints are applied
- Backfill scripts derive `workspaceId`/`organizationId` from parent entities or `createdBy` user records

### 4.5 Scope of Isolation Enforcement

The overhaul ensures isolation at multiple levels:

| Layer           | Mechanism                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| **Database**    | Compound unique constraints (`@@unique([workspaceId, slug])`) prevent slug collisions across workspaces |
| **Database**    | Non-nullable `workspaceId`/`organizationId` foreign keys prevent orphaned entities                      |
| **Database**    | `onDelete: Restrict` prevents workspace/org deletion with dependent entities                            |
| **Application** | Agent resolver requires `workspaceId` -- no null fallbacks                                              |
| **Application** | All slug lookups scoped by `workspaceId` or `organizationId`                                            |
| **Application** | No SYSTEM entities exist -- all data is org-owned                                                       |
| **Application** | Inngest event payloads carry `workspaceId`/`organizationId` context                                     |
| **Frontend**    | No SYSTEM badges, filters, or special-case UI                                                           |

---

## 5. What Was NOT Changed

These items are explicitly out of scope for this overhaul:

- **Data migration execution** -- Migration scripts were created but not executed against the production database. They require `bun run db:push` (schema) followed by manual script execution.
- **Playbook content packaging** -- The playbook-as-seed infrastructure is in place, but packaging existing agent/skill definitions into playbook manifests is a separate data task.
- **Route-level auth enforcement** -- This was addressed in the prior [Cross-Org Isolation Audit](../.cursor/plans/cross-org_isolation_audit_88e8e39d.plan.md). This overhaul focused on schema and data isolation, not authentication middleware.
- **Vector store `organizationId` column** -- The `rag_documents` table (managed by `@mastra/pg`, `@@ignore` in Prisma) still uses metadata-based org filtering. Adding a dedicated column requires `@mastra/pg` customization.
- **Memory/thread isolation** -- Mastra-managed tables still use convention-based `orgId:` prefix for thread isolation.
- **Per-org credential encryption** -- Still uses a single global `CREDENTIAL_ENCRYPTION_KEY`.

---

## 6. Files Changed Summary

**179 files** across the monorepo:

| Directory                     | Files | Primary Changes                                                                                                 |
| ----------------------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| `packages/database/prisma/`   | 1     | Schema: constraints, non-nullable fields, enum cleanup, model removal                                           |
| `packages/agentc2/src/`       | ~40   | Resolver, tools, skills, documents, budget, guardrails, sessions, workflows, networks, playbooks, BIM, security |
| `apps/agent/src/app/api/`     | ~60   | API route fixes: slug lookups, creates, selects, SYSTEM removal                                                 |
| `apps/agent/src/app/` (pages) | ~12   | Frontend: SYSTEM badges, filters, type definitions                                                              |
| `apps/agent/src/lib/`         | ~10   | Inngest, run-recorder, audit-log, campaign-functions, approvals, alerts                                         |
| `apps/agent/src/components/`  | ~5    | AgentSelector, TaskSuggestions, SkillDetailSheet                                                                |
| `apps/admin/src/`             | ~5    | Admin dashboards: tenant, financials, billing, audit-log queries                                                |
| `scripts/`                    | ~6    | Migration scripts, seed scripts                                                                                 |
| `tests/`                      | ~15   | Fixtures, unit tests, integration tests, e2e tests                                                              |
| `docs/`                       | ~5    | CLAUDE.md, agent-migration deprecation notices                                                                  |
