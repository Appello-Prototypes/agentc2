# System Agent Runs — Detailed Audit

These are the 6 agent runs that orchestrate the campaign (analyze, plan, review, AAR) — separate from the 6 task execution runs.

---

## Run 1: Campaign Analyst

| Field             | Value                                                     |
| ----------------- | --------------------------------------------------------- |
| Run ID            | `cmlobo1c7020cv6eiom4hsunk`                               |
| Agent             | campaign-analyst (`cmlo221p1003cv60qpkpqh6on`)            |
| Model             | anthropic/claude-opus-4-6                                 |
| Duration          | 55.8 seconds                                              |
| Prompt Tokens     | 10,098                                                    |
| Completion Tokens | 3,010                                                     |
| Cost              | $0.377 (correct — Opus pricing matches hardcoded formula) |
| Tool Calls        | 2 (`campaign-get`, `campaign-write-missions`)             |

**Assessment**: Efficient. Decomposed the campaign into 3 missions with 9 tasks using only 13K total tokens. The mission/task structure was well-designed.

---

## Run 2: Campaign Planner

| Field             | Value                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| Run ID            | `cmlobpaa1021ev6eiv1hm4nls`                                                                        |
| Agent             | campaign-planner (`cmlo221td003dv60q6fcof1nw`)                                                     |
| Model             | anthropic/claude-opus-4-6                                                                          |
| Duration          | 140.7 seconds                                                                                      |
| Prompt Tokens     | 158,067                                                                                            |
| Completion Tokens | 5,811                                                                                              |
| Cost              | $2.807 (correct for Opus)                                                                          |
| Tool Calls        | 11 (`campaign-get`, `agent-list`, `tool-registry-list` x3, `skill-list` x5, `campaign-write-plan`) |

**Assessment**: The planner made 11 tool calls to understand agent capabilities — querying the agent list, tool registry (3x), and skills (5x). This is thorough but expensive. The 158K prompt tokens include all the tool call responses being accumulated in context.

**Issues Identified**:

1. 5 separate `skill-list` calls — likely paginating or filtering by category. Could be batched.
2. 3 separate `tool-registry-list` calls — similar pagination pattern.
3. All 9 tasks were assigned to `workspace-concierge` despite querying available agents. The planner's reasoning was "same agent for consistency" but this created a single point of failure.

---

## Run 3: Campaign Reviewer (Mission 1 AAR)

| Field             | Value                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------- |
| Run ID            | `cmloburhn0250v6ei4tbcqpvr`                                                             |
| Agent             | campaign-reviewer (`cmlo22201003fv60qc7l6rzdj`)                                         |
| Model             | anthropic/claude-opus-4-6                                                               |
| Duration          | 87.2 seconds                                                                            |
| Prompt Tokens     | 105,944                                                                                 |
| Completion Tokens | 3,392                                                                                   |
| Cost              | $1.844                                                                                  |
| Tool Calls        | 5 (`campaign-get`, `agent-evaluations-list`, `agent-runs-get` x2, `campaign-write-aar`) |

**Assessment**: Reviewed Mission 1 results in detail. Made 2 `agent-runs-get` calls to inspect individual run traces. The 106K prompt tokens include the full campaign state + run trace data.

---

## Run 4: Campaign Reviewer (Mission 2 AAR)

| Field             | Value                                    |
| ----------------- | ---------------------------------------- |
| Run ID            | `cmlobxuyt0264v6eigxygw4yf`              |
| Agent             | campaign-reviewer                        |
| Model             | anthropic/claude-opus-4-6                |
| Duration          | 70.2 seconds                             |
| Prompt Tokens     | 61,375                                   |
| Completion Tokens | 3,115                                    |
| Cost              | $1.154                                   |
| Tool Calls        | 2 (`campaign-get`, `campaign-write-aar`) |

**Assessment**: Faster review since all Mission 2 tasks had no runs to inspect. Only needed campaign state.

---

## Run 5: Campaign Reviewer (Mission 3 AAR)

| Field             | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Run ID            | `cmloc3wv20279v6eigb7ustvx`                                        |
| Agent             | campaign-reviewer                                                  |
| Model             | anthropic/claude-opus-4-6                                          |
| Duration          | 81.9 seconds                                                       |
| Prompt Tokens     | 84,185                                                             |
| Completion Tokens | 3,628                                                              |
| Cost              | $1.535                                                             |
| Tool Calls        | 3 (`campaign-get`, `agent-evaluations-list`, `campaign-write-aar`) |

---

## Run 6: Campaign Reviewer (Final AAR)

| Field             | Value                                                                               |
| ----------------- | ----------------------------------------------------------------------------------- |
| Run ID            | `cmloc5q71027nv6eicl6a2hmd`                                                         |
| Agent             | campaign-reviewer                                                                   |
| Model             | anthropic/claude-opus-4-6                                                           |
| Duration          | 141.6 seconds                                                                       |
| Prompt Tokens     | 113,017                                                                             |
| Completion Tokens | 6,033                                                                               |
| Cost              | $2.148                                                                              |
| Tool Calls        | 3 (`campaign-get`, `agent-evaluations-list`, `campaign-write-aar`)                  |
| Input             | 29,277 chars (largest input of any run — full campaign state with all mission AARs) |

**Assessment**: The final AAR run produced a comprehensive 17K-char AAR with detailed lessons learned and recommendations. This is the most valuable system output.

---

## System Agent Cost Summary

| Agent             | Runs  | Total Cost | Total Tokens |
| ----------------- | ----- | ---------- | ------------ |
| campaign-analyst  | 1     | $0.377     | 13,108       |
| campaign-planner  | 1     | $2.807     | 163,878      |
| campaign-reviewer | 4     | $6.681     | 376,689      |
| **Total**         | **6** | **$9.865** | **553,675**  |

**Key Finding**: System agents cost $9.87 but this is **not included in the campaign's `totalCostUsd`** ($31.92). The true total cost is $41.79 (recorded) or ~$16.25 (with correct pricing).

---

## Optimization Opportunities

### 1. Reviewer Model Downgrade

Campaign-reviewer runs 4 times per campaign (once per mission + final AAR), consuming $6.68 in Opus costs. Most of its work is structured reporting, not complex reasoning. **Switching reviewer to Claude Sonnet would reduce system costs by ~60%** ($6.68 → ~$1.34).

### 2. Reviewer Consolidation

Running 4 separate reviewer invocations (3 mission AARs + 1 campaign AAR) is expensive. Consider consolidating to a single comprehensive review at campaign end.

### 3. Planner Tool Call Batching

The planner made 11 tool calls including 5 `skill-list` and 3 `tool-registry-list` calls. These could be combined into fewer, more comprehensive queries.

### 4. Include System Costs in Campaign Total

The campaign's `totalCostUsd` should include ALL costs, not just task execution costs. This gives users accurate cost visibility.
