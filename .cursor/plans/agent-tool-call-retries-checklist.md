# Agent Tool Call Retries - Implementation Checklist

**Design Doc**: [agent-tool-call-retries-design.md](./agent-tool-call-retries-design.md)  
**Quick Reference**: [agent-tool-call-retries-summary.md](./agent-tool-call-retries-summary.md)  
**GitHub Issue**: https://github.com/Appello-Prototypes/agentc2/issues/151

---

## Phase 1: Core Retry Infrastructure ⚡

### 1.1 Create Retry Wrapper

- [ ] Create `packages/agentc2/src/security/tool-retry-wrapper.ts`
  - [ ] `isTransientError()` function with comprehensive error detection
  - [ ] `wrapToolExecute()` function for individual tool wrapping
  - [ ] `wrapToolsWithRetry()` function for bulk wrapping
  - [ ] `ToolRetryConfig` and `ToolRetryResult` interfaces
  - [ ] `ToolRetryMetadata` tracking structure
  - [ ] Integration with existing `withRetry()` utility
  - [ ] Export all public functions

- [ ] Create `packages/agentc2/src/security/tool-retry-wrapper.test.ts`
  - [ ] Test: transient network error → retry succeeds
  - [ ] Test: fatal error → no retry attempted
  - [ ] Test: max retries exhausted → return final error
  - [ ] Test: exponential backoff calculation
  - [ ] Test: jitter randomization
  - [ ] Test: custom `isRetryable` function
  - [ ] Test: `onRetry` callback invoked with correct parameters
  - [ ] Test: retry metadata attached to results

### 1.2 Integrate with MCP Client

- [ ] Modify `packages/agentc2/src/mcp/client.ts`
  - [ ] Import `withRetry` and `isTransientError`
  - [ ] Wrap `executeMcpTool()` execution (line 5018-5028)
  - [ ] Handle `Retry-After` headers for 429 errors
  - [ ] Add retry logging
  - [ ] Emit `ToolRetryEvent` telemetry on retry
  - [ ] Update return type to include retry metadata
  - [ ] Update error responses with `errorType` and `retryable` fields

- [ ] Test MCP retry integration
  - [ ] Mock MCP server that fails once, succeeds on retry
  - [ ] Verify retry logic works
  - [ ] Verify metadata captured

### 1.3 Integrate with Native Tools

- [ ] Modify `packages/agentc2/src/agents/resolver.ts`
  - [ ] Import `wrapToolsWithRetry`
  - [ ] Add retry wrapper call after permission guard (after line 1024)
  - [ ] Extract retry config from `contextConfig.toolRetryPolicy`
  - [ ] Add logging for tools wrapped
  - [ ] Handle case where retry config is disabled

- [ ] Test native tool retry integration
  - [ ] Mock native tool that fails transiently
  - [ ] Verify retry wrapper applies correctly
  - [ ] Verify permission guards still work

### 1.4 Database Migration

- [ ] Create migration: `add_tool_retry_tracking`
  - [ ] Add `retryCount INT DEFAULT 0` to `agent_tool_call`
  - [ ] Add `retryHistoryJson JSONB` to `agent_tool_call`
  - [ ] Add `wasRetried BOOLEAN DEFAULT false` to `agent_tool_call`
  - [ ] Add `finalError TEXT` to `agent_tool_call`
  - [ ] Create index on `wasRetried`
  - [ ] Create `tool_retry_event` table with all fields
  - [ ] Add indexes on `toolKey`, `errorType`, `organizationId`, `timestamp`

- [ ] Test migration
  - [ ] Run migration on test database
  - [ ] Verify all fields created
  - [ ] Verify indexes created
  - [ ] Verify existing data unaffected
  - [ ] Test rollback migration

### 1.5 Run Recorder Integration

- [ ] Modify `apps/agent/src/lib/run-recorder.ts`
  - [ ] Update `extractToolCalls()` to extract retry metadata (line 721-917)
  - [ ] Populate new fields when creating `AgentToolCall` records
  - [ ] Handle `__retryMetadata` property in tool results
  - [ ] Emit `ToolRetryEvent` telemetry

- [ ] Test run recorder
  - [ ] Mock agent response with retry metadata
  - [ ] Verify tool calls recorded with retry fields
  - [ ] Verify telemetry events emitted

### 1.6 Phase 1 Testing & Rollout

- [ ] Unit tests pass: `bun test tool-retry-wrapper.test.ts`
- [ ] Integration tests pass: `bun test --grep "tool retry"`
- [ ] Type check: `bun run type-check`
- [ ] Lint: `bun run lint`
- [ ] Build: `bun run build`
- [ ] Deploy to staging with retry **disabled by default**
- [ ] Manual test: SDLC Signal Harvester agent with injected failures
- [ ] Monitor staging for 24 hours
- [ ] Deploy to production with retry **disabled by default**

---

## Phase 2: Agent Behavior Processors 🤖

### 2.1 Tool Availability Processor

- [ ] Create `packages/agentc2/src/processors/tool-availability-processor.ts`
  - [ ] `ToolAvailabilityConfig` interface
  - [ ] `AvailabilityState` interface
  - [ ] `createToolAvailabilityProcessor()` function
  - [ ] State tracking for tool calls per step
  - [ ] Encouragement injection logic
  - [ ] `buildEncouragementMessage()` helper
  - [ ] Helper functions for message parsing

- [ ] Create `packages/agentc2/src/processors/tool-availability-processor.test.ts`
  - [ ] Test: encouragement after 3 steps without tools
  - [ ] Test: no encouragement if tools recently called
  - [ ] Test: state tracking across steps
  - [ ] Test: custom threshold configuration
  - [ ] Test: tracking successes and failures

### 2.2 Minimum Tool Call Processor

- [ ] Create `packages/agentc2/src/processors/minimum-tool-call-processor.ts`
  - [ ] `MinimumToolCallConfig` interface
  - [ ] `MinimumToolCallState` interface
  - [ ] `createMinimumToolCallProcessor()` function
  - [ ] Task detection heuristic (`detectIfTaskRequiresTools()`)
  - [ ] Tool call counting logic
  - [ ] Abort with retry implementation
  - [ ] DEFAULT_TASK_KEYWORDS array
  - [ ] Helper functions for message parsing

- [ ] Create `packages/agentc2/src/processors/minimum-tool-call-processor.test.ts`
  - [ ] Test: enforce minimum for maxSteps=30 task
  - [ ] Test: skip enforcement for maxSteps=5 task
  - [ ] Test: task detection with action keywords
  - [ ] Test: task detection with tool mentions
  - [ ] Test: allow finish after minimum met
  - [ ] Test: only enforce once (retryCount check)

### 2.3 Enhanced Step Anchor

- [ ] Modify `packages/agentc2/src/processors/step-anchor.ts`
  - [ ] Add mid-task continuation prompts (50% through)
  - [ ] Enhance final step messaging
  - [ ] Track tool call success in state
  - [ ] Add "continue task" guidance

- [ ] Test enhanced anchors
  - [ ] Verify mid-task anchor injects at step 15/30
  - [ ] Verify final step message updated
  - [ ] Verify no regression on existing behavior

### 2.4 Processor Integration

- [ ] Modify `packages/agentc2/src/agents/resolver.ts`
  - [ ] Add `createToolAvailabilityProcessor()` to input processors (line 1057)
  - [ ] Add `createMinimumToolCallProcessor()` to output processors (line 1073)
  - [ ] Extract config from `contextConfig`
  - [ ] Ensure processor order is correct
  - [ ] Add logging for processor attachment

- [ ] Test processor integration
  - [ ] Verify processors run in correct order
  - [ ] Verify config passed correctly
  - [ ] Verify processors can be disabled via config

### 2.5 System Prompt Enhancement

- [ ] Modify `packages/agentc2/src/agents/resolver.ts` (system messages)
  - [ ] Add "Tool Execution & Error Handling" section
  - [ ] Explain transient vs fatal errors
  - [ ] Encourage tool usage
  - [ ] Only inject when agent has tools attached

### 2.6 Phase 2 Testing & Rollout

- [ ] Unit tests pass: all processor tests
- [ ] Integration test: zero-tool-call prevention
- [ ] Integration test: tool avoidance encouragement
- [ ] E2E test: re-run SDLC Signal Harvester with processors enabled
- [ ] Type check, lint, build
- [ ] Deploy to staging with processors **enabled by default**
- [ ] Monitor false positive rate for minimum tool call enforcement
- [ ] Deploy to production

---

## Phase 3: Configuration & Observability 📊

### 3.1 Agent Configuration Schema

- [ ] Modify `packages/agentc2/src/schemas/agent.ts`
  - [ ] Add `toolRetryPolicy` to `contextConfigSchema` (line 49-67)
  - [ ] Add `minToolCalls` to `contextConfigSchema`
  - [ ] Update Zod validators
  - [ ] Add JSDoc comments

- [ ] Test schema validation
  - [ ] Valid config → passes
  - [ ] Invalid maxRetries (> 5) → rejected
  - [ ] Invalid delay values → rejected

### 3.2 Agent Settings UI

- [ ] Modify `apps/agent/src/app/agents/[agentSlug]/settings/page.tsx`
  - [ ] Add "Tool Retry Policy" section
    - [ ] Enabled toggle
    - [ ] Max Retries input (0-5)
    - [ ] Initial Delay input (100-5000ms)
    - [ ] Max Delay input (1000-30000ms)
    - [ ] Info tooltip explaining transient errors
  - [ ] Add "Minimum Tool Calls" section
    - [ ] Enabled toggle
    - [ ] Threshold input (0-10)
    - [ ] Enforce for maxSteps input (5-100)
    - [ ] Info tooltip explaining enforcement

- [ ] Test settings UI
  - [ ] Form validation works
  - [ ] Save → config updated in database
  - [ ] Load → config displayed correctly
  - [ ] Disable → config nullified

### 3.3 Retry Analytics API

- [ ] Create `apps/agent/src/app/api/agents/[id]/analytics/retries/route.ts`
  - [ ] Query `ToolRetryEvent` table
  - [ ] Aggregate by tool, error type, time range
  - [ ] Calculate retry success rate
  - [ ] Return structured JSON
  - [ ] Add authentication check
  - [ ] Add rate limiting

- [ ] Test analytics API
  - [ ] Seed test data
  - [ ] Query with different time ranges
  - [ ] Verify aggregations correct
  - [ ] Test error handling

### 3.4 Retry Dashboard UI

- [ ] Create `apps/agent/src/app/agents/[agentSlug]/analytics/retries/page.tsx`
  - [ ] Line chart: retry attempts over time (Recharts)
  - [ ] Bar chart: top retried tools
  - [ ] Pie chart: error type distribution
  - [ ] Table: detailed retry events
  - [ ] Filters: date range, tool, error type
  - [ ] Refresh button
  - [ ] Export CSV button

- [ ] Test dashboard UI
  - [ ] Charts render correctly
  - [ ] Filters work
  - [ ] Empty state handled
  - [ ] Loading state handled
  - [ ] Responsive design

### 3.5 Phase 3 Testing & Rollout

- [ ] All UI tests pass
- [ ] API tests pass
- [ ] E2E test: configure retry via UI → verify applied
- [ ] Type check, lint, build
- [ ] Deploy to staging
- [ ] Test full flow: configure → run agent → view analytics
- [ ] Deploy to production
- [ ] Enable retry by default for new agents (via agent template)

---

## Phase 4: Evaluation & Production Tuning 📈

### 4.1 Enhanced Tier 1 Evaluation

- [ ] Modify `packages/agentc2/src/scorers/tier1.ts`
  - [ ] Update `toolSuccess` scorer (line 126-136)
  - [ ] Account for `wasRetried` field
  - [ ] Give partial credit for successful retries
  - [ ] Add retry flags to output
  - [ ] Update scoring documentation

- [ ] Test enhanced scoring
  - [ ] Run with retry metadata → correct score
  - [ ] Run without retries → unchanged score
  - [ ] Edge cases: all retries failed, mixed success

### 4.2 Enhanced Tier 2 Evaluation

- [ ] Modify `packages/agentc2/src/scorers/auditor.ts`
  - [ ] Update failure mode classification prompt (line 144)
  - [ ] Add guidance about zero-tool-call detection
  - [ ] Clarify that automatic retries don't count against agent
  - [ ] Include retry context in AAR

- [ ] Test auditor changes
  - [ ] Zero-tool run → CRITICAL TOOL_SELECTION_ERROR
  - [ ] Successful retry → not classified as error
  - [ ] Failed retry → classified appropriately

### 4.3 Production Monitoring

- [ ] Set up monitoring dashboards
  - [ ] Real-time retry monitor (`/admin/monitoring/tool-retries`)
  - [ ] Per-agent retry profile (add to existing agent analytics)
  - [ ] Platform-wide tool health (`/admin/tools/health`)

- [ ] Configure alerts
  - [ ] High retry rate (>30% over 1 hour) → Slack #eng-alerts
  - [ ] Retry storm (>100 retries in 5 min) → Slack + disable tool
  - [ ] Zero-tool-call spike (>10% in 1 hour) → Slack #agent-quality

- [ ] Monitor for 1 week
  - [ ] Track TOOL_SELECTION_ERROR rate (target: <8%)
  - [ ] Track zero-tool-call runs (target: <5%)
  - [ ] Track run completion rate (target: >85%)
  - [ ] Track retry success rate (target: >90%)
  - [ ] Identify tools with high retry rates

### 4.4 Parameter Tuning

- [ ] Analyze production data
  - [ ] Query `ToolRetryEvent` for success rates by retry count
  - [ ] Identify optimal maxRetries (current: 2)
  - [ ] Identify optimal delays by error type
  - [ ] Find tools that need custom retry policies

- [ ] Apply tuning
  - [ ] Update default `maxRetries` if needed
  - [ ] Update default delays if needed
  - [ ] Add per-tool overrides for problematic tools
  - [ ] Document findings

### 4.5 Documentation

- [ ] Update `CLAUDE.md`
  - [ ] Add "Tool Retry Logic" section
  - [ ] Explain default configuration
  - [ ] Document how to customize per agent
  - [ ] Add troubleshooting guide

- [ ] Update `docs/`
  - [ ] Create `docs/agent-retry-logic.md` guide
  - [ ] Add to API reference
  - [ ] Update architecture documentation
  - [ ] Add to troubleshooting guide

- [ ] User-facing documentation
  - [ ] Add to agent settings guide
  - [ ] Add FAQ entries
  - [ ] Create video tutorial (optional)

### 4.6 Phase 4 Completion

- [ ] All metrics meet targets
- [ ] Documentation complete
- [ ] No critical issues in production
- [ ] Enable retry by default for all agents
- [ ] Write retrospective blog post
- [ ] Close GitHub issue #151

---

## Testing Checklist

### Unit Tests

- [ ] `tool-retry-wrapper.test.ts` (all tests passing)
- [ ] `tool-availability-processor.test.ts` (all tests passing)
- [ ] `minimum-tool-call-processor.test.ts` (all tests passing)

### Integration Tests

- [ ] Create `apps/agent/__tests__/tool-retries.integration.test.ts`
  - [ ] Test: transient error recovery
  - [ ] Test: fatal error no retry
  - [ ] Test: retry exhaustion
  - [ ] Test: retry metadata recording
  - [ ] Test: zero-tool prevention
  - [ ] Test: mixed success/failure

### End-to-End Tests

- [ ] SDLC Signal Harvester re-run
  - [ ] Setup: Deploy agent with retry enabled
  - [ ] Execute: Run task that previously failed
  - [ ] Verify: Agent attempts Jira tool calls
  - [ ] Verify: No TOOL_SELECTION_ERROR
  - [ ] Verify: Task completes successfully

- [ ] HubSpot CRM workflow with injected failure
  - [ ] Setup: Mock ECONNREFUSED on first call
  - [ ] Execute: Run contact lookup task
  - [ ] Verify: Automatic retry succeeds
  - [ ] Verify: Run completes normally
  - [ ] Verify: Retry metadata in database

- [ ] Multi-step research task
  - [ ] Setup: Task requiring 2+ tool phases
  - [ ] Execute: Inject 503 on first tool call
  - [ ] Verify: Retry succeeds
  - [ ] Verify: Agent continues to next phase
  - [ ] Verify: Full task completion

### Performance Tests

- [ ] Retry latency measurement
  - [ ] Measure: avg delay per retry attempt
  - [ ] Measure: total retry overhead per run
  - [ ] Target: <5% increase in avg run duration

- [ ] Retry storm prevention
  - [ ] Simulate: 10 agents call failing tool simultaneously
  - [ ] Verify: Jitter spreads retry attempts
  - [ ] Verify: Per-run retry budget enforced
  - [ ] Verify: No cascading failures

---

## Quality Gates

### Before Merge to Main

- [ ] ✅ All unit tests passing
- [ ] ✅ All integration tests passing
- [ ] ✅ E2E tests passing
- [ ] ✅ `bun run type-check` passes
- [ ] ✅ `bun run lint` passes
- [ ] ✅ `bun run build` succeeds
- [ ] ✅ Database migration tested on staging
- [ ] ✅ Code review completed
- [ ] ✅ Design review approved

### Before Enabling in Production

- [ ] ✅ Deployed to staging for 48+ hours
- [ ] ✅ No critical issues in staging
- [ ] ✅ Monitoring dashboards configured
- [ ] ✅ Alerts configured
- [ ] ✅ Documentation complete
- [ ] ✅ Rollback plan tested
- [ ] ✅ On-call engineer briefed

### 1 Week After Production Rollout

- [ ] ✅ TOOL_SELECTION_ERROR rate measured
- [ ] ✅ Zero-tool-call rate measured
- [ ] ✅ Run completion rate measured
- [ ] ✅ Retry success rate measured
- [ ] ✅ No P0/P1 incidents caused by retry logic
- [ ] ✅ User feedback collected
- [ ] ✅ Engineering retrospective completed

---

## Rollback Procedures

### Immediate Rollback (5 minutes)

```bash
# Set environment variable to disable retry
export FEATURE_TOOL_RETRIES=false

# Restart services
pm2 restart ecosystem.config.js --update-env

# Verify retry disabled
curl https://agentc2.ai/api/health/features
```

### Code Rollback (1 hour)

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or deploy previous version
git checkout <previous-commit>
./scripts/deploy.sh
```

### Database Rollback (if needed)

```bash
# Revert migration (only if critical issue)
bun run db:migrate -- --down

# Or keep schema, disable feature
# (retry fields are nullable/defaulted, safe to leave)
```

---

## Known Limitations

1. **Not a Silver Bullet**: Retries only help with transient errors. Persistent issues (misconfiguration, service outages) still require manual intervention.

2. **Retry Delay Trade-off**: Each retry adds 500-5000ms latency. Fast responses (1-2s) may become moderate (2-5s) with retries.

3. **Non-Idempotent Mutations**: Tools that create resources (contacts, tickets, posts) have conservative retry policies to avoid duplicates. May still require manual verification.

4. **MCP Server Restarts**: If MCP server restarts mid-conversation, first retry may still fail. Agent will receive final error after 2 retries.

5. **Rate Limit Windows**: If tool is rate-limited for >5s, retry will fail. Agent must wait or use alternative.

---

## Success Criteria Summary

### Quantitative

| Metric | Baseline | Target | Status |
|--------|----------|--------|--------|
| TOOL_SELECTION_ERROR rate | 15% | <8% | 🔲 To measure |
| Zero-tool runs (maxSteps≥10) | 12% | <5% | 🔲 To measure |
| Run completion rate | 78% | >85% | 🔲 To measure |
| Retry success rate | N/A | >90% | 🔲 To measure |
| Avg run duration increase | 0% | <5% | 🔲 To measure |

### Qualitative

- [ ] ✅ Agents attempt tool calls rather than assuming unavailability
- [ ] ✅ Transient errors recover gracefully
- [ ] ✅ Multi-step tasks complete despite transient failures
- [ ] ✅ Clear error messages distinguish transient vs fatal
- [ ] ✅ Retry behavior is observable and debuggable

---

## Communication Plan

### Engineering Team

- [ ] Share design doc for review
- [ ] Conduct design review meeting
- [ ] Create implementation tickets
- [ ] Add to sprint planning

### Stakeholders

- [ ] Share summary with product team
- [ ] Get approval for database schema changes
- [ ] Coordinate deployment timing
- [ ] Plan user communication

### Users

- [ ] Publish changelog entry when released
- [ ] Update agent settings documentation
- [ ] Send email to active users (optional)
- [ ] Monitor support tickets for feedback

---

## Post-Launch Review (After 1 Month)

- [ ] Calculate actual vs target metrics
- [ ] Analyze cost impact (token usage, API costs)
- [ ] Review user feedback
- [ ] Identify unexpected issues
- [ ] Plan next iteration (adaptive retry, circuit breakers, etc.)
- [ ] Update documentation based on learnings
- [ ] Consider upstreaming to Mastra framework

---

**Checklist Owner**: [To be assigned]  
**Start Date**: [To be scheduled]  
**Target Completion**: [Start + 13 days]  
**Last Updated**: 2026-03-12
