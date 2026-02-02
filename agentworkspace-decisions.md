# Agent Workspace Plan - Decision Questionnaire

Use this questionnaire to finalize the implementation plan. Each section contains a key decision, options with pros/cons, and a recommendation. Mark your choice with `[x]` and add any notes.

---

## 1. Observability Storage

**Context**: Mastra requires an observability storage backend for traces, metrics, and logs. The current codebase has `@mastra/pg` configured but observability is not enabled.

**Options**:

- [ X ] **A) PostgreSQL via @mastra/pg** (Recommended for MVP)
    - ✅ Already configured in codebase
    - ✅ Single database to manage
    - ✅ Simpler deployment
    - ⚠️ May struggle at scale (100k+ traces/day)
    - ⚠️ Requires periodic cleanup jobs

- [ ] **B) ClickHouse**
    - ✅ Optimized for time-series/analytics
    - ✅ Handles massive trace volumes
    - ⚠️ Additional infrastructure to manage
    - ⚠️ Learning curve for team

- [ ] **C) Mastra Cloud**
    - ✅ Managed service, zero ops
    - ✅ Built-in dashboards
    - ⚠️ External dependency
    - ⚠️ Data leaves your infrastructure
    - ⚠️ Recurring cost

**Recommendation**: Start with **Option A (PostgreSQL)** for MVP. Add a retention job via Inngest. Migrate to ClickHouse or Mastra Cloud if you exceed 50k traces/day.

**Your Choice**: [**A) PostgreSQL via @mastra/pg** (Recommended for MVP) ]

**Notes**:

---

## 2. Multi-Tenancy Model

**Context**: The current `Agent` model has `ownerId` but no `tenantId`. For a SaaS product, tenant isolation is critical.

**Options**:

- [x] **A) Add tenantId to all models now** (Recommended)
    - ✅ SaaS-ready from day one
    - ✅ Clean data isolation
    - ✅ Easier to add team/org features later
    - ⚠️ More complex queries (always filter by tenantId)
    - ⚠️ Migration effort for existing data

- [ ] **B) Use ownerId as implicit tenant for MVP**
    - ✅ Simpler initial implementation
    - ✅ No schema changes needed
    - ⚠️ Harder to add teams/organizations later
    - ⚠️ Refactoring debt

- [ ] **C) Skip multi-tenancy (single-tenant deployment)**
    - ✅ Simplest implementation
    - ⚠️ Not suitable for SaaS
    - ⚠️ Major refactor if you change direction

**Recommendation**: Choose **Option A** if you plan to offer this as SaaS with multiple customers. Choose **Option B** if this is an internal tool or single-customer deployment for now.

**Your Choice**: [A ]

**Notes**:

---

## 3. Tool Registry Source of Truth

**Context**: Tools are currently defined in code (`packages/mastra/src/tools/registry.ts`) with MCP fallback. The plan proposes a `ToolDefinition` database table.

**Options**:

- [X ] **A) Code-first with DB config overrides** (Recommended)
    - ✅ Matches current implementation
    - ✅ Type-safe tool definitions
    - ✅ Version controlled with code
    - ✅ Per-agent config via `AgentTool.config`
    - ⚠️ Adding tools requires code deployment

- [ ] **B) Database-primary with code fallback**
    - ✅ Dynamic tool creation via UI
    - ✅ No deployments for new tools
    - ⚠️ Loses type safety
    - ⚠️ Complex validation logic
    - ⚠️ Major refactor of current system

- [ ] **C) Hybrid with explicit ToolDefinition table**
    - ✅ Code defines schemas, DB stores metadata
    - ✅ UI shows tool descriptions from DB
    - ⚠️ Two sources to keep in sync
    - ⚠️ Moderate complexity

**Recommendation**: Choose **Option A** for MVP. The current architecture is solid. Add `ToolDefinition` table in Phase 2 only if you need dynamic tool creation.

**Your Choice**: [A ]

**Notes**:

---

## 4. Scorer Registry Source of Truth

**Context**: Similar to tools, scorers are code-defined in `packages/mastra/src/scorers/registry.ts`. The plan proposes a `ScorerDefinition` table.

**Options**:

- [X ] **A) Code-first with per-agent sampling config** (Recommended)
    - ✅ Matches current implementation
    - ✅ Scorers are complex logic, better in code
    - ✅ Sampling rates stored in `Agent.scorers` or separate config
    - ⚠️ Adding scorers requires deployment

- [ ] **B) Database-primary ScorerDefinition table**
    - ✅ Dynamic scorer configuration
    - ⚠️ Scorer logic can't really be stored in DB
    - ⚠️ Minimal benefit over code-first

**Recommendation**: Choose **Option A**. Scorers contain complex logic that belongs in code. Store sampling configuration per-agent in the database.

**Your Choice**: [ A]

**Notes**:

---

## 5. Evaluation Storage Strategy

**Context**: Mastra has native observability storage for raw scores. The plan proposes custom `AgentEvaluation` tables.

**Options**:

- [ ] **A) Mastra native storage only**
    - ✅ Automatic with observability config
    - ✅ No custom tables needed
    - ⚠️ Limited query flexibility
    - ⚠️ Tied to Mastra's schema

- [ ] **B) Custom AgentEvaluation table only**
    - ✅ Full control over schema
    - ✅ Easy to query and aggregate
    - ⚠️ Manual integration with Mastra
    - ⚠️ Duplication if also using Mastra storage

- [x] **C) Both: Mastra for raw, custom for aggregated** (Recommended)
    - ✅ Best of both worlds
    - ✅ Mastra handles raw trace data
    - ✅ Custom tables for reporting dashboards
    - ⚠️ Slight complexity in data flow

**Recommendation**: Choose **Option C**. Let Mastra store raw scores automatically. Use custom tables (`AgentEvaluation`, rollup tables) for the analytics UI.

**Your Choice**: [C ]

**Notes**:

---

## 6. Real-Time Transport

**Context**: The workspace needs real-time updates for run status, traces, and alerts.

**Options**:

- [x] **A) Server-Sent Events (SSE)** (Recommended for MVP)
    - ✅ Simpler to implement
    - ✅ Works with standard HTTP infrastructure
    - ✅ Native browser support
    - ✅ Vercel AI SDK uses SSE
    - ⚠️ One-way (server → client)
    - ⚠️ Can't cancel in-flight runs from client

- [ ] **B) WebSocket**
    - ✅ Bidirectional communication
    - ✅ Can send cancel signals
    - ✅ Lower latency for high-frequency updates
    - ⚠️ More complex infrastructure
    - ⚠️ Connection management overhead
    - ⚠️ May not work with all edge deployments

- [ ] **C) Both: SSE for streaming, WebSocket for control**
    - ✅ Optimal for each use case
    - ⚠️ Two systems to maintain
    - ⚠️ Increased complexity

**Recommendation**: Start with **Option A (SSE)** for MVP. Add a simple `/runs/:id/cancel` POST endpoint instead of WebSocket. Consider WebSocket in Phase 2 if you need true bidirectional features.

**Your Choice**: [A]

**Notes**:

---

## 7. Version Snapshot Content

**Context**: `AgentVersion.snapshotJson` stores the agent config at each version. What should it include?

**Options**:

- [ ] **A) Full agent config only**
    - ✅ Simple
    - ⚠️ Missing tool/scorer assignments

- [ X] **B) Agent config + tool IDs + scorer IDs** (Recommended)
    - ✅ Complete reproducibility
    - ✅ Can rollback tools and scorers too
    - ⚠️ Slightly larger JSON

- [ ] **C) Full agent config + tool configs + scorer sampling**
    - ✅ Most complete
    - ✅ Includes per-agent tool overrides
    - ⚠️ Larger JSON payload
    - ⚠️ May include stale tool configs

- [ ] **D) Reference only (version number, let resolver reconstruct)**
    - ✅ Smallest storage
    - ⚠️ Can't reconstruct if tools/scorers change
    - ⚠️ Not truly immutable

**Recommendation**: Choose **Option B** for balance. Include tool and scorer IDs so rollback restores the full agent configuration.

**Your Choice**: [ B]

**Notes**:

---

## 8. Guardrail Processor Strategy

**Context**: Mastra provides input/output processors for guardrails. How should they behave when triggered?

**Options for Input Violations**:

- [ ] **A) Block and return error** (Recommended for security)
    - ✅ Prevents harmful content
    - ⚠️ May frustrate users
- [ ] **B) Warn user and proceed**
    - ✅ Better UX
    - ⚠️ May allow some harmful content

- [ ] **C) Silently rewrite input**
    - ⚠️ User doesn't know input was modified
    - ⚠️ Could cause confusion

**Options for Output Violations**:

- [ ] **A) Block and return error**
    - ✅ Prevents harmful responses
    - ⚠️ Wastes tokens if blocked at end

- [ ] **B) Redact sensitive content and return** (Recommended)
    - ✅ User gets partial response
    - ✅ PII is protected
    - ⚠️ Response may be incomplete

- [ ] **C) Regenerate response**
    - ✅ User gets clean response
    - ⚠️ Doubles token cost
    - ⚠️ May fail again

**Recommendation**:

- **Input**: Block for injection/jailbreak; warn for borderline moderation
- **Output**: Redact for PII; block for severe toxicity

**Your Choice (Input)**: [A]
**Your Choice (Output)**: [B]

**Notes**:

---

## 9. Analytics Rollup Frequency

**Context**: Analytics dashboards need aggregated metrics. How often should rollups run?

**Options**:

- [ ] **A) Nightly only**
    - ✅ Simplest
    - ✅ Lowest resource usage
    - ⚠️ Dashboard shows yesterday's data

- [ ] **B) Hourly**
    - ✅ Near real-time dashboards
    - ⚠️ More background job load
    - ⚠️ More complex job orchestration

- [ ] **C) Nightly for daily tables, hourly for recent window** (Recommended)
    - ✅ Best of both
    - ✅ "Last 24h" is near real-time
    - ✅ Historical data is optimized
    - ⚠️ Two job schedules to manage

- [X ] **D) On-demand (compute when requested)**
    - ✅ Always fresh
    - ⚠️ Slow dashboard loads
    - ⚠️ High DB load under traffic

**Recommendation**: Choose **Option C**. Run hourly rollups for the "recent" window (last 24-48h) and nightly rollups for historical data.

**Your Choice**: [D ]

**Notes**:

---

## 10. Test Case Storage

**Context**: The Test page needs to store test cases with expected outputs.

**Options**:

- [ X] **A) Store in database (AgentTestCase table)** (Recommended)
    - ✅ UI-managed test cases
    - ✅ Non-technical users can add tests
    - ✅ Test results linked to cases
    - ⚠️ Another table to maintain

- [ ] **B) Store in code (JSON/YAML files)**
    - ✅ Version controlled
    - ✅ CI/CD integration
    - ⚠️ Requires deployment to add tests
    - ⚠️ Not accessible to non-developers

- [ ] **C) Both: DB for UI, code for CI/CD**
    - ✅ Flexible for all users
    - ⚠️ Two sources of truth
    - ⚠️ Sync complexity

**Recommendation**: Choose **Option A** for MVP. Database-stored test cases are more accessible and can be exported to JSON for CI/CD if needed later.

**Your Choice**: [A]

**Notes**:

---

## 11. Cost Calculation Source

**Context**: The Costs page needs token counts and USD costs per run.

**Options**:

- [X ] **A) Extract from Vercel AI SDK usage stats** (Recommended)
    - ✅ Accurate token counts
    - ✅ Automatic with streaming
    - ⚠️ Requires parsing response metadata

- [ ] **B) Use provider pricing API**
    - ✅ Real-time pricing
    - ⚠️ Additional API calls
    - ⚠️ Rate limits

- [ ] **C) Static pricing table in code**
    - ✅ Simple
    - ✅ Fast lookups
    - ⚠️ Must update when prices change
    - ⚠️ May be inaccurate

- [ ] **D) Combination: SDK for tokens, static table for USD**
    - ✅ Accurate token counts
    - ✅ Fast cost calculation
    - ⚠️ Pricing table maintenance

**Recommendation**: Choose **Option D**. Use Vercel AI SDK for token counts (it provides this automatically). Maintain a pricing table for USD conversion that you update quarterly.

**Your Choice**: [A]

**Notes**:

---

## 12. Audit Log Scope

**Context**: The plan calls for audit logging of all writes and sensitive reads.

**Options**:

- [ ] **A) All writes only**
    - ✅ Lower volume
    - ✅ Captures mutations
    - ⚠️ Missing sensitive read tracking

- [X ] **B) Writes + sensitive reads (agent view, config view)** (Recommended)
    - ✅ Compliance-friendly
    - ✅ Tracks who viewed what
    - ⚠️ Higher volume
    - ⚠️ Need to define "sensitive"

- [ ] **C) Everything (all API calls)**
    - ✅ Complete audit trail
    - ⚠️ Very high volume
    - ⚠️ May impact performance
    - ⚠️ Storage costs

**Recommendation**: Choose **Option B**. Log all writes plus reads of agent configurations, versions, and guardrail settings. Skip logging for analytics and public list endpoints.

**Your Choice**: [B ]

**Notes**:

---

## 13. MVP Scope

**Context**: The plan identifies MVP-critical vs Phase 2 features. Confirm your MVP scope.

**Pages - Which are MVP-critical?**

- [ X] Layout (agent context, navigation) - **Recommended: MVP**
- [X ] Overview (KPIs, alerts, quick actions) - **Recommended: MVP**
- [X ] Configure (agent settings, tools, memory) - **Recommended: MVP**
- [ X] Test (chat testing, test cases) - **Recommended: MVP (basic)**
- [X ] Runs (execution history) - **Recommended: MVP**
- [X ] Analytics (metrics, charts) - **Recommended: Phase 2**
- [X ] Traces (step-by-step debugging) - **Recommended: MVP (basic)**
- [X ] Evaluations (scores, feedback) - **Recommended: Phase 2**
- [ X] Costs (budget, spending) - **Recommended: Phase 2**
- [ X] Versions (history, rollback) - **Recommended: MVP**
- [X ] Guardrails (safety controls) - **Recommended: Phase 2**

**Your MVP Pages**: I want all pages in the MVP listed above

**Notes**:

---

## 14. Data Retention Defaults

**Context**: Different data types have different retention needs.

**Confirm or adjust these defaults**:

| Data Type              | Default   | Your Choice |
| ---------------------- | --------- | ----------- |
| Raw traces, tool calls | Permanent | [ X]        |
| Runs                   | Permanent | [X]         |
| Cost events            | Permanent | [X ]        |
| Evaluations            | Permanent | [X ]        |
| Feedback               | Permanent | [X ]        |
| Aggregated metrics     | Permanent | [X ]        |
| Versions               | Permanent | [X]         |
| Audit logs             | Permanent | [X ]        |

**Notes**:

---

## 15. Deployment Target

**Context**: The deployment environment affects some technical decisions.

**Options**:

- [ X] **A) Vercel (Next.js native)**
    - ✅ Easy deployment
    - ✅ Edge functions
    - ⚠️ Function timeouts (10-60s depending on plan)
    - ⚠️ No persistent connections for WebSocket

- [ ] **B) Self-hosted (Docker/Kubernetes)**
    - ✅ No timeouts
    - ✅ WebSocket support
    - ✅ Full control
    - ⚠️ More ops overhead

- [ ] **C) Hybrid (Vercel for frontend, separate backend)**
    - ✅ Flexibility
    - ⚠️ More complex architecture

**Recommendation**: If deploying to **Vercel**, stick with SSE and ensure long-running operations use Inngest for background processing. If **self-hosted**, you have more flexibility.

**Your Choice**: [ A]

**Notes**:

---

## Summary Checklist

After completing this questionnaire, you should have decisions for:

- [ ] Observability storage (Q1)
- [ ] Multi-tenancy model (Q2)
- [ ] Tool registry approach (Q3)
- [ ] Scorer registry approach (Q4)
- [ ] Evaluation storage (Q5)
- [ ] Real-time transport (Q6)
- [ ] Version snapshot content (Q7)
- [ ] Guardrail strategy (Q8)
- [ ] Analytics rollup frequency (Q9)
- [ ] Test case storage (Q10)
- [ ] Cost calculation source (Q11)
- [ ] Audit log scope (Q12)
- [ ] MVP scope confirmation (Q13)
- [ ] Data retention confirmation (Q14)
- [ ] Deployment target (Q15)

Once complete, update `agentworkspaceplan.md` with your final decisions and proceed to implementation.
