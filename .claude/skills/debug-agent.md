# Debug Agent

**Trigger**: User reports an agent isn't working, gives wrong responses, can't use tools, or has other issues.

**Description**: Systematic agent debugging workflow to identify and fix issues.

## Instructions

### Step 1: Identify the agent

Get the agent slug and workspace. Then check if it exists:

- Load and call `mcp__AgentC2-AgentC2__agent_discover` with the agent slug
- Or query the database directly

### Step 2: Check agent configuration

Load `mcp__AgentC2-AgentC2__agent_overview` to get the full agent config:

- Are instructions present and coherent?
- Is the model provider configured correctly?
- Are API keys set up for the model provider? (Check Settings > Integrations)
- Is memory enabled/disabled as expected?

### Step 3: Check tool availability

- List the agent's assigned tools
- For each MCP tool, verify the MCP server is connected
- Check that required API keys/tokens are set in `.env`
- Test individual tools using `mcp__AgentC2-AgentC2__integration_tools_list`

### Step 4: Check recent runs

Load and call `mcp__AgentC2-AgentC2__agent_runs_list` to see recent executions:

- Are there errors in recent runs?
- What was the last successful run?
- Check `mcp__AgentC2-AgentC2__agent_run_trace` for detailed trace of a specific run

### Step 5: Check conversations

If the issue is about wrong responses:

- Load `mcp__AgentC2-AgentC2__conversation_list` to find recent conversations
- Load `mcp__AgentC2-AgentC2__conversation_get` to read message history
- Look for context issues, instruction conflicts, or memory problems

### Step 6: Check system health

- `mcp__AgentC2-AgentC2__live_stats` — Overall system stats
- `mcp__AgentC2-AgentC2__live_runs` — Currently executing runs
- `mcp__AgentC2-AgentC2__agent_costs` — Check if hitting cost limits

### Step 7: Common fixes

- **Agent not found**: Check slug is correct, check workspace scope
- **Tools not working**: Verify MCP server env vars, restart dev server
- **Wrong model**: Check `modelProvider` and `modelName` fields
- **Memory issues**: Check `memoryEnabled` and `memoryConfig`
- **Slow responses**: Check model, reduce tool count, check for loops in instructions
- **API key errors**: AI provider keys come from IntegrationConnection records, NOT env vars

### Step 8: Test the fix

After making changes, test the agent:

- Send a test message via the UI or API
- Verify the specific issue is resolved
- Check that no new issues were introduced
