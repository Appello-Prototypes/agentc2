# MCP Server Test Report

**Date:** 2026-03-09
**Scope:** All 18 MCP servers configured in `~/.claude/settings.json` (identical to `~/.cursor/mcp.json`)
**Method:** Live tool invocations in both Cursor and Claude Code

---

## Executive Summary

| | Cursor | Claude Code |
|---|--------|-------------|
| **PASS** | 17 | 10 |
| **FAIL** | 1 | 8 |
| **Total** | 18 | 18 |

**Cursor: 94% operational. Claude Code: 56% operational.**

The same configurations produce dramatically different results. 7 servers that work perfectly in Cursor fail silently in Claude Code. The only genuinely broken server is **Appello-Thomas** (fails in both).

---

## Side-by-Side Results

| # | Server | Tools | Cursor | Claude Code | Gap |
|---|--------|-------|--------|-------------|-----|
| 1 | AgentC2-AgentC2 | 259 | PASS — 1 org, 10 agents, $69.79 cost | NOT LOADED — no tools discovered | Claude Code issue |
| 2 | AgentC2-Appello | 308 | PASS — 2 orgs, 4 members | NOT LOADED — no tools discovered | Claude Code issue |
| 3 | AgentC2-GolfCaddie | 253 | PASS — 2 orgs returned | NOT LOADED — no tools discovered | Claude Code issue |
| 4 | AgentC2-Local | ~250 | PASS (when dev server running) | NOT LOADED — no tools discovered | Claude Code issue |
| 5 | HubSpot | 21 | PASS — Corey Shelson, 65+ scopes | PASS — same result | OK |
| 6 | Jira | 52 | PASS — Q21030 project | PASS — same result | OK |
| 7 | Slack | 8 | PASS — #general, #random | PASS — #general | OK |
| 8 | GitHub | 26 | PASS — found Appello-Prototypes/agentc2 | FAIL — `Bad credentials` | Claude Code issue |
| 9 | Firecrawl | 12 | PASS — scraped example.com | PASS — mapped example.com | OK |
| 10 | Fathom | 3 | PASS — meeting 90904867 found | PASS — 10 meetings listed | OK |
| 11 | ATLAS | 1 | PASS — 5 RAG chunks, scores 0.60-0.62 | NOT LOADED — no tools discovered | Claude Code issue |
| 12 | Playwright | 22 | PASS — navigated example.com | PASS — snapshot returned | OK |
| 13 | Gmail | 19 | PASS — 2 emails returned | PASS — 1 email returned | OK |
| 14 | Google Calendar | 13 | PASS — 3 calendars | PASS — 3 calendars | OK |
| 15 | Google Workspace | 8 | PASS — 2 Drive files found | PASS — 1 Drive file found | OK |
| 16 | JustCall | 66 | PASS — 23 calls, recordings | PASS — 2 users listed | OK |
| 17 | Wave Accounting | 9 | PASS — 8 businesses | NOT LOADED — no tools discovered | Claude Code issue |
| 18 | Appello-Release | 226 | PASS — admin auth, full permissions | NOT LOADED — no tools discovered | Claude Code issue |
| 19 | Appello-Thomas | 0 | FAIL — server errored, 0 tools | NOT LOADED | Genuinely broken |

---

## Claude Code Failures (7 servers that work in Cursor)

### 1. AgentC2 Servers (AgentC2, Appello, GolfCaddie, Local) — 253-308 tools each

- **Transport:** stdio (node process → fetches tools from `https://agentc2.ai/api/mcp`)
- **Cursor:** Works perfectly. Returns 253-308 tools per org.
- **Claude Code:** Zero tools discovered. Server script starts (confirmed: prints "AgentC2 MCP Server started"), API responds with 200 OK and valid tool JSON.
- **Probable cause:** Tool count (253-308) or response payload size (228KB for Appello). All other working Claude Code servers have 1-66 tools. These are 4-5x larger.

### 2. Appello-Release — 226 tools

- **Transport:** Streamable HTTP MCP (`url` + `headers`)
- **Cursor:** Works. Authenticated as Admin Istrator with Super Admin + Admin roles and hundreds of permissions.
- **Claude Code:** Zero tools. Manual curl test shows server requires MCP session handshake (POST without session ID to initialize).
- **Probable cause:** Claude Code's HTTP MCP client doesn't properly negotiate Streamable HTTP sessions. JustCall (also `url` + `headers`) works but uses simpler HTTP, not the full Streamable HTTP MCP protocol.

### 3. ATLAS — 1 tool

- **Transport:** SSE (`url` only, no headers)
- **Cursor:** Works. `Query_ATLAS` returns RAG knowledge chunks from Fathom meeting summaries.
- **Claude Code:** Zero tools.
- **Probable cause:** SSE transport. Claude Code docs say SSE is deprecated. n8n exposes MCP via SSE.

### 4. Wave Accounting — 9 tools

- **Transport:** stdio (Python process)
- **Cursor:** Works. Lists 8 businesses, pagination functional.
- **Claude Code:** Zero tools. Manual test confirms server starts successfully, connects to Wave API, finds 8 businesses.
- **Probable cause:** Startup timing. Wave's Python server makes an HTTP call to `gql.waveapps.com` during initialization. Claude Code may have a shorter startup timeout than Cursor.

### 5. GitHub — 26 tools

- **Transport:** stdio (npx)
- **Cursor:** Works. Found `Appello-Prototypes/agentc2` repo. Org is `Appello-Prototypes`, not `AgentC2`.
- **Claude Code:** Tools load (26 tools visible), but all API calls fail with `Authentication Failed: Bad credentials`.
- **Probable cause:** Same PAT (`ghp_WDPw...`) in both configs, but Claude Code gets rejected. May be an env var passthrough issue or PAT scope difference in how Claude Code invokes npx.

---

## Genuinely Broken (1 server)

### Appello-Thomas

- **Fails in both Cursor and Claude Code**
- Cursor reports: "The MCP server errored" with 0 tools
- Endpoint: `https://thomas-api.useappello.app/mcp`
- **Action needed:** Check Appello Thomas environment health / reconnect in Cursor Settings

---

## Recommendations

### Fix ATLAS now (easy)

Change from SSE URL to stdio with supergateway proxy in `~/.claude/settings.json`:

```json
"ATLAS": {
  "command": "/Users/coreyshelson/.nvm/versions/node/v24.11.1/bin/npx",
  "args": ["-y", "supergateway", "--sse", "https://useappello.app.n8n.cloud/mcp/dfbad0dd-acf3-4796-ab7a-87fdd03f51a8/sse"]
}
```

### Fix Wave Accounting (try timeout)

Start Claude Code with longer MCP timeout:
```bash
MCP_TIMEOUT=15000 claude
```

### Fix Appello-Release (needs proxy)

Wrap Streamable HTTP in a stdio proxy, similar to ATLAS supergateway approach. Or wait for Claude Code to support Streamable HTTP negotiation.

### Fix AgentC2 servers (needs investigation)

Options:
- Create a slimmed-down MCP server variant that exposes only the top 50 most-used tools instead of 250-308
- Test if Claude Code has a documented tool count limit
- Try `MCP_TIMEOUT` increase in case it's a loading time issue rather than count limit

### Fix GitHub (investigate PAT)

The same PAT works in Cursor but fails in Claude Code. Check:
- Whether Claude Code passes `GITHUB_PERSONAL_ACCESS_TOKEN` env var correctly to the npx subprocess
- Try running manually: `GITHUB_PERSONAL_ACCESS_TOKEN=ghp_WDPw... npx -y @modelcontextprotocol/server-github` and see if it authenticates

### Fix Appello-Thomas (server-side)

This is genuinely broken. Check the Thomas API environment at `https://thomas-api.useappello.app/mcp`.

---

## Observations

1. **Google Workspace requires Drive query syntax** — plain text queries return 400. Must use `name contains 'X'` format.
2. **Fathom has no list endpoint in Cursor** — all 3 Cursor tools need a `meeting_id`. Claude Code's Fathom server exposes 4 tools including `list_meetings`.
3. **GitHub org is `Appello-Prototypes`** — not `AgentC2`. Queries with `org:AgentC2` return 422.
4. **JustCall is the richest third-party server** at 66 tools, followed by Jira (52) and GitHub (26).
5. **Total tools across all servers: ~1,106** (in Cursor where all load).
