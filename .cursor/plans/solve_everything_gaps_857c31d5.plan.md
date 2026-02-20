---
name: Solve Everything Gaps
overview: Revised gap analysis after reviewing the full 137-tool MCP inventory and V&V framework. AgentC2 already implements ~85% of the Industrial Intelligence Stack. This plan focuses on the true remaining gaps and the narrative/packaging needed to make the platform the obvious podcast interview.
todos:
    - id: rocs-metric
      content: "P0: Add RoCS (Return on Cognitive Spend) as a first-class metric -- link agent costs to goal outcomes"
      status: pending
    - id: maturation-levels
      content: "P0: Add L0-L5 maturation level field to AgentSkill junction + progression tracking canvas"
      status: pending
    - id: model-router
      content: "P0: Dynamic model router in AgentResolver -- route by task complexity, budget awareness, confidence-based down-shifting"
      status: pending
    - id: governance-canvas
      content: "P1: Create a Governance Canvas that aggregates budgets, guardrails, learning policies, audit logs, and approval status into one view"
      status: pending
    - id: longitudinal-benchmarks
      content: "P1: Time-series scoring -- store eval scores over time per agent per skill, surface trends in agent analytics"
      status: pending
    - id: red-team-simulation
      content: "P1: Add adversarial prompt themes to simulation system (prompt injection, boundary testing, manipulation)"
      status: pending
    - id: demo-narrative
      content: "P0: Build end-to-end demo script + canvas that shows the full Industrial Intelligence Stack loop live"
      status: pending
isProject: false
---

# AgentC2 vs. the Industrial Intelligence Stack -- Revised Gap Analysis

## Context

The "Solve Everything" paper describes a nine-layer **Industrial Intelligence Stack**. After reviewing AgentC2's full 137-tool MCP inventory, the V&V acceptance criteria, learning-config, scorers, networks, workflows, skills, and canvas systems, the picture is clear: **AgentC2 already implements the vast majority of the stack.** Most of what I initially called "gaps" are features that exist under different names.

This revised plan focuses on the **true remaining gaps** and the **narrative packaging** needed to make it undeniable.

---

## What Already Exists (Layer-by-Layer Mapping)

### Layer 1: Purpose and Payoff -- ~70% covered

**What exists:**

- Goals system with plan/execute/score lifecycle via Inngest (5 MCP tools: `goal-create`, `goal-list`, `goal-get`, `goal-update`, `goal-delete`)
- Per-agent cost tracking (`agent-costs`, `agent-budget-get/update`, `CostEvent` records per run/turn)
- Canvas dashboards with 25 block types including KPI cards, funnel charts, progress bars, and stat cards that can pull from any MCP tool, SQL, RAG, or API
- Per-run cost attribution with `costUsd`, `promptTokens`, `completionTokens`

**True gap:** Goals exist but don't close the loop to business outcomes. The missing concept is **RoCS (Return on Cognitive Spend)**: linking the aggregate cost of all agent runs toward a goal to the measurable business value delivered. Today you can see "this agent cost $4.20 this month" but not "that $4.20 generated $42,000 in qualified pipeline."

### Layer 2: Task Taxonomy -- ~85% covered

**What exists:**

- Skills as composable competency bundles (13 MCP tools): create, read, update, delete, list, attach/detach documents and tools, agent binding with pinned vs discoverable modes, version history
- Auto-generator ([packages/agentc2/src/skills/auto-generator.ts](packages/agentc2/src/skills/auto-generator.ts)) -- automatically creates SYSTEM skills when MCP servers are connected
- Recommender ([packages/agentc2/src/skills/recommender.ts](packages/agentc2/src/skills/recommender.ts)) -- suggests skills for agents based on instruction analysis
- Skill forking for customization
- Tools organized by category (integration, utility, platform) with tags

**True gap:** No formal maturation level (L0-L5) per skill per agent. You can see _what_ an agent can do but not _how autonomously_ it does it. Adding a `maturationLevel` field to the `AgentSkill` junction table would make existing data tell the progression story.

### Layer 3: Observability -- ~90% covered

**What exists:**

- **Live monitoring**: `live-runs`, `live-metrics`, `live-stats`, `audit-logs-list` (4 dedicated MCP tools)
- **Run inspection**: `agent-runs-list/get`, `agent-run-trace` with full tool call traces (inputs, outputs, durations, success/failure)
- **Trigger monitoring**: `trigger-events-list/get` with payload recording, status tracking, integration key filtering
- **Two-tier evaluation**: Tier 1 heuristic pre-screen (zero-cost, deterministic checks on every run) + Tier 2 AI auditor with structured scoring against custom scorecards
- **After Action Reviews (AARs)**: every Tier 2 eval produces sustain/improve patterns with evidence citations and categories
- **Cost tracking**: per-run, per-turn, per-agent, monthly aggregation with budget alert thresholds
- **Evaluation trends**: `agent-evaluations-list` with time-range filtering
- **Version history**: full snapshots of agent config at every version, diffable

**True gap:** Minimal. The data is all there. What's missing is a "decision audit trail" view -- a canvas that stitches together run traces, tool calls, and evaluations into a chronological story of "what did this agent decide, when, and how did it turn out." This is a canvas/UI concern, not a backend gap.

### Layer 4: Targeting System -- ~85% covered

**What exists:**

- **Custom scorecards**: per-agent scoring criteria with weights, rubrics, and direction (higher-is-better vs lower-is-better)
- **Test cases**: `agent-test-cases-create/list` -- domain-specific test inputs with expected outputs for ground-truth comparison
- **Simulations**: `agent-simulations-start/get/list` -- generate synthetic inputs by theme, run at configurable concurrency, track session results
- **Evaluation pipeline**: `agent-evaluations-run/list` -- run evals on demand or automatically post-run, producing numeric scores per criterion
- **Prebuilt scorers**: relevancy, toxicity, completeness, tone (from `@mastra/evals`) plus custom helpfulness and code quality evaluators
- **Ground truth comparison**: the auditor compares actual output against `expectedOutput` from test cases when available
- **V&V framework**: the V&V skill itself IS a rigorous domain-specific benchmark suite executed through the platform's own tools

**True gap:** Evaluations are point-in-time. There's no longitudinal view -- "how has this agent's relevancy score trended over the last 30 days?" Adding time-series aggregation of eval scores per agent per criterion would close this gap. The data exists in `AgentEvaluation` records; it just needs a trend query and chart.

### Layer 5: Model Layer -- ~70% covered

**What exists:**

- Multi-provider support (OpenAI, Anthropic) with per-agent `modelProvider`/`modelName` configuration
- `temperature`, `maxTokens`, `extendedThinking`, `thinkingBudget`, `reasoningEffort` controls
- `modelConfig` JSON for advanced settings (parallel tool calls, tool choice, cache control)
- Learning system can propose model changes (classified as HIGH risk, requiring human approval)

**True gap:** This is a real gap. No dynamic model routing -- every agent is locked to one model. The paper's "Programmatic Down-Shifting" concept (use a cheap model when confidence is high, escalate when it's not) doesn't exist. A router in `AgentResolver.hydrate()` that checks task complexity or budget remaining before selecting a model would be genuinely differentiating.

### Layer 6: Actuation (Action Networks) -- ~90% covered

**What exists:**

- **137 MCP tools** across HubSpot, Jira, Slack, Gmail, Calendar, Fathom, GitHub, Firecrawl, Playwright, ATLAS, Google Drive, Microsoft Outlook, Dropbox
- **Native OAuth integrations**: Gmail, Microsoft (Outlook Mail + Calendar), Dropbox with encrypted token storage, auto-refresh, webhook triggers
- **Workflows**: create, execute, resume, with branching, loops, parallel execution, human approval steps, AI-assisted generation and design iteration (7 ops tools + 3 config tools)
- **Networks**: multi-agent routing with topology, primitives (agents + workflows + tools), AI-assisted generation and design (6 ops tools + 3 config tools)
- **OAuth gating**: `AgentResolver.hydrate()` auto-filters tools based on active OAuth connections -- disconnected integrations are invisible, not broken
- **Trigger system**: 9 unified trigger tools supporting webhook, event, cron, and manual execution
- **Real production use case**: email-triage agent with 7 pinned skills, 20 tools, multi-step action chains (classify -> enrich via Jira/Slack/Calendar -> draft -> archive)

**True gap:** Minimal. Workflows are action chains. The approval system exists in Inngest for learning proposals. What's missing is generalizing the approval gate concept to any workflow step (not just learning), and exposing action success rates per integration as a dashboard metric.

### Layer 7: Verification and Red Teaming -- ~75% covered

**What exists:**

- **Simulations**: themed synthetic testing at configurable scale and concurrency
- **Guardrails**: `agent-guardrails-get/update/events` -- configurable policies with event logging when triggered
- **Toxicity scoring**: both word-list (Tier 1) and LLM-based (Tier 2) detection
- **Error pattern detection**: Tier 1 checks for error patterns, tool failures, token anomalies
- **Safety scoring**: dedicated safety dimension in Tier 1 pre-screen
- **V&V framework**: 4-tier acceptance criteria, feedback loop protocol, stability testing (burst load, interleaving, error recovery)

**True gap:** The simulation system generates synthetic inputs but they're not adversarial. Adding adversarial prompt themes (prompt injection attempts, boundary testing, manipulation, social engineering) to the simulation engine would create genuine red-team capability using the existing infrastructure. No new system needed -- just new simulation themes and a "red-team" category.

### Layer 8: Governance and Incentives -- ~85% covered

**What exists:**

- **Budget policies**: per-agent monthly limits, alert thresholds, hard limits, enabled/disabled (`agent-budget-get/update`)
- **Guardrail policies**: configurable per-agent with event logging (`agent-guardrails-get/update/events`)
- **Learning policies**: per-agent override of signal thresholds, traffic splits, auto-promotion rules, scheduled/threshold triggers (`agent-learning-policy/policy-update`)
- **Risk classification**: LOW/MEDIUM/HIGH tiers for learning proposals based on what changed (instructions, tools, model, memory, cost)
- **Auto-promotion gating**: minimum win rate, confidence score, run count, cost increase tolerance, no-regression requirement
- **Version control**: agents, workflows, networks, and skills all versioned with rollback support
- **Audit logs**: `audit-logs-list` with action, entity type, time range filtering
- **Multi-tenant**: Organization -> Workspace -> Agent hierarchy with membership and roles
- **Approval workflows**: learning proposals require human approval for MEDIUM/HIGH risk changes

**True gap:** All the governance primitives exist but they're scattered across separate tool calls and UI pages. No single "Governance Dashboard" that shows: all agents' budget status, guardrail violation count, pending learning proposals, recent audit events, and compliance summary. This is a Canvas creation task, not a backend task.

### Layer 9: Distribution and Maintenance -- ~85% covered

**What exists:**

- **Learning system**: 9 MCP tools covering the full loop -- session start, signal extraction, proposal generation, A/B experimentation, approval/rejection, metrics, policy configuration
- **Learning config**: signal detection thresholds, scheduled triggers (every 6 hours), traffic split (10% candidate default), graduated rollout [5%, 10%, 25%, 50%, 100%], auto-promotion with 5 gating criteria
- **Inngest background processing**: 28 registered functions for goals, evaluations, learning, simulations, triggers, schedules, Gmail watch
- **Skill auto-generation**: MCP servers automatically generate SYSTEM skills with tool bindings on connection
- **Skill forking**: users can fork SYSTEM skills into customizable USER copies
- **Version rollback**: one-click restore to any previous version across all entity types

**True gap:** The learning loop is complete but not showcased. A public-facing "Learning in Action" canvas showing a live agent improving over time would be the most compelling demo imaginable. The data exists; it needs a narrative presentation.

---

## True Remaining Gaps (Revised)

Only 7 items genuinely need building. Everything else is reframing, connecting, or showcasing what already exists.

### Gap 1: RoCS Metric (Return on Cognitive Spend) -- NEW BUILD

**What:** Link agent costs (which are tracked per-run, per-turn) to goal outcomes. Create a computed metric: `business_value_delivered / total_cognitive_spend`.

**Where:** Extend the Goals system. Add `targetKpi`, `baselineValue`, `currentValue`, and `targetValue` fields to the goals table. Create a query that aggregates `CostEvent.costUsd` for all runs linked to a goal.

**Why it matters:** This is the Solve Everything paper's core thesis: measure AI by outcomes, not activity. Nobody else has this as a first-class metric.

**Effort:** Low-Medium (schema change + one canvas + one API endpoint)

### Gap 2: Maturation Levels (L0-L5) -- SCHEMA ADDITION

**What:** Add `maturationLevel` enum field to the `AgentSkill` junction table. Values: `L0_MANUAL`, `L1_COPILOT`, `L2_SUPERVISED`, `L3_AUTONOMOUS`, `L4_SELF_IMPROVING`, `L5_FULLY_AUTONOMOUS`.

**Where:** Prisma schema change + UI badge on agent skill cards + canvas block showing maturation map.

**Why it matters:** Visual proof that agents progress from copilot to autonomous. The learning system already enables the L3->L4 transition; labeling it makes it legible.

**Effort:** Low (schema + UI label)

### Gap 3: Dynamic Model Router -- NEW BUILD

**What:** Add a routing layer in `AgentResolver.hydrate()` that can select model based on: (a) task complexity heuristic, (b) remaining monthly budget, (c) confidence from a fast-model pre-check.

**Where:** [packages/agentc2/src/agents/resolver.ts](packages/agentc2/src/agents/resolver.ts). Add optional `modelRouter` config to Agent schema.

**Why it matters:** The paper calls this "Programmatic Down-Shifting." It's the difference between burning GPT-4o on "what time is it?" vs routing that to GPT-4o-mini and saving 95% of the cost.

**Effort:** Medium (resolver logic + schema + config UI)

### Gap 4: Governance Canvas -- CANVAS CREATION

**What:** A single canvas dashboard aggregating: per-agent budget usage, guardrail violation count, pending learning proposals, recent audit log entries, approval queue, version change history.

**Where:** Create via `canvas-create` using existing MCP tool data sources. All the data already exists across `agent-budget-get`, `agent-guardrails-events`, `agent-learning-sessions`, `audit-logs-list`.

**Why it matters:** Makes the governance story tangible in one screenshot.

**Effort:** Low (canvas schema definition, no backend changes)

### Gap 5: Longitudinal Benchmark Trends -- QUERY + CHART

**What:** Time-series aggregation of evaluation scores per agent per criterion. Surface as a line chart on the agent evaluations page and as a canvas block.

**Where:** SQL query against `AgentEvaluation` table (which already stores `scoresJson` with per-criterion numeric scores and `createdAt` timestamps). Add a `trend` endpoint or extend `agent-evaluations-list` to return aggregated time-series.

**Why it matters:** "This agent's email classification accuracy went from 72% to 94% over 30 days" is the proof that the learning loop works.

**Effort:** Low-Medium (one SQL query + chart component)

### Gap 6: Adversarial Simulation Themes -- EXTENSION

**What:** Add red-team prompt categories to the simulation system: prompt injection, boundary testing, social engineering, instruction override, PII extraction attempts, jailbreak patterns.

**Where:** Extend the simulation theme system. When `theme: "red-team"` is passed to `agent-simulations-start`, generate adversarial prompts instead of benign ones. Score results specifically for safety and compliance.

**Why it matters:** Turns the existing simulation infrastructure into a red-team capability with zero new architecture.

**Effort:** Low-Medium (prompt templates + scoring criteria)

### Gap 7: End-to-End Demo Narrative -- PACKAGING

**What:** A scripted demo that runs live on the platform, showing:

1. Goal created with RoCS target
2. Network of agents deployed (email outreach + CRM + scheduling)
3. Agents execute against real HubSpot/Gmail
4. Learning session fires, proposes improvement
5. A/B experiment runs
6. Guardrail catches a policy violation
7. Governance canvas shows the full picture
8. RoCS metric shows positive ROI

**Where:** A combination of a demo script (can be a workflow definition), pre-configured agents, and showcase canvases.

**Why it matters:** The podcast won't care about individual features. They'll care about the story: "We built the Industrial Intelligence Stack and here it is running."

**Effort:** Medium (orchestration of existing capabilities)

---

## Revised Priority Ranking

| Priority | Enhancement                   | What It Really Is                                | Effort  |
| -------- | ----------------------------- | ------------------------------------------------ | ------- |
| P0       | RoCS Metric                   | Schema fields + cost aggregation query + canvas  | Low-Med |
| P0       | Maturation Levels (L0-L5)     | Enum field on AgentSkill + UI badge              | Low     |
| P0       | Demo Narrative + Canvas       | Scripted walkthrough using all existing features | Medium  |
| P1       | Dynamic Model Router          | Routing logic in AgentResolver                   | Medium  |
| P1       | Governance Canvas             | Canvas creation using existing data sources      | Low     |
| P1       | Longitudinal Benchmarks       | SQL trend query + line chart                     | Low-Med |
| P1       | Adversarial Simulation Themes | New prompt templates for existing sim system     | Low-Med |

**Total new-build effort: ~3-4 weeks**, not 8. The platform is far more complete than the original analysis suggested.

---

## What This Means for the Podcast

AgentC2 is not "missing most of the stack." It implements 85%+ of the Industrial Intelligence Stack today, across 137 MCP tools, with production-grade learning, evaluation, governance, multi-agent orchestration, and real-world actuation across 13+ integrations.

The 7 remaining items are about:

1. **Connecting dots** (RoCS links costs to outcomes)
2. **Labeling what exists** (maturation levels name the progression that already happens)
3. **Showcasing the loop** (governance canvas, benchmark trends, demo narrative)
4. **Optimizing** (model router)
5. **Hardening** (adversarial simulations)

The interview pitch: "We didn't just read the paper -- we built the stack. 137 tools, 9 layers, agents that learn, govern themselves, and actuate across your entire business. Here's it running live."
