# Campaign Comparison: v1 vs v2 vs v3

**Campaign**: Competitive Intelligence Report -- AI Agent Frameworks
**Date**: 2026-02-16

---

## Top-Line Results

| Metric                     | v1 (Original)         | v2 (First Fix Round) | v3 (All Fixes)                            |
| -------------------------- | --------------------- | -------------------- | ----------------------------------------- |
| **Status**                 | COMPLETE              | COMPLETE             | STALLED (Anthropic credits depleted)      |
| **Total Cost (reported)**  | $0.88                 | $31.92 (5x inflated) | $7.70 (correct pricing)                   |
| **Total Cost (actual)**    | $0.88                 | ~$16.25              | $7.70                                     |
| **Total Tokens**           | 49,612                | 2,093,263            | 1,959,328                                 |
| **Tasks total**            | 19                    | 9                    | 8                                         |
| **Tasks completed**        | 1 (5%)                | 4 (44%)              | 2 (25%)                                   |
| **Tasks failed**           | 11 (58%)              | 4 (44%)              | 5 (63%) -- 4 from billing, 1 from context |
| **Tasks truly successful** | 0                     | 2                    | 2                                         |
| **End state achieved**     | No                    | No                   | No (billing stopped it)                   |
| **Google Doc created**     | No                    | No (tool not found)  | Not reached                               |
| **System costs included**  | No                    | No                   | YES -- new fix working                    |
| **Cost formula correct**   | No (wrong for Sonnet) | No (5x overcharge)   | YES -- $2.43 + $3.01 correct              |

---

## What Improved in v3

### 1. Cost Reporting is Now Accurate

This is the single most impactful fix. In v2, the LangGraph scrape was reported as $10.98. In v3, the same operation is correctly reported as $2.43. The `calculateCost()` function is using the proper Sonnet pricing ($3/$15 per 1M tokens).

| Task             | v2 Reported | v2 Actual | v3 Reported | Fix Working?                  |
| ---------------- | ----------- | --------- | ----------- | ----------------------------- |
| LangGraph scrape | $10.98      | $2.20     | $2.43       | YES (within 10% of v2 actual) |
| AutoGen scrape   | $14.54      | $2.91     | $3.01       | YES                           |
| Campaign total   | $31.92      | $16.25    | $7.70       | YES (includes system costs)   |

### 2. System Agent Costs Are Included

In v2, the campaign total was $31.92 but system agents ($9.87) were invisible. In v3, the $7.70 total includes all system agent runs (analyst + planner at ~$2.06 combined). This is the `invokeCampaignAgent()` fix incrementing `campaign.totalCostUsd`.

### 3. Budget Enforcement Exists

The `maxCostUsd: $15` is now checked before each task executes. In v2, it was advisory only. In v3, the campaign-level budget check would have stopped execution at $15 (though the Anthropic billing issue hit first at $7.70).

### 4. Pipeline Structure Improved

v3's analyst decomposed into 8 tasks (vs 9 in v2, 19 in v1). The structure is cleaner:

- Mission 1 (seq 0): 3 parallel scraping tasks -- same as v2
- Mission 2 (seq 1): 4 analysis tasks -- more granular than v2's 3
- Mission 3 (seq 2): 1 report task -- simpler than v2's 2

### 5. Graceful Failure Handling

Mission 1 completed with 2/3 tasks despite CrewAI failing. Mission 2 tasks attempted to run (inter-mission data flow working) but failed due to billing. The system didn't cascade-kill everything from a single failure.

---

## What Still Needs Improvement

### 1. maxTokens Not Active (Dev Server Issue)

The `maxTokens: 16384` fix is in the code but the dev server's Inngest functions didn't hot-reload. CrewAI still failed with `159365 + 64000 > 200000`. After a server restart, this should be `159365 + 16384 = 175749 < 200000` -- which would succeed.

**Action**: Restart the dev server to pick up all Inngest function changes, then retest.

### 2. Planner Didn't Use the Web-Scraper Agent

The planner assigned all scraping tasks to `workspace-concierge` instead of the new `web-scraper-2` agent (Haiku, $1/$5). This means scraping still runs on Sonnet ($3/$15). The planner needs to:

- See the new agent in its `agent-list` query
- Understand that `web-scraper-2` is specifically designed for scraping tasks
- Prefer it over the general-purpose concierge for Firecrawl tasks

**Action**: Either rename the agent to exactly `web-scraper` (slug conflict existed) or update planner instructions to specifically look for specialized scraping agents.

### 3. Anthropic API Credits Depleted

The campaign stopped because the Anthropic account ran out of credits after ~$7.70 of spend. This is an external billing issue, not a system issue. The campaign's $15 budget was not exceeded.

**Action**: Refill Anthropic API credits. Consider adding the Anthropic billing status as a pre-flight check.

### 4. Tool Filter (toolHints) Not Used by Planner

The planner assigned tasks with empty `toolHints: []`. The tool filter optimization (reducing 183K tokens to ~20K) requires the planner to specify toolHints in coordinatingInstructions. The planner instructions were updated but may not be picked up by the running server.

**Action**: After server restart, verify planner includes toolHints.

---

## Cost Trajectory

| Version | Total Reported | Total Actual | Scraping Cost       | System Cost    | Accuracy     |
| ------- | -------------- | ------------ | ------------------- | -------------- | ------------ |
| v1      | $0.88          | $0.88        | $0.00 (nothing ran) | $0.88          | N/A          |
| v2      | $31.92         | $16.25       | $5.10               | $9.87 (hidden) | 50% wrong    |
| v3      | $7.70          | $7.70        | $5.44               | $2.06          | 100% correct |

The cost formula fix alone eliminated the 5x reporting error. Including system costs makes the total transparent. The actual scraping cost ($5.44 in v3 vs $5.10 in v2) is consistent -- Firecrawl scraping costs roughly $2-3 per website regardless of model fixes.

---

## Recommendations for v4 Retest

1. **Restart dev server** to pick up all Inngest function changes (maxTokens, toolHints, Firecrawl hints, objective-based completion, context summarization, rework loop)
2. **Refill Anthropic credits** before testing
3. **Resolve web-scraper agent slug** (created as `web-scraper-2` due to conflict) and ensure planner uses it
4. **Re-run the same campaign** to validate:
    - CrewAI scrape succeeds with maxTokens: 16384
    - Tool filter reduces token overhead
    - Firecrawl onlyMainContent hint is followed
    - Inter-mission data flows to analysis and report missions
    - Google Doc is created via google-drive-create-doc
    - Campaign completes with full AAR
5. **Expected v4 cost**: $3-5 total (Haiku scraping + Sonnet analysis + Sonnet review)
