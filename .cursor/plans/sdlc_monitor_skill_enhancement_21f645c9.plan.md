---
name: SDLC Monitor Skill Enhancement
overview: Update the `agentc2-sdlc-monitor` skill to include optimization analysis, performance improvement recommendations, and active tuning procedures -- turning it from a passive monitor into an active optimization tool for the dark software factory.
todos:
    - id: update-skill
      content: Rewrite SKILL.md with optimization analysis, playbook, baselines, and active tuning sections
      status: completed
    - id: quick-wins
      content: Document MCP-only optimizations (classifier model swap, guardrail tuning) with exact tool calls
      status: completed
    - id: medium-effort
      content: Document seed script changes (auditor input truncation, context forwarding, heal-cycle reduction)
      status: completed
    - id: infrastructure
      content: Document code-level infrastructure changes (sandbox resources, clone caching, timeouts)
      status: completed
isProject: false
---

# SDLC Monitor Skill: Optimization and Active Tuning

## Findings from Live Data Analysis

### Token Consumption (Biggest Cost Driver)

The **Auditor** is the dominant cost center:

- Each audit run: **65K-120K tokens** (claude-sonnet-4-6)
- Audit cycle runs up to **3 iterations** per ticket = up to **360K tokens** just for auditing
- The full Cursor agent conversation (including all tool call results) is passed as raw input to the auditor every iteration
- For comparison: Classifier uses only **~2K tokens** per run (gpt-4o)

### Duplicate Runs

Live data shows duplicate classifier runs for the same tickets:

- Issue #151 classified **4 times** (runs at 14:22, 14:23, 16:15x2)
- Issue #158 classified **2 times** (runs at 17:09x2)
- This suggests either duplicate dispatches or workflow retries re-running the classifier

### Auditor Redundant Work

Each audit iteration re-fetches the same files from GitHub (5-10 tool calls per audit). When the audit cycle loops, the auditor does not receive the previous iteration's feedback, so it performs the same verification work each time.

### Sandbox Constraints

- `verify-branch` sandbox: **512MB RAM, 1 CPU, 120s timeout per command**
- For a Turborepo monorepo running `bun run build`, this is tight
- No git clone caching between heal-cycle iterations (rm -rf + fresh clone each time)

---

## Optimization Levers to Document in Skill

### Category 1: Model Selection (MCP or Seed Script)

| Agent        | Current Model                 | Recommendation                  | Rationale                                                                                             |
| ------------ | ----------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Classifier   | gpt-4o                        | **gpt-4o-mini**                 | Pure JSON classification, ~2K tokens, no tool calls. Mini is 10x cheaper, same quality for this task. |
| Auditor      | claude-sonnet-4-6             | Keep, but **reduce input size** | Auditor needs reasoning + tool use. Model is right, input is the problem.                             |
| Planner      | claude-sonnet-4-6             | Keep                            | Planning requires strong reasoning.                                                                   |
| Cursor Agent | claude-4.6-opus-high-thinking | Keep                            | Implementation requires the best model.                                                               |

Actionable via MCP: `agent_update(agentId, modelName: "gpt-4o-mini")` for the classifier.

### Category 2: Token Efficiency (Seed Script Changes)

- **Truncate Cursor agent conversation before passing to auditor.** The analyze-result / implement-result step should extract a summary (< 5K chars) rather than dumping the full conversation (which can be 50-100K chars).
- **Pass audit feedback forward** in the dowhile loop context so subsequent iterations build on prior findings instead of starting from scratch.
- **Reduce auditor maxSteps from 3 to 2** -- most audits complete in 5-6 tool calls already; 2 maxSteps (generate cycles, not tool calls) is sufficient.

### Category 3: Infrastructure Tuning (Code Changes)

- **Increase verify-branch sandbox resources**: `--memory=1024m`, `--cpus=2.0` for monorepo builds.
- **Cache git clones in heal-cycle**: Instead of `rm -rf repo` each iteration, do `git fetch && git checkout` to skip re-cloning.
- **Increase MCP tool timeout** for verify-branch from 120s to 180s (build step can exceed 120s on a full monorepo).

### Category 4: Workflow Configuration (Seed Script or MCP)

- **Add conditional auditor skip**: If the Cursor agent's analysis includes tests that pass, skip the audit cycle entirely (route directly to human review).
- **Reduce heal-cycle maxIterations from 3 to 2** -- if CI fails twice after self-heal attempts, a third attempt rarely succeeds.
- **Add timeout to human steps** -- after 24h of no approval, auto-escalate or auto-approve with a flag.

### Category 5: Agent Guardrail Tuning (MCP)

- **Classifier guardrail** `maxTokensPerRun: 10,000` is oversized for a 2K-token agent. Reduce to **5,000**.
- **Auditor guardrail** `maxTokensPerRun: 30,000` is being exceeded (actual runs hit 65-120K). Either increase to match reality (**150,000**) or, better, fix the input size so it stays under 30K.

---

## Skill Update Plan

Update `[~/.cursor/skills/agentc2-sdlc-monitor/SKILL.md](~/.cursor/skills/agentc2-sdlc-monitor/SKILL.md)` to add these sections:

### New Section: "Optimization Analysis Procedure"

Step-by-step instructions for analyzing pipeline efficiency when monitoring, including:

- Token usage per agent per run (from `live_runs`)
- Audit loop iteration counts
- Duplicate run detection
- Time-to-merge tracking
- Sandbox failure patterns

### New Section: "Optimization Playbook"

Concrete actions the agent can take via MCP or code, organized by:

- **Quick wins** (MCP-only, no code deploy needed): model swaps, guardrail tuning
- **Medium effort** (seed script changes + reseed): input truncation, context forwarding
- **Infrastructure** (code changes + deploy): sandbox resources, clone caching

### New Section: "Performance Baselines"

Current baseline metrics from today's live data to compare against future runs:

- Classifier: ~2K tokens, ~4s, gpt-4o
- Auditor: ~100K tokens, ~35s, claude-sonnet-4-6
- End-to-end bugfix: ~45 min (analysis + audit + implementation + heal)

### New Section: "Active Tuning via MCP"

Exact MCP tool calls for each optimization action (model swap, guardrail update, etc.)

### Updated Section: "Dark Factory Health Indicators"

Expand with the new optimization metrics and add thresholds/targets.
