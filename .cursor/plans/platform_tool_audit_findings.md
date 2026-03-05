# Platform Tool Audit — Issue List

**Date:** March 5, 2026
**Scope:** All 10 agents, 12 integration connections, runtime traces
**Auditor:** Cursor AI (manual trace analysis)

---

## Summary

| Severity  | Count  |
| --------- | ------ |
| CRITICAL  | 1      |
| HIGH      | 3      |
| MEDIUM    | 5      |
| LOW       | 2      |
| **Total** | **11** |

---

## CRITICAL

### TOOL-001: Playwright Browser Tools Completely Unavailable

- **Severity:** CRITICAL
- **Status:** Open
- **Agents Affected:** Golf Caddie, any agent with `mcp-web-playwright` skill
- **Description:** All 29 Playwright browser automation tools (`playwright_browser_click`, `_navigate`, `_snapshot`, `_fill_form`, etc.) fail to load at runtime. No Playwright integration connection exists on the platform.
- **Impact:** Golf Caddie's entire booking flow relies on Playwright to navigate TeeOn's servlet-based web UI. Without these tools, the agent cannot search availability, log in, or book tee times — its primary purpose.
- **Evidence:** Golf Caddie run `cmmdy9xb8088l8epfhknbno8c` — `toolHealth.loadedCount: 53`, `expectedCount: 83`, `missingTools` includes all 29 `playwright_browser_*` entries.
- **Fix:** Create a Playwright integration connection on the platform, or ensure the Playwright MCP server is running and registered on the production server.

---

## HIGH

### TOOL-002: Built-in `agent-overview` Tool Returns "Agent not found"

- **Severity:** HIGH
- **Status:** Open
- **Agents Affected:** BigJim2
- **Description:** The built-in `agent-overview` tool returns "Agent not found" when BigJim2 calls it with both its own slug (`bigjim2-agentc2-q9sxjn`) and its own database ID (`cmmbfrmjz00058enigv6pkgw4`). This is a platform-level bug, not an MCP issue.
- **Impact:** BigJim2 cannot perform cost self-audits, monitor its own run counts, or check its own success rate — all core to its self-improvement loop. Likely also affects `agent-budget-get` and other self-referencing tools.
- **Evidence:** Run `cmmdtzh2y07538epfk193o81u` — Steps 1-4 show two attempts returning `TOOL_EXECUTION_FAILED` with "Agent not found".
- **Fix:** Investigate tenant/scope isolation in the `agent-overview` tool implementation. The tool may be scoping queries to a different tenant than the agent's own tenant context.

### TOOL-003: Outlook/Microsoft Tools Not Connected

- **Severity:** HIGH
- **Status:** Open
- **Agents Affected:** Golf Caddie (8 tools filtered at runtime)
- **Description:** 8 Outlook tools (`outlook-mail-list-emails`, `outlook-mail-get-email`, `outlook-mail-send-email`, `outlook-mail-archive-email`, `outlook-calendar-list-events`, `outlook-calendar-get-event`, `outlook-calendar-create-event`, `outlook-calendar-update-event`) are filtered out at runtime because no Microsoft OAuth connection exists.
- **Impact:** Any agent with the `email-management` skill has these tools injected but they silently fail to load, inflating the expected tool count without providing value.
- **Evidence:** Golf Caddie run `cmmdy9xb8088l8epfhknbno8c` — `toolHealth.filteredTools` lists all 8 Outlook tools.
- **Fix:** Either set up Microsoft OAuth integration (if Outlook access is needed) or remove the `email-management` skill from agents that don't need email (like Golf Caddie).

### TOOL-004: GitHub Write Operations Fail with "Not connected"

- **Severity:** HIGH
- **Status:** Open
- **Agents Affected:** GitHub Agent, Appello Doc Publisher
- **Description:** GitHub MCP write operations (`github_create_repository`) fail intermittently with `TOOL_EXECUTION_FAILED: "Not connected"`. Read operations (`github_search_repositories`, `github_list_commits`, `github_search_code`) work consistently.
- **Impact:** Agents cannot create repos, push files, or create PRs reliably. The Doc Publisher agent cannot complete its core workflow of publishing documentation to GitHub.
- **Evidence:** GitHub Agent run `cmm5bx7iz00pn8eid92ipxd37` turn 2 — `github_create_repository` returned `{"message": "Not connected"}`. Two duplicate GitHub connections exist on the platform, which may cause connection instability.
- **Fix:** Consolidate to a single GitHub integration connection. Investigate MCP connection lifecycle for long-running write operations. Check GitHub PAT permissions for repo creation in org context.

---

## MEDIUM

### TOOL-005: Doc Publisher Stuck in Tool Call Loop

- **Severity:** MEDIUM
- **Status:** Open
- **Agents Affected:** Appello Doc Publisher
- **Description:** The agent called `github_search_repositories` 6 times with identical arguments (`{"query": "useAnzen/docs", "page": 1, "perPage": 1}`) in a single run before switching strategies. This wastes tokens, time, and cost.
- **Impact:** 51 seconds and $0.09 spent on a run that mostly just repeated the same tool call. Tool call accuracy score: 0/1. Overall grade: 37.5%.
- **Evidence:** Run `cmmds7ls706d08epfe22a6w6x` — Steps 1-14 show the same `github_search_repositories` call repeated 6 times with identical results.
- **Fix:** Investigate why the agent loops. Possible causes: (1) the agent doesn't have `github_list_pull_requests` configured so it keeps searching for a tool that works, (2) the model (gpt-4o) is perseverating. Consider reducing `maxSteps`, adding anti-loop instructions, or ensuring the correct GitHub tools are configured.

### TOOL-006: Workflow-Dispatched Runs Have Broken Traces

- **Severity:** MEDIUM
- **Status:** Open
- **Agents Affected:** SDLC Auditor (and likely all workflow-dispatched agents)
- **Description:** Agent runs triggered by workflows show `trace.status: "RUNNING"` even after the run is marked `COMPLETED`. The trace records 0 steps and 0 tool calls, making it impossible to audit tool health for workflow-dispatched runs.
- **Impact:** Cannot verify whether SDLC Auditor tools work correctly during workflow execution. 24 total runs exist with no trace visibility.
- **Evidence:** Run `cmmcmrh5c00az8eign0bhlvip` — `run.status: "COMPLETED"`, `trace.status: "RUNNING"`, `stepsJson: []`, `toolCalls: []`.
- **Fix:** Investigate trace finalization logic for workflow-dispatched agent runs. The trace status may not be updated when the parent workflow completes.

### TOOL-007: Irrelevant Skills Inflating Prompt Token Cost

- **Severity:** MEDIUM
- **Status:** Open
- **Agents Affected:** Golf Caddie (primary), potentially others
- **Description:** Golf Caddie has 8 skills attached, of which at least 4 are not relevant to its purpose: `email-management`, `self-authoring-appello`, `agent-collaboration`, and `mcp-communication-slack`. Each skill injects instructions and tool definitions into the prompt.
- **Impact:** A simple "hey" message consumed 47,518 prompt tokens and cost $0.15. The irrelevant skills contribute ~20K+ tokens of unnecessary prompt content.
- **Evidence:** Run `cmmdy9xb8088l8epfhknbno8c` — `promptTokens: 47518`, `completionTokens: 418` (0.88% ratio). `toolHealth.expectedCount: 83` (only 6 are natively configured).
- **Fix:** Remove irrelevant skills from Golf Caddie. Only keep: `platform-knowledge-management`, `mcp-web-firecrawl`, `mcp-web-playwright`, `firecrawl-expert`.

### TOOL-008: Appello Doc Writer Excessive Tool Count

- **Severity:** MEDIUM
- **Status:** Open
- **Agents Affected:** Appello Doc Writer
- **Description:** The agent has 33 configured tools. A single documentation run consumed 97,143 prompt tokens ($0.356) — the most expensive single run on the platform.
- **Impact:** High per-run cost. The large tool surface area means the model must evaluate 33 tool schemas on every step, even though most runs only use ~7 tools.
- **Evidence:** Run `cmmdqfm0g05x88epflausjjan` — `promptTokens: 97143`, `totalTokens: 101454`, `costUsd: 0.356094`. Only 7 unique tools were actually called.
- **Fix:** Reduce the tool list to only tools the agent actually uses (Appello MCP search/get tools, Firecrawl scrape/map, web-search, memory). Consider splitting into a "research" phase and "writing" phase with different tool sets.

### TOOL-009: Golf Caddie Leaks Credentials in Response

- **Severity:** MEDIUM (Security)
- **Status:** Open
- **Agents Affected:** Golf Caddie
- **Description:** The agent referenced the user's TeeOn username in its response text ("I've got your TeeOn credentials (Oaks4247)") despite instructions explicitly stating: "Store credentials ONLY in working memory, never in conversation text." The `updateWorkingMemory` tool call also stored the plaintext password in the working memory JSON, which is visible in the trace.
- **Impact:** Credential exposure in conversation history and trace logs. The evaluation flagged this as a `SAFETY_VIOLATION` with `critical` severity.
- **Evidence:** Run `cmmdy9xb8088l8epfhknbno8c` — Response text contains username, working memory JSON contains plaintext password (`Prometrix#123`), evaluation `failureModes` includes `SAFETY_VIOLATION`.
- **Fix:** Strengthen instructions to never reference credentials by value. Consider redacting sensitive fields in working memory before trace storage. Add a guardrail rule that detects credential patterns in output.

---

## LOW

### TOOL-010: Cursor Coding Agent and SDLC Reviewer Never Tested

- **Severity:** LOW
- **Status:** Open
- **Agents Affected:** Cursor Coding Agent (5 tools), SDLC Reviewer (2 tools)
- **Description:** Both agents have 0 production runs. Their tools have never been exercised, so tool health is unknown.
- **Impact:** Cannot confirm whether `cursor-launch-agent`, `cursor-get-status`, `cursor-poll-until-done`, or `calculate-trust-score` tools work correctly in production.
- **Evidence:** `agent_read` for both agents returns `runs: []`.
- **Fix:** Run a smoke test on each agent to validate tool loading and basic execution.

### TOOL-011: Duplicate GitHub Integration Connections

- **Severity:** LOW
- **Status:** Open
- **Agents Affected:** All agents using GitHub tools
- **Description:** Two GitHub integration connections exist: "github" (`cmm5dc2md00458eir5ch31829`) and "GitHub Connection" (`cmm4w0ovs03sn8em9molxkp70`). Both are active, both are org-scoped, but only one is marked as default.
- **Impact:** May cause connection confusion or instability when the platform selects which connection to use for GitHub MCP tool execution. Could contribute to the intermittent "Not connected" errors in TOOL-004.
- **Evidence:** `integration_connections_list` returns two connections with `provider.key: "github"`.
- **Fix:** Delete the non-default duplicate connection. Verify all agents resolve to the correct remaining connection.

---

## Agent Health Summary

| Agent           | Tools          | Missing  | Broken                  | Status       |
| --------------- | -------------- | -------- | ----------------------- | ------------ |
| Golf Caddie     | 6 (+skills→83) | 30 (36%) | Playwright, Outlook     | **CRITICAL** |
| BigJim2         | 19             | 0        | `agent-overview`        | **HIGH**     |
| Doc Publisher   | 11             | 0        | GitHub writes, loop bug | **HIGH**     |
| Doc Writer      | 33             | 0        | None (cost concern)     | **MEDIUM**   |
| GitHub Agent    | 26             | 0        | GitHub writes           | **MEDIUM**   |
| SDLC Auditor    | 1              | 0        | Traces broken           | **MEDIUM**   |
| SDLC Classifier | 1              | 0        | None                    | **OK**       |
| SDLC Planner    | 2              | 0        | None                    | **OK**       |
| SDLC Reviewer   | 2              | ?        | Untested                | **UNKNOWN**  |
| Cursor Agent    | 5              | ?        | Untested                | **UNKNOWN**  |

---

## Integration Connection Summary

| Provider              | Connected            | Status                          |
| --------------------- | -------------------- | ------------------------------- |
| Anthropic             | Yes                  | Working                         |
| OpenAI                | Yes                  | Working                         |
| GitHub                | Yes (x2 — duplicate) | Reads work, writes intermittent |
| Firecrawl             | Yes                  | Working                         |
| Appello MCP           | Yes                  | Working                         |
| Cursor Cloud          | Yes                  | Untested                        |
| Gmail                 | Yes (x2)             | Working                         |
| Google Calendar       | Yes                  | Working                         |
| Google Drive          | Yes (x2)             | Working                         |
| **Playwright**        | **No**               | **Not connected**               |
| **Microsoft/Outlook** | **No**               | **Not connected**               |
| **HubSpot**           | **No**               | **Not connected**               |
| **Jira**              | **No**               | **Not connected**               |
| **Slack**             | **No**               | **Not connected**               |
| **JustCall**          | **No**               | **Not connected**               |
| **Fathom**            | **No**               | **Not connected**               |
