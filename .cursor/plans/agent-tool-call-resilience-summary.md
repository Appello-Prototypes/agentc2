# Agent Tool Call Resilience - Design Summary

**GitHub Issue:** https://github.com/Appello-Prototypes/agentc2/issues/151  
**Full Design:** `.cursor/plans/agent-tool-call-resilience-design.md`  
**Status:** Ready for Review  
**Created:** 2026-03-12

---

## Problem Statement

Agents immediately give up when tools are transiently unavailable instead of retrying:
- **Run cmmmvj3kw00a58exvmha1e3jv:** 0 tool calls, 44 tokens, 0.225 score (CRITICAL: TOOL_SELECTION_ERROR)
- **Run cmmmvd41b008l8exvctdhd9vd:** Used only 4/30 steps, stopped prematurely

**Root Causes:**
1. No automatic retry mechanism at tool execution level
2. Transient failures (network, timeout, rate limits) treated like permanent failures
3. No error classification to guide agent behavior
4. Agents stop early despite remaining steps

---

## Proposed Solution - 4 Key Changes

### 1. Automatic Tool-Level Retry ✨

**Location:** Tool Execution Guard (`packages/agentc2/src/security/tool-execution-guard.ts`)

**What:** Wrap all tools (native + MCP + skills) with automatic retry logic
- Default: 2 retries with exponential backoff (1s → 2s → 4s with jitter)
- Transparent to agents - happens below LLM visibility
- Integrated with existing `withRetry()` utility (`packages/agentc2/src/lib/retry.ts`)

**Why Tool Guard?**
- ✅ Single wrapping point for ALL tools
- ✅ Already wraps permission checks
- ✅ Can be configured per agent
- ✅ Preserves existing error handling patterns

### 2. Enhanced Error Classification 🏷️

**Current:** Tools return flat error strings
```typescript
{ success: false, error: "Connection timeout" }
```

**Proposed:** Add structured error metadata
```typescript
{
    success: false,
    error: "Connection timeout",
    errorType: "transient",     // NEW
    retryable: true,            // NEW
    statusCode: 504,            // NEW
    retriesExhausted: 2         // NEW
}
```

**Error Types:**
- **Transient:** Network errors, timeouts, rate limits, server errors → retry
- **Permanent:** 404, business logic failures → don't retry
- **Validation:** Invalid parameters → fix and retry manually
- **Permission:** 401, 403 → don't retry

### 3. Circuit Breaker Protection 🔌

**Location:** Integrated via existing utility (`packages/agentc2/src/lib/circuit-breaker.ts`)

**What:** Prevent repeated calls to failing services
- Opens after 5 failures in 60s
- Resets after 30s (enters HALF_OPEN state)
- Closes after 3 consecutive successes

**Benefit:** Protects against retry storms and cascading failures

### 4. System Prompt + Step Guardrails 📋

**System Prompt Enhancement:**
Add guidance to agent instructions:
```
# Tool Execution Guidance
1. Always attempt tool calls - don't assume unavailability without trying
2. Transient failures are automatically retried (2 retries with backoff)
3. Interpret error types:
   - "transient": Already retried, if still failing try different approach
   - "permanent": Won't succeed on retry, use different tool
   - "validation": Fix parameters and try again
4. Use your full step budget - you have N steps available
```

**Step Anchor Enhancement:**
Detect low activity and inject warning:
```
[Progress Warning - Step 6/30]
You have made only 0 tool calls with 24 steps remaining.
- Do NOT assume tools are unavailable without trying
- Transient errors are automatically retried
Continue making progress toward the user's request.
```

---

## Architecture Overview

### Current Flow (No Retry)
```
Agent → Tool Execution Guard → Tool Execute → Error → Agent Sees Error → Gives Up
```

### Proposed Flow (With Retry)
```
Agent → Tool Execution Guard → Retry Wrapper → Tool Execute
                                    ↓ (transient error)
                                 Wait 1s → Tool Execute
                                    ↓ (transient error)  
                                 Wait 2s → Tool Execute
                                    ↓ (success or permanent error)
                                 Return with metadata → Agent Sees Result
```

**Circuit Breaker Integration:**
```
Tool Execute → Circuit Breaker Check (OPEN?) → Reject immediately
                                     (CLOSED/HALF_OPEN) → Allow execution
                                            ↓ (on success)
                                         Update circuit state
```

---

## Key Files Modified

| File | Purpose | Change Type |
|------|---------|-------------|
| `packages/agentc2/src/security/tool-execution-guard.ts` | Add retry wrapper | **Major** |
| `packages/agentc2/src/mcp/client.ts` | Error classification | Moderate |
| `packages/agentc2/src/agents/resolver.ts` | System prompt | Minor (additive) |
| `packages/agentc2/src/processors/step-anchor.ts` | Low-activity detection | Minor |
| `packages/database/prisma/schema.prisma` | Add retry config fields | Migration |
| `apps/agent/src/lib/run-recorder.ts` | Record retry metadata | Minor |

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Infrastructure without behavior change

- ✅ Error classification in `executeMcpTool`
- ✅ Retry wrapper in tool guard (disabled by default)
- ✅ Circuit breaker integration (disabled by default)
- ✅ Database schema updates (`toolRetryConfig`, retry metadata fields)
- ✅ Observability endpoints (circuit breaker status API)
- ✅ Unit + integration tests

**Success:** All infrastructure in place, feature flagged off, zero impact on existing runs

### Phase 2: Agent-Level Opt-In (Week 2)
**Goal:** Validate with test agents

- ✅ Enable retry for 2-3 test agents
- ✅ System prompt enhancements
- ✅ Step anchor improvements
- ✅ Monitoring dashboard updates
- ✅ A/B test: retry enabled vs disabled

**Success:** Test agents successfully recover from transient failures, >20% success rate improvement

### Phase 3: Controlled Rollout (Week 3)
**Goal:** Gradual production rollout

- ✅ 10% rollout with monitoring (success rate, latency, token usage)
- ✅ Analyze evaluation scores (TOOL_SELECTION_ERROR reduction)
- ✅ Tune error classification based on findings
- ✅ 50% rollout if metrics positive
- ✅ Documentation updates (CLAUDE.md, troubleshooting guide)

**Success:** Positive metrics at 50%, no circuit breaker storms, improved evaluation scores

### Phase 4: Full Rollout & Optimization (Week 4)
**Goal:** 100% enabled + advanced features

- ✅ Enable by default for all agents
- ✅ Per-tool configuration overrides
- ✅ Adaptive retry (increase for high-value runs)
- ✅ Performance optimizations (parallel retry, caching)
- ✅ Weekly effectiveness reports

**Success:** >15% reduction in transient failures, sustained improvement, rare circuit breaker trips

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Infinite retry loops** | Hard cap at 2 retries, 60s timeout per attempt, circuit breaker |
| **Circuit breaker false positives** | Tunable thresholds, 30s reset, gradual recovery via HALF_OPEN |
| **Incorrect error classification** | Conservative defaults (unknown = permanent), logging, per-agent override |
| **Increased system load** | Exponential backoff with jitter, circuit breaker, monitoring |
| **Breaking existing agents** | Backward compatible (additive fields), feature flag, A/B testing |
| **Retry storms** | Jitter, circuit breaker, percentage-based rollout with monitoring |

---

## Expected Impact

### Success Metrics (Before → After)

**Run cmmmvj3kw00a58exvmha1e3jv scenario:**
- Tool calls: **0 → 3+** (actually attempts tools)
- Step utilization: **7% → >50%** (uses allocated budget)
- Evaluation score: **0.225 → >0.7** (passing score)
- TOOL_SELECTION_ERROR: **Reduced by >70%**

**Run cmmmvd41b008l8exvctdhd9vd scenario:**
- Step utilization: **20% → >60%** (continues until complete)
- Premature termination: **Reduced by >50%**

**Overall:**
- Transient error recovery: **0% → >60%** (most resolve on retry)
- Task completion rate: **>20% improvement**
- Circuit breaker trips: **<1% of runs** (rare, as intended)

### Cost Impact

**Positive:**
- ✅ Fewer wasted runs that fail immediately
- ✅ Better utilization of allocated maxSteps
- ✅ Improved user experience (fewer error messages)

**Negative:**
- ⚠️ Increased latency on failures (2-6s retry delays)
- ⚠️ Slightly higher tool execution time

**Net:** Neutral to slight cost reduction (fewer re-runs needed)

---

## Configuration Example

### Agent Configuration
```json
{
  "id": "agent-123",
  "slug": "sdlc-signal-harvester",
  "maxSteps": 30,
  "toolRetryConfig": {
    "enabled": true,
    "maxRetries": 2,
    "enableCircuitBreaker": true,
    "initialDelayMs": 1000,
    "maxDelayMs": 10000,
    "jitter": true
  }
}
```

### Circuit Breaker Defaults
```json
{
  "failureThreshold": 5,
  "failureWindowMs": 60000,
  "resetTimeoutMs": 30000,
  "successThreshold": 3
}
```

---

## Existing Utilities Leveraged

**Already implemented, just need to integrate:**

1. **Retry Utility** (`packages/agentc2/src/lib/retry.ts`)
   - ✅ Exponential backoff with jitter
   - ✅ Configurable max retries, delays
   - ✅ Custom `isRetryable` predicate
   - ✅ 80 lines, well-tested

2. **Circuit Breaker** (`packages/agentc2/src/lib/circuit-breaker.ts`)
   - ✅ State machine (CLOSED → OPEN → HALF_OPEN)
   - ✅ Configurable thresholds
   - ✅ Registry for tracking multiple breakers
   - ✅ 155 lines, production-ready

**No need to reinvent the wheel - just wire them into the tool execution guard.**

---

## Alternative Approaches Considered

1. **LLM-Driven Retry** - ❌ Rejected
   - Wastes tokens, inconsistent, LLMs misinterpret errors
   
2. **MCP Client-Level Only** - ❌ Partial solution
   - Doesn't cover native tools, requires duplication

3. **Per-Tool Configuration** - ⏳ Future enhancement
   - Too complex for MVP, add in Phase 4 if needed

4. **Retry Budget** - ⏳ Future enhancement
   - Useful for latency-sensitive apps, not MVP requirement

---

## Documentation Updates

1. **CLAUDE.md** - Add Tool Call Resilience section
2. **API Docs** - Update error response formats with new fields
3. **Troubleshooting Guide** - NEW: `docs/troubleshooting/tool-failures.md`
4. **Agent Configuration Docs** - Document `toolRetryConfig` options

---

## Testing Strategy

**Unit Tests:**
- Error classification (20 test cases)
- Retry logic with various error types
- Circuit breaker state transitions

**Integration Tests:**
- End-to-end agent execution with simulated failures
- MCP tool execution with retry behavior
- Step anchor processor with low-activity detection

**Production Validation:**
- A/B test: 10% retry enabled, 90% control
- Monitor: success rates, latency, token usage, circuit breaker trips
- Gradual rollout: 10% → 50% → 100%

---

## Next Steps

1. **Review this design** - Technical team feedback on approach, risks, configuration
2. **Approve for implementation** - Get sign-off from stakeholders
3. **Begin Phase 1** - Implement foundation with feature flags disabled
4. **Set up monitoring** - Metrics, dashboards, alerts for retry behavior
5. **Execute phased rollout** - Follow 4-week plan with go/no-go checkpoints

---

## Questions for Review

1. Are retry limits appropriate? (2 retries = 3 total attempts)
2. Should circuit breaker thresholds vary by integration?
3. Will system prompt additions cause token bloat?
4. Acceptable 2-6s latency increase for transient failures?
5. Any backward compatibility concerns with new fields?
6. Who owns long-term tuning of error classification?

---

**Full technical design available at:** `.cursor/plans/agent-tool-call-resilience-design.md`

**Ready for:** Implementation planning and stakeholder review
