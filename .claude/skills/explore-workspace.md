# Explore Workspace

**Trigger**: User asks about a workspace's agents, tools, workflows, or configuration. Or when you need to understand a workspace before making changes.

**Description**: Deep dive into a specific AgentC2 workspace to understand its agents, tools, workflows, and configuration.

## Instructions

### Step 1: Identify the workspace

Determine which workspace to explore. Available workspaces can be found via:

- `mcp__AgentC2-AgentC2__org_list` — List organizations
- `mcp__AgentC2-AgentC2__platform_context` — Get platform context

The MCP server names hint at workspaces: `AgentC2-AgentC2`, `AgentC2-Appello`, `AgentC2-GolfCaddie`.

### Step 2: Get workspace overview

For the target workspace, load and call these tools:

- `agent_list` — All agents in the workspace
- `agent_overview` — Detailed view of specific agents
- `agent_analytics` — Performance metrics

### Step 3: Explore agents in detail

For each interesting agent:

- `agent_discover` — Get agent configuration
- `agent_runs_list` — Recent execution history
- `agent_costs` — Cost tracking

### Step 4: Check workflows and networks

- `workflow_read` — Read workflow definitions
- `network_read` — Read network configurations

### Step 5: Check integrations

- `integration_tools_list` — What tools are available to this workspace

### Step 6: Check knowledge base

- `rag_documents_list` — Documents in the RAG system
- `rag_query` — Test a query against the knowledge base

### Step 7: Check conversations and goals

- `conversation_list` — Recent conversations
- `goal_list` — Active goals

### Step 8: Present findings

Summarize as a workspace profile:

**Workspace: [Name]**

- **Agents**: List with slugs, models, and purposes
- **Tools**: Available integrations and native tools
- **Workflows**: Active workflow definitions
- **Knowledge Base**: Document count and topics
- **Recent Activity**: Latest runs and conversations
- **Costs**: Usage and spend summary

## Use this skill proactively

When working on any task that involves a specific workspace, run this exploration first to understand the context. Don't make assumptions about what exists.
