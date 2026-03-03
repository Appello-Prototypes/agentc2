---
name: "Patterns Book — Plan 1: Security Hardening"
overview: "Wire dead-code access control, expand guardrail coverage to all agent entry points, mitigate the lethal trifecta, implement toxicity blocking, and add output retry on guardrail failure. Addresses Patterns 18 (Lethal Trifecta), 20 (Granular Access Control), and 21 (Guardrails)."
todos:
    - id: phase-1-wire-access-control
      content: "Phase 1: Wire tool permission checks and MCP access-level enforcement into the execution path"
      status: pending
    - id: phase-2-guardrail-coverage
      content: "Phase 2: Expand guardrail enforcement to ALL agent entry points (workflows, networks, Slack, channels, etc.)"
      status: pending
    - id: phase-3-lethal-trifecta
      content: "Phase 3: Implement lethal trifecta mitigation — tool-combo guardrails and high-risk flow detection"
      status: pending
    - id: phase-4-toxicity
      content: "Phase 4: Implement blockToxicity in output guardrails"
      status: pending
    - id: phase-5-output-retry
      content: "Phase 5: Add output retry on guardrail failure instead of hard block"
      status: pending
isProject: false
---

# Plan 1: Security Hardening

**Book Patterns:** 18 (Prevent the Lethal Trifecta), 20 (Granular Agent Access Control), 21 (Agent Guardrails)

**Priority:** Critical — active vulnerabilities in production code

---

## Phase 1: Wire Tool Permission Checks

**Problem:** `checkToolPermission()` in `packages/agentc2/src/security/tool-permissions.ts` (lines 17–46) exists but is never called. `AgentToolPermission` records in the database have zero effect. `checkEgressPermission()` in `packages/agentc2/src/security/egress-control.ts` (lines 13–56) is also never called.

### 1.1 Create a unified tool execution interceptor

**File:** `packages/agentc2/src/security/tool-execution-guard.ts` (new)

Create a wrapper function that intercepts tool calls before execution:

```typescript
export async function guardToolExecution(params: {
    agentId: string;
    toolId: string;
    organizationId?: string;
    userId?: string;
    accessLevel?: "member" | "admin";
}): Promise<{ allowed: boolean; reason?: string }>;
```

This function should:

- Call `checkToolPermission()` with the agent's `AgentToolPermission` records
- Check the access matrix from `apps/agent/src/lib/security/access-matrix.ts`
- Call `checkEgressPermission()` for tools that make external requests
- Return `{ allowed: false, reason }` if any check fails

### 1.2 Wire into MCP tool execution

**File:** `packages/agentc2/src/mcp/client.ts`

The MCP client creates toolset objects that agents use directly. The interception point is where MCP tools are resolved and wrapped for agent use.

- Find `getMcpToolsCached()` and the tool-wrapping logic
- Wrap each MCP tool's `execute` function with `guardToolExecution`
- Pass the current `organizationId`, `userId`, and `accessLevel` from the resolution context

### 1.3 Wire into native tool execution

**File:** `packages/agentc2/src/agents/resolver.ts`

In `hydrate()` (lines 437–441) where tools are loaded:

- After resolving tools via `getToolsByNamesAsync`, wrap each tool's execute function with `guardToolExecution`
- The `RequestContext` already carries `userId`, `tenantId`, and `workspaceId` — use these

### 1.4 Populate AgentToolPermission records

**File:** `packages/database/prisma/seed.ts` or migration

- For each system agent, create default `AgentToolPermission` records
- Default: all tools at `read_only` unless explicitly configured otherwise
- Admin-level tools (execute-code, agent-create, etc.): require `admin` access level

### 1.5 Add permission management UI

**File:** `apps/agent/src/app/agents/[agentSlug]/settings/`

- Add a "Tool Permissions" tab to agent settings
- List all tools assigned to the agent with their current permission level
- Allow setting per-tool permission: `read_only`, `write`, `spend`, `full`

---

## Phase 2: Expand Guardrail Coverage via Mastra Processors

**Problem:** Guardrails (`enforceInputGuardrails` / `enforceOutputGuardrails`) are only called from 3 locations:

- `apps/agent/src/app/api/agents/[id]/chat/route.ts` (lines 411, 1206)
- `apps/agent/src/app/api/agents/[id]/invoke/route.ts` (lines 389, 713)
- `apps/agent/src/lib/inngest-functions.ts` (lines 5580, 5606)

The following entry points **bypass guardrails entirely**:

- `apps/agent/src/app/api/agents/[id]/chat/public/route.ts`
- `apps/agent/src/app/api/agents/[id]/voice/route.ts`
- `apps/agent/src/app/api/agents/[id]/test/route.ts`
- `apps/agent/src/app/api/agents/[id]/runs/route.ts`
- `apps/agent/src/app/api/agents/[id]/runs/[runId]/rerun/route.ts`
- `apps/agent/src/app/api/slack/events/route.ts`
- `apps/agent/src/app/api/channels/voice/_service.ts`
- `apps/agent/src/app/api/channels/whatsapp/_service.ts`
- `apps/agent/src/app/api/channels/telegram/webhook/route.ts`
- `apps/agent/src/app/api/channels/outbound/route.ts`
- `apps/agent/src/app/api/webhooks/chat/route.ts`
- `apps/agent/src/app/api/a2a/route.ts`
- `apps/agent/src/app/api/federation/invoke/route.ts`
- Workflow agent calls: `packages/agentc2/src/workflows/builder/runtime.ts` (line 298)
- Network agent calls: `packages/agentc2/src/networks/runtime.ts`

### KEY INSIGHT: Use Mastra's native `inputProcessors` / `outputProcessors`

Mastra's `Agent` constructor supports `inputProcessors` and `outputProcessors` — middleware that intercepts messages before/after the LLM. The Prisma schema already has `inputProcessors` and `outputProcessors` fields on `MastraAgentVersion` (lines 1221–1222), but the resolver **does not pass them** when constructing agents.

By wiring guardrails as Mastra processors, every call to `agent.generate()` or `agent.stream()` — regardless of entry point — is automatically protected.

### 2.1 Create guardrail processors compatible with Mastra

**File:** `packages/agentc2/src/guardrails/processors.ts` (new)

Implement Mastra-compatible input/output processors that wrap the existing `enforceInputGuardrails` / `enforceOutputGuardrails` logic:

```typescript
import type { InputProcessor, OutputProcessor } from "@mastra/core";

export function createGuardrailInputProcessor(config: ResolvedGuardrailConfig): InputProcessor {
    return {
        name: "agentc2-guardrails-input",
        process: async (message) => {
            const result = enforceInputGuardrails(message.content, config);
            if (!result.passed) throw new GuardrailBlockedError(result.violations);
            return message;
        }
    };
}

export function createGuardrailOutputProcessor(config: ResolvedGuardrailConfig): OutputProcessor {
    return {
        name: "agentc2-guardrails-output",
        process: async (output) => {
            const result = enforceOutputGuardrails(output.text, config);
            if (!result.passed) throw new GuardrailBlockedError(result.violations);
            return output;
        }
    };
}
```

### 2.2 Wire processors into AgentResolver

**File:** `packages/agentc2/src/agents/resolver.ts`

In `hydrate()`, when constructing the Mastra Agent config (around lines 630–648), add:

```typescript
const guardrailConfig = await resolveGuardrailConfig(record, requestContext);
const agentConfig = {
    // ... existing config
    inputProcessors: [createGuardrailInputProcessor(guardrailConfig)],
    outputProcessors: [createGuardrailOutputProcessor(guardrailConfig)]
};
```

This ensures ALL callers of `resolve()` get guardrail-protected agents automatically, regardless of entry point.

### 2.3 Remove point-of-use guardrail calls

Once processors are wired into the resolver, the point-of-use calls in `/chat`, `/invoke`, and Inngest become redundant. Remove them to avoid double-checking and reduce code duplication.

---

## Phase 3: Lethal Trifecta Mitigation

**Problem:** AgentC2 has all three legs: private data (CRM, email, RAG), untrusted content (web-fetch, user input), and external communication (email send, Slack post). No mitigation exists for high-risk tool combinations.

### 3.1 Extend existing tool metadata for capability tags

**NOTE:** `toolBehaviorMap` in `packages/agentc2/src/tools/registry.ts` (lines 814–864) already classifies tools as `query` vs `mutation`. Extend this existing taxonomy rather than creating a parallel system.

**File:** `packages/agentc2/src/tools/registry.ts`

Extend `ToolBehaviorMeta` to include security-relevant capabilities:

```typescript
export type ToolCapability =
    | "reads_private_data" // CRM, email, RAG, database
    | "ingests_untrusted" // web-fetch, file upload, user content
    | "external_communication" // email send, Slack post, webhook
    | "code_execution" // sandbox, calculator
    | "state_mutation"; // database write, file write (already captured by behavior: "mutation")

export interface ToolBehaviorMeta {
    behavior: ToolBehaviorType;
    outputContentPath?: string;
    capabilities?: ToolCapability[]; // NEW: security capability tags
}
```

Populate capabilities in the existing `toolBehaviorMap` entries. For MCP tools, derive capabilities from tool descriptions or require explicit tagging in the MCP configuration.

### 3.2 Implement trifecta detection

**File:** `packages/agentc2/src/security/trifecta-guard.ts` (new)

During agent resolution, analyze the tool set for lethal combinations:

```typescript
export function detectLethalTrifecta(toolIds: string[]): {
    hasPrivateData: boolean;
    hasUntrustedContent: boolean;
    hasExternalComms: boolean;
    isLethal: boolean;
    recommendation: string;
};
```

### 3.3 Enforce trifecta policy

**File:** `packages/agentc2/src/guardrails/index.ts`

Add to `GuardrailConfig`:

```typescript
trifectaPolicy?: "warn" | "require_approval" | "block";
```

- `warn`: Log warning, allow execution
- `require_approval`: Suspend execution, require human approval for runs that use all three legs
- `block`: Prevent agent from being configured with all three capability types

Wire detection into `withGuardrails` middleware from Phase 2.

### 3.4 Add trifecta warning to agent configuration UI

**File:** `apps/agent/src/app/agents/[agentSlug]/settings/`

When an agent's tool set triggers the lethal trifecta, display a warning banner with the recommendation. Allow the admin to acknowledge and set the policy.

---

## Phase 4: Implement blockToxicity

**Problem:** `blockToxicity` is declared in `GuardrailConfig` (line 28 of guardrails/index.ts), defaults to `false` (line 108), and is merged in org policy (line 220), but is never checked in `enforceOutputGuardrails`.

### 4.1 Add toxicity detection — reuse existing components

**NOTE:** Two toxicity components already exist:

- `TOXICITY_WORDS` in `packages/agentc2/src/scorers/tier1.ts` (lines 41–54) — heuristic word list used in eval scoring
- `createToxicityScorer` from `@mastra/evals` (used in `packages/agentc2/src/scorers/scorer-factory.ts` lines 394–398) — LLM-based scorer

Reuse both for runtime guardrails rather than building from scratch.

**File:** `packages/agentc2/src/guardrails/toxicity.ts` (new)

```typescript
import { TOXICITY_WORDS } from "../scorers/tier1";

export async function checkToxicity(
    text: string,
    mode: "heuristic" | "llm" | "both"
): Promise<{ toxic: boolean; score: number; details?: string }> {
    if (mode === "heuristic" || mode === "both") {
        // Reuse existing TOXICITY_WORDS from tier1.ts
        const lower = text.toLowerCase();
        const found = TOXICITY_WORDS.filter((w) => lower.includes(w));
        if (found.length > 0)
            return { toxic: true, score: 0, details: `Matched: ${found.join(", ")}` };
    }
    if (mode === "llm" || mode === "both") {
        // Reuse createToxicityScorer from @mastra/evals (already in eval pipeline)
        const { createToxicityScorer } = await import("@mastra/evals/scorers/prebuilt");
        const scorer = createToxicityScorer({ model: "openai:gpt-4o-mini" });
        const result = await scorer.score({ output: text });
        if (result.score < 0.5)
            return { toxic: true, score: result.score, details: result.reasoning };
    }
    return { toxic: false, score: 1.0 };
}
```

### 4.2 Wire into output guardrails

**File:** `packages/agentc2/src/guardrails/index.ts`

In `enforceOutputGuardrails`, after the existing checks, add:

```typescript
if (config.output?.blockToxicity) {
    const toxicityResult = await checkToxicity(text, config.output.toxicityMode ?? "heuristic");
    if (toxicityResult.toxic) {
        violations.push({ rule: "toxicity", detail: toxicityResult.details });
    }
}
```

---

## Phase 5: Output Retry on Guardrail Failure

**Problem:** When output guardrails fire, the agent returns a hard block. The book recommends retrying generation to produce a safer output.

### 5.1 Add retry logic to withGuardrails

**File:** `packages/agentc2/src/guardrails/middleware.ts`

In the `withGuardrails` wrapper from Phase 2:

- On output guardrail failure, retry `agent.generate()` up to `maxRetries` (default 2) with an appended system message: "Your previous response was blocked because: {violation}. Please regenerate without: {violation details}."
- If all retries fail, return the guardrail block error
- Log each retry attempt for observability

### 5.2 Add retry configuration

**File:** `packages/agentc2/src/guardrails/index.ts`

Extend `GuardrailConfig`:

```typescript
output?: {
    // ... existing fields
    retryOnBlock?: boolean;   // default: true
    maxRetries?: number;      // default: 2
    retryPrompt?: string;     // custom retry instruction
}
```

---

## Verification

After completing all phases:

1. Write test that creates an agent with `AgentToolPermission` records and confirms tools are blocked/allowed correctly
2. Write test that invokes agent via Slack, voice, webhook, and confirms guardrails fire
3. Write test that configures an agent with all three trifecta legs and confirms warning/block
4. Write test that generates toxic output and confirms retry + eventual block
5. Run `bun run type-check && bun run lint && bun run build`
