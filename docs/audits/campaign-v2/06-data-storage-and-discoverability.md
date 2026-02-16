# Data Storage and Human Discoverability Audit

---

## Where Campaign Data Lives

### Database Tables Involved

| Table           | What It Stores                                           | Records for This Campaign |
| --------------- | -------------------------------------------------------- | ------------------------- |
| `Campaign`      | Intent, end state, constraints, status, AAR, costs, plan | 1 row                     |
| `Mission`       | Name, sequence, status, mission AAR                      | 3 rows                    |
| `MissionTask`   | Name, status, result JSON, error, assigned agent, cost   | 9 rows                    |
| `AgentRun`      | Model, tokens, cost, duration, input/output text         | 12 rows                   |
| `AgentToolCall` | Tool name, input JSON, output JSON, success/failure      | 47 rows                   |
| `AgentTrace`    | Linked to runs for trace visibility                      | Up to 12 rows             |
| `CampaignLog`   | Event log with timestamps                                | 40 rows                   |
| `Document`      | Platform document created by agent                       | 1 row                     |

### Where Specific Data Is Stored

| Data                      | Table.Field                                             | Size              |
| ------------------------- | ------------------------------------------------------- | ----------------- |
| LangGraph research output | `MissionTask.result` (task `cmlobow0c020kv6eirqmualgc`) | 8,130 chars JSON  |
| AutoGen research output   | `MissionTask.result` (task `cmlobow1k020mv6eiihfvvr62`) | 6,831 chars JSON  |
| Campaign analysis         | `Campaign.analysisOutput`                               | 6,407 chars JSON  |
| Execution plan            | `Campaign.executionPlan`                                | 12,878 chars JSON |
| After Action Review       | `Campaign.aarJson`                                      | 17,412 chars JSON |
| Mission 1 AAR             | `Mission.aarJson` (mission `cmlobovu2020gv6eidwy7aw3p`) | Stored in JSON    |
| Full event timeline       | `CampaignLog` table                                     | 40 entries        |
| Tool inputs/outputs       | `AgentToolCall.inputJson/outputJson`                    | 47 records        |

---

## What a Human Can See Today

### Via AgentC2 UI (agentc2.ai)

1. **Campaign list page** (`/workspace/campaigns`) — Shows campaign name, status, progress bar
2. **Campaign detail page** (`/workspace/campaigns/{id}`) — Shows missions, tasks, status, AAR
3. **Agent run traces** (`/workspace/{agent}/runs/{runId}`) — Shows individual run with tool calls

### What's Missing from the UI

| Missing Feature                              | Impact                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| **No task result viewer**                    | Task results (the scraped reports) are stored as raw JSON — no formatted view  |
| **No inter-mission data flow visualization** | Can't see what data flows between missions                                     |
| **No campaign cost breakdown**               | Only total cost shown — no per-run or per-mission breakdown                    |
| **No tool call output viewer**               | Tool call outputs (Firecrawl scraped content) not viewable in campaign context |
| **No document link from campaign**           | The platform document created by the agent isn't linked back to the campaign   |
| **No campaign timeline**                     | 40 event logs exist but no visual timeline                                     |
| **No export functionality**                  | Can't export campaign results as PDF, markdown, or any format                  |
| **No comparison view**                       | Can't compare v1 vs v2 campaigns side-by-side                                  |

---

## What a Human Would Want to See

### Ideal Campaign Dashboard

1. **Campaign Overview**
    - Status, progress, cost breakdown (task vs system agent costs)
    - Timeline of events
    - End state achieved? Yes/No with explanation

2. **Mission Cards**
    - Each mission as an expandable card
    - Task list with status indicators
    - Mission AAR summary
    - Cost breakdown per mission

3. **Task Detail View**
    - Agent that executed it, duration, token count
    - **Formatted result output** (not raw JSON)
    - Tool calls with expandable inputs/outputs
    - Error details if failed
    - Link to full agent run trace

4. **Deliverables Panel**
    - List of all produced artifacts (documents, files, reports)
    - Direct links to view/download
    - Export as PDF or markdown

5. **AAR View**
    - Structured display of lessons learned, recommendations
    - Sustain/improve patterns as lists
    - Cost comparison (estimated vs actual)

---

## Raw Scraped Data: Not Stored, Not Viewable

The most valuable intermediate data — the full HTML/text scraped from competitor websites — is **not persisted anywhere**. It exists only in the LLM's conversation context during the tool call sequence.

| What's Scraped              | Approximate Size       | Stored? |
| --------------------------- | ---------------------- | ------- |
| LangGraph website (6 pages) | ~700K tokens of text   | NO      |
| AutoGen website (10+ pages) | ~950K tokens of text   | NO      |
| CrewAI website              | Failed before scraping | N/A     |

Only the agent's **summarized analysis** (2-8K chars) is stored in `MissionTask.result`. The raw data is lost.

### Recommendation: Persist Intermediate Tool Outputs

For scraping tasks, the Firecrawl tool outputs should be optionally persisted to:

1. A campaign-specific storage bucket (S3, GCS, or local)
2. Or the `Document` table in the AgentC2 platform
3. With a link back to the campaign/mission/task

This enables:

- Human review of raw scraped data
- Reuse in downstream tasks without re-scraping
- Audit trail of what was actually collected

---

## Platform Document Created

The agent created one platform document as a fallback:

| Field       | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| Document ID | `cmloc3mln0271v6eij950axdy`                                |
| Title       | Competitive Intelligence Report — AI Agent Frameworks (v2) |
| Location    | AgentC2 Document system (`/workspace/documents/{id}`)      |
| Content     | Markdown template with placeholder data                    |

This document is viewable in the AgentC2 UI under the Documents section, but it is **not linked** to the campaign in any way. A human browsing the campaign would have no idea this document exists.

### Recommendation: Link Generated Resources to Campaigns

When a campaign task creates a document, file, or external resource, it should be recorded in `Campaign.generatedResources` (which exists in the schema but is currently `null` for this campaign).
