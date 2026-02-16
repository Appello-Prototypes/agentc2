# Tool Call Analysis — All 47 Calls

**Campaign**: Competitive Intelligence Report — AI Agent Frameworks (v2)
**Total Tool Calls**: 47 across 12 agent runs

---

## Tool Usage Summary

| Tool                         | Calls  | Success | Failed | Category           |
| ---------------------------- | ------ | ------- | ------ | ------------------ |
| `firecrawl_firecrawl_scrape` | 12     | 12      | 0      | MCP (Firecrawl)    |
| `firecrawl_firecrawl_search` | 4      | 4       | 0      | MCP (Firecrawl)    |
| `firecrawl_firecrawl_map`    | 2      | 2       | 0      | MCP (Firecrawl)    |
| `campaign-get`               | 6      | 6       | 0      | System (Campaign)  |
| `campaign-write-aar`         | 4      | 4       | 0      | System (Campaign)  |
| `campaign-write-missions`    | 1      | 1       | 0      | System (Campaign)  |
| `campaign-write-plan`        | 1      | 1       | 0      | System (Campaign)  |
| `agent-list`                 | 1      | 1       | 0      | System (Agent Ops) |
| `agent-evaluations-list`     | 3      | 3       | 0      | System (Agent Ops) |
| `agent-runs-get`             | 2      | 2       | 0      | System (Agent Ops) |
| `tool-registry-list`         | 3      | 3       | 0      | System (Tool Ops)  |
| `skill-list`                 | 5      | 5       | 0      | System (Skill Ops) |
| `date-time`                  | 1      | 1       | 0      | Utility            |
| `updateWorkingMemory`        | 1      | 1       | 0      | Memory             |
| `document-create`            | 1      | 1       | 0      | Platform           |
| **Total**                    | **47** | **47**  | **0**  |                    |

**Notable**: All 47 tool calls succeeded. The task-level failures (CrewAI scrape, GitHub search) occurred at the LLM level (context overflow, tool-not-found), not at the tool execution level.

---

## By Run

### Campaign-Analyst (2 calls)

1. `campaign-get` — Read campaign definition
2. `campaign-write-missions` — Wrote 3 missions with 9 tasks

### Campaign-Planner (11 calls)

1. `campaign-get` — Read full campaign with missions/tasks
2. `agent-list` — Listed available agents with capabilities
3. `tool-registry-list` x3 — Queried tool registry (likely filtering/paginating)
4. `skill-list` x5 — Queried skills (likely by category)
5. `campaign-write-plan` — Wrote the execution plan

**Optimization**: 8 of 11 calls are skill/tool discovery. Could be consolidated into 1-2 comprehensive queries.

### Scrape LangGraph (7 calls)

1. `firecrawl_firecrawl_map` — Discovered 100+ URLs on langchain-ai.github.io
2. `firecrawl_firecrawl_scrape` x6 — Scraped: landing page, concepts, cloud concepts, pricing, adopters, main langchain.com

### Scrape AutoGen (11 calls)

1. `firecrawl_firecrawl_map` — Discovered URLs on microsoft.github.io/autogen
2. `firecrawl_firecrawl_scrape` x6 — Scraped multiple pages
3. `firecrawl_firecrawl_search` x4 — Searched for community metrics, GitHub stats

**Note**: AutoGen made 4 more calls than LangGraph (11 vs 7), explaining the higher token/cost.

### Create Google Doc (2 calls)

1. `date-time` — Got current date for document header
2. `updateWorkingMemory` — Attempted to update working memory (failed silently — no thread context)

**Note**: `google-drive-create-doc` was never called because it wasn't found in the tool set.

### Return Document Link (1 call)

1. `document-create` — Created an AgentC2 platform document as fallback

### Campaign Reviewers (13 calls total across 4 runs)

- `campaign-get` x4 — Read full campaign state for each review
- `campaign-write-aar` x4 — Wrote mission AARs and final campaign AAR
- `agent-evaluations-list` x3 — Checked for evaluation data
- `agent-runs-get` x2 — Inspected specific run traces

---

## Token Cost of Tool Definitions

Each task execution run for workspace-concierge loads ALL tools (106+ direct tools + all discoverable skill tools). Tool definitions in the system prompt consume approximately:

| Component                                 | Estimated Tokens |
| ----------------------------------------- | ---------------- |
| Agent system prompt                       | ~2,000           |
| 106 direct tools (schemas + descriptions) | ~100,000         |
| Discoverable skill tools (~50+)           | ~80,000          |
| Task coordinating instructions            | ~500             |
| Campaign context injection                | ~1,000           |
| **Total base overhead**                   | **~183,500**     |

This means every task run starts with ~183K tokens of overhead before any actual work begins. For Claude Sonnet at $3/1M input, that's **$0.55 per task just for tool definitions**.

For the 4 task runs that executed (LangGraph, AutoGen, Create Doc, Return Link), that's **$2.20 in tool definition overhead** alone.

---

## Firecrawl Tool Behavior

The `firecrawl_firecrawl_scrape` tool returns the full text/HTML content of a scraped web page. Each page returns:

| Page                   | Estimated Return Size |
| ---------------------- | --------------------- |
| LangGraph landing page | ~50-80K tokens        |
| LangGraph pricing page | ~30-50K tokens        |
| AutoGen landing page   | ~60-100K tokens       |
| AutoGen docs pages     | ~40-80K tokens each   |

These return values are placed into the LLM conversation as tool call results, accumulating across the multi-step agent loop. By the 6th scrape call, the LangGraph agent had accumulated ~700K tokens of scraped content in its context.

### Optimization: Content Truncation

Firecrawl supports `onlyMainContent: true` which strips navigation, headers, footers, and sidebars. This could reduce scraped content by 40-60%. The agents should be instructed to always use this option.

Additionally, `firecrawl_extract` with a schema can extract only specific fields (pricing, features, etc.) instead of returning full page content.
