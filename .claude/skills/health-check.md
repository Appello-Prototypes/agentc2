# System Health Check

**Trigger**: User asks to check system health, verify everything is running, or diagnose system-wide issues.

**Description**: Verifies all components of the AgentC2 system are operational.

## Instructions

Run these checks systematically. Report status for each component.

### 1. Database connectivity

```bash
bun run db:studio &
# Or check via prisma
cd packages/database && bunx prisma db execute --stdin <<< "SELECT 1" 2>&1
```

Check if PostgreSQL is reachable.

### 2. Dev server status

```bash
lsof -i :3000 -P -n | head -5   # Frontend
lsof -i :3001 -P -n | head -5   # Agent app
lsof -i :8288 -P -n | head -5   # Inngest dev server
```

Check which services are running.

### 3. MCP server connectivity

Load and call these MCP tools to verify connectivity:

- `mcp__AgentC2-AgentC2__live_stats` — Platform health
- `mcp__AgentC2-AgentC2__live_runs` — Active runs

### 4. Agent system status

- `mcp__AgentC2-AgentC2__agent_list` — List all agents
- `mcp__AgentC2-AgentC2__agent_analytics` — Agent performance metrics

### 5. Build health

```bash
bun run type-check 2>&1 | tail -5
```

Quick check for type errors.

### 6. Git status

```bash
git status
git log --oneline -3
```

Check for uncommitted changes and recent activity.

### 7. Environment check

Verify critical env vars are set (do NOT print values, just check existence):

```bash
[ -n "$DATABASE_URL" ] && echo "DATABASE_URL: SET" || echo "DATABASE_URL: MISSING"
[ -n "$ELEVENLABS_API_KEY" ] && echo "ELEVENLABS_API_KEY: SET" || echo "ELEVENLABS_API_KEY: MISSING"
[ -n "$FIRECRAWL_API_KEY" ] && echo "FIRECRAWL_API_KEY: SET" || echo "FIRECRAWL_API_KEY: MISSING"
[ -n "$INNGEST_EVENT_KEY" ] && echo "INNGEST_EVENT_KEY: SET" || echo "INNGEST_EVENT_KEY: MISSING"
```

### 8. Report

Present a summary table:

| Component        | Status      | Notes |
| ---------------- | ----------- | ----- |
| Database         | OK/FAIL     | ...   |
| Frontend (3000)  | OK/FAIL     | ...   |
| Agent App (3001) | OK/FAIL     | ...   |
| Inngest (8288)   | OK/FAIL     | ...   |
| MCP Servers      | OK/FAIL     | ...   |
| Build            | OK/FAIL     | ...   |
| Git              | Clean/Dirty | ...   |

Flag any issues and suggest fixes.
