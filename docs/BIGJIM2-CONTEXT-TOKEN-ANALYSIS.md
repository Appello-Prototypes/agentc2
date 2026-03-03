# BigJim2 Context Layer Token Cost Analysis

## 1. Skills Attached to BigJim2

**Result: Zero skills are directly attached to BigJim2** (`cmma4ylgq00138eydcaxn9ttj`).

I searched all 78 platform skills via `skill_list` and grepped for BigJim2's agent ID. No skill has this agent in its `agents[]` array. BigJim2 uses the **Dynamic ReAct pattern** — skills are loaded on demand via the meta-tools (`search-skills`, `activate-skill`, `list-active-skills`), not pinned.

> **Note:** There is a "BigJim2 Self-Diagnostic" skill (slug: `bigjim2-self-diagnostic-appello`) but it's attached to a different BigJim2 instance (`cmm1k9ird0006v6zlmo7pusm4`) in the Appello workspace, not this one.

**Pinned skills token cost: 0 tokens**

---

## 2. Platform Skills Available for Discovery (78 total)

These are searchable via `search-skills` but **NOT** loaded into context unless activated:

| #   | Slug                              | Name                                 |
| --- | --------------------------------- | ------------------------------------ |
| 1   | google-drive-expert               | Google Drive Expert                  |
| 2   | google-calendar-expert            | Google Calendar Expert               |
| 3   | playbook-authoring                | Playbook Authoring                   |
| 4   | pulse-critical-analysis-appello   | Critical Analysis                    |
| 5   | pulse-web-scouting-appello        | Web Scouting                         |
| 6   | pulse-domain-expertise-appello    | Domain Expertise                     |
| 7   | pulse-content-curation-appello    | Content Curation                     |
| 8   | pulse-knowledge-synthesis-appello | Knowledge Synthesis                  |
| 9   | pulse-youtube-research-appello    | YouTube Research                     |
| 10  | appello-comms-docs-appello        | Notes, Notifications, Files & Search |
| 11  | youtube-research-appello          | YouTube Research                     |
| 12  | slack-channel-context-appello     | Slack Channel Context                |
| 13  | fathom-meeting-context-appello    | Fathom Meeting Context               |
| 14  | self-authoring-appello            | Self-Authoring Agent                 |
| 15  | hubspot-email-enrichment-appello  | HubSpot Email Enrichment             |
| 16  | gmail-draft-response-appello      | Gmail Draft Response                 |
| 17  | gmail-email-history-appello       | Gmail Email History                  |
| 18  | appello-financials-appello        | Financial Management                 |
| 19  | jira-ticket-context-appello       | Jira Ticket Context                  |
| 20  | calendar-email-enrichment-appello | Calendar Email Enrichment            |
| 21  | google-calendar-expert-appello    | Google Calendar Expert               |
| 22  | integration-verification-appello  | Integration Verification             |
| 23  | appello-workforce-appello         | Workforce & HR Management            |
| 24  | appello-time-attendance-appello   | Time Tracking & Attendance           |
| 25  | google-drive-expert-appello       | Google Drive Expert                  |
| 26  | appello-scheduling-appello        | Scheduling & Dispatch                |
| 27  | appello-project-job-ops-appello   | Project & Job Operations             |
| 28  | supabase-expert-appello           | Supabase Expert                      |
| 29  | mcp-files-dropbox-appello         | Dropbox File Storage                 |
| 30  | mcp-communication-outlook-appello | Microsoft Outlook Mail & Calendar    |
| 31  | mcp-knowledge-fathom-appello      | Fathom Meeting Knowledge             |
| 32  | standup-operations-appello        | Standup Operations                   |
| 33  | appello-assets-appello            | Equipment & Materials                |
| 34  | appello-safety-compliance-appello | Safety & Compliance                  |
| 35  | bigjim2-self-diagnostic-appello   | BigJim2 Self-Diagnostic              |
| 36  | support-ticket-management         | Support Ticket Management            |
| 37  | community-participation           | Community Participation              |
| 38  | platform-organization             | Organization Management              |
| 39  | core-utilities                    | Core Utilities                       |
| 40  | self-authoring                    | Self-Authoring                       |
| 41  | platform-knowledge-management     | Knowledge Management                 |
| 42  | platform-webhooks                 | Webhooks                             |
| 43  | platform-triggers-schedules       | Triggers & Schedules                 |
| 44  | platform-goals                    | Goals & OKRs                         |
| 45  | campaign-analysis                 | Campaign Analysis                    |
| 46  | platform-workflow-execution       | Workflow Execution                   |
| 47  | platform-workflow-management      | Workflow Management                  |
| 48  | platform-network-management       | Network Management                   |
| 49  | platform-agent-management         | Agent Management                     |
| 50  | campaign-review                   | Campaign Review                      |
| 51  | campaign-architecture             | Campaign Architecture                |
| 52  | campaign-planning                 | Campaign Planning                    |
| 53  | mcp-automation-atlas              | ATLAS Workflow Automation            |
| 54  | mcp-knowledge-fathom              | Fathom Meeting Knowledge             |
| 55  | mcp-code-github                   | GitHub Repository Management         |
| 56  | mcp-files-gdrive                  | Google Drive Files                   |
| 57  | mcp-communication-twilio          | Twilio Voice Calls                   |
| 58  | mcp-communication-justcall        | JustCall Phone & SMS                 |
| 59  | mcp-communication-slack           | Slack Messaging                      |
| 60  | mcp-web-playwright                | Playwright Browser Automation        |
| 61  | mcp-web-firecrawl                 | Firecrawl Web Scraping               |
| 62  | mcp-project-jira                  | Jira Project Management              |
| 63  | mcp-crm-hubspot                   | HubSpot CRM                          |
| 64  | cloud-file-storage                | Cloud File Storage                   |
| 65  | google-drive-files                | Google Drive Files                   |
| 66  | email-management                  | Email & Calendar Management          |
| 67  | bim-engineering                   | BIM Engineering                      |
| 68  | user-interaction                  | User Interaction                     |
| 69  | web-research                      | Web Research                         |
| 70  | agent-collaboration               | Agent Collaboration                  |
| 71  | platform-integrations             | Integration Management               |
| 72  | platform-canvas-dashboards        | Canvas & Dashboards                  |
| 73  | platform-skill-management         | Skill Management                     |
| 74  | platform-simulations              | Agent Simulations                    |
| 75  | platform-learning                 | Agent Learning                       |
| 76  | platform-quality-safety           | Quality & Safety                     |
| 77  | platform-observability            | Observability & Metrics              |
| 78  | platform-network-execution        | Network Execution                    |

---

## 3. Tool Schema Estimates (14 Always-Loaded Tools)

| Tool ID               | Params         | Description Length | Est. Schema Tokens |
| --------------------- | -------------- | ------------------ | ------------------ |
| search-skills         | 1 (array)      | 65 words           | ~123               |
| activate-skill        | 3              | 50 words           | ~125               |
| list-active-skills    | 1              | 35 words           | ~65                |
| backlog-get           | 1              | 25 words           | ~50                |
| backlog-add-task      | 9              | 40 words           | ~225               |
| backlog-list-tasks    | 4 (incl. enum) | 30 words           | ~125               |
| backlog-update-task   | 6 (incl. enum) | 30 words           | ~155               |
| backlog-complete-task | 2              | 25 words           | ~65                |
| calculator            | 1              | 40 words           | ~75                |
| date-time             | 1              | 30 words           | ~60                |
| document-search       | 5              | 15 words           | ~100               |
| memory-recall         | 5              | 25 words           | ~120               |
| network-execute       | 7              | 15 words           | ~130               |
| rag-query             | 4              | 12 words           | ~82                |
| API wrapper overhead  | —              | 14 tools × ~18     | ~252               |
| **TOTAL**             |                |                    | **~1,752**         |

---

## 4. Grand Total — Static Context Per Turn

| Layer                        | Estimated Tokens |
| ---------------------------- | ---------------- |
| System prompt (instructions) | ~1,800           |
| 14 tool schemas              | ~1,750           |
| Pinned skill instructions    | 0                |
| Pinned skill tool schemas    | 0                |
| **STATIC TOTAL**             | **~3,550**       |

### Dynamic Context (varies per turn)

| Layer             | Config                   | Estimated Range        |
| ----------------- | ------------------------ | ---------------------- |
| Working memory    | enabled                  | 200–1,000 tokens       |
| Last N messages   | lastMessages: 3          | 300–3,000 tokens       |
| Semantic recall   | topK: 5, messageRange: 3 | 500–2,500 tokens       |
| **DYNAMIC RANGE** |                          | **1,000–6,500 tokens** |

### Estimated Total Context Per Turn

| Scenario                         | Tokens                   |
| -------------------------------- | ------------------------ |
| First turn (empty memory)        | ~3,550                   |
| Mid-conversation (typical)       | ~5,500–7,500             |
| Deep conversation (rich history) | ~8,000–10,000            |
| With 1 activated skill           | Add ~300–1,500 per skill |

---

## Key Takeaway

BigJim2's design is **lean by default**. With ~3,550 static tokens (instructions + 14 tools), it leaves massive headroom within Claude's context window. The zero pinned skills strategy means the base cost doesn't grow with the platform's 78 available skills — they're only loaded on demand via `activate-skill`, adding their tools and instructions only when needed. This is the **Dynamic ReAct pattern** working as intended.
