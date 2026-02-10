# V&V Test Plan -- Critical Review & Enhancement Recommendations

**Date**: 2026-02-08
**Reviewer**: AI Architect
**Subject**: `mcp_v&v_test_plan_fef5607c.plan.md`

---

## Executive Summary

The existing plan is structurally sound -- it covers CRUD, execution, analytics, governance, RAG, workflows, networks, learning, and audit. However, it has **five critical weaknesses** that will undermine the plan's ability to deliver the confidence you need:

1. **Sample size is too small** -- 3 runs per agent tells you almost nothing statistically. You need 20-50+ runs per entity to generate meaningful distributions for latency, cost, eval scores, and failure rates.
2. **No feedback loops** -- The plan is a linear waterfall. When Phase 7 breaks, there's no defined protocol for how you triage, fix, re-validate, and decide when to advance again.
3. **Learning system is tested too late and too lightly** -- Learning requires a _corpus_ of runs with evaluations and feedback. Testing it after a handful of runs in Phase 8 guarantees it has nothing meaningful to learn from.
4. **No stability/soak testing** -- A single successful run proves the happy path works once. It doesn't prove the system is reliable. You need repeated runs over time to catch intermittent failures, memory leaks, rate limits, and state corruption.
5. **Missing entire categories of testing** -- Concurrency, error handling, edge cases, data consistency, idempotency, and regression validation are absent.

Below is a detailed phase-by-phase enhancement with feedback loops, sample size requirements, and a list of things the current plan doesn't consider.

---

## Part 1: Structural Changes -- Phased Gates with Feedback Loops

### The Problem with the Current Structure

The current plan is **11 sequential phases executed once**. This is a deployment checklist, not a validation pipeline. Real V&V requires:

- **Gate criteria** -- explicit pass/fail thresholds that must be met before advancing
- **Feedback loops** -- when a gate fails, a defined protocol for diagnosing, fixing, and re-running
- **Iteration** -- the expectation that you will run phases multiple times as fixes land
- **Regression protection** -- later fixes must not break earlier phases

### Proposed Structure: 4 Tiers with Gates

Replace the flat 11-phase structure with 4 **Tiers**, each containing multiple phases. A Tier must fully pass before the next Tier begins. When a fix is applied to the codebase, **re-run from the beginning of the current Tier** (not from Phase 0 unless the fix touches foundational infrastructure).

```
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1: FOUNDATION (Phases 0-2)                                │
│  Gate: Infra healthy, MCP connected, Agent CRUD works           │
│  Re-run trigger: Any infra/config/schema change                 │
├─────────────────────────────────────────────────────────────────┤
│  TIER 2: EXECUTION & DATA GENERATION (Phases 3-6)               │
│  Gate: All agents produce valid output, analytics populated,    │
│        RAG pipeline functional, 20+ runs per agent              │
│  Re-run trigger: Any agent/tool/model change                    │
├─────────────────────────────────────────────────────────────────┤
│  TIER 3: GOVERNANCE & ORCHESTRATION (Phases 7-9)                │
│  Gate: Evals scoring, workflows/networks executing, triggers    │
│        firing, learning system processing signals               │
│  Re-run trigger: Any workflow/network/eval/learning change      │
├─────────────────────────────────────────────────────────────────┤
│  TIER 4: VALIDATION & SOAK (Phases 10-12)                       │
│  Gate: Stability over sustained load, learning proposals        │
│        generated, audit trail complete, no regressions          │
│  Re-run trigger: Any significant codebase change                │
└─────────────────────────────────────────────────────────────────┘
```

### Feedback Loop Protocol

When ANY check within a phase fails:

```
1. STOP advancing to the next phase
2. DOCUMENT the failure:
   - Which tool call failed or returned unexpected results
   - The exact error message or unexpected output
   - The expected vs actual behavior
3. DIAGNOSE:
   - Is this a platform bug (codebase fix needed)?
   - Is this a configuration issue (env var, MCP server, DB)?
   - Is this a test design issue (wrong expectations)?
4. FIX the root cause in the codebase
5. RE-RUN from the beginning of the current TIER
   - Not just the failed phase -- earlier phases in the tier
     could have been affected by the same root cause
6. Only advance to the next Tier once ALL phases in the
   current Tier pass cleanly in a single continuous run
```

### Decision Log

Maintain a running decision log during execution:

```markdown
| Iteration | Tier | Phase | Status | Issue                          | Root Cause                      | Fix Applied           | Re-run From  |
| --------- | ---- | ----- | ------ | ------------------------------ | ------------------------------- | --------------------- | ------------ |
| 1         | 1    | 0     | PASS   | --                             | --                              | --                    | --           |
| 1         | 1    | 1     | FAIL   | MCP config read returned empty | API key expired                 | Rotated key in .env   | Tier 1 start |
| 2         | 1    | 0     | PASS   | --                             | --                              | --                    | --           |
| 2         | 1    | 1     | PASS   | --                             | --                              | --                    | --           |
| 2         | 1    | 2     | PASS   | --                             | --                              | --                    | --           |
| 2         | 2    | 3     | FAIL   | Agent run returned 500         | Tool registry missing calc tool | Fixed registry export | Tier 2 start |
| ...       |      |       |        |                                |                                 |                       |              |
```

---

## Part 2: Sample Size & Data Generation Requirements

### The Problem

The current plan runs each agent **3 times** (Phase 3a: 3 runs, Phase 3b: 3 turns, Phase 3c: 1 run each). This is not enough to:

- Detect intermittent failures (which may occur 1 in 10 runs)
- Generate meaningful evaluation score distributions
- Provide the learning system with enough signal to produce proposals
- Validate cost tracking accuracy across a population
- Stress test rate limits and concurrency

### Required Sample Sizes

| Entity             | Current Plan | Recommended Minimum                                   | Purpose                                        |
| ------------------ | ------------ | ----------------------------------------------------- | ---------------------------------------------- |
| V&V Test Agent     | 3 runs       | **30 runs** (10 basic, 10 tool-use, 10 calculator)    | Statistical reliability, eval distribution     |
| Assistant Agent    | 3 turns      | **25 conversations** (5 turns each = 125 total turns) | Memory stress test, working memory validation  |
| Structured Agent   | 1 run        | **20 runs** with varied inputs                        | JSON schema compliance rate                    |
| Research Agent     | 1 run        | **15 runs** with diverse topics                       | Tool call reliability, output quality variance |
| Evaluated Agent    | 1 run        | **20 runs**                                           | Eval score distribution, scorer reliability    |
| V&V Workflow       | 1 run        | **15 executions** with varied inputs                  | Step chaining reliability                      |
| V&V Network        | 1 run        | **15 executions** with varied messages                | Routing accuracy                               |
| Existing Workflows | 1 each       | **10 each**                                           | Regression baseline                            |
| Existing Networks  | 1 each       | **10 each**                                           | Routing consistency                            |
| Simulations        | 5 runs       | **50 runs** (10 per theme, 5 themes)                  | Learning system fuel                           |

**Total estimated runs: ~350-400** (vs. current ~20)

### Input Diversity

Don't just run the same prompt 30 times. Create **input banks** with categories:

```
V&V Test Agent Input Bank (30 prompts):
├── Basic (10): Simple questions varying in domain and complexity
├── Tool-Use-DateTime (10): Varied time/date questions, timezone edge cases
├── Tool-Use-Calculator (10): Simple math, percentages, multi-step calculations
│
Assistant Agent Conversation Bank (25 conversations):
├── Identity recall (5): Name, role, preference storage and recall
├── Context switching (5): Topic changes mid-conversation
├── Long context (5): 8+ turn conversations
├── Working memory (5): Store and retrieve multiple facts
├── Edge cases (5): Empty messages, very long messages, special characters
│
Structured Agent Input Bank (20 prompts):
├── Lists (5): "List N things about X"
├── Comparisons (5): "Compare X and Y"
├── Classifications (5): "Categorize these items"
├── Extraction (5): "Extract key facts from this text"
│
Research Agent Input Bank (15 prompts):
├── Current events (5): Topics requiring web search
├── Technical topics (5): Programming, AI, infrastructure
├── Ambiguous queries (5): Vague questions requiring clarification
```

### Data Quality Checkpoints

After each batch of runs, verify the **data pipeline** is healthy:

```
For EVERY batch of N runs, verify:
  ✓ agent_runs_list returns exactly N new runs
  ✓ Each run has status, outputText, durationMs, costUsd
  ✓ agent_run_trace for each run shows complete step chain
  ✓ agent_overview run count incremented by N
  ✓ agent_costs total increased proportionally
  ✓ agent_analytics reflects new activity
  ✓ live_runs shows all N runs with correct filters
  ✓ live_metrics aggregates are consistent
```

---

## Part 3: Revised Phase Breakdown

### TIER 1: FOUNDATION

**Phases 0-2 remain largely the same** but add explicit gate criteria.

#### Phase 0: Environment Baseline

_No changes to scope. Add gate:_

**Gate Criteria**:

- [ ] `org_list` returns >= 1 org
- [ ] `org_workspaces_list` returns >= 1 workspace
- [ ] `live_stats` returns without error
- [ ] Response times < 5s for all calls

#### Phase 1: Integration & MCP Configuration

_No changes to scope. Add gate:_

**Gate Criteria**:

- [ ] `integration_mcp_config(read)` returns non-empty config with all expected servers
- [ ] `integration_providers_list` returns providers with connection status
- [ ] `integration_connections_list` returns active connections
- [ ] `integration_mcp_config(plan)` returns valid impact analysis

#### Phase 2: Agent CRUD & Configuration

_No changes to scope. Add gate:_

**Gate Criteria**:

- [ ] `agent_list` returns expected count of system agents
- [ ] `agent_read` returns full agent definition with tools, memory config
- [ ] `agent_create` succeeds and agent appears in list
- [ ] `agent_update` creates new version
- [ ] `agent_versions_list` shows version history
- [ ] All responses return in < 3s

**TIER 1 GATE**: All Phase 0-2 criteria met. Proceed to Tier 2.

---

### TIER 2: EXECUTION & DATA GENERATION

This is the most critical tier. The goal is to **generate a large corpus of runs** with rich data across all agent types, plus validate RAG.

#### Phase 3: Agent Execution -- High Volume

Replace the current Phase 3a-3d with a **batch execution approach**.

##### Phase 3a: V&V Test Agent -- 30 Runs

Run 3 batches of 10 prompts each (basic, datetime tool, calculator tool).

**Execution Protocol**:

1. Record baseline: `agent_runs_list` count, `agent_overview` stats
2. Execute 10 basic prompts sequentially
3. **Checkpoint**: Verify 10 runs appeared, all completed, all have traces
4. Execute 10 datetime tool prompts
5. **Checkpoint**: Verify 20 cumulative runs, tool calls visible in traces
6. Execute 10 calculator tool prompts
7. **Checkpoint**: Verify 30 cumulative runs

**Post-Batch Verification**:

- `agent_runs_list`: 30 runs, all status "completed"
- `agent_run_trace` on 5 random runs: Complete step chains, tool calls present where expected
- `agent_overview`: Stats reflect 30 runs
- `agent_analytics`: Analytics populated
- `agent_costs`: Cost > $0, proportional to token usage
- Calculate: mean/min/max latency, mean/min/max cost per run
- Failure rate: 0% target, < 5% acceptable for gate

**Gate Criteria for 3a**:

- [ ] 30/30 runs completed successfully
- [ ] Tool call success rate >= 95% (at least 19/20 tool runs used tools)
- [ ] All 30 runs have traces with complete step chains
- [ ] Cost tracking is non-zero and internally consistent
- [ ] Analytics/overview numbers match run count

##### Phase 3b: Assistant Agent -- 25 Multi-Turn Conversations (125 turns)

Run 5 categories of conversations, 5 conversations each, ~5 turns per conversation.

**Execution Protocol**:

1. For each conversation, use a fresh thread/resource context
2. Execute turns sequentially within each conversation
3. After each conversation, verify memory recall in the final turn
4. **Checkpoint every 5 conversations**: Verify runs, traces, memory behavior

**Post-Batch Verification**:

- Memory recall accuracy: In conversations testing recall, did the agent correctly remember stored facts?
- Working memory updates: Did `agent_run_trace` show working memory being written?
- Multi-turn coherence: Did responses stay contextually relevant across turns?
- Calculate: conversation completion rate, memory recall accuracy rate

**Gate Criteria for 3b**:

- [ ] 25/25 conversations completed (all turns responded)
- [ ] Memory recall accuracy >= 80% (agent remembers facts from earlier turns)
- [ ] No conversation produced an error/empty response
- [ ] Traces show memory operations (read/write) where expected

##### Phase 3c: Specialized Agents -- 55 Runs Total

| Agent      | Runs | Input Diversity            |
| ---------- | ---- | -------------------------- |
| Structured | 20   | 4 categories x 5 prompts   |
| Research   | 15   | 3 categories x 5 prompts   |
| Evaluated  | 20   | Varied technical questions |

**Execution Protocol**:

1. Run each agent's batch sequentially (all structured, then all research, then all evaluated)
2. **Checkpoint after each agent's batch**: Verify runs, outputs, traces
3. For Structured agent: validate JSON output parsing on every response
4. For Research agent: verify tool calls appeared in trace
5. For Evaluated agent: verify evaluation scores were generated

**Gate Criteria for 3c**:

- [ ] Structured: >= 18/20 runs produced valid JSON (90%+ compliance)
- [ ] Research: >= 13/15 runs showed tool usage in traces
- [ ] Evaluated: All 20 runs completed, evaluations triggered

##### Phase 3d: Analytics Cross-Verification (Aggregate)

After all 3a-3c batches complete (~210 runs total), do a comprehensive cross-check.

**Gate Criteria for 3d**:

- [ ] `live_runs` total count matches sum of all executed runs
- [ ] `live_metrics` aggregates are internally consistent
- [ ] Per-agent `agent_overview` run counts match expected per-agent totals
- [ ] Per-agent `agent_costs` are all > $0
- [ ] No runs in "failed" status (unless investigating a known issue)
- [ ] Filtering `live_runs` by agentId returns correct subsets for each agent

#### Phase 4: Quality & Governance (Using the 210-run corpus)

Now that there's a real corpus, quality tooling has meaningful data to work with.

##### Phase 4a: Evaluations -- Run on the Full Corpus

This is **critical**. Don't just evaluate a handful of runs.

**Execution Protocol**:

1. `agent_evaluations_run` on V&V test agent (all 30 runs)
2. `agent_evaluations_run` on assistant (sample of 20 runs from the 125 turns)
3. `agent_evaluations_run` on structured agent (all 20 runs)
4. `agent_evaluations_run` on evaluated agent (all 20 runs, should already have evals)
5. `agent_evaluations_list` for each agent -- verify scores exist

**Post-Evaluation Analysis**:

- Score distribution per agent: mean, median, min, max, stddev
- Identify any outlier runs (score < 0.3) -- investigate traces
- Compare scores across agents: do specialized agents score higher in their domain?

**Gate Criteria for 4a**:

- [ ] Evaluations completed without error for all target agents
- [ ] Score distributions are non-degenerate (not all zeros, not all ones)
- [ ] No agent has a mean score < 0.5 (indicates systemic quality issue)

##### Phase 4b: Feedback, Test Cases, Guardrails, Budgets

_Scope stays the same as current Phase 4._ Add:

- Submit feedback on **at least 10 runs** (mix of positive/negative/varied ratings)
- Create **at least 5 test cases** (not just 2)
- This volume matters for the learning system later

**Gate Criteria for 4b**:

- [ ] 10+ feedback entries submitted and retrievable
- [ ] 5+ test cases created with tags
- [ ] Guardrail policy readable and writable
- [ ] Budget policy readable and writable
- [ ] Guardrail events endpoint responds (even if empty)

#### Phase 5: Triggers, Schedules & RAG

_Combine current Phase 5 and Phase 6. No major changes needed, these are infrastructure validations._

**Gate Criteria for Phase 5**:

- [ ] Trigger CRUD lifecycle complete (create, read, test, execute, enable, disable, delete)
- [ ] At least 1 trigger execution produced a real agent run
- [ ] Schedule CRUD lifecycle complete
- [ ] RAG ingest, query (positive + negative), list, delete all work
- [ ] RAG relevance scores are sensible (relevant > 0.7, irrelevant < 0.5)

**TIER 2 GATE**: ~210+ agent runs generated, all analytics populated, evaluations scored, feedback submitted, RAG functional. Proceed to Tier 3.

---

### TIER 3: GOVERNANCE & ORCHESTRATION

#### Phase 6: Workflow Execution -- High Volume

##### Phase 6a: V&V Test Workflow -- 15 Executions

**Execution Protocol**:

1. Generate, validate, create workflow
2. Execute with 15 varied topic inputs
3. **Checkpoint every 5 runs**: Verify step chains, outputs, metrics
4. For at least 3 runs, inspect `workflow_get_run` in detail (step-by-step output verification)

**Gate Criteria**:

- [ ] Workflow generates and validates successfully
- [ ] > = 14/15 executions complete all steps (>= 93%)
- [ ] Step outputs chain correctly (step 1 output feeds step 2)
- [ ] `workflow_metrics` reflects all 15 runs
- [ ] `workflow_stats` includes this workflow

##### Phase 6b: V&V Test Network -- 15 Executions

**Execution Protocol**:

1. Generate, validate, create network
2. Execute with 15 varied messages
3. **Checkpoint every 5 runs**: Verify routing, agent participation, outputs
4. For at least 3 runs, inspect `network_get_run` routing details

**Gate Criteria**:

- [ ] Network generates and validates successfully
- [ ] > = 14/15 executions route correctly between agents
- [ ] Each run shows which agents handled which parts
- [ ] `network_metrics` reflects all 15 runs
- [ ] Final outputs are coherent and complete

##### Phase 6c: Existing Workflows & Networks -- 10 Each

Run existing/seeded workflows and networks 10 times each.

**Special attention**:

- Human approval workflow: Test suspend/resume at least 3 times
- Trip planner network: Verify multi-agent routing with varied destinations

**Gate Criteria**:

- [ ] Each existing workflow/network completes >= 9/10 runs
- [ ] Human approval suspend/resume works reliably
- [ ] Network routing engages the correct agent specializations

#### Phase 7: Triggers (Expanded)

_Move trigger execution testing here so it interacts with the larger corpus._

##### Phase 7a: Trigger-Driven Agent Runs -- 10 Executions

Fire the webhook trigger 10 times with varied payloads.

**Gate Criteria**:

- [ ] All 10 trigger executions produce agent runs
- [ ] `trigger_events_list` shows all 10 events
- [ ] Runs are attributed to the correct trigger source

#### Phase 8: Learning System (with Real Data)

This is where the plan's most significant gap is. The learning system needs:

- A large corpus of runs (you now have 300+)
- Evaluation scores on those runs
- Feedback (positive and negative)
- Enough signal variance to detect patterns

##### Phase 8a: Pre-Learning Validation

Before starting learning, verify the inputs are sufficient:

1. `agent_evaluations_list` for assistant -- confirm 20+ evaluated runs exist
2. `agent_feedback_list` for assistant -- confirm 10+ feedback entries
3. `agent_learning_policy` -- understand the thresholds

**If the learning policy requires N runs and you have < N, generate more runs first.**

##### Phase 8b: Learning Session

1. `agent_learning_start` with clear trigger reason
2. Poll `agent_learning_session_get` every 30 seconds until status changes
3. **If session fails**: Investigate why. Common issues:
    - Not enough runs (need more data generation)
    - Inngest not processing events (check dev server)
    - Signal extraction finds no variance (all runs too similar)
4. If session produces proposals: Review them via `agent_learning_session_get`
5. Check `agent_learning_metrics` for KPIs
6. Check `agent_learning_experiments` for any A/B tests

**Gate Criteria for 8b**:

- [ ] Learning session starts without error
- [ ] Session progresses through stages (signal extraction -> proposal generation)
- [ ] At least 1 proposal or insight is generated
- [ ] Learning metrics endpoint returns populated data
- [ ] OR -- if learning legitimately finds no issues, that itself is documented

##### Phase 8c: Simulations -- 50 Runs Across 5 Themes

Run simulations to generate additional diverse data AND to test the simulation infrastructure itself.

| Theme                         | Count | Agent     |
| ----------------------------- | ----- | --------- |
| Customer support for SaaS     | 10    | assistant |
| Technical troubleshooting     | 10    | assistant |
| Product feature questions     | 10    | assistant |
| Onboarding new users          | 10    | assistant |
| Billing and pricing inquiries | 10    | assistant |

**Execution Protocol**:

1. Start simulation for theme 1, wait for completion
2. Verify runs generated, source = "simulation"
3. Run evaluations on simulation runs
4. Repeat for themes 2-5
5. After all 50: Check learning metrics again -- has the additional data changed anything?

**Gate Criteria for 8c**:

- [ ] All 50 simulation runs completed
- [ ] Each run has real output and trace
- [ ] Runs correctly attributed as "simulation" source
- [ ] Evaluations ran successfully on simulation runs
- [ ] `agent_overview` run count increased by 50

##### Phase 8d: Post-Learning Re-Evaluation

After learning + simulations:

1. `agent_learning_metrics` -- Compare to pre-learning baseline
2. `agent_learning_experiments` -- Any experiments running?
3. If a proposal exists, consider `agent_learning_proposal_approve` or `agent_learning_proposal_reject`
4. Re-run 10 assistant conversations to see if quality changed

**TIER 3 GATE**: Workflows and networks executing reliably at volume, learning system processing signals, simulations generating data, evaluation pipeline healthy. Proceed to Tier 4.

---

### TIER 4: VALIDATION & SOAK

#### Phase 9: Audit & Observability Cross-Check

_Same scope as current Phase 9, but now validating against 400+ runs instead of 20._

**Enhanced Checks**:

- `audit_logs_list` should show **all CRUD operations** from the entire test session
- `live_runs` count should match your running tally exactly
- `live_metrics` should be internally consistent with per-agent totals
- Check for orphaned data: runs without traces, evaluations without runs

**Gate Criteria**:

- [ ] Audit log entries exist for every create/update/delete operation
- [ ] `live_runs` total matches your execution tally (within 5% margin for timing)
- [ ] No orphaned data detected
- [ ] Goals CRUD works

#### Phase 10: Stability & Soak Testing

**This phase is entirely new. The current plan has nothing like it.**

##### Phase 10a: Burst Load

Execute 20 agent runs as fast as possible (no delays between calls) for a single agent.

**What you're testing**:

- Rate limiting behavior
- Connection pool exhaustion
- Request queuing/backpressure
- Error recovery

**Gate Criteria**:

- [ ] > = 18/20 runs complete successfully under burst load
- [ ] No HTTP 429 or 503 errors (or if they occur, they're handled gracefully)
- [ ] System recovers and returns to normal after burst

##### Phase 10b: Cross-Entity Interleaving

Execute agent runs, workflow runs, and network runs in rapid alternation (not sequentially by type).

**What you're testing**:

- Resource contention between different execution paths
- Database connection sharing
- MCP client multiplexing

##### Phase 10c: Error Recovery

Deliberately test error paths:

1. Execute an agent with an invalid tool reference -- does it fail gracefully?
2. Execute a workflow with missing input fields -- does it return a clear error?
3. Execute a network with a message that no agent should handle -- what happens?
4. Submit feedback for a non-existent run ID -- does it return 404 or error?

**Gate Criteria**:

- [ ] All error cases return meaningful error messages (not 500s)
- [ ] System remains healthy after error cases (subsequent valid calls succeed)

#### Phase 11: Regression Verification

Re-run a representative subset of tests from Tiers 1-3 to confirm nothing broke during Tier 4 stress testing.

**Run**:

- 5 V&V test agent prompts
- 3 assistant conversations
- 3 workflow executions
- 3 network executions
- 1 RAG ingest + query cycle
- 1 trigger execution

**Gate Criteria**:

- [ ] All regression runs pass with same behavior as original runs
- [ ] No degradation in latency or cost compared to Tier 2 baselines

#### Phase 12: Cleanup

_Same as current Phase 10._

**TIER 4 GATE**: System stable under load, errors handled gracefully, no regressions. V&V complete.

---

## Part 4: What You're Not Considering

### 1. Idempotency & State Corruption

**The risk**: Running the same operation twice produces unexpected side effects. For example:

- Creating an agent with the same slug twice -- does it error or silently overwrite?
- Submitting the same feedback twice for the same run -- duplicated or deduplicated?
- Deleting an already-deleted agent -- graceful 404 or crash?

**Recommendation**: Add idempotency checks to Phase 2 (try creating the same agent twice) and Phase 4 (submit duplicate feedback).

### 2. Data Consistency Across APIs

**The risk**: Different APIs report different numbers. `agent_overview` says 30 runs, but `agent_runs_list` returns 28. `agent_costs` says $1.50 but summing individual run costs gives $1.42.

**Recommendation**: After every batch, cross-check at least 3 data sources against each other. Build a reconciliation step into every checkpoint.

### 3. Concurrency & Race Conditions

**The risk**: Two runs hitting the same agent simultaneously could cause state corruption, especially with memory-enabled agents sharing working memory.

**Recommendation**: Phase 10a touches on this, but explicitly test memory-enabled agents with concurrent conversations to check for cross-contamination.

### 4. MCP Tool Availability & Degradation

**The risk**: External MCP servers (HubSpot, Jira, Slack, etc.) may be down or slow. An agent configured with MCP tools that are unavailable will behave differently than expected.

**Recommendation**: Add a Phase 1 step that explicitly calls a tool from each MCP server (not just checks the config). If a server is down, document it and exclude agents that depend on it from testing.

### 5. Token & Cost Budget Monitoring

**The risk**: 400+ runs with GPT-4o and Claude could cost $50-200+. Without monitoring, you could blow through API budgets.

**Recommendation**:

- Set budget policies on test agents BEFORE running batches (Phase 2c, not Phase 4e)
- Monitor `agent_costs` after every batch of 10 runs
- Use `gpt-4o-mini` for high-volume test agents, reserve expensive models for targeted tests
- Set a hard cost ceiling for the entire V&V session (e.g., $100) and check against it at every checkpoint

### 6. Time-Based Data Validation

**The risk**: Analytics and metrics that depend on time windows (e.g., "runs in the last 24 hours") may not capture V&V runs if the session spans midnight or if timezone handling is buggy.

**Recommendation**: Record the V&V session start time (ISO timestamp) and use `from`/`to` filters in all analytics calls to scope queries precisely.

### 7. Version Rollback Testing

**The risk**: You test `agent_update` and `agent_versions_list`, but never test **rolling back** to a previous version. This is a critical production operation.

**Recommendation**: In Phase 2, after updating the agent, use `agent_update` with `restoreVersion` to roll back to version 1. Verify the agent's instructions revert. Then update again. This tests the version DAG, not just the append log.

### 8. Workflow Suspend/Resume Timing

**The risk**: The human approval workflow is tested once. But what about resuming after a long delay? What if the resume data is malformed?

**Recommendation**: Test resume with:

- Immediate resume (< 1s)
- Delayed resume (wait 60s before resuming)
- Malformed resume data (missing required fields)
- Resume on an already-completed run (should error gracefully)

### 9. Learning System Dependency on Inngest

**The risk**: The learning system depends on Inngest for async event processing. If the Inngest dev server isn't running, learning sessions will appear to start but never progress. The current plan doesn't validate Inngest connectivity before testing learning.

**Recommendation**: Add a pre-flight check at the start of Phase 8:

- Verify Inngest dev server is running (check port 8288)
- Send a test event and verify it's processed
- Only then proceed with learning session tests

### 10. No Baseline Performance Metrics

**The risk**: Without baseline metrics (latency, cost, eval scores) recorded before any changes, you can't measure improvement or detect regression.

**Recommendation**: At the end of Tier 2, record a **baseline metrics snapshot**:

- Per-agent: mean latency, mean cost, mean eval score, failure rate
- Store this in the decision log
- Compare against this baseline in Tier 4 regression testing

### 11. Designer Chat Validation is Superficial

**The risk**: `workflow_designer_chat` and `network_designer_chat` are tested by checking if they return "structurally valid patches." But are those patches actually _correct_? Can you apply them and re-validate?

**Recommendation**: After getting a designer patch:

1. Apply it via `workflow_update` / `network_update`
2. Re-validate the modified definition
3. Execute the modified workflow/network
4. Verify the new step/agent actually participates

### 12. No Documentation of Expected vs. Actual Outputs

**The risk**: "Verify the output contains bullet points" is subjective. Without recording actual outputs, you can't do post-hoc analysis or use the data for future regression testing.

**Recommendation**: For every batch of runs, record a summary table:

```
| Run ID | Agent | Input (truncated) | Output (truncated) | Latency | Cost | Eval Score | Pass? |
```

This becomes your regression test dataset.

---

## Part 5: Revised Execution Summary

```
TIER 1: FOUNDATION
  Phase 0:  Environment Baseline .............. ~5 tool calls
  Phase 1:  Integration & MCP Config .......... ~8 tool calls (add tool smoke tests)
  Phase 2:  Agent CRUD & Config + Rollback .... ~15 tool calls
                                          Tier 1: ~28 tool calls

TIER 2: EXECUTION & DATA GENERATION
  Phase 3a: V&V Test Agent (30 runs) .......... ~40 tool calls
  Phase 3b: Assistant Agent (25 convos) ....... ~60 tool calls
  Phase 3c: Specialized Agents (55 runs) ...... ~70 tool calls
  Phase 3d: Analytics Cross-Verification ...... ~15 tool calls
  Phase 4a: Evaluations (full corpus) ......... ~20 tool calls
  Phase 4b: Feedback, Test Cases, Gov ......... ~25 tool calls
  Phase 5:  Triggers, Schedules, RAG .......... ~25 tool calls
                                          Tier 2: ~255 tool calls

TIER 3: GOVERNANCE & ORCHESTRATION
  Phase 6a: V&V Workflow (15 runs) ............ ~25 tool calls
  Phase 6b: V&V Network (15 runs) ............. ~25 tool calls
  Phase 6c: Existing WF/Net (10 each) ......... ~30 tool calls
  Phase 7:  Trigger Execution (10 runs) ....... ~15 tool calls
  Phase 8a: Pre-Learning Validation ........... ~5 tool calls
  Phase 8b: Learning Session .................. ~10 tool calls
  Phase 8c: Simulations (50 runs) ............. ~20 tool calls
  Phase 8d: Post-Learning Re-Eval ............. ~15 tool calls
                                          Tier 3: ~145 tool calls

TIER 4: VALIDATION & SOAK
  Phase 9:  Audit & Observability ............. ~15 tool calls
  Phase 10: Stability & Soak Testing .......... ~30 tool calls
  Phase 11: Regression Verification ........... ~25 tool calls
  Phase 12: Cleanup ........................... ~10 tool calls
                                          Tier 4: ~80 tool calls

                                    GRAND TOTAL: ~508 tool calls
                                    ESTIMATED RUNS: 400-450
                                    ESTIMATED COST: $50-150 (model dependent)
                                    ESTIMATED TIME: 4-8 hours (with fixes)
```

### Iteration Multiplier

The above is for a **single clean pass**. Realistically, expect 2-3 iterations through Tiers 2-3 as issues are discovered and fixed. Budget for:

- **Optimistic**: 1.5x (750 tool calls, $75-225, 6-12 hours)
- **Realistic**: 2.5x (1,250 tool calls, $125-375, 10-20 hours)
- **Pessimistic**: 4x (2,000 tool calls, $200-600, 16-32 hours)

---

## Part 6: Checklist of Things to Prepare Before Starting

- [ ] Inngest dev server running on port 8288
- [ ] Database accessible and seeded (`bun run db:seed`)
- [ ] All MCP API keys valid and not expired
- [ ] Set a cost ceiling for the V&V session
- [ ] Prepare input prompt banks (don't make them up on the fly)
- [ ] Create a decision log template (see Part 1)
- [ ] Create a results tracking spreadsheet/table
- [ ] `bun run build` passes cleanly
- [ ] `bun run type-check` passes cleanly
- [ ] Record V&V session start timestamp for time-filtered queries
- [ ] Commit current codebase state (clean git baseline for diffing fixes)
