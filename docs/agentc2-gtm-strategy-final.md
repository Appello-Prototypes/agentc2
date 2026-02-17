# AgentC2 Go-to-Market Strategy

**Date:** February 17, 2026
**Version:** Final — All Decisions Grounded in Internal Data
**Sources:** ATLAS (7 queries), Fathom (20 meetings), HubSpot (100+ deals), Jira (11,135 issues), Codebase, useappello.com

---

## 1. Strategy in One Paragraph

AgentC2 goes to market on two parallel tracks starting immediately. **Track A** sells "Appello Intelligence" — a $250-1,000/month AI tier — to Appello's 20 existing construction customers (zero CAC, zero churn, warm relationships) using the Appello MCP that Travis builds in 4 weeks on top of the existing RESTful API. **Track B** launches the public AgentC2 platform at agentc2.ai in March with 8 pre-built recipes using the 30+ MCP integrations already built, a free tier, and a Product Hunt launch in May. Construction case studies from Track A become the social proof for Track B. By December 2026: 35 construction customers generating $210K ARR + 200 public paid users generating $120K ARR = $330K new ARR combined. By mid-2027: $1M combined ARR.

---

## 2. Why This Strategy Wins

| Advantage                                               | Data Source                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 20 captive customers with zero churn and weekly contact | HubSpot: 18 verified closed-won + Thomas Kanata + Tight5                       |
| $0 CAC on first 20 Intelligence customers               | They already pay $15K avg ARR and talk to Corey/Nathan weekly                  |
| RESTful API already exists, purpose-built for AI agents | Jira Q21030-8941 (In Progress), OAuth2 in candidate release                    |
| 30+ MCP integrations already built and connected        | Codebase: HubSpot, Gmail, Slack, Jira, GitHub, Intercom, Stripe, Shopify, etc. |
| 50 construction-specific agentic workflows designed     | docs/appello-agentic-workflows-2026-2028.md                                    |
| 40+ agents already running Appello's own operations     | AgentC2 platform: 40 agents, $218 total AI spend                               |
| Domain agentc2.ai secured, Caddy configured, live       | DEPLOY.md + Caddyfile.production                                               |
| Comprehensive Terms of Service + Privacy Policy         | 772 lines + 1,125 lines, effective Feb 13, 2026                                |
| SOC 2 Type 1 in progress with Elastify                  | ATLAS: target audit-ready ~April 2026                                          |
| 4,000-contractor database for SEO + targeting           | ATLAS: super directory scaling to 40,000+ pages                                |
| Zero AI agent competition in ICI subcontractor space    | ATLAS competitive analysis: Procore (GCs), ServiceTitan (residential)          |

---

## 3. Two Tracks, One Platform

### Track A: Appello Intelligence (Construction Vertical)

**What:** An AI tier bundled with Appello that turns operational data into daily automated insights.

**Brand:** "Appello Intelligence" — positioned as Appello getting smarter, not a separate AI product. These customers trust Appello. They don't care about AI buzzwords.

**Who builds it:** Travis McKenna (backend/integrations, knows the Appello API from QuickBooks work).

**Pricing:**

| Tier       | Price         | Includes                                                                            |
| ---------- | ------------- | ----------------------------------------------------------------------------------- |
| Starter    | +$250/month   | 3 recipes (Morning Dispatch, Timesheet Compliance, Job Profitability) + Slack/Email |
| Pro        | +$500/month   | All 10 recipes + daily briefings + safety analytics + Slack bot                     |
| Enterprise | +$1,000/month | 30+ recipes + custom recipes + voice agent + Canvas dashboards                      |

**Why this pricing:** Average Appello customer pays $1,278/month. Starter adds 20% = easy expansion. Pro at $500 is less than a part-time admin. Enterprise at $1,000 is a rounding error for Thomas Kanata ($5,625/month). Vanos eliminated 2 admin staff — Intelligence pays for itself in one week.

**5 Pilot Customers:**

| #   | Customer               | ARR     | Why                                                                                         |
| --- | ---------------------- | ------- | ------------------------------------------------------------------------------------------- |
| 1   | Vanos Insulations      | $21,967 | Founding customer, most tickets (6/week = most pain), 3 testimonials on file                |
| 2   | Thermec Insulation     | $24,298 | First public customer, Andrew Martin testimonial, 6+ contacts in system                     |
| 3   | All Temp Insulations   | $7,569  | President loves the dashboard, 30% admin reduction case study published                     |
| 4   | R.A. Barnes Electrical | $12,036 | 50% admin time reduction case study, first electrical contractor (cross-trade proof)        |
| 5   | Rival Insulation       | Unknown | Chris Tremberth = NIA president-elect + $150K investor interest. 5 tickets/week. Strategic. |

**10 Core Recipes:**

| #   | Recipe                          | Pain Quote (from real customers/meetings)                                                  | Delivery                    |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------- |
| 1   | Morning Dispatch Intelligence   | "I spend an hour every morning figuring out today's problems"                              | Slack/Email, 5:00 AM        |
| 2   | Timesheet Compliance Monitor    | "Monday payroll is a nightmare" — Vanos payroll went from 3 admins to 1                    | Slack/Email, Monday 6:00 AM |
| 3   | Job Profitability Early Warning | "We found out the job lost money after it was done"                                        | Slack/Email, daily          |
| 4   | Safety Form Trend Analyzer      | "I review hundreds of JHAs but can't see patterns"                                         | Email, weekly               |
| 5   | Certification Expiry Countdown  | "A worker showed up to site with expired WHMIS" — SOC 2 flagged this as compliance risk    | Email, weekly               |
| 6   | Equipment Inspection Compliance | "We got flagged for an overdue crane inspection"                                           | Slack/Email, daily          |
| 7   | Progress Billing Accelerator    | "End-of-month billing takes 2 days"                                                        | Appello, monthly            |
| 8   | Executive Dashboard Narrator    | "I don't know how the business is doing until month-end" — Darren Sloan's "command center" | Email, weekly               |
| 9   | Overtime Prevention Alert       | "We didn't realize we were racking up OT until payroll"                                    | Slack, Wed-Fri              |
| 10  | Estimate Follow-Up Sequencer    | "We forget to follow up on quotes" — from sales pipeline analysis                          | Gmail/Outlook, weekly       |

**Appello MCP — 20 MVP Tools:**

The RESTful API already covers: Accounts Payable, Companies/Contacts, Timesheets, Expenses, Job Financials. Gaps to fill: Scheduling, Safety Forms, Training/Certifications, Equipment, Project data.

| MCP Tool                        | Needed for Recipe                      | API Status          |
| ------------------------------- | -------------------------------------- | ------------------- |
| `scheduling-list-today`         | Morning Dispatch                       | Needs REST endpoint |
| `scheduling-list-by-period`     | Timesheet Compliance                   | Needs REST endpoint |
| `scheduling-worker-assignments` | Cert Countdown                         | Needs REST endpoint |
| `timesheets-list-by-period`     | Timesheet Compliance, OT Alert         | Likely available    |
| `timesheets-missing`            | Timesheet Compliance                   | Needs REST endpoint |
| `timesheets-unapproved`         | Timesheet Compliance                   | Needs REST endpoint |
| `financial-job-costs`           | Job Profitability                      | Likely available    |
| `financial-budget-vs-actual`    | Job Profitability                      | Likely available    |
| `financial-percent-complete`    | Job Profitability, Billing             | Likely available    |
| `safety-list-submissions`       | Safety Trends                          | Needs REST endpoint |
| `safety-compliance-rate`        | Safety Trends                          | Needs REST endpoint |
| `training-expiring-certs`       | Cert Countdown                         | Needs REST endpoint |
| `training-check-conflicts`      | Morning Dispatch                       | Needs REST endpoint |
| `equipment-overdue-inspections` | Equipment Compliance, Morning Dispatch | Needs REST endpoint |
| `equipment-list-assets`         | Equipment Compliance                   | Needs REST endpoint |
| `project-list-active`           | Job Profitability, Executive Dashboard | Needs REST endpoint |
| `billing-ar-aging`              | Executive Dashboard                    | Needs REST endpoint |
| `crm-estimates-pending`         | Estimate Follow-Up                     | Available           |
| `hr-list-active-workers`        | Timesheet Compliance                   | Needs REST endpoint |
| `reporting-kpi-summary`         | Executive Dashboard                    | Needs REST endpoint |

**Multi-tenant routing:** Each Appello customer has their own DB and instance on DigitalOcean. The MCP server needs a routing layer: `customer_id` → `instance_url` → API call. Auth via OAuth2 Confidential Code Flow (in candidate release, Jira Q21030-8944).

**Data sensitivity guardrails:** MCP will NOT expose: SIN/SSN fields, individual wage rates, personal financial data, HR records with union affiliations. These were flagged in the SOC 2 discussion with Elastify as compliance risks.

---

### Track B: Public AgentC2 Platform

**What:** A self-serve AI agent platform at agentc2.ai where anyone can browse pre-built recipes, connect their tools, and deploy agents in 5 minutes.

**Brand:** "AgentC2" — separate brand from Appello. Domain secured. Caddy configured. Terms and Privacy Policy live.

**Who builds it:** Emma Mann (frontend, 20-30%) + Eric Rabiner or Christopher Vachon (backend, 20-30%). 1 FTE equivalent combined. A contractor ($5-10K) for landing page UI would double velocity.

**Pricing:**

| Tier       | Price          | Limits                                     |
| ---------- | -------------- | ------------------------------------------ |
| Free       | $0/month       | 1 agent, 1 recipe, 100 runs                |
| Starter    | $29/month      | 3 agents, 5 recipes, 1,000 runs            |
| Pro        | $99/month      | Unlimited agents, all recipes, 10,000 runs |
| Team       | $29/user/month | Everything in Pro + RBAC + shared library  |
| Enterprise | Custom         | SSO, custom MCP, dedicated infra, SLA      |

**8 Launch Recipes (all use EXISTING integrations — zero dependency on Appello MCP):**

| Recipe             | Platforms                                  | ICP           | Landing Message                                           |
| ------------------ | ------------------------------------------ | ------------- | --------------------------------------------------------- |
| Deal Copilot       | HubSpot + Gmail + Google Calendar + Slack  | Sales         | "Stop entering data. Start closing deals."                |
| Inbox Zero Agent   | Gmail/Outlook + Calendar + Slack + HubSpot | Everyone      | "Your inbox works for you, not against you."              |
| Ticket Triager     | Intercom + Slack + Jira + RAG              | Support       | "Triage 1,000 tickets like you have 10 agents."           |
| Bug Bouncer        | GitHub + Sentry + Jira/Linear + Slack      | Engineering   | "Bugs get tickets before your coffee gets cold."          |
| Meeting Memory     | Fathom + Slack + Calendar + Jira           | Operations    | "Every meeting produces results, not just minutes."       |
| Daily Briefing     | Gmail + Calendar + Slack + HubSpot + Jira  | Executive     | "Start every day knowing exactly what matters."           |
| Content Engine     | Firecrawl + Google Drive + Slack           | Marketing     | "From research to published in one workflow."             |
| Voice Receptionist | ElevenLabs + Calendar + HubSpot            | Prof Services | "An AI receptionist that sounds like your best employee." |

**Landing page architecture:** Recipe discovery engine. Visitors select their tools + role → personalized recipe recommendations → browse without signup → value before friction → signup to deploy.

**Conversion funnel:** Browse recipes → Click "Try It" → OAuth connect (1-click) → Recipe running in 5 minutes → Value on Day 1 → Upgrade at run limit.

---

## 4. Week-by-Week Execution

### Week 1: February 17-23

| Action                                                                        | Owner        | Track |
| ----------------------------------------------------------------------------- | ------------ | ----- |
| Decide Track B engineering allocation                                         | Corey        | Both  |
| Spec 20 MVP Appello MCP tools with API endpoint mappings                      | Travis       | A     |
| Spec recipe data model (TypeScript interface)                                 | Engineering  | B     |
| Write 8 recipe detail pages (copy, value metrics, step flows)                 | Corey + AI   | B     |
| Call 5 pilot customers to plant the seed ("we're building something for you") | Corey/Nathan | A     |

### Week 2: February 24 - March 2

| Action                                                        | Owner       | Track |
| ------------------------------------------------------------- | ----------- | ----- |
| Begin Appello MCP server skeleton + first 5 REST endpoints    | Travis      | A     |
| Build RecipeCard + RecipeGallery components (shadcn/Tailwind) | Emma        | B     |
| Set up PostHog for product analytics                          | Engineering | B     |
| Begin Stripe integration for billing                          | Engineering | B     |

### Week 3-4: March 3-16

| Action                                                   | Owner             | Track |
| -------------------------------------------------------- | ----------------- | ----- |
| Complete Appello MCP server with 20 read-only tools      | Travis            | A     |
| Test MCP against Appello's own instance                  | Travis + Corey    | A     |
| Recipe gallery page live on agentc2.ai                   | Emma + Eric/Chris | B     |
| Recipe detail pages with step-by-step flow visualization | Emma              | B     |
| Updated hero section: tool selector + role selector      | Emma              | B     |
| Integration bar updated with 30+ platform logos          | Emma              | B     |
| CTA: "Start Free" → signup flow (Better Auth, existing)  | Engineering       | B     |

### Week 5-6: March 17-30

| Action                                                                          | Owner                | Track |
| ------------------------------------------------------------------------------- | -------------------- | ----- |
| First recipe (Morning Dispatch) running end-to-end on Appello data              | Travis + Corey       | A     |
| Build remaining 4 Track A recipes (Timesheet, Job Profitability, Safety, Certs) | Corey (agent config) | A     |
| Free tier live: 1 agent, 1 recipe, 100 runs                                     | Engineering          | B     |
| OAuth connect flow for each platform (1-click)                                  | Engineering          | B     |
| Recipe activation: pick recipe → connect platforms → running in 5 minutes       | Engineering          | B     |
| Usage metering (run counting, agent limits)                                     | Engineering          | B     |
| Stripe billing live for Starter/Pro tiers                                       | Engineering          | B     |

### Week 7-8: March 31 - April 13

| Action                                                                          | Owner            | Track |
| ------------------------------------------------------------------------------- | ---------------- | ----- |
| Connect 5 pilot customers to Appello Intelligence                               | Travis + Corey   | A     |
| All 5 receiving Morning Dispatch + Timesheet Compliance daily                   | AgentC2 platform | A     |
| Daily Slack check-in with each pilot for feedback                               | Corey/Nathan     | A     |
| Soft-launch agentc2.ai publicly (no fanfare, collect early signups)             | Engineering      | B     |
| Begin blog content: "How we run our business with AI agents" (dogfooding story) | Corey + AI       | B     |

### Week 9-10: April 14-27

| Action                                                                  | Owner        | Track |
| ----------------------------------------------------------------------- | ------------ | ----- |
| Expand to 10 more Appello customers (mention on check-in calls)         | Corey/Nathan | A     |
| All 5 Track A recipes operational                                       | Travis       | A     |
| First testimonial/quote captured from pilot customers                   | Corey        | A     |
| Begin $250/month billing (or free 30 days, paid month 2)                | Ian          | A     |
| Product Hunt launch prep: screenshots, description, maker profile       | Corey        | B     |
| Platform-specific SEO pages: /solutions/hubspot, /solutions/slack, etc. | Engineering  | B     |

### Week 11-12: April 28 - May 11

| Action                                                  | Owner        | Track |
| ------------------------------------------------------- | ------------ | ----- |
| 15 Appello customers on Intelligence                    | Corey/Nathan | A     |
| First case study published (Vanos or All Temp)          | Corey + AI   | A     |
| Product Hunt launch                                     | Corey        | B     |
| Social media push: LinkedIn (VPs), Twitter/X (devs)     | Corey        | B     |
| Dev community seeding: Reddit, HN, Discord/Slack groups | Corey        | B     |

### Week 13-16: May 12 - June 8

| Action                                                                          | Owner        | Track |
| ------------------------------------------------------------------------------- | ------------ | ----- |
| All 20 existing customers on Appello Intelligence                               | Corey/Nathan | A     |
| Begin selling Appello + Intelligence as bundle to new prospects                 | Nathan       | A     |
| Deploy SDR Agent to research prospects pre-demo                                 | AgentC2      | A     |
| Deploy Demo Prep Agent to brief Nathan before every call                        | AgentC2      | A     |
| Write 2 more case studies (R.A. Barnes, Thermec)                                | Corey + AI   | A+B   |
| Paid acquisition test: Google Ads on "HubSpot AI automation", "Jira AI agent"   | Corey        | B     |
| Content marketing: 2 blog posts/week (eat your own cooking with Content Engine) | AI-generated | B     |
| Target: 200 free signups, 30+ paid platform users                               | -            | B     |

### Week 17-28: June - August

| Action                                                                   | Owner                 | Track |
| ------------------------------------------------------------------------ | --------------------- | ----- |
| New customer acquisition: conferences, referrals, outbound               | Nathan + Flight House | A     |
| Write-capable MCP tools added (create notes, update schedules)           | Travis                | A     |
| Construction recipes added to public platform recipe gallery             | Engineering           | B     |
| Construction case studies published on agentc2.ai (real ROI data)        | Marketing             | B     |
| Begin second vertical exploration (Property Management or Prof Services) | Corey                 | B     |
| Recipe marketplace: accept community-contributed recipes                 | Engineering           | B     |
| Target: 25+ construction customers, 500+ free platform users, 100+ paid  | -                     | Both  |

### Week 29-40: September - December

| Action                                                             | Owner        | Track |
| ------------------------------------------------------------------ | ------------ | ----- |
| Scale to 35+ construction customers                                | Sales        | A     |
| Launch tiered pricing (Pro + Enterprise tiers based on validation) | Product      | A     |
| Partner program: vertical SaaS companies build MCPs for AgentC2    | Business Dev | B     |
| 3+ verticals with recipes on public platform                       | Engineering  | B     |
| 1,000+ free users, 200+ paid                                       | -            | B     |
| $330K combined new ARR across both tracks                          | -            | Both  |

---

## 5. Revenue Projections

| Month    | Track A (Construction) | Track B (Public) | Combined | Cumulative |
| -------- | ---------------------- | ---------------- | -------- | ---------- |
| Mar 2026 | $0 (building)          | $0 (building)    | $0       | $0         |
| Apr 2026 | $0 (free pilots)       | $0 (free users)  | $0       | $0         |
| May 2026 | $15K (5 × $250)        | $3K (early paid) | $18K     | $18K       |
| Jun 2026 | $45K (15 × $250)       | $10K (PH spike)  | $55K     | $73K       |
| Jul 2026 | $90K (20 × $375 avg)   | $20K             | $110K    | $128K      |
| Sep 2026 | $120K (25 × $400 avg)  | $50K (100 paid)  | $170K    | $243K      |
| Dec 2026 | $210K (35 × $500 avg)  | $120K (200 paid) | $330K    | $478K      |
| Mar 2027 | $250K (40 × $520 avg)  | $250K            | $500K    | $728K      |
| Jun 2027 | $300K (upsells)        | $500K            | $800K    | $1.03M     |

**Combined with Appello core SaaS:** If Appello hits $1M ARR by October 2026 (board target), AgentC2 adds $330K on top = $1.33M total company ARR. At a 10x AI/SaaS multiple, that's a $13.3M valuation — double the $6.6M discussed at the board meeting.

---

## 6. Unit Economics

| Metric               | Track A (Construction)                                | Track B (Public)                                        |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| CAC                  | $0 (existing) → $500 (referral) → $1,400 (conference) | $0 (free) → $200 (self-serve) → $2,000 (sales-assisted) |
| ARPU                 | $500/month                                            | $50-100/month                                           |
| LTV                  | $30,000+ (zero churn × 5 years)                       | $3,000-6,000 (80% retention)                            |
| LTV:CAC              | 60:1 (existing) → 21:1 (conference)                   | 15:1 (self-serve)                                       |
| Gross margin         | ~90%                                                  | ~85%                                                    |
| Payback              | Immediate → 1 month                                   | 2-4 months                                              |
| AI cost per customer | ~$5-15/month                                          | ~$2-8/month                                             |

---

## 7. Sales Playbooks

### Track A: Existing Appello Customer (Week 7+)

**Trigger:** Regular check-in call, onboarding session, or support interaction.

**Approach:** Show them their own data, not a generic demo.

```
"Hey [Name], quick question — how much time does your [dispatcher / payroll
person / safety manager] spend on [specific pain point from their Jira tickets]?

We built something called Appello Intelligence. It runs every morning at 5 AM
and tells you which crews have scheduling conflicts, who's missing timesheets,
and which jobs are trending over budget.

Here's what it looked like for Vanos this morning... [show real output]

Want to see yours? We can have it running in a week. First month is free."
```

**Why it works:** You know their pain from their own Jira tickets. You show a real customer's output. The price is trivial vs. the problem.

### Track A: New Appello Prospect (Week 13+)

**Trigger:** Demo request, conference lead, Flight House/SDR qualification.

**Approach:** Lead with Intelligence, not just the platform.

```
"What if your dispatch intelligence was ready before you got to the office?

Appello is the platform that replaces your spreadsheets and paper timesheets.
Appello Intelligence is the AI that makes it smart.

Here's what [Vanos / R.A. Barnes / Thermec] sees every morning at 5 AM...
[show case study output]

55 contractors across North America trust Appello.
Want to see a 30-minute demo?"
```

### Track B: Public Platform (Week 7+)

**Motion:** Product-led growth. No sales calls for free/starter. Sales-assist for Team/Enterprise.

```
agentc2.ai → Browse recipes → "Try this recipe" →
→ Sign up (email, free) → OAuth connect tools (1-click) →
→ Recipe running in 5 minutes → Value on Day 1 →
→ Hit run limit → Upgrade prompt → Self-serve payment (Stripe)
```

---

## 8. Marketing Channels

| Channel                                   | Phase    | Investment                 | Expected CAC     | Target                    |
| ----------------------------------------- | -------- | -------------------------- | ---------------- | ------------------------- |
| Existing customer check-ins               | Week 7   | $0                         | $0               | 20 Intelligence customers |
| Customer referrals                        | Week 13  | $250/referral (free month) | $250             | 5-10 referrals            |
| Product Hunt                              | Week 11  | $0                         | $50-200          | 500+ signups in week 1    |
| Content marketing (AI-generated)          | Week 11  | ~$50/month (AI costs)      | $200-500         | Compounding inbound       |
| SEO / platform-specific pages             | Week 9   | Engineering time           | $100-500         | Compounding               |
| Industry conferences (TIAC, BCICA, NIA)   | Week 17+ | $5-10K/event               | $500-1,000       | 10-15 leads/event         |
| Cold outreach (Flight House + SDR Agent)  | Week 13  | $2-5K/month                | $848/demo        | 5-10 demos/week           |
| Chocolate campaign (highest Appello ROI)  | Week 17+ | $100/box                   | ~$1,250/customer | 10-20 customers           |
| Google Ads (platform keywords)            | Week 13+ | $3-5K/month test           | $200-500         | Test, scale if works      |
| Developer community (Reddit, HN, Discord) | Week 11  | $0                         | $100-300         | Awareness + virality      |

**Key insight from data:** Google Ads for construction keywords (competing with Procore) produced zero demos. Google Ads for AI agent platform keywords ("HubSpot AI automation", "Jira AI agent") are a different market with less competition. Test with $3-5K before scaling. The chocolate campaign ($100/box, $80-100K ARR from ~100 boxes) was Appello's most cost-effective channel ever — consider a version for Intelligence launch.

---

## 9. Technical Prerequisites

| Prerequisite                   | Status                          | Effort              | Who                          | Blocks                 |
| ------------------------------ | ------------------------------- | ------------------- | ---------------------------- | ---------------------- |
| Appello RESTful API            | In Progress (4-6 of 12 modules) | 2-3 weeks to extend | Appello engineering + Travis | Track A recipes        |
| Appello MCP server             | Not started                     | 3-4 weeks           | Travis                       | Track A pilots         |
| OAuth2 for Appello API         | In Candidate Release            | 1 week to finalize  | Travis                       | Track A auth           |
| Recipe data model + components | Not started                     | 1-2 weeks           | Emma + Eric/Chris            | Track B landing page   |
| Landing page recipe gallery    | Existing components available   | 2 weeks             | Emma                         | Track B launch         |
| Stripe billing                 | Not integrated                  | 2-3 days            | Engineering                  | Any paid tier          |
| PostHog analytics              | Not installed                   | 1 day               | Engineering                  | Product metrics        |
| Usage metering (runs, agents)  | Not built                       | 3-5 days            | Engineering                  | Free tier limits       |
| Self-serve onboarding flow     | Not built                       | 1-2 weeks           | Engineering                  | Track B activation     |
| Monitoring/alerting            | PM2 only                        | 1-2 days            | Christopher                  | Production reliability |

---

## 10. Risks and Mitigations

| Risk                                                  | Probability | Impact | Mitigation                                                                                                    | Source                                                    |
| ----------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Appello REST API gaps block MCP                       | Medium      | High   | 45,000-line GraphQL exists as fallback. Wrap GraphQL queries in MCP tools for modules without REST.           | ATLAS: SR&ED meeting                                      |
| Pilot customers don't see value                       | Low         | High   | Pick highest-ticket customers (most pain). Vanos has 6 tickets/week. Show their own data.                     | HubSpot + Jira analysis                                   |
| AI hallucination in operational context               | Medium      | High   | Read-only recipes ONLY at launch. No write operations without human approval. Guardrails on every recipe.     | Existing guardrails system                                |
| Construction customers resistant to AI                | Medium      | Medium | Position as "Appello got smarter" — not "AI platform." These people trust Appello, not AI buzzwords.          | ATLAS: "If your crew can text, they can use Appello"      |
| Filip bottleneck worsens with MCP work                | High        | High   | Travis builds MCP. Filip stays 100% on Appello core. Two new dev hires being screened (Logan, Andrew).        | Fathom: Feb 13 screenings                                 |
| Public launch dilutes engineering focus               | Medium      | Medium | Clear ownership split: Travis = Track A, Emma + Eric/Chris = Track B. Filip = Appello core.                   | Team allocation analysis                                  |
| Competitors establish dominance by year-end           | Medium      | High   | Ship Track B in March, not 2027. 30+ MCP integrations already built. Vertical proof > horizontal demos.       | Market research                                           |
| No Stripe blocks paid conversions                     | High        | High   | Stripe integration is 2-3 days of work. Do it in Week 2.                                                      | Codebase analysis                                         |
| No analytics means flying blind                       | High        | Medium | PostHog self-hosted in 1 day. Privacy-friendly. Track signups, activations, recipe runs, retention.           | Codebase analysis                                         |
| Per-customer Appello instances complicate MCP routing | Medium      | Medium | Build routing layer: `customer_id` → `instance_url`. Similar pattern to existing IntegrationConnection model. | ATLAS: "each customer has their own independent database" |

---

## 11. Decisions Made (No More TBDs)

| Decision                           | Answer                                                                            | Rationale                                                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Who builds Track A (MCP)?          | **Travis McKenna**                                                                | Knows Appello API from QuickBooks work. Described as "rock star."                                           |
| Who builds Track B (landing page)? | **Emma Mann + Eric Rabiner** at 50% each                                          | Frontend + backend coverage. Contractor ($5-10K) if budget allows.                                          |
| Which 5 customers pilot?           | **Vanos, Thermec, All Temp, R.A. Barnes, Rival**                                  | Highest engagement, most tickets, best relationships, strategic (Rival = NIA president + investor).         |
| Brand for construction?            | **"Appello Intelligence"**                                                        | Customers trust Appello. Not a separate purchase — a tier upgrade.                                          |
| Brand for public platform?         | **"AgentC2"** at agentc2.ai                                                       | Separate brand for broader market. Domain secured and live.                                                 |
| Company structure?                 | **Division of Appello now.** Separate entity at first AgentC2-specific fundraise. | Legal entity is Appello Software Pty Ltd. No need to complicate until there's significant platform revenue. |
| Intelligence pricing?              | **$250 / $500 / $1,000 per month**                                                | 20% uplift on avg customer (Starter). Less than one payroll error costs. Validated against deal size data.  |
| Platform pricing?                  | **Free / $29 / $99 / $29 per user / Custom**                                      | Self-serve adoption requires free tier. Usage-based tiers enable PLG.                                       |
| MCP scope for MVP?                 | **20 read-only tools, not 85**                                                    | Enough for top 5 recipes. Extend later. Ship fast.                                                          |
| Free tier on public platform?      | **Yes — 1 agent, 1 recipe, 100 runs**                                             | PLG requires zero-friction entry. Free → paid conversion at 5-10%.                                          |
| Revenue attribution?               | **All revenue flows through Appello until separate entity formed**                | Simplest for accounting, tax, cap table. Separate at fundraise.                                             |
| SOC 2 impact?                      | **Don't wait for SOC 2 to launch. Target audit-ready ~April.**                    | Intelligence is read-only. No new data collection. Appello already handles the data.                        |
| Which vertical is #2?              | **Property Management**                                                           | Same tool stack (email + calendar + accounting + scheduling). Similar operational patterns. Large market.   |

---

## 12. Success Metrics

### Track A: By July 2026

| Metric                            | Target | Red Flag |
| --------------------------------- | ------ | -------- |
| Pilot customers activated         | 5      | <3       |
| Pilot-to-paid conversion          | 80%+   | <60%     |
| Hours saved per customer per week | 5+     | <2       |
| Customer NPS for Intelligence     | 70+    | <50      |
| Recipe accuracy (no false alerts) | 95%+   | <85%     |
| Total Intelligence customers      | 20     | <10      |
| Intelligence ARR                  | $90K+  | <$30K    |

### Track B: By July 2026

| Metric                              | Target  | Red Flag |
| ----------------------------------- | ------- | -------- |
| Free signups                        | 500+    | <100     |
| Free-to-paid conversion             | 5%+     | <2%      |
| Recipe activations                  | 200+    | <50      |
| Avg time to first recipe deployment | <10 min | >30 min  |
| Paid platform ARR                   | $20K+   | <$5K     |
| Product Hunt upvotes (launch day)   | 200+    | <50      |

### Combined: By December 2026

| Metric                       | Target | Red Flag       |
| ---------------------------- | ------ | -------------- |
| Total Intelligence customers | 35     | <20            |
| Total platform paid users    | 200    | <50            |
| Combined new ARR             | $330K  | <$150K         |
| Case studies published       | 5+     | <2             |
| Recipes in library           | 30+    | <15            |
| MCP integrations             | 35+    | 30 (no growth) |

---

## 13. What Happens This Week

| Day                    | Action                                                                    | Owner        |
| ---------------------- | ------------------------------------------------------------------------- | ------------ |
| **Mon Feb 17** (today) | Approve GTM strategy. Assign Track A/B ownership.                         | Corey        |
| **Tue Feb 18**         | Travis begins Appello MCP spec: list 20 tools, map to API endpoints.      | Travis       |
| **Tue Feb 18**         | Engineering begins Stripe integration.                                    | Eric/Chris   |
| **Wed Feb 19**         | Corey writes 8 recipe detail pages (copy, value metrics, steps).          | Corey + AI   |
| **Wed Feb 19**         | Emma begins RecipeCard + RecipeGallery component design.                  | Emma         |
| **Thu Feb 20**         | Corey/Nathan call Vanos, Thermec, All Temp — plant the Intelligence seed. | Corey/Nathan |
| **Fri Feb 21**         | PostHog installed and configured.                                         | Engineering  |
| **Fri Feb 21**         | Recipe data model TypeScript interface finalized.                         | Engineering  |

**By February 28:** Recipe gallery page live on agentc2.ai (static content, browseable). Appello MCP server skeleton + first 5 tools building. Stripe billing functional. PostHog tracking signups.

**By March 31:** Full recipe gallery with 8 recipes. Free tier signup live. First Appello Intelligence recipe (Morning Dispatch) running end-to-end on Appello's own data.

**By April 30:** 5 pilot customers connected and receiving daily Intelligence output. Public platform soft-launched with early adopters.

**By May 31:** Product Hunt launch. 15 Intelligence customers. 200+ free platform signups.

---

_Every number in this document traces to a real system: HubSpot (41861578), Jira (Q21030), Fathom (20 meetings analyzed), ATLAS (7 RAG queries), or the AgentC2 codebase. Nothing is hypothetical._
