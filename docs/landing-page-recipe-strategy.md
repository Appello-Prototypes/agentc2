# AgentC2 Landing Page Recipe Strategy

## Strategic Overview

The landing page should function as a **recipe discovery engine** — visitors identify themselves by the tools they already use and the role they play, and the page surfaces pre-built agentic recipes that deliver immediate value. Each recipe is an entry point to the platform, reducing time-to-value and communicating specific, measurable outcomes aligned with buyer pain points.

---

## 1. Platform Integration Inventory (Categorized)

### Communication

| Platform         | Type         | Capabilities                                                                     |
| ---------------- | ------------ | -------------------------------------------------------------------------------- |
| **Gmail**        | Native OAuth | Search, read, send, draft, archive emails; webhook triggers on new mail          |
| **Outlook Mail** | Native OAuth | List, get, send, archive emails; webhook triggers on new mail                    |
| **Slack**        | MCP + Native | Channels, messages, users, search; two-way bot conversations; per-agent identity |
| **JustCall**     | MCP          | Call logs, SMS messaging, phone integration                                      |
| **Twilio**       | MCP          | Outbound voice calls, ElevenLabs streaming                                       |

### Calendar

| Platform             | Type         | Capabilities                                   |
| -------------------- | ------------ | ---------------------------------------------- |
| **Google Calendar**  | Native OAuth | CRUD events, search, scheduling                |
| **Outlook Calendar** | Native OAuth | CRUD events, webhook triggers on create/update |

### CRM & Sales

| Platform       | Type | Capabilities                                    |
| -------------- | ---- | ----------------------------------------------- |
| **HubSpot**    | MCP  | Contacts, companies, deals, pipeline management |
| **Salesforce** | MCP  | Contacts, accounts, opportunities, reports      |

### Project Management

| Platform       | Type | Capabilities                               |
| -------------- | ---- | ------------------------------------------ |
| **Jira**       | MCP  | Issues, sprints, project tracking          |
| **Linear**     | MCP  | Issues, projects, teams, sprints           |
| **Asana**      | MCP  | Tasks, projects, portfolios, reporting     |
| **Monday.com** | MCP  | Boards, items, CRM activities, automations |
| **Notion**     | MCP  | Workspace wiki, databases, pages, search   |

### File Storage & Knowledge

| Platform         | Type         | Capabilities                                               |
| ---------------- | ------------ | ---------------------------------------------------------- |
| **Google Drive** | Native OAuth | File search, read, create docs/sheets/slides               |
| **Dropbox**      | Native OAuth | List, read, upload, search, sharing links                  |
| **Confluence**   | MCP          | Team wiki, documentation, pages, spaces                    |
| **Fathom**       | MCP          | Meeting recordings, transcripts, summaries                 |
| **YouTube**      | Built-in     | Transcript extraction, video analysis, knowledge ingestion |

### Developer Tools

| Platform       | Type | Capabilities                                    |
| -------------- | ---- | ----------------------------------------------- |
| **GitHub**     | MCP  | Repos, issues, PRs, code, actions               |
| **Sentry**     | MCP  | Error monitoring, issues, events, releases      |
| **Vercel**     | MCP  | Deployments, projects, domains, team management |
| **Supabase**   | MCP  | Database management, queries, migrations        |
| **Cloudflare** | MCP  | DNS, Workers, KV, R2 storage, security          |
| **Neon**       | MCP  | Serverless Postgres, branches, queries          |

### E-commerce & Payments

| Platform    | Type | Capabilities                                 |
| ----------- | ---- | -------------------------------------------- |
| **Stripe**  | MCP  | Customers, subscriptions, invoices, checkout |
| **Shopify** | MCP  | Orders, products, customers, inventory       |

### Design & Web

| Platform    | Type | Capabilities                             |
| ----------- | ---- | ---------------------------------------- |
| **Figma**   | MCP  | Files, components, styles, design tokens |
| **Webflow** | MCP  | Sites, collections, items, forms, CMS    |

### Automation & Data

| Platform        | Type | Capabilities                                |
| --------------- | ---- | ------------------------------------------- |
| **Zapier**      | MCP  | Connect 8000+ apps, trigger workflows       |
| **n8n / ATLAS** | MCP  | Workflow automation, custom triggers        |
| **Airtable**    | MCP  | Flexible databases, tables, records, search |

### Customer Support

| Platform     | Type | Capabilities                                |
| ------------ | ---- | ------------------------------------------- |
| **Intercom** | MCP  | Conversations, contacts, help center search |

### Web Intelligence

| Platform       | Type | Capabilities                                 |
| -------------- | ---- | -------------------------------------------- |
| **Firecrawl**  | MCP  | Web scraping, content extraction             |
| **Playwright** | MCP  | Browser automation, screenshots, interaction |

### Voice & Real-time

| Platform         | Type   | Capabilities                                              |
| ---------------- | ------ | --------------------------------------------------------- |
| **ElevenLabs**   | Native | Text-to-speech, voice cloning, live conversational agents |
| **OpenAI Voice** | Native | TTS (alloy, echo, etc.), STT (Whisper)                    |

### Core Platform Capabilities

| Capability               | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| **Multi-Agent Networks** | LLM-orchestrated routing across specialized agents       |
| **Workflows**            | Sequential, parallel, branching, looping, human-approval |
| **Skills System**        | Composable knowledge + procedures + tools bundles        |
| **RAG / Knowledge Base** | Document ingestion, chunking, vector search              |
| **Canvas Dashboards**    | Natural-language-generated interactive dashboards        |
| **Memory**               | Working memory, semantic recall, message history         |
| **Campaigns**            | Military-style mission planning and execution            |
| **Continuous Learning**  | A/B experiments, proposal generation, auto-improvement   |
| **Observability**        | Run traces, audit logs, cost tracking, analytics         |
| **Guardrails**           | Content filtering, budget controls, safety policies      |

---

## 2. ICP Segmentation

### By Business Size

| Segment            | Size     | Decision Maker | Budget     | Primary Need                              |
| ------------------ | -------- | -------------- | ---------- | ----------------------------------------- |
| **Solopreneur**    | 1 person | Self           | $0-49/mo   | Time savings, wearing fewer hats          |
| **Small Business** | 2-20     | Founder/GM     | $29-149/mo | Affordable automation, easy setup         |
| **Mid-Market**     | 20-200   | VP/Director    | $29/user + | Cross-dept coordination, data unification |
| **Enterprise**     | 200+     | CTO/COO        | Custom     | Governance, compliance, scale, SSO        |

### By Role/Function (Primary ICP Personas)

| Persona                   | Title Examples                          | Core Pain Points                                                                | Buying Trigger                                                     |
| ------------------------- | --------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Revenue Leader**        | VP Sales, CRO, Head of Sales            | Manual CRM entry, missed follow-ups, no pipeline visibility, meeting notes lost | "My team spends 40% of time on data entry, not selling"            |
| **Marketing Leader**      | CMO, Head of Marketing, Content Lead    | Content bottleneck, campaign coordination chaos, analytics manual               | "We can't produce content fast enough to feed our channels"        |
| **Support Leader**        | VP Support, Head of CS, Support Manager | Response time SLAs, ticket volume, knowledge scattered, escalation chaos        | "Our CSAT is dropping because we can't scale"                      |
| **Engineering Leader**    | CTO, VP Eng, Engineering Manager        | Bug triage manual, PR review bottleneck, deployment blindspots                  | "We're losing velocity to operational overhead"                    |
| **Operations Leader**     | COO, Head of Ops, Chief of Staff        | Cross-tool data silos, manual reporting, meeting action items lost              | "I need a single source of truth across 15 tools"                  |
| **Executive**             | CEO, Founder, C-suite                   | Information overload, decision latency, no unified view                         | "I want to know what matters without digging through 6 dashboards" |
| **Freelancer/Consultant** | Independent, Solo founder               | Client management manual, research time, no team to delegate                    | "I need to operate like a team of 10"                              |
| **Product Leader**        | VP Product, PM, Head of Product         | Design handoff friction, roadmap visibility, user feedback scattered            | "Specs get lost between Figma and the backlog"                     |

---

## 3. Recipe Matrix

### How to Read This Matrix

Each recipe represents a **pre-built agentic system** that combines specific platforms to solve a concrete pain point. Recipes are entry points — a visitor identifies their tools + role and immediately sees the value AgentC2 delivers.

---

### SALES RECIPES

#### S1: Deal Copilot

| Attribute           | Detail                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | HubSpot + Gmail + Google Calendar + Slack                                                                                                                           |
| **ICP**             | Sales reps, Account Executives                                                                                                                                      |
| **Business Size**   | Small → Enterprise                                                                                                                                                  |
| **Pain Point**      | Reps spend 40% of time on CRM data entry instead of selling                                                                                                         |
| **What It Does**    | Auto-enriches CRM contacts from email signatures, drafts contextual follow-up emails after meetings, books meetings from email threads, posts deal updates to Slack |
| **Value Metric**    | "Save 8+ hours/week per rep on admin work"                                                                                                                          |
| **Landing Message** | _"Stop entering data. Start closing deals."_                                                                                                                        |
| **Recipe Steps**    | Email received → Extract contact info → Update HubSpot → Draft follow-up → Schedule next meeting → Notify team                                                      |

#### S2: Pipeline Intelligence

| Attribute           | Detail                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | HubSpot/Salesforce + Fathom + Slack + Google Drive                                                                                                                              |
| **ICP**             | Sales Managers, Revenue Leaders, CROs                                                                                                                                           |
| **Business Size**   | Mid-Market → Enterprise                                                                                                                                                         |
| **Pain Point**      | No visibility into deal health; meeting insights never make it to CRM                                                                                                           |
| **What It Does**    | Captures meeting transcripts from Fathom, extracts deal signals (objections, next steps, buying intent), updates CRM, alerts on at-risk deals, generates weekly pipeline report |
| **Value Metric**    | "Increase pipeline visibility by 10x"                                                                                                                                           |
| **Landing Message** | _"Every meeting becomes a deal signal."_                                                                                                                                        |
| **Recipe Steps**    | Meeting ends → Fathom transcript → Extract signals → Update deal stage → Risk assessment → Slack alert → Weekly report to Drive                                                 |

#### S3: Outbound Researcher

| Attribute           | Detail                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | HubSpot + Firecrawl + Gmail + Google Drive                                                                                            |
| **ICP**             | SDRs, BDRs, Outbound Sales                                                                                                            |
| **Business Size**   | Small → Mid-Market                                                                                                                    |
| **Pain Point**      | Generic outreach, hours spent on prospect research                                                                                    |
| **What It Does**    | Scrapes prospect websites and news, enriches CRM records, generates personalized outreach emails, tracks engagement                   |
| **Value Metric**    | "Research 100 prospects in the time it takes to research 1"                                                                           |
| **Landing Message** | _"Personalized outreach at scale."_                                                                                                   |
| **Recipe Steps**    | CRM contact list → Firecrawl prospect site → Extract key info → Personalize email template → Draft in Gmail → Log activity in HubSpot |

---

### MARKETING RECIPES

#### M1: Content Engine

| Attribute           | Detail                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Firecrawl + Google Drive + Slack + Gmail                                                                                                                          |
| **ICP**             | Content Marketers, Marketing Managers                                                                                                                             |
| **Business Size**   | Small → Mid-Market                                                                                                                                                |
| **Pain Point**      | Content production bottleneck; can't keep up with channel demand                                                                                                  |
| **What It Does**    | Researches topics via web scraping, generates draft content (blog posts, social, newsletters), stores in Drive, notifies team for review, distributes on approval |
| **Value Metric**    | "10x your content output without 10x your team"                                                                                                                   |
| **Landing Message** | _"From research to published in one workflow."_                                                                                                                   |
| **Recipe Steps**    | Topic brief → Web research → Draft generation → Save to Drive → Slack review notification → Human approval → Distribution                                         |

#### M2: Campaign Commander

| Attribute           | Detail                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | HubSpot + Slack + Gmail + Google Calendar + Airtable                                                                                                            |
| **ICP**             | Marketing Managers, Campaign Leads                                                                                                                              |
| **Business Size**   | Mid-Market → Enterprise                                                                                                                                         |
| **Pain Point**      | Campaign coordination across tools is manual chaos                                                                                                              |
| **What It Does**    | Decomposes campaign into missions and tasks (military-style planning), assigns to team members, tracks progress, sends reminders, generates after-action review |
| **Value Metric**    | "Cut campaign coordination time by 70%"                                                                                                                         |
| **Landing Message** | _"Orchestrate campaigns, not spreadsheets."_                                                                                                                    |
| **Recipe Steps**    | Campaign brief → Mission decomposition → Task assignment → Calendar scheduling → Progress tracking → Slack updates → AAR generation                             |

#### M3: Competitive Intel Agent

| Attribute           | Detail                                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Firecrawl + Google Drive + Slack + RAG                                                                                                          |
| **ICP**             | Product Marketing, Strategy                                                                                                                     |
| **Business Size**   | Mid-Market → Enterprise                                                                                                                         |
| **Pain Point**      | Competitive landscape changes faster than manual tracking                                                                                       |
| **What It Does**    | Monitors competitor websites/blogs/pricing, extracts changes, builds knowledge base, alerts on significant shifts, generates comparison reports |
| **Value Metric**    | "Know what competitors shipped before their press release"                                                                                      |
| **Landing Message** | _"Competitive intelligence on autopilot."_                                                                                                      |
| **Recipe Steps**    | Scheduled scrape → Diff detection → RAG ingestion → Alert generation → Slack notification → Weekly competitive report                           |

---

### CUSTOMER SUPPORT RECIPES

#### CS1: Ticket Triager

| Attribute           | Detail                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Intercom + Slack + Jira + RAG                                                                                                                                       |
| **ICP**             | Support Managers, CS Leaders                                                                                                                                        |
| **Business Size**   | Mid-Market → Enterprise                                                                                                                                             |
| **Pain Point**      | Manual triage wastes time; customers wait; wrong team gets tickets                                                                                                  |
| **What It Does**    | Auto-classifies incoming tickets by priority/category, routes to correct team, suggests solutions from knowledge base, creates Jira ticket for bugs, notifies Slack |
| **Value Metric**    | "Reduce first-response time by 80%"                                                                                                                                 |
| **Landing Message** | _"Triage 1,000 tickets like you have 10 agents."_                                                                                                                   |
| **Recipe Steps**    | Ticket arrives → Classify priority/category → Search knowledge base → Suggest resolution → Route to team → Create Jira if bug → Slack notification                  |

#### CS2: Knowledge Concierge

| Attribute           | Detail                                                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Intercom + Google Drive + Confluence + RAG                                                                                                           |
| **ICP**             | Support Teams, CS Reps                                                                                                                               |
| **Business Size**   | Small → Enterprise                                                                                                                                   |
| **Pain Point**      | Repetitive questions; knowledge scattered across docs, wikis, and tribal knowledge                                                                   |
| **What It Does**    | Answers customer questions using ingested internal docs, surfaces relevant articles, escalates when confidence is low, learns from agent corrections |
| **Value Metric**    | "Deflect 60% of Tier 1 tickets automatically"                                                                                                        |
| **Landing Message** | _"Your entire knowledge base, one question away."_                                                                                                   |
| **Recipe Steps**    | Customer question → RAG search → Confidence check → Auto-respond or escalate → Log interaction → Feed learning loop                                  |

#### CS3: Customer Health Monitor

| Attribute           | Detail                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Platforms**       | HubSpot/Salesforce + Intercom + Slack + Stripe                                                                                                         |
| **ICP**             | Customer Success Managers, CS Leaders                                                                                                                  |
| **Business Size**   | Mid-Market → Enterprise                                                                                                                                |
| **Pain Point**      | Churn happens silently; no early warning system                                                                                                        |
| **What It Does**    | Monitors support ticket volume, payment failures, usage patterns, sentiment in conversations; generates health scores; alerts CSMs on at-risk accounts |
| **Value Metric**    | "Catch churn signals 30 days before cancellation"                                                                                                      |
| **Landing Message** | _"See churn coming before your customers leave."_                                                                                                      |
| **Recipe Steps**    | Daily scan → Aggregate signals (tickets, payments, sentiment) → Score health → Flag at-risk → Slack alert to CSM → Suggested actions                   |

---

### ENGINEERING RECIPES

#### E1: Bug Bouncer

| Attribute           | Detail                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | GitHub + Sentry + Jira/Linear + Slack                                                                                                                                           |
| **ICP**             | Engineering Teams, DevOps                                                                                                                                                       |
| **Business Size**   | Small → Enterprise                                                                                                                                                              |
| **Pain Point**      | Errors pile up; manual triage delays fixes; context switching kills focus                                                                                                       |
| **What It Does**    | Monitors Sentry for new errors, deduplicates, creates Jira/Linear tickets with stack traces and reproduction steps, notifies owning team in Slack, suggests fixes from codebase |
| **Value Metric**    | "From error to ticket in 30 seconds, not 30 minutes"                                                                                                                            |
| **Landing Message** | _"Bugs get tickets before your coffee gets cold."_                                                                                                                              |
| **Recipe Steps**    | Error detected → Deduplicate → Analyze stack trace → Create ticket with context → Assign to team → Slack notification → Suggest fix                                             |

#### E2: Release Radar

| Attribute           | Detail                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | GitHub + Vercel + Sentry + Slack                                                                                                                                  |
| **ICP**             | DevOps, Engineering Leads                                                                                                                                         |
| **Business Size**   | Mid-Market → Enterprise                                                                                                                                           |
| **Pain Point**      | Deployment blindspots; can't tell if release is healthy until users complain                                                                                      |
| **What It Does**    | Monitors deployments, tracks error rates post-deploy, compares to baseline, auto-generates release notes, alerts on regressions, provides rollback recommendation |
| **Value Metric**    | "Know release health in 5 minutes, not 5 hours"                                                                                                                   |
| **Landing Message** | _"Ship with confidence. Detect regressions in minutes."_                                                                                                          |
| **Recipe Steps**    | Deploy detected → Monitor error rates → Compare to baseline → Generate release notes → Health check → Alert if regression → Rollback recommendation               |

#### E3: Sprint Copilot

| Attribute           | Detail                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Jira/Linear + GitHub + Slack + Confluence                                                                                                                       |
| **ICP**             | Engineering Managers, Scrum Masters                                                                                                                             |
| **Business Size**   | Mid-Market → Enterprise                                                                                                                                         |
| **Pain Point**      | Sprint planning is manual; standup updates are tedious; retrospectives lack data                                                                                |
| **What It Does**    | Generates sprint reports from Jira/Linear data, summarizes PR activity from GitHub, runs async standups via Slack, generates data-driven retrospective insights |
| **Value Metric**    | "Automate 5 hours/week of sprint ceremonies"                                                                                                                    |
| **Landing Message** | _"Sprints that run themselves."_                                                                                                                                |
| **Recipe Steps**    | Sprint start → Daily PR summary → Async standup collection → Velocity tracking → Sprint report → Retro insights generation                                      |

---

### OPERATIONS RECIPES

#### O1: Meeting Memory

| Attribute           | Detail                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Fathom + Slack + Google Calendar + Google Drive + Jira                                                                                                                 |
| **ICP**             | Project Managers, Operations Leads, Chiefs of Staff                                                                                                                    |
| **Business Size**   | Small → Enterprise                                                                                                                                                     |
| **Pain Point**      | Action items from meetings get lost; no follow-through on decisions                                                                                                    |
| **What It Does**    | Captures meeting transcripts, extracts action items and decisions, creates Jira tickets, shares summary to Slack channel, stores in Drive, follows up on overdue items |
| **Value Metric**    | "100% of meeting action items tracked and completed"                                                                                                                   |
| **Landing Message** | _"Every meeting produces results, not just minutes."_                                                                                                                  |
| **Recipe Steps**    | Meeting ends → Fathom transcript → Extract action items → Create Jira tasks → Slack summary → Drive archive → Follow-up reminders                                      |

#### O2: Inbox Zero Agent

| Attribute           | Detail                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Platforms**       | Gmail/Outlook + Google Calendar + Slack + HubSpot                                                                                                                        |
| **ICP**             | Executives, Busy Professionals                                                                                                                                           |
| **Business Size**   | Solopreneur → Enterprise                                                                                                                                                 |
| **Pain Point**      | Email overload; important messages buried; constant context switching                                                                                                    |
| **What It Does**    | Triages email by priority/category, drafts responses for review, schedules meetings from email threads, updates CRM with customer interactions, archives processed email |
| **Value Metric**    | "Process 100 emails in 10 minutes, not 2 hours"                                                                                                                          |
| **Landing Message** | _"Your inbox works for you, not against you."_                                                                                                                           |
| **Recipe Steps**    | Email arrives → Classify priority → Draft response → Queue for review → Schedule meeting if needed → Update CRM → Archive                                                |

#### O3: Cross-Tool Sync

| Attribute           | Detail                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | HubSpot + Jira + Slack + Google Drive + Airtable                                                                                        |
| **ICP**             | Operations Teams, System Admins                                                                                                         |
| **Business Size**   | Mid-Market → Enterprise                                                                                                                 |
| **Pain Point**      | Data silos; teams work in different tools; manual reconciliation                                                                        |
| **What It Does**    | Keeps data synchronized across tools, detects conflicts, surfaces inconsistencies, generates unified dashboards via Canvas              |
| **Value Metric**    | "Eliminate 20+ hours/week of manual data reconciliation"                                                                                |
| **Landing Message** | _"One source of truth across every tool."_                                                                                              |
| **Recipe Steps**    | Change detected in any tool → Sync to connected tools → Conflict detection → Resolution → Unified dashboard update → Weekly sync report |

---

### EXECUTIVE RECIPES

#### X1: Daily Briefing

| Attribute           | Detail                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Gmail + Google Calendar + Slack + HubSpot + Fathom + Jira + Stripe                                                                                              |
| **ICP**             | CEO, C-suite, Founders                                                                                                                                          |
| **Business Size**   | Small → Enterprise                                                                                                                                              |
| **Pain Point**      | Information overload; no unified view; decisions delayed by data gathering                                                                                      |
| **What It Does**    | Generates morning briefing with: key metrics (revenue, pipeline, tickets), today's meetings with context, priority emails, blocker alerts, yesterday's outcomes |
| **Value Metric**    | "Your entire business in a 2-minute morning briefing"                                                                                                           |
| **Landing Message** | _"Start every day knowing exactly what matters."_                                                                                                               |
| **Recipe Steps**    | 7am trigger → Aggregate metrics → Summarize calendar → Triage inbox → Extract blockers → Generate briefing → Deliver via Slack/Email                            |

#### X2: Board Deck Builder

| Attribute           | Detail                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | HubSpot + Stripe + Google Drive + Airtable + Canvas                                                                                                       |
| **ICP**             | CFO, CEO, Finance Teams                                                                                                                                   |
| **Business Size**   | Mid-Market → Enterprise                                                                                                                                   |
| **Pain Point**      | Board reports take days to compile from scattered sources                                                                                                 |
| **What It Does**    | Pulls live data from CRM (pipeline, wins), payments (revenue, MRR, churn), project tracking (milestones, velocity), generates formatted deck with charts  |
| **Value Metric**    | "Board-ready reports from live data in 5 minutes"                                                                                                         |
| **Landing Message** | _"Board decks that write themselves."_                                                                                                                    |
| **Recipe Steps**    | Trigger (monthly/on-demand) → Pull CRM metrics → Pull revenue data → Pull project status → Generate Canvas dashboard → Export to Drive → Share with board |

---

### FREELANCER & SOLOPRENEUR RECIPES

#### F1: Client Manager

| Attribute           | Detail                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Gmail + Google Calendar + Google Drive + Stripe                                                                                    |
| **ICP**             | Freelancers, Consultants, Solo Founders                                                                                            |
| **Business Size**   | Solopreneur                                                                                                                        |
| **Pain Point**      | Client communication scattered; missed follow-ups; manual invoicing                                                                |
| **What It Does**    | Tracks client conversations across email, auto-schedules follow-ups, organizes project documents, tracks payments, sends reminders |
| **Value Metric**    | "Manage 20 clients like you have a dedicated EA"                                                                                   |
| **Landing Message** | _"Run your business like a team of 10."_                                                                                           |
| **Recipe Steps**    | Client email → Classify project → Update client timeline → Schedule follow-up → Track deliverables → Payment reminder → Archive    |

#### F2: Research Assistant

| Attribute           | Detail                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Firecrawl + YouTube + Google Drive + RAG                                                                                                                                  |
| **ICP**             | Researchers, Analysts, Consultants, Students                                                                                                                              |
| **Business Size**   | Solopreneur → Small                                                                                                                                                       |
| **Pain Point**      | Research is time-consuming; findings get lost; no institutional memory                                                                                                    |
| **What It Does**    | Deep-researches any topic via web scraping and YouTube analysis, builds searchable knowledge base, generates research briefs, connects new findings to existing knowledge |
| **Value Metric**    | "Research that compounds instead of evaporating"                                                                                                                          |
| **Landing Message** | _"Build a second brain that actually works."_                                                                                                                             |
| **Recipe Steps**    | Research query → Web scrape → YouTube transcript analysis → Synthesize findings → Ingest to RAG → Generate brief → Save to Drive                                          |

---

### E-COMMERCE RECIPES

#### EC1: Order Intelligence

| Attribute           | Detail                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Shopify + Intercom + Slack + Gmail                                                                                                                                |
| **ICP**             | E-commerce Founders, Operations                                                                                                                                   |
| **Business Size**   | Small → Mid-Market                                                                                                                                                |
| **Pain Point**      | Customer service volume scales with orders; manual order lookups                                                                                                  |
| **What It Does**    | Handles common order inquiries (tracking, returns, exchanges) via Intercom, escalates complex issues, monitors order anomalies, alerts team on fulfillment delays |
| **Value Metric**    | "Handle 80% of order inquiries without human intervention"                                                                                                        |
| **Landing Message** | _"Scale support without scaling headcount."_                                                                                                                      |
| **Recipe Steps**    | Customer inquiry → Order lookup → Auto-respond (tracking/returns) → Escalate if complex → Monitor fulfillment → Alert on delays                                   |

#### EC2: Revenue Pulse

| Attribute           | Detail                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Stripe + Shopify + Slack + Google Drive + Canvas                                                                                                                    |
| **ICP**             | E-commerce Founders, Finance                                                                                                                                        |
| **Business Size**   | Small → Mid-Market                                                                                                                                                  |
| **Pain Point**      | Revenue blindspots; manual reporting; late anomaly detection                                                                                                        |
| **What It Does**    | Real-time revenue tracking, daily MRR/ARR calculations, anomaly detection (sudden drops, unusual refunds), generates Canvas dashboards, delivers daily Slack digest |
| **Value Metric**    | "Know your revenue story before you look at Stripe"                                                                                                                 |
| **Landing Message** | _"Revenue intelligence, not just revenue reports."_                                                                                                                 |
| **Recipe Steps**    | Hourly data pull → Calculate metrics → Anomaly detection → Canvas dashboard update → Daily Slack digest → Weekly Drive report                                       |

---

### VOICE-POWERED RECIPES

#### V1: Voice Receptionist

| Attribute           | Detail                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | ElevenLabs Voice + Google Calendar + HubSpot + Slack                                                                                           |
| **ICP**             | Professional Services, Medical Offices, Real Estate, Legal                                                                                     |
| **Business Size**   | Small → Mid-Market                                                                                                                             |
| **Pain Point**      | Missed calls = missed revenue; receptionists are expensive; after-hours gaps                                                                   |
| **What It Does**    | Answers inbound calls with natural voice, captures caller intent, schedules appointments, updates CRM, transfers urgent calls, notifies team   |
| **Value Metric**    | "Never miss a call. Never lose a lead. 24/7."                                                                                                  |
| **Landing Message** | _"An AI receptionist that sounds like your best employee."_                                                                                    |
| **Recipe Steps**    | Call received → Identify intent → Schedule appointment (Calendar) → Create/update contact (HubSpot) → Notify team (Slack) → Transfer if urgent |

#### V2: Voice Survey Agent

| Attribute           | Detail                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Platforms**       | ElevenLabs Voice + Airtable + Slack + Gmail                                                                                                |
| **ICP**             | Market Research, Customer Success                                                                                                          |
| **Business Size**   | Mid-Market → Enterprise                                                                                                                    |
| **Pain Point**      | Low survey response rates; text surveys feel impersonal; manual analysis                                                                   |
| **What It Does**    | Conducts voice surveys with natural conversation, captures structured responses in Airtable, analyzes sentiment, generates summary reports |
| **Value Metric**    | "3x higher response rates than email surveys"                                                                                              |
| **Landing Message** | _"Surveys that feel like conversations."_                                                                                                  |
| **Recipe Steps**    | Outbound call → Conversational survey → Capture responses → Store in Airtable → Sentiment analysis → Summary report → Slack notification   |

---

### PRODUCT & DESIGN RECIPES

#### P1: Design-to-Dev Pipeline

| Attribute           | Detail                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Platforms**       | Figma + Jira/Linear + Slack + GitHub                                                                                                                   |
| **ICP**             | Design Teams, Product Teams, Design Ops                                                                                                                |
| **Business Size**   | Mid-Market → Enterprise                                                                                                                                |
| **Pain Point**      | Design handoff friction; specs get lost; devs ask the same questions                                                                                   |
| **What It Does**    | Monitors Figma files for updates, extracts component specs and design tokens, creates/updates dev tickets with visual diffs, notifies engineering team |
| **Value Metric**    | "Eliminate design handoff as a bottleneck"                                                                                                             |
| **Landing Message** | _"From Figma to finished, without the friction."_                                                                                                      |
| **Recipe Steps**    | Figma update detected → Extract specs → Create/update Linear ticket → Attach visual diff → Slack notification → Track implementation status            |

#### P2: User Feedback Synthesizer

| Attribute           | Detail                                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Intercom + Slack + Notion + Jira/Linear + RAG                                                                                                            |
| **ICP**             | Product Managers, UX Researchers                                                                                                                         |
| **Business Size**   | Mid-Market → Enterprise                                                                                                                                  |
| **Pain Point**      | User feedback scattered across channels; themes hard to identify                                                                                         |
| **What It Does**    | Aggregates feedback from support tickets, categorizes themes, links to existing feature requests, generates weekly insight reports, creates user stories |
| **Value Metric**    | "Turn 1,000 support tickets into 10 actionable insights"                                                                                                 |
| **Landing Message** | _"Let your users tell you what to build next."_                                                                                                          |
| **Recipe Steps**    | Feedback collected → Categorize theme → Match to existing requests → Update Notion roadmap → Create Linear story → Weekly insight report                 |

---

### HR & PEOPLE RECIPES

#### HR1: Onboarding Copilot

| Attribute           | Detail                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Slack + Google Drive + Notion/Confluence + Google Calendar                                                                                                                            |
| **ICP**             | HR Teams, People Ops, Hiring Managers                                                                                                                                                 |
| **Business Size**   | Mid-Market → Enterprise                                                                                                                                                               |
| **Pain Point**      | Manual onboarding; inconsistent experience; new hires feel lost                                                                                                                       |
| **What It Does**    | Guides new hires through structured onboarding via Slack DMs, shares relevant docs, schedules 1:1s with team members, answers common questions from knowledge base, tracks completion |
| **Value Metric**    | "Every hire gets the perfect first 30 days"                                                                                                                                           |
| **Landing Message** | _"Onboarding that never forgets a step."_                                                                                                                                             |
| **Recipe Steps**    | New hire trigger → Welcome DM → Day 1 checklist → Schedule meetings → Share docs → Daily check-ins → Track progress → Manager updates                                                 |

---

### AUTOMATION & NO-CODE RECIPES

#### A1: Webhook Wizard

| Attribute           | Detail                                                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Zapier/n8n + Slack + Any Tool                                                                                                                                        |
| **ICP**             | Ops Teams, No-Code Builders                                                                                                                                          |
| **Business Size**   | Small → Mid-Market                                                                                                                                                   |
| **Pain Point**      | Complex automation setup; brittle integrations; engineering bottleneck for ops requests                                                                              |
| **What It Does**    | Conversational webhook setup — describe what you want in plain English, agent creates webhook endpoint, configures routing, tests connection, provides documentation |
| **Value Metric**    | "Automate anything in 30 seconds via conversation"                                                                                                                   |
| **Landing Message** | _"Tell us what to automate. We'll handle the rest."_                                                                                                                 |
| **Recipe Steps**    | Describe automation need → Agent suggests approach → Generate webhook → Configure routing → Test → Documentation → Monitor                                           |

#### A2: Data Pipeline

| Attribute           | Detail                                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Airtable + Google Drive + Firecrawl + RAG + Canvas                                                                                                             |
| **ICP**             | Data Teams, Analysts                                                                                                                                           |
| **Business Size**   | Mid-Market → Enterprise                                                                                                                                        |
| **Pain Point**      | Manual data collection; ETL complexity; analysts become data janitors                                                                                          |
| **What It Does**    | Ingests data from multiple sources (web, files, databases), processes and enriches, stores in knowledge base, generates Canvas dashboards, alerts on anomalies |
| **Value Metric**    | "From raw data to actionable insights, autonomously"                                                                                                           |
| **Landing Message** | _"Data pipelines that build themselves."_                                                                                                                      |
| **Recipe Steps**    | Schedule/trigger → Collect data → Transform → Enrich → Ingest to RAG → Canvas dashboard → Anomaly alerts → Weekly digest                                       |

---

## 4. Platform Combination Value Matrix

This matrix shows which platform combinations unlock the most value, and for whom.

### High-Value Platform Pairs

| Platform A    | Platform B         | Value Unlocked                     | Best ICP              |
| ------------- | ------------------ | ---------------------------------- | --------------------- |
| Gmail/Outlook | HubSpot/Salesforce | Auto CRM updates from email        | Sales                 |
| Gmail/Outlook | Google Calendar    | Meeting scheduling from email      | Everyone              |
| HubSpot       | Fathom             | Meeting → CRM pipeline updates     | Sales Leaders         |
| Slack         | Any Tool           | Real-time notifications + commands | Everyone              |
| Jira/Linear   | GitHub             | Bug-to-ticket, PR tracking         | Engineering           |
| Sentry        | GitHub             | Error-to-ticket automation         | Engineering           |
| Intercom      | RAG                | Auto-answer from knowledge base    | Support               |
| Stripe        | Shopify            | Unified revenue intelligence       | E-commerce            |
| Firecrawl     | RAG                | Web → Knowledge base pipeline      | Research/Marketing    |
| Figma         | Jira/Linear        | Design → Dev handoff               | Product/Design        |
| Fathom        | Jira               | Meeting → Action items             | Operations            |
| Voice         | Calendar           | Appointment scheduling via phone   | Professional Services |

### Power Trios (Highest Value Combinations)

| Combo              | Platforms                   | Recipe                        | ICP            |
| ------------------ | --------------------------- | ----------------------------- | -------------- |
| **Revenue Stack**  | HubSpot + Gmail + Fathom    | Deal Copilot + Pipeline Intel | Sales          |
| **Support Stack**  | Intercom + Jira + RAG       | Ticket Triager + Knowledge    | Support        |
| **Dev Stack**      | GitHub + Sentry + Jira      | Bug Bouncer + Release Radar   | Engineering    |
| **Ops Stack**      | Slack + Fathom + Jira       | Meeting Memory + Cross-Sync   | Operations     |
| **Content Stack**  | Firecrawl + Drive + Slack   | Content Engine + Research     | Marketing      |
| **Commerce Stack** | Shopify + Stripe + Intercom | Order Intel + Revenue Pulse   | E-commerce     |
| **Voice Stack**    | ElevenLabs + Calendar + CRM | Voice Receptionist            | Prof. Services |

---

## 5. Landing Page Architecture

### Page Flow: Recipe Discovery Engine

```
┌─────────────────────────────────────────────────┐
│ HERO                                            │
│ "What if your tools worked together —            │
│  autonomously?"                                  │
│                                                  │
│ [Select your tools]  [Select your role]          │
│ → Personalized recipe recommendations            │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│ INTEGRATION BAR (scrolling logos)                │
│ "Connects to 30+ platforms you already use"      │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│ RECIPE GALLERY (filterable)                      │
│                                                  │
│ Filter by: [Department ▼] [Platform ▼] [Size ▼] │
│                                                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │ Deal     │ │ Ticket   │ │ Bug      │         │
│ │ Copilot  │ │ Triager  │ │ Bouncer  │         │
│ │ 🔗 HubS  │ │ 🔗 Inter │ │ 🔗 GH+S  │         │
│ │ +Gmail   │ │ +Jira+RAG│ │ +Jira    │         │
│ │ +Cal+Slk │ │          │ │ +Slack   │         │
│ │          │ │ "80% ↓   │ │ "Error→  │         │
│ │ "8hrs/wk │ │  response│ │  ticket  │         │
│ │  saved"  │ │  time"   │ │  in 30s" │         │
│ │          │ │          │ │          │         │
│ │ [Try it] │ │ [Try it] │ │ [Try it] │         │
│ └──────────┘ └──────────┘ └──────────┘         │
│                                                  │
│          ... more recipe cards ...                │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│ HOW IT WORKS (3 steps)                           │
│ 1. Choose a recipe (or build your own)           │
│ 2. Connect your tools (OAuth, 1-click)           │
│ 3. Deploy — your agent runs autonomously         │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│ SOCIAL PROOF / METRICS                           │
│ "30+ integrations | 145+ tools | 25+ recipes"   │
│ Customer logos, testimonials, case studies        │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│ PRICING (existing component)                     │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│ CTA BANNER                                       │
│ "Pick a recipe. Deploy in minutes. Scale forever."│
│ [Start Free]  [Book a Demo]                      │
└─────────────────────────────────────────────────┘
```

### Recipe Detail Page (on click)

```
┌─────────────────────────────────────────────────┐
│ RECIPE NAME: "Deal Copilot"                      │
│ Tagline: "Stop entering data. Start closing."    │
│                                                  │
│ [HubSpot] + [Gmail] + [Calendar] + [Slack]       │
│                                                  │
│ ── What it does ──                               │
│ Step-by-step flow visualization                  │
│                                                  │
│ ── Who it's for ──                               │
│ Sales reps spending 40% of time on admin         │
│                                                  │
│ ── What you'll save ──                           │
│ 8+ hours/week per rep                            │
│ ROI calculator: [team size] → [hours saved]      │
│                                                  │
│ ── Try it now ──                                 │
│ [Start with this recipe] [Watch demo]            │
│                                                  │
│ ── Related recipes ──                            │
│ Pipeline Intelligence | Outbound Researcher      │
└─────────────────────────────────────────────────┘
```

### Platform-Specific Landing Pages

For SEO and paid campaigns, create dedicated pages per platform:

- `/solutions/hubspot` — "AgentC2 for HubSpot" (S1, S2, S3, CS3, M2 recipes)
- `/solutions/slack` — "AgentC2 for Slack Teams" (all recipes with Slack)
- `/solutions/gmail` — "AgentC2 for Gmail" (O2, F1, S1 recipes)
- `/solutions/jira` — "AgentC2 for Jira" (E1, E3, O1 recipes)
- `/solutions/github` — "AgentC2 for GitHub" (E1, E2, E3 recipes)
- `/solutions/shopify` — "AgentC2 for Shopify" (EC1, EC2 recipes)
- `/solutions/intercom` — "AgentC2 for Intercom" (CS1, CS2, CS3, P2 recipes)
- `/solutions/figma` — "AgentC2 for Figma" (P1 recipes)
- `/solutions/voice` — "AgentC2 Voice Agents" (V1, V2 recipes)

---

## 6. Messaging Framework

### By ICP Segment

| Segment         | Headline                               | Subheadline                                                                                            | CTA                          |
| --------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------- |
| **Sales**       | "Your CRM updates itself."             | "AI agents that capture every deal signal from email, meetings, and Slack — so your reps can sell."    | "Deploy your sales agent"    |
| **Marketing**   | "Content that creates itself."         | "From research to published — AI agents that produce, coordinate, and distribute at 10x speed."        | "Start your content engine"  |
| **Support**     | "Support that scales itself."          | "Triage tickets, answer questions, monitor health — without hiring a single additional agent."         | "Deploy your support agent"  |
| **Engineering** | "Bugs fix themselves."                 | "From error to ticket to fix — AI agents that handle the operational overhead so you can ship."        | "Deploy your dev ops agent"  |
| **Operations**  | "Meetings that follow through."        | "Every action item tracked. Every tool synced. Every report generated — autonomously."                 | "Deploy your ops agent"      |
| **Executive**   | "Your business, briefed in 2 minutes." | "Wake up knowing what matters. AI agents that aggregate, analyze, and alert across your entire stack." | "Get your daily briefing"    |
| **Freelancer**  | "Operate like a team of 10."           | "Client management, research, scheduling, and invoicing — handled by AI agents that never sleep."      | "Start building for free"    |
| **E-commerce**  | "Revenue intelligence, automated."     | "From order support to revenue dashboards — AI agents that scale your ops without scaling your team."  | "Deploy your commerce agent" |

### Pain-to-Value Message Map

| Pain Point                             | Landing Copy                                            | Value Proof                          |
| -------------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| "I spend all day in my CRM"            | "Your CRM updates itself after every email and meeting" | 8 hrs/week saved per rep             |
| "Our content team can't keep up"       | "10x your content output without 10x your team"         | 70% reduction in production time     |
| "Support tickets are drowning us"      | "Triage 1,000 tickets like you have 10 agents"          | 80% reduction in first-response time |
| "Bugs pile up while we build features" | "Every error gets a ticket before your standup"         | 30-second error-to-ticket time       |
| "Meeting action items always get lost" | "100% of action items tracked and followed up"          | Zero dropped action items            |
| "I check 6 dashboards every morning"   | "One briefing. Every metric. Every morning."            | 2-minute business overview           |
| "I can't afford to hire help"          | "AI agents that cost less than your coffee habit"       | From $0/month (free tier)            |
| "Our tools don't talk to each other"   | "30+ integrations. One source of truth."                | Eliminate manual data reconciliation |

---

## 7. Conversion Strategy

### Entry Points by Channel

| Channel                              | Target ICP      | Recipe to Lead With          | Landing Page        |
| ------------------------------------ | --------------- | ---------------------------- | ------------------- |
| **Google Ads "HubSpot automation"**  | Sales Teams     | Deal Copilot                 | /solutions/hubspot  |
| **Google Ads "Slack AI bot"**        | Operations      | Meeting Memory               | /solutions/slack    |
| **Google Ads "AI customer support"** | Support Leaders | Ticket Triager               | /solutions/intercom |
| **Google Ads "AI receptionist"**     | Prof. Services  | Voice Receptionist           | /solutions/voice    |
| **LinkedIn Ads (Sales VP)**          | Revenue Leaders | Pipeline Intelligence        | /solutions/hubspot  |
| **LinkedIn Ads (CTO)**               | Engineering     | Bug Bouncer                  | /solutions/github   |
| **LinkedIn Ads (CEO)**               | Executives      | Daily Briefing               | / (main landing)    |
| **Content Marketing (blog)**         | All             | Research Assistant           | / (main landing)    |
| **Product Hunt**                     | Solopreneurs    | Client Manager               | / (main landing)    |
| **Dev communities**                  | Engineers       | Bug Bouncer + Sprint Copilot | /solutions/github   |

### Conversion Funnel

```
Visit → See Recipe → Click "Try It"
  → Connect tools (OAuth, 1-click)
    → Recipe running (immediate value)
      → Explore more recipes
        → Upgrade plan for more runs/agents
```

### Key Principle: Value Before Signup

The recipe gallery should be browsable WITHOUT signup. Let visitors:

1. See all recipes and their value props
2. Click into recipe details
3. See the step-by-step flow
4. Calculate their ROI
5. THEN signup to deploy

This reduces friction and lets the value proposition do the selling.

---

## 8. Priority Recipes for MVP Landing Page

Based on market demand, platform maturity, and ICP size, launch with these 8 recipes:

| Priority | Recipe                      | ICP            | Why First                             |
| -------- | --------------------------- | -------------- | ------------------------------------- |
| 1        | **Deal Copilot** (S1)       | Sales          | Largest addressable market, clear ROI |
| 2        | **Inbox Zero Agent** (O2)   | Everyone       | Universal pain point, easy to demo    |
| 3        | **Ticket Triager** (CS1)    | Support        | High urgency pain, clear metrics      |
| 4        | **Bug Bouncer** (E1)        | Engineering    | Dev-led adoption, viral potential     |
| 5        | **Meeting Memory** (O1)     | Operations     | Cross-functional appeal               |
| 6        | **Daily Briefing** (X1)     | Executive      | Decision-maker appeal, WOW factor     |
| 7        | **Voice Receptionist** (V1) | Prof. Services | Unique differentiator, high margin    |
| 8        | **Content Engine** (M1)     | Marketing      | Content teams are early adopters      |

---

## 9. Implementation Notes

### Recipe Data Model

Each recipe should be stored as structured data (not just page content) so it can be:

- Filtered/searched on the landing page
- Used in email campaigns and ads
- Matched to user's connected integrations post-signup
- A/B tested with different messaging

```typescript
interface Recipe {
    id: string; // "deal-copilot"
    name: string; // "Deal Copilot"
    tagline: string; // "Stop entering data. Start closing deals."
    category: string; // "sales" | "marketing" | "support" | ...
    platforms: string[]; // ["hubspot", "gmail", "google-calendar", "slack"]
    targetIcp: string[]; // ["sales-rep", "account-executive"]
    businessSize: string[]; // ["small", "mid-market", "enterprise"]
    painPoint: string; // "Reps spend 40% of time on CRM data entry"
    valueMetric: string; // "Save 8+ hours/week per rep"
    steps: RecipeStep[]; // Step-by-step flow
    relatedRecipes: string[]; // ["pipeline-intelligence", "outbound-researcher"]
}
```

### Landing Page Components Needed

1. **RecipeGallery** — Filterable grid of recipe cards
2. **RecipeCard** — Individual recipe with logos, tagline, metric, CTA
3. **RecipeDetail** — Full recipe page with flow visualization
4. **PlatformFilter** — Multi-select filter by integration
5. **RoleSelector** — "I'm a [role]" selector for personalization
6. **ROICalculator** — Per-recipe ROI estimation
7. **PlatformLandingPage** — Template for /solutions/[platform] pages

### Existing Components to Reuse

- `HeroSection` — Modify headline and add tool/role selector
- `IntegrationBar` — Already shows platform logos
- `PricingSection` — Keep as-is
- `CtaBanner` — Update copy for recipe-centric messaging
- `NavBar` — Add "Recipes" / "Solutions" nav items
- `Footer` — Keep as-is
