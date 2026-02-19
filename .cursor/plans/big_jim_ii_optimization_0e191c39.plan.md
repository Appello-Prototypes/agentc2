---
name: Big Jim II Optimization
overview: Trim Big Jim II's 51 direct tools down to ~12 coordinator essentials, attach platform skills as discoverable for on-demand capability expansion, and set a tool budget as a safety net.
todos:
    - id: strip-tools
      content: Remove 39 non-essential tools from Big Jim II via agent_update
      status: completed
    - id: attach-skills
      content: Attach ~15 platform skills as discoverable (pinned=false) via agent_attach_skill
      status: completed
    - id: update-metadata
      content: Set maxToolsLoaded=20 and trim alwaysLoadedTools in metadata
      status: completed
    - id: update-instructions
      content: Add skill-activation guidance to Big Jim II's instructions
      status: completed
    - id: verify
      content: Test Big Jim II with a 'hey' message and verify correct routing + reduced tokens
      status: completed
isProject: false
---

# Big Jim II Tool Optimization

## Problem

Big Jim II is a network-first coordinator agent, but he loads **51 tools** on every request (~20,000 prompt tokens just for tool schemas). His job is to delegate to specialist agents via 5 networks (`biz-ops`, `comms`, `research-intel`, `platform-admin`, `customer-operations`), yet he carries the weight of tools that belong to specialists.

A simple "hey" costs 33,697 prompt tokens and 16+ seconds.

## Strategy

Two complementary changes:

1. **Strip direct tools** to coordinator essentials only (~12 tools)
2. **Attach platform skills as discoverable** so Big Jim II can activate them on demand via meta-tools when he needs to do something himself (e.g., create an agent, manage campaigns)

## Step 1: Tool Trim

Remove 39 tools from Big Jim II's `AgentTool` records via `agent_update`. Keep only what a coordinator needs:

**Keep (12 tools):**

- `network-execute` -- his primary delegation mechanism
- `memory-recall` -- remembering people/context
- `date-time` -- knowing the time
- `calculator` -- basic math
- `rag-query` -- searching knowledge base
- `document-search` -- finding documents
- `backlog-list-tasks` -- checking his to-do list
- `backlog-add-task` -- adding to-dos
- `backlog-complete-task` -- completing to-dos
- `backlog-get` -- reading backlog details
- `backlog-update-task` -- updating to-dos
- `search-skills` -- discovering available skills
- `activate-skill` -- loading a skill on demand
- `list-active-skills` -- seeing what's loaded

**Remove (39 tools):**

- `network-list-runs`, `network-get-run`, `network-read`, `network-create`, `network-update` -- delegate to `platform-admin`
- `agent-list`, `agent-read`, `agent-create`, `agent-update`, `agent-overview`, `agent-costs`, `agent-budget-update` -- available via `platform-agent-management` skill
- `skill-create`, `skill-update`, `skill-list`, `skill-read`, `skill-attach-tool`, `skill-attach-document` -- available via `platform-skill-management` skill
- `document-create`, `document-read`, `document-update` -- available via `platform-knowledge-management` skill (keep `document-search` as core)
- `trigger-unified-create`, `trigger-unified-list`, `trigger-unified-enable`, `trigger-unified-disable` -- available via `platform-triggers-schedules` skill
- `campaign-create`, `campaign-list`, `campaign-get`, `campaign-update` -- available via a campaign skill (already exists: `campaign-analysis`, etc.)
- `execute-code`, `write-workspace-file`, `read-workspace-file`, `list-workspace-files` -- available via `core-utilities` skill
- `web-fetch`, `json-parser`, `generate-id`, `tool-registry-list` -- available via `core-utilities` skill

## Step 2: Attach Skills as Discoverable

Attach existing platform skills to Big Jim II with `pinned: false` (discoverable). When he needs a capability, he uses `search-skills` / `activate-skill` to load it on demand. The skill's tools and instructions get injected into the conversation for that thread.

**Skills to attach (all discoverable, pinned=false):**

| Skill Slug                      | Tools | When Needed                 |
| ------------------------------- | ----- | --------------------------- |
| `platform-agent-management`     | 6     | Creating/managing agents    |
| `platform-skill-management`     | 12    | Building skills             |
| `platform-knowledge-management` | 10    | Managing documents/RAG      |
| `platform-triggers-schedules`   | 7     | Setting up triggers         |
| `platform-network-management`   | 5     | Creating/modifying networks |
| `platform-network-execution`    | 5     | Monitoring network runs     |
| `platform-canvas-dashboards`    | 8     | Building dashboards         |
| `platform-observability`        | 14    | Monitoring agent runs/costs |
| `platform-learning`             | 8     | Agent learning sessions     |
| `platform-simulations`          | 3     | Running simulations         |
| `platform-quality-safety`       | 10    | Quality/guardrails          |
| `core-utilities`                | 4     | Code execution, web fetch   |
| `platform-goals`                | 3     | Goal management             |
| `platform-integrations`         | 6     | Managing MCP connections    |
| `campaign-analysis`             | 2     | Campaign decomposition      |

This gives Big Jim II access to ~100+ tools via skills, loaded only when relevant.

## Step 3: Update Metadata

- Set `maxToolsLoaded: 20` as a safety net
- Trim `alwaysLoadedTools` to match the new core set
- Keep meta-tools (`search-skills`, `activate-skill`, `list-active-skills`) in always-loaded

## Step 4: Verify Instructions

Big Jim II's instructions already have a "When to Do It Yourself" section that mentions agent creation, campaigns, etc. Add a note that these capabilities are available via skills he can activate on demand.

## Expected Impact

| Metric                              | Before              | After                        |
| ----------------------------------- | ------------------- | ---------------------------- |
| Tools in prompt (simple "hey")      | 51 (~20,000 tokens) | ~~14 (~~5,600 tokens)        |
| Prompt token overhead               | ~33,000             | ~12,000                      |
| Capability (total accessible tools) | 51                  | ~100+ (via skill activation) |
| First response latency              | ~16s                | ~5-7s (estimated)            |

## Execution

All changes made via MCP tools (`agent_update`, `agent_attach_skill`, `agent_detach_skill`). No code changes required. Fully reversible via agent versioning.
