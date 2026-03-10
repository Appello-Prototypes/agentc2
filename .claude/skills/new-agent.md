# Create New Agent

**Trigger**: User asks to create a new AI agent, add an agent, or set up a new agent.

**Description**: Creates a new database-driven agent with proper configuration following all project conventions.

## Instructions

### Step 1: Gather requirements

Ask the user (if not already specified):

- **Name**: Human-readable name (e.g., "Research Assistant")
- **Slug**: URL-safe identifier (e.g., "research-assistant")
- **Purpose**: What the agent does — this informs the instructions
- **Model**: Which LLM to use (default: `gpt-4o` for OpenAI, `claude-sonnet-4-20250514` for Anthropic)
- **Tools**: Which tools the agent needs access to
- **Workspace**: Which workspace to create the agent in

### Step 2: Understand the schema

Read the Agent model from the Prisma schema:

```bash
Read packages/database/prisma/schema.prisma
```

Search for `model Agent` to understand all available fields.

### Step 3: Check existing agents for patterns

Use the AgentC2 MCP tools to list existing agents:

- Load `mcp__AgentC2-AgentC2__agent_list` tool
- Call it to see existing agent configurations as reference

### Step 4: Check the tool registry

Read the tool registry to find available tools:

```bash
Read packages/agentc2/src/tools/registry.ts
```

List tools relevant to the agent's purpose.

### Step 5: Write agent instructions

Draft comprehensive instructions for the agent. Good instructions include:

- Clear role definition
- Specific capabilities and limitations
- Tone and communication style
- When to use which tools
- Error handling guidance

### Step 6: Create the agent

Use the appropriate method:

- **Via API/MCP**: Use the platform tools if available
- **Via database**: Insert directly using Prisma if needed
- **Via UI**: Guide the user to the agent creation page

### Step 7: Test the agent

- Verify the agent resolves: check via `agent_discover` or the UI
- Send a test message to confirm it responds correctly
- Verify tools are accessible

## Agent Configuration Checklist

- [ ] Unique slug within workspace
- [ ] Clear, comprehensive instructions
- [ ] Appropriate model selected
- [ ] Required tools attached
- [ ] Memory enabled if conversational
- [ ] Temperature set appropriately (0.0-0.3 for factual, 0.5-0.7 for creative)
- [ ] Metadata configured (including Slack identity if applicable)
