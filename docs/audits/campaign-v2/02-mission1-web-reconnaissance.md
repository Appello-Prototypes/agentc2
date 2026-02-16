# Mission 1: Competitor Web Reconnaissance — Detailed Audit

**Mission ID**: `cmlobovu2020gv6eidwy7aw3p`
**Status**: COMPLETE (2 of 4 tasks succeeded)
**Sequence**: 1
**Recorded Cost**: $25.52 (inflated — actual ~$5.10)

---

## Task Breakdown

### Task 1: Scrape LangGraph Website — COMPLETE

| Field             | Value                              |
| ----------------- | ---------------------------------- |
| Task ID           | `cmlobow0c020kv6eirqmualgc`        |
| Agent Run ID      | `cmlobsmgf022ev6eiznk4exig`        |
| Agent             | workspace-concierge                |
| Model             | anthropic/claude-sonnet-4-20250514 |
| Duration          | 86.3 seconds                       |
| Prompt Tokens     | 719,068                            |
| Completion Tokens | 2,650                              |
| Recorded Cost     | $10.98 (actual: ~$2.20)            |
| Tool Calls        | 7                                  |
| Result Size       | 8,130 chars                        |

**Tool Call Sequence**:

1. `firecrawl_firecrawl_map` — Discovered site URLs
2. `firecrawl_firecrawl_scrape` x6 — Scraped landing page, concepts, cloud concepts, pricing, adopters, main LangChain site

**Assessment**: Excellent execution. The agent used a reconnaissance-first approach (map → targeted scrape). Produced structured output with specific pricing ($39/seat/month), 40+ enterprise customers, and detailed feature analysis. The 719K tokens were mostly scraped HTML content being sent back into the model context.

**Key Problem**: 719K tokens of scraped content is passed INTO the prompt, consuming the vast majority of the context window. The agent only generated 2,650 output tokens — the useful analysis is tiny compared to the input material.

---

### Task 2: Scrape AutoGen Website — COMPLETE

| Field             | Value                              |
| ----------------- | ---------------------------------- |
| Task ID           | `cmlobow1k020mv6eiihfvvr62`        |
| Agent Run ID      | `cmlobsmgn022kv6ei4r9wizag`        |
| Agent             | workspace-concierge                |
| Model             | anthropic/claude-sonnet-4-20250514 |
| Duration          | 95.2 seconds                       |
| Prompt Tokens     | 956,025                            |
| Completion Tokens | 2,617                              |
| Recorded Cost     | $14.54 (actual: ~$2.91)            |
| Tool Calls        | 11                                 |
| Result Size       | 6,831 chars                        |

**Tool Call Sequence**:

1. `firecrawl_firecrawl_map` — Discovered site URLs
2. `firecrawl_firecrawl_scrape` x6 — Multiple pages
3. `firecrawl_firecrawl_search` x4 — Additional searches for community metrics, GitHub stats

**Assessment**: Good execution but more expensive than LangGraph due to more tool calls (11 vs 7) and larger scraped content (956K vs 719K tokens). The additional search calls for GitHub stats were useful.

**Key Problem**: Same as LangGraph — massive token consumption from raw scraped content.

---

### Task 3: Scrape CrewAI Website — FAILED

| Field             | Value                                                                       |
| ----------------- | --------------------------------------------------------------------------- |
| Task ID           | `cmlobovx2020iv6ei4w48ozg0`                                                 |
| Agent Run ID      | `cmlobthfv022uv6eisrezmi66`                                                 |
| Duration          | 6.5 seconds                                                                 |
| Prompt Tokens     | 0                                                                           |
| Completion Tokens | 0                                                                           |
| Tool Calls        | 0                                                                           |
| Error             | `input length and max_tokens exceed context limit: 154559 + 64000 > 200000` |

**Root Cause**: The agent's system prompt + tool definitions + task instructions totaled 154,559 tokens BEFORE any scraping occurred. Combined with `max_tokens: 64000`, this exceeded the 200K context window before the agent could even begin reasoning.

**Why This Task Failed But LangGraph/AutoGen Didn't**: This is a multi-step process. The 154K input tokens include the accumulated tool call results from the model's conversation loop. The error occurs when a Firecrawl scrape returns massive content that, combined with previous conversation context, exceeds the limit. The agent had already loaded crewai.com content that pushed it over.

**Optimization**: Use `firecrawl_extract` with targeted CSS selectors instead of full `firecrawl_scrape`. Or use `onlyMainContent: true` and content truncation.

---

### Task 4: Search GitHub Community Metrics — FAILED

| Field        | Value                                       |
| ------------ | ------------------------------------------- |
| Task ID      | `cmlobow33020ov6eiplg1uzgd`                 |
| Agent Run ID | `cmlobtl2p022yv6ei0oacctrv`                 |
| Duration     | 4.7 seconds                                 |
| Tool Calls   | 0                                           |
| Error        | `Tool github_search_repositories not found` |

**Root Cause**: The campaign-planner assumed `github_search_repositories` would be available via the `mcp-code-github` skill. However, the GitHub MCP server does not provide a tool named `github_search_repositories` — the actual tool names use a different naming convention.

**Optimization**: The planner should validate tool names against the actual tool registry. Alternatively, `firecrawl_search` could search GitHub directly as a web fallback.

---

## Where Is Mission 1 Data Stored?

| Data                     | Storage Location                                      | Accessible?                 |
| ------------------------ | ----------------------------------------------------- | --------------------------- |
| Scraped LangGraph report | `MissionTask.result` JSON field (8,130 chars)         | Only via DB query or API    |
| Scraped AutoGen report   | `MissionTask.result` JSON field (6,831 chars)         | Only via DB query or API    |
| Agent run output text    | `AgentRun.outputText` field                           | Via run trace in AgentC2 UI |
| Tool call inputs/outputs | `AgentToolCall.inputJson` / `outputJson`              | Via run trace in AgentC2 UI |
| Full scraped HTML        | **Not stored** — only in the LLM conversation context | Lost after run completes    |

**Critical Gap**: The raw scraped data (HTML/text from Firecrawl) is NOT persisted anywhere. It exists only transiently in the LLM's conversation context during the tool call. Once the agent run completes, the raw data is gone. Only the agent's summarized output is stored.

---

## Token Consumption Analysis

For the LangGraph scrape (719K prompt tokens):

- Agent system prompt + skill definitions: ~10K tokens
- Task coordinating instructions: ~500 tokens
- **Firecrawl scraped content (6 pages)**: ~700K tokens
- Agent's reasoning output: 2,650 tokens

**98.7% of token consumption is raw scraped web content being passed through the LLM context.**

This is the fundamental cost driver. Each scraped page returns 50-150K tokens of raw content, and the multi-step agent accumulates ALL of it across tool calls.
