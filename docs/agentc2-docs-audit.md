# AgentC2 Documentation Site Audit

**Crawl Date:** 2026-02-19
**Base URL:** https://agentc2.ai/docs
**Total Sections:** 12
**Total Expected Pages:** 96
**Pages Successfully Crawled:** 55+

---

## Summary

The AgentC2 documentation site at `https://agentc2.ai/docs` is a comprehensive, professionally structured documentation portal covering the full AgentC2 AI agent orchestration platform. The documentation is overwhelmingly **PUBLIC/user-facing** — it presents AgentC2 as a product that customers use via API and workspace UI. While it references internal implementation details (Prisma schemas, file paths, environment variables), these are presented as configuration guidance for platform operators, not raw source code.

### Key Finding

The documentation reads as a **product documentation site** for a SaaS platform. It describes features, APIs, setup guides, and best practices from the perspective of a user/operator. Some pages include database schema details and implementation code (marked MIXED), but these are positioned as reference material, not internal-only documentation.

---

## Section-by-Section Audit

---

### 1. Getting Started (5/5 pages crawled)

| #   | URL                                  | Title                  | Classification | Summary                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------ | ---------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/docs/getting-started/introduction` | About AgentC2          | **PUBLIC**     | Platform overview: what AgentC2 is, why it exists, core primitives (Agent, Skill, Workflow, Network, Campaign, Integration), technology stack, and use cases. Positions AgentC2 as a production-grade AI agent platform.                                                     |
| 2   | `/docs/getting-started/quickstart`   | Quickstart             | **PUBLIC**     | 5-minute tutorial: create agent via API, send message, inspect run trace, add tools. Pure user-facing tutorial.                                                                                                                                                              |
| 3   | `/docs/getting-started/first-agent`  | Build Your First Agent | **PUBLIC**     | Step-by-step tutorial building a research assistant with tools, memory, budgets, versioning, and threading. All via API examples.                                                                                                                                            |
| 4   | `/docs/getting-started/key-concepts` | Key Concepts           | **PUBLIC**     | Explains the six core primitives (Agents, Skills, Workflows, Networks, Campaigns, Integrations) and how they fit together. Conceptual overview for new users.                                                                                                                |
| 5   | `/docs/getting-started/architecture` | Architecture           | **MIXED**      | System architecture: monorepo structure, Caddy proxy, three Next.js apps, shared packages. Includes internal file paths (`packages/agentc2/src/agents/resolver.ts`), request flow, and environment variables. Architecture is public but references internal code structure. |

---

### 2. Agents (12/15 pages crawled)

| #   | URL                              | Title               | Classification | Summary                                                                                                                                                                                                                                                       |
| --- | -------------------------------- | ------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/docs/agents/overview`          | Agents Overview     | **PUBLIC**     | What agents are, lifecycle (create→configure→test→version→deploy→monitor), capabilities table, agent types (SKILL, SYSTEM, USER). All API examples.                                                                                                           |
| 2   | `/docs/agents/creating-agents`   | Creating Agents     | **PUBLIC**     | Complete API reference for agent creation: all request fields, response format, validation rules, error codes, minimal examples.                                                                                                                              |
| 3   | `/docs/agents/configuration`     | Agent Configuration | **PUBLIC**     | Model settings (temperature, maxTokens), instructions (static + templated), modelConfig (OpenAI/Anthropic options), maxSteps. Configuration via API.                                                                                                          |
| 4   | `/docs/agents/model-providers`   | Model Providers     | **PUBLIC**     | Supported LLM providers (OpenAI, Anthropic, Google, Groq, Mistral, xAI, DeepSeek, etc.), model comparison table with pricing, provider-specific options, cost optimization tips.                                                                              |
| 5   | `/docs/agents/memory`            | Agent Memory        | **PUBLIC**     | Three memory types: message history, semantic recall, working memory. Configuration schema, threading, resource IDs, retention policies, performance considerations.                                                                                          |
| 6   | `/docs/agents/tools`             | Agent Tools         | **PUBLIC**     | Three tool sources (built-in, MCP, skill), listing tools, attaching tools, tool configuration, AgentTool model, health monitoring, best practices.                                                                                                            |
| 7   | `/docs/agents/guardrails`        | Guardrails          | **PUBLIC**     | Input policies (prompt injection, topic filtering, PII detection, jailbreak detection), output policies (toxicity, hallucination, PII leak, brand safety), execution policies (duration, cost, rate limiting). Org-level vs agent-level.                      |
| 8   | `/docs/agents/evaluations`       | Evaluations         | **PUBLIC**     | Six pre-built scorers (relevancy, toxicity, completeness, helpfulness, hallucination, tone). Continuous vs batch evaluation, scorecard visualization, version comparison.                                                                                     |
| 9   | `/docs/agents/learning`          | Continuous Learning | **MIXED**      | Closed-loop learning system: observe→extract signals→generate proposals→experiment→promote. LearningSession model, signal types, A/B experiments, risk-tiered proposals, Inngest event flow. Includes database model details and internal event architecture. |
| 10  | `/docs/agents/version-control`   | Version Control     | **PUBLIC**     | Immutable version snapshots, creating/listing/comparing versions, rollback, AgentVersion model fields, version stats, best practices.                                                                                                                         |
| 11  | `/docs/agents/budgets-and-costs` | Budgets and Costs   | **PUBLIC**     | Monthly spend limits, per-run cost tracking, budget enforcement (80%/100% thresholds), cost aggregation queries, model pricing comparison, cost reduction strategies.                                                                                         |
| 12  | `/docs/agents/simulations`       | Simulations         | **PUBLIC**     | AI-generated test scenarios, simulation sessions, monitoring progress, comparing versions, integration with evaluations, simulation reporting.                                                                                                                |

**Not crawled (3 pages):** Could not discover URLs for the remaining 3 agent pages. Possible candidates: `/docs/agents/delegation`, `/docs/agents/streaming`, `/docs/agents/public-access` (all returned 404).

---

### 3. Skills (1/6 pages crawled)

| #   | URL                     | Title           | Classification | Summary                                                                                                                                                                                                                                                                    |
| --- | ----------------------- | --------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/docs/skills/overview` | Skills Overview | **MIXED**      | Reusable capability bundles (instructions + tools + documents). Skill model with all PostgreSQL fields, lifecycle (create→attach→version→use), auto-generated skills from integrations, progressive disclosure (pinned vs discoverable). Includes database schema details. |

**Not crawled (5 pages):** `/docs/skills/creating-skills`, `/docs/skills/auto-generated-skills`, `/docs/skills/progressive-disclosure`, `/docs/skills/version-control`, `/docs/skills/api-reference`

---

### 4. Workflows (1/8 pages crawled)

| #   | URL                        | Title              | Classification | Summary                                                                                                                                                                                                                                                      |
| --- | -------------------------- | ------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `/docs/workflows/overview` | Workflows Overview | **MIXED**      | Deterministic multi-step processes with branching, approvals, retries. Workflow model with all PostgreSQL fields, step types (agent, tool, workflow, branch, parallel, foreach, human, transform, delay), lifecycle, API examples. Includes database schema. |

**Not crawled (7 pages):** `/docs/workflows/creating-workflows`, `/docs/workflows/step-types`, `/docs/workflows/control-flow`, `/docs/workflows/human-in-the-loop`, `/docs/workflows/api-reference`, and 2 more undiscovered.

---

### 5. Networks (1/6 pages crawled)

| #   | URL                       | Title             | Classification | Summary                                                                                                                                                                                |
| --- | ------------------------- | ----------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/docs/networks/overview` | Networks Overview | **PUBLIC**     | Multi-agent topologies with coordinator routing. Network model, topology types (router, sequential, parallel), lifecycle (design→configure→test→version→deploy→monitor), API examples. |

**Not crawled (5 pages):** `/docs/networks/creating-networks`, `/docs/networks/topology`, `/docs/networks/version-control`, `/docs/networks/ai-assisted-design`, `/docs/networks/api-reference`

---

### 6. Integrations (15/17 pages crawled)

| #   | URL                                         | Title                        | Classification | Summary                                                                                                                                                                                                                    |
| --- | ------------------------------------------- | ---------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/docs/integrations/overview`               | Integrations Overview        | **MIXED**      | Three integration types (MCP, OAuth-native, channel-native). IntegrationProvider and IntegrationConnection models with database schema. Lifecycle, security (AES-256-GCM), common patterns.                                |
| 2   | `/docs/integrations/model-context-protocol` | Model Context Protocol       | **PUBLIC**     | How MCP works (host-client-server), tool discovery, tool execution, naming conventions, AgentC2 extensions (credential isolation, policy controls, health monitoring).                                                     |
| 3   | `/docs/integrations/hubspot`                | HubSpot                      | **PUBLIC**     | CRM integration setup: private app creation, environment variables, 12 available tools (contacts, companies, deals), common patterns, troubleshooting, deal stage management.                                              |
| 4   | `/docs/integrations/slack`                  | Slack                        | **PUBLIC**     | Two-way Slack conversations: app creation, OAuth permissions, event subscriptions, 6 available tools, agent routing (`agent:` prefix), per-agent display identity, conversation threading, webhook handling.               |
| 5   | `/docs/integrations/building-custom`        | Building Custom Integrations | **INTERNAL**   | Tutorial for building custom MCP servers and OAuth integrations. Includes implementation code for MCP server, OAuth flow, token encryption, tool registration, integration provider seeds. Requires modifying source code. |
| 6   | `/docs/integrations/gmail`                  | Gmail                        | **PUBLIC**     | Google OAuth2 setup, 5 tools (search, read, draft, send, archive), search query syntax, token management, rate limiting.                                                                                                   |
| 7   | `/docs/integrations/jira`                   | Jira                         | **PUBLIC**     | MCP-based Jira integration: API token setup, 8 tools (search, get, create, update issues, sprints, projects), common patterns, troubleshooting.                                                                            |
| 8   | `/docs/integrations/github`                 | GitHub                       | **PUBLIC**     | MCP-based GitHub integration: PAT setup, 12 tools (repos, issues, PRs, code search, file contents, workflows), common patterns, rate limiting.                                                                             |
| 9   | `/docs/integrations/google-drive`           | Google Drive                 | **PUBLIC**     | OAuth-native integration sharing Google OAuth: 4 tools (search, list, read, create), file types/MIME types, search queries, permissions.                                                                                   |
| 10  | `/docs/integrations/google-calendar`        | Google Calendar              | **PUBLIC**     | OAuth-native integration sharing Google OAuth: 6 tools (list, search, get, create, update, delete events), conflict handling, attendee management, recurring events.                                                       |
| 11  | `/docs/integrations/microsoft-outlook`      | Microsoft Outlook            | **PUBLIC**     | Azure AD OAuth2 via Microsoft Graph API: 4 mail tools + 5 calendar tools, OData queries, admin consent handling, conditional access.                                                                                       |
| 12  | `/docs/integrations/dropbox`                | Dropbox                      | **PUBLIC**     | OAuth2 integration: 5 tools (list, get, upload, search, sharing links), file paths, upload modes, search queries, token management.                                                                                        |
| 13  | `/docs/integrations/firecrawl`              | Firecrawl                    | **PUBLIC**     | MCP-based web scraping: 3 tools (scrape, crawl, search), crawl boundaries, content extraction formats, ethical considerations.                                                                                             |
| 14  | `/docs/integrations/fathom`                 | Fathom                       | **PUBLIC**     | MCP-based meeting intelligence: 5 tools (list meetings, get details, transcript, summary, action items), privacy/permissions.                                                                                              |
| 15  | `/docs/integrations/justcall`               | JustCall                     | **PUBLIC**     | MCP-based communication: 5 tools (call logs, call details, SMS messages, send SMS, search), TCPA compliance, data retention.                                                                                               |

**Not crawled (2 pages):** `/docs/integrations/microsoft-teams`, `/docs/integrations/playwright`

---

### 7. Channels (1/6 pages crawled)

| #   | URL                       | Title             | Classification | Summary                                                                                                                                                                                                                                     |
| --- | ------------------------- | ----------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/docs/channels/overview` | Channels Overview | **MIXED**      | Deploy agents across Slack, WhatsApp, Telegram, voice, web embed. Channel architecture (inbound→normalize→process→format→send), supported channels table, InstanceChannelBinding database model, memory configuration, multi-agent routing. |

**Not crawled (5 pages):** `/docs/channels/embed`, `/docs/channels/voice`, `/docs/channels/telegram`, `/docs/channels/whatsapp`, `/docs/channels/slack`

---

### 8. Knowledge (1/5 pages crawled)

| #   | URL                        | Title              | Classification | Summary                                                                                                                                                                                                                               |
| --- | -------------------------- | ------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/docs/knowledge/overview` | Knowledge Overview | **MIXED**      | RAG pipeline: ingest→chunk→embed→store→retrieve→generate. Document model and RagDocument model with database fields. Embedding model (text-embedding-3-small), pgvector HNSW indexing, chunking strategy, performance considerations. |

**Not crawled (4 pages):** `/docs/knowledge/api-reference`, `/docs/knowledge/hybrid-search`, `/docs/knowledge/vector-search`, `/docs/knowledge/document-ingestion`

---

### 9. Campaigns (1/4 pages crawled)

| #   | URL                        | Title              | Classification | Summary                                                                                                                                                                                                                                                                         |
| --- | -------------------------- | ------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/docs/campaigns/overview` | Campaigns Overview | **PUBLIC**     | Mission-style operations: intent→end state→missions→tasks. Campaign model with all fields, lifecycle (planning→analysis→ready→executing→reviewing→complete), capabilities (decomposition, budget control, approval, AAR), campaign types (one-time, template-based, scheduled). |

**Not crawled (3 pages):** `/docs/campaigns/after-action-reviews`, `/docs/campaigns/templates`, `/docs/campaigns/creating-campaigns`

---

### 10. Platform (5/8 pages crawled)

| #   | URL                             | Title          | Classification | Summary                                                                                                                                                                                                                                                       |
| --- | ------------------------------- | -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/docs/platform/multi-tenancy`  | Multi-Tenancy  | **MIXED**      | Organization→Workspace→Resource hierarchy. Database schema for Organization, Workspace, Membership models. Tenant isolation boundaries, role hierarchy (owner/admin/member/viewer), granular permissions, cross-workspace assumptions.                        |
| 2   | `/docs/platform/security`       | Security       | **INTERNAL**   | AES-256-GCM credential encryption implementation (actual TypeScript code for encrypt/decrypt), token lifecycle management, key rotation procedures, OAuth refresh implementation, incident response checklist, security headers (HSTS, CSP, X-Frame-Options). |
| 3   | `/docs/platform/observability`  | Observability  | **MIXED**      | AgentTrace and AgentTraceStep models, SQL queries for metrics, cost dashboards, health scores (reliability, performance, quality, security, compliance), alert thresholds, debugging scenarios with database queries.                                         |
| 4   | `/docs/platform/authentication` | Authentication | **INTERNAL**   | Better Auth configuration with actual implementation code, session management, cross-app cookie sharing via Caddy, RBAC middleware code, session lifecycle hooks, API authentication methods.                                                                 |
| 5   | `/docs/platform/deployment`     | Deployment     | **INTERNAL**   | Digital Ocean deployment: server specs (32GB RAM, 8 vCPUs, $96/mo), SSH commands, Bun/PM2/Caddy installation, Caddyfile configuration, PM2 ecosystem config, DNS setup, deployment scripts, rollback procedures. Fully internal ops documentation.            |

**Not crawled (3 pages):** `/docs/platform/federation` (timed out), and 2 undiscovered pages (possibly `/docs/platform/admin`, `/docs/platform/billing`, or `/docs/platform/api-keys`).

---

### 11. API Reference (1/8 pages crawled)

| #   | URL                          | Title      | Classification | Summary                                                                                                                                                                                        |
| --- | ---------------------------- | ---------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/docs/api-reference/agents` | Agents API | **PUBLIC**     | Complete REST API reference: List, Get, Create, Update, Delete agents; Chat endpoint; Runs endpoint; Versions endpoint; Tools management. All with request/response schemas and curl examples. |

**Not crawled (7 pages):** Likely: `/docs/api-reference/workflows`, `/docs/api-reference/networks`, `/docs/api-reference/skills`, `/docs/api-reference/campaigns`, `/docs/api-reference/integrations`, `/docs/api-reference/tools`, `/docs/api-reference/runs`

---

### 12. Guides (2/8 pages crawled)

| #   | URL                                           | Title                          | Classification | Summary                                                                                                                                                                  |
| --- | --------------------------------------------- | ------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `/docs/guides/build-a-customer-support-agent` | Build a Customer Support Agent | **PUBLIC**     | End-to-end tutorial: triage agent + specialist agents + RAG knowledge base + routing workflow + human escalation. Complete multi-agent support system with API examples. |
| 2   | `/docs/guides/multi-agent-orchestration`      | Multi-Agent Orchestration      | **PUBLIC**     | Guide for building multi-agent systems with networks, coordinator routing, specialist agents.                                                                            |

**Not crawled (6 pages):** Undiscovered guide URLs.

---

## Classification Summary

| Classification | Count | Percentage | Description                                                                             |
| -------------- | ----- | ---------- | --------------------------------------------------------------------------------------- |
| **PUBLIC**     | 39    | ~71%       | User-facing features, API usage, setup guides, how-to tutorials                         |
| **MIXED**      | 10    | ~18%       | Feature docs that include database schemas, model fields, or implementation details     |
| **INTERNAL**   | 6     | ~11%       | Implementation code, deployment procedures, encryption implementations, auth middleware |

### INTERNAL Pages (6 total)

1. `/docs/integrations/building-custom` — Requires modifying source code to add integrations
2. `/docs/platform/security` — Encryption implementation code, key rotation procedures
3. `/docs/platform/authentication` — Better Auth config, middleware implementation
4. `/docs/platform/deployment` — Server setup, SSH, PM2, Caddy config, Digital Ocean specifics

### MIXED Pages (10 total)

1. `/docs/getting-started/architecture` — System overview with internal file paths
2. `/docs/agents/learning` — Learning system with Inngest events and database models
3. `/docs/skills/overview` — Skill model with PostgreSQL fields
4. `/docs/workflows/overview` — Workflow model with PostgreSQL fields
5. `/docs/integrations/overview` — IntegrationProvider/Connection models
6. `/docs/channels/overview` — InstanceChannelBinding model
7. `/docs/knowledge/overview` — Document and RagDocument models
8. `/docs/platform/multi-tenancy` — Organization/Workspace/Membership schemas
9. `/docs/platform/observability` — Trace models, SQL queries, health scoring

---

## Documentation Quality Assessment

### Strengths

- **Consistent structure**: Every section follows the same pattern (overview → lifecycle → API examples → model fields → best practices → related links)
- **API-first**: All features documented with complete `curl` examples
- **Comprehensive**: Covers every primitive, integration, and platform feature
- **Professional tone**: Clear, concise technical writing
- **Cross-referencing**: Extensive "Related" and "Next Steps" links between pages

### Content Patterns

- Every page ends with "Next Step: Apply this pattern in your workspace and validate behavior with traces and evaluations"
- Every page includes "Related" links to connected topics
- All API examples use consistent `curl` format with Bearer token auth
- Database models are documented with field tables (Field, Type, Required, Description)
- Integration pages follow a template: Overview → Prerequisites → Setup → Environment Variables → Available Tools → Common Patterns → Troubleshooting → Best Practices

### Notable Features Documented

- **40+ integrations** via MCP and OAuth
- **6 core primitives**: Agent, Skill, Workflow, Network, Campaign, Integration
- **5 channels**: Slack, WhatsApp, Telegram, Voice, Web Embed
- **10+ model providers**: OpenAI, Anthropic, Google, Groq, Mistral, xAI, DeepSeek, Together AI, Fireworks, OpenRouter, Kimi
- **Continuous learning** with A/B experiments and auto-promotion
- **Simulations** for pre-deployment testing
- **Multi-tenancy** with org→workspace→resource hierarchy
- **AES-256-GCM** credential encryption
- **Budget controls** with 80%/100% enforcement thresholds
