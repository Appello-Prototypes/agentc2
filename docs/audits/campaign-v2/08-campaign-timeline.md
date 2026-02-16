# Campaign Event Timeline

**Campaign**: Competitive Intelligence Report — AI Agent Frameworks (v2)
**Campaign ID**: `cmlobo02g0206v6eios1fqtxu`
**Total Duration**: 16 minutes 9 seconds (22:33:43 → 22:49:52 UTC)

---

## Phase 1: Creation and Analysis (0:00 - 0:58)

| Time         | Event                            | Detail                                         |
| ------------ | -------------------------------- | ---------------------------------------------- |
| 22:33:43.001 | Campaign created                 | Status: PLANNING                               |
| 22:33:43.087 | `created` log                    | Campaign record saved                          |
| 22:33:43.257 | `campaign/analyze` Inngest event | Triggered automatically                        |
| 22:33:43.390 | `analyzing`                      | campaign-analyst agent invoked                 |
| 22:34:40.648 | `analysis` complete              | Run `cmlobo1c7020cv6eiom4hsunk` — 55.8s, $0.38 |
| 22:34:41.093 | `analysis_validated`             | 3 missions, 9 tasks created                    |
| 22:34:41.352 | `campaign/plan` event            | Planner triggered                              |

**Phase 1 Duration**: 58 seconds
**Phase 1 Cost**: $0.38

---

## Phase 2: Planning (0:58 - 3:20)

| Time         | Event                | Detail                                          |
| ------------ | -------------------- | ----------------------------------------------- |
| 22:34:41     | Planner starts       | 11 tool calls to analyze capabilities           |
| 22:37:03.807 | `planning` complete  | Run `cmlobpaa1021ev6eiv1hm4nls` — 140.7s, $2.81 |
| 22:37:04.124 | `planning_validated` | Execution plan written                          |
| 22:37:05.251 | Status → EXECUTING   | Campaign `startedAt` set                        |

**Phase 2 Duration**: 2 minutes 22 seconds
**Phase 2 Cost**: $2.81

---

## Phase 3: Mission 1 Execution (3:20 - 5:12)

| Time         | Event             | Detail                                  |
| ------------ | ----------------- | --------------------------------------- |
| 22:37:05.723 | `executing`       | Campaign execution started              |
| 22:37:06.735 | `mission_started` | Mission 1 started — 4 tasks in parallel |
| 22:38:45.144 | `task_complete`   | LangGraph scrape done — 86.3s           |
| 22:38:54.236 | `task_complete`   | AutoGen scrape done — 95.2s             |
| 22:38:54.828 | `task_failed`     | GitHub search failed — tool not found   |
| 22:38:55.002 | `task_failed`     | CrewAI scrape failed — context overflow |
| 22:38:55.662 | `mission_partial` | Mission 1: 2 completed, 2 failed        |

**Phase 3 Duration**: ~1 minute 50 seconds
**Phase 3 Task Cost**: $25.52 (recorded) / ~$5.10 (actual)

---

## Phase 4: Mission 1 Review (5:12 - 6:42)

| Time         | Event           | Detail                                 |
| ------------ | --------------- | -------------------------------------- |
| 22:38:56     | Reviewer starts | campaign-reviewer inspecting Mission 1 |
| 22:40:25.867 | `mission-aar`   | Review complete — 87.2s, $1.84         |

**Phase 4 Duration**: ~1 minute 30 seconds
**Phase 4 Cost**: $1.84

---

## Phase 5: Mission 2 Execution (6:42 - 7:47)

| Time         | Event             | Detail                                          |
| ------------ | ----------------- | ----------------------------------------------- |
| 22:40:27.460 | `mission_started` | Mission 2 started — 3 tasks                     |
| 22:41:02.920 | `task_failed`     | Build profiles — budget exceeded (6 retries)    |
| 22:41:20.383 | `task_failed`     | Synthesize matrix (ESSENTIAL) — budget exceeded |
| 22:41:21.474 | `task_skipped`    | Write exec summary — skipped (essential failed) |

**Phase 5 Duration**: ~55 seconds
**Phase 5 Task Cost**: $0.00 (all blocked by budget)

---

## Phase 6: Mission 2 Review (7:47 - 8:50)

| Time         | Event           | Detail                         |
| ------------ | --------------- | ------------------------------ |
| 22:41:22     | Reviewer starts | Reviewing Mission 2 results    |
| 22:42:33.351 | `mission-aar`   | Review complete — 70.2s, $1.15 |

**Phase 6 Duration**: ~1 minute 3 seconds
**Phase 6 Cost**: $1.15

---

## Phase 7: Mission 3 Execution (8:50 - 12:20)

| Time         | Event             | Detail                                             |
| ------------ | ----------------- | -------------------------------------------------- |
| 22:42:34.853 | `mission_started` | Mission 3 started — 2 tasks                        |
| 22:45:32.619 | `task_complete`   | Create Google Doc — 39.9s (no doc created)         |
| 22:46:03.509 | `task_complete`   | Return link — 29.1s (created platform doc instead) |

**Phase 7 Duration**: ~3 minutes 30 seconds
**Phase 7 Task Cost**: $6.40 (recorded) / ~$1.28 (actual)

---

## Phase 8: Mission 3 Review + Final AAR (12:20 - 16:09)

| Time         | Event           | Detail                                   |
| ------------ | --------------- | ---------------------------------------- |
| 22:46:04     | Reviewer starts | Reviewing Mission 3                      |
| 22:47:27.480 | `mission-aar`   | Mission 3 review complete — 81.9s, $1.54 |
| 22:47:28     | AAR starts      | Final campaign AAR                       |
| 22:49:51.777 | `campaign-aar`  | Final AAR complete — 141.6s, $2.15       |
| 22:49:52.043 | `complete`      | Campaign COMPLETE                        |

**Phase 8 Duration**: ~3 minutes 49 seconds
**Phase 8 Cost**: $3.69

---

## Log Anomaly: Duplicate Error Entries

The campaign logs contain **duplicate error entries** for failed tasks:

- "Scrape CrewAI website" failure logged **6 times**
- "Search GitHub" failure logged **5 times**
- "Build profiles" budget error logged **6 times**
- "Synthesize matrix" budget error logged **4 times**

These duplicates come from the retry logic (Fix 2C) logging each retry attempt. For permanent errors (context overflow, budget exceeded), this creates unnecessary noise.

**Fix**: Only log the error on the final failure, not on each retry attempt. Or distinguish between "retry attempt" and "final failure" log events.
