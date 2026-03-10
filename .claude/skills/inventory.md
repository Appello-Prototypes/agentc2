# MCP & Integration Inventory

**Trigger**: User asks what tools/integrations/MCP servers are available, or you need to check before answering questions about capabilities.

**Description**: Thoroughly enumerate ALL available MCP servers, tools, and integrations by actually querying the deferred tools list.

## Instructions

When this skill is invoked:

1. **Scan ALL `mcp__` prefixed tools** from the available-deferred-tools list. Do NOT skim — read every single entry.

2. **Group by unique MCP server prefix**. The server name is the part between `mcp__` and the next `__`. For example:
    - `mcp__Appello-Release__search_jobs` → Server: `Appello-Release`
    - `mcp__AgentC2-Appello__agent_list` → Server: `AgentC2-Appello`
    - `mcp__claude_ai_Slack__slack_send_message` → Server: `claude_ai_Slack`

3. **For each server, report**:
    - Server name
    - Tool count
    - Key capability categories (e.g., "CRUD for jobs, users, timesheets")

4. **Separate into categories**:
    - **AgentC2 Platform** — `AgentC2-*` servers (platform management per workspace)
    - **Appello Direct API** — `Appello-*` servers (direct Appello product API)
    - **Third-Party Integrations** — `Firecrawl`, `GitHub`, `Gmail`, `Hubspot`, `Jira`, `JustCall`, `Fathom`, `Slack`, `GoogleCalendar`, `GoogleWorkspace`, `Playwright`, `Wave-Accounting`
    - **Claude Built-in Integrations** — `claude_ai_*` servers

5. **Present as a clean table** with server name, tool count, and description.

## Why This Exists

To prevent lazy/incomplete scanning of available tools. Every MCP server matters — missing one means missing capabilities the user is paying for.
