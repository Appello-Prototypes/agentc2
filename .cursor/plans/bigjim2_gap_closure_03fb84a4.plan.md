---
name: BigJim2 Gap Closure
overview: Close all 12 configuration gaps in BigJim2 by setting governance policies, creating missing skills (Dark Factory + Federation), updating instructions, cleaning up dead references, and enabling proactive operation — all via MCP platform tool calls with zero code changes.
todos:
    - id: self-governance
      content: "Phase 1: Set budget ($50/mo), guardrails (PII/toxicity/jailbreak), learning policy (weekly, human-approved), initialize backlog, ensure scorecard active"
      status: pending
    - id: dark-factory-skill
      content: "Phase 2A: Create dark-factory skill with 15 coding pipeline tools and attach to BigJim2 as discoverable"
      status: pending
    - id: federation-skill
      content: "Phase 2B: Create federation-management skill (instructions-based) and attach to BigJim2 as discoverable"
      status: pending
    - id: network-cleanup
      content: "Phase 3: Remove customer-operations from instructions, add jira-specialist + browser-agent to engineering network"
      status: pending
    - id: instructions-update
      content: "Phase 4: Update BigJim2 instructions with Dark Factory section, Federation section, remove legacy network, enable parallelToolCalls"
      status: pending
    - id: heartbeat-schedule
      content: "Phase 5: Create daily 7 AM weekday heartbeat schedule for proactive operation"
      status: pending
    - id: verification
      content: "Phase 6: Read back full config, verify all 6 changes applied, confirm 23 skills, 3-agent engineering network, updated instructions"
      status: pending
isProject: false
---

# BigJim2 Full Tuning Plan

All changes are platform configuration via MCP tool calls (`agent-update`, `skill-create`, `skill-attach-tool`, `agent-attach-skill`, `agent-budget-update`, `agent-guardrails-update`, `agent-learning-policy-update`, `network-update`, `trigger-unified-create`, `backlog-get`). No code changes required.

**BigJim2 Agent ID:** `cmlpx10lc00408ejpmbt4r852`

---

## Phase 1: Self-Governance (Gaps 1-3, 5-6)

The meta-agent that governs everything must first be governed himself.

### 1A. Set Budget Policy

Use `agent-budget-update`:

- `monthlyLimitUsd: 50` (generous for a meta-agent, but bounded)
- `alertAtPct: 80`
- `hardLimit: false` (soft limit — alert but don't kill)
- `enabled: true`

### 1B. Set Guardrail Policy

Use `agent-guardrails-update` with a config that enables:

- PII detection (warn, not block — he needs to handle customer data via networks)
- Toxicity filtering
- Jailbreak prevention
- No external communication without human review (output guardrail)

### 1C. Set Learning Policy

Use `agent-learning-policy-update`:

- `autoLearn: true`
- `minRunsBeforeLearn: 20`
- `learningInterval: "weekly"`
- `requireApproval: true` (human approves all learning proposals)
- `experimentDuration: 7` (days)
- `trafficSplitPct: 20` (20% traffic to experimental config)

### 1D. Initialize Backlog

Use `backlog-get` with `agentSlug: "bigjim2"` — this auto-creates the backlog if it doesn't exist.

### 1E. Set Scorecard

Use `agent-update` to set scorers to `["completeness", "relevancy", "tone", "toxicity"]` (already defined, just ensure scorecard is active and tracking).

---

## Phase 2: New Skills — Dark Factory and Federation (Gaps 7-8)

### 2A. Create `dark-factory` Skill

Use `skill-create`:

- **slug:** `dark-factory`
- **name:** Dark Factory — Autonomous Coding Pipeline
- **category:** `engineering`
- **instructions:** Cover the full pipeline: ticket intake, codebase analysis, implementation planning, risk classification, code generation via Cursor, build verification, scenario testing, trust scoring, PR review gates, merge/deploy. Reference autonomy levels 0-5 and policy configuration.

Then use `skill-attach-tool` to attach all 15 pipeline tools:
`ingest-ticket`, `dispatch-coding-pipeline`, `update-pipeline-status`, `lookup-pipeline-config`, `cursor-launch-agent`, `cursor-get-status`, `cursor-add-followup`, `cursor-get-conversation`, `cursor-poll-until-done`, `verify-branch`, `wait-for-checks`, `run-scenarios`, `calculate-trust-score`, `merge-pull-request`, `await-deploy`

Then use `agent-attach-skill` to attach to BigJim2 (pinned=false, discoverable).

### 2B. Create `federation-management` Skill

Use `skill-create`:

- **slug:** `federation-management`
- **name:** Federation — Cross-Org Agent Communication
- **category:** `admin`
- **instructions:** Cover the federation model: bilateral trust agreements, Ed25519 signing, exposure controls, PII redaction, rate limiting, circuit breakers, audit logging. Reference the API patterns for creating/approving/suspending agreements, exposing agents, and invoking federated agents. Note that federation tools are dynamically loaded — when a federation agreement is active, federated agents appear as callable tools with the `federation:` prefix.

Then use `agent-attach-skill` to attach to BigJim2 (pinned=false, discoverable).

---

## Phase 3: Network Cleanup (Gaps 9-10)

### 3A. Remove `customer-operations` from Instructions

This network is explicitly called "Legacy" in BigJim2's current instructions. Remove it from the network table and delegation rules via `agent-update`.

### 3B. Strengthen `engineering` Network

Use `network-update` on the `engineering` network to add:

- `jira-specialist` — ticket management is core to engineering workflows
- `browser-agent` — needed for testing and QA automation

Update BigJim2's instructions to reflect engineering now handles "GitHub repos/PRs/issues, Jira ticket management for engineering work, browser-based testing and QA."

---

## Phase 4: Instructions Update (Gaps 7-8 awareness + cleanup)

Use `agent-update` to modify BigJim2's instructions with three new sections and one cleanup:

### 4A. Add Dark Factory Section

```
### Dark Factory — Autonomous Coding Pipeline

You can take work items from ticket through code generation, verification,
and deployment. Activate the `dark-factory` skill to access pipeline tools.

- Ingest a Jira ticket → `ingest-ticket`
- Dispatch to Cursor coding agent → `dispatch-coding-pipeline`
- Monitor status → `cursor-get-status`, `cursor-poll-until-done`
- Verify branch → `verify-branch`, `wait-for-checks`
- Run behavioral scenarios → `run-scenarios`
- Calculate trust score → `calculate-trust-score`
- Merge and deploy → `merge-pull-request`, `await-deploy`

Autonomy levels are controlled by PipelinePolicy:
- Level 1: Human reviews all plans and PRs
- Level 2-3: Auto-approve low-risk plans
- Level 4-5: Trust-score-guided merge decisions

Use `lookup-pipeline-config` to check current policy before dispatching.
```

### 4B. Add Federation Section

```
### Federation — Cross-Org Agent Communication

You can manage secure agent communication between organizations.
Activate the `federation-management` skill for guidance.

Key concepts:
- FederationAgreement: bilateral trust between two orgs
- Exposure controls: which agents are visible to partners
- Ed25519 signing: cryptographic request verification
- PII redaction: automatic content filtering
- Circuit breakers: auto-suspend at high error rates

Federated agents appear as tools with `federation:` prefix when
agreements are active. Route cross-org requests through these tools.
```

### 4C. Remove Legacy Network Reference

Remove the `customer-operations` row from the network table and its delegation rule ("Legacy network, use specific networks above instead").

### 4D. Enable Parallel Tool Calls

Use `agent-update` to set `parallelToolCalls: true` in modelConfig — allows BigJim2 to execute independent tool calls simultaneously instead of sequentially.

---

## Phase 5: Proactive Operation (Gap 4)

### 5A. Create Heartbeat Schedule

Use `trigger-unified-create` to create a daily heartbeat schedule:

- **Type:** schedule/cron
- **Cron:** `0 7 * * 1-5` (7 AM EST, weekdays)
- **Agent:** bigjim2
- **Message:** "Heartbeat check: Review your backlog, check agent health across the platform, review any overnight alerts or failures, and prepare a brief status summary."

This transforms BigJim2 from purely reactive to proactively checking on the system every morning.

---

## Phase 6: Verification

After all changes:

1. Read BigJim2's config back via `agent-read` to confirm all updates applied
2. Verify budget policy via `agent-budget-get`
3. Verify guardrail policy via `agent-guardrails-get`
4. Verify learning policy via `agent-learning-policy`
5. Verify backlog exists via `backlog-get`
6. Verify skills attached (should be 23 total: 21 existing + dark-factory + federation-management)
7. Verify engineering network has 3 agents (github-specialist + jira-specialist + browser-agent)
8. Verify instructions include Dark Factory and Federation sections, and exclude customer-operations legacy reference

---

## Summary of Changes

| What                | Tool                                                            | Change                                                                                    |
| ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Budget              | `agent-budget-update`                                           | $50/month soft limit, alert at 80%                                                        |
| Guardrails          | `agent-guardrails-update`                                       | PII, toxicity, jailbreak                                                                  |
| Learning            | `agent-learning-policy-update`                                  | Weekly auto-learn, human approval                                                         |
| Backlog             | `backlog-get`                                                   | Auto-initialize                                                                           |
| Dark Factory skill  | `skill-create` + 15x `skill-attach-tool` + `agent-attach-skill` | New discoverable skill with 15 pipeline tools                                             |
| Federation skill    | `skill-create` + `agent-attach-skill`                           | New discoverable skill (instructions-based)                                               |
| Engineering network | `network-update`                                                | Add jira-specialist + browser-agent                                                       |
| Instructions        | `agent-update`                                                  | Add Dark Factory + Federation sections, remove legacy network, enable parallel tool calls |
| Heartbeat           | `trigger-unified-create`                                        | Daily 7 AM weekday proactive check                                                        |

**Total: ~30 MCP tool calls, zero code changes.**
