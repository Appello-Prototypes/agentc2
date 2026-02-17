# GTM Questions — Answered From Internal Data

**Sources:** ATLAS Knowledge Base (7 queries), Fathom Meeting Intelligence (20 recent meetings), Jira (issue search), Codebase Analysis, useappello.com
**Date:** February 17, 2026

---

## BLOCKING QUESTIONS

### 1. Appello API Readiness

**ANSWER: The RESTful API EXISTS and is in active development. It is NOT complete across all 12 modules.**

**Evidence:**

- **Jira Q21030-8941** (Epic: "Restful API") — Status: **In Progress**. Includes OpenAPI/Swagger documentation endpoints in both YAML and JSON formats. Assigned to John Breland.
- **Jira Q21030-8943** (Task: "Setup a restful API endpoint v2") — Status: **In Candidate Release**. Uses Zod for schema validation, generates OpenAPI Swagger docs, includes a `/healthz` endpoint.
- **Jira Q21030-8944** (Task: "Add an OAuth2 provider endpoint") — Status: **In Candidate Release**. OAuth2 Code Flow with PKCE for SPAs, Confidential Code Flow for tooling, refresh token support.
- **ATLAS (SR&ED Meeting, Oct 2025):** Corey described building a RESTful API specifically because the GraphQL schema is 45,000 lines — too complex for AI agents. "We had to overcome API challenges to get the data out, build our own RESTful API."
- **ATLAS (Integration Weekly, Mar 2025):** Team proposed building a RESTful API layer using Swagger specifically to simplify AI agent development. Initial focus: accounts payable, companies, contacts. "Estimated timeline: Basic setup by Wednesday, with ongoing development as needed."
- **ATLAS (Investor Call, Jun 2025):** "Building a RESTful API to allow AI tools to interact with Appello's data. Pre-processing key metrics to improve AI response times and efficiency."

**Current API coverage (estimated from evidence):**

| Module                   | API Status       | Evidence                                                   |
| ------------------------ | ---------------- | ---------------------------------------------------------- |
| Accounts Payable         | Available        | Explicitly mentioned as initial focus                      |
| Companies/Contacts (CRM) | Available        | Explicitly mentioned as initial focus                      |
| Timesheets               | Available        | "Time sheet data to flow" via GraphQL, likely also RESTful |
| Expenses                 | Partial          | Referenced in integration discussions                      |
| Job Financials           | Likely available | Referenced in multiple integration contexts                |
| Scheduling               | Unknown          | Not explicitly mentioned in API work                       |
| Safety Forms             | Unknown          | Not explicitly mentioned                                   |
| Training/Certifications  | Unknown          | Not explicitly mentioned                                   |
| Equipment                | Unknown          | Not explicitly mentioned                                   |
| Progress Billing         | Unknown          | Not explicitly mentioned                                   |
| Estimating               | Unknown          | Not explicitly mentioned                                   |
| HR                       | Unknown          | Not explicitly mentioned                                   |

**Authentication:** OAuth2 Code Flow (PKCE for SPA, Confidential for tooling) — in candidate release, not yet fully deployed.

**Multi-tenant model:** Each customer has their own independent database and instance on DigitalOcean. No shared databases. This means the MCP server needs to know which customer instance to connect to.

**Bottom line:** The API exists but likely covers 4-6 modules out of 12. The OAuth layer is nearly ready. The API was explicitly designed for AI agent consumption. The MCP build is more feasible than starting from scratch — the hard part (API layer) is partially done. **Estimated gap: 3-4 weeks to extend API coverage to remaining critical modules + wrap in MCP server.**

---

### 2. Engineering Allocation

**ANSWER: The team is 10 people. Realistic Track B allocation is 1-2 engineers at 50% capacity, unless a contractor is hired.**

**Team roster (confirmed from Fathom standup Feb 17, 2026):**

| Person                 | Role                   | Current Load                                          | Track B Availability                                 |
| ---------------------- | ---------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| **Filip Altankov**     | Sr Dev / Product Lead  | 60% of all Jira work + PM + QA                        | **0%** — fully committed to Appello product          |
| **Emma Mann**          | Frontend Dev           | ~4 tickets/day, support                               | **20-30%** — could build landing page components     |
| **Travis McKenna**     | Backend / Integrations | QuickBooks, integrations, customer support management | **50%** — best candidate for MCP build (Track A)     |
| **Christopher Vachon** | Developer              | Infrastructure, deployment                            | **20-30%** — could help with platform infrastructure |
| **Eric Rabiner**       | Developer              | Core development                                      | **20-30%** — could contribute to Track B             |
| **Tristan Gemus**      | Contractor             | Mobile/GPS features                                   | **0%** — mobile-focused                              |
| **Corey Shelson**      | CEO                    | Sales, product, strategy, AI initiatives              | **10-15%** — direction-setting only                  |
| **Ian Haase**          | COO                    | Legal, finance, HR, onboarding                        | **0%** — fully committed                             |
| **Nathan Friesen**     | Sales                  | Demo delivery                                         | **0%** — sales-focused                               |
| **Kylin Cheong**       | CSM                    | Ticket triage, first response                         | **0%** — support-focused                             |

**Active hiring (from Fathom):**

- Logan Randell — screening Feb 13 (Ian conducting)
- Andrew Hunniford — screening Feb 12 (Ian conducting)
- Both appear to be developer hires

**Travis's unique position:** Travis was described as a "rock star" who took on 15-20% of Corey's job and 10-15% of Ian's. He's positioned to manage development processes AND knows the Appello API from his QuickBooks integration work. **Travis is the optimal person to build the Appello MCP (Track A).**

**Track B recommendation:** Emma (frontend/landing page components) + Eric or Chris (backend/recipe framework) at 50% each. OR hire a contractor specifically for the landing page and recipe gallery UI.

**Key constraint:** Filip is a non-starter for any AgentC2 work. He is the single-threaded bottleneck for Appello core product — doing PM, code review, QA, and 60% of development. Pulling him risks Appello product stability.

---

### 3. Brand and Company Structure

**ANSWER: AgentC2 is currently a DIVISION of Appello, not a separate entity. The platform was previously called "Catalyst" and has been renamed. The domain agentc2.ai is secured and live.**

**Evidence:**

- **ATLAS (Meeting, Feb 17, 2026 — today):** "Agent C2 is a multi-tenant platform that provides a secure, auditable, and user-friendly environment for agentic AI." Described as "A Corporatized Agent Platform."
- **ATLAS (Multiple meetings):** Platform was previously called "Catalyst." References to "Catalyst framework," "Catalyst's long-term vision is a full-stack AI platform."
- **Legal entity:** Terms of Service list "Appello Software Pty Ltd" — no separate AgentC2 entity exists.
- **Domain:** `agentc2.ai` is secured, configured in Caddy production config with proper redirects (www → non-www).
- **Fundraising context:** All fundraising discussions reference Appello. No separate AgentC2 raise has been discussed. Chris Tremberth's $150K investment is into Appello.
- **Investor Call (Jun 2025):** AI strategy discussed as "a separate revenue stream" — suggesting it would eventually be its own business line, but currently part of Appello.

**Decision needed:** When (not if) to create a separate entity. For now, "Appello Intelligence" for construction customers and "AgentC2" for the public platform is the right dual-brand approach. Legal separation can happen at a fundraise milestone.

---

## PRODUCT & TECHNICAL QUESTIONS

### 4. Recipe Framework

**ANSWER: No recipe framework exists yet. The closest analog is the campaign system (military-style mission planning) and the skill system (composable knowledge + procedures + tools).**

The recipe data model needs to be built from scratch, but the underlying infrastructure (agents, workflows, MCP tools, scheduling via Inngest, delivery via Slack/email) is all in place.

**Existing patterns to reuse:**

- **Campaign system:** Multi-phase execution with missions and tasks — similar to recipe steps
- **Skill system:** Composable bundles of instructions + tools + documents — similar to recipe packaging
- **Workflow system:** Sequential/parallel execution with human approval — similar to recipe logic
- **Trigger system:** Schedule-based and event-based execution — maps directly to recipe scheduling

**Delivery channels already built:** Slack (two-way bot with per-agent identity), Email (Gmail/Outlook OAuth), Canvas (interactive dashboards), Voice (ElevenLabs).

### 5. Free Tier & Self-Serve

**ANSWER: No free tier or self-serve signup currently exists. The platform requires authentication and is invite-controlled.**

**Current state:**

- Waitlist/invite system in development (visible in git status: `apps/admin/src/app/(dashboard)/waitlist/page.tsx`)
- Platform invite manager being built (`apps/admin/src/components/platform-invite-manager.tsx`)
- No Stripe billing integration — no payment processing exists
- No usage metering for "runs" or "agents" currently implemented
- The landing page exists as a component but the homepage currently just embeds the welcome agent

**Gaps to fill for self-serve:**

- Stripe integration for billing
- Usage metering (run counting, agent limits)
- Onboarding flow (connect integrations, pick recipe, deploy)
- Product analytics (no Mixpanel/Amplitude/PostHog currently)

### 6. Multi-Tenancy & Data Isolation

**ANSWER: AgentC2 already has multi-tenant infrastructure. Appello's architecture is per-customer isolated instances.**

**AgentC2 (this platform):**

- Multi-tenant by design — organizations, workspaces, users with role-based access
- OAuth credential storage via encrypted `IntegrationConnection` model (AES-256-GCM)
- Per-user agent runs, per-org scoping

**Appello:**

- Each customer has their own independent database AND instance on DigitalOcean
- "Our databases are on Digital Ocean. And each customer has their own independent database and their own independent instance of the platform." — Corey, confirmed in multiple meetings
- No shared infrastructure between customers
- This means the Appello MCP needs to route to the correct customer instance — a routing layer is required

### 7. Appello MCP Specifics

**ANSWER: Appello uses per-customer isolated instances on DigitalOcean with independent databases. The API uses a 45,000-line GraphQL schema being wrapped by a RESTful layer.**

- **Webhooks/events:** No evidence of real-time event notifications. Likely poll-based. Appello does integrate with HubSpot (tickets flow automatically into Jira), suggesting some webhook capability exists.
- **Data sensitivity:** Wage rates, union affiliations, SINs (Social Insurance Numbers) — these were flagged in the SOC 2 discussion as sensitive fields that customers can store in custom fields. The MCP should NOT expose HR wage data, SIN fields, or personal employee financial data.
- **Latency:** Unknown. The SR&ED transcript mentions "token and context limits" and "getting thousands of records blowing up context windows" — suggesting the API returns large payloads. The pre-processing work was done specifically to address this.
- **Open source vs proprietary:** No discussion found. Recommendation: proprietary MCP (it's the moat).

### 8. Platform Infrastructure

**ANSWER: Single Digital Ocean droplet. Adequate for current load, will need scaling for public multi-tenant.**

| Resource       | Current                                            | Public Platform Need                                               |
| -------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| **Server**     | 32GB RAM / 8 vCPUs / 640GB SSD ($96/mo)            | Sufficient for 500 users, may need horizontal scaling at 1,000+    |
| **Inngest**    | Local dev server + per-function concurrency limits | Need Inngest Cloud plan for production reliability                 |
| **CDN**        | Caddy serves everything (no CDN)                   | Should add Cloudflare or similar for landing page performance      |
| **Monitoring** | PM2 process manager                                | Need uptime monitoring + alerting (e.g., Better Uptime, PagerDuty) |
| **Analytics**  | None                                               | Need PostHog or Mixpanel for product analytics                     |
| **Billing**    | None (no Stripe)                                   | Need Stripe integration before paid tier launches                  |

---

## PRICING & BUSINESS MODEL QUESTIONS

### 9. Appello Intelligence Pricing

**ANSWER: No pricing has been set. Historical data suggests $250-500/month is well within Appello customers' willingness to pay.**

**Evidence for pricing tolerance:**

- Average Appello deal: $15,337/year (~$1,278/month)
- Largest deal: Thomas Kanata at $67,500/year ($5,625/month)
- Appello pricing model: per-user ($10/month) + server costs + modules
- Customers routinely paying $500-2,000/month for core Appello
- A $250/month Intelligence tier = ~20% increase on average customer — well within normal SaaS expansion range
- Case study evidence: Vanos went from 3 payroll administrators to 1, freed 2 staff members. The value of Intelligence features far exceeds $250/month.

**Recommendation confirmed:** $250 Starter / $500 Pro / $1,000 Enterprise is appropriately calibrated.

### 10. Public Platform Pricing

**ANSWER: No pricing exists. The existing landing page component has pricing defined but untested.**

Current landing page pricing (from `pricing-section.tsx`):

- Individual: Free ($0) / Pro ($49/mo) / Max ($149/mo)
- Team: Team ($29/user/mo) / Enterprise (Custom) / Enterprise+ (Custom)

This is placeholder pricing that hasn't been validated with any customers.

### 11. Revenue Attribution

**ANSWER: All revenue currently flows through Appello Software Pty Ltd. No separate AgentC2 entity exists.**

Fundraising context: The ~$1M raise being planned is for Appello. AgentC2 revenue would currently be Appello revenue. A separate entity discussion hasn't happened yet — it should happen before the public platform generates significant revenue.

---

## GO-TO-MARKET QUESTIONS

### 12. Pilot Customers

**ANSWER: Based on support ticket volume (most pain = most value), engagement level, and relationship strength, the top 5 pilots are:**

| Rank | Customer                                     | Why                                                                                                                                                                                                                                                    |
| ---- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | **Vanos Insulations** (Matt Vanos)           | Founding customer, highest engagement, most tickets (6/week), zero churn for 3+ years. Operations Manager Ron Kustermans gave testimonial. Brianne Ernewein (Accounting & HR Manager) gave detailed video testimonial.                                 |
| 2    | **Thermec Insulation** (Tim Pullyblank)      | "First customer" publicly. Andrew Martin (Construction Manager) gave strong testimonial about admin time savings. Multiple contacts in system (Andrew, Jeff, Karen, Brad Cooper, Kim Conquer). $24,298 ARR.                                            |
| 3    | **All Temp Insulations** (Darren Sloan)      | President gave testimonial: "I love having this dashboard... my little command center." Sean (Field Supervisor) also gave testimonial about field UX. 30% admin overhead reduction documented in case study.                                           |
| 4    | **R.A. Barnes Electrical** (Louise Metcalfe) | Published case study: 50% admin time reduction, eliminated full-time admin role. First electrical contractor — proves cross-trade applicability. $12,036 ARR.                                                                                          |
| 5    | **Rival Insulation** (Chris Tremberth)       | STRATEGIC: Chris Tremberth is president-elect of the National Insulation Association AND an interested investor (~$150K). 5 tickets/week (high engagement). Demonstrating Intelligence to Chris could unlock both investment and industry credibility. |

**Runner-up:** Headrick Insulation (Brian Headrick, $21,977 ARR, US customer — proves US market).

**Today's Fathom data also shows:** Ontario Insulation is being onboarded RIGHT NOW (meeting today, Feb 17), and LJ Insulation (Rochester, NY) had an intro call today. The customer base is actively growing.

### 13. Sales Motion

**ANSWER: Corey and Nathan do demos (confirmed from Fathom). Nathan was "recently freed from cold calling" when it was outsourced to Flight House. Corey does 20%+ of his time on sales.**

- **Demo tool:** Fathom records every demo/call. "Appello Sales" (appellosales@useappello.com) is a recording account used for sales calls.
- **Sales collateral:** Case studies published for Vanos, R.A. Barnes, All Temp on useappello.com/case-studies
- **Demo frequency:** Today alone (Feb 17): 1 sales demo (American Rentals), 1 onboarding (Ontario Insulation), 1 prospect intro (LJ Insulation). Plus daily standup. That's typical.
- **No demo environment:** No evidence of a sandbox/demo instance. Demos appear to use either Appello's own instance or a customer's instance.
- **SDR:** Flight House (London, ON) handles cold calling. Cost: ~$848/demo. Chocolate campaign was more effective: ~$100/box, $80-100K ARR from ~100 mailers.

### 14. Marketing & Content

**ANSWER: Marketing budget has been minimal and largely ineffective for digital channels. Organic/direct channels dominate.**

| Channel                       | Spend                            | Result                                                                       |
| ----------------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| **Google Ads**                | ~$10,000                         | Zero demos. "Competing with Procore" on keywords. Abandoned.                 |
| **LinkedIn Ads**              | Included in $25K total digital   | Zero attributable demos                                                      |
| **Total digital advertising** | ~$25,000 lifetime                | "Nothing tangible quickly" — Corey, Board Meeting                            |
| **Chocolate campaign**        | ~$100/box × 100 boxes = ~$10,000 | $80-100K ARR. Best channel by far.                                           |
| **Flight House cold calling** | Ongoing                          | ~$848/demo, produces consistent pipeline                                     |
| **Conferences/events**        | Varies                           | ~$1,400/demo but high-quality leads                                          |
| **SEO / Super Directory**     | Engineering investment           | Scaling from 35 → 40,000+ indexed pages. ~4,000 ICI contractors in database. |
| **Content**                   | No dedicated resource            | No blog, no regular content cadence                                          |

**Key insight from Board Meeting:** Corey acknowledged that digital marketing will likely work NOW because they have G2 reviews, case studies, a better website, and online presence — things they didn't have when they spent the $10K on Google Ads. The new website + SEO + super directory is the current bet.

**No design resource exists.** Engineering does design. The landing page components were built by the engineering team.

### 15. Partnerships

**ANSWER: One active integration partnership (getkroo.com for Vista/Sage accounting), but no formal partner/reseller program.**

- **getkroo.com:** Provides database-level connectivity to Vista and Sage 100 Contractor. Pricing based on Monthly Active Rows (~$1K/mo for 500K MARs). Active conversations as of Oct 2025.
- **Pipeline:** The Vista integration discussion (Feb 2025) involved a three-phase approach (SDK, endpoint mapping, logic building).
- **Chris Tremberth (Rival Insulation):** President-elect of National Insulation Association — the most strategically valuable partner possible for industry distribution.
- **No formal reseller/partner program** discussed in any meeting transcripts.

---

## OPERATIONAL QUESTIONS

### 16. Support Model

**ANSWER: Current support is Kylin (CSM, 9-min first response) + Emma (4 tickets/day development fixes) + Travis (process management). No separate AgentC2 support exists.**

- In-app ticket submission: ~70% of volume
- Flow: Customer → HubSpot → Jira → Development team
- Average resolution: 6.9 days
- First response: 11.24 hours average (Kylin achieves 9 minutes when observed)
- Volume: 1,173 Jira tickets + 472 HubSpot tickets in 6 months (as of Oct 2025 internal review)
- **Corey's own assessment:** "A collection of ad-hoc tools that won't scale"

### 17. Legal & Compliance

**ANSWER: Comprehensive Terms of Service and Privacy Policy already exist. SOC 2 Type 1 is actively being pursued with Elastify.**

- **Terms of Service:** 772 lines, 23 sections, effective February 13, 2026. Covers service description, IP, data privacy, liability, AI usage. Legal entity: Appello Software Pty Ltd.
- **Privacy Policy:** 1,125 lines, 18 sections, effective February 13, 2026. Covers GDPR, CCPA, data collection, Google API compliance, data retention, user rights. States: no advertising cookies, no third-party analytics.
- **SOC 2:** Working with Elastify (consulting firm). Target: audit-ready for SOC 2 Type 1 in ~3 months from January 2026 meeting (so ~April 2026). All five Trust Service Criteria. Key gaps identified: no 2FA, weak location data anonymization, customer-defined fields that could store sensitive data (SINs).
- **AI data disclosure:** The Privacy Policy covers data processing. However, it's written for Appello, not AgentC2. If AgentC2 launches publicly as a separate product, it may need its own Terms/Privacy addressing the fact that user data passes through OpenAI/Anthropic APIs.
- **agentc2.ai domain:** Secured and configured. Caddy proxy set up with production SSL.

### 18. Metrics & Instrumentation

**ANSWER: No product analytics tool exists. No A/B testing framework. Internal agent analytics only.**

- **No Mixpanel, Amplitude, PostHog, Segment, or similar** in any package.json
- **Internal analytics:** Agent performance metrics (runs, costs, traces) exist via the AgentC2 platform's own tools
- **Privacy Policy explicitly states:** "No advertising cookies or third-party analytics"
- **Recommendation:** Add PostHog (open source, self-hostable, privacy-friendly) before public launch. Essential for tracking signups, recipe activations, retention.

---

## STRATEGIC QUESTIONS

### 19. Competitive Response

**ANSWER: The competitive moat is vertical depth + proprietary MCP, not horizontal breadth.**

From ATLAS and board meeting data:

- Procore is the dominant construction platform but targets **general contractors**, not subtrades. "Too broad, not subtrade-specific."
- ServiceTitan targets **residential**, not ICI. "Wrong segment."
- No AI agent platform is targeting ICI subcontractor operations.
- The 4,000-contractor database (super directory) is a unique asset for both SEO and sales targeting.
- AgentC2's 30+ MCP integrations give it broader horizontal coverage than most competitors, but the vertical Appello MCP is inimitable.

**If HubSpot/Jira/Slack launch their own AI agents:** These will be single-tool agents (HubSpot agent only works in HubSpot). AgentC2's value is **cross-tool orchestration** — connecting HubSpot + Gmail + Calendar + Slack + Appello in a single recipe. No single vendor can replicate this.

### 20. Long-Term Vision

**ANSWER: The vision has been explicitly discussed and is evolving.**

From ATLAS:

- **Jun 2025 (Investor Call):** "Developing 'AI Appello' to provide insights from Appello data... Considering both a consulting approach and a productized offering... Develop a go-to-market strategy for the AI capabilities, potentially as a separate revenue stream."
- **Jul 2025 (Board Meeting):** "Advancing AI capabilities with internal tool (Atlas) and customer-facing features (Apex)." Also: "Potential secondary offering of 5-10% equity from silent partner to bring in strategic investors."
- **Jan 2026 (Strategy Meeting):** "Catalyst's long-term vision is a full-stack AI platform that automates sales, support, and even code generation, with a future goal of connecting manufacturers and contractors."
- **Feb 2026 (Today):** "Agent C2 is a multi-tenant platform that provides a secure, auditable, and user-friendly environment for agentic AI."

**The trajectory is clear:** Started as internal tooling → became "AI Appello" feature → evolved into standalone platform (Catalyst → AgentC2). The end-state vision is a platform company, with Appello as the first vertical.

**Fundraising:** The ~$1M raise is for Appello. AgentC2 doesn't yet factor into the fundraising narrative, but it should — it transforms the story from "construction SaaS growing linearly" to "AI platform company with captive vertical market."

**Exit scenario:** Board Meeting discussed 6x revenue multiple ($1.1M ARR = ~$6.6M valuation). With AgentC2 as a platform play, the multiple could be 10-15x (AI/SaaS premium), significantly changing the exit math.

---

## SUMMARY: THE 5 CRITICAL ANSWERS

| #   | Question                           | Answer                                                                                                                                                   | Implication                                                                                                                                                                                    |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Does the Appello API exist?**    | YES — RESTful API in progress with Swagger docs, OAuth2 nearly ready. Covers ~4-6 modules. 45,000-line GraphQL as fallback.                              | MCP build is 3-4 weeks, not 8. Focus on extending API to scheduling, safety, training modules.                                                                                                 |
| 2   | **Engineering hours for Track B?** | Emma + Eric/Chris at 50% each = ~1 FTE equivalent. OR hire a contractor. Travis owns Track A (MCP).                                                      | Two parallel tracks are feasible but tight. A contractor for the landing page UI would de-risk Track B.                                                                                        |
| 3   | **Brand?**                         | "AgentC2" for public platform (domain secured, live). "Appello Intelligence" for construction tier. Currently a division of Appello, no separate entity. | Dual brand is the right call. Separate entity at first external fundraise for AgentC2 specifically.                                                                                            |
| 4   | **Pilot customers?**               | Vanos, Thermec, All Temp, R.A. Barnes, Rival (strategic — Chris Tremberth is NIA president-elect + investor). All have testimonials and high engagement. | Pilots can start as soon as MCP is ready. These customers are warm and trusting.                                                                                                               |
| 5   | **Budget for landing page?**       | No marketing budget to speak of. Google Ads produced zero results. No design resource. Engineering does everything. No Stripe billing. No analytics.     | The landing page must be built by engineering (Emma/Eric/Chris). Stripe + PostHog are prerequisites for any paid tier. Budget for a contractor ($5-10K) would dramatically accelerate Track B. |

---

## GAPS IDENTIFIED — MUST BUILD BEFORE LAUNCH

| Gap                                                         | Priority                        | Effort    | Who                 |
| ----------------------------------------------------------- | ------------------------------- | --------- | ------------------- |
| **Stripe billing integration**                              | Critical (before any paid tier) | 2-3 days  | Engineering         |
| **Product analytics (PostHog)**                             | Critical (before public launch) | 1 day     | Engineering         |
| **Recipe data model + components**                          | Critical (Track B foundation)   | 1-2 weeks | Engineering         |
| **Appello MCP server**                                      | Critical (Track A foundation)   | 3-4 weeks | Travis              |
| **Extend Appello REST API** to scheduling, safety, training | High                            | 2-3 weeks | Appello engineering |
| **Usage metering** (run counting, limits)                   | High (before free tier)         | 3-5 days  | Engineering         |
| **Self-serve onboarding flow**                              | High                            | 1-2 weeks | Engineering         |
| **Monitoring/alerting** (uptime, failures)                  | Medium                          | 1-2 days  | Engineering         |
| **CDN** for landing page                                    | Medium                          | 1 day     | Engineering         |
| **AgentC2-specific Terms/Privacy** update                   | Medium                          | 1-2 days  | Legal/Ian           |
| **Demo sandbox environment**                                | Low (nice-to-have for sales)    | 3-5 days  | Engineering         |
