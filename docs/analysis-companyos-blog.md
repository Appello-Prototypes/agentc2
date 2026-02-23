# Analysis: "Running a Company on Markdown Files" (Brad Feld, Feb 21 2026)

**Source:** Brad Feld's blog — CompanyOS: a skills-only system that turns Claude Code into the operating layer for an entire company.

---

## Core Thesis

CompanyOS argues that **Claude Code is already a sufficient agent runtime** — it has tool use, memory, context management, and a conversational interface. Therefore, the only missing piece is **domain knowledge**, which can be delivered as structured markdown "skills." No orchestration layer, no workflow engine, no UI. Just `.md` files in a git repo.

---

## Architecture Comparison: CompanyOS vs AgentC2

| Dimension                 | CompanyOS                                  | AgentC2                                        |
| ------------------------- | ------------------------------------------ | ---------------------------------------------- |
| **Runtime**               | Claude Code (IDE)                          | Mastra + Next.js (web platform)                |
| **Agent definition**      | Markdown skill files                       | Database-driven (Prisma/Postgres)              |
| **Orchestration**         | None — relies on Claude's native reasoning | Mastra workflows, Inngest jobs, agent networks |
| **Tool integration**      | MCP servers (same set)                     | MCP servers + native OAuth integrations        |
| **UI**                    | None — terminal only                       | Full web UI with dashboards, chat, admin       |
| **Multi-user**            | Single operator (Brad)                     | Multi-tenant with auth, roles, workspaces      |
| **Deployment**            | Git repo + Claude Code                     | Digital Ocean, PM2, Caddy                      |
| **Guardrails**            | Markdown rules + approval gates            | Agent-level configs, governance, evals         |
| **Telemetry**             | Claude Code hooks → SQL table              | Structured logging, Inngest events, evals      |
| **Offline/degraded mode** | First-class (copy-paste fallback)          | Not a design priority                          |

---

## What He Gets Right

1. **Skills as domain knowledge, not code.** The insight that an AI agent's value comes from _knowing what to do_ rather than _having a framework to do it_ is sharp. His 12 skills are essentially well-structured system prompts with process definitions.

2. **Approval gates on irreversible actions.** The "anything that leaves the building needs a human yes" principle is production-grade thinking. The double-gate pattern (skill-level + global rule) is good defense-in-depth.

3. **Degraded mode as a design forcing function.** Requiring every skill to work without MCP connections is a clever constraint. It separates intelligence from plumbing and makes the system resilient.

4. **Trigger-based activation over explicit invocation.** Users describe intent, skills match via keywords/patterns. This is natural and reduces cognitive load.

5. **Self-measuring telemetry.** The system reporting on its own usage through the same skills that run the business is an elegant closed loop.

---

## Where It Breaks Down (and Where AgentC2 Has the Advantage)

1. **Single-operator ceiling.** CompanyOS works because Brad is the sole user sitting in Claude Code all day. The moment a second person needs access — a co-founder, a support hire, a contractor — the "no UI" constraint becomes a bottleneck. AgentC2's web platform, auth layer, and multi-workspace model solve this.

2. **No persistence beyond files on disk.** Drafts saved to disk, decisions logged to a single SQL table. There's no structured state management, no versioned agent configs, no audit trail beyond git history. AgentC2's Prisma schema with agent versioning, tool registries, and structured metadata is materially more robust.

3. **No agent composition.** "Skills only, no agents orchestrating agents" is presented as a virtue but is actually a scaling limitation. Complex business operations (onboarding a customer, running a launch campaign) require coordinated multi-step processes where one agent's output feeds another's input. AgentC2's networks and workflows handle this.

4. **Context window as a hard ceiling.** With 12 skills, a voice profile, email history, and MCP tool definitions, you're burning significant context on every invocation. At scale (more skills, more history, more integrations), this system will hit context limits. AgentC2 offloads this through database-driven resolution — only the relevant agent config and tools are loaded per request.

5. **No evaluation or learning.** CompanyOS has usage telemetry but no mechanism to evaluate whether the skills are performing well or improving over time. AgentC2's eval framework (`@mastra/evals`) and learning system (Inngest-driven experiment loops) are structurally more mature.

6. **Git repo as deployment artifact.** Shipping markdown files via git is elegant for a solo operator but doesn't support dynamic updates, A/B testing, or rollbacks without git operations. Database-driven agents can be updated, versioned, and rolled back through a UI.

---

## Ideas Worth Stealing

A few patterns from CompanyOS that could strengthen AgentC2:

1. **Standalone/degraded mode for agents.** If an MCP server is unreachable, the agent could still reason about the task and produce copy-paste-ready output rather than hard-failing. This could be a flag on agent configs: `degradedModeEnabled: true` with fallback instructions in the agent's instructions template.

2. **Approval gates as a first-class primitive.** AgentC2 has the `humanApprovalWorkflow` but CompanyOS's pattern of "any edit resets the approval" is a more nuanced UX. Worth considering as a reusable guardrail pattern.

3. **Trigger/intent matching for skill activation.** AgentC2's Slack integration already does basic agent routing via `agent:<slug>` prefixes. Adding keyword/intent-based routing (like CompanyOS's trigger definitions) would make the Slack experience more natural.

4. **Self-referential telemetry.** Having agents that can query their own usage data to produce operational reports is a compelling feature for enterprise customers. The `co-feedback` pattern of "the system reports on how much it's running the business" could be a built-in AgentC2 capability.

---

## Bottom Line

CompanyOS is a **proof of concept for the skills-as-knowledge thesis**, executed well for a single-operator use case. It validates that structured markdown + Claude Code + MCP is a viable operating layer for lightweight business operations.

AgentC2 is building for the next level of complexity — multi-user, multi-agent, persistent state, evaluation, governance — where the "just markdown files" approach doesn't scale. But the core insight that **agents need domain knowledge more than orchestration layers** is worth internalizing. The best agents aren't the ones with the most sophisticated runtime; they're the ones that know exactly what to do.
