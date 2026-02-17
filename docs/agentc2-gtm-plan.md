# AgentC2 Go-to-Market Plan

**Date:** February 17, 2026 (Revised: Accelerated Timeline)
**Author:** Strategic Planning
**Status:** Draft v2 — ACCELERATED

---

## Executive Summary

~~AgentC2 goes to market through a concentric expansion model — starting from the inside out.~~

**v2 Revision: The market won't wait. Neither do we.**

By December 2026, OpenAI AgentKit, Salesforce AgentForce, Microsoft Copilot Studio, and a dozen well-funded startups will be fighting for the horizontal AI agent platform market. Waiting until 2027 to launch publicly is surrendering the window.

**The revised model: Two parallel tracks, not sequential phases.**

```
TRACK A: CONSTRUCTION VERTICAL          TRACK B: PUBLIC PLATFORM
(Appello wedge — revenue NOW)           (Market position — growth engine)

Mar: Build Appello MCP (MVP 20 tools)   Mar: Recipe landing page live
Apr: 5 pilot customers connected        Apr: Free tier + self-serve signup
May: 15 customers on Intelligence       May: Product Hunt launch
Jun: 20 customers, first case studies   Jun: Paid acquisition begins
Jul: New customer acquisition starts    Jul: 100+ free users, 20+ paid
Aug-Dec: Scale to 35 construction cos   Aug-Dec: Scale to 500+ users, V2 verticals
```

**Both tracks share:** the same platform, the same recipe framework, the same 30+ MCP integrations. The construction vertical proves the model. The public platform captures market share. They reinforce each other — construction case studies become the social proof that sells the public platform.

**Why this wins:** Every other AI agent platform is going top-down (enterprise sales) or bottom-up (developer adoption) into generic use cases. AgentC2 goes **two-front: a captive vertical with proven ROI + a public platform with the broadest MCP ecosystem in the market.** Construction is the proof. The platform is the play.

---

## Part 1: The Wedge — Why Appello + Construction

### 1.1 Why This Is the Easiest Entry Point

| Advantage                  | Detail                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Captive audience**       | 20 paying Appello customers with zero churn — they already trust you                                                 |
| **Known pain points**      | Documented in Jira (11,135 issues), Fathom (50+ meetings), HubSpot (100+ deals)                                      |
| **Existing relationships** | Corey/Ian/Nathan talk to these people weekly                                                                         |
| **Revenue expansion**      | Average customer pays $15K ARR for Appello — AgentC2 adds $3-10K/year in agent-powered automation                    |
| **No competition**         | Zero AI agent platforms targeting ICI subcontractor operations                                                       |
| **Proven workflows**       | 50 construction-specific agentic workflows already designed (documented in `appello-agentic-workflows-2026-2028.md`) |
| **Data advantage**         | You know what every module does, what data flows where, and what breaks — because you built it                       |
| **Dogfooding**             | AgentC2 already running Appello's internal ops — you can demo your own results                                       |

### 1.2 The Construction ICP (Refined)

**Primary ICP: ICI Subcontractor, 20-200 field staff**

| Attribute          | Profile                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Company Size**   | 20-200 field workers, 5-15 office staff                                                                                   |
| **Trades**         | Mechanical insulation, HVAC, electrical, plumbing, fire protection, scaffolding, sheet metal                              |
| **Geography**      | North America (Canada first, US expanding)                                                                                |
| **Decision Maker** | Owner, GM, or Operations Manager                                                                                          |
| **Current Tools**  | Appello (ERP) + QuickBooks + Slack/Teams + Gmail/Outlook + spreadsheets + whiteboards                                     |
| **Budget**         | Already paying $15-70K/year for Appello — incremental $3-10K is within signing authority                                  |
| **Pain Points**    | Payroll chaos, scheduling conflicts, missing timesheets, safety compliance, job costing blindspots, cash flow uncertainty |
| **Sophistication** | "If your crew can text, they can use Appello" — not technical, needs turnkey solutions                                    |
| **Buying Trigger** | Growing too fast for current processes; hired someone just for admin; lost money on a job they thought was profitable     |

**Secondary ICP: Larger ICI Contractors, 200-2,000+ field staff**

Thomas Kanata ($67.5K ARR) and the pipeline shift toward larger deals indicates an emerging enterprise ICP with 10x the data volume and operational complexity — where agents deliver even more value.

### 1.3 The Tool Stack That Construction Companies Actually Use

Based on Appello customer data and the website's integration bar:

| Tool                  | Penetration              | AgentC2 Integration      |
| --------------------- | ------------------------ | ------------------------ |
| **Appello**           | 100% (they're customers) | MCP Server (to build)    |
| **QuickBooks Online** | ~80%                     | MCP via Zapier or direct |
| **Gmail**             | ~60%                     | Native OAuth (built)     |
| **Outlook**           | ~40%                     | Native OAuth (built)     |
| **Slack**             | ~30%                     | MCP (built)              |
| **Microsoft Teams**   | ~40%                     | Not yet built            |
| **Google Drive**      | ~40%                     | Native OAuth (built)     |
| **Dropbox**           | ~20%                     | Native OAuth (built)     |
| **Google Calendar**   | ~40%                     | Native OAuth (built)     |
| **Outlook Calendar**  | ~30%                     | Native OAuth (built)     |
| **HubSpot**           | ~5% (some use for sales) | MCP (built)              |

**Key insight:** The average Appello customer uses Appello + QuickBooks + email (Gmail or Outlook) + messaging (Slack or Teams) + file storage (Drive or Dropbox). That's 4-5 tools. The recipes write themselves.

---

## Part 2: The Five Phases

### Phase 0: Dogfooding (Current State — Already in Progress)

**Timeline:** Ongoing since early 2026
**Status:** Active — 40+ agents, 13 MCP integrations, $218 total AI spend

**What Appello is already doing internally with AgentC2:**

- Company Intelligence Agent (weekly automated business reports)
- HubSpot pipeline monitoring
- Jira ticket analysis
- Fathom meeting intelligence
- Slack integration for team notifications
- Cross-system data correlation

**Why this matters for GTM:**

- Every internal success becomes a case study: "We reduced our sprint planning time by X hours using AgentC2"
- The team experiences the product as users, not just builders
- Real usage data informs pricing, packaging, and UX decisions
- Credibility: "We run our own business on this before asking you to"

**Phase 0 Deliverables (by end of February 2026):**

- [ ] Document internal agent fleet performance metrics (time saved, cost, accuracy)
- [ ] Identify top 5 internal workflows that translate directly to customer use cases
- [ ] Create "Appello runs on AgentC2" narrative for sales conversations
- [ ] Establish baseline metrics for before/after comparison

---

### Phase 1: Build the Appello MCP Server

**Timeline:** March-April 2026 (8 weeks)
**Investment:** Engineering time (Filip, Travis, or contractor)
**Revenue Impact:** Prerequisite for all subsequent revenue

**What to build:**

The Appello MCP server exposes Appello's 12 modules as Model Context Protocol tools that AgentC2 agents can invoke. This is the bridge that connects Appello's operational data to AI agent orchestration.

**MCP Tool Categories (from the workflows document):**

| Category             | Tools | Examples                                                                                 |
| -------------------- | ----- | ---------------------------------------------------------------------------------------- |
| `appello-scheduling` | 8-10  | List today's jobs, get crew assignments, create/update schedule entries, check conflicts |
| `appello-timesheets` | 6-8   | Get timesheet entries, check missing timesheets, calculate hours, approve timesheets     |
| `appello-safety`     | 6-8   | List form submissions, get JHA data, check compliance rates, create safety alerts        |
| `appello-training`   | 5-6   | Check certifications, find expiring certs, list training records, verify qualifications  |
| `appello-equipment`  | 5-6   | List assets, check inspection status, track utilization, check-in/out                    |
| `appello-financial`  | 8-10  | Get job costs, budget vs actual, profitability analysis, cost code breakdown             |
| `appello-billing`    | 6-8   | List invoices, AR aging, progress billing status, SOV data                               |
| `appello-crm`        | 6-8   | List estimates, contacts, companies, change orders, pipeline                             |
| `appello-project`    | 5-6   | List jobs, notes, documents, status tracking                                             |
| `appello-hr`         | 4-5   | Employee records, wage tables, leave management                                          |
| `appello-purchasing` | 4-5   | Purchase orders, material tracking, inventory                                            |
| `appello-reporting`  | 3-4   | Dashboard data, KPI calculations, export functions                                       |

**Total: ~70-85 MCP tools**

**Architecture decisions:**

1. **Multi-tenant by design** — Each Appello customer gets their own MCP connection scoped to their data
2. **Read-first, write-later** — Launch with read-only tools (reporting, monitoring, analysis), add write tools (create, update, schedule) in Phase 2
3. **Authentication** — API key per customer, managed through AgentC2's IntegrationConnection system
4. **Hosting** — Hosted MCP server at `https://mcp.useappello.com` (like HubSpot's `https://mcp.hubspot.com`)

**Phase 1 Deliverables:**

- [ ] Appello API endpoints for all 12 modules (if not already existing)
- [ ] MCP server wrapping those APIs with proper tool descriptions and schemas
- [ ] Multi-tenant authentication and data scoping
- [ ] AgentC2 integration configuration (add Appello as an MCP server option)
- [ ] Test with Appello's own data (eat your own cooking)
- [ ] Document all tools with descriptions, parameters, and example outputs

**Build vs. Buy Decision:**

Building the MCP server is unavoidable — nobody else can build it because nobody else has access to Appello's API. This is the moat. Once built, every competitor would need to reverse-engineer Appello's data model to replicate this. They can't.

---

### Phase 2: Bundle "Appello Intelligence" — Sell to Existing 20 Customers

**Timeline:** May-July 2026 (12 weeks)
**Revenue Target:** $60-150K incremental ARR from existing base
**Sales Cycle:** 1-2 weeks (these people already trust you and pay you monthly)

**The product: "Appello Intelligence powered by AgentC2"**

This is NOT positioned as "buy a separate AI platform." It's positioned as a **premium tier of Appello** — the AI layer on top of the software they already use every day.

**Packaging:**

| Tier                                | Price         | What They Get                                                                                                |
| ----------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------ |
| **Appello Intelligence Starter**    | +$250/month   | 3 pre-built recipes (Morning Dispatch, Timesheet Compliance, Job Profitability Alert) + Slack/Email delivery |
| **Appello Intelligence Pro**        | +$500/month   | All 10 core recipes + daily briefings + safety analytics + custom Slack bot                                  |
| **Appello Intelligence Enterprise** | +$1,000/month | Full recipe library (30+) + custom recipes + voice agent + Canvas dashboards + priority support              |

**Why this pricing works:**

- Starter at $250/month = $3,000/year — 20% of their average $15K Appello ARR (easy expansion)
- Pro at $500/month = $6,000/year — still less than a part-time admin hire
- Enterprise at $1,000/month = $12,000/year — for Thomas Kanata-sized orgs, this is a rounding error
- **At 20 customers × average $500/month = $120K incremental ARR = 30% boost on current base**

**The 10 Core Recipes for Construction (MVP):**

These are the recipes with the highest immediate value, derived from the 50 workflows document, prioritized by pain point severity and implementation simplicity (read-only first):

| #   | Recipe                              | Pain Point                                                    | Value Metric                     | Appello + ?             |
| --- | ----------------------------------- | ------------------------------------------------------------- | -------------------------------- | ----------------------- |
| 1   | **Morning Dispatch Intelligence**   | "I spend an hour every morning figuring out today's problems" | 30-60 min saved daily            | Appello + Slack/Email   |
| 2   | **Timesheet Compliance Monitor**    | "Monday payroll is a nightmare of chasing missing timesheets" | 3-4 hrs saved weekly             | Appello + Slack/Email   |
| 3   | **Job Profitability Early Warning** | "We found out the job lost money after it was done"           | Catch overruns 2-4 weeks earlier | Appello + Slack/Email   |
| 4   | **Safety Form Trend Analyzer**      | "I review hundreds of JHAs but can't see patterns"            | 2-3 hrs saved weekly             | Appello + Slack/Email   |
| 5   | **Certification Expiry Countdown**  | "A worker showed up to site with expired WHMIS"               | Zero compliance gaps             | Appello + Email         |
| 6   | **Equipment Inspection Compliance** | "We got flagged for an overdue crane inspection"              | 100% inspection compliance       | Appello + Slack/Email   |
| 7   | **Progress Billing Accelerator**    | "End-of-month billing takes 2 days"                           | 70% reduction in billing prep    | Appello                 |
| 8   | **Executive Dashboard Narrator**    | "I don't know how the business is doing until month-end"      | Weekly business intelligence     | Appello + Email         |
| 9   | **Overtime Prevention Alert**       | "We didn't realize we were racking up OT until payroll"       | 15-30% OT reduction              | Appello + Slack         |
| 10  | **Estimate Follow-Up Sequencer**    | "We forget to follow up on quotes"                            | 2x estimate conversion           | Appello + Gmail/Outlook |

**Sales motion for existing customers:**

1. **Onboarding call or regular check-in** (already happening weekly for many customers)
2. Show the Morning Dispatch Intelligence output: "This is what your dispatch could look like every morning at 5 AM, automatically"
3. Show their own data: "Your Vanos team had 4 missing timesheets last Monday. This agent would have caught them at 6 AM"
4. Offer 30-day free trial of Starter tier
5. Close on Starter, upsell to Pro within 60 days

**Why this sells:**

- Zero cold outreach — these are warm relationships
- The demo uses THEIR data, not hypothetical scenarios
- The value is immediate and measurable (hours saved, money recovered)
- The buyer (owner/ops manager) is the same person who bought Appello
- Zero churn on base product = extreme trust
- Price is trivial relative to the cost of one payroll mistake or one missed billing cycle

**Phase 2 Deliverables:**

- [ ] 10 core recipes built and tested on Appello's own instance
- [ ] Pricing page / sales deck for Appello Intelligence
- [ ] Trial onboarding flow (connect Appello MCP, select recipes, choose delivery channel)
- [ ] Customer-specific demo capability (show their data in the recipe output)
- [ ] Billing integration (add to existing Appello subscription)
- [ ] 5 customer pilots running by end of month 1
- [ ] 15+ customers on paid tier by end of month 3

---

### Phase 3: Expand to 35 Construction Companies

**Timeline:** August-December 2026 (20 weeks)
**Revenue Target:** $200-500K new ARR (Appello + AgentC2 bundled)
**Sales Cycle:** 30-90 days (standard Appello sales cycle)

**The pitch changes: "Appello + AI" is now the product**

For new customers, AgentC2/Intelligence isn't an upsell — it's part of the core value proposition. The landing page, the demos, the case studies all lead with "the AI-powered construction platform."

**Why 35 companies is achievable:**

| Driver                                                       | Math                               |
| ------------------------------------------------------------ | ---------------------------------- |
| Current close rate                                           | 17% of demos convert               |
| Current demo volume                                          | ~5/week                            |
| Needed demos for 35 closes                                   | ~206 demos (at 17%)                |
| Timeline                                                     | 20 weeks = 10/week needed          |
| With AI-enhanced sales (SDR agent, demo prep agent)          | 2x current volume = 10/week        |
| With AI-enhanced close rate (better demos, faster follow-up) | 20-25% close rate                  |
| **Result**                                                   | 200 demos × 20% = 40 new customers |

**The expanded recipe set for new customers:**

New customers get Appello + Intelligence as a bundle. The recipes now include external tools because new customers are also connecting their broader tool stack:

| Recipe                               | Appello +             | New Customer Value                            |
| ------------------------------------ | --------------------- | --------------------------------------------- |
| All 10 core recipes                  | Slack/Email           | Same as existing customers                    |
| **QuickBooks Sync Monitor**          | QuickBooks            | "Never miss a sync error again"               |
| **Inbox Zero for PMs**               | Gmail/Outlook         | "Process 50 emails in 10 minutes"             |
| **Meeting Action Item Tracker**      | Fathom + Appello      | "Every meeting creates tasks automatically"   |
| **Weather-Driven Schedule Adjuster** | Weather API + Appello | "Tomorrow's rain is already in your schedule" |
| **Prevailing Wage Auditor**          | Appello + payroll     | "Certified payroll in minutes, not days"      |

**New customer acquisition channels:**

| Channel                                           | Approach                                                          | Expected Yield        |
| ------------------------------------------------- | ----------------------------------------------------------------- | --------------------- |
| **Existing customer referrals**                   | Every happy Intelligence customer refers 1-2 peers                | 5-10 referrals        |
| **Industry conferences** (TIAC, BCICA, NIA)       | Demo Appello Intelligence live on stage                           | 10-15 leads per event |
| **Cold outreach** (Flight House + SDR Agent)      | AI-researched, personalized outreach to ICI contractors           | 5-10 demos/week       |
| **SEO / Super Directory**                         | 40,000 indexed pages + AI landing pages per trade                 | Compounding inbound   |
| **Case studies from Phase 2**                     | "Vanos Insulations saves 15 hours/week with Appello Intelligence" | Social proof          |
| **Appello Connect** (existing customer community) | Intelligence users share wins, non-users see FOMO                 | Organic adoption      |

**Phase 3 Deliverables:**

- [ ] Updated Appello website with Intelligence positioning
- [ ] 3+ customer case studies with before/after metrics
- [ ] Conference demo kit (live Intelligence demo on stage)
- [ ] SDR Agent handling prospect research and outreach
- [ ] Demo Prep Agent briefing Nathan/Corey before every call
- [ ] Appello + Intelligence bundled pricing
- [ ] 35 new customers closed by end of 2026

---

### Phase 4: Launch AgentC2 Publicly

**Timeline:** January-June 2027
**Revenue Target:** $500K-1M AgentC2 platform ARR (separate from Appello)
**Market Position:** "The AI agent platform that's already proven in construction — now for every industry"

**Why construction-first gives you a public launch advantage:**

| Competitor          | Approach                             | AgentC2 Advantage                                     |
| ------------------- | ------------------------------------ | ----------------------------------------------------- |
| **OpenAI AgentKit** | Generic, horizontal, developer-first | AgentC2 has vertical proof points with real ROI data  |
| **Druid AI**        | Enterprise-first, long sales cycles  | AgentC2 has SMB motion with self-serve potential      |
| **Zapier AI**       | Automation-first, not agent-first    | AgentC2 has true multi-agent orchestration            |
| **n8n**             | Developer-first, open source         | AgentC2 is turnkey with pre-built recipes             |
| **Relevance AI**    | Horizontal, template-based           | AgentC2 has deep vertical expertise and MCP ecosystem |

**The public launch recipe library (from the recipe strategy document):**

The construction recipes become the **"Construction" vertical** in a broader recipe marketplace. The landing page recipe discovery engine now has multiple verticals:

| Vertical                  | Recipes Available                                                 | Source                  |
| ------------------------- | ----------------------------------------------------------------- | ----------------------- |
| **Construction** (proven) | 30+ recipes                                                       | Phase 2-3 battle-tested |
| **Sales**                 | 3 recipes (Deal Copilot, Pipeline Intel, Outbound Researcher)     | Recipe strategy doc     |
| **Marketing**             | 3 recipes (Content Engine, Campaign Commander, Competitive Intel) | Recipe strategy doc     |
| **Customer Support**      | 3 recipes (Ticket Triager, Knowledge Concierge, Health Monitor)   | Recipe strategy doc     |
| **Engineering**           | 3 recipes (Bug Bouncer, Release Radar, Sprint Copilot)            | Recipe strategy doc     |
| **Operations**            | 3 recipes (Meeting Memory, Inbox Zero, Cross-Tool Sync)           | Recipe strategy doc     |
| **Executive**             | 2 recipes (Daily Briefing, Board Deck Builder)                    | Recipe strategy doc     |
| **E-commerce**            | 2 recipes (Order Intelligence, Revenue Pulse)                     | Recipe strategy doc     |
| **Voice**                 | 2 recipes (Voice Receptionist, Voice Survey Agent)                | Recipe strategy doc     |

**Landing page architecture (recipe discovery engine):**

```
Hero: "AI agents that actually work — proven in construction, built for every business"
         ↓
Tool Selector: "What tools does your team use?"
[Appello] [HubSpot] [Jira] [Gmail] [Slack] [Shopify] [Intercom] ...
         ↓
Role Selector: "What's your role?"
[Operations] [Sales] [Support] [Engineering] [Executive] [Owner]
         ↓
Personalized Recipe Gallery: "Here's what AgentC2 can do for you"
→ Each recipe shows: platforms, value metric, "Deploy in 5 minutes"
         ↓
Social Proof: "55+ construction companies run on AgentC2"
+ Specific metrics from real customers
         ↓
Pricing: Free tier (1 agent, 100 runs) → Pro ($49) → Team ($29/user)
         ↓
CTA: "Start with a recipe. Scale to your whole business."
```

**Public launch pricing (revised for broader market):**

| Tier                | Price             | Target                     | Wedge                                                      |
| ------------------- | ----------------- | -------------------------- | ---------------------------------------------------------- |
| **Free**            | $0/month          | Solopreneurs, tire kickers | 1 agent, 1 recipe, 100 runs                                |
| **Starter**         | $29/month         | Small teams                | 3 agents, 5 recipes, 1,000 runs                            |
| **Pro**             | $99/month         | Growing businesses         | Unlimited agents, all recipes, 10,000 runs                 |
| **Team**            | $29/user/month    | Departments                | Everything in Pro + RBAC + shared library                  |
| **Enterprise**      | Custom            | Large orgs                 | SSO, custom MCP, dedicated infra, SLA                      |
| **Vertical Bundle** | +$250-1,000/month | Industry-specific          | Vertical MCP + curated recipes (like Appello Intelligence) |

**Phase 4 Deliverables:**

- [ ] Public landing page with recipe discovery engine
- [ ] Free tier with self-serve signup
- [ ] Recipe marketplace (browseable without signup)
- [ ] 5+ vertical bundles (Construction first, then...)
- [ ] Content marketing engine (blog, case studies, comparisons)
- [ ] Product Hunt launch
- [ ] Developer documentation for custom MCP servers

---

### Phase 5: Horizontal Expansion — Next Verticals

**Timeline:** H2 2027+
**Model:** Replicate the Appello playbook in adjacent verticals

**Vertical selection criteria:**

| Criterion                 | Why It Matters                       | Scoring                                  |
| ------------------------- | ------------------------------------ | ---------------------------------------- |
| **Existing MCP coverage** | Can we connect to their tools today? | High = 3+ integrations already built     |
| **Pain point severity**   | Are they in enough pain to pay?      | High = daily operational friction        |
| **Willingness to pay**    | Do they buy software?                | High = existing SaaS adoption            |
| **Market size**           | Is it big enough?                    | High = 10,000+ businesses                |
| **Competition**           | Is anyone else doing this?           | Low = blue ocean                         |
| **Network effects**       | Do they refer each other?            | High = industry associations/communities |

**Ranked vertical opportunities:**

| Rank | Vertical                                                    | Why                                                                                                             | Entry Strategy                                                             |
| ---- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1    | **Property Management**                                     | Gmail + Calendar + Slack + accounting = exact same stack. High operational pain, willing SaaS buyers.           | Partner with property management SaaS (AppFolio, Buildium) or build PM MCP |
| 2    | **Professional Services** (Accounting, Legal, Consulting)   | Email-heavy, meeting-heavy, billing-heavy. Voice Receptionist recipe is a killer app.                           | Voice Receptionist + Inbox Zero + Meeting Memory recipes                   |
| 3    | **Healthcare Clinics**                                      | Scheduling + compliance + billing = construction-adjacent patterns. Voice Receptionist for appointment booking. | Partner with EHR/practice management SaaS                                  |
| 4    | **Real Estate**                                             | CRM-heavy, calendar-heavy, follow-up-heavy. Deal Copilot recipe translates directly.                            | HubSpot/Salesforce + Gmail + Calendar recipes                              |
| 5    | **E-commerce / DTC**                                        | Shopify + Stripe + Intercom = well-covered stack. Order Intelligence + Revenue Pulse recipes.                   | Shopify app store listing                                                  |
| 6    | **Agencies** (Marketing, Creative, Dev)                     | Jira/Linear + Slack + GitHub + Figma = all built. Sprint Copilot + Design-to-Dev Pipeline.                      | Agency community marketing                                                 |
| 7    | **Field Services** (HVAC residential, plumbing, electrical) | Extremely similar to construction ICP but residential. ServiceTitan/Housecall Pro adjacent.                     | Appello lite or partner MCP                                                |

**The playbook for each new vertical:**

1. **Find the vertical SaaS** (the Appello equivalent in that industry)
2. **Build/partner on the MCP** (connect their data to AgentC2)
3. **Create 10 vertical recipes** (using the same patterns: Monitor → Alert → Act → Report)
4. **Pilot with 5 companies** in that vertical
5. **Document results** (time saved, money recovered, errors prevented)
6. **Launch the vertical bundle** on the public platform
7. **Market through the vertical's community** (associations, conferences, forums)

---

## Part 3: Revenue Model and Projections

### 3.1 Revenue Streams

| Stream                    | Description                                 | Margin                      |
| ------------------------- | ------------------------------------------- | --------------------------- |
| **Appello Intelligence**  | AI tier bundled with Appello subscriptions  | ~90% (AI costs are minimal) |
| **AgentC2 Platform SaaS** | Standalone agent platform subscriptions     | ~85%                        |
| **Vertical Bundles**      | Industry-specific MCP + recipes packages    | ~85%                        |
| **MCP Marketplace**       | Revenue share from third-party MCP servers  | ~30% (marketplace cut)      |
| **Professional Services** | Custom recipe/agent building for enterprise | ~60%                        |

### 3.2 Revenue Projections

| Period                  | Appello Intelligence           | AgentC2 Platform      | Total New ARR | Cumulative |
| ----------------------- | ------------------------------ | --------------------- | ------------- | ---------- |
| **Q2 2026** (Phase 1-2) | $30K (5 pilots × $500/mo)      | $0                    | $30K          | $30K       |
| **Q3 2026** (Phase 2)   | $90K (15 customers × $500/mo)  | $0                    | $60K          | $90K       |
| **Q4 2026** (Phase 3)   | $150K (25 customers × $500/mo) | $0                    | $60K          | $150K      |
| **Q1 2027** (Phase 3-4) | $210K (35 customers × $500/mo) | $50K (early public)   | $110K         | $260K      |
| **Q2 2027** (Phase 4)   | $210K (stable)                 | $200K (public growth) | $150K         | $410K      |
| **Q3 2027** (Phase 4-5) | $250K (upsells)                | $400K (scaling)       | $240K         | $650K      |
| **Q4 2027** (Phase 5)   | $300K (new verticals)          | $700K (compounding)   | $350K         | $1M        |

**Key assumption:** Appello Intelligence revenue is incremental to Appello's core SaaS revenue. If Appello reaches its $1M ARR target by October 2026, Appello Intelligence could represent an additional 15-30% ($150-300K) on top.

### 3.3 Unit Economics

| Metric           | Appello Intelligence                                    | AgentC2 Platform                              |
| ---------------- | ------------------------------------------------------- | --------------------------------------------- |
| **CAC**          | ~$0 (existing relationships) → ~$500 (new via referral) | ~$200 (self-serve) → ~$2,000 (sales-assisted) |
| **ARPU**         | $500/month ($6,000/year)                                | $50-100/month ($600-1,200/year)               |
| **LTV**          | $30,000+ (zero churn × 5 years)                         | $3,000-6,000 (assuming 80% retention)         |
| **LTV:CAC**      | 60:1 (existing) → 60:1 (referral)                       | 15:1 (self-serve) → 3:1 (sales-assisted)      |
| **Payback**      | Immediate (existing) → 1 month (referral)               | 2-4 months (self-serve)                       |
| **Gross Margin** | ~90%                                                    | ~85%                                          |

**The Appello Intelligence LTV:CAC is extraordinary** because the acquisition cost is near-zero for existing customers. This is the advantage of the wedge strategy.

---

## Part 4: Competitive Positioning

### 4.1 Market Map

```
                    ENTERPRISE ←————————————→ SMB
                         |                     |
HORIZONTAL    OpenAI AgentKit          Zapier AI
(generic)     Druid AI                 Relevance AI
              Microsoft Copilot        n8n + AI
              Salesforce AgentForce
                         |                     |
                         |    ★ AgentC2 ★      |
                         |   (vertical-first,  |
                         |    SMB wedge,        |
                         |    expanding up)     |
                         |                     |
VERTICAL      Palantir AIP            ServiceTitan AI
(industry)    C3.ai                   Procore AI
              (enterprise only)       (not agent-native)
                         |                     |
```

### 4.2 Defensibility Moat

| Moat Layer                    | What It Is                                                                             | How Deep                  |
| ----------------------------- | -------------------------------------------------------------------------------------- | ------------------------- |
| **Vertical MCP ecosystem**    | Appello MCP is proprietary — competitors can't replicate without Appello's cooperation | Very deep                 |
| **Customer data flywheel**    | 35+ construction companies' operational data improves recipe accuracy over time        | Deepening                 |
| **Recipe library**            | 50+ construction workflows, battle-tested with real customers                          | Deep, growing             |
| **Integration breadth**       | 30+ MCP servers already built (HubSpot, Jira, Slack, etc.)                             | Medium (others can build) |
| **Multi-agent orchestration** | Networks + Workflows + Skills + Campaigns = unique orchestration layer                 | Deep (hard to replicate)  |
| **Vertical expertise**        | Understanding construction operations at the module level                              | Very deep                 |

### 4.3 Positioning Statement

**For Construction (Appello Intelligence):**

> "Appello Intelligence is the AI layer that turns your Appello data into daily operational insights — automatically. Know which jobs are losing money, which crews are missing timesheets, and which certifications are expiring, before your morning coffee."

**For Public Platform (AgentC2):**

> "AgentC2 is the AI agent platform that connects your existing tools and deploys pre-built automation recipes in minutes. Proven in construction with 35+ companies, built for every business that runs on email, CRM, and Slack."

---

## Part 5: Go-to-Market Execution Plan

### 5.1 Month-by-Month Execution (Next 12 Months)

#### March 2026: Foundation

| Action                                                 | Owner        | Outcome                           |
| ------------------------------------------------------ | ------------ | --------------------------------- |
| Begin Appello MCP server development (read-only tools) | Engineering  | MCP spec + first 20 tools         |
| Document internal AgentC2 usage metrics                | Corey        | "We saved X hours/week" narrative |
| Design Appello Intelligence pricing + packaging        | Corey/Ian    | Pricing page ready                |
| Identify 5 pilot customers (from existing base)        | Corey/Nathan | Pilot list confirmed              |

#### April 2026: MCP Completion + Pilot Prep

| Action                                                                          | Owner        | Outcome                       |
| ------------------------------------------------------------------------------- | ------------ | ----------------------------- |
| Complete Appello MCP server (all read tools)                                    | Engineering  | 70+ tools functional          |
| Build 3 MVP recipes (Morning Dispatch, Timesheet Compliance, Job Profitability) | AgentC2      | 3 recipes working end-to-end  |
| Set up delivery channels (Slack bot, email templates)                           | AgentC2      | Delivery infrastructure ready |
| Pre-sell to 5 pilot customers during regular check-ins                          | Corey/Nathan | 5 verbal commitments          |

#### May 2026: Pilot Launch

| Action                                            | Owner               | Outcome                          |
| ------------------------------------------------- | ------------------- | -------------------------------- |
| Connect 5 pilot customers to Appello Intelligence | Corey + Engineering | 5 live pilots                    |
| Daily monitoring of recipe output quality         | AgentC2             | Issue tracking, quality baseline |
| Weekly check-in with each pilot customer          | Corey/Nathan        | Feedback loop established        |
| Begin building recipes 4-10                       | AgentC2             | 10 recipes by month end          |
| Collect "before/after" data from pilots           | Corey               | Case study data gathering        |

#### June 2026: Pilot → Paid

| Action                                                         | Owner        | Outcome              |
| -------------------------------------------------------------- | ------------ | -------------------- |
| Convert 5 pilots to paid ($500/month each)                     | Corey/Nathan | $30K ARR added       |
| Roll out to next 5 customers (existing base)                   | Corey/Nathan | 10 total customers   |
| Write first case study (Vanos Insulations)                     | Marketing    | Published case study |
| Begin write-capable MCP tools (create notes, update schedules) | Engineering  | Phase 2 MCP tools    |
| Start Appello website update with Intelligence positioning     | Marketing    | Website mockup       |

#### July 2026: Scale Existing Base

| Action                                              | Owner        | Outcome                      |
| --------------------------------------------------- | ------------ | ---------------------------- |
| Roll out to remaining 10 existing customers         | Corey/Nathan | 20 customers on Intelligence |
| Launch Pro tier ($500) and Enterprise tier ($1,000) | Product      | Tiered pricing live          |
| Deploy SDR Agent for new customer acquisition       | AgentC2      | Automated prospect research  |
| Deploy Demo Prep Agent for sales team               | AgentC2      | Every demo has AI briefing   |
| Write 2 more case studies                           | Marketing    | 3 total case studies         |

#### August-October 2026: New Customer Acquisition

| Action                                                                  | Owner              | Outcome                     |
| ----------------------------------------------------------------------- | ------------------ | --------------------------- |
| Begin selling Appello + Intelligence as a bundle to new customers       | Sales              | 10-15 new customers         |
| Present at TIAC or equivalent industry conference                       | Corey              | Live demo on stage          |
| Launch customer referral program (Intelligence free month for referrer) | Sales/Marketing    | Referral pipeline           |
| Deploy Content Engine for construction-specific blog posts              | AgentC2            | Inbound content pipeline    |
| Begin building public AgentC2 landing page                              | Engineering/Design | Landing page in development |

#### November-December 2026: 35 Customer Target + Public Prep

| Action                                                       | Owner       | Outcome                   |
| ------------------------------------------------------------ | ----------- | ------------------------- |
| Close remaining customers to hit 35 total Intelligence users | Sales       | 35 customers achieved     |
| Document comprehensive ROI data across all customers         | Marketing   | ROI database              |
| Build recipe marketplace UI                                  | Engineering | Browseable recipe gallery |
| Build self-serve signup + free tier                          | Engineering | Self-serve onboarding     |
| Soft-launch public beta with select non-construction users   | Marketing   | Beta feedback             |

#### January-March 2027: Public Launch

| Action                                                             | Owner        | Outcome                  |
| ------------------------------------------------------------------ | ------------ | ------------------------ |
| Product Hunt launch                                                | Marketing    | Public awareness         |
| Content marketing campaign (construction case studies as proof)    | Marketing    | Inbound pipeline         |
| Begin next vertical (Professional Services or Property Management) | Business Dev | Vertical 2 in pilot      |
| Paid ads targeting HubSpot/Slack/Jira users                        | Marketing    | Paid acquisition channel |
| Developer documentation for custom MCP servers                     | Engineering  | Platform ecosystem       |

### 5.2 Sales Playbook

**For Existing Appello Customers (Phase 2):**

```
Trigger: Regular check-in call or onboarding session

Script:
"Hey [Name], quick question — how much time does [your dispatcher/payroll person/
safety manager] spend on [specific pain point we know they have from Jira tickets]?

We've been building something internally called Appello Intelligence — it's an AI
layer on top of your Appello data. It runs every morning at 5 AM and tells you:
- Which crews have scheduling conflicts today
- Who's missing timesheets from yesterday
- Which jobs are trending over budget

Want me to show you what it looks like with YOUR data? We can have it running in
a week, and the first month is free."
```

**For New Customers (Phase 3):**

```
Trigger: Demo request or outbound qualification

Script:
"What if your dispatch intelligence was ready before you got to the office?

Appello is the platform that replaces your spreadsheets and paper timesheets.
Appello Intelligence is the AI that makes it smart.

55 contractors across North America use it. Here's what [Vanos/Thermec/R.A. Barnes]
sees every morning at 5 AM..."

→ Show case study output
→ Show their competitor (if applicable) is using it
→ Offer free 30-day trial with onboarding
```

**For Public Platform (Phase 4):**

```
Landing page → Recipe gallery → "Try this recipe" →
→ OAuth connect (1-click) → Recipe running in 5 minutes →
→ Value delivered on Day 1 → Upgrade prompt at run limit
```

### 5.3 Marketing Channels

| Channel                                      | Phase | Investment                  | Expected CAC           |
| -------------------------------------------- | ----- | --------------------------- | ---------------------- |
| **Existing customer check-ins**              | 2     | $0 (already happening)      | $0                     |
| **Customer referrals**                       | 2-3   | $500 (free month incentive) | $500                   |
| **Industry conferences**                     | 3     | $5-10K per event            | $500-1,000             |
| **Cold outreach (SDR Agent + Flight House)** | 3     | $2-5K/month                 | $1,000-2,000           |
| **SEO / Super Directory**                    | 3-4   | Already invested            | $100-500 (compounding) |
| **Content marketing (AI-generated)**         | 3-5   | ~$100/month (AI costs)      | $200-500               |
| **Product Hunt**                             | 4     | $0                          | $50-200                |
| **Paid search (Google Ads)**                 | 4-5   | $5-15K/month                | $200-500               |
| **Paid social (LinkedIn)**                   | 4-5   | $3-10K/month                | $300-800               |
| **Developer community**                      | 4-5   | Content + docs              | $100-300               |
| **Partner channel (vertical SaaS)**          | 5     | Revenue share               | $0 (rev share)         |

---

## Part 6: Risk Assessment

| Risk                                                    | Probability | Impact                   | Mitigation                                                                                       |
| ------------------------------------------------------- | ----------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| **Appello MCP takes longer than 8 weeks**               | Medium      | High (delays everything) | Start with 20 most critical tools, not all 70-85. Ship iteratively.                              |
| **Pilot customers don't see value**                     | Low         | High                     | Pick customers with the most Jira tickets (most pain). Vanos and Rival are ideal pilots.         |
| **AI hallucination in operational context**             | Medium      | High                     | Read-only recipes first. No write operations without human approval. Guardrails on every recipe. |
| **Construction companies resistant to AI**              | Medium      | Medium                   | Position as "Appello got smarter" not "AI agent platform." They trust Appello, not AI buzzwords. |
| **Competitors build construction MCP**                  | Very Low    | Medium                   | They'd need Appello's cooperation (you own the API) and construction domain expertise.           |
| **Public launch dilutes focus from construction**       | Medium      | Medium                   | Dedicated team for each. Construction team stays focused. Public team builds generic recipes.    |
| **Pricing too high for small contractors**              | Low         | Medium                   | Starter at $250/month is less than one wrong payroll run costs them. Free trial de-risks.        |
| **Engineering bandwidth constraint (Filip bottleneck)** | High        | High                     | MCP server can be built by Travis or contractor. Recipes are configuration, not code.            |
| **Market timing (AI fatigue)**                          | Low         | Medium                   | Vertical proof points cut through the noise. "Works in construction" > "works in theory."        |

---

## Part 7: Key Decisions Needed

### 7.1 Immediate Decisions

| Decision                                        | Options                                    | Recommendation                                                     | Why                                                                                                |
| ----------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **Who builds the Appello MCP?**                 | Filip, Travis, contractor, or new hire     | Travis or contractor                                               | Filip is too bottlenecked. Travis knows the API from QuickBooks integration work.                  |
| **Which 5 customers pilot first?**              | Choose from 20 existing                    | Vanos, Thermec, R.A. Barnes, All Temp, Headrick                    | Highest engagement, most tickets (= most pain), best relationships                                 |
| **How is Intelligence priced?**                 | Bundled with Appello vs. separate platform | Bundled (Appello Intelligence tier)                                | Reduces friction, leverages existing billing, positions as product evolution not separate purchase |
| **Brand: "Appello Intelligence" or "AgentC2"?** | Same brand vs. separate                    | Appello Intelligence for construction, AgentC2 for public platform | Construction customers trust Appello. Public market needs a distinct platform brand.               |
| **Free tier on public launch?**                 | Yes vs. trial-only                         | Yes (1 agent, 100 runs)                                            | Self-serve adoption requires a zero-friction entry point. Free users → paid conversion at ~5-10%.  |

### 7.2 Strategic Decisions (Next 6 Months)

| Decision                                      | Options                                                      | Framework                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **When to hire dedicated AgentC2 team?**      | Now, at 20 customers, at public launch                       | At 20 construction customers (validation), minimum: 1 PM + 1 engineer                        |
| **Should AgentC2 be a separate company?**     | Division of Appello vs. separate entity                      | Separate entity at public launch (cleaner fundraising, distinct positioning)                 |
| **Which vertical is #2?**                     | Property Management, Professional Services, Healthcare, etc. | Property Management (closest to construction DNA, similar operational patterns)              |
| **Should we raise for AgentC2 specifically?** | Bootstrap vs. raise                                          | Bootstrap to 35 customers (proof), then raise with traction data                             |
| **Open source any components?**               | MCP tools, recipe framework, etc.                            | Open source the recipe framework + MCP spec (ecosystem play), keep orchestration proprietary |

---

## Part 8: Success Metrics

### Phase 2 Success (May-July 2026)

| Metric                                | Target | Red Flag |
| ------------------------------------- | ------ | -------- |
| Pilot customers activated             | 5      | <3       |
| Pilot-to-paid conversion              | 80%+   | <60%     |
| Average hours saved/week per customer | 5+     | <2       |
| Customer NPS for Intelligence tier    | 70+    | <50      |
| Recipe accuracy (no false alerts)     | 95%+   | <85%     |

### Phase 3 Success (August-December 2026)

| Metric                                                        | Target | Red Flag |
| ------------------------------------------------------------- | ------ | -------- |
| Total Intelligence customers                                  | 35     | <20      |
| Intelligence ARR                                              | $200K+ | <$100K   |
| New customer attach rate (% buying Intelligence with Appello) | 60%+   | <30%     |
| Customer referrals generated                                  | 10+    | <3       |
| Case studies published                                        | 5+     | <2       |

### Phase 4 Success (January-June 2027)

| Metric                     | Target | Red Flag |
| -------------------------- | ------ | -------- |
| Public signups (free)      | 500+   | <100     |
| Free-to-paid conversion    | 5%+    | <2%      |
| Non-construction customers | 50+    | <10      |
| AgentC2 platform ARR       | $200K+ | <$50K    |
| Recipe library size        | 50+    | <25      |

---

## Summary: The One-Page GTM

```
THE WEDGE
═════════
Appello's 20 customers (zero churn, $15K avg ARR, weekly relationships)
         ↓
BUILD THE BRIDGE
════════════════
Appello MCP Server (70+ tools exposing 12 modules)
         ↓
SELL THE INTELLIGENCE
════════════════════
"Appello Intelligence" — AI tier at $250-1,000/month
5 pilots → 20 existing customers → $120K incremental ARR
         ↓
EXPAND THE BASE
═══════════════
35 construction companies — Appello + Intelligence as bundled product
New customer acquisition via referrals, conferences, outbound
         ↓
GO PUBLIC
════════
AgentC2 platform — recipe discovery engine
"Proven in construction, built for every business"
Free tier → self-serve → paid → team → enterprise
         ↓
GO HORIZONTAL
════════════
Replicate the playbook: Find vertical SaaS → Build MCP → Create recipes → Pilot → Scale
Property Management → Professional Services → Healthcare → E-commerce → ...
```

**The unfair advantage:** Every other AI agent platform starts at zero with generic demos and hypothetical ROI. AgentC2 starts with 35 paying customers, documented time savings, real case studies, and a proprietary MCP that competitors literally cannot replicate without your cooperation.

**The math that matters:**

- $0 CAC on first 20 customers (they already pay you)
- 60:1 LTV:CAC on construction vertical
- $275/month AI costs to deliver $500-1,000/month in customer value
- Zero churn baseline (Appello has never lost a customer)
- Every construction customer becomes a case study for the public launch

**The first dollar of AgentC2 revenue is 8 weeks away.**

---

## ADDENDUM: ACCELERATED TIMELINE (v2)

### Why the Original Plan Is Too Slow

The original plan is sequential: build MCP → pilot construction → expand construction → THEN launch publicly. That's a 12-month runway to public launch. The market won't wait.

**What's happening right now (February 2026):**

- OpenAI shipped AgentKit with visual + code builders, pre-built tools, and ChatKit deployment
- Salesforce AgentForce is being pushed to every enterprise CRM customer
- Microsoft Copilot Studio has 30,000+ organizations building agents
- Zapier AI agents are live with 8,000+ app connections
- Relevance AI, CrewAI, LangGraph, AutoGen — all shipping fast
- Every week a new Y Combinator startup launches in this space

**By December 2026:** The horizontal AI agent platform market will have 3-5 dominant players. The window to establish position isn't 12 months. It's 6.

**The critical insight the original plan missed:** AgentC2 already has 30+ MCP integrations BUILT. The public platform can launch with generic recipes (Deal Copilot, Inbox Zero, Bug Bouncer, etc.) using HubSpot, Gmail, Slack, Jira, GitHub, Intercom, Stripe, Shopify — all of which are already connected. The Appello MCP is only needed for the construction vertical. The public platform has zero dependency on it.

---

### The Accelerated Model: Two Parallel Tracks

```
                    FEBRUARY          MARCH             APRIL              MAY               JUNE              JULY+
                    ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
TRACK A             │ MCP spec │─────▶│ MCP build │─────▶│ 5 pilots │─────▶│ 15 custs │─────▶│ 20 custs │─────▶│ 35 custs │
(Construction)      │ + design │      │ 20 tools  │      │ live     │      │ + cases  │      │ new acq  │      │ + scale  │
                    └──────────┘      └──────────┘      └──────────┘      └──────────┘      └──────────┘      └──────────┘

                    ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
TRACK B             │ Recipe   │─────▶│ Landing   │─────▶│ Free tier│─────▶│ PH launch│─────▶│ Paid ads │─────▶│ 500+     │
(Public Platform)   │ data mdl │      │ page live │      │ + signup │      │ + content│      │ + growth │      │ users    │
                    └──────────┘      └──────────┘      └──────────┘      └──────────┘      └──────────┘      └──────────┘
```

---

### Track A: Construction Vertical (Appello Intelligence)

**The compression:** 8-week MCP build becomes 4-week MVP. 70-85 tools becomes 20 essential read-only tools. Five pilots start in April, not May. Existing customers convert in parallel, not after pilots complete.

#### Week 1-2 (Late Feb - Early Mar): MCP Spec + Skeleton

- Spec the 20 highest-value MCP tools (the ones needed for the top 5 recipes)
- Focus on: scheduling reads, timesheet queries, financial/job cost reads, safety form reads, certification queries
- Architect multi-tenant auth (one API key per Appello customer)
- Set up hosted MCP server skeleton at `mcp.useappello.com`

**Tools needed for MVP recipes:**

| Recipe                    | Required Tools                                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Morning Dispatch          | `scheduling-list-today`, `training-check-conflicts`, `timesheets-missing-yesterday`, `equipment-overdue-inspections`, `safety-flagged-submissions` |
| Timesheet Compliance      | `timesheets-list-by-period`, `timesheets-unapproved`, `hr-list-active-workers`, `scheduling-list-by-period`                                        |
| Job Profitability Warning | `financial-job-costs`, `financial-budget-vs-actual`, `financial-percent-complete`, `project-list-active`                                           |
| Safety Trend Analyzer     | `safety-list-submissions`, `safety-form-compliance-rate`                                                                                           |
| Certification Countdown   | `training-expiring-certs`, `scheduling-worker-assignments`                                                                                         |

**That's ~15-20 unique tools, not 85.**

#### Week 3-4 (Mid-Late Mar): MCP Live + First Recipe

- MCP server deployed with 20 tools
- Test against Appello's own instance
- First recipe (Morning Dispatch Intelligence) running end-to-end
- Output delivered via Slack/email

#### Week 5-6 (Early-Mid Apr): Five Pilots Connected

- Connect Vanos, Thermec, R.A. Barnes, All Temp, Headrick
- All 5 receiving Morning Dispatch + Timesheet Compliance daily
- Feedback loop: daily Slack check-in with each pilot
- Build remaining 3 recipes in parallel (Job Profitability, Safety Trends, Cert Countdown)

#### Week 7-10 (Late Apr - Mid May): Expand to 15

- Convert 10 more existing customers (Corey/Nathan mention it on regular check-ins)
- All 5 recipes operational
- First testimonial/quote captured from pilot customers
- Begin $250/month billing (or free for 30 days, paid month 2)

#### Week 11-16 (Late May - June): Full Base + New Acquisition

- All 20 existing customers on Appello Intelligence
- First case study published (Vanos: "We catch scheduling conflicts before our dispatchers get to the office")
- Begin selling Appello + Intelligence as bundled offering to new prospects
- SDR Agent (already available on AgentC2) handles prospect research
- Demo Prep Agent briefs Nathan before every call

#### Week 17-40 (July - December): Scale to 35+

- Conference season with live Intelligence demos
- Referral program active
- Write-capable MCP tools added (create notes, update schedules) for Phase 2 recipes
- Target: 35 Intelligence customers by December

---

### Track B: Public AgentC2 Platform (STARTS NOW)

**The key realization:** This track has ZERO dependency on the Appello MCP. It uses the 30+ MCP integrations that are already built and the 25 generic recipes from the recipe strategy document. This can start this week.

#### Week 1-2 (Late Feb - Early Mar): Recipe Data Model + Content

What to build:

- Recipe data model (TypeScript interface, stored as structured data)
- 8 priority recipes fully specified with copy, value metrics, platform logos, step flows
- Recipe card component and recipe detail page component
- Connect to existing landing page component library (shadcn, Tailwind)

The 8 launch recipes (using EXISTING integrations):

| #   | Recipe                 | Platforms (ALL ALREADY BUILT)                     | ICP           |
| --- | ---------------------- | ------------------------------------------------- | ------------- |
| 1   | **Deal Copilot**       | HubSpot + Gmail + Google Calendar + Slack         | Sales         |
| 2   | **Inbox Zero Agent**   | Gmail/Outlook + Google Calendar + Slack + HubSpot | Everyone      |
| 3   | **Ticket Triager**     | Intercom + Slack + Jira + RAG                     | Support       |
| 4   | **Bug Bouncer**        | GitHub + Sentry + Jira/Linear + Slack             | Engineering   |
| 5   | **Meeting Memory**     | Fathom + Slack + Google Calendar + Jira           | Operations    |
| 6   | **Daily Briefing**     | Gmail + Calendar + Slack + HubSpot + Jira         | Executive     |
| 7   | **Content Engine**     | Firecrawl + Google Drive + Slack                  | Marketing     |
| 8   | **Voice Receptionist** | ElevenLabs + Google Calendar + HubSpot            | Prof Services |

**None of these require the Appello MCP. All use integrations already built.**

#### Week 3-4 (Mid-Late Mar): Landing Page Live

- Recipe gallery page with filtering (by department, by platform)
- Individual recipe detail pages with step-by-step flow visualization
- Updated hero: tool selector + role selector → personalized recipes
- Integration bar updated with all 30+ platform logos
- "Coming soon: Construction recipes powered by Appello" teaser
- CTA: "Start Free" → signup flow

#### Week 5-6 (Early-Mid Apr): Free Tier + Self-Serve

- Free tier: 1 agent, 1 recipe, 100 runs/month
- OAuth connect flow for each platform (1-click)
- Recipe activation: pick a recipe → connect platforms → running in 5 minutes
- Basic onboarding: guided setup for first recipe
- Usage tracking and upgrade prompts

#### Week 7-8 (Late Apr - Early May): Product Hunt + Content Launch

- Product Hunt launch: "AgentC2 — AI agents that connect your existing tools. 30+ integrations, pre-built recipes, deploy in 5 minutes."
- Launch blog posts: "How we saved 15 hours/week with AI agents at our construction company" (dogfooding story)
- Social media push: LinkedIn (targeting VPs of Sales, Ops, Engineering), Twitter/X (dev community)
- Dev community seeding: Reddit, Hacker News, relevant Discord/Slack groups

#### Week 9-12 (May - June): Growth Engine

- Paid acquisition: Google Ads targeting "[platform] automation" keywords (e.g., "HubSpot AI automation", "Jira AI agent", "Slack AI bot")
- Platform-specific SEO landing pages: `/solutions/hubspot`, `/solutions/slack`, `/solutions/jira`, etc.
- Content marketing: 2 blog posts/week (AI-generated via Content Engine recipe — eat your own cooking)
- Email sequences for free users who haven't activated their first recipe
- Target: 200 free signups, 30+ paid conversions

#### Week 13-24 (July - September): Scale + Second Vertical

- Construction recipes added to public platform (Track A feeds Track B)
- Construction case studies published (real ROI data from Appello customers)
- Begin second vertical exploration (Property Management or Professional Services)
- Recipe marketplace: community-contributed recipes
- API/SDK for custom MCP server builders (ecosystem play)
- Target: 500+ free users, 100+ paid, $100K+ platform ARR run rate

#### Week 25-40 (October - December): Market Position

- 3+ verticals with recipes (Construction, PM/Professional Services, E-commerce)
- 1,000+ free users, 200+ paid
- $200K+ platform ARR
- Partner program: vertical SaaS companies build MCPs, AgentC2 distributes recipes
- Series A conversation starts (if desired) — with traction data, not a pitch deck

---

### What Changes from v1 to v2

| Dimension                   | v1 (Sequential)            | v2 (Parallel)                                                      |
| --------------------------- | -------------------------- | ------------------------------------------------------------------ |
| **Public launch**           | January 2027               | March 2026 (landing page), May 2026 (Product Hunt)                 |
| **First public revenue**    | Q1 2027                    | May 2026                                                           |
| **Time to 500 users**       | Q3 2027                    | September 2026                                                     |
| **Construction customers**  | Same timeline              | Same timeline (not compressed)                                     |
| **Appello MCP scope**       | 70-85 tools, 8 weeks       | 20 tools, 4 weeks (expand later)                                   |
| **Engineering allocation**  | 100% on construction first | 60% Track A (MCP + recipes), 40% Track B (landing page + platform) |
| **Market risk**             | High (late to market)      | Lower (early with proof points coming)                             |
| **Revenue diversification** | Single stream until 2027   | Two streams by May 2026                                            |

---

### Revised Revenue Projections

| Period       | Track A (Construction) | Track B (Public Platform) | Combined New ARR | Cumulative |
| ------------ | ---------------------- | ------------------------- | ---------------- | ---------- |
| **Mar 2026** | $0 (building)          | $0 (building)             | $0               | $0         |
| **Apr 2026** | $0 (pilots, free)      | $0 (free users)           | $0               | $0         |
| **May 2026** | $15K (5 × $250/mo)     | $3K (early paid)          | $18K             | $18K       |
| **Jun 2026** | $45K (15 × $250/mo)    | $10K (PH spike)           | $55K             | $73K       |
| **Jul 2026** | $90K (20 × $375 avg)   | $20K (growth)             | $110K            | $128K      |
| **Sep 2026** | $120K (25 × $400 avg)  | $50K (100 paid)           | $170K            | $243K      |
| **Dec 2026** | $210K (35 × $500 avg)  | $120K (200 paid)          | $330K            | $478K      |
| **Mar 2027** | $250K (40 × $520 avg)  | $250K (scaling)           | $500K            | $728K      |
| **Jun 2027** | $300K (upsells)        | $500K (compounding)       | $800K            | $1.03M     |

**$1M combined ARR by mid-2027 instead of late-2027.**

---

### What Needs to Happen This Week

| Action                                                                                    | Who                | Deadline |
| ----------------------------------------------------------------------------------------- | ------------------ | -------- |
| **Decide:** Track B engineering allocation (who builds landing page + recipe components?) | Corey              | Feb 19   |
| **Spec:** Recipe data model (TypeScript interface for recipe objects)                     | Engineering        | Feb 21   |
| **Spec:** Appello MCP — list the 20 MVP tools with API endpoint mappings                  | Travis/Engineering | Feb 21   |
| **Write:** 8 recipe detail pages (copy, value metrics, step flows, platform combos)       | Corey + AI         | Feb 23   |
| **Design:** Recipe card component + recipe gallery layout                                 | Design/Engineering | Feb 24   |
| **Build:** Recipe gallery page on `agentc2.ai` (static first, dynamic later)              | Engineering        | Feb 28   |
| **Build:** Appello MCP server skeleton + first 5 tools                                    | Travis             | Feb 28   |
| **Identify:** 5 pilot customers and schedule intro conversations                          | Corey/Nathan       | Feb 21   |

---

### The Uncomfortable Truth

The construction vertical is a **$300K/year business** at full penetration of Appello's customer base. That's important revenue and incredible unit economics, but it's not enough to establish AgentC2 as a platform company.

The public platform is what makes this a **$10M+ business**. And that market is being contested RIGHT NOW by well-funded competitors shipping weekly.

The construction vertical gives you something no competitor has: **real proof in a real industry with real customers and real ROI data.** But that proof is only valuable if the public platform exists to leverage it. A case study in a drawer is worth nothing.

**Run both tracks. Ship the landing page in March. Ship Appello Intelligence in April. By the time competitors are doing their first enterprise pilot, you'll have 35 paying construction customers and 500 free platform users.**

The window is open. It won't be open forever.
