# NEXUS Test Backlog

> Started: 2026-03-02 ~23:30 UTC
> Completed: 2026-03-02 ~23:45 UTC
> Agent under test: NEXUS (slug: nexus)
> Test user: agentc2-test@test.local
> Environment: localhost:3001
> Threads used: chat-nexus-94180032 (main), chat-nexus-94951087 (cross-thread)

## Discovered Capabilities

### Core Built-in Tools (Always Available)

- `search-skills` - Discover available skills by capability
- `activate-skill` - Load skills and their tools
- `list-active-skills` - View currently activated skills
- `backlog-add-task` - Create new tasks for agents
- `backlog-get` - View agent backlogs
- `backlog-list-tasks` - List tasks with filters
- `backlog-update-task` - Update task status and details
- `backlog-complete-task` - Mark tasks as completed
- `updateWorkingMemory` - Store conversation-relevant information
- `memory-recall` - Search conversation history
- `document-search` - Semantic search across documents
- `rag-query` - Query the RAG index directly
- `calculator` - Mathematical calculations and functions
- `date-time` - Get current date/time in any timezone
- `network-execute` - Execute other agent networks

### Skills (81 available, on-demand activation)

- Slack Messaging, Email & Calendar, Support Tickets, Fathom Meetings
- Workflow Management, Jira, ATLAS Automation, Standup Ops
- GitHub, Core Utilities, Playwright, Cursor Cloud, Supabase
- Canvas & Dashboards, Observability, Critical Analysis, Firecrawl
- Scheduling & Dispatch, Financial, Workforce & HR
- Agent Management, Agent Learning, Agent Simulations, Integration Verification
- Google Drive, Google Calendar
- Knowledge Management (from seed data)

### Behavioral Capabilities

- Conversation memory continuity (last 10 messages + semantic recall)
- Working memory (persists across turns AND threads)
- Cross-thread semantic recall
- Multi-tool chaining (3+ tools in single turn)
- Self-healing skill activation (searches and activates skills when tools missing)

## Discovered Issues

### CRITICAL: Skill Persistence Bug

- **T18**: Activated skills don't persist across turns
- Tools available during the activation turn disappear in the next message
- NEXUS self-heals by re-activating, but the re-activated tools also don't persist
- Second attempt produced an empty response (no content returned)
- **Impact**: Skills requiring multi-turn interactions are broken

### INFRA: RAG Database Connection

- **T12/T13**: pg_hba.conf authentication failure (error 28000)
- Both `rag-query` and `document-search` tools invoke correctly but can't reach PostgreSQL
- Host 99.243.150.211 not in pg_hba.conf allowlist
- **Impact**: Knowledge base search unavailable

### INFRA: Network Primitive Resolution

- **T14**: Operations Hub network's 4 primitives all fail to resolve
- `network-execute` tool invokes correctly but network agents/tools can't be built
- **Impact**: Network delegation non-functional in this environment

### MINOR: Onboarding Integration Sync

- Console error during org join: `Failed to execute 'json' on 'Response': Unexpected end of JSON input`
- One-time error, doesn't affect workspace functionality

## Queue (To Test)

| ID                            | Capability | Source | Priority |
| ----------------------------- | ---------- | ------ | -------- |
| _(empty -- all items tested)_ |            |        |          |

## In Progress

| ID       | Capability | Started |
| -------- | ---------- | ------- |
| _(none)_ |            |         |

## Results

| ID  | Capability                          | Status  | Evidence                                                  | Notes                                         |
| --- | ----------------------------------- | ------- | --------------------------------------------------------- | --------------------------------------------- |
| T00 | Initial discovery                   | PASS    | Listed 15 core tools, 81 skills, special capabilities     | Comprehensive, well-organized response        |
| T01 | date-time tool                      | PASS    | UTC: March 2, 2026 23:31:50 / EST: 18:31:50               | Both timezones correct                        |
| T02 | calculator tool                     | PASS    | 1847\*293+47 = 541,218                                    | Correct, showed step-by-step                  |
| T03 | search-skills tool                  | PASS    | 10 results for 'project management' w/ tool counts        | Ranked by relevance score                     |
| T04 | activate-skill tool                 | PASS    | Activated Support Ticket Mgmt (4 tools)                   | Category, description, tools shown            |
| T05 | list-active-skills tool             | PASS    | Listed 1 active skill                                     | Confirmed in same response as T04             |
| T06 | backlog-add-task                    | PASS    | Task cmm9tfg8e00eyv6uhdnpixm0c created, P7, tag:reporting | All params applied                            |
| T07 | backlog-list-tasks                  | PASS    | 3 pending tasks, sorted by priority                       | Found 2 existing P10 tasks                    |
| T08 | backlog-update-task                 | PASS    | Status PENDING->IN_PROGRESS, note recorded                | Activity feed updated                         |
| T09 | backlog-complete-task               | PASS    | Status COMPLETED with result text                         | Full lifecycle summary                        |
| T10 | backlog-get                         | PASS    | 3 total: 2 pending, 1 completed                           | Priority distribution shown                   |
| T11 | memory-recall tool                  | PASS    | Tool invoked, "no matches" for 'project management'       | Coherent explanation                          |
| T12 | rag-query tool                      | PARTIAL | Tool invoked, DB auth error (28000 pg_hba)                | Tool works, infra broken                      |
| T13 | document-search tool                | PARTIAL | Tool invoked, same DB auth error                          | Tool works, infra broken                      |
| T14 | network-execute tool                | PARTIAL | Tool invoked, all 4 primitives failed to resolve          | Tool works, network config broken             |
| T15 | updateWorkingMemory                 | PASS    | Stored "Operation Falcon" + "April 15, 2026"              | Confirmed persistent storage                  |
| T16 | Conversation memory (same thread)   | PASS    | Recalled Operation Falcon without prompts                 | Working memory functional                     |
| T17 | Working memory persistence          | PASS    | WM persists across turns within thread                    | Confirmed via T16                             |
| T18 | Skill activation + use tools        | FAIL    | Tools disappeared in next turn                            | Re-activated but still failed; empty response |
| T19 | Multi-tool chain (single turn)      | PASS    | Used date-time + calculator + backlog-add in 1 turn       | All 3 results correct                         |
| T20 | Cross-thread semantic recall        | PASS    | New thread recalled "Operation Falcon" + launch date      | Working memory persists across threads        |
| T21 | Error handling (missing capability) | PASS    | Self-healed by searching + activating Email skill         | Graceful, proactive problem-solving           |

## Summary

- **Total tested:** 22 (T00-T21)
- **Passed:** 16
- **Partial:** 3 (T12, T13, T14 -- tool invocation works, infrastructure broken)
- **Failed:** 1 (T18 -- skill tool persistence bug)
- **No console errors from chat** (3 errors were from initial page load only)
- **UI rendering:** All messages, markdown, lists, code blocks rendered correctly
- **New capabilities discovered during testing:** Self-healing skill activation, multi-tool chaining
- **Fix iterations needed:** 0 (no code changes required during testing)

### Key Findings

1. **Core tools are rock-solid** -- date-time, calculator, backlog CRUD, memory, skill search all work perfectly
2. **Memory system is excellent** -- working memory persists across turns AND threads, semantic recall functional
3. **Skill persistence is broken** -- this is the most significant bug found; activated skill tools don't persist to the next turn
4. **Infrastructure issues** -- RAG database and network primitives need configuration fixes (pg_hba.conf, network agent resolution)
5. **Self-healing behavior is impressive** -- when NEXUS lacks a capability, it proactively searches for and activates relevant skills
6. **Multi-tool orchestration works** -- NEXUS can chain 3+ tools in a single response correctly
7. **UI is stable** -- no JavaScript errors from chat operations across 14+ messages and 2 threads
