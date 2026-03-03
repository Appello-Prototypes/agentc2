---
name: "Website — Plan 5: Vertical Use Case Pages"
overview: "Build use case pages for 6 key verticals/functions: Sales & Revenue, Customer Support, Engineering & DevOps, Construction & AEC, Operations, and Partner Networks. Each page connects platform capabilities to specific business outcomes."
todos:
    - id: phase-1-template-sales-support
      content: "Phase 1: Create use case template + Sales & Revenue + Customer Support pages"
      status: pending
    - id: phase-2-engineering-construction
      content: "Phase 2: Engineering & DevOps + Construction & AEC pages"
      status: pending
    - id: phase-3-operations-partners-index
      content: "Phase 3: Operations + Partner Networks pages + Use Cases index"
      status: pending
isProject: false
---

# Plan 5: Vertical Use Case Pages

**Brand Reference:** All use case pages follow Template C from [docs/brand-style-guide.md](/docs/brand-style-guide.md). Each use case page includes an SVG-style product illustration component relevant to the vertical.

**Priority:** Medium — converts interest into conviction for specific buyer personas

**Depends on:** Plan 2 (shared components from home page)

**Estimated Effort:** Medium (3–4 days)

---

## Use Case Page Template

Every use case page follows the same structure.

### Template Structure

```
1. Hero
   - Title: "{Vertical} agents that [key outcome]"
   - Subtitle: 1–2 sentences connecting AgentC2 to the vertical
   - CTA: "Get Started Free" + "See How It Works"

2. Pain Points (3 columns)
   - Three specific problems this vertical faces with AI adoption
   - Short, punchy, relatable

3. Solution Overview
   - How AgentC2 addresses each pain point
   - 3–4 key capabilities relevant to this vertical

4. Agent Examples
   - 2–3 concrete agent configurations
   - Each with: name, purpose, tools used, channels deployed to, guardrails applied

5. Integration Spotlight
   - Which MCP integrations are most relevant to this vertical
   - Logo grid of relevant tools

6. Architecture Fit
   - How AgentC2's capabilities (governance, channels, learning, federation) apply to this vertical
   - Visual diagram specific to vertical

7. Getting Started
   - 3 steps to deploy agents for this vertical
   - Link to relevant playbooks in the marketplace (if they exist)

8. CTA Banner
   - Vertical-specific CTA
```

---

## Phase 1: Template + Sales & Revenue + Customer Support

### 1.1 Sales & Revenue (`/use-cases/sales`)

**Hero:** "Sales agents that close deals, not just generate text"

**Pain Points:**

1. "CRM data goes stale" — Reps forget to update, pipeline becomes unreliable
2. "Follow-ups fall through the cracks" — Manual tracking means missed opportunities
3. "AI chatbots don't understand your pipeline" — Generic AI has no context on deals, contacts, or history

**Solution:**

- Agents that live inside your CRM (HubSpot, Salesforce, Pipedrive) via MCP
- Automatic pipeline updates, follow-up drafting, and deal progress tracking
- RAG-powered knowledge of your products, pricing, and objection handling
- Deployed to Slack for internal sales team use, email for customer-facing outreach

**Agent Examples:**

1. **Pipeline Manager** — Monitors HubSpot deals, flags stalled opportunities, drafts follow-up emails. Tools: hubspot, gmail, rag-query. Channels: Slack, web. Guardrails: PII blocking on outbound emails, spend cap per run.
2. **Research Agent** — Given a prospect, researches company via Firecrawl + Exa search, summarizes findings, suggests talking points. Tools: firecrawl, exa-search, web-fetch. Channels: Slack, web.
3. **Outreach Coordinator** — Campaign-based outreach using Mission Command. Creates sequences of personalized emails, tracks responses, escalates hot leads. Tools: gmail, hubspot, perplexity-research. Channels: email, Slack.

**Integration Spotlight:** HubSpot, Salesforce, Gmail, Outlook, Slack, Firecrawl, Exa Search, Perplexity

### 1.2 Customer Support (`/use-cases/support`)

**Hero:** "Support agents on every channel, with knowledge that never goes stale"

**Pain Points:**

1. "Customers reach you on channels you can't cover" — WhatsApp, Telegram, web chat, voice — impossible to staff them all
2. "Knowledge bases are outdated" — Static FAQ pages can't keep up with product changes
3. "No governance over AI responses" — AI says something wrong, and there's no guardrail or audit trail

**Solution:**

- Deploy support agents to web, Slack, WhatsApp, Telegram, and voice simultaneously
- RAG pipeline keeps knowledge current: ingest docs, product pages, and support tickets
- Guardrails block PII, prevent hallucination on critical topics, and enforce response quality
- Escalation workflows route complex issues to human agents via human-in-the-loop

**Agent Examples:**

1. **Frontline Support Agent** — Handles tier-1 queries across all channels. Tools: rag-query, web-fetch, support ticket tools. Channels: web, WhatsApp, Telegram, Slack. Guardrails: PII blocking, max cost per run, output quality filters.
2. **Escalation Agent** — Receives escalations from frontline, searches deeper knowledge, and drafts responses for human review. Tools: rag-query, web-search, gmail (draft). Channels: web, Slack. Guardrails: requires human approval before sending.
3. **Knowledge Curator** — Monitors support tickets and product updates, ingests new knowledge into RAG. Tools: rag-ingest, web-scrape, firecrawl. Scheduled: daily cron.

**Integration Spotlight:** Slack, WhatsApp (Baileys), Telegram (grammy), Twilio Voice, Zendesk, Intercom, Gmail, Outlook, Firecrawl

---

## Phase 2: Engineering & DevOps + Construction & AEC

### 2.1 Engineering & DevOps (`/use-cases/engineering`)

**Hero:** "Engineering agents that ship code, not just write it"

**Pain Points:**

1. "Ticket backlogs grow faster than the team" — Too many issues, too few engineers
2. "Code review is a bottleneck" — PRs sit for days waiting for attention
3. "AI coding tools don't understand your codebase" — Copilot suggestions lack project context

**Solution:**

- Dark Factory coding pipeline: ticket → plan → code → verify → merge → deploy
- Risk-gated autonomy (5 levels) — from fully manual to fully autonomous
- Ephemeral build environments for verification (DigitalOcean droplets)
- Cursor Cloud integration for AI-powered implementation
- Trust scoring before merge

**Agent Examples:**

1. **Ticket Triage Agent** — Monitors Jira/GitHub for new issues, classifies severity/complexity, assigns to Dark Factory or flags for human. Tools: jira, github, agent-invoke-dynamic. Channels: Slack, web.
2. **Dark Factory Pipeline** — Receives triaged tickets, plans implementation, launches Cursor agent, provisions build env, verifies, and submits PR. Tools: cursor-launch-agent, provision-compute, remote-execute, github. Autonomy: Level 3 (semi-autonomous).
3. **PR Review Agent** — Reviews incoming PRs for style, security, and correctness. Posts review comments. Tools: github, execute-code. Channels: GitHub, Slack.

**Integration Spotlight:** GitHub, Jira, Linear, Cursor Cloud, DigitalOcean, Slack, Sentry, Vercel

### 2.2 Construction & AEC (`/use-cases/construction`)

**Hero:** "Construction agents that read blueprints, not just spreadsheets"

**Pain Points:**

1. "BIM data is locked in desktop software" — IFC files are inaccessible to most team members
2. "Quantity takeoffs are manual and error-prone" — Hours of work that could be automated
3. "Clash detection happens too late" — Issues found on-site instead of in planning

**Solution:**

- BIM agents that parse IFC models, perform quantity takeoffs, detect clashes, and generate diff reports
- Connected to Appello for field management and job tracking
- RAG knowledge base for project documents, specifications, and standards
- Multi-channel deployment: web for office, WhatsApp/Telegram for field crews

**Agent Examples:**

1. **BIM Query Agent** — Answers questions about building models. "How many doors on level 3?" "What materials are specified for external walls?" Tools: bim-query, rag-query. Channels: web, Slack.
2. **Takeoff Agent** — Generates quantity takeoffs from IFC models by category. Tools: bim-takeoff, calculator. Channels: web.
3. **Clash Detection Agent** — Compares model versions, detects spatial clashes, generates reports. Tools: bim-clash, bim-diff. Channels: web, email.
4. **Field Coordination Agent** — Connects field crews to project data via WhatsApp. Tools: appello, rag-query, bim-query. Channels: WhatsApp, Telegram.

**Integration Spotlight:** Appello, BIM tools (IFC parser), Google Drive, Dropbox, Slack, WhatsApp, Telegram

---

## Phase 3: Operations + Partner Networks + Index

### 3.1 Operations (`/use-cases/operations`)

**Hero:** "Operations agents that execute campaigns, not just answer questions"

**Pain Points:**

1. "Multi-step projects require constant coordination" — Status updates, handoffs, and follow-ups consume manager time
2. "No visibility into AI agent activity" — What are agents doing? Are they on budget? Are they effective?
3. "Manual scheduling and triggering" — Someone has to start every automation manually

**Solution:**

- Campaign/Mission Command for autonomous multi-step execution
- Full observability: runs, traces, tool calls, conversations, activity feed
- Budget enforcement at every level (org → user → agent)
- Cron scheduling, event triggers, and webhook automation
- Continuous learning with After Action Reviews

**Agent Examples:**

1. **Campaign Coordinator** — Executes multi-mission campaigns. Defines intent and end state, decomposes into missions, assigns agents, reviews results. Tools: campaign-create, agent-invoke-dynamic, rag-query. Channels: web, Slack.
2. **Schedule Manager** — Manages recurring agent tasks. Daily pipeline updates, weekly reports, monthly reviews. Tools: schedule tools, trigger tools. Channels: web.
3. **Observability Agent** — Monitors agent performance, alerts on failures, summarizes trends. Tools: live-runs, live-metrics, audit-logs. Channels: Slack, email.

**Integration Spotlight:** Slack, Gmail, Google Calendar, Outlook Calendar, Jira, Asana, Monday, ClickUp

### 3.2 Partner Networks (`/use-cases/partner-networks`)

**Hero:** "AI agents that collaborate across organizational boundaries — securely"

**Pain Points:**

1. "Partner coordination is all email and spreadsheets" — No real-time, intelligent coordination
2. "Sharing AI capabilities means sharing credentials" — Security nightmare
3. "No way to govern cross-org AI interactions" — Who said what? What data was shared?

**Solution:**

- Federation protocol: establish encrypted channels between organizations
- Expose specific agents with fine-grained controls (which agents, what data classification)
- Rate limits and circuit breakers prevent abuse
- PII scanning and redaction by data classification tier
- Full audit trail of cross-org interactions

**Agent Examples:**

1. **Supply Chain Coordinator** — Federated agent that coordinates with supplier agents. Shares order status, delivery timelines, and exception alerts without exposing internal systems. Federation: restricted data classification, PII redaction enabled.
2. **Consulting Deliverable Agent** — Consultant's agent shares research and recommendations with client's agents. Federation: confidential classification, human approval required.
3. **Agency Campaign Agent** — Marketing agency deploys agents into client workspaces via embed system. Embed: custom branding, domain-restricted, feature preset: chat-plus.

**Integration Spotlight:** Federation protocol, embed system, Slack, Gmail, Google Drive, Dropbox

### 3.3 Use Cases Index (`/use-cases`)

**Content:**

- Hero: "AI agents for every department"
- Grid of use case cards (one per vertical) with:
    - Icon
    - Title
    - One-line description
    - Key integrations (logos)
    - Link to full page

---

## Verification Checklist

- [ ] Use case template renders consistently across all 6 pages
- [ ] Agent examples are realistic and reference actual tools from the registry
- [ ] Integration spotlights reference actual MCP integrations
- [ ] Pain points are specific and relatable (not generic AI hype)
- [ ] Each page has unique meta tags
- [ ] Index page links to all use case pages
- [ ] Home page use case tabs link to these pages
- [ ] Pages are responsive
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
