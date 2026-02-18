# AgentC2 — Product Overview

_For internal alignment, investors, and partners_

---

## What AgentC2 Does

AgentC2 is an enterprise AI platform that connects the tools a business already uses — CRM, email, calendar, project management, messaging, knowledge bases — and deploys autonomous AI that works across all of them to deliver measurable operational outcomes.

The platform provides two paths to value:

1. **Pre-built products** — Named, outcome-oriented solutions like Deal Copilot (sales), Ticket Triager (support), Bug Bouncer (engineering), and Daily Briefing (executive). Each connects 3-6 tools, runs autonomously, and has a documented ROI metric. A customer selects a product, connects their tools via one-click OAuth, and has it running in minutes.

2. **Custom agents** — For organizations with specific needs, the platform provides a full agent builder with multi-agent networks, DAG-based workflows, knowledge base (RAG), voice capabilities, and a skills system. Agents can be orchestrated into networks, governed by guardrails, and monitored through full execution traces.

Both paths share the same enterprise infrastructure: multi-tenant architecture, role-based access control, audit logging, budget controls, guardrails (PII detection, hallucination filtering, brand safety), and AES-256 credential encryption.

---

## Who It's For

### Primary Buyers

| Persona                | Title Examples                   | Why They Buy                                                                                                                       |
| ---------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Revenue Leader**     | VP Sales, CRO, Head of Revenue   | Reps spend 40% of time on CRM data entry. Deal Copilot automates post-meeting CRM updates, follow-ups, and scheduling.             |
| **Operations Leader**  | COO, Head of Ops, Chief of Staff | Information scattered across 6+ dashboards. Daily Briefing aggregates the entire business into a 2-minute morning read.            |
| **Support Leader**     | VP Support, Head of CS           | Ticket volume growing faster than headcount. Ticket Triager classifies, routes, and suggests resolutions in seconds.               |
| **Engineering Leader** | CTO, VP Engineering              | Bugs pile up while the team builds features. Bug Bouncer turns Sentry errors into Jira tickets with full context in 30 seconds.    |
| **Executive**          | CEO, Founder, C-suite            | Decision latency from manual data gathering. Daily Briefing and Board Deck Builder deliver synthesized intelligence automatically. |

### Business Size

| Segment                     | Profile                                                                                | Entry Point                                  |
| --------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Small Business (5-50)**   | Founder/GM is the decision maker. Needs turnkey outcomes, not a platform to configure. | Pre-built products, self-serve, $29-79/mo    |
| **Mid-Market (50-500)**     | VP/Director buyer. Needs cross-department coordination and governance.                 | Business tier, 5+ seats, $199/mo             |
| **Enterprise (500+)**       | CTO/COO buyer. Needs SSO, SLA, custom MCP integrations, dedicated infrastructure.      | Enterprise tier, custom pricing              |
| **Vertical (Construction)** | Owner/Ops Manager at an ICI subcontractor. Already uses Appello.                       | Appello Intelligence, bundled, $250-1,000/mo |

---

## Core Problems It Solves

### 1. The Gap Between Tools

Every business runs on 5-15 SaaS tools. None of them talk to each other meaningfully. The work that happens _between_ tools — updating the CRM after a meeting, creating a Jira ticket from a Sentry error, compiling a weekly report from 6 data sources — is done by humans. It's tedious, error-prone, and expensive.

**AgentC2 fills the gap with AI that reasons across the entire tool stack.**

### 2. The Automation Ceiling

Traditional automation (Zapier, IFTTT, n8n) uses trigger-action logic: "If X happens in Tool A, do Y in Tool B." This works for simple, predictable scenarios. But most business processes require judgment — reading a meeting transcript and deciding which CRM fields to update, classifying a support ticket by priority when the category isn't obvious, determining whether an error is a new bug or a duplicate.

**AgentC2 uses LLM reasoning at every step, not if/then rules.**

### 3. The Trust Deficit

62% of organizations are experimenting with AI agents, but only 2% have achieved scaled deployment. The gap is trust — enterprises need observability, audit trails, budget controls, and guardrails before they'll deploy AI into production workflows.

**AgentC2 is built for enterprise governance from the ground up: full execution traces, per-run cost tracking, PII detection, hallucination filtering, budget limits, and role-based access.**

### 4. The Proof Gap

Every AI agent platform sells a hypothesis: "Imagine what AI could do for your business." None of them can point to a specific industry with specific companies saving specific hours per week with documented, named outcomes.

**AgentC2 has 35 paying customers in construction with zero churn and documented ROI. Every other platform starts at zero.**

---

## Key Features

### Products (Pre-Built Outcomes)

25+ named products organized by department. Each one connects specific platforms, runs a specific workflow, and delivers a measurable result. Featured products:

| Product            | Department      | Platforms                                          | Outcome                      |
| ------------------ | --------------- | -------------------------------------------------- | ---------------------------- |
| Deal Copilot       | Sales           | HubSpot + Gmail + Calendar + Slack                 | 8+ hrs/week saved per rep    |
| Ticket Triager     | Support         | Intercom + Slack + Jira + RAG                      | 80% faster first response    |
| Bug Bouncer        | Engineering     | GitHub + Sentry + Jira + Slack                     | Error → ticket in 30 seconds |
| Daily Briefing     | Executive       | Gmail + Calendar + Slack + HubSpot + Jira + Stripe | Entire business in 2 minutes |
| Morning Dispatch   | Construction    | Appello + Slack/Email                              | Know your day before 7 AM    |
| Voice Receptionist | Client Services | ElevenLabs + Calendar + HubSpot + Slack            | Never miss a call. 24/7.     |

### Platform Capabilities

| Capability               | Description                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-Agent Networks** | LLM-orchestrated routing across specialized agents. A network collaborates — research agent → drafting agent → CRM agent — with shared context.         |
| **Workflows**            | DAG-based execution: sequential, parallel, branching, looping, with human-approval gates. Complex business logic that pauses when judgment is required. |
| **Knowledge Base (RAG)** | Document ingestion, chunking, and vector search. Agents answer from your company's actual knowledge, not generic training data.                         |
| **Voice Agents**         | ElevenLabs-powered voice with natural conversation. Answer calls, book appointments, conduct surveys, transfer urgent calls.                            |
| **Canvas Dashboards**    | Natural-language-generated interactive dashboards. Ask for what you want to see, get a live visualization.                                              |
| **Skills System**        | Composable bundles of instructions + tools + knowledge. Reusable expertise packages that can be attached to any agent.                                  |
| **Continuous Learning**  | A/B experiments, proposal generation, and human-approved optimizations. Products improve the longer they run.                                           |
| **Campaigns**            | Multi-phase mission planning and execution. Autonomous orchestration of complex, multi-agent operations.                                                |

### Enterprise Governance

| Capability              | Detail                                                                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Observability**       | Full execution traces per run. Token usage, cost, latency, decision path — all recorded. Daily metrics rollups for success rate, duration, and quality.                                                                                 |
| **Guardrails**          | Input: PII detection, jailbreak prevention, prompt injection detection, topic blocking. Output: toxicity filtering, hallucination detection, PII leak prevention, brand safety. Execution: max duration, max tool calls, rate limiting. |
| **Budget Controls**     | Per-agent monthly spend limits. Alert thresholds (default 80%). Hard stops when budgets are exceeded. Per-run cost tracking.                                                                                                            |
| **Role-Based Access**   | Owner, Admin, Member, Viewer. Granular permissions per workspace.                                                                                                                                                                       |
| **Audit Logs**          | Every action traced — who deployed what agent, when, with what configuration, what it did, what it cost.                                                                                                                                |
| **Workspaces**          | Dev / Staging / Production environments per organization. Promote agents through environments with version control.                                                                                                                     |
| **Credential Security** | AES-256-GCM encryption for all OAuth tokens and API keys at rest. Per-organization credential scoping.                                                                                                                                  |
| **Admin Portal**        | Tenant management, user impersonation, feature flags with per-tenant overrides, support ticket system, platform-wide observability.                                                                                                     |

### Integrations (30+)

All integrations use the **Model Context Protocol (MCP)** — the open standard for AI-to-tool communication established by Anthropic. Native OAuth integrations for Gmail, Outlook, Google Calendar, Outlook Calendar, Google Drive, and Dropbox.

| Category                 | Platforms                                          |
| ------------------------ | -------------------------------------------------- |
| Communication            | Gmail, Outlook Mail, Slack, JustCall, Twilio       |
| Calendar                 | Google Calendar, Outlook Calendar                  |
| CRM & Sales              | HubSpot, Salesforce                                |
| Project Management       | Jira, Linear, Asana, Monday.com, Notion            |
| File Storage & Knowledge | Google Drive, Dropbox, Confluence, Fathom, YouTube |
| Developer Tools          | GitHub, Sentry, Vercel, Supabase, Cloudflare, Neon |
| E-commerce & Payments    | Stripe, Shopify                                    |
| Design & Web             | Figma, Webflow                                     |
| Automation & Data        | Zapier, n8n / ATLAS, Airtable                      |
| Customer Support         | Intercom                                           |
| Web Intelligence         | Firecrawl, Playwright                              |
| Voice                    | ElevenLabs, OpenAI Voice                           |

---

## Differentiators

### 1. Proven Results, Not Hypothetical Value

35 companies in the construction industry run on AgentC2 via Appello Intelligence. Zero have churned. Documented outcomes include: 50% admin time reduction (R.A. Barnes), 3 admin roles consolidated to 1 (Vanos), 30% overhead reduction (All Temp). No other AI agent platform has a single vertical with paying customers, case studies, and named outcomes.

### 2. Cross-Tool Orchestration with AI Reasoning

AgentC2 products work across 3-6 tools simultaneously with LLM reasoning at every step. Deal Copilot reads an email, updates HubSpot, drafts a follow-up, books a meeting, and notifies Slack — understanding context at each step, not following a rigid rule. Zapier chains two tools with if/then logic. ChatGPT operates in a single conversation window. AgentC2 reasons across the full stack.

### 3. Enterprise Governance from Day One

The platform was architectured for enterprise deployment: multi-tenant organizations with lifecycle management, admin portal with RBAC and impersonation, guardrails (PII, hallucination, toxicity, jailbreak), budget controls with hard limits, full execution traces, audit logs, and workspace environments (dev/staging/prod). This is not a consumer tool with enterprise features bolted on — it's an enterprise platform with a consumer-friendly entry ramp.

### 4. Proprietary Vertical Moat

The Appello MCP server exposes 12 modules of construction operations data (scheduling, timesheets, safety, equipment, job costing, billing, HR, estimating) to AI agents. No competitor can replicate this without Appello's cooperation — it requires access to the proprietary API and deep domain knowledge of ICI subcontractor operations. This pattern (vertical SaaS + MCP + products) is the expansion playbook for every subsequent vertical.

### 5. Voice-Native

Built-in voice agents powered by ElevenLabs and OpenAI Voice. Answer inbound calls, book appointments, conduct surveys, transfer urgent calls — with natural, human-sounding conversation. Voice Receptionist is a category-defining product for professional services. Among direct competitors, only Lindy offers voice (at $50-200/month extra). AgentC2 includes it in the Business tier.

### 6. Open Standard (MCP)

All integrations use the Model Context Protocol — the emerging open standard for AI-to-tool communication. This means AgentC2 can adopt any new MCP server built by the community, and customers can build custom MCP servers for their proprietary systems. No vendor lock-in on the integration layer.

---

## Technology Stack

| Layer           | Technology                                                      |
| --------------- | --------------------------------------------------------------- |
| Runtime         | Bun 1.3.4+, Turborepo                                           |
| Framework       | Next.js 16, React 19, TypeScript 5                              |
| AI              | Mastra Core, AI SDK, OpenAI (GPT-4o), Anthropic (Claude Sonnet) |
| Voice           | ElevenLabs, OpenAI Realtime                                     |
| Database        | PostgreSQL (Supabase), Prisma 6                                 |
| Auth            | Better Auth (session-based)                                     |
| Background Jobs | Inngest                                                         |
| UI              | shadcn/ui, Tailwind CSS 4                                       |
| Deployment      | Digital Ocean (32GB / 8 vCPU), Caddy, PM2                       |
| Security        | AES-256-GCM credential encryption, SOC 2 Type 1 in progress     |

---

## Business Model

| Revenue Stream            | Description                                                                                                         | Margin |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------ |
| **AgentC2 Platform SaaS** | Self-serve subscriptions: Free → Starter ($29) → Pro ($79) → Business ($199) → Enterprise (custom)                  | ~85%   |
| **Appello Intelligence**  | AI tier bundled with Appello subscriptions: Starter ($250) → Pro ($500) → Enterprise ($1,000)                       | ~90%   |
| **Vertical Bundles**      | Industry-specific MCP + curated products for new verticals (property management, professional services, healthcare) | ~85%   |
| **Professional Services** | Custom agent/product building for enterprise customers                                                              | ~60%   |

---

## Traction

| Metric                                 | Value                                              |
| -------------------------------------- | -------------------------------------------------- |
| Appello customers (base)               | 20 (zero churn, 3+ years)                          |
| Appello Intelligence target (Dec 2026) | 35 customers                                       |
| AgentC2 public target (Dec 2026)       | 500+ free users, 200+ paid                         |
| MCP integrations built                 | 30+                                                |
| Products available                     | 25+ (8 horizontal, 10 construction, 7+ additional) |
| Internal agents running                | 40+                                                |
| Total AI spend to date                 | $218                                               |
| Average customer time savings          | 10+ hours/week                                     |

---

## Competitive Position

```
                         ENTERPRISE ←————————————→ SMB
                              |                     |
HORIZONTAL        OpenAI · Anthropic          Zapier Agents
(generic)         Microsoft Copilot           Relevance AI
                  Salesforce AgentForce       Lindy · n8n
                              |                     |
                              |      ★ AgentC2 ★    |
                              |     vertical-first   |
                              |     + horizontal     |
                              |     + proven results |
                              |                     |
VERTICAL          Palantir · C3.ai          ServiceTitan AI
(industry)        (enterprise only)          Procore AI
                              |                     |
```

**Every competitor is missing at least two of:** vertical proof, horizontal platform, cross-tool orchestration, voice, enterprise governance, MCP ecosystem. AgentC2 has all six.

---

## Company

|                        |                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------- |
| **Legal Entity**       | Appello Software Pty Ltd (AgentC2 as a division; separate entity at next fundraise) |
| **Founded**            | 2023 (Appello); 2025 (AgentC2 / Catalyst)                                           |
| **Headquarters**       | London, Ontario, Canada                                                             |
| **Team**               | 10 (CEO, COO, Sales, CSM, 6 engineers)                                              |
| **Appello ARR**        | ~$400K (growing toward $1M by Oct 2026)                                             |
| **AgentC2 ARR Target** | $330K incremental by Dec 2026                                                       |
| **Funding**            | ~$1M raise in progress (Appello); bootstrapped to date                              |
| **Domain**             | agentc2.ai (secured, live)                                                          |
