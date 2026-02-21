# AgentC2 Platform — Complete System Capabilities Audit

> Generated: February 21, 2026

## Executive Summary

AgentC2 is a **production-grade, multi-tenant AI agent orchestration platform** built as a Turborepo monorepo. It enables organizations to build, deploy, manage, evaluate, and continuously improve AI agents with voice capabilities, 30+ external integrations, RAG knowledge bases, workflow orchestration, multi-agent networks, and enterprise compliance features. The platform runs on **Next.js 16 + React 19 + TypeScript 5**, backed by **PostgreSQL (Supabase)** with **168 database models** and **29 enums**, deployed to **Digital Ocean** via **PM2 + Caddy**.

---

## 1. Core Architecture

| Layer         | Technology                       | Details                                           |
| ------------- | -------------------------------- | ------------------------------------------------- |
| Runtime       | Bun 1.3.4+                       | Package manager + JS runtime                      |
| Build         | Turborepo 2.3.3+                 | Monorepo orchestration with caching               |
| Framework     | Next.js 16.1.0                   | App Router, React 19.2.3                          |
| AI Framework  | Mastra Core                      | Agents, workflows, memory, RAG, evals             |
| Database      | PostgreSQL (Supabase) + Prisma 6 | 168 models, 29 enums                              |
| Auth          | Better Auth 1.4.17+              | Session-based, Google/Microsoft OAuth, 2FA (TOTP) |
| UI            | shadcn/ui + Tailwind CSS 4       | 50+ base components + AI-specific elements        |
| Process Mgr   | PM2 (cluster mode)               | 4 agent instances, 2 frontend, 1 admin            |
| Reverse Proxy | Caddy                            | Auto-HTTPS, compression, security headers         |

### Monorepo Structure

| Package                     | Purpose                                                |
| --------------------------- | ------------------------------------------------------ |
| `apps/agent` (port 3001)    | AI Agent app — API routes, workspace UI, chat, voice   |
| `apps/frontend` (port 3000) | Marketing site — landing, docs, blog, legal pages      |
| `apps/admin` (port 3003)    | Admin portal                                           |
| `apps/inngest` (port 8288)  | Background job dev server                              |
| `apps/ngrok`                | Webhook tunnel management                              |
| `packages/agentc2`          | Core AI framework (agents, tools, workflows, MCP, RAG) |
| `packages/database`         | Prisma schema + client                                 |
| `packages/auth`             | Better Auth config + bootstrap                         |
| `packages/ui`               | Shared UI component library                            |

---

## 2. AI Agent System

### 2.1 Code-Defined Agents (7 base + 3 voice)

| Agent                  | Model           | Purpose                                                            |
| ---------------------- | --------------- | ------------------------------------------------------------------ |
| `assistant`            | Claude Sonnet 4 | General-purpose with full memory (working memory, semantic recall) |
| `structured`           | Claude Sonnet 4 | Returns typed JSON (task breakdown, entity extraction, sentiment)  |
| `vision`               | Claude Sonnet 4 | Image analysis (objects, text, colors, mood, tags)                 |
| `research`             | Claude Sonnet 4 | Multi-step research with web search + note-taking                  |
| `evaluated`            | Claude Sonnet 4 | Dev/test agent with toxicity, completeness, tone scorers           |
| `mcp-agent`            | Claude Sonnet 4 | MCP-enabled with external tool access                              |
| `openaiVoiceAgent`     | Claude Sonnet 4 | OpenAI TTS + STT                                                   |
| `elevenlabsVoiceAgent` | Claude Sonnet 4 | ElevenLabs premium TTS                                             |
| `hybridVoiceAgent`     | Claude Sonnet 4 | OpenAI Whisper STT + ElevenLabs TTS                                |

### 2.2 Database-Driven Agent System

The `AgentResolver` enables fully dynamic agents stored in PostgreSQL:

- **Runtime resolution** — Agents resolved from DB with code-defined fallback
- **Request context injection** — userId, tenantId, workspaceId, threadId
- **Budget enforcement** — `BudgetExceededError` when limits reached
- **Model routing** — Complexity classification (simple/moderate/complex), tier-based routing
- **Skill loading** — Progressive disclosure, thread-activated skills
- **Tool health tracking** — Monitors tool availability
- **OAuth requirement filtering** — Only surfaces tools with valid credentials
- **Version control** — `AgentVersion` snapshots with rollback
- **Multi-instance** — Per-deal/customer agent instances with `InstanceChannelBinding`

### 2.3 Model Registry

Centralized model information with:

- Per-model pricing, capabilities, aliases
- Org-scoped API key management (`resolveModelForOrg()`)
- Provider status checking (`getAiProviderStatus()`)
- Fast compression model for context summarization

---

## 3. Tool Ecosystem (145+ Registered Tools)

### 3.1 Core Utility Tools

- `dateTimeTool`, `calculatorTool`, `generateIdTool`, `jsonParserTool`, `askQuestionsTool`

### 3.2 Web & Search Tools

- `webFetchTool` (SSRF-protected), `webSearchTool`, `webScrapeTool`
- `exaSearchTool`, `exaFindSimilarTool`, `exaResearchTool`
- `braveSearchTool`, `braveLocalSearchTool`, `braveNewsSearchTool`
- `perplexityResearchTool`, `perplexitySearchTool`
- `smartSearchTool` (routes to best provider)

### 3.3 Memory & Knowledge Tools

- `memoryRecallTool` — Semantic search through conversation history
- `ragQueryTool`, `ragIngestTool`, `ragDocumentsListTool`, `ragDocumentDeleteTool`
- `platformDocsTool` — Platform documentation access

### 3.4 Agent Operations Tools

- CRUD: `agentCreateTool`, `agentReadTool`, `agentUpdateTool`, `agentDeleteTool`
- Analytics: `agentAnalyticsTool`, `agentCostsTool`, `agentBudgetGetTool`
- Quality: `agentFeedbackSubmitTool`, `agentGuardrailsGetTool`, `agentTestCasesCreateTool`
- Learning: `agentLearningStartTool`, `agentLearningProposalApproveTool`
- Simulation: `agentSimulationsStartTool`, `agentSimulationsGetTool`
- Run management: `agentRunCancelTool`, `agentRunRerunTool`, `agentRunTraceTool`

### 3.5 Workflow & Network Tools

- Workflow CRUD + execute + resume + metrics + versions + designer chat
- Network CRUD + execute + metrics + versions + designer chat
- `workflowTriggerTool` — Trigger workflows from agents

### 3.6 Integration Tools (Native OAuth)

- **Gmail** (5): search, read, draft, send, archive
- **Google Calendar** (6): search, list, get, create, update, delete events
- **Google Drive** (3): search files, read file, create doc
- **Outlook Mail** (4): list, get, send, archive
- **Outlook Calendar** (4): list, get, create, update events
- **Teams** (5): list teams, list channels, send channel message, list chats, send chat
- **Dropbox** (5): list, get, upload, search files, sharing links

### 3.7 Domain-Specific Tools

- **YouTube**: transcript, search, analyze, ingest to knowledge
- **Stripe ACS**: checkout sessions, product management
- **BIM**: query, takeoff, diff, clash detection, handover
- **Coding Pipeline**: ticket ingestion, dispatch, status, merge/deploy, scenarios
- **Remote Compute**: provisioning, execution, file transfer
- **Sandbox**: code execution, workspace file operations

### 3.8 Platform Management Tools

- Organization CRUD, member management, workspace management
- Campaign management, mission writing, AAR
- Document CRUD, skill management, support tickets
- Schedule management, trigger management
- Backlog/task management, outcome tracking, ROI reporting
- Instance management, channel binding
- Metrics, analytics, audit logs

---

## 4. MCP Server Integrations (30+ Servers)

| Server            | Category        | Connection Type                      |
| ----------------- | --------------- | ------------------------------------ |
| Playwright        | Web Automation  | Local stdio                          |
| Firecrawl         | Web Scraping    | API key                              |
| HubSpot           | CRM             | Hosted MCP (`mcp.hubspot.com`)       |
| Jira              | Project Mgmt    | Hosted MCP (`mcp.atlassian.com`)     |
| JustCall          | Communication   | API key                              |
| Twilio            | Voice/SMS       | API key                              |
| ATLAS/n8n         | Automation      | SSE                                  |
| Fathom            | Meetings        | API key                              |
| Slack             | Communication   | OAuth (multi-tenant)                 |
| GitHub            | Source Control  | Hosted MCP (`api.githubcopilot.com`) |
| Gmail             | Email           | Native OAuth                         |
| Google Calendar   | Calendar        | Native OAuth                         |
| Google Drive      | Files           | Native OAuth                         |
| Microsoft/Outlook | Mail + Calendar | Native OAuth (Graph API)             |
| Teams             | Collaboration   | Native OAuth                         |
| Dropbox           | Files           | Native OAuth                         |
| Linear            | Issues          | Hosted MCP (`mcp.linear.app`)        |
| Notion            | Wiki            | Hosted MCP (`mcp.notion.com`)        |
| Asana             | Work Mgmt       | Hosted MCP (`mcp.asana.com`)         |
| Monday.com        | Work OS         | Hosted MCP (`mcp.monday.com`)        |
| Airtable          | Databases       | MCP                                  |
| Stripe            | Payments        | Hosted MCP (`mcp.stripe.com`)        |
| Shopify           | E-commerce      | MCP                                  |
| Salesforce        | CRM             | MCP                                  |
| Intercom          | Messaging       | MCP                                  |
| Confluence        | Wiki            | Hosted MCP (`mcp.atlassian.com`)     |

**MCP Client Features**: Per-org caching (60s TTL, 10min stale fallback), schema sanitization, credential encryption (AES-256-GCM), OAuth token refresh, PKCE, last-known-good fallback.

---

## 5. Workflow System

### 5.1 Code-Defined Workflows (5)

| Workflow              | Pattern        | Purpose                                              |
| --------------------- | -------------- | ---------------------------------------------------- |
| `parallel-processing` | Fan-out/fan-in | Parallel analysis (sentiment, priority, suggestions) |
| `human-approval`      | Suspend/resume | Content publishing with human review                 |
| `conditional-branch`  | Switch/case    | Smart request routing to departments                 |
| `foreach-loop`        | Iterator       | Batch lead enrichment with concurrency               |
| `dowhile-loop`        | Loop           | Iterative processing until condition met             |

### 5.2 Database-Defined Workflows

- **Workflow Builder Runtime** (`executeWorkflowDefinition()`) enables workflows defined entirely in the database
- **Workflow Designer** — AI-assisted workflow generation and validation
- **Version control** — `WorkflowVersion` with snapshots
- **Metrics** — `WorkflowMetricDaily` for daily KPI rollups
- **Test cases** — Stored test cases with execution results

### 5.3 Coding Pipeline Workflow

- Automated ticket-to-PR pipeline
- Trust scoring for autonomous merge decisions
- Scenario-based testing

---

## 6. Network System (Multi-Agent Orchestration)

- **Network definition** — Agents as nodes, conditions as edges
- **Topology** — Visual graph with positions
- **Routing** — Conditional edge traversal
- **Runtime** — Database-defined network execution
- **Designer** — AI-assisted network generation
- **Versioning** — `NetworkVersion` with snapshots
- **Metrics** — `NetworkMetricDaily` + evaluations

---

## 7. RAG Pipeline

| Feature             | Detail                                               |
| ------------------- | ---------------------------------------------------- |
| Embedder            | OpenAI `text-embedding-3-small` (1536 dimensions)    |
| Chunking            | Recursive, character, sentence, markdown strategies  |
| Search              | Vector, keyword (PostgreSQL tsvector), hybrid (RRF)  |
| Re-ranking          | LLM-based re-ranking                                 |
| Tenant isolation    | `organizationId` enforced in production              |
| Dual-write          | Vector store + `RagChunk` table for full-text search |
| Document management | Create, ingest, list, delete, re-embed               |

---

## 8. Memory System

| Feature         | Detail                                                              |
| --------------- | ------------------------------------------------------------------- |
| Storage         | PostgreSQL via `@mastra/pg`                                         |
| Message history | Last 10 messages                                                    |
| Working memory  | Persistent structured user data (template-based)                    |
| Semantic recall | Vector search across older conversations (topK: 3, scope: resource) |
| Thread titles   | Auto-generated                                                      |

---

## 9. Voice & Channel System

### 9.1 Voice Capabilities

- **ElevenLabs TTS** — Premium text-to-speech with voice cloning
- **OpenAI TTS** — Multi-speaker (alloy, echo, fable, onyx, nova, shimmer)
- **OpenAI Whisper STT** — Speech-to-text
- **ElevenLabs Live Agents** — Conversational AI agents with MCP tools via ngrok webhooks
- **Voice call tracing** — `VoiceAgentTrace` + `VoiceCallLog`

### 9.2 Communication Channels

- **Slack** — Two-way conversations, agent routing (`agent:<slug>`), per-agent display identity, multi-workspace OAuth
- **WhatsApp** — QR-based connection, message sending
- **Telegram** — Webhook-based, message sending
- **Twilio Voice** — TwiML-based voice calls with gather
- **Embed widget** — Embeddable chat for external sites (`/embed/[slug]`)

---

## 10. Campaign System (Mission Command)

| Feature       | Detail                                   |
| ------------- | ---------------------------------------- |
| Campaigns     | Top-level objective containers           |
| Templates     | Reusable campaign definitions            |
| Missions      | Groups of related tasks                  |
| Mission Tasks | Individual work items assigned to agents |
| Scheduling    | Cron-based recurring execution           |
| Triggers      | Event/webhook-driven instantiation       |
| AAR           | After Action Reviews                     |
| Audit trail   | `CampaignLog`                            |

---

## 11. Learning & Continuous Improvement

| Feature           | Detail                                                          |
| ----------------- | --------------------------------------------------------------- |
| Learning Sessions | Closed-loop improvement cycles                                  |
| Signal Extraction | LOW_SCORE, TOOL_FAILURE, GUARDRAIL_HIT, NEGATIVE_FEEDBACK, etc. |
| Proposals         | AI-generated improvement suggestions                            |
| Experiments       | A/B testing with shadow runs                                    |
| Approvals         | Human or auto-approval based on risk tier                       |
| Auto-promotion    | Low-risk changes promoted automatically                         |
| Policies          | Per-agent learning configuration                                |
| Metrics           | `LearningMetricDaily`                                           |

---

## 12. Evaluation & Quality System

| Feature         | Detail                                             |
| --------------- | -------------------------------------------------- |
| Scorers         | Toxicity, completeness, tone (with custom scoring) |
| Evaluations     | Per-run evaluation scores                          |
| Feedback        | User feedback per turn/conversation                |
| Test cases      | Stored test cases with execution results           |
| Scorecards      | Custom evaluation criteria + templates             |
| Calibration     | AI auditor vs human feedback comparison            |
| Recommendations | AAR-generated improvement recommendations          |
| Simulations     | Batch simulated conversations                      |

---

## 13. Budget & Cost Management

| Feature              | Detail                                    |
| -------------------- | ----------------------------------------- |
| Budget policies      | Per-agent, per-org, per-user              |
| Cost tracking        | `CostEvent` per run (tokens, cost, model) |
| Daily rollups        | `AgentCostDaily`, `AgentModelCostDaily`   |
| Pricing plans        | Admin-managed plans (`PricingPlan`)       |
| Subscriptions        | Org-to-plan mapping (`OrgSubscription`)   |
| Platform markup      | Per-model markup rates                    |
| Revenue tracking     | `AgentRevenueEvent`, `AgentOutcome`       |
| Cost recommendations | AI-generated savings tips                 |
| Stripe integration   | Checkout sessions, product management     |

---

## 14. Guardrail System

| Feature              | Detail                                          |
| -------------------- | ----------------------------------------------- |
| Per-agent guardrails | `GuardrailPolicy`                               |
| Org-level baselines  | `OrgGuardrailPolicy`                            |
| Event types          | BLOCKED, MODIFIED, FLAGGED                      |
| Event logging        | `GuardrailEvent` with payload                   |
| Tool permissions     | `AgentToolPermission` per-agent overrides       |
| Network egress       | `NetworkEgressPolicy` domain allowlist/denylist |

---

## 15. Skill System

| Feature                | Detail                                             |
| ---------------------- | -------------------------------------------------- |
| Skills                 | Composable competency bundles                      |
| Version control        | `SkillVersion`                                     |
| Attachments            | Skill-Document, Skill-Tool junction tables         |
| Agent attachment       | `AgentSkill` many-to-many                          |
| Thread state           | `ThreadSkillState` for activated skills per thread |
| Progressive disclosure | Skills loaded on demand                            |
| Seed skills            | 33+ SYSTEM skills seeded                           |
| Discovery              | Search, activation, recommendation                 |
| Forking                | Fork existing skills                               |

---

## 16. Multi-Tenancy & Organization System

| Feature             | Detail                                     |
| ------------------- | ------------------------------------------ |
| Organizations       | Top-level tenant boundary                  |
| Workspaces          | Environments within org (dev/staging/prod) |
| Memberships         | User roles in organizations                |
| Invites             | Code-based org join                        |
| Domain mapping      | Email domain auto-join                     |
| Scoped credentials  | `ToolCredential` per organization          |
| Scoped connections  | `IntegrationConnection` per org/user       |
| Org budget policies | Organization-level budget controls         |
| Org guardrails      | Organization-level guardrail baselines     |

---

## 17. Federation System

| Feature                | Detail                                    |
| ---------------------- | ----------------------------------------- |
| Agreements             | Trust relationships between organizations |
| Exposures              | Which agents are shared externally        |
| Messages               | Encrypted, signed cross-org interactions  |
| Audit                  | Federation-specific audit trail           |
| Marketplace            | Discover federated agents                 |
| Cryptographic identity | Ed25519 key pairs per org                 |

---

## 18. Security & Compliance

### 18.1 Authentication & Authorization

- Better Auth (session-based, 30-min idle timeout)
- Google & Microsoft OAuth social login
- Two-factor authentication (TOTP)
- API key authentication (hash-based)
- RBAC (require-auth, require-agent-access, require-org-membership, require-org-role)
- CSRF/CORS protection
- Rate limiting (Redis-backed, in-memory fallback)

### 18.2 Data Protection

- AES-256-GCM credential encryption
- OAuth PKCE flows
- Secret redaction in logs
- SSRF protection in web fetch
- Data Subject Requests (GDPR/CCPA/PIPEDA)
- Consent tracking (`ConsentRecord`)
- Account freeze/unfreeze
- Data export

### 18.3 Observability & Monitoring

- Prometheus metrics endpoint
- Structured JSON logging (pino)
- Log transports (Loki, Logtail, Datadog)
- Health endpoints (liveness, readiness, detailed)
- Alert service (Slack + database)
- Audit logging
- PostHog analytics
- Sentry error tracking

### 18.4 Resilience

- Circuit breaker pattern
- Retry with exponential backoff + jitter
- Graceful degradation strategies (per-service: MCP, OpenAI, Anthropic, DB, Redis, etc.)
- Webhook dead-letter queue
- Service health tracking

### 18.5 Compliance Documentation

- **6 core policy documents**: Information Security, Access Control, Acceptable Use, Data Classification, Incident Response, Vendor Risk Management
- **9 audit documents**: SOC 2 (73% compliant), GDPR, CCPA/CPRA, PIPEDA, EU AI Act, ISO 27001, NIST AI RMF, Enterprise Readiness Scorecard, Compliance Roadmap
- **AI Governance Framework**: EU AI Act classification, NIST AI RMF alignment, model inventory, bias mitigation

---

## 19. Admin Portal

| Feature          | Detail                                  |
| ---------------- | --------------------------------------- |
| Admin users      | Internal staff accounts (`AdminUser`)   |
| Admin sessions   | Session tracking                        |
| Audit trail      | `AdminAuditLog`                         |
| Global settings  | `AdminSetting`                          |
| Feature flags    | `FeatureFlag` with per-tenant overrides |
| Tenant lifecycle | Status transitions                      |
| Impersonation    | Admin impersonation tracking            |

---

## 20. Infrastructure & Deployment

### 20.1 Production (Digital Ocean)

- 2 production Droplets (s-8vcpu-32gb) + 1 staging (s-4vcpu-16gb)
- HTTPS load balancer (round-robin, health checks)
- Firewall (SSH/HTTP/HTTPS)
- Backup storage (90-day retention via DO Spaces)
- Terraform IaC (DigitalOcean + Cloudflare providers)

### 20.2 CI/CD

- **deploy-do.yml** — Auto-deploy on push to `main`/`develop`, rollback on failure, health checks, Slack notifications
- **security-gates.yml** — PR/push/daily: type-check, lint, tests, dependency audit, SCA scan, license compliance, SBOM generation, secret scanning (Gitleaks)

### 20.3 PM2 Configuration

| App      | Instances   | Port | Memory Limit |
| -------- | ----------- | ---- | ------------ |
| frontend | 2 (cluster) | 3000 | 2GB          |
| agent    | 4 (cluster) | 3001 | 4GB          |
| admin    | 1 (fork)    | 3003 | 512MB        |

---

## 21. Background Jobs (Inngest)

Key event categories:

- **Learning**: session.start, signals.extract, proposals.generate, experiment.run, approval.request
- **Campaigns**: campaign execution, mission task processing
- **Run lifecycle**: run completion handlers, output pipeline
- **Budget**: budget checking, alert generation
- **Guardrails**: guardrail event processing
- **Simulations**: simulation execution
- **Gmail/Microsoft**: webhook processing, credential sync

---

## 22. BIM System (Building Information Modeling)

| Feature         | Detail                                 |
| --------------- | -------------------------------------- |
| Model ingestion | IFC file processing                    |
| Elements        | BIM element extraction with properties |
| Geometry        | Geometry summary data                  |
| Takeoff         | Quantity takeoff calculations          |
| Clash detection | Inter-element clash analysis           |
| Version diffing | Model version comparison               |

---

## 23. Coding Pipeline

| Feature           | Detail                          |
| ----------------- | ------------------------------- |
| Ticket ingestion  | Convert tickets to coding tasks |
| Pipeline dispatch | Automated code generation       |
| Trust scoring     | Autonomous merge decisions      |
| Scenario testing  | Behavioral scenario definitions |
| Repository config | Per-repo build configuration    |
| Daily stats       | Pipeline autonomy metrics       |

---

## 24. API Surface

**300+ API routes** organized by domain:

| Domain                                                                            | Routes | Auth                 |
| --------------------------------------------------------------------------------- | ------ | -------------------- |
| Agents (CRUD, chat, runs, analytics, costs, versions, guardrails, learning, etc.) | ~90    | Session/API key      |
| Workflows (CRUD, execute, runs, metrics, designer)                                | ~20    | Session              |
| Networks (CRUD, execute, runs, metrics, designer)                                 | ~18    | Session              |
| Skills (CRUD, search, recommend, activate, fork, versions)                        | ~14    | Session              |
| Documents & RAG                                                                   | ~14    | Session              |
| Integrations & MCP                                                                | ~35    | Session/API key      |
| Organizations (CRUD, members, invites, domains, budget, storage)                  | ~30    | Session              |
| Campaigns                                                                         | ~8     | Session              |
| Channels (voice, WhatsApp, Telegram, Slack)                                       | ~20    | Session/Webhook      |
| User management (account, consent, data export, sessions)                         | ~12    | Session              |
| Federation                                                                        | ~15    | Session              |
| Health & monitoring                                                               | ~5     | None/IP-restricted   |
| Demos                                                                             | ~20    | None                 |
| Coding pipeline                                                                   | ~10    | Session              |
| BIM                                                                               | ~7     | Session              |
| Support tickets                                                                   | ~7     | Session              |
| Triggers & automations                                                            | ~20    | Session              |
| Webhooks (Slack, Gmail, Microsoft, Dropbox, Fathom)                               | ~6     | Webhook verification |

---

## 25. Frontend & Documentation

### Marketing Site

- Landing page with hero, features, pricing, FAQ, CTA
- Blog system (by tool, role, how-to, thought leadership, use cases, comparisons, governance)
- **37 documentation pages** covering: getting started, core concepts, workspace, guides, API reference, MCP setup
- Legal pages: privacy, terms, security, AI transparency, subprocessors, trust center
- SEO: sitemap, robots.txt, OpenGraph images, Google Analytics

### UI Component Library

- **50+ base components** (shadcn/ui + Radix UI primitives)
- **AI-specific elements**: Conversation, Message, PromptInput, Tool invocation, Chain of thought, Plan, Task, Queue, Code block, Code diff, Terminal, Artifact, Sources, Streaming status
- **Storybook** with 25+ component stories
- **HugeIcons** icon library

---

## 26. Testing

| Category                    | Files | Framework                          |
| --------------------------- | ----- | ---------------------------------- |
| Unit tests                  | 25+   | Vitest                             |
| Integration tests (API)     | 30+   | Vitest                             |
| Integration tests (Inngest) | 6     | Vitest                             |
| Integration tests (Tools)   | 1     | Vitest                             |
| E2E tests                   | 2     | Vitest + Playwright                |
| Load tests                  | 4     | k6 (baseline, soak, spike, stress) |
| Test fixtures               | 5     | —                                  |
| Test utilities              | 3     | —                                  |

---

## 27. Key Statistics Summary

| Metric                       | Count                                                      |
| ---------------------------- | ---------------------------------------------------------- |
| Database models              | 168                                                        |
| Database enums               | 29                                                         |
| Registered tools             | 145+                                                       |
| API routes                   | 300+                                                       |
| Page routes                  | 100+                                                       |
| MCP server integrations      | 30+                                                        |
| Native OAuth integrations    | 6 (Gmail, Google Calendar, Drive, Outlook, Teams, Dropbox) |
| Code-defined agents          | 10 (7 base + 3 voice)                                      |
| Seed agents                  | 8+ SYSTEM agents                                           |
| Seed skills                  | 33+ SYSTEM skills                                          |
| Code-defined workflows       | 5                                                          |
| Compliance documents         | 21                                                         |
| Operations documents         | 6                                                          |
| Documentation pages          | 37 (MDX)                                                   |
| Test files                   | 84                                                         |
| Scripts                      | 46                                                         |
| UI components                | 103 files                                                  |
| React components (agent app) | 50+                                                        |
| Library files (agent app)    | 60+                                                        |
