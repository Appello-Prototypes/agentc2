---
name: SDLC Pipeline Fixes — E2E Test Findings
overview: "Nine fixes derived from the production SDLC E2E Playwright test: restore workflow tool availability on concierge agents, fix task suggestion slug resolution, add tool routing instructions to concierge, gate the debug info bar behind admin role, fix org switcher accessibility, create a test-user seed script, enforce concierge tool parity on deployment, debug historical workflow failures, and create an SDLC network fallback."
todos:
    - id: p0-workflow-tool-availability
      content: "P0: Ensure workflow-execute and siblings are permanently assigned to all concierge agents and loadable at runtime"
      status: pending
    - id: p1-task-card-slug
      content: "P1: Fix TaskSuggestions.tsx to include workflow slug in prompt so concierge can resolve it"
      status: pending
    - id: p1-concierge-tool-routing
      content: "P1: Add explicit workflow-vs-network tool routing guidance to concierge agent instructions"
      status: pending
    - id: p2-debug-bar-gating
      content: "P2: Gate DebugInfoBar behind admin role or dev environment in workspace/page.tsx"
      status: pending
    - id: p2-org-switcher-a11y
      content: "P2: Add aria-label to OrgSwitcher trigger and improve reactivity when memberships change"
      status: pending
    - id: p2-test-user-seed
      content: "P2: Create a dedicated test-user seed script using Better Auth's scrypt hashPassword"
      status: pending
    - id: p2-concierge-tool-parity
      content: "P2: Extend check-tool-parity.ts to verify all production concierge agents have the minimum required tools"
      status: pending
    - id: p2-workflow-failure-debug
      content: "P2: Investigate and fix the 0–4% success rate on all three SDLC workflows"
      status: pending
    - id: p3-sdlc-network-fallback
      content: "P3: Create SDLC Triage network in seed-sdlc-playbook.ts as a redundant execution path"
      status: pending
isProject: false
---

# SDLC Pipeline Fixes — E2E Test Findings

## Background

On March 5 2026, a full end-to-end test of the SDLC pipeline was run on the production AgentC2 instance (`https://agentc2.ai`) using Playwright browser automation. The test simulated a human user navigating to the workspace, clicking the "SDLC Triage" task card, and attempting to push a bug ticket through the entire SDLC flywheel (classify → plan → code → review → merge).

**Result: FAIL — the pipeline could not execute.** Nine distinct issues were identified, spanning runtime tool loading, UI prompt construction, agent instructions, security, accessibility, DevOps, and architecture. This plan documents each issue with root cause analysis, code references, and concrete implementation solutions.

### Evidence

| Attempt                   | Run ID     | Thread     | Outcome                                                                                 |
| ------------------------- | ---------- | ---------- | --------------------------------------------------------------------------------------- |
| 1 — SDLC Triage task card | `8wcrccry` | `36357333` | BigJim2 searched for network `sdlc-triage` (6 attempts), never tried `workflow-execute` |
| 2 — Explicit slug         | `5duq52mb` | `36647310` | BigJim2 reported `workflow-execute` MCP tools DOWN                                      |
| 3 — Option A+B fallback   | `5duq52mb` | `36647310` | `network-generate` succeeded but topology did not persist                               |

### Infrastructure Verified

| Component                       | Exists           | Status                         |
| ------------------------------- | ---------------- | ------------------------------ |
| SDLC Classifier agent           | Yes              | 0 runs                         |
| SDLC Planner agent              | Yes              | 0 runs                         |
| SDLC Auditor agent              | Yes              | 0 runs                         |
| SDLC Reviewer agent             | Yes              | 0 runs                         |
| `sdlc-triage-agentc2` workflow  | Yes, published   | 0% success, last run 22h prior |
| `sdlc-feature-agentc2` workflow | Yes, published   | 0% success, last run 20h prior |
| `sdlc-bugfix-agentc2` workflow  | Yes, published   | 4% success, last run 20h prior |
| BigJim2 concierge               | Yes, operational | Missing workflow tools         |
| SDLC network                    | Does not exist   | —                              |

---

## Fix 1 — Restore Workflow Tool Availability on Concierge Agents

**Priority:** P0 — Total pipeline blocker
**Category:** Runtime / Tool Loading

### Justification

The SDLC pipeline cannot function at all if the concierge agent cannot call `workflow-execute`. During testing, BigJim2 explicitly reported: _"workflow-execute is currently unavailable — the MCP server for workflow tools is down."_ This blocks every workflow-driven task card in the workspace, not just SDLC.

### Root Cause

`workflow-execute` has a dual identity:

1. **Registry tool** in `packages/agentc2/src/tools/workflow-tools.ts` (line 95) — runs server-side via Prisma, registered in `toolRegistry` at `registry.ts` line 1377.
2. **MCP schema** in `packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts` (line 5) — exposed as `workflow.execute` via `/api/mcp` with custom handler `workflowExecute`.

The `workspace-concierge` seed (`packages/database/prisma/seed-agents.ts` line 215) includes `workflow-execute`, but `BigJim2` (the production concierge for the AgentC2 org) is a database-only agent created through the platform UI — it was never seeded with this tool. Manual injection of `AgentTool` records during the test session did not survive or did not load at runtime, suggesting one of:

- The `AgentTool` records were created but the resolver's hydration cache served a stale copy (TTL 30s, keyed by `slug:version:threadId`).
- BigJim2's `mcpEnabled` flag caused tool loading to go through MCP, which timed out.
- The tool name stored in `AgentTool.toolId` did not exactly match the registry key.

### Implementation

**Step 1 — Permanent tool assignment.** Create a migration script that ensures every agent whose slug starts with `bigjim2` or `workspace-concierge` has these tools in their `AgentTool` records:

```typescript
// scripts/ensure-concierge-workflow-tools.ts
const REQUIRED_TOOLS = [
    "workflow-execute",
    "workflow-list-runs",
    "workflow-get-run",
    "workflow-resume"
];

const concierges = await prisma.agent.findMany({
    where: {
        OR: [{ slug: { startsWith: "bigjim2" } }, { slug: { startsWith: "workspace-concierge" } }],
        isActive: true
    },
    include: { tools: true }
});

for (const agent of concierges) {
    const existing = new Set(agent.tools.map((t) => t.toolId));
    const missing = REQUIRED_TOOLS.filter((t) => !existing.has(t));
    if (missing.length > 0) {
        await prisma.agentTool.createMany({
            data: missing.map((toolId) => ({
                agentId: agent.id,
                toolId,
                isEnabled: true
            })),
            skipDuplicates: true
        });
        console.log(`Added ${missing.length} tools to ${agent.slug}: ${missing.join(", ")}`);
    }
}
```

**Step 2 — Add error logging to tool hydration.** In `packages/agentc2/src/agents/resolver.ts`, inside `hydrate()` where `getToolsByNamesAsync()` is called, add structured logging when a tool fails to resolve:

```typescript
const resolved = await getToolsByNamesAsync(toolNames, organizationId);
const resolvedNames = new Set(Object.keys(resolved));
const missing = toolNames.filter((n) => !resolvedNames.has(n));
if (missing.length > 0) {
    console.warn(
        `[AgentResolver] Agent ${record.slug}: ${missing.length} tools failed to load: ${missing.join(", ")}`
    );
}
```

**Step 3 — Run the migration on production** after deploying and verify via the platform UI or MCP `agent_read` that the tools appear.

### Files Changed

- `scripts/ensure-concierge-workflow-tools.ts` (new)
- `packages/agentc2/src/agents/resolver.ts` (add warning log)

---

## Fix 2 — Include Workflow Slug in Task Suggestion Prompts

**Priority:** P1 — Workflow discovery fails
**Category:** UI / Prompt Engineering

### Justification

Even if `workflow-execute` loads correctly (Fix 1), the concierge still won't know which workflow to execute. The current prompt says `Run the "SDLC Triage" workflow` — using the **display name**. The concierge has no mapping from display names to slugs, so it searched for `sdlc-triage` as a network and failed. The actual slug is `sdlc-triage-agentc2`.

This bug affects **every workflow task card**, not just SDLC.

### Root Cause

`TaskSuggestions.tsx` line 237 uses `wf.name` (display name) in the prompt:

```typescript
prompt: `Run the "${wf.name}" workflow.${wf.description ? ` ${wf.description}` : ""}`,
```

The response from `/api/workflows` includes `slug`, `name`, and `description`, but only `name` is used in the prompt.

### Implementation

Change the workflow card prompt to include the slug so the concierge can pass it directly to `workflow-execute`:

```typescript
// apps/agent/src/components/TaskSuggestions.tsx line 234-240
const workflowCards: SuggestionCard[] = publishedWorkflows.slice(0, 3).map((wf) => ({
    title: wf.name,
    description: truncate(wf.description, 45) || "Automated workflow",
    prompt: `Execute workflow "${wf.slug}" using the workflow-execute tool.${wf.description ? ` ${wf.description}` : ""}`,
    agentSlug: conciergeSlug,
    icon: deriveIcon(wf.name, wf.description, "workflow")
}));
```

Apply the same pattern to network cards (line 245-251) to use `net.slug`:

```typescript
const networkCards: SuggestionCard[] = publishedNetworks.slice(0, 2).map((net) => ({
    title: net.name,
    description: truncate(net.description, 45) || `${net.primitiveCount} agents coordinated`,
    prompt: `Execute network "${net.slug}" using the network-execute tool.${net.description ? ` ${net.description}` : ""}`,
    agentSlug: conciergeSlug,
    icon: deriveIcon(net.name, net.description, "network")
}));
```

### Files Changed

- `apps/agent/src/components/TaskSuggestions.tsx` (lines 237, 248)

---

## Fix 3 — Add Workflow-vs-Network Tool Routing to Concierge Instructions

**Priority:** P1 — Wrong tool selection
**Category:** Agent Instructions

### Justification

BigJim2 made 6 `network-read` calls before falling back to `agent-list`. It never attempted `workflow-execute` even once on the first run. The agent doesn't understand the semantic difference between workflows and networks, and has no instruction telling it which tool to use for which entity type.

Without this fix, even with correct slugs in prompts (Fix 2), the concierge may still route to the wrong tool.

### Root Cause

BigJim2's system instructions (stored in the `Agent.instructions` field in the database) do not contain any guidance on workflow vs network tool selection. Both `workflow-execute` and `network-execute` appear in its tool list without disambiguation.

### Implementation

Add a tool routing section to BigJim2's system instructions via the platform UI (`/agents/bigjim2-agentc2-q9sxjn` → Settings → Instructions) or via MCP `agent_update`:

```markdown
## Tool Selection: Workflows vs Networks

- **Workflows** are step-by-step processes with sequential or branching steps.
    - To run a workflow: use `workflow-execute` with the workflow slug.
    - To check workflow runs: use `workflow-list-runs` or `workflow-get-run`.
    - To resume a suspended workflow: use `workflow-resume`.
    - NEVER use `network-read` or `network-execute` for workflows.

- **Networks** are multi-agent topologies where agents collaborate.
    - To run a network: use `network-execute` with the network slug.
    - To inspect a network: use `network-read`.

- When a user says "run the X workflow" or a prompt contains "workflow-execute",
  ALWAYS use the `workflow-execute` tool. Do not search for networks.

- If unsure whether something is a workflow or network, check both:
  call `workflow-execute` first (it will error if the slug doesn't match),
  then fall back to `network-execute`.
```

### Files Changed

- Database update to `Agent.instructions` for BigJim2 (via platform UI or MCP)

---

## Fix 4 — Gate Debug Info Bar Behind Admin Role

**Priority:** P2 — Information leak
**Category:** UI / Security

### Justification

The `DebugInfoBar` is rendered unconditionally for every authenticated user in the workspace. It exposes:

- Full thread IDs and run IDs (copyable)
- Agent slug (linked to `/agents/{slug}`)
- Direct deep links to the Observe dashboard
- Turn indices

This leaks internal system details to non-admin users and makes the UI look unfinished for customer-facing deployments (embed mode, customer workspaces).

### Root Cause

`DebugInfoBar` is rendered at line 1871 of `workspace/page.tsx` with no conditional:

```tsx
<DebugInfoBar
    threadId={threadId}
    runId={currentRunId}
    agentSlug={selectedAgentSlug}
    turnIndex={currentTurnIndex}
/>
```

### Implementation

Gate behind the user's organization role from `useOrganization()`:

```tsx
// In the workspace page component, add:
const { activeOrganization } = useOrganization();
const isAdmin = activeOrganization?.role === "owner" || activeOrganization?.role === "admin";

// Then at line 1870:
{
    isAdmin && (
        <DebugInfoBar
            threadId={threadId}
            runId={currentRunId}
            agentSlug={selectedAgentSlug}
            turnIndex={currentTurnIndex}
        />
    );
}
```

The `useOrganization()` hook (from `OrganizationProvider.tsx`) already returns the `role` field in `activeOrganization`, so no API changes are needed.

For embed mode, always hide the debug bar:

```tsx
{isAdmin && !embedConfig && (
    <DebugInfoBar ... />
)}
```

### Files Changed

- `apps/agent/src/app/workspace/page.tsx` (line 1870-1876 — add conditional render)

---

## Fix 5 — Improve Org Switcher Accessibility and Reactivity

**Priority:** P2 — UX / Accessibility
**Category:** UI Component

### Justification

The org switcher could not be operated via Playwright, forcing a manual cookie injection workaround. This affects:

1. Automated testing of multi-org flows
2. Accessibility for keyboard/screen-reader users
3. Users who are added to new orgs mid-session

### Root Cause

Two issues in `OrgSwitcher.tsx`:

**A) Missing aria-label.** The `DropdownMenuTrigger` at line 77 has no `aria-label`, making it difficult for assistive tools and Playwright accessibility-tree selectors to identify.

**B) Single-org guard.** Line 60: if `organizations.length <= 1`, the component renders a static `<div>` with no dropdown. If the user's membership changes during the session (e.g., added to a new org via Prisma), the component won't update because `OrganizationProvider` fetches orgs once on mount (`useEffect` with empty deps, line 39).

### Implementation

**Step 1 — Add aria-label to trigger:**

```tsx
// OrgSwitcher.tsx line 77
<DropdownMenuTrigger
    aria-label={`Switch organization (current: ${activeOrganization.name})`}
    className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors outline-none"
>
```

**Step 2 — Add polling to OrganizationProvider** so membership changes are picked up during the session:

```tsx
// OrganizationProvider.tsx — add interval polling
useEffect(() => {
    let cancelled = false;

    async function fetchOrgs() {
        try {
            const res = await fetch("/api/organizations/switch");
            if (!res.ok) throw new Error("Failed to fetch organizations");
            const data = await res.json();
            if (!cancelled && data.success) {
                setActiveOrganization(data.activeOrganization);
                setOrganizations(data.organizations);
            }
        } catch {
            // Silently fail
        } finally {
            if (!cancelled) setLoading(false);
        }
    }

    fetchOrgs();
    const interval = setInterval(fetchOrgs, 60_000); // Re-check every 60s
    return () => {
        cancelled = true;
        clearInterval(interval);
    };
}, []);
```

### Files Changed

- `apps/agent/src/components/OrgSwitcher.tsx` (line 77 — add aria-label)
- `apps/agent/src/components/OrganizationProvider.tsx` (line 39-57 — add polling interval)

---

## Fix 6 — Create Test User Seed Script

**Priority:** P2 — DevOps / Test Infrastructure
**Category:** Authentication

### Justification

During the E2E test, the test user's password could not be verified. Debugging revealed Better Auth uses `scrypt` (not `bcrypt`), and direct DB manipulation with the wrong hasher caused HTTP 500 errors. A proper test-user setup script eliminates this class of issue for all future testing.

### Root Cause

Better Auth's password hashing uses `scrypt` with config `{ N: 16384, r: 16, p: 1, dkLen: 64 }` and format `salt:hex(key)`. The `hashPassword` function is in `better-auth/dist/crypto/password.mjs`. Using `Bun.password.hash()` with `bcrypt` produces an incompatible hash.

### Implementation

Create `scripts/seed-test-user.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

// Import Better Auth's scrypt hasher
const { hashPassword } =
    await import("../packages/auth/node_modules/better-auth/dist/crypto/password.mjs");

const prisma = new PrismaClient();

const TEST_EMAIL = "agentc2-test@test.local";
const TEST_PASSWORD = "AgentC2Test123!";
const TEST_NAME = "Test User";

async function main() {
    const hash = await hashPassword(TEST_PASSWORD);

    const user = await prisma.user.upsert({
        where: { email: TEST_EMAIL },
        update: { password: hash, name: TEST_NAME },
        create: {
            email: TEST_EMAIL,
            name: TEST_NAME,
            password: hash,
            emailVerified: true
        }
    });

    console.log(`Test user: ${user.email} (id: ${user.id})`);

    // Ensure membership in all orgs for testing
    const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
    for (const org of orgs) {
        await prisma.membership.upsert({
            where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
            update: {},
            create: { userId: user.id, organizationId: org.id, role: "admin" }
        });
        console.log(`  → member of "${org.name}"`);
    }

    // Mark onboarding complete
    const membership = await prisma.membership.findFirst({ where: { userId: user.id } });
    if (membership && !membership.onboardingCompletedAt) {
        await prisma.membership.update({
            where: { id: membership.id },
            data: { onboardingCompletedAt: new Date() }
        });
    }

    console.log("Done.");
}

main().finally(() => prisma.$disconnect());
```

Add to `package.json`:

```json
"db:seed-test-user": "bun run scripts/seed-test-user.ts"
```

### Files Changed

- `scripts/seed-test-user.ts` (new)
- `package.json` (add script alias)

---

## Fix 7 — Enforce Concierge Tool Parity on Deployment

**Priority:** P2 — Deployment Gap
**Category:** CI / Validation

### Justification

The `workspace-concierge` seed includes `workflow-execute`, but production concierge variants (`bigjim2-agentc2-`\*) don't inherit those tools when created via the platform UI. Every new org's concierge may silently lack critical tools. The existing `scripts/check-tool-parity.ts` checks registry-vs-MCP parity but does NOT check whether production concierge agents have the minimum required tools.

### Root Cause

`check-tool-parity.ts` compares `toolRegistry` keys against MCP schema definitions, then optionally checks one live concierge. It does not iterate over all concierge agents across all organizations.

### Implementation

Extend `scripts/check-tool-parity.ts` to add a `--check-concierges` flag:

```typescript
// Add after existing parity checks:

if (flags.includes("--check-concierges")) {
    const REQUIRED_CONCIERGE_TOOLS = [
        "workflow-execute",
        "workflow-list-runs",
        "workflow-get-run",
        "workflow-resume",
        "network-execute",
        "network-read",
        "network-list",
        "agent-list",
        "agent-read",
        "backlog-get",
        "memory-recall",
        "rag-query"
    ];

    const concierges = await prisma.agent.findMany({
        where: {
            OR: [
                { slug: { startsWith: "bigjim2" } },
                { slug: { startsWith: "workspace-concierge" } }
            ],
            isActive: true
        },
        include: { tools: true, workspace: { include: { organization: true } } }
    });

    let gaps = 0;
    for (const agent of concierges) {
        const existing = new Set(agent.tools.map((t) => t.toolId));
        const missing = REQUIRED_CONCIERGE_TOOLS.filter((t) => !existing.has(t));
        if (missing.length > 0) {
            console.error(
                `CONCIERGE GAP: ${agent.slug} (org: ${agent.workspace?.organization?.name}) missing: ${missing.join(", ")}`
            );
            gaps += missing.length;
        }
    }

    if (gaps > 0) {
        console.error(`\n${gaps} concierge tool gaps found across ${concierges.length} agents`);
        process.exit(1);
    }
}
```

Run as part of the pre-push checklist: `bun run scripts/check-tool-parity.ts --check-concierges`.

### Files Changed

- `scripts/check-tool-parity.ts` (add `--check-concierges` mode)

---

## Fix 8 — Debug and Fix Historical SDLC Workflow Failures

**Priority:** P2 — Workflow Reliability
**Category:** Workflow Engine

### Justification

All three SDLC workflows show near-zero success rates despite being published and having historical runs:

| Workflow     | Success Rate | Runs with data      |
| ------------ | ------------ | ------------------- |
| SDLC Triage  | 0%           | Last run 22h ago    |
| SDLC Feature | 0%           | Last failed 20h ago |
| SDLC Bugfix  | 4%           | Last failed 20h ago |

Even if Fixes 1-3 succeed in triggering `workflow-execute`, the workflows themselves will likely fail again if the underlying issues aren't addressed.

### Root Cause (Hypotheses — requires investigation)

1. **Workflow definition references wrong agent slugs.** The `definitionJson` may reference agents by base slug (e.g., `sdlc-classifier`) instead of org-scoped slug (`sdlc-classifier-agentc2-XXXX`).
2. **Missing agent tools.** SDLC sub-agents may lack tools required by their workflow steps (e.g., the Classifier agent might need `agent-list` to discover sub-workflows).
3. **Workflow step timeouts.** The `executeWorkflowDefinition` function may not handle step-level timeouts gracefully.
4. **Import error.** The dynamic import at `workflow-tools.ts` line 141 (`import("../workflows/builder")`) may fail in production due to bundling.

### Implementation

**Step 1 — Query failed run logs:**

```sql
SELECT wr.id, wr.status, wr."inputJson", wr."outputJson",
       wrs."stepId", wrs."stepName", wrs.status as step_status, wrs."errorJson"
FROM "WorkflowRun" wr
LEFT JOIN "WorkflowRunStep" wrs ON wrs."runId" = wr.id
JOIN "Workflow" w ON w.id = wr."workflowId"
WHERE w.slug IN ('sdlc-triage-agentc2', 'sdlc-bugfix-agentc2', 'sdlc-feature-agentc2')
ORDER BY wr."createdAt" DESC
LIMIT 50;
```

**Step 2 — Inspect workflow definitions** for hardcoded slugs:

Navigate to each workflow's Design tab (`/workflows/sdlc-triage-agentc2` → Design) and verify all agent references use the correct org-scoped slugs.

**Step 3 — Fix identified issues** based on the error output from Step 1.

### Files Changed

- Depends on findings — likely `seed-sdlc-playbook.ts` and/or workflow `definitionJson` updates via the platform UI

---

## Fix 9 — Create SDLC Triage Network as Fallback

**Priority:** P3 — Architecture / Redundancy
**Category:** Agent Network

### Justification

When workflow tools were unavailable, BigJim2 tried to fall back to a network execution path. No SDLC network exists, so this fallback failed. A network version of the SDLC Triage provides:

1. **Redundancy** — if `workflow-execute` is down, `network-execute` may still work
2. **Visibility** — networks show real-time agent coordination in the Coordinate dashboard
3. **Extensibility** — networks can dynamically add/remove agent nodes without modifying a workflow definition

### Root Cause

`scripts/seed-sdlc-playbook.ts` creates 4 agents and 3 workflows but zero networks. The SDLC Triage is modeled only as a workflow.

### Implementation

Add an SDLC Triage network definition to `seed-sdlc-playbook.ts`:

```typescript
const triageNetwork = {
    name: "SDLC Triage",
    slug: `sdlc-triage-network-${orgSlug}`,
    description: "Routes incoming tickets to the correct SDLC sub-agent based on classification.",
    topology: {
        nodes: [
            {
                id: "intake",
                type: "router",
                name: "Ticket Intake",
                description: "Receives the raw ticket and routes to classifier",
                agentSlug: classifierAgent.slug
            },
            {
                id: "bugfix",
                type: "agent",
                name: "Bugfix Handler",
                agentSlug: `sdlc-planner-${orgSlug}`, // Planner in bugfix mode
                condition: "classification.type === 'bug'"
            },
            {
                id: "feature",
                type: "agent",
                name: "Feature Handler",
                agentSlug: `sdlc-planner-${orgSlug}`, // Planner in feature mode
                condition: "classification.type === 'feature'"
            }
        ],
        edges: [
            { from: "intake", to: "bugfix", condition: "type === 'bug'" },
            { from: "intake", to: "feature", condition: "type === 'feature'" }
        ]
    },
    isActive: true,
    isPublished: true
};
```

This mirrors the SDLC Triage workflow topology but uses the network execution engine.

### Files Changed

- `scripts/seed-sdlc-playbook.ts` (add network creation section)

---

## Implementation Order

The fixes are ordered by dependency and impact:

```
Fix 1 (P0) ─── workflow tools load
    │
    ├── Fix 2 (P1) ─── correct slug in prompt
    │       │
    │       └── Fix 3 (P1) ─── agent knows which tool to use
    │               │
    │               └── Fix 8 (P2) ─── workflows themselves succeed
    │
    ├── Fix 7 (P2) ─── prevents regression across orgs
    │
    └── Fix 9 (P3) ─── redundant execution path

Fix 4 (P2) ─── debug bar gating (independent)
Fix 5 (P2) ─── org switcher a11y (independent)
Fix 6 (P2) ─── test user script (independent)
```

**Minimum viable fix** to unblock the SDLC pipeline: Fix 1 + Fix 2 + Fix 3. These three changes together ensure the concierge has the tools, knows the slug, and selects the right tool.
