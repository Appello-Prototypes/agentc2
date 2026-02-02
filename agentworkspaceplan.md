# Agent Workspace Prototype → Production Backend, API, and Database Specification

This document defines the production-ready backend, API, and database implementation plan for the Agent Workspace prototype at `/agent/workspace/[agentSlug]/`. It reflects the current frontend UI, uses the mandated stack (Next.js 16, React 19, TypeScript 5, Bun, Mastra, Prisma, Supabase Postgres, Better Auth, Inngest, Vercel AI SDK), and assumes SaaS-grade auth, auditability, and multi-tenant safety.

All mock/demo data in the prototype is mapped to real database entities or API responses. Each page below includes a complete operational, UI, workflow, API, database, Mastra, background job, real-time, and priority specification.

---

## Audit Findings

This section documents gaps, inconsistencies, and decision points identified during the Prototype → Production audit against Mastra.ai best practices (internal and official documentation) and the current codebase architecture.

### Gaps vs Mastra Best Practices

| Area                 | Gap                                                                                                                                                                   | Required Action                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Observability**    | Mastra `Observability` component is NOT configured in `packages/mastra/src/mastra.ts`. No trace storage or redaction is active.                                       | Add `Observability` config with storage backend, optional redaction, and OpenTelemetry provider compatibility.   |
| **RequestContext**   | Current `AgentResolver` uses a custom `RequestContext` interface. Mastra's core `RequestContext` has reserved keys (`resource`, `thread`) for user/session isolation. | Align custom `RequestContext` with Mastra's reserved keys; use `resource.userId` and `thread.id` patterns.       |
| **Guardrails**       | Plan mentions UI toggles but does not map to Mastra input/output processors (`ModerationProcessor`, `PIIDetector`, `PromptInjectionDetector`) or tripwire handling.   | Define processor mappings, specify "block vs rewrite vs warn" strategies, and document tripwire action handling. |
| **Memory**           | Plan does not clearly differentiate message history (sliding window), working memory (persistent key-value), and semantic recall (vector search).                     | Clarify memory modes; document `pgvector` extension requirement; specify storage configuration.                  |
| **Tools**            | Plan does not require input/output schemas, execution cancellation via `AbortSignal`, or MCP tool metadata.                                                           | Add tool schema validation requirements; document cancellation support; specify MCP discovery.                   |
| **Evals**            | Plan does not mention live scorers (evaluated during generation), sampling configuration per scorer, or Mastra's native `mastra_scorers` table.                       | Add live vs post-run scorer distinction; define sampling rates; clarify storage source.                          |
| **Workflow Control** | Plan does not address suspend/resume for human-in-the-loop or long-running workflows.                                                                                 | Document Mastra's `suspend()` and `resume()` primitives; tie to versioning/approval flows.                       |

### Gaps vs Current System

| Area                 | Current State                                                                            | Plan Proposal                                                                                                                                                                                                                                                                                                                   | Required Action                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **API Endpoints**    | Existing: `/api/agents`, `/api/agents/:id`, `/api/agents/:id/test` (accepts slug or id)  | Plan defines many new endpoints without marking existing vs new.                                                                                                                                                                                                                                                                | Mark existing endpoints; label new endpoints explicitly.                         |
| **Tool Registry**    | Tools are code-defined in `packages/mastra/src/tools/registry.ts` with MCP fallback.     | Plan proposes `ToolDefinition` database table.                                                                                                                                                                                                                                                                                  | Clarify registry ownership: code-first with optional DB overrides OR DB-primary. |
| **Scorer Registry**  | Scorers are code-defined in `packages/mastra/src/scorers/registry.ts`.                   | Plan proposes `ScorerDefinition` database table.                                                                                                                                                                                                                                                                                | Same decision as tools; likely code-first with sampling config per-agent.        |
| **Database Schema**  | Existing tables: `Agent`, `AgentTool`, `AgentVersion`, `StoredAgent`, `VoiceAgentTrace`. | Plan proposes ~20 new tables: `AgentRun`, `AgentTrace`, `AgentToolCall`, `AgentEvaluation`, `AgentFeedback`, `AgentTestCase`, `AgentTestRun`, `AgentConversation`, `AgentStatsDaily`, `AgentAlert`, `AgentConfig`, `ToolDefinition`, `ScorerDefinition`, `BudgetPolicy`, `CostEvent`, `GuardrailPolicy`, `GuardrailEvent`, etc. | Add migration checklist; define indexes and retention policies.                  |
| **Multi-Tenancy**    | `Agent` model has `ownerId` but no `tenantId`.                                           | Plan assumes `tenantId` on all models.                                                                                                                                                                                                                                                                                          | Add `tenantId` to `Agent` and all new models; define migration strategy.         |
| **Postgres Storage** | `@mastra/pg` is configured for Mastra storage in `packages/mastra/src/storage.ts`.       | Plan assumes this exists but doesn't verify.                                                                                                                                                                                                                                                                                    | Confirmed working; document integration points.                                  |
| **Vector Store**     | `PgVector` configured in `packages/mastra/src/vector.ts` for semantic recall.            | Plan mentions semantic recall but doesn't specify pgvector.                                                                                                                                                                                                                                                                     | Document `pgvector` extension requirement and index strategy.                    |

### Areas Requiring Decisions

| Decision                          | Options                                                                            | Recommendation                                                                           | Priority           |
| --------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------ |
| **Observability Storage**         | (A) Postgres via `@mastra/pg`, (B) ClickHouse for scale, (C) Mastra Cloud          | Start with Postgres for MVP; migrate to ClickHouse or Mastra Cloud for production scale. | MVP-critical       |
| **Eval Storage Strategy**         | (A) Custom `AgentEvaluation` table, (B) Mastra's native `mastra_scorers` table     | Use Mastra's native table for raw scores; use custom table for aggregated insights.      | MVP-critical       |
| **Tenancy Model**                 | (A) Add `tenantId` to all models now, (B) Use `ownerId` as implicit tenant for MVP | Add `tenantId` now for SaaS readiness; default to `ownerId` if tenancy not enabled.      | MVP-critical       |
| **Tool Registry Source of Truth** | (A) Code-first with DB config overrides, (B) DB-primary with code fallback         | Code-first (current approach) with per-agent tool config in `AgentTool.config`.          | Phase 2            |
| **Real-Time Transport**           | (A) Server-Sent Events (SSE), (B) WebSocket                                        | SSE for simplicity; WebSocket for bidirectional needs (e.g., cancel in-flight runs).     | MVP-critical (SSE) |

### Final Decisions (Selected)

| Decision                 | Final Choice                             | Notes                                                         |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------- |
| Observability storage    | **PostgreSQL via @mastra/pg**            | Enable Mastra Observability with Postgres storage.            |
| Multi-tenancy            | **Add tenantId to all models now**       | Enforce tenant scoping on every query.                        |
| Tool registry            | **Code-first with DB config overrides**  | No ToolDefinition table in MVP.                               |
| Scorer registry          | **Code-first with per-agent sampling**   | No ScorerDefinition table in MVP.                             |
| Evaluation storage       | **Mastra raw + custom aggregates**       | Mastra for raw scores; custom tables for reporting.           |
| Real-time transport      | **SSE**                                  | Add a `/runs/:id/cancel` POST endpoint for cancellation.      |
| Version snapshot content | **Agent config + tool IDs + scorer IDs** | Snapshot includes tool/scorer assignments.                    |
| Guardrail strategy       | **Input: block** / **Output: redact**    | Block injection/jailbreak; redact PII; block severe toxicity. |
| Analytics rollup         | **On-demand aggregation**                | Compute analytics per request; cache as needed.               |
| Test case storage        | **Database (AgentTestCase)**             | UI-managed test cases.                                        |
| Cost calculation         | **Vercel AI SDK usage stats**            | Use SDK usage metadata; no external pricing API calls.        |
| Audit log scope          | **Writes + sensitive reads**             | Log config/version/guardrail reads.                           |
| MVP scope                | **All pages in MVP**                     | Analytics, evaluations, costs, guardrails included.           |
| Data retention           | **Permanent for all data**               | Override prior retention durations.                           |
| Deployment target        | **Vercel**                               | Use SSE + Inngest for long-running work.                      |

### Migration Checklist

New Prisma models required (in order of dependency):

1. **MVP** - Core execution tracking:
    - [ ] `AgentRun` - Execution history
    - [ ] `AgentTrace` - Trace details per run
    - [ ] `AgentTraceStep` - Individual execution steps
    - [ ] `AgentToolCall` - Tool call records
    - [ ] `AgentAlert` - System/budget/guardrail alerts
    - [ ] `AuditLog` - All write operations

2. **MVP** - Evaluation and testing:
    - [ ] `AgentEvaluation` - Evaluation scores per run
    - [ ] `AgentFeedback` - User feedback per run
    - [ ] `AgentTestCase` - Stored test cases
    - [ ] `AgentTestRun` - Test execution results

3. **MVP** - Cost and budget:
    - [ ] `BudgetPolicy` - Per-agent budget settings
    - [ ] `CostEvent` - Token/cost tracking per run
    - [ ] `AgentCostDaily` - Daily cost rollups
    - [ ] `CostRecommendation` - AI-generated savings tips

4. **MVP** - Guardrails and governance:
    - [ ] `GuardrailPolicy` - Per-agent guardrail config
    - [ ] `GuardrailEvent` - Blocked/modified/flagged events

5. **MVP** - Analytics rollups:
    - [ ] `AgentStatsDaily` - Daily KPI rollups
    - [ ] `AgentMetricDaily` - Performance metrics
    - [ ] `AgentToolMetricDaily` - Tool usage metrics
    - [ ] `AgentModelMetricDaily` - Model comparison metrics
    - [ ] `AgentQualityMetricDaily` - Quality score rollups
    - [ ] `AgentFeedbackAggregateDaily` - Feedback summaries
    - [ ] `AgentVersionStats` - Per-version performance
    - [ ] `EvaluationTheme` - Feedback theme extraction
    - [ ] `Insight` - AI-generated insights

6. **Future** - Advanced features:
    - [ ] `AgentConversation` - Conversation persistence
    - [ ] `AgentConfig` - Config snapshots (if separate from AgentVersion)
    - [ ] `ToolDefinition` - DB-driven tool registry (if migrating from code)
    - [ ] `ScorerDefinition` - DB-driven scorer registry (if migrating from code)

### Index Strategy

All new tables should include:

- Primary key index (automatic with `@id`)
- `tenantId` index for tenant isolation
- `agentId` index for agent-scoped queries
- `createdAt` index for time-range filtering
- Composite indexes for common query patterns (e.g., `[agentId, createdAt]`)

### Data Retention Defaults

| Data Type              | Retention | Rationale                         |
| ---------------------- | --------- | --------------------------------- |
| Raw traces, tool calls | Permanent | Chosen for long-term auditability |
| Runs, cost events      | Permanent | Chosen for long-term auditability |
| Evaluations, feedback  | Permanent | Chosen for long-term auditability |
| Aggregated metrics     | Permanent | Chosen for long-term auditability |
| Versions, configs      | Permanent | Chosen for long-term auditability |
| Audit logs             | Permanent | Chosen for long-term auditability |

---

## API Endpoint Status Summary

This section consolidates all API endpoints required for the Agent Workspace, marking existing implementations vs new requirements.

### Legend

- ✅ **EXISTS** - Endpoint is already implemented
- 🆕 **NEW** - Endpoint needs to be created
- ⚠️ **UPDATE** - Existing endpoint needs modifications

### Existing Endpoints (in `apps/agent/src/app/api/`)

| Endpoint                     | Method | Location                    | Notes                                                   |
| ---------------------------- | ------ | --------------------------- | ------------------------------------------------------- |
| `/api/agents`                | GET    | `agents/route.ts`           | Lists agents; supports both legacy and new Agent models |
| `/api/agents`                | POST   | `agents/route.ts`           | Creates new agent with slug generation                  |
| `/api/agents/:idOrSlug`      | GET    | `agents/[id]/route.ts`      | Gets agent by id or slug via AgentResolver              |
| `/api/agents/:idOrSlug`      | PUT    | `agents/[id]/route.ts`      | Updates agent config                                    |
| `/api/agents/:idOrSlug`      | DELETE | `agents/[id]/route.ts`      | Deletes agent (protected for SYSTEM type)               |
| `/api/agents/:idOrSlug/test` | POST   | `agents/[id]/test/route.ts` | Runs agent with test input                              |

### New Endpoints Required (by page)

#### Overview Page

| Endpoint                   | Method | Priority | Description                               |
| -------------------------- | ------ | -------- | ----------------------------------------- |
| `/api/agents/:id/overview` | GET    | MVP      | Aggregated stats, recent runs, alerts     |
| `/api/agents/:id/runs`     | POST   | MVP      | Create new run (stream via Vercel AI SDK) |
| `/api/agents/:id`          | PATCH  | MVP      | Partial update (isActive toggle)          |

#### Configure Page

| Endpoint                               | Method | Priority | Description                           |
| -------------------------------------- | ------ | -------- | ------------------------------------- |
| `/api/tools`                           | GET    | MVP      | List available tools (built-in + MCP) |
| `/api/scorers`                         | GET    | MVP      | List available scorers                |
| `/api/agents/:id/instructions/improve` | POST   | Phase 2  | AI-assisted instruction improvement   |

#### Test Page

| Endpoint                                 | Method | Priority | Description            |
| ---------------------------------------- | ------ | -------- | ---------------------- |
| `/api/agents/:id/test-cases`             | GET    | MVP      | List test cases        |
| `/api/agents/:id/test-cases`             | POST   | MVP      | Create test case       |
| `/api/agents/:id/test-cases/:caseId`     | PUT    | MVP      | Update test case       |
| `/api/agents/:id/test-cases/:caseId/run` | POST   | MVP      | Run single test case   |
| `/api/agents/:id/compare`                | POST   | Phase 2  | A/B version comparison |

#### Runs Page

| Endpoint                             | Method | Priority | Description             |
| ------------------------------------ | ------ | -------- | ----------------------- |
| `/api/agents/:id/runs`               | GET    | MVP      | List runs with filters  |
| `/api/agents/:id/runs/:runId`        | GET    | MVP      | Get run detail          |
| `/api/agents/:id/runs/:runId/trace`  | GET    | MVP      | Get trace for run       |
| `/api/agents/:id/runs/:runId/rerun`  | POST   | MVP      | Re-execute run          |
| `/api/agents/:id/runs/:runId/cancel` | POST   | MVP      | Cancel in-flight run    |
| `/api/agents/:id/runs/export`        | GET    | Phase 2  | Export runs as CSV/JSON |

#### Analytics Page

| Endpoint                             | Method | Priority | Description                 |
| ------------------------------------ | ------ | -------- | --------------------------- |
| `/api/agents/:id/analytics/summary`  | GET    | MVP      | Summary metrics with trends |
| `/api/agents/:id/analytics/runs`     | GET    | MVP      | Runs time series            |
| `/api/agents/:id/analytics/latency`  | GET    | MVP      | Latency percentiles         |
| `/api/agents/:id/analytics/tools`    | GET    | MVP      | Tool usage stats            |
| `/api/agents/:id/analytics/quality`  | GET    | MVP      | Quality score breakdown     |
| `/api/agents/:id/analytics/models`   | GET    | MVP      | Model comparison            |
| `/api/agents/:id/analytics/insights` | GET    | MVP      | AI-generated insights       |
| `/api/agents/:id/analytics/export`   | GET    | MVP      | Export analytics            |

#### Traces Page

| Endpoint                                 | Method | Priority | Description       |
| ---------------------------------------- | ------ | -------- | ----------------- |
| `/api/agents/:id/traces`                 | GET    | MVP      | List traces       |
| `/api/agents/:id/traces/:traceId`        | GET    | MVP      | Get trace detail  |
| `/api/agents/:id/traces/:traceId/replay` | POST   | Phase 2  | Replay from trace |
| `/api/agents/:id/traces/:traceId/rerun`  | POST   | Phase 2  | Re-run from trace |
| `/api/agents/:id/traces/export`          | GET    | Phase 2  | Export traces     |

#### Evaluations Page

| Endpoint                               | Method | Priority | Description              |
| -------------------------------------- | ------ | -------- | ------------------------ |
| `/api/agents/:id/evaluations`          | GET    | MVP      | List evaluations         |
| `/api/agents/:id/evaluations/run`      | POST   | MVP      | Trigger evaluation batch |
| `/api/agents/:id/evaluations/summary`  | GET    | MVP      | Evaluation summary stats |
| `/api/agents/:id/feedback/summary`     | GET    | MVP      | Feedback summary         |
| `/api/agents/:id/evaluations/insights` | GET    | MVP      | AI insights              |
| `/api/agents/:id/evaluations/export`   | GET    | MVP      | Export evaluations       |

#### Costs Page

| Endpoint                                | Method | Priority | Description                 |
| --------------------------------------- | ------ | -------- | --------------------------- |
| `/api/agents/:id/costs/summary`         | GET    | MVP      | Cost summary with breakdown |
| `/api/agents/:id/budget`                | GET    | MVP      | Get budget policy           |
| `/api/agents/:id/budget`                | PUT    | MVP      | Update budget policy        |
| `/api/agents/:id/costs/recommendations` | GET    | MVP      | Cost optimization tips      |
| `/api/agents/:id/costs/export`          | GET    | MVP      | Export cost data            |

#### Versions Page

| Endpoint                                     | Method | Priority | Description            |
| -------------------------------------------- | ------ | -------- | ---------------------- |
| `/api/agents/:id/versions`                   | GET    | MVP      | List versions          |
| `/api/agents/:id/versions/:version`          | GET    | MVP      | Get version snapshot   |
| `/api/agents/:id/versions/compare`           | POST   | Phase 2  | Compare two versions   |
| `/api/agents/:id/versions/:version/rollback` | POST   | MVP      | Rollback to version    |
| `/api/agents/:id/versions/export`            | GET    | Phase 2  | Export version history |

#### Guardrails Page

| Endpoint                            | Method | Priority | Description               |
| ----------------------------------- | ------ | -------- | ------------------------- |
| `/api/agents/:id/guardrails`        | GET    | MVP      | Get guardrail config      |
| `/api/agents/:id/guardrails`        | PUT    | MVP      | Update guardrail config   |
| `/api/agents/:id/guardrails/events` | GET    | MVP      | List guardrail events     |
| `/api/agents/:id/guardrails/test`   | POST   | MVP      | Test guardrail with input |

---

## Database Model Status Summary

### Legend

- ✅ **EXISTS** - Model is already in Prisma schema
- 🆕 **NEW** - Model needs to be created
- ⚠️ **UPDATE** - Existing model needs field additions

### Existing Models (in `packages/database/prisma/schema.prisma`)

| Model                | Status                     | Notes                                               |
| -------------------- | -------------------------- | --------------------------------------------------- |
| `Agent`              | ✅ EXISTS, ⚠️ NEEDS UPDATE | Add `tenantId` field for multi-tenancy              |
| `AgentTool`          | ✅ EXISTS                  | Junction table for agent-tool relationships         |
| `AgentVersion`       | ✅ EXISTS, ⚠️ NEEDS UPDATE | Add `tenantId`, `description`, `changesJson` fields |
| `StoredAgent`        | ✅ EXISTS (legacy)         | Keep for backward compatibility during migration    |
| `VoiceAgentTrace`    | ✅ EXISTS                  | Voice-specific tracing; consider generalizing       |
| `User`               | ✅ EXISTS                  | Better Auth user model                              |
| `Session`            | ✅ EXISTS                  | Better Auth sessions                                |
| `Account`            | ✅ EXISTS                  | OAuth accounts                                      |
| `ChannelSession`     | ✅ EXISTS                  | Multi-channel conversation tracking                 |
| `ChannelCredentials` | ✅ EXISTS                  | Encrypted channel credentials                       |
| `VoiceCallLog`       | ✅ EXISTS                  | Voice call history                                  |

### New Models Required (by priority)

#### MVP - Core Execution

| Model            | Key Fields                                                                                                                            | Indexes                           | Retention |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------- |
| `AgentRun`       | id, agentId, tenantId, runType, status, inputText, outputText, durationMs, tokens, costUsd, versionId, userId, startedAt, completedAt | [agentId, createdAt], [status]    | Permanent |
| `AgentTrace`     | id, runId, agentId, tenantId, status, inputText, outputText, stepsJson, modelJson, tokensJson, scoresJson                             | [runId], [agentId, createdAt]     | Permanent |
| `AgentTraceStep` | id, traceId, tenantId, stepNumber, type, content, timestamp, durationMs                                                               | [traceId, stepNumber]             | Permanent |
| `AgentToolCall`  | id, runId, traceId, tenantId, toolKey, mcpServerId, inputJson, outputJson, success, error, durationMs                                 | [runId], [traceId, toolKey]       | Permanent |
| `AgentAlert`     | id, agentId, tenantId, severity, message, source, createdAt, resolvedAt                                                               | [agentId, createdAt, severity]    | Permanent |
| `AuditLog`       | id, tenantId, actorId, action, entityType, entityId, metadata, createdAt                                                              | [tenantId, createdAt], [entityId] | Permanent |

#### MVP - Evaluation and Testing

| Model             | Key Fields                                                                          | Indexes                       | Retention |
| ----------------- | ----------------------------------------------------------------------------------- | ----------------------------- | --------- |
| `AgentEvaluation` | id, runId, agentId, tenantId, scoresJson, scorerVersion, createdAt                  | [runId], [agentId, createdAt] | Permanent |
| `AgentFeedback`   | id, runId, agentId, tenantId, thumbs, rating, comment, createdAt                    | [runId], [agentId]            | Permanent |
| `AgentTestCase`   | id, agentId, tenantId, name, inputText, expectedOutput, tags, createdBy             | [agentId]                     | Permanent |
| `AgentTestRun`    | id, testCaseId, agentId, tenantId, versionId, outputText, passed, score, durationMs | [testCaseId], [agentId]       | Permanent |

#### MVP - Cost and Budget

| Model                | Key Fields                                                                    | Indexes              | Retention |
| -------------------- | ----------------------------------------------------------------------------- | -------------------- | --------- |
| `BudgetPolicy`       | id, agentId, tenantId, enabled, monthlyLimitUsd, alertAtPct, hardLimit        | [agentId]            | Permanent |
| `CostEvent`          | id, runId, agentId, tenantId, provider, modelName, tokens, costUsd, createdAt | [agentId, createdAt] | Permanent |
| `AgentCostDaily`     | id, agentId, tenantId, date, totalCostUsd, promptCostUsd, completionCostUsd   | [agentId, date]      | Permanent |
| `CostRecommendation` | id, agentId, tenantId, type, title, description, estimatedSavingsUsd          | [agentId, createdAt] | Permanent |

#### MVP - Guardrails

| Model             | Key Fields                                                          | Indexes              | Retention |
| ----------------- | ------------------------------------------------------------------- | -------------------- | --------- |
| `GuardrailPolicy` | id, agentId, tenantId, configJson, version, createdBy               | [agentId]            | Permanent |
| `GuardrailEvent`  | id, agentId, tenantId, runId, type, guardrailKey, reason, createdAt | [agentId, createdAt] | Permanent |

#### MVP - Analytics Rollups

| Model                         | Key Fields                                                                            | Indexes                    | Retention |
| ----------------------------- | ------------------------------------------------------------------------------------- | -------------------------- | --------- |
| `AgentStatsDaily`             | id, agentId, tenantId, date, totalRuns, successRate, avgDurationMs, avgQualityScore   | [agentId, date]            | Permanent |
| `AgentMetricDaily`            | id, agentId, tenantId, date, runs, successRate, avgLatencyMs, errorRate, qualityScore | [agentId, date]            | Permanent |
| `AgentToolMetricDaily`        | id, agentId, tenantId, toolKey, date, callCount, successRate, avgDurationMs           | [agentId, toolKey, date]   | Permanent |
| `AgentModelMetricDaily`       | id, agentId, tenantId, modelProvider, modelName, date, runs, avgLatencyMs, costUsd    | [agentId, modelName, date] | Permanent |
| `AgentQualityMetricDaily`     | id, agentId, tenantId, scorerKey, date, avgScore, sampleCount                         | [agentId, scorerKey, date] | Permanent |
| `AgentFeedbackAggregateDaily` | id, agentId, tenantId, date, positiveCount, negativeCount                             | [agentId, date]            | Permanent |
| `AgentVersionStats`           | id, versionId, agentId, tenantId, runs, successRate, avgQuality                       | [versionId]                | Permanent |
| `EvaluationTheme`             | id, agentId, tenantId, theme, sentiment, count                                        | [agentId, createdAt]       | Permanent |
| `Insight`                     | id, agentId, tenantId, type, title, description                                       | [agentId, createdAt]       | Permanent |

#### Future - Advanced Features

| Model               | Key Fields                                         | Notes                                   |
| ------------------- | -------------------------------------------------- | --------------------------------------- |
| `AgentConversation` | id, agentId, tenantId, runId, messagesJson         | For multi-turn conversation persistence |
| `AgentConfig`       | id, agentId, tenantId, version, configJson, status | If separate from AgentVersion           |
| `ToolDefinition`    | id, tenantId, key, name, type, inputSchemaJson     | Only if migrating from code registry    |
| `ScorerDefinition`  | id, tenantId, key, name, configJson                | Only if migrating from code registry    |

---

## /agent/workspace/[agentSlug]/layout.tsx

### 1. Page Purpose + Operational Role

The workspace shell provides agent context, navigation between all operational views, and safety-state awareness while enforcing tenant-scoped access. It is used by operators, agent managers, and developers to move between configuration, monitoring, and analysis views without losing agent identity. 2. UI Component Inventory (Exhaustive)
Component Data required State dependencies Validation (Zod) Loading/Error
Sidebar loading skeleton none loading=true none skeleton for header + nav + main
Main content loading skeleton none loading=true none large content placeholder
Agent header: name Agent.name agent string 1–100 hidden during loading
Agent header: status badge Agent.isActive agent boolean show inactive state if false
Agent header: model info Agent.modelProvider, Agent.modelName agent enum provider; model id show “unknown” if missing
Agent header: SYSTEM badge Agent.type agent enum SYSTEM/USER only visible for SYSTEM
Navigation list (10 items) route ids + labels activeTab from pathname path validation active style + hover
Back to Agents button none router none available for not-found and normal
Not Found state agentSlug agent=null none shows title, message, button
Main content slot child routes none none overflow handling 3. Functional Workflow Requirements
Load agent context: on mount trigger fetch; UI shows skeleton; backend reads agent by slug or id; success renders nav + header; failure shows Not Found; audit read access; enforce tenant scope and role (viewer+).
Navigation selection: on click route change; UI highlights active tab; backend no change; ensure authorized routes; audit optional.
Back to Agents: on click navigate to agent list; UI route change; backend no change; no audit required. 4. API Requirements (Next.js Route Handlers)
GET /api/agents/:agentId; request: path param agentId (slug or id); response: {success, agent}; auth: Better Auth session required; errors: 401 unauthenticated, 403 unauthorized, 404 agent not found, 500. 5. Database Schema Requirements (Prisma + Supabase)
Agent: id uuid/cuid; slug unique; name; description; modelProvider; modelName; isActive; type; ownerId; tenantId; createdAt; updatedAt; indexes on slug, ownerId, tenantId; retention permanent.
AuditLog: id; tenantId; actorId; action AGENT*VIEW; entityType Agent; entityId; metadata; createdAt; index on tenantId, entityId; retention permanent. 6. Mastra Integration Requirements
Agent header must reflect the active Mastra config stored for the agent; use the same source used by agentResolver and Mastra registry. 7. Background Jobs + Event Pipelines (Inngest)
None required for layout; optional audit log batching. 8. Real-Time Execution + Observability
Optional SSE channel to update Agent.isActive or model changes in near real-time if modified elsewhere. 9. Implementation Priority
MVP-critical: agent fetch, access control, navigation shell.
Phase 2: live status updates in header.
/agent/workspace/[agentSlug]/overview/ 10. Page Purpose + Operational Role
Provides a high-level operational dashboard of agent health, activity, and risk signals. Used by operators and managers to decide if the agent is healthy, trending well, or requires intervention. 11. UI Component Inventory (Exhaustive)
Component Data required State dependencies Validation (Zod) Loading/Error
Header title/subtitle static none none skeleton on load
Health indicator AgentStats.successRate stats number 0–100 show warning/critical if low
Run Test button none agent id none disabled if agent inactive
KPI cards (6) AgentStats fields stats numeric ranges show 0 if missing
Recent Activity card RecentRun[] recentRuns array length empty state if 0
Recent run row Run.id,input,output,status,duration,createdAt,scores recentRuns enums for status click navigates to run detail
View All button none agent id none route to runs page
Alerts card AgentAlert[] alerts array length empty state if none
Alert item Alert.severity,message,createdAt alerts severity enum color-coded
Quick Actions list none agent id none routes to other pages
Disable Agent button none agent id none confirm required
Loading skeletons none loading=true none cards + list placeholders 12. Functional Workflow Requirements
Load overview metrics: trigger on mount; UI skeleton; backend aggregates stats from runs, evaluations, costs; success populates cards; failure shows error banner; audit view; enforce tenant scope.
Run Test action: click triggers a test run; UI shows toast + link to test page; backend creates AgentRun with type TEST and streams output; failure shows error toast; audit RUN_TEST.
Recent Activity click: select run; UI routes to runs page with selected run; backend no change; audit optional.
Alerts review: click alert (optional); UI shows details or routes; backend marks alert as seen; audit ALERT_VIEW.
Disable Agent: click; UI confirms; backend sets Agent.isActive=false and records audit; failure shows error. 13. API Requirements (Next.js Route Handlers)
GET /api/agents/:agentId/overview; request: query from,to,tz; response: {stats, recentRuns, alerts, health}; auth: session required; errors: 401, 403, 404, 500.
POST /api/agents/:agentId/runs; request: {input, runType:"TEST"|"PROD", contextVars}; response: stream via Vercel AI SDK plus final {runId}; auth: session required; errors: 401, 403, 422 validation, 429 rate limit, 500.
PATCH /api/agents/:agentId; request: {isActive}; response: {agent}; auth: owner/admin; errors: 401, 403, 404, 409. 14. Database Schema Requirements (Prisma + Supabase)
AgentStatsDaily (rollup): id; agentId; tenantId; date; totalRuns; successRate; avgDurationMs; avgQualityScore; totalCostUsd; runsToday; runsThisWeek; indexes on agentId,date; retention permanent.
AgentRun: id; agentId; tenantId; runType; status; inputText; outputText; durationMs; startedAt; completedAt; modelProvider; modelName; versionId; promptTokens; completionTokens; totalTokens; costUsd; userId; indexes on agentId,status,createdAt; retention permanent.
AgentAlert: id; agentId; tenantId; severity; message; source COST|GUARDRAIL|EVAL|SYSTEM; createdAt; resolvedAt; indexes on agentId,createdAt,severity; retention permanent.
AuditLog: id; tenantId; actorId; action; entityType; entityId; metadata; createdAt; index on tenantId,createdAt; retention permanent. 15. Mastra Integration Requirements
Runs initiated from overview use @mastra/core agent execution; memory uses @mastra/memory with @mastra/pg storage; tool calls route via @mastra/mcp.
Quality score uses @mastra/evals scoring after run completion. 16. Background Jobs + Event Pipelines (Inngest)
run.completed → compute stats rollup, update alerts, trigger evaluations.
budget.threshold → create AgentAlert.
guardrail.event → create AgentAlert. 17. Real-Time Execution + Observability
SSE channel agent/{id}/overview for stats + alerts updates; push new runs and alert changes.
Live test run streaming via Vercel AI SDK. 18. Implementation Priority
MVP-critical: stats load, recent runs, alerts, Run Test, disable agent.
Phase 2: automated alert insights and AI recommendations.
/agent/workspace/[agentSlug]/configure/ 19. Page Purpose + Operational Role
Provides the authoritative, production configuration editor for agent behavior, tools, memory, and evals. Used by agent owners and engineers to change production configuration and publish versioned updates. 20. UI Component Inventory (Exhaustive)
Component Data required State dependencies Validation (Zod) Loading/Error
Header + version label Agent.version agent int ≥ 1 skeleton on load
Unsaved changes badge hasChanges form state boolean hidden if false
Discard button agent form state none disabled if no changes
Save Changes button form payload saving state schema validation disabled if invalid
Tabs list none activeTab enum values none
Basic tab: name input Agent.name formData string 1–100 inline error
Basic tab: slug input Agent.slug formData regex ^[a-z0-9-]+$ inline error
Basic tab: description textarea Agent.description formData max 500 inline error
Basic tab: Active switch Agent.isActive formData boolean none
Basic tab: Public switch Agent.isPublic formData boolean none
Basic tab: SYSTEM warning Agent.type agent enum informational
Model tab: provider select Agent.modelProvider formData enum providers inline error
Model tab: model select Agent.modelName formData enum by provider inline error
Temperature slider Agent.temperature formData 0–1 clamp
Max Tokens input Agent.maxTokens formData int ≥ 1 or null inline error
Max Steps slider Agent.maxSteps formData int 1–20 clamp
Extended Thinking switch Agent.modelConfig provider check boolean only for Anthropic
Instructions textarea Agent.instructions formData string ≥ 1 inline error
AI Improve button instructions formData none loading + error toast
Template variables list static none none copy to clipboard
Tools tab: select all/clear ToolInfo[] (from registry) formData.tools array none
Tools grid with checkboxes ToolInfo (from registry) formData.tools tool id exists inline error
Memory tab: enable switch Agent.memoryEnabled formData boolean none
Memory tab: last messages slider memoryConfig.lastMessages formData int 1–50 clamp
Memory tab: semantic recall switch memoryConfig.semanticRecall formData bool or object none
Memory tab: working memory switch memoryConfig.workingMemory formData bool none
Evaluation tab: scorers grid ScorerInfo[] (from registry) formData.scorers scorer id exists inline error
Evaluation tab: sampling slider evalSamplingRate formData int 10–100 clamp
Loading skeletons none loading=true none header + tabs + card 21. Functional Workflow Requirements
Load agent config: on mount fetch agent + tools + scorers; UI skeleton; backend returns active config and definitions; error shows banner; audit read access.
Edit fields: change updates local form state; UI shows Unsaved Changes badge; no backend calls.
Discard: reset form to current config; UI clears badge; audit optional.
Save: validate with Zod; UI shows saving state; backend writes config, creates new AgentVersion, updates Agent.version, logs audit; success toast; failure toast.
AI Improve: click sends instructions to AI endpoint; UI shows spinner; backend uses Vercel AI SDK to propose improvements; insert result into textarea; audit AI_SUGGEST.
Tool selection: selecting tool ensures MCP availability and connection; backend validates tool is enabled for tenant; audit config change. 22. API Requirements (Next.js Route Handlers)
GET /api/agents/:agentId; request: none; response: {agent, tools, scorers, config}; auth: session required; errors: 401, 403, 404.
PUT /api/agents/:agentId; request: full AgentConfig payload; response: {agent, version}; auth: owner/admin; errors: 401, 403, 409, 422.
GET /api/tools; request: query type=mcp|built-in; response: {tools[]}; auth: session required; errors: 401, 403.
GET /api/scorers; request: none; response: {scorers[]}; auth: session required.
POST /api/agents/:agentId/instructions/improve; request: {instructions}; response: {suggestedInstructions, rationale}; auth: owner/admin; errors: 401, 403, 429, 500. 23. Database Schema Requirements (Prisma + Supabase)
Agent: id; tenantId; slug; name; description; modelProvider; modelName; temperature; maxTokens; maxSteps; memoryEnabled; scorers; type; isPublic; isActive; version; createdAt; updatedAt; indexes on tenantId,slug.
AgentConfig: id; agentId; tenantId; version; configJson; status DRAFT|ACTIVE|ARCHIVED; createdBy; createdAt; index on agentId,version; retention permanent for audit.
AgentVersion: id; agentId; tenantId; version; description; changesJson; snapshotJson; createdBy; createdAt; index on agentId,version; retention permanent.
AgentTool: id; agentId; toolId; configJson; index on agentId; retention permanent.
ToolDefinition: optional future table if migrating to DB-driven tool registry (not in MVP).
ScorerDefinition: optional future table if migrating to DB-driven scorer registry (not in MVP). 24. Mastra Integration Requirements
Agent config maps 1:1 to @mastra/core agent creation; memory config uses @mastra/memory with @mastra/pg storage; tool wiring uses @mastra/mcp.
ModelConfig supports provider-specific settings such as Anthropic extended thinking. 25. Background Jobs + Event Pipelines (Inngest)
agent.config.saved → create AgentVersion, update rollups, refresh tool registries.
agent.tools.changed → validate MCP connections and refresh tool availability. 26. Real-Time Execution + Observability
Optional SSE agent/{id}/config to inform other sessions of updated config/version. 27. Implementation Priority
MVP-critical: load config, edit, save, version creation, tool/scorer lists.
Phase 2: AI Improve, advanced tool validation, multi-user live collaboration.
/agent/workspace/[agentSlug]/test/ 28. Page Purpose + Operational Role
Interactive sandbox for testing agent behavior, regression test cases, and A/B comparisons between versions. Used by developers, QA, and agent managers. 29. UI Component Inventory (Exhaustive)
Component Data required State dependencies Validation (Zod) Loading/Error
Header title/subtitle static none none skeleton on load
Tabs list none activeTab enum values none
Chat card header none none none none
Clear Chat button none messages none disabled if empty
Messages list Message[] messages message schema empty state if none
Message bubble Message.role,content messages role enum none
Assistant metadata durationMs,tokens,toolCalls message numeric ranges hidden if absent
Sending indicator sending sending state boolean only while streaming
Input textarea inputValue local state min 1; max 8k error on empty
Send button inputValue sending none disabled while sending
Context injection panel contextVars local state string format; email inline error
Add Variable button none contextVars none opens modal in prod
Test Cases list TestCase[] testCases schema empty state if none
Add Test Case button none none none opens modal
Run All Tests button none runningTests none disabled while running
Test case row TestCase fields testCases schema badge by lastResult
Run/Edit buttons testCase id none none permissions check
A/B Version A panel AgentVersion selected versions version id exists placeholder if missing
A/B Version B selector AgentVersion[] selection version id exists none
Comparison prompt textarea prompt local state min 1 inline error
Run Comparison button prompt running none disabled if invalid
Loading skeletons none loading=true none chat area + header 30. Functional Workflow Requirements
Load page: fetch test cases and versions; UI skeleton; backend returns lists; error shows banner; audit view.
Send chat message: click send; UI appends user message; backend starts run with Vercel AI streaming; UI streams assistant tokens; on completion store AgentRun and message metadata; on error show toast and mark run failed; audit RUN_TEST.
Clear chat: removes session messages; backend optionally archives conversation; audit optional.
Add/Edit test case: open modal; validate fields; backend creates/updates test case; audit TESTCASE_CREATE/UPDATE.
Run test case: trigger run with stored input; backend evaluates expected output; store AgentTestRun + evaluation; UI updates lastResult.
Run all tests: enqueue batch; UI shows running; backend uses Inngest batch job; updates results on completion.
A/B comparison: select versions + prompt; backend runs two versions, records results, optional evaluation; UI displays side-by-side metrics; audit AB_COMPARE. 31. API Requirements (Next.js Route Handlers)
POST /api/agents/:agentId/runs; request: {input, runType:"TEST", contextVars, versionId?}; response: stream + {runId}; auth: session required; errors: 401, 403, 422, 429.
GET /api/agents/:agentId/test-cases; request: pagination; response: {testCases[]}; auth: session required.
POST /api/agents/:agentId/test-cases; request: {name,input,expectedOutput,tags}; response: {testCase}; auth: owner/admin; errors: 422.
PUT /api/agents/:agentId/test-cases/:caseId; request: {name,input,expectedOutput}; response: {testCase}; auth: owner/admin.
POST /api/agents/:agentId/test-cases/:caseId/run; request: {versionId?, contextVars}; response: {testRun}; auth: session required.
POST /api/agents/:agentId/compare; request: {prompt, versionAId, versionBId, contextVars}; response: {comparison}; auth: session required. 32. Database Schema Requirements (Prisma + Supabase)
AgentTestCase: id; agentId; tenantId; name; inputText; expectedOutput; tags; createdBy; createdAt; updatedAt; index on agentId; retention permanent.
AgentTestRun: id; testCaseId; agentId; tenantId; versionId; inputText; outputText; passed; score; durationMs; tokens; createdAt; index on testCaseId,agentId; retention permanent.
AgentRun: id; agentId; tenantId; runType TEST|PROD|AB; status; inputText; outputText; durationMs; tokens; costUsd; versionId; createdAt; indexes; retention permanent.
AgentConversation: id; agentId; tenantId; runId; messagesJson; createdAt; index on agentId; retention permanent.
AgentVersion: id; agentId; tenantId; version; snapshotJson; index on agentId,version. 33. Mastra Integration Requirements
Runs use Mastra agent execution with optional version snapshot; memory behavior depends on configured memory settings; tool calls via MCP server registry. 34. Background Jobs + Event Pipelines (Inngest)
testcase.run_all → batch execute test cases and compute pass rate.
run.completed → optional evaluation scoring for test runs. 35. Real-Time Execution + Observability
Streaming responses for chat and A/B runs via Vercel AI SDK.
Live updates of test case results via SSE agent/{id}/tests. 36. Implementation Priority
MVP-critical: interactive chat run with streaming, basic test case CRUD, run single test.
Phase 2: run all tests pipeline, A/B comparisons with scoring.
/agent/workspace/[agentSlug]/runs/ 37. Page Purpose + Operational Role
Provides the canonical execution history for the agent with detailed run inspection, filtering, and export. Used by operators, QA, and engineers. 38. UI Component Inventory (Exhaustive)
Component Data required State dependencies Validation (Zod) Loading/Error
Header title/summary runs.length runs number ≥ 0 skeleton on load
Export button none agent id none disabled if no runs
Search input query string searchQuery max 200 none
Status select status enum statusFilter enum none
Date Range button date range filters valid range opens picker
More Filters button none filters none opens panel
Runs list card Run[] filteredRuns schema empty state
Run list item Run fields selectedRun schema highlight if selected
Run detail card Run fields selectedRun schema empty state if none
Status badge Run.status run enum color mapping
Input/output blocks Run.input,output run text truncated display
Tool calls list Run.toolCalls run array hidden if empty
Tokens grid prompt,completion,total run ints show 0 if missing
Scores panels scores run 0–1 floats hidden if empty
Actions buttons run id run none disabled if run missing
Loading skeletons none loading=true none list placeholders 39. Functional Workflow Requirements
Load runs: on mount fetch paginated runs; UI skeleton; backend returns list and total; failure shows banner; audit view.
Filter/search: update query; UI refresh list; backend applies filters; failure shows inline error.
Select run: on click fetch detail if not in list; UI populates detail panel; audit RUN_VIEW.
View Full Trace: navigates to trace detail; backend no change; audit optional.
Re-run: triggers new run with same input and version; UI shows toast + new run; backend uses Mastra; audit RUN_RERUN.
Export: backend streams CSV/JSON; audit RUN_EXPORT. 40. API Requirements (Next.js Route Handlers)
GET /api/agents/:agentId/runs; request: status, search, from, to, cursor, limit; response: {runs, total, nextCursor}; auth: session required; errors: 401, 403.
GET /api/agents/:agentId/runs/:runId; request: none; response: {run}; auth: session required; errors: 401, 403, 404.
GET /api/agents/:agentId/runs/:runId/trace; request: none; response: {trace}; auth: session required.
POST /api/agents/:agentId/runs/:runId/rerun; request: {versionId?}; response: {newRunId}; auth: session required.
POST /api/agents/:agentId/runs/:runId/cancel; request: none; response: {cancelled}; auth: session required.
GET /api/agents/:agentId/runs/export; request: filters; response: file stream; auth: session required. 41. Database Schema Requirements (Prisma + Supabase)
AgentRun: id; agentId; tenantId; runType; status; inputText; outputText; durationMs; startedAt; completedAt; modelProvider; modelName; versionId; promptTokens; completionTokens; totalTokens; costUsd; userId; indexes on agentId,createdAt,status; retention permanent.
AgentTrace: id; runId; agentId; tenantId; status; stepsJson; modelJson; tokensJson; createdAt; index on runId,agentId; retention permanent.
AgentToolCall: id; runId; traceId; tenantId; toolKey; mcpServerId; inputJson; outputJson; success; error; durationMs; index on runId,toolKey; retention permanent.
AgentEvaluation: id; runId; agentId; tenantId; scoresJson; createdAt; index on runId; retention permanent.
AgentFeedback: id; runId; agentId; tenantId; rating; thumbs; comment; createdAt; index on runId; retention permanent.
CostEvent: id; runId; agentId; tenantId; provider; tokenCounts; costUsd; createdAt; index on agentId,createdAt; retention permanent. 42. Mastra Integration Requirements
Runs and tool calls originate from Mastra executor; trace steps map to Mastra execution events; tool calls routed through MCP. 43. Background Jobs + Event Pipelines (Inngest)
run.completed → write cost event, evaluation pipeline, rollup metrics.
run.failed → create alert if error threshold exceeded. 44. Real-Time Execution + Observability
SSE for run list updates and selected run status; trace updates for running runs. 45. Implementation Priority
MVP-critical: run list, run detail, rerun, trace view.
Phase 2: export, advanced filters.
/agent/workspace/[agentSlug]/analytics/ 46. Page Purpose + Operational Role
Provides analytics, performance trends, tool usage, quality breakdowns, and model comparisons. Used by managers, analysts, and engineers for optimization and planning. 47. UI Component Inventory (Exhaustive)
Component Data required State dependencies Validation (Zod) Loading/Error
Header title/subtitle static none none skeleton
Time range select timeRange local state enum none
Export button none agent id none disabled if no data
Summary cards (4) AnalyticsSummary metrics numeric ranges show zero if missing
Trend indicator trendPct metrics -100..100 color mapping
Mini bar charts series[] metrics non-empty show placeholder
Tabs list none activeTab enum values none
Overview: Runs chart runsSeries metrics number[] empty state
Overview: Quality distribution qualityBuckets metrics bucket schema empty state
Overview: AI insights Insight[] insights schema empty state
Latency tab: percentile cards p50,p75,p95,p99 metrics numbers empty state
Latency chart latencyHistogram metrics number[] empty state
Tools tab: usage rows ToolUsage[] metrics schema empty state
Quality tab: scorer breakdown ScorerMetric[] metrics schema empty state
Quality tab: feedback summary FeedbackAggregate metrics schema empty state
Comparison tab: model table ModelMetric[] metrics schema empty state
Loading skeletons none loading=true none grid placeholders 48. Functional Workflow Requirements
Load analytics: on mount fetch metrics for time range; UI skeleton; backend computes on-demand (cache optional); errors show banner; audit view.
Change time range: update query; UI re-renders; backend recomputes on-demand.
Export: backend generates CSV/JSON; audit export action.
Tabs: UI only; no backend change. 49. API Requirements (Next.js Route Handlers)
GET /api/agents/:agentId/analytics/summary; request: from,to,tz; response: {summary, trends, sparklineSeries}; auth: session required.
GET /api/agents/:agentId/analytics/runs; request: from,to,tz; response: {series}; auth: session required.
GET /api/agents/:agentId/analytics/latency; request: from,to,tz; response: {percentiles, histogram}; auth: session required.
GET /api/agents/:agentId/analytics/tools; request: from,to; response: {toolUsage[]}; auth: session required.
GET /api/agents/:agentId/analytics/quality; request: from,to; response: {scorerMetrics[], feedbackAggregate}; auth: session required.
GET /api/agents/:agentId/analytics/models; request: from,to; response: {modelMetrics[]}; auth: session required.
GET /api/agents/:agentId/analytics/insights; request: from,to; response: {insights[]}; auth: session required.
GET /api/agents/:agentId/analytics/export; request: filters; response: file stream; auth: session required. 50. Database Schema Requirements (Prisma + Supabase)
AgentMetricDaily: id; agentId; tenantId; date; runs; successRate; avgLatencyMs; errorRate; qualityScore; index on agentId,date; retention permanent.
AgentToolMetricDaily: id; agentId; tenantId; toolKey; date; callCount; successRate; avgDurationMs; index on agentId,toolKey,date; retention permanent.
AgentModelMetricDaily: id; agentId; tenantId; modelProvider; modelName; date; runs; avgLatencyMs; qualityScore; costUsd; index on agentId,modelName,date; retention permanent.
AgentQualityMetricDaily: id; agentId; tenantId; scorerKey; date; avgScore; sampleCount; index on agentId,scorerKey,date; retention permanent.
AgentFeedbackAggregateDaily: id; agentId; tenantId; date; positiveCount; negativeCount; index on agentId,date; retention permanent.
Insight: id; agentId; tenantId; type; title; description; createdAt; index on agentId,createdAt; retention permanent. 51. Mastra Integration Requirements
Quality metrics derived from @mastra/evals results; tool metrics derived from MCP tool calls; model metrics derived from Mastra run config. 52. Background Jobs + Event Pipelines (Inngest)
No scheduled rollups (on-demand aggregation). Optional cache refresh jobs if query load becomes high.
run.completed and evaluation.completed events can trigger cache invalidation.
insight.generate job for AI insights (on-demand or scheduled). 53. Real-Time Execution + Observability
Optional live chart updates via SSE for runs/latency/quality; use throttled updates. 54. Implementation Priority
MVP-critical: full analytics page (summary, trends, latency, tools, quality, models, insights, exports).
/agent/workspace/[agentSlug]/traces/ 55. Page Purpose + Operational Role
Provides trace-level observability with step-by-step execution, tool calls, and replay workflows. Used by engineers and operators for debugging and incident analysis. 56. UI Component Inventory (Exhaustive)
Component Data required State dependencies Validation (Zod) Loading/Error
Header title/subtitle static none none skeleton
Time Travel Mode button none feature flag none disabled if not supported
Search input query string searchQuery max 200 none
Filter button none filters none opens panel
Traces list card Trace[] traces schema empty state
Trace list item Trace summary selectedTrace schema highlight if selected
Trace detail header Trace.id selectedTrace string empty state if none
Copy JSON button Trace selectedTrace none shows copied status
Summary grid status,duration,tokens,quality selectedTrace ranges placeholder if missing
Model info card model.provider,name,temperature selectedTrace schema none
Input block Trace.input selectedTrace text none
Execution timeline list ExecutionStep[] selectedTrace schema empty state
Tool calls accordion ToolCall[] selectedTrace schema hidden if none
Output block Trace.output selectedTrace text none
Action buttons trace/run id selectedTrace none disabled if missing
Loading skeletons none loading=true none list + detail 57. Functional Workflow Requirements
Load traces: fetch paginated trace summaries; UI skeleton; backend returns list; errors show banner; audit view.
Select trace: fetch full trace; UI populates detail; audit TRACE_VIEW.
Copy JSON: write to clipboard; UI shows status; backend none; audit optional.
Replay from Start: re-executes with same input and version; backend creates new run; UI shows new trace; audit TRACE_REPLAY.
Re-run: same as replay but without time travel semantics; audit RUN_RERUN.
Export: backend returns JSON/CSV for trace; audit TRACE_EXPORT. 58. API Requirements (Next.js Route Handlers)
GET /api/agents/:agentId/traces; request: search,from,to,cursor,limit; response: {traces[], total}; auth: session required.
GET /api/agents/:agentId/traces/:traceId; request: none; response: {trace}; auth: session required.
POST /api/agents/:agentId/traces/:traceId/replay; request: {versionId?}; response: {newRunId}; auth: session required.
POST /api/agents/:agentId/traces/:traceId/rerun; request: {versionId?}; response: {newRunId}; auth: session required.
GET /api/agents/:agentId/traces/export; request: filters; response: file stream; auth: session required. 59. Database Schema Requirements (Prisma + Supabase)
AgentTrace: id; runId; agentId; tenantId; status; inputText; outputText; durationMs; modelJson; tokensJson; scoresJson; createdAt; indexes on agentId,createdAt; retention permanent.
AgentTraceStep: id; traceId; tenantId; stepNumber; type; content; timestamp; durationMs; index on traceId,stepNumber; retention permanent.
AgentToolCall: id; traceId; runId; toolKey; mcpServerId; inputJson; outputJson; success; error; durationMs; index on traceId,toolKey; retention permanent. 60. Mastra Integration Requirements
Traces are sourced from Mastra execution events; tool call events are captured from MCP execution pipeline. 61. Background Jobs + Event Pipelines (Inngest)
run.completed → build and persist trace steps and tool calls.
trace.export.requested → async export generation for large datasets. 62. Real-Time Execution + Observability
SSE or WebSocket channel agent/{id}/traces for live run steps; streaming trace view for in-flight runs. 63. Implementation Priority
MVP-critical: trace list, trace detail, tool call inspection.
Phase 2: time travel replay, advanced export.
/agent/workspace/[agentSlug]/evaluations/ 64. Page Purpose + Operational Role
Centralizes evaluation results, user feedback, and AI insights for quality control. Used by QA, operators, and product owners. 65. UI Component Inventory (Exhaustive)
Component Data required State dependencies Validation (Zod) Loading/Error
Header title/subtitle static none none skeleton
Run Evaluation button none agent id none disabled if no runs
Export Report button none agent id none disabled if no data
Summary cards (4) avg scores metrics 0–1 floats show 0 if missing
Tabs list none activeTab enum values none
Score Distribution card score buckets metrics bucket schema empty state
Score Trends chart series metrics number[] empty state
Low-Scoring runs list evaluations metrics schema empty state
View button on run runId selection none routes to run
Feedback Summary card feedback aggregate metrics ints zero state
Common Themes list feedback themes metrics schema empty state
Recent Feedback list evaluations with feedback metrics schema empty state
AI Insights cards insights metrics schema empty state
Evaluation History table evaluations metrics schema empty state
Loading skeletons none loading=true none grid placeholders 66. Functional Workflow Requirements
Load evaluation data: fetch aggregated scores, feedback stats, and recent evaluations; UI skeleton; backend returns; audit view.
Run evaluation: trigger evaluation pipeline over recent runs; UI shows progress; backend enqueues Inngest job; success shows toast; failure shows error.
Export report: backend generates report; audit export action.
View low-scoring run: navigate to runs page with selected run; audit optional. 67. API Requirements (Next.js Route Handlers)
POST /api/agents/:agentId/evaluations/run; request: {from,to,scorers?}; response: {jobId}; auth: owner/admin; errors: 401, 403, 422.
GET /api/agents/:agentId/evaluations; request: from,to,limit; response: {evaluations[]}; auth: session required.
GET /api/agents/:agentId/evaluations/summary; request: from,to; response: {avgScores, scoreBuckets, trends}; auth: session required.
GET /api/agents/:agentId/feedback/summary; request: from,to; response: {positive,negative,total,themes[]}; auth: session required.
GET /api/agents/:agentId/evaluations/insights; request: from,to; response: {insights[]}; auth: session required.
GET /api/agents/:agentId/evaluations/export; request: filters; response: file stream; auth: session required. 68. Database Schema Requirements (Prisma + Supabase)
AgentEvaluation: id; runId; agentId; tenantId; scoresJson; scorerVersion; createdAt; index on runId,agentId; retention permanent.
AgentFeedback: id; runId; agentId; tenantId; thumbs; rating; comment; createdAt; index on runId,agentId; retention permanent.
EvaluationTheme: id; agentId; tenantId; theme; sentiment; count; createdAt; index on agentId,createdAt; retention permanent.
AgentRun: id; agentId; tenantId; status; createdAt; index on agentId,createdAt. 69. Mastra Integration Requirements
Use @mastra/evals scorers to generate scores; optionally use LLM-based insight generation; store in evaluation tables. 70. Background Jobs + Event Pipelines (Inngest)
run.completed → enqueue evaluation job based on sampling rate.
evaluation.completed → update theme extraction and summary rollups.
feedback.received → update feedback aggregates and alerts. 71. Real-Time Execution + Observability
SSE for evaluation job progress and new feedback events. 72. Implementation Priority
MVP-critical: evaluation history, summary scores, feedback summary, insights, and theme extraction.
/agent/workspace/[agentSlug]/costs/ 73. Page Purpose + Operational Role
Provides cost governance, spend visibility, budget controls, and optimization recommendations. Used by operators, finance, and managers. 74. UI Component Inventory (Exhaustive)
Component Data required State dependencies Validation (Zod) Loading/Error
Header title/subtitle static none none skeleton
Export Report button none agent id none disabled if no data
Budget alert banner budget usage budget settings percent 0–200 hidden if below threshold
Adjust Budget button none budget none opens budget form
Summary cards (4) cost summary costData positive numbers show 0 if missing
Budget progress bar usage pct costData 0–100 show 100 cap
Daily costs chart daily series costData number[] empty state
Token breakdown card prompt/completion costData numbers empty state
Cost by model list model metrics costData schema empty state
Budget settings form budget settings local state numeric bounds inline error
Save Budget Settings button budget settings saving schema disabled if invalid
Optimization recommendations recommendations insights schema empty state
Loading skeletons none loading=true none grid placeholders 75. Functional Workflow Requirements
Load cost summary: fetch cost metrics and budget policy; UI skeleton; backend aggregates cost events; audit view.
Adjust budget: user edits settings; UI validates; backend updates BudgetPolicy; triggers alert recalculation; audit BUDGET_UPDATE.
Export report: backend streams cost report; audit export action.
Optimization recommendations: display precomputed recommendations; optionally allow “apply” actions in future. 76. API Requirements (Next.js Route Handlers)
GET /api/agents/:agentId/costs/summary; request: from,to; response: {summary, tokenBreakdown, byModel, byDay}; auth: session required.
GET /api/agents/:agentId/budget; request: none; response: {budgetPolicy}; auth: session required.
PUT /api/agents/:agentId/budget; request: {enabled, monthlyLimit, alertAt, hardLimit}; response: {budgetPolicy}; auth: owner/admin; errors: 422.
GET /api/agents/:agentId/costs/recommendations; request: from,to; response: {recommendations[]}; auth: session required.
GET /api/agents/:agentId/costs/export; request: filters; response: file stream; auth: session required. 77. Database Schema Requirements (Prisma + Supabase)
CostEvent: id; runId; agentId; tenantId; provider; modelName; promptTokens; completionTokens; totalTokens; costUsd; createdAt; index on agentId,createdAt; retention permanent.
BudgetPolicy: id; agentId; tenantId; enabled; monthlyLimitUsd; alertAtPct; hardLimit; createdAt; updatedAt; index on agentId; retention permanent.
AgentCostDaily: id; agentId; tenantId; date; totalCostUsd; promptCostUsd; completionCostUsd; runs; index on agentId,date; retention permanent.
AgentModelCostDaily: id; agentId; tenantId; modelName; date; costUsd; tokens; runs; index on agentId,modelName,date; retention permanent.
CostRecommendation: id; agentId; tenantId; type; title; description; estimatedSavingsUsd; createdAt; index on agentId,createdAt; retention permanent. 78. Mastra Integration Requirements
Token and cost calculation sourced from Vercel AI SDK usage stats; attach to AgentRun and CostEvent. 79. Background Jobs + Event Pipelines (Inngest)
run.completed → compute cost event; update rollups.
budget.check scheduled daily; creates budget alerts.
cost.recommendations.generate weekly. 80. Real-Time Execution + Observability
SSE updates for budget usage and new alerts; optional cost streaming for running runs. 81. Implementation Priority
MVP-critical: cost summary, budget policy CRUD, cost events, recommendations, and export.
/agent/workspace/[agentSlug]/versions/ 82. Page Purpose + Operational Role
Manages version history, comparisons, and rollback workflows. Used by agent managers and engineers to safely change production behavior. 83. UI Component Inventory (Exhaustive)
Component Data required State dependencies Validation (Zod) Loading/Error
Header title/subtitle static none none skeleton
Compare Versions button none versions none disabled if <2 versions
Export History button none versions none disabled if none
Active version highlight AgentVersion activeVersion schema hidden if none
Active version stats runs, successRate, quality version stats numeric show 0 if missing
Version timeline list AgentVersion[] versions schema empty state
Version card fields description, changes, createdBy version schema none
View Details button version id none none routes
Compare button version id none none opens modal
Rollback button version id none none disabled for active
Rollback AlertDialog version + new version none none confirm required
Version comparison table versions versions schema empty state
Loading skeletons none loading=true none list placeholders 84. Functional Workflow Requirements
Load versions: fetch list and stats; UI skeleton; backend returns; audit view.
Compare versions: select versions; backend diff configs and metrics; UI displays diff; audit VERSION_COMPARE.
Rollback: confirm dialog; backend creates new version from selected snapshot, sets active version, updates agent config; audit VERSION_ROLLBACK.
Export history: backend streams version history; audit export action. 85. API Requirements (Next.js Route Handlers)
GET /api/agents/:agentId/versions; request: limit,cursor; response: {versions[]}; auth: session required.
GET /api/agents/:agentId/versions/:version; request: none; response: {version, snapshot}; auth: session required.
POST /api/agents/:agentId/versions/compare; request: {versionA, versionB}; response: {diff, metrics}; auth: owner/admin.
POST /api/agents/:agentId/versions/:version/rollback; request: {reason}; response: {newVersion}; auth: owner/admin; errors: 403, 409.
GET /api/agents/:agentId/versions/export; request: none; response: file stream; auth: session required. 86. Database Schema Requirements (Prisma + Supabase)
AgentVersion: id; agentId; tenantId; version; description; changesJson; snapshotJson; createdBy; createdAt; index on agentId,version; retention permanent.
AgentVersionStats: id; versionId; agentId; tenantId; runs; successRate; avgQuality; updatedAt; index on versionId; retention permanent.
AuditLog: id; tenantId; actorId; action VERSION_ROLLBACK; entityType AgentVersion; entityId; metadata; createdAt; retention permanent. 87. Mastra Integration Requirements
Version snapshot must serialize Mastra agent config **plus tool IDs and scorer IDs**; rollback restores full config, including memory, tools, and scorer assignments. 88. Background Jobs + Event Pipelines (Inngest)
agent.config.saved → create version snapshot and update version stats.
version.rollback → recompute metrics and alert operators. 89. Real-Time Execution + Observability
SSE updates for version list changes and active version updates. 90. Implementation Priority
MVP-critical: version list, rollback, active version highlight.
Phase 2: diff visualization and exports.
/agent/workspace/[agentSlug]/guardrails/ 91. Page Purpose + Operational Role
Defines and monitors safety controls, content filtering, and execution limits. Used by operators, compliance, and engineering. 92. UI Component Inventory (Exhaustive)
Component Data required State dependencies Validation (Zod) Loading/Error
Header title/subtitle static none none skeleton
Unsaved changes badge hasChanges form state boolean hidden if false
Reset button config form state none disabled if no changes
Save Changes button config form state schema disabled if invalid
Stats cards (3) blocked,modified,flagged events ints ≥ 0 show 0 if missing
Guardrail tabs none activeTab enum values none
Input guard toggles config.input.* config booleans none
Max input length input config.input.maxInputLength config int 1–200000 inline error
Output guard toggles config.output.\_ config booleans none
Execution limit inputs config.execution.\* config numeric ranges inline error
Rate limiting toggle config.execution.rateLimiting.enabled config boolean none
Requests per minute input config.execution.rateLimiting.requestsPerMinute config int 1–10000 inline error
Recent events list GuardrailEvent[] events schema empty state
View All Events button none agent id none routes
Loading skeletons none loading=true none skeleton 93. Functional Workflow Requirements
Load guardrail config and events: UI skeleton; backend returns config + recent events; audit view.
Edit config: update local state; mark unsaved; validate on change.
Save changes: validate with Zod; backend updates guardrail policy and activates; audit GUARDRAIL_UPDATE.
Reset: revert to last saved config; audit optional.
View events: navigate to full events list; audit GUARDRAIL_EVENTS_VIEW. 94. API Requirements (Next.js Route Handlers)
GET /api/agents/:agentId/guardrails; request: none; response: {guardrailConfig}; auth: owner/admin.
PUT /api/agents/:agentId/guardrails; request: {guardrailConfig}; response: {guardrailConfig}; auth: owner/admin; errors: 422.
GET /api/agents/:agentId/guardrails/events; request: from,to,limit; response: {events[]}; auth: session required.
POST /api/agents/:agentId/guardrails/test; request: {input}; response: {verdict, actions}; auth: owner/admin. 95. Database Schema Requirements (Prisma + Supabase)
GuardrailPolicy: id; agentId; tenantId; configJson; version; createdBy; createdAt; updatedAt; index on agentId; retention permanent.
GuardrailEvent: id; agentId; tenantId; runId; type BLOCKED|MODIFIED|FLAGGED; guardrailKey; reason; inputSnippet; outputSnippet; createdAt; index on agentId,createdAt; retention permanent.
BudgetPolicy: id; agentId; tenantId; enabled; hardLimit; monthlyLimitUsd; alertAtPct; index on agentId. 96. Mastra Integration Requirements
Guardrail policies are enforced pre-run (input checks), during run (tool call limits), and post-run (output checks) using Mastra middleware and tool interceptors.
Input violations: block and return error for injection/jailbreak attempts; warn for borderline moderation cases.
Output violations: redact PII; block for severe toxicity.
Guardrail events emitted into run trace and persisted. 97. Background Jobs + Event Pipelines (Inngest)
guardrail.event → persist event, update stats, trigger alerts.
Scheduled guardrail audits to validate configuration and coverage. 98. Real-Time Execution + Observability
SSE channel for guardrail events and stats updates; alerting for repeated violations. 99. Implementation Priority
MVP-critical: guardrail config CRUD, event logging, execution limit enforcement, and scheduled audits.
/agent/workspace/[agentSlug]/page.tsx (default redirect) 100. Page Purpose + Operational Role
Redirects /agent/workspace/[agentSlug] to /agent/workspace/[agentSlug]/overview to ensure consistent entry. Used by all roles as a routing convenience. 101. UI Component Inventory (Exhaustive)
Component Data required State dependencies Validation (Zod) Loading/Error
Redirect handler agentSlug route params slug format 404 handled by layout 102. Functional Workflow Requirements
On request, redirect to overview route; no UI; no backend changes; no audit required. 103. API Requirements (Next.js Route Handlers)
None required. 104. Database Schema Requirements (Prisma + Supabase)
None required. 105. Mastra Integration Requirements
None required. 106. Background Jobs + Event Pipelines (Inngest)
None required. 107. Real-Time Execution + Observability
None required. 108. Implementation Priority
MVP-critical: redirect behavior.

---

## Cross-Cutting Requirements

These apply to all pages and should be enforced in every API and data access layer.

### Access Control and Multi-Tenant Safety

- All endpoints require Better Auth session; enforce `tenantId` scoping on every query.
- Roles: `owner`, `admin`, `operator`, `viewer`; write actions require owner/admin; read actions require viewer+.
- Include `tenantId` on all new models; validate `ownerId` for user-created agents.
- **Mastra RequestContext Integration**: Use Mastra's reserved keys for user isolation:
    - `resource.userId` - Current authenticated user ID
    - `resource.tenantId` - Current tenant/organization ID
    - `thread.id` - Conversation/session thread ID
- Pass `RequestContext` to all agent executions for dynamic instruction interpolation and audit trails.

### Observability (Mastra Integration)

**Current Gap**: Mastra `Observability` is not configured in `packages/mastra/src/mastra.ts`.

**Required Configuration**:

```typescript
import { Observability } from "@mastra/core/observability";

const observability = new Observability({
  storage: postgresStore, // Use existing @mastra/pg storage
  redaction: {
    enabled: true,
    keys: ["password", "apiKey", "token", "secret", "authorization"]
  },
  sampling: {
    rate: 1.0 // 100% sampling for MVP; reduce in production
  }
});

const mastra = new Mastra({
  agents: { ... },
  workflows: { ... },
  storage,
  observability // Add observability config
});
```

**Storage Decision**: **Selected** Postgres via `@mastra/pg` for MVP. Reassess ClickHouse or Mastra Cloud if trace volume exceeds 50k/day.

**OpenTelemetry Compatibility**: Observability integrates with OTel providers for external tracing (Jaeger, Datadog, etc.).

### Guardrails (Mastra Processor Integration)

**Mastra Guardrail Processors**:

| Processor                 | Direction    | Action         | Description                                           |
| ------------------------- | ------------ | -------------- | ----------------------------------------------------- |
| `ModerationProcessor`     | Input/Output | Block/Warn     | OpenAI moderation API for harmful content             |
| `PIIDetector`             | Input/Output | Redact/Block   | Detect and handle personally identifiable information |
| `PromptInjectionDetector` | Input        | Block/Warn     | Detect jailbreak and injection attempts               |
| `ContentFilterProcessor`  | Output       | Rewrite/Block  | Custom content filtering rules                        |
| `MaxLengthProcessor`      | Input/Output | Truncate/Block | Enforce length limits                                 |

**UI Toggle → Processor Mapping**:

| UI Toggle                    | Processor                 | Strategy           |
| ---------------------------- | ------------------------- | ------------------ |
| "Enable content moderation"  | `ModerationProcessor`     | Block              |
| "Enable PII detection"       | `PIIDetector`             | Redact (warn user) |
| "Enable jailbreak detection" | `PromptInjectionDetector` | Block + Alert      |
| "Max input length"           | `MaxLengthProcessor`      | Truncate           |
| "Max output length"          | `MaxLengthProcessor`      | Truncate           |

**Tripwire Handling**:

- When a processor triggers, emit `guardrail.event` to Inngest
- Store event in `GuardrailEvent` table with action taken
- Create `AgentAlert` if threshold exceeded (e.g., 10 blocks in 1 hour)

**Execution Order**:

1. Input processors (in order: injection → moderation → PII → length)
2. Agent execution
3. Output processors (in order: moderation → PII → length → content filter)

### Memory (Mastra Memory Configuration)

**Memory Modes** (must be clearly distinguished in UI):

| Mode                | Purpose                               | Storage                   | Configuration                                       |
| ------------------- | ------------------------------------- | ------------------------- | --------------------------------------------------- |
| **Message History** | Sliding window of recent messages     | `@mastra/pg`              | `lastMessages: 10` (number of messages to retain)   |
| **Working Memory**  | Persistent key-value store per thread | `@mastra/pg`              | `workingMemory: { enabled: true, template: "..." }` |
| **Semantic Recall** | Vector search over past messages      | `@mastra/pg` + `pgvector` | `semanticRecall: { topK: 5, messageRange: 100 }`    |

**Prerequisites**:

- PostgreSQL with `pgvector` extension enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
- Vector index on message embeddings (configured in `packages/mastra/src/vector.ts`)

**Memory Config Schema** (stored in `Agent.memoryConfig`):

```typescript
interface MemoryConfig {
    lastMessages?: number; // Default: 10
    semanticRecall?:
        | {
              topK?: number; // Default: 5
              messageRange?: number; // Default: 100
          }
        | false;
    workingMemory?: {
        enabled?: boolean;
        template?: string; // Markdown template for working memory display
    };
}
```

### Tools (Mastra Tool Requirements)

**Registry Architecture** (current implementation):

```
Code Registry (packages/mastra/src/tools/registry.ts)
    ├── Built-in tools (date-time, calculator, web-fetch, etc.)
    └── MCP tools (fetched dynamically, cached 1 minute)
        └── Agent-specific config (AgentTool.config)
```

**Required Tool Metadata**:

| Field          | Required | Description                                        |
| -------------- | -------- | -------------------------------------------------- |
| `inputSchema`  | Yes      | Zod schema for tool input validation               |
| `outputSchema` | Yes      | Zod schema for tool output validation              |
| `description`  | Yes      | Human-readable description for LLM                 |
| `execute`      | Yes      | Async function with optional `AbortSignal` support |

**Cancellation Support**:

- All tools should accept `AbortSignal` for graceful cancellation
- Long-running tools (e.g., web scraping) must check `signal.aborted`

**MCP Tool Discovery**:

- MCP tools discovered via `mcpClient.listTools()`
- Tool names follow pattern: `serverName_toolName` (e.g., `hubspot_hubspot-get-contacts`)
- Tool metadata cached for 1 minute; refresh on demand via `invalidateMcpCache()`

### Evaluations (Mastra Evals Configuration)

**Scorer Types**:

| Type                 | When Evaluated                | Use Case                |
| -------------------- | ----------------------------- | ----------------------- |
| **Live Scorers**     | During generation (each step) | Real-time quality gates |
| **Post-Run Scorers** | After run completion          | Batch quality analysis  |

**Current Scorers** (from `packages/mastra/src/scorers/registry.ts`):

- `relevancy` - Answer relevance (0-1, higher = better)
- `toxicity` - Harmful content detection (0-1, lower = better)
- `completeness` - Response completeness (0-1, higher = better)
- `tone` - Tone consistency (0-1, higher = better)

**Sampling Configuration** (per agent, per scorer):

```typescript
interface ScorerConfig {
    scorer: string; // Registry key
    sampling: {
        type: "ratio" | "count";
        rate: number; // 0.0-1.0 for ratio, N for count
    };
    live?: boolean; // If true, evaluate during generation
}
```

**Storage Strategy**:

- Raw scores: Store in Mastra's native storage (automatic with Observability)
- Aggregated insights: Store in custom `AgentEvaluation` table for reporting

### Workflow Control (Suspend/Resume)

**Mastra Workflow Primitives**:

```typescript
// Suspend workflow and wait for external signal
const approvalResult = await workflow.suspend({
    key: "budget-approval",
    data: { requestedBudget: 1000 }
});

// Resume from external trigger (e.g., API call)
await workflow.resume({
    runId: "run-123",
    key: "budget-approval",
    data: { approved: true, approvedBy: "user-456" }
});
```

**Integration with Versioning**:

- Config changes requiring approval: suspend workflow, await admin approval
- Rollback requests: suspend, validate with owner, then execute

**Integration with Human-in-the-Loop**:

- High-cost operations: suspend before execution
- Guardrail violations (warn mode): suspend, present to user, await decision

### Audit Logging

- Log all writes and sensitive reads in `AuditLog`.
- Store `actorId`, `action`, `entityType`, `entityId`, request metadata, and timestamp.
- Actions to log: `AGENT_CREATE`, `AGENT_UPDATE`, `AGENT_DELETE`, `CONFIG_CHANGE`, `VERSION_ROLLBACK`, `RUN_TEST`, `BUDGET_UPDATE`, `GUARDRAIL_UPDATE`, etc.

### MCP Tooling + Integrations

- Tool inventory backed by code registry with MCP fallback (see Tools section). `ToolDefinition` is **not** used in MVP.
- Tool calls must record `toolKey`, `mcpServerId`, `inputJson`, `outputJson`, `durationMs`, and `success`.
- Integration credentials stored encrypted in `ChannelCredentials` and never returned to UI.
- MCP server status: use `mcpClient.getServerStatus()` for health checks.

### Real-Time Streams

- Standard SSE channels: `agent/{id}/runs`, `agent/{id}/traces`, `agent/{id}/guardrails`, `agent/{id}/costs`.
- Use Vercel AI SDK for streaming run outputs and trace updates.
- **Transport Decision (Selected)**: SSE for MVP. Add `POST /api/agents/:id/runs/:runId/cancel` for cancellation.
- Rate limit SSE updates to avoid overwhelming clients (e.g., max 10 updates/second).

### Deployment Constraints (Vercel)

- Target deployment: **Vercel**.
- Avoid long-running work in route handlers; use Inngest for async workflows.
- Prefer SSE and streaming responses over WebSocket on Vercel.

### Data Retention

| Data Type             | Retention | Cleanup Strategy    |
| --------------------- | --------- | ------------------- |
| Raw traces/tool calls | Permanent | No retention limits |
| Runs and cost events  | Permanent | No retention limits |
| Aggregated metrics    | Permanent | No retention limits |
| Versions and configs  | Permanent | Never delete        |
| Audit logs            | Permanent | No retention limits |

---
