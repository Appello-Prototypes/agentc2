# Campaign v2 Full Audit — Rollup Document

**Campaign**: Competitive Intelligence Report — AI Agent Frameworks (v2)
**Campaign ID**: `cmlobo02g0206v6eios1fqtxu`
**Date**: 2026-02-15
**Auditor**: Automated deep audit

---

## Top-Line Finding

**The reported campaign cost of $31.92 is wrong. The actual API cost was approximately $6.38 for task execution and $16.25 total including system agents.** The cost inflation is caused by a hardcoded pricing formula in `campaign-functions.ts` that charges 5x the actual Anthropic Sonnet rate.

---

## Audit Documents Index

| #   | Document                                                                   | Key Finding                                                           |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 01  | [Cost Verification](./01-cost-verification.md)                             | Costs inflated 5x by hardcoded formula. Real cost ~$16.25, not $41.79 |
| 02  | [Mission 1: Web Reconnaissance](./02-mission1-web-reconnaissance.md)       | 2/4 tasks succeeded. Firecrawl scraping consumed 1.68M tokens         |
| 03  | [Mission 2: Analysis](./03-mission2-analysis.md)                           | 0/3 tasks ran. All blocked by $10/month agent budget                  |
| 04  | [Mission 3: Report Delivery](./04-mission3-report-delivery.md)             | 2/2 marked COMPLETE but neither achieved its objective                |
| 05  | [System Agents](./05-system-agents-audit.md)                               | 6 system runs cost $9.87 — not included in campaign total             |
| 06  | [Data Storage & Discoverability](./06-data-storage-and-discoverability.md) | Results stored as raw JSON, no human-friendly viewing                 |
| 07  | [Tool Call Analysis](./07-tool-call-analysis.md)                           | 47 tool calls, all succeeded. ~183K token overhead per task run       |
| 08  | [Campaign Timeline](./08-campaign-timeline.md)                             | 16-minute lifecycle with duplicate log entries                        |

---

## Campaign Scorecard

| Metric                 | Value       | Assessment                                         |
| ---------------------- | ----------- | -------------------------------------------------- |
| Tasks planned          | 9           | --                                                 |
| Tasks completed        | 4 (44%)     | Up from 5% in v1, but 2 of 4 are false completions |
| Tasks truly successful | 2 (22%)     | LangGraph + AutoGen scrapes                        |
| Tasks failed           | 4 (44%)     | CrewAI (context), GitHub (tool), 2x budget         |
| Tasks skipped          | 1 (11%)     | Correct skip behavior                              |
| End state achieved     | **No**      | No Google Doc, no competitive analysis             |
| Reported cost          | $31.92      | **Incorrect — inflated 5x for Sonnet runs**        |
| Actual task cost       | ~$6.38      | Using correct Sonnet pricing                       |
| Actual total cost      | ~$16.25     | Including system agents with Opus pricing          |
| Token consumption      | 2.65M total | 98.7% prompt tokens from scraped content           |
| Duration               | 16 minutes  | Reasonable for scope                               |

---

## Critical Bugs Found (Ordered by Severity)

### BUG 1: Cost Formula Uses Wrong Pricing (CRITICAL)

**File**: `apps/agent/src/lib/campaign-functions.ts` (lines 119, 993)

The campaign pipeline hardcodes `promptTokens * 0.000015 + completionTokens * 0.000075` ($15/$75 per 1M tokens). For Claude Sonnet (the workhorse model), the correct pricing is $3/$15 per 1M — **5x cheaper**. A proper `calculateCost()` function exists in `cost-calculator.ts` but is not imported or used.

**Impact**: Every Sonnet-based task run reports 5x the actual cost. For Opus-based system agents, the hardcoded formula happens to be correct ($15/$75 matches Opus pricing), so system agent costs are accurate.

**Fix**: Import and use `calculateCost()` from `cost-calculator.ts` at both locations. Also add `claude-opus-4-6` to the pricing table.

---

### BUG 2: System Agent Costs Not Included in Campaign Total (HIGH)

**File**: `apps/agent/src/lib/campaign-functions.ts`, `invokeCampaignAgent()` function

The `invokeCampaignAgent()` function records costs on the `AgentRun` but does NOT increment `campaign.totalCostUsd`. Only `executeTask()` does. This means campaign-analyst ($0.38), campaign-planner ($2.81), and 4 campaign-reviewer runs ($6.68) are invisible in the campaign total.

**Impact**: Campaign total is underreported by $9.87 (the sum of all system agent runs).

---

### BUG 3: Tasks Marked COMPLETE Despite Failing Objectives (HIGH)

**File**: `apps/agent/src/lib/campaign-functions.ts`, `executeTask()` function

A task is marked COMPLETE if the agent run finishes without an unhandled exception. Two Mission 3 tasks were marked COMPLETE despite:

- Having non-empty `error` fields
- Not achieving their stated objectives (no Google Doc created, no shareable link returned)

**Impact**: Campaign completion metrics are misleading. The AAR correctly identified this but the database records remain inaccurate.

---

### BUG 4: Budget Exceeded Errors Retried as Transient (MEDIUM)

**File**: `apps/agent/src/lib/campaign-functions.ts`, `isRetryableError()` function

Budget exceeded errors are not classified as permanent by `isRetryableError()`, causing unnecessary retries and duplicate log entries. The campaign logs show "Build profiles" budget error logged 6 times and "Synthesize matrix" 4 times.

**Impact**: Wasted time and noisy logs. No cost impact (retries fail before incurring API costs).

---

### BUG 5: Duplicate Campaign Log Entries (LOW)

**File**: `apps/agent/src/lib/campaign-functions.ts`, error logging in retry loop

Each retry attempt of a failed task logs a `task_failed` event. For permanent errors, this creates 4-6 duplicate log entries per task.

**Impact**: Log noise. The 40 campaign logs should be ~25 without duplicates.

---

## Systemic Optimization Opportunities

### OPT 1: Content Truncation for Web Scraping Tasks

**Problem**: Firecrawl scrapes return full page HTML/text (50-150K tokens per page). Multiple scrapes accumulate in the agent's context, reaching 700K-960K tokens.

**Solution**:

- Always use `onlyMainContent: true` in Firecrawl scrape calls (strips nav, headers, footers)
- Use `firecrawl_extract` with schemas for structured data extraction instead of full scrapes
- Implement a content truncation step that limits each tool call response to 20K tokens
- Estimated savings: 60-80% token reduction → 60-80% cost reduction for scraping tasks

### OPT 2: Task-Specific Tool Loading

**Problem**: `loadAllSkills: true` loads ALL 106+ tools and all skill tools for every task. Tool definitions alone consume ~183K tokens (~$0.55/task at Sonnet pricing).

**Solution**: The campaign planner already identifies which tools each task needs in `coordinatingInstructions`. Use this to load ONLY the tools required for that specific task.

**Estimated savings**: If a scraping task only needs Firecrawl tools (5 tools instead of 160+), tool definition overhead drops from ~183K to ~5K tokens — a **97% reduction** in base overhead.

### OPT 3: Cheaper Model for Campaign Reviewers

**Problem**: campaign-reviewer uses Claude Opus ($15/$75 per 1M) for structured reporting work (AARs). It runs 4 times per campaign.

**Solution**: Switch reviewer to Claude Sonnet ($3/$15 per 1M). The reviewer's work is structured reporting, not complex reasoning. At Sonnet pricing, the 4 reviewer runs would cost ~$1.34 instead of $6.68.

**Estimated savings**: ~$5.34 per campaign (80% reduction in reviewer costs).

### OPT 4: Inter-Mission Data Transfer

**Problem**: Downstream missions cannot access upstream mission results. The scraping data from Mission 1 was completely inaccessible to Mission 3.

**Solution**: When a mission completes, collect all task `result` outputs and inject a summary into downstream mission task prompts (similar to how `priorResultsSummary` works within a mission). The `coordinatingInstructions` or a new `missionContext` field could carry this data.

### OPT 5: Campaign-Level Budget Enforcement

**Problem**: The campaign's `maxCostUsd: $15` was advisory only — no enforcement. The agent's $10/month budget was enforced but conflicted with campaign needs.

**Solution**: Implement real-time cost checking in `executeTask()` that compares accumulated campaign cost against `maxCostUsd` before starting each task. Provide an option for campaign budgets to override or supplement agent monthly budgets.

### OPT 6: Persist Intermediate Scraping Results

**Problem**: Raw scraped content (1.68M tokens) is lost after the agent run completes. Only the agent's summary (8-15K chars) is stored.

**Solution**: Optionally persist Firecrawl tool outputs to the Document table or a file store, linked back to the campaign/task. This enables human review and reuse without re-scraping.

### OPT 7: Task Objective Validation

**Problem**: Tasks are marked COMPLETE based on agent run completion, not objective achievement.

**Solution**: Add an optional `successCriteria` field to `MissionTask` that defines observable conditions for completion (e.g., "output contains a docs.google.com URL"). The system checks this before marking COMPLETE.

### OPT 8: Multi-Agent Task Distribution

**Problem**: All 9 tasks assigned to one agent creates single-point-of-failure risk.

**Solution**: The planner should distribute tasks across agents based on required capabilities AND budget isolation. Scraping tasks → agent A, analysis tasks → agent B, document tasks → agent C.

---

## Cost Comparison: v1 vs v2 (With Correct Pricing)

| Metric          | v1 (Original) | v2 (Recorded)                | v2 (Actual)          |
| --------------- | ------------- | ---------------------------- | -------------------- |
| Total cost      | $0.88         | $31.92                       | **~$16.25**          |
| Task cost       | $0.88         | $31.92                       | **~$6.38**           |
| System cost     | (not tracked) | (not tracked)                | **~$9.87**           |
| Tasks completed | 1/19 (5%)     | 4/9 (44%)                    | **2/9 (22%) truly**  |
| Tokens used     | 49,612        | 2,093,263                    | 2,650,938 (all runs) |
| Useful output   | None          | LangGraph + AutoGen research | Same                 |

**Key insight**: v1 was cheap ($0.88) because almost nothing executed — tasks failed immediately on tool-not-found errors. v2 is more expensive because tasks actually ran and produced real output. The cost increase is a sign of progress, not regression — but the 5x pricing bug makes it look worse than it is.

---

## Recommended Fix Priority

| Priority | Fix                                            | Impact                         | Effort   |
| -------- | ---------------------------------------------- | ------------------------------ | -------- |
| P0       | Use `calculateCost()` in campaign-functions.ts | Correct cost reporting         | 10 min   |
| P0       | Add `claude-opus-4-6` to pricing table         | Complete pricing coverage      | 2 min    |
| P1       | Include system agent costs in campaign total   | Accurate total cost            | 15 min   |
| P1       | Add budget-exceeded to permanent error list    | Stop useless retries           | 5 min    |
| P1       | Content truncation for Firecrawl scrapes       | 60-80% token savings           | 30 min   |
| P2       | Task-specific tool loading                     | 97% base overhead reduction    | 2 hours  |
| P2       | Campaign reviewer model downgrade              | 80% reviewer cost savings      | 10 min   |
| P2       | Task objective validation                      | Accurate completion status     | 1 hour   |
| P2       | Inter-mission data transfer                    | Enable multi-mission campaigns | 2 hours  |
| P3       | Multi-agent task distribution                  | Budget isolation / resilience  | 2 hours  |
| P3       | Campaign-level budget enforcement              | Cost guardrails                | 1 hour   |
| P3       | Persist intermediate scraping results          | Human review + reuse           | 2 hours  |
| P3       | Campaign results UI (human view)               | Discoverability                | 4+ hours |
