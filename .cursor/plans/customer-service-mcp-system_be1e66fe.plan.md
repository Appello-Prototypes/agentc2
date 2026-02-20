---
name: customer-service-mcp-system
overview: Design and build a multi-agent customer service system using only Mastra MCP CRUD tools, then run two test/refine cycles using network execution tools.
todos:
    - id: brainstorm-flow
      content: Draft CS flow stages + confirmation policy
      status: completed
    - id: create-subagents
      content: Create triage/CRM/ticketing/transcript/automation agents
      status: completed
    - id: create-network
      content: Create MCP network with routing + outputs
      status: completed
    - id: test-refine-1
      content: Run Test Round 1 and refine agents/network
      status: completed
    - id: test-refine-2
      content: Run Test Round 2 and finalize refinements
      status: completed
isProject: false
---

# Customer Service MCP System

## Approach

- Brainstorm a customer service flow with clear stages: intake/triage, CRM enrichment, ticketing actions, transcript context, and automation triggers, with a strict confirmation gate before any write actions.
- Implement the system using only MCP CRUD tools (no code changes or DB seeding), relying on the MCP tool schema documented in [docs/mcp-crud-tools-spec.json](/Users/coreyshelson/agentc2/docs/mcp-crud-tools-spec.json).

## Implementation Steps

- Create dedicated sub-agents via MCP:
    - `cs-triage`: classify request type/urgency, extract identifiers, and request missing info.
    - `cs-crm`: use HubSpot tools to fetch contact/deal context and summarize relevant fields.
    - `cs-ticketing`: use Jira tools to search/create issues and propose next steps.
    - `cs-transcripts`: use Fathom tools to pull recent call summaries when relevant.
    - `cs-automation`: use ATLAS tools to trigger predefined workflows when approved.
- Create a network via MCP with these agents as primitives and routing instructions that:
    - Always run triage first.
    - Call CRM/ticketing/transcripts only when inputs suggest they are needed.
    - Require explicit confirmation before any write action (Jira/HubSpot/ATLAS).
    - Produce two outputs: customer-facing response and internal summary/action plan.

## Testing and Refinement

- Test Round 1: execute the network with 2–3 realistic scenarios (billing/refund, technical issue, feature request) using `network_execute` and inspect runs via `network_get_run`.
- Refine Round 1: update agent instructions and/or network routing based on gaps (e.g., missing confirmations, weak summaries) using `agent_update` and `network_update`.
- Test Round 2: re-run scenarios (plus one edge case) and review outputs.
- Refine Round 2: final adjustments to instructions, tool usage guidance, and response structure.

## Notes

- All creation/updates will be performed through MCP CRUD tools only (no file edits, no manual DB seeding).
- The system will be optimized for web-chat output tone and clarity.
