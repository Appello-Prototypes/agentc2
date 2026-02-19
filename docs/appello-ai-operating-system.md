# Appello: The AI-Native Operating Company

**Vision Document — February 2026**
**Classification:** Internal Strategic — BigJim2 Campaign Intent
**Prepared by:** Cursor AI (comprehensive platform analysis)
**Data Sources:** HubSpot CRM, Jira (Q21030, 11,135+ issues), Fathom (50+ meetings), RAG Knowledge Base (216 chunks), AgentC2 Platform (31 agents, 2,466 runs, $281 total AI spend), Gmail, Slack, Google Drive, GitHub, docs/appello-current-state-and-future-vision.md, docs/appello-agentic-workflows-2026-2028.md, docs/agentc2-gtm-strategy-final.md, docs/dark-factory.md

---

## Executive Summary

Appello is a 10-person vertical SaaS company doing ~$400K ARR with 20 customers and zero churn, selling construction management software to ICI subcontractors. The company has two critical bottlenecks — Corey (CEO doing sales at 20% capacity) and Filip (carrying 60% of engineering) — and needs to reach $1M ARR by October 2026 to hit breakeven.

The company also operates AgentC2, an AI agent platform with 31 agents, 7 networks, 21 discoverable skills, and 130+ tools already deployed and running its own operations.

This document defines the complete AI operating system that BigJim2 should build, deploy, and govern — transforming Appello from a company that uses AI into a company that runs on AI, with humans providing strategic direction, customer relationships, and approval at decision gates.

---

## Part 1: The Company Today

### The Business

| Metric           | Value                                              |
| ---------------- | -------------------------------------------------- |
| ARR              | ~$400K CAD                                         |
| MRR              | ~$35K                                              |
| Customers        | 20 (zero churn, 3+ years)                          |
| Average Deal     | $15,337 ARR                                        |
| Largest Deal     | $67,500 (Thomas Kanata)                            |
| Breakeven Target | $1M ARR by October 2026                            |
| Team Size        | ~10 people                                         |
| Product          | 12-module SaaS for ICI construction subcontractors |
| AI Platform      | AgentC2 — 31 agents, 2,466 runs, $281 total spend  |

### The Team and Their Bottlenecks

| Person             | Role                                    | Current Load                                                     | AI Opportunity                                                                                   |
| ------------------ | --------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Corey Shelson      | CEO / Product / Sales / Strategy        | Sales at 20% capacity, leading product + AI + strategy           | Offload operational coordination, sales pipeline management, daily briefings, meeting follow-ups |
| Ian Haase          | COO / Legal / Finance / HR / Onboarding | Onboarding lead, recruiting, financial model, investor relations | Offload onboarding checklists, document preparation, compliance tracking                         |
| Filip Altankov     | Senior Dev / Product Lead               | 60% of all Jira work, code review, QA, specs, architecture       | Offload ticket triage, spec drafting, code review prep, QA automation                            |
| Emma Mann          | Frontend Developer                      | ~4 support tickets/day, Progress Billing/SOV                     | Offload ticket classification, test case generation                                              |
| Travis McKenna     | Backend / Integrations                  | QuickBooks sync, payment logic                                   | Offload QBO monitoring, integration health checks                                                |
| Christopher Vachon | Developer                               | Core development, SOC 2 compliance                               | Offload compliance documentation, security audit prep                                            |
| Nathan Friesen     | Sales / Demos                           | Demo delivery, prospect engagement                               | Offload lead research, CRM hygiene, follow-up sequencing                                         |
| Kylin Cheong       | Customer Service Manager                | Ticket triage, 9-min first response                              | Offload initial classification, FAQ responses, routing                                           |
| Tristan Gemus      | Mobile Dev (Contractor)                 | GPS/clock features, native app                                   | Offload mobile bug triage, test case generation                                                  |

### What Already Runs on AI

The AgentC2 platform already handles:

- **Email triage**: 857 runs, auto-classifying and routing emails (8 categories)
- **Morning standups**: Daily briefing synthesis from Jira, Slack, Fathom, Calendar
- **Meeting intelligence**: Fathom meeting processing, transcript ingestion into RAG
- **Slack conversations**: 251 runs via Slack bot
- **CRM operations**: HubSpot queries via specialist agent
- **Campaign analysis**: Military-style mission decomposition
- **Platform governance**: Agent health, costs, metrics monitoring

### What Doesn't Run on AI Yet

| Function                   | Current State                                  | Hours/Week Wasted          |
| -------------------------- | ---------------------------------------------- | -------------------------- |
| Sales pipeline management  | Manual HubSpot updates, forgotten follow-ups   | 5-8 hrs (Nathan + Corey)   |
| Customer onboarding        | Ian manually tracks checklists, data migration | 10-15 hrs per customer     |
| Support ticket triage      | Kylin manually reads and routes every ticket   | 10+ hrs/week               |
| Release management         | Filip manually manages Jira statuses, QA       | 8-10 hrs/week              |
| Billing and invoicing      | Manual progress billing preparation            | 4-6 hrs/month per customer |
| Competitive intelligence   | Ad hoc, Corey-driven research                  | 2-3 hrs/week               |
| Investor reporting         | Manual financial model updates                 | 4-6 hrs/month              |
| Content and SEO            | Manual blog writing, keyword tracking          | 5-8 hrs/week               |
| Customer health monitoring | Reactive — only when customer complains        | 0 (not happening at all)   |

---

## Part 2: The Vision — Every Function Runs on AI

### Design Principles

1. **Humans set direction, AI executes** — Corey, Ian, and the team define WHAT; BigJim2 and his networks figure out HOW
2. **Approval gates at every consequential decision** — No email sent, no ticket created, no agent deployed without human review where configured
3. **Progressive autonomy** — Start at Level 1 (human approves everything), earn trust, escalate to Level 3-4 over months
4. **Existing infrastructure first** — Build on the 31 agents, 7 networks, 21 skills, and 16 integrations already deployed
5. **Cost discipline** — Current total AI spend is $281. The entire operating system should cost less than a single employee ($4K/month)
6. **Measurable impact** — Every agent network tracks hours saved, tasks completed, and errors prevented

### The Operating Model

```
                    ┌─────────────────────────────────────────┐
                    │           HUMAN LEADERSHIP              │
                    │  Corey: Strategy, Customers, Product    │
                    │  Ian: Finance, Legal, Onboarding        │
                    │  Filip: Architecture, Code Review        │
                    └──────────────┬──────────────────────────┘
                                   │ Goals, Approvals, Direction
                                   ▼
                    ┌─────────────────────────────────────────┐
                    │         BIGJIM2 (ORCHESTRATOR)          │
                    │  7 Networks · 21 Skills · 130+ Tools    │
                    │  Campaigns · Workflows · Governance     │
                    └──────────────┬──────────────────────────┘
                                   │ network-execute
                    ┌──────────────┼──────────────────────────┐
          ┌─────────┴───┐  ┌──────┴──────┐  ┌───────────┐    │
          │  REVENUE    │  │  PRODUCT    │  │  PEOPLE   │    │
          │  ENGINE     │  │  ENGINE     │  │  ENGINE   │    │
          └─────────────┘  └─────────────┘  └───────────┘    │
          ┌─────────────┐  ┌─────────────┐  ┌───────────┐    │
          │  CUSTOMER   │  │  PLATFORM   │  │  FINANCE  │    │
          │  SUCCESS    │  │  OPS        │  │  ENGINE   │    │
          └─────────────┘  └─────────────┘  └───────────┘    │
                                                              │
                    ┌─────────────────────────────────────────┘
                    │  DARK FACTORY (Engineering Autonomy)
                    └─────────────────────────────────────────
```

---

## Part 3: The Seven Engines

### Engine 1: Revenue Engine

**Goal:** Take Appello from 1-2 new customers/month to 5/month. Reach $1M ARR by October 2026.

**Network:** `revenue-engine` (new)

| Agent                   | Role                                                                                                                                                                                         | Trigger                               | Human Gate                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------- |
| **Pipeline Guardian**   | Monitors HubSpot daily. Identifies stale deals (no activity 7+ days), at-risk deals (no response after demo), and high-value deals needing attention. Produces daily pipeline health report. | Daily 7 AM cron                       | Review-only (Slack DM to Nathan + Corey) |
| **Lead Researcher**     | When new lead enters HubSpot, enriches with web research: company size, trade type, geographic region, tech stack, competitor tools. Scores fit against ICP.                                 | HubSpot deal creation webhook         | None — enrichment only                   |
| **Follow-Up Sequencer** | For deals in "Scheduled Presentation" or "In Pipeline" with no activity in 5 days, drafts personalized follow-up emails. References demo notes, customer pain points, relevant case studies. | Daily 8 AM cron                       | Human approval before sending            |
| **Demo Prep Agent**     | 2 hours before any scheduled demo, pulls company info from HubSpot, recent Slack/email threads, similar customer profiles, and competitive intelligence. Delivers a 1-page brief to Slack.   | Google Calendar event trigger         | None — prep document only                |
| **Win/Loss Analyst**    | When a deal moves to Closed-Won or Closed-Lost, generates structured analysis: what worked, what didn't, time in each stage, competitive factors. Updates RAG knowledge base.                | HubSpot deal stage change webhook     | None — analysis only                     |
| **Referral Tracker**    | Monitors existing customers' interactions for referral indicators. When a customer mentions another company, flags as referral opportunity.                                                  | Fathom meeting webhook + email triage | Corey reviews referral follow-ups        |

**Estimated Impact:**

- Pipeline velocity: +40% (automated follow-ups prevent deals from going stale)
- Demo preparation time: 30 min → 0 (automated brief)
- Lead qualification: Instant ICP scoring vs manual research
- Hours saved/week: ~12 (Nathan + Corey combined)

---

### Engine 2: Customer Success Engine

**Goal:** Maintain zero churn. Turn 20 customers into advocates. Detect problems before customers report them.

**Network:** `customer-success` (new)

| Agent                          | Role                                                                                                                                                                                            | Trigger                      | Human Gate                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------- |
| **Health Monitor**             | Tracks per-customer health signals: support ticket volume/trend, Jira ticket severity, login frequency (when available), billing status, NPS scores. Produces weekly customer health dashboard. | Weekly Monday 6 AM cron      | Review-only (Canvas dashboard)     |
| **Ticket Classifier**          | When a Jira ticket arrives with customer label, classifies severity (P0-P3), identifies affected module, checks for related open tickets, and routes to the right developer.                    | Jira ticket creation webhook | None — routing only, human assigns |
| **Proactive Outreach Agent**   | When health score drops (3+ tickets in a week, or first P0 in 30 days), drafts a personalized check-in email from Corey. References specific issues and proposed resolution timeline.           | Health Monitor alert         | Corey approves before sending      |
| **Onboarding Tracker**         | For new customers, maintains a checklist: data migration status, training sessions completed, first payroll run, first invoice generated. Alerts Ian when items are overdue.                    | Customer deal close webhook  | Ian reviews progress weekly        |
| **Feature Request Aggregator** | Scans Jira for feature requests, groups by customer and theme, identifies requests from multiple customers (validation signal). Produces monthly product insight report.                        | Monthly cron                 | Corey + Filip review for roadmap   |
| **Renewal Forecaster**         | 90 days before anniversary, generates renewal report: usage patterns, support history, expansion opportunities. Suggests upsell (new modules, Appello Intelligence tier).                       | 90-day pre-anniversary cron  | Ian reviews renewal strategy       |

**Estimated Impact:**

- Customer issue response: Proactive vs reactive
- Onboarding completion: Tracked and enforced vs ad hoc
- Feature prioritization: Data-driven vs gut feel
- Hours saved/week: ~8 (Ian + Kylin + Corey combined)

---

### Engine 3: Product Engine

**Goal:** Accelerate the release cycle. Free Filip from being the bottleneck. Systematize QA, specs, and release management.

**Network:** `product-engine` (new)

| Agent                    | Role                                                                                                                                                                                                                | Trigger                    | Human Gate                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------- |
| **Spec Drafter**         | When a Jira ticket is moved to "To Refine," pulls context from related tickets, customer conversations (Fathom), and existing module docs. Drafts acceptance criteria and implementation notes for Filip to review. | Jira status change webhook | Filip reviews and edits spec  |
| **Release Manager**      | Tracks all tickets in the current release. Produces daily release status: what's in progress, what's in code review, what's in QA, what's blocking. Identifies risks (tickets in "Waiting" for 3+ days).            | Daily 7 AM cron            | Filip reviews status          |
| **QA Test Generator**    | When a ticket moves to "Code Review," reads the spec and generates test cases: happy path, edge cases, regression scenarios. Posts to Jira as a checklist.                                                          | Jira status change webhook | QA engineer validates         |
| **Bug Pattern Detector** | Analyzes recent bugs across customers. Identifies patterns: recurring module issues, common user errors, regression clusters. Produces monthly bug trend report.                                                    | Monthly cron               | Filip + Emma review           |
| **Changelog Writer**     | When a release is deployed, aggregates all included tickets and produces a customer-facing changelog. Drafts release notes email for customers.                                                                     | Deployment webhook         | Corey approves before sending |
| **Competitor Monitor**   | Weekly web scrape of competitor product pages (Procore, ServiceTitan, Buildertrend, etc.). Identifies new features, pricing changes, positioning shifts. Updates competitive intelligence RAG.                      | Weekly cron                | Corey reviews highlights      |

**Estimated Impact:**

- Spec writing time: 2-4 hrs/ticket → 30 min review
- Release coordination: 5 hrs/week → 1 hr review
- QA coverage: Manual → systematic test case generation
- Hours saved/week: ~15 (Filip primarily)

---

### Engine 4: People and Operations Engine

**Goal:** Systematize the operational rhythms. Make the daily standup, hiring, and team coordination run themselves.

**Network:** `people-ops` (new — merges with existing `morning-briefing`)

| Agent                     | Role                                                                                                                                                                                    | Trigger                | Human Gate             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------- |
| **Standup Orchestrator**  | Already deployed. Generates morning standup dashboard from Jira, Slack, Fathom.                                                                                                         | Daily 6 AM cron        | Review-only            |
| **Meeting Processor**     | Already deployed. Processes Fathom meetings, extracts action items, creates Jira tickets, posts to Slack.                                                                               | Fathom meeting webhook | None — extraction only |
| **Hiring Pipeline Agent** | Tracks candidates through screening process. When Ian schedules a screening call, prepares candidate brief (LinkedIn, GitHub, portfolio). After call, prompts Ian for structured notes. | Calendar event trigger | Ian provides decision  |
| **Team Capacity Planner** | Tracks per-developer Jira load. Alerts when someone exceeds sustainable capacity (Filip's 60% load). Suggests ticket redistribution.                                                    | Weekly cron            | Filip + Corey review   |
| **Knowledge Curator**     | After every customer call, sales demo, or standup, checks if new information should be added to RAG. Identifies knowledge gaps (topics people ask about that have no RAG matches).      | Meeting webhook        | None — ingestion only  |

**Estimated Impact:**

- Standup prep: Already saved 30 min/day
- Meeting follow-up: Automatic action item tracking
- Hiring process: Structured and tracked vs ad hoc
- Hours saved/week: ~5 (Ian primarily)

---

### Engine 5: Finance Engine

**Goal:** Automate financial visibility. Give Ian and Corey real-time understanding of the business without manual spreadsheet work.

**Network:** `finance-engine` (new)

| Agent                       | Role                                                                                                                                                                     | Trigger                    | Human Gate              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ----------------------- |
| **Revenue Tracker**         | Pulls HubSpot deal data weekly. Tracks MRR, ARR, pipeline value, weighted pipeline, revenue velocity. Produces financial dashboard on Canvas.                            | Weekly Monday 6 AM cron    | Ian reviews             |
| **Invoice Monitor**         | Tracks outstanding invoices. Alerts when payments are overdue 30+ days. Drafts follow-up reminders.                                                                      | Weekly cron                | Ian approves follow-ups |
| **Cost Analyzer**           | Tracks AgentC2 platform costs, Supabase costs, infrastructure costs. Produces monthly cost report with per-agent cost breakdown.                                         | Monthly cron               | Corey reviews           |
| **Investor Update Drafter** | Monthly, aggregates: ARR growth, customer count, pipeline, product milestones, team updates. Drafts investor update email.                                               | Monthly cron (last Friday) | Corey reviews and sends |
| **IRAP Grant Tracker**      | Tracks SR&ED/IRAP eligible development work. Scans Jira for qualifying tickets (experimental development, technical uncertainty). Produces quarterly SR&ED report draft. | Quarterly cron             | Ian + accountant review |

**Estimated Impact:**

- Financial reporting: 8 hrs/month → 1 hr review
- Investor updates: 4 hrs/month → 30 min review
- Cost visibility: Zero → real-time dashboard
- Hours saved/month: ~15 (Ian + Corey)

---

### Engine 6: Platform Operations Engine

**Goal:** Keep AgentC2 and Appello infrastructure healthy, secure, and cost-efficient.

**Network:** Extends existing `platform-admin`

| Agent                  | Role                                                                                                                 | Trigger                   | Human Gate                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------- |
| **Platform Ops**       | Already deployed. Monitors agent health, runs, costs, metrics.                                                       | On-demand                 | None                        |
| **Canvas Builder**     | Already deployed. Builds dashboards from natural language.                                                           | On-demand                 | None                        |
| **Security Sentinel**  | Monitors for anomalies: unusual API patterns, failed auth attempts, cost spikes. Alerts on SOC 2 control violations. | Daily cron + event-driven | Corey + Chris review alerts |
| **Uptime Monitor**     | Checks agentc2.ai and useappello.com availability every 5 minutes. Alerts on downtime. Tracks SLA metrics for SOC 2. | 5-min cron                | None — alert only           |
| **Deployment Watcher** | Monitors GitHub Actions CI/CD. On deployment failure, creates Jira ticket, alerts dev team, and captures error logs. | GitHub webhook            | None — notification only    |

**Estimated Impact:**

- Security monitoring: Manual → continuous
- SOC 2 evidence: Automated collection
- Downtime detection: Minutes vs hours
- Hours saved/week: ~3 (Chris primarily)

---

### Engine 7: Dark Factory (Engineering Autonomy)

**Goal:** Close the loop from ticket to deployed code with risk-aware autonomy. Already architected in `docs/dark-factory.md`.

**Workflow:** `coding-pipeline` (already defined)

| Step                    | What Happens                              | Autonomy Level              |
| ----------------------- | ----------------------------------------- | --------------------------- |
| Ticket intake           | Agent reads Jira ticket, pulls context    | Automatic                   |
| Codebase analysis       | Maps affected files, dependencies         | Automatic                   |
| Implementation plan     | Generates plan with risk classification   | Level 1: Human reviews plan |
| Code generation         | Cursor agent writes the code              | Automatic                   |
| Build verification      | Remote build + test + lint                | Automatic                   |
| Scenario validation     | Runs behavioral test scenarios            | Automatic                   |
| Trust score calculation | Aggregates all quality signals            | Automatic                   |
| PR review               | Human or auto-approve based on risk/trust | Level 2-4: Risk-gated       |
| Merge and deploy        | Merge PR, await CI, verify deployment     | Level 4-5: Trust-gated      |

**Initial Configuration:**

- `autoApprovePlanBelow: low` (only trivial/low-risk plans auto-approved)
- `autoApprovePrBelow: trivial` (almost all PRs need human review initially)
- Trust score threshold: 0.85 for auto-merge consideration
- Filip reviews all medium+ risk plans and PRs

**Estimated Impact (at maturity):**

- Bug fix cycle: Days → hours
- Simple feature implementation: 1-2 days → same-day
- Filip's code review load: 60% → 30% (auto-handles trivial fixes)
- Throughput: 6-8 issues/week → 15-20 issues/week

---

## Part 4: The Appello Intelligence Multiplier

Every engine above runs Appello's own operations. But the same patterns become **product** for Appello's 20+ customers via Appello Intelligence.

| Internal Engine                    | Customer-Facing Recipe                  | Intelligence Tier      |
| ---------------------------------- | --------------------------------------- | ---------------------- |
| Revenue Engine → Pipeline Guardian | Morning Dispatch Intelligence           | Starter ($250/mo)      |
| Customer Success → Health Monitor  | Job Profitability Early Warning         | Starter                |
| Product Engine → Release Manager   | Timesheet Compliance Monitor            | Starter                |
| People Ops → Standup Orchestrator  | Executive Dashboard Narrator            | Pro ($500/mo)          |
| Finance → Invoice Monitor          | Progress Billing Accelerator            | Pro                    |
| Dark Factory → Deployment Watcher  | Equipment Inspection Compliance         | Pro                    |
| All engines                        | Full 50-recipe suite + custom workflows | Enterprise ($1,000/mo) |

The 50 construction-specific workflows are already designed in `docs/appello-agentic-workflows-2026-2028.md`. Examples:

1. Morning Dispatch Intelligence
2. Estimate Follow-Up Sequencer
3. Timesheet Compliance Monitor
4. Safety Form Trend Analyzer
5. Certification Expiry Countdown
6. Equipment Inspection Compliance
7. Progress Billing Accelerator
8. Executive Dashboard Narrator
9. Overtime Prevention Alert
10. Job Profitability Early Warning

**Revenue Target:** 35 Intelligence customers at $500 avg = $210K new ARR by December 2026.

---

## Part 5: Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**What BigJim2 builds:**

1. **Revenue Engine network** — Pipeline Guardian + Lead Researcher + Follow-Up Sequencer
2. **Customer Success network** — Health Monitor + Ticket Classifier + Onboarding Tracker
3. **Connect all triggers** — HubSpot webhooks, Jira webhooks, Fathom webhooks, Google Calendar triggers
4. **Build governance** — Budgets ($20/month per agent), guardrails (no external communication without approval), observability dashboards

**Human gates configured:**

- All external emails: human approval
- All agent creations: BigJim2 proposes, Corey approves
- All budget changes: human approval

**Success criteria:**

- Pipeline Guardian produces accurate daily reports for 2 consecutive weeks
- Customer Health Monitor correctly scores all 20 customers
- Zero false positives in automated follow-up drafts

### Phase 2: Acceleration (Weeks 5-8)

**What BigJim2 builds:**

1. **Product Engine network** — Spec Drafter + Release Manager + QA Test Generator
2. **Finance Engine** — Revenue Tracker + Cost Analyzer + Investor Update Drafter
3. **Dark Factory** — Seed pipeline, configure policy, start with `autoApprovePlanBelow: trivial`
4. **Cross-engine workflows** — e.g., "Customer reports bug → Ticket Classifier routes → Spec Drafter drafts fix → Dark Factory implements"

**Trust escalation:**

- After 2 weeks of accurate pipeline reports: allow Pipeline Guardian to auto-update HubSpot deal stages
- After QA Test Generator produces 50 validated test cases: increase confidence in auto-generated specs

**Success criteria:**

- Filip's Jira workload drops from 60% to 40% of total
- Release notes generated automatically for 2 consecutive releases
- Dark Factory successfully deploys 3 trivial bug fixes with human review

### Phase 3: Full Operating System (Weeks 9-16)

**What BigJim2 builds:**

1. **People Ops Engine** — Hiring Pipeline Agent + Team Capacity Planner
2. **Platform Ops** — Security Sentinel + Uptime Monitor
3. **Appello Intelligence v1** — First 3 recipes deployed to 5 pilot customers
4. **Campaign system integration** — BigJim2 accepts high-level goals and decomposes them into multi-engine campaigns

**Autonomy escalation:**

- Dark Factory: `autoApprovePlanBelow: low`, trust threshold 0.8
- Follow-Up Sequencer: auto-send for templated follow-ups (non-personalized)
- Ticket Classifier: auto-route P3 tickets without human review

**Success criteria:**

- 5 Appello Intelligence pilot customers live with 3 recipes
- Dark Factory autonomy rate: 20% (trivial + low-risk tickets auto-deployed)
- Total AI cost: < $500/month across all engines
- Measured hours saved: 40+ hrs/week across team

### Phase 4: Scale (Months 5-12)

**What BigJim2 governs:**

1. **Appello Intelligence rollout** — 35 customers, 10 recipes, $210K new ARR
2. **Dark Factory maturity** — Level 3-4 autonomy for medium-risk tickets
3. **Self-improvement** — Learning sessions, simulation testing, A/B experiments on agent configurations
4. **New engine: Marketing** — SEO content generation, social media scheduling, conference prep
5. **New engine: Compliance** — SOC 2 continuous evidence collection, privacy audit automation

---

## Part 6: Cost Model

| Category                      | Monthly Cost (Estimated)          |
| ----------------------------- | --------------------------------- |
| AI model costs (all engines)  | $400-600                          |
| Infrastructure (DigitalOcean) | $96                               |
| Integrations (MCP servers)    | $0 (API keys already provisioned) |
| **Total**                     | **$500-700/month**                |

**Comparison:**

- One junior developer: $4,000-6,000/month
- One sales coordinator: $3,500-5,000/month
- One project manager: $5,000-7,000/month
- **AI Operating System:** $500-700/month replacing portions of all three

**ROI at Phase 3 (4 months):**

- Hours saved: 40+ hrs/week = 1 FTE equivalent
- Revenue acceleration: +2-3 customers/month from pipeline optimization = +$30K-$45K ARR/month
- Appello Intelligence revenue: $210K new ARR by December 2026
- Total annual value: $300K+ in saved labor + new revenue vs $7K annual AI cost

---

## Part 7: Governance and Safety

### Autonomy Levels (Progressive Trust)

| Level | Description                                            | Who Approves                | When to Escalate                     |
| ----- | ------------------------------------------------------ | --------------------------- | ------------------------------------ |
| 0     | Human does everything manually                         | N/A                         | Starting state                       |
| 1     | Agent proposes, human approves everything              | Designated human per engine | Default for all new agents           |
| 2     | Agent auto-executes low-risk, human approves medium+   | Risk classifier             | After 2 weeks of accurate proposals  |
| 3     | Agent auto-executes low+medium, human approves high+   | Trust score                 | After 50+ successful auto-executions |
| 4     | Agent auto-executes most, human approves critical only | Trust score + policy        | After 200+ successful executions     |
| 5     | Dark Factory — fully autonomous with monitoring        | Automated governance        | Only for proven workflows            |

### Guardrails

1. **No external communication without human approval** (emails, Slack to customers, social media)
2. **No financial transactions** (invoicing, payments, refunds — display only)
3. **No code deployment above "low" risk** without human PR review
4. **No agent creation/modification** without Corey approval
5. **Monthly budget caps** per agent ($20 default, $50 for high-volume agents)
6. **Audit logging** on every action with full execution traces
7. **Kill switch** — any engine can be disabled instantly via BigJim2 or platform UI

### Monitoring

BigJim2 produces a weekly "AI Operating System Health Report":

- Total runs, success rate, cost
- Per-engine performance metrics
- Autonomy escalation recommendations
- Guardrail violation events
- Hours saved (estimated from run counts and task types)
- Revenue impact (pipeline velocity, customer health improvements)

---

## Part 8: The Campaign Intent for BigJim2

This is the directive BigJim2 receives to begin building:

> **Intent:** Transform Appello into an AI-native operating company where every business function — revenue, customer success, product development, operations, finance, platform governance, and engineering — is coordinated by autonomous agent networks with human leadership providing strategic direction and approval at consequential decision gates.
>
> **End State:** By October 2026, Appello operates with 7 autonomous engine networks containing 30+ specialist agents, processing 500+ runs/day at < $700/month, saving 40+ hours/week of human labor, accelerating customer acquisition to 5/month, maintaining zero churn through proactive health monitoring, and generating $210K new ARR from Appello Intelligence — reaching the $1M ARR breakeven target with a team of 10 humans and an AI operating system.
>
> **Constraints:**
>
> - No external customer communication without human approval
> - No financial transactions
> - No code deployment above "low" risk without human PR review
> - Total AI spend < $700/month
> - All actions auditable with full execution traces
> - Progressive autonomy — start at Level 1, earn trust
>
> **Restraints:**
>
> - Must use existing AgentC2 infrastructure (31 agents, 7 networks, 16 integrations)
> - Must not disrupt current customer operations
> - Must not require additional infrastructure beyond current DigitalOcean droplet
> - Phase 1 must be operational within 4 weeks

---

## Appendix: What Already Exists

### Current Agents (31)

assistant, workspace-concierge (Big Jim), bigjim2, email-triage, slack-hello-world, canvas-builder, campaign-reviewer, youtube-research, welcome-v2, campaign-analyst, campaign-planner, crm-specialist, briefing-synthesizer, research, calendar-assistant, fathom-ingester, fathom-meeting-processor, standup-orchestrator, web-scraper-specialist, meeting-analyst, platform-ops, browser-agent, slack-specialist, webhook-wizard, google-calendar-agent, campaign-architect, skill-builder, jira-specialist, github-specialist, simulator, mcp-setup-agent

### Current Networks (7 + 1)

biz-ops, comms, research-intel, platform-admin, customer-operations, morning-briefing, engineering (+ morning-briefing network for standups)

### Current Skills (21 discoverable on BigJim2)

platform-agent-management, platform-skill-management, platform-knowledge-management, platform-triggers-schedules, platform-network-management, platform-network-execution, platform-canvas-dashboards, platform-observability, platform-learning, platform-simulations, platform-quality-safety, core-utilities, platform-goals, platform-integrations, campaign-analysis, platform-workflow-execution, platform-workflow-management, self-authoring, platform-organization, platform-webhooks, agent-collaboration

### Connected Integrations (16)

ATLAS, DigitalOcean, Fathom, Firecrawl, Gmail (3 users), Google Drive (3 users), HubSpot, Incoming Webhook, Jira, JustCall, Playwright, Slack, Supabase, WhatsApp Web, YouTube Transcript, Google Calendar

### Existing Workflows (2)

daily-briefing, meeting-followup

### Key Documents

- `docs/appello-agentic-workflows-2026-2028.md` — 50 construction-specific AI workflows
- `docs/agentc2-gtm-strategy-final.md` — Go-to-market strategy with pricing
- `docs/dark-factory.md` — Autonomous coding pipeline architecture
- `docs/appello-current-state-and-future-vision.md` — Complete company analysis
- `docs/appello-intelligence-2-pager.md` — Appello Intelligence product brief
