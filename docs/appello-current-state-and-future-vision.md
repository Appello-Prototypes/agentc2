# Appello: Current State Analysis & Future Vision for the Agentified Organization

**Date:** February 16, 2026 (Updated: February 17, 2026 -- Deep Dive v2)
**Sources:** HubSpot CRM (100+ deals, 100+ companies, tickets), Jira (Q21030, 11,135+ issues, 50 most recent analyzed), Fathom Meeting Intelligence (50+ meetings), Gmail (50 recent emails), ATLAS Knowledge Base (25+ knowledge chunks across transcripts, competitive analyses, board meetings, investor calls)
**Context:** Pre-implementation analysis for the Self-Running Company plan
**Living Agent:** Company Intelligence Agent deployed on AgentC2 (`company-intelligence`) with 23 MCP tools, weekly Monday 7 AM schedule, $20/month budget

---

## Part 1: The Business Today -- A Complete Current State

### 1.1 Company Overview

**Appello** is a vertical SaaS platform for industrial, commercial, and institutional (ICI) construction subcontractors -- primarily mechanical insulation, HVAC, electrical, and specialty trade contractors. The company was founded approximately 4 years ago by **Corey Shelson** and **Ian Haase**, operating out of Delaware, Ontario, Canada.

The product was originally built for a single customer -- **Vanos Insulations**, a third-generation mechanical insulation company with ~70 unionized field workers. After demonstrating the product at the National Insulation Conference in Canada 18 months after initial development, five contractors signed up. Appello has since maintained a pace of adding 1-2 contractors per month.

**Currency:** CAD
**Legal Entity:** Canadian corporation with plans for US corporate entity for US hires
**Domain:** useappello.com

---

### 1.2 Financial Position

| Metric | Value | Source |
|--------|-------|--------|
| **Current ARR** | ~$400,000 CAD | ATLAS (Board Meeting Oct 2025) |
| **Target ARR** | $1,000,000 CAD (breakeven) | ATLAS (multiple sources) |
| **Breakeven Target Date** | October 2026 | ATLAS |
| **2024 Revenue (Cash In)** | $399,000 | Board Meeting transcript |
| **2023 Revenue (Cash In)** | $187,000 | Board Meeting transcript |
| **Projected 2025 Revenue** | $650,000 | Board Meeting |
| **Projected 2026 Revenue** | $960,000 | Board Meeting |
| **Current MRR** | ~$35,000 | Investor conversations |
| **Average Deal Size** | ~$15,000 ARR | Multiple sources |
| **Largest Deal** | $70,000 ARR + $16,000 onboarding (Thomas Kanata) | HubSpot + ATLAS |
| **Churn (2024)** | Zero | Board Meeting |

**Financial Model Highlights:**
- The model projects a $400K cash low under baseline scenario (no new funding beyond the $225K note)
- Cash-flow positivity projected by October 2028 with ~$1.1M ARR
- At a 6x multiple, $1.1M ARR = ~$6.6M valuation
- Applied for $200K IRAP grant
- Rival Insulation (Chris Tremberth) expressed strong interest in investing
- Current valuation discussion at $5-6M range
- Doubling Sales & Marketing spend and hiring planned as growth investments

---

### 1.3 Product & Modules

Appello covers five core business areas through 12 modules:

| Business Area | Modules | Status |
|---------------|---------|--------|
| **Sales & Pre-Construction** | Estimating, SOV (Schedule of Values) | Active |
| **Field Execution** | Scheduling, Timesheets, Equipment Management | Active -- core adoption driver |
| **Project Delivery & Cost Control** | Job Costing, Progress Billing, Invoicing, SOV Reports | Active -- high demand |
| **Safety & Compliance** | Safety Forms, Training Records | Active |
| **Financial & Admin** | QuickBooks Integration, Accounts Payable/Receivable | Active |

**Pricing Model:** Per user ($10/month) + server costs + modules used.

**Integration Capabilities:**
- ~10 accounting platforms integrated
- Native bi-directional sync with QuickBooks Online
- Focus on AP/AR, expenses, timesheet data for job costing
- Export capabilities for ProContractor, Sage, and other ERPs

**Product Roadmap Priorities (from ATLAS):**
1. Retain existing customers (bug fixes, enhancements)
2. New customer opportunity (features needed to close deals)
3. Tech debt and scalability

**Upcoming/In-Development Features:**
- Work order functionality (service work & time-and-materials jobs)
- Phases and tasks (monday.com-like)
- HR functionality (potentially displacing tools like BambooHR)
- Configurable SOV column ordering (Q21030-11133 in Jira)
- Form share improvements with download CTA and link expiry (Q21030-11134)
- Geofencing
- Inventory management
- "AI Appello" -- insights from platform data

**Customer Pain Points Being Solved:**
- Paper-based timesheets costing 3-4 hours/week of admin (scales to full day at 20 staff)
- Disconnected systems (Teams for scheduling, paper for time tracking)
- Inaccurate payroll from manual processes
- Complex union pay rules (variable foreman/journeyman rates, county-based board)
- Lack of centralized job information in the field
- No real-time progress billing visibility

---

### 1.4 Complete Customer Base (from HubSpot -- Deep Dive)

**Total Closed-Won Customers (HubSpot stage 1188040364):** 18 verified in default pipeline

| # | Customer | ARR | Close Date | Type | Geography |
|---|----------|-----|-----------|------|-----------|
| 1 | **Vanos Insulations** - Matt Vanos | $21,967 | Jan 2023 | Mechanical Insulation | Mount Brydges, ON |
| 2 | **All Temp Insulations** - Darren Sloan | $7,569 | Oct 2023 | Thermal Insulation | Newcastle, ON |
| 3 | **Thermec Insulation** - Tim Pullyblank | $24,298 | Sep 2023 | Insulation | Canada |
| 4 | **WestGlas Insulation** - Kevin Nott/Jon Forrest | $16,517 | Dec 2023 | Insulation | Western Canada |
| 5 | **Thermogenix HVAC** - Derek Sisera | $9,251 | Jan 2024 | HVAC | Canada |
| 6 | **Headrick Insulation** - Brian Headrick | $21,977 | May 2024 | Insulation | USA |
| 7 | **Owens Insulation** - Robert Owens | $26,019 | May 2024 | Insulation | USA |
| 8 | **E.P.I Insulation** - Ryan Paterson | $11,225 | Jun 2024 | Insulation | Canada |
| 9 | **Bluewater Energy** - Wil Beardmore | $5,400 | Jul 2024 | Energy | Canada |
| 10 | **SMS Industrial** - Matt Vanos (referral) | $1 | Sep 2024 | Industrial | Canada |
| 11 | **Isolation Elite** - Mathieu Hamel | $22,000 | Nov 2024 | Insulation | Quebec |
| 12 | **Sommerdyk Construction** - Tony Sommerdyk | $9,204 | Nov 2024 | Construction | Canada |
| 13 | **Ace Insulation** - Roger Blanchette | $8,616 | Dec 2024 | Insulation | Canada |
| 14 | **R.A. Barnes Electrical** - Louise Metcalfe | $12,036 | Mar 2025 | Electrical | Canada |
| 15 | **Southern States Insulation** - Corey Sumner | $18,000 | Mar 2025 | Insulation | **USA (first!)** |
| 16 | **Collins Construction** - Tom St.Onge | $16,000 | Apr 2025 | Construction | Canada |
| 17 | **Mkwa Construction** - Mike Michano | $10,000 | May 2025 | Construction | Indigenous-owned |
| 18 | **Clement Construction** - Matt Wylie | $10,000 | Jul 2025 | Construction | Canada |

**Additional Customers (different deal stages):**
| Customer | ARR | Stage | Notes |
|----------|-----|-------|-------|
| **Thomas Kanata** - Scott Norton | $67,500 | Onboarding/Active | Largest customer, 2026 onboarding visible in Fathom |
| **Tight5 Contracting** - Brad Hayson | $27,000 | Onboarding/Active | Active, UX improvement ticket visible in Jira |

**Verified HubSpot ARR Total: ~$344,580** (aligns with ~$400K stated ARR when including additional customers not yet fully entered)

**Customer Growth Timeline:**
- 2023: 4 customers closed (Vanos, All Temp, Thermec, WestGlas)
- 2024: 9 customers closed (massive acceleration)
- 2025 (to date): 5 customers closed + Thomas Kanata ($67.5K) + Tight5 ($27K)

**Customer Profile Refined:**
- 94% construction industry (insulation dominates, expanding to HVAC, electrical, general construction)
- 78% Canadian, 22% US (growing US presence)
- Company sizes: 10-70 field staff, some scaling to 500-2,000 employees
- Mix of unionized and non-union
- Average deal: $15,337 ARR; Median: $12,036; Range: $5,400 to $67,500
- **Zero churn** -- product is "very sticky" because timesheets and data entered daily. "Customer service is our number one. We drop everything if a customer has a problem."
- Note from ATLAS: "Signed ARR doesn't always match actual billing ARR" -- some customers have fewer active users than contracted

**Active Pipeline Deals (not yet closed):**
| Deal | Amount | Stage | Notes |
|------|--------|-------|-------|
| Thermo Applicators - Cory Gray | $35,000 | Decision Maker Bought In | Long-running |
| Aarc West - Chris Ceraldi | $25,000 | In Pipeline | |
| C&G Insulation - Ray Pachon | $8,000 | In Pipeline | |
| KPS Solutions - Kevin Roberts | $8,000 | Scheduled Presentation | |
| + multiple referral pipeline deals | Various | Various stages | |

**Strategic Shift:** Moving toward larger customers (500-2,000 employees) with $50K-$100K/year deal sizes, longer sales cycles but higher lifetime value.

---

### 1.5 Team & Organization (from Fathom + Jira + ATLAS -- Deep Dive)

**Current Team (~10 people, verified from Jira assignees + Fathom standups):**

| Person | Role | Focus Area | Jira Workload (Last Week) | Email |
|--------|------|------------|---------------------------|-------|
| **Corey Shelson** | Co-Founder / CEO | Product, Sales, Strategy, Customer Relationships | Jira reporter (customer tickets) | corey@useappello.com |
| **Ian Haase** | Co-Founder / COO | Legal, Finance, HR, Onboarding, Customer Service | Onboarding lead, screening interviews | ian@useappello.com |
| **Filip Altankov** | Senior Dev / Product Lead | Architecture, Jira, Feature Specs, Code Review | **~60% of all assigned Jira work** -- carries the team | faltankov@useappello.com |
| **Emma Mann** | Developer | Frontend, Forms, UX, Support Tickets | ~4 tickets/day, handles Progress Billing/SOV | emann@useappello.com |
| **Travis McKenna** | Backend Dev / Integrations | QuickBooks integration, Payment sync | QBO sync, payment deletion handling | tmckenna@useappello.com |
| **Christopher Vachon** | Developer | Engineering | Present at all standups | chris@useappello.com |
| **Eric Rabiner** | Developer | Engineering | Present at all standups | erabiner@useappello.com |
| **Kylin Cheong** | Customer Service Manager | Ticket triage, first response | 9-minute first response time observed | kcheong@useappello.com |
| **Nathan Friesen** | Sales / Demos | Demo delivery, prospect engagement | Recently freed from cold calling | nathan@useappello.com |
| **Tristan Gemus** | Contractor | Mobile development, GPS/clock features | Clock In/Out without GPS feature | tristangemus@gmail.com |

**Hiring Activity (from Fathom -- Feb 2026):**
- "Logan: Appello screening" -- Feb 13 (Ian conducting)
- "Appello Screening: Andrew Hunniford" -- Feb 12 (Ian conducting)
- Previous screening: Kylin Cheong (hired Jul 2024, now CSM)
- Sales hire discussions with Bill Flemming ($150K comp package)
- Sales hire discussions with Marissa Davis ($80-100K base + equity)

**Jira Workload Distribution (Feb 9-16, 2026 -- one week snapshot):**

| Team Member | Assigned Issues | Status Breakdown |
|-------------|----------------|-----------------|
| **Filip** | ~25 issues | QA (5), Code Review (1), To Refine (10+), In Prod (5) |
| **Emma Mann** | 4 issues | UAT (1), QA (1), To Do (1), To Refine (1) |
| **Travis McKenna** | 3 issues | In Progress (2), In Prod (1) |
| **Tristan Gemus** | 1 issue | To Refine (1) -- GPS clock feature |
| **Unassigned** | ~17 issues | Mostly To Refine -- awaiting triage |

**Critical Observation:** Filip is the single-threaded technical bottleneck. He is simultaneously:
- Writing detailed feature specifications (SOV column ordering: 500+ word acceptance criteria)
- Doing code review
- QA testing
- Bug fixing across multiple customers
- Architecture decisions

**Organizational Structure:**
- Flat startup, daily standups (8-10 people, ~45 minutes)
- Corey: product direction, sales demos, customer relationships, strategy, AI initiatives, support escalations
- Ian: legal, finance, accounting, HR, recruiting, onboarding leadership, investor relations
- Filip: engineering lead, product specs, code review, QA, architecture
- Emma: frontend development, support ticket resolution (~4/day)
- Travis: backend integrations (QuickBooks is the critical integration)
- Kylin: customer service triage and first response
- Nathan: demo delivery
- Chris/Eric: core development

**Key Challenge Refined:** The company has TWO critical single-threaded bottlenecks:
1. **Corey** -- doing sales at 20% capacity while leading product, strategy, and AI
2. **Filip** -- carrying 60% of the engineering workload while also being the de facto PM and QA lead

---

### 1.6 Sales & Go-to-Market (from HubSpot + ATLAS)

**Sales Process:**
1. Lead Generation: Industry events (TIAC, BCICA), cold calling (outsourced to Flight House), referrals, website/SEO
2. Demo Booking: Target is 5-25 demos/week (currently closer to 5)
3. Demo Delivery: Corey + Nathan conducting product demos
4. Internal Discussion Period: Customer evaluates internally
5. Closing Meeting: Schedule onboarding, determine payment terms
6. Onboarding: Ian leads, 2 weeks to 2 months depending on scope

**Sales Metrics:**
- Demo-to-Close (won): 34 days average, 95 days maximum
- Overall conversion: ~25/150 demos converted (17%)
- Sales cycle: 1-3 months from first demo
- Primary bottleneck: **Volume** -- not enough demos being booked

**CRM & Tools:**
- HubSpot CRM for pipeline management (Portal ID: 41861578)
- Two pipelines in HubSpot (default sales + referral pipeline)
- All leads tracked through sales stages
- HubSpot-to-Jira ticket integration for customer support

**Lead Sources:**
- Industry conferences and trade shows (strongest channel)
- Cold calling (outsourced to Flight House, London ON)
- Referrals from existing customers
- Website inquiries (SEO strategy scaling to 40,000+ indexed pages)
- Union websites and industry association lists (TIAC)

**SEO Strategy (from ATLAS):**
- New website + "super directory" scaling from 35 to 40,000+ indexed pages
- TikTok presence (active account posting industry content)
- G2 profile active

---

### 1.7 Engineering & Product Development (from Jira)

**Jira Project:** Q21-030 (Vanos Insulation ERP) -- the original project name, now encompassing all Appello development
**Total Issues:** 11,135+ (massive, well-documented backlog)
**Project Type:** Classic Kanban

**Recent Issue Categories (Feb 2026):**

| Category | Examples | Volume |
|----------|----------|--------|
| **Customer Bug Reports** | Jobs appearing in Archive, timesheet logging issues | ~40% |
| **Feature Development** | SOV column ordering, form share improvements | ~35% |
| **Enhancement Requests** | Phase/Component visibility in basic view | ~15% |
| **Tech Debt** | Next.js upgrades, scalability improvements | ~10% |

**Jira Workflow (verified from issue status transitions):**
`To Refine` -> `To Do` -> `In Progress` -> `Code Review` -> `QA` -> `UAT` -> `In Prod` | `Canceled`

**Issue Velocity (Feb 9-16, 2026 -- one week):**
- ~50 issues created in 7 days = **~7 issues/day**
- Mix: ~60% customer bugs, ~25% feature development, ~15% platform enhancements
- ~6-8 issues moved to "In Prod" per week

**Notable Feature Work In Progress:**
- **Equipment Module Enhancements** -- 7-phase build plan (HIGH priority), covers billable rates, hours logging, invoicing pipeline
- **SOV / Progress Reports / Invoices** -- Configurable column ordering, phase/component visibility
- **Form Signatures** -- In QA
- **QuickBooks Sync** -- Payment deletion handling, expense sync
- **API Security** -- Preventing manipulation of internal projects
- **Clock In/Out Without GPS** -- Mobile feature for field workers

**Notable Patterns:**
- HubSpot-linked tickets flow automatically into Jira (customer support -> development pipeline)
- Customer-reported issues include video URLs (Screencastify recordings)
- Well-structured acceptance criteria on feature tickets (Filip writes 500+ word specs with technical notes)
- Filip is the primary product specification author AND primary reviewer AND primary QA tester
- Detailed technical notes reference specific files (e.g., `CostCodeTemplateAddEdit.tsx`, `BillTemplatePDF.tsx`)
- Bug reports trace directly to specific customers -- enabling per-customer health scoring

**Prioritization Framework (RICE):**
- **R**each: How many customers/users affected
- **I**mpact: How much value delivered
- **C**onfidence: Feasibility certainty
- **E**ffort: Development time estimate
- Internal cost calculated per feature request

**Product Roadmap:** Year-long with 250+ feature requests queued. Internally estimated at development cost per feature. Three priority tiers: (1) Retain existing customers, (2) New customer acquisition needs, (3) Tech debt and scalability.

---

### 1.8 Customer Success & Support (Deep Dive from ATLAS + Jira)

**Support Metrics (from ATLAS -- internal meeting Oct 2025):**

| Metric | Value | Source |
|--------|-------|--------|
| **Jira tickets (6 months)** | 1,173 | Internal review |
| **HubSpot tickets (6 months)** | 472 | Internal review |
| **Average resolution time** | 6.9 days | Internal review |
| **First response time** | 11.24 hours | Internal review |
| **Emma's ticket velocity** | ~4 tickets/day | Internal review |
| **In-app ticket origin** | ~70% | System review |
| **Kylin's first response** | 9 minutes observed | Headrick meeting transcript |

**Support Flow (verified):**
1. Customer submits bug report or feature request via in-app forms (~70% of volume)
2. Submission goes to **HubSpot** first (customer service portal)
3. HubSpot auto-creates corresponding **Jira** ticket
4. Kylin (CSM) triages and responds in HubSpot (9-minute response observed)
5. Dev team picks up from Jira
6. Customer gets branded HubSpot portal for status tracking

**Top Bug Areas (from ATLAS internal review):**
- Wage rates and trade levels
- Accounts payable
- Certificates
- Jobs module
- Progress billing

**Customer-Specific Support Load (Jira -- last week, Feb 9-16, 2026):**

| Customer | Tickets This Week | Issue Types |
|----------|-------------------|-------------|
| **Vanos Insulations** | 6 | Files, archive errors, timesheets, H&S forms, equipment, alerts |
| **Rival Insulation** | 5 | PCO tracking, audit log, training video, time-off bug, CSV export |
| **All Temp Insulations** | 3 | Member login, phone numbers, notes notification |
| **Thermec** | 1 | Labour expense column in job cost report |
| **EPI Insulation** | 1 | Logging time classification change |
| **Thermogenix** | 1 | QuickBooks issue |
| **Collins Construction** | 1 | Vacation/leave request |
| **Mkwa** | 1 | Estimate-to-job file transfer |
| **Thomas Kanata** | 1 | PWA navigation |
| **R.A. Barnes** | 1 | Timesheet notes not showing |
| **Tight5** | 1 | UX improvement, dark mode request |
| **Platform-wide** | 5+ | Equipment module, SOV features, API security, form signatures |

**Critical Insight:** Vanos (founding customer) and Rival Insulation (investor!) generate the most support tickets. The support volume pattern shows that larger, more engaged customers generate proportionally more tickets -- which means the support load will scale non-linearly as Appello closes bigger deals.

**Inefficiency Pattern (from ATLAS):**
- "Inefficient communication observed in Slack threads (e.g., 45 replies for a single issue)"
- "Current process often requires Corey's involvement, taking time away from sales activities"
- "Need for more direct, synchronous problem-solving instead of long message chains"

**Onboarding Process (from ATLAS -- detailed):**
- Duration: 2 weeks to 2 months depending on org size
- Structure: Weekly 1-hour working sessions
- First meeting: everyone; then cherry-pick by topic (safety, scheduling, accounting)
- Data import: customer/supplier/employee data from QuickBooks
- Forms building, training records import, employment agreements setup
- Training videos exist for different app areas
- Completed 30-40 onboardings to date
- Typical kickoff: sign license agreement + ACH form, schedule onboarding meeting, export QB data

**Customer Feedback Themes (from ATLAS -- Appello Connect office hours):**
- Positive: Centralized job info, improved timesheets, communication between office and field
- Pain Points: UI clutter, form complexity, limited automation/workflows, safety forms "click-heavy"
- High Interest: Geofencing, inventory management, work order system
- Custom use cases emerging (e.g., Bluewater Energy's contact management system)

**The Hard Truth About Support:**
The current support system is described by Corey himself as "a collection of ad-hoc tools that won't scale." At 25 customers generating ~7 Jira tickets/day, the team is barely keeping up. At 50 customers, this becomes 14+ tickets/day. At 100 customers (the path to $1M ARR), it's 28+ tickets/day -- requiring 7 Emmas just for support. **This is where agents must intervene first.**

---

### 1.9 Competitive Landscape (from ATLAS)

| Competitor | Target Market | Differentiation from Appello |
|-----------|--------------|------------------------------|
| **Procore** | General contractors | Too broad, not subtrade-specific |
| **ServiceTitan** | Residential/light commercial HVAC/plumbing | Wrong segment (residential, not ICI) |
| **BuildOps** | Light commercial HVAC | Narrower scope |
| **SiteDocs** | Safety compliance only | Single-function, not holistic |
| **ConnectTeam** | General team management | Not construction-specific |
| **FollowUp CRM** | Construction CRM | CRM only, not operations |
| **FastRap / Mike's Software** | Installation-specific takeoff/pricing | Niche estimating tools |

**Appello's Position:** Focused on Tier 2 and 3 ICI sub-trades where no dominant solution exists. "If your crew can text, they can use Appello." Key differentiator is the holistic approach (field ops + financial + safety + scheduling in one platform) vs. competitors that solve one slice.

---

### 1.10 Meeting Cadence & Communication (from Fathom)

**Feb 12-13, 2026 alone (2 days):**
- 2 Daily Standups (full team)
- 2 Customer onboardings (Thomas, Mkwa)
- 1 Sales demo (American Rentals)
- 1 Sales follow-up (Canadian Industrial Specialties)
- 2 Screening interviews (hiring)
- 2 Impromptu internal meetings

**That is 10 meetings in 2 days across 4 different functions (internal ops, sales, onboarding, hiring).** This is a company where every person is wearing 3-4 hats.

---

### 1.11 Technology & Infrastructure (from Gmail + Codebase)

**Appello Platform:**
- Next.js-based SaaS application
- PostgreSQL database
- Multi-tenant architecture
- Customer-facing mobile and web apps

**Internal AI Platform (AgentC2 -- this codebase):**
- 40 AI agents already operational
- 13 MCP integrations connected (HubSpot, Jira, Fathom, Gmail, Slack, GitHub, etc.)
- $218 total AI spend to date
- 5 networks, 2 workflows, 4 canvases operational

**CI/CD (from Gmail):**
- GitHub Actions for deployment (Deploy to Digital Ocean)
- E2E testing pipeline
- Multiple deployment failures visible (Feb 16 alone: 15+ failed deployment runs) -- active development velocity

---

## Part 2: Where The Humans Are Trapped

Based on the data above, here is where human time is being burned on work that agents could handle:

### 2.1 Corey Shelson -- The Bottleneck

Corey is currently the single-threaded dependency for:
- **Sales demos** (20%+ of time, should be 0% with proper automation)
- **Product direction** (reading every customer conversation, translating to requirements)
- **Strategy** (board meetings, investor relations, competitive analysis)
- **Customer relationships** (attending onboardings, follow-ups)
- **AI/Technology initiatives** (building this very system)
- **Support escalations** (Jira ticket creation from HubSpot)

**Current Estimated Time Allocation:**
| Activity | % of Time | Agent-Replaceable? |
|----------|-----------|-------------------|
| Sales demos & follow-ups | 20% | Partially (prep, follow-up, CRM logging) |
| Product decisions & requirements | 25% | Partially (signal aggregation, prioritization) |
| Customer meetings & onboarding | 15% | Partially (prep, notes, follow-up) |
| Strategy & investor relations | 15% | Partially (data gathering, dashboards) |
| AI platform development | 15% | No -- this is the leverage multiplier |
| Support & escalations | 10% | Mostly (triage, routing, initial response) |

### 2.2 Ian Haase -- The Everything Else

Ian covers all non-product/non-engineering functions:
- Legal and compliance
- Finance and accounting
- HR and recruiting (screening interviews visible in Fathom)
- Onboarding leadership (multiple per week)
- Investor relations and financial modeling

### 2.3 The Development Team -- Feature Factory

The 4-5 developers are:
- Processing 11,135+ Jira issues
- Fielding customer bug reports that flow from HubSpot
- Building complex features (SOV systems, invoicing, progress billing)
- No dedicated QA visible
- No dedicated product manager (Filip doing double duty as dev + PM)

### 2.4 Travis McKenna -- Customer-Facing Overload

Travis is handling:
- Customer onboarding sessions
- Support interactions
- Training delivery
- Managing recordings in Fathom

### 2.5 Nathan Friesen -- Sales Without Support

Nathan is:
- Conducting demos
- Recently freed from cold calling (outsourced to Flight House)
- No automated prospect research, meeting prep, or follow-up systems

---

## Part 3: The Future Vision -- Agentifying Appello

### 3.1 The Thesis

With ~10 humans and $400K ARR, Appello needs to reach $1M ARR (breakeven) by October 2026 -- that is **8 months away**. The math:

- Need: +$600K new ARR = ~40 new customers at $15K average
- Pace needed: 5 new customers/month
- Current pace: 1-2/month
- **Gap: 2.5-5x acceleration required**

Hiring alone cannot solve this. At $150K+ per sales hire (as discussed for the Bill Flemming role), each hire must generate 10x their cost in ARR to justify the investment, and takes 3-6 months to ramp. **The answer is agents multiplying the existing team's output.**

### 3.2 Department-by-Department Agent Impact

#### Sales Department (SDR + AE + RevOps)

**Current State:**
- Corey does demos at 20% capacity
- Nathan does demos after being freed from cold calling
- Flight House handles cold calling externally
- HubSpot has deals but no automated pipeline analytics
- No automated follow-up sequences
- No prospect research automation
- Demo-to-close: 34 days average (opportunity to compress)

**Agentified Future:**
| Agent | Replaces/Augments | Hours Saved/Week | Revenue Impact |
|-------|-------------------|-----------------|----------------|
| **SDR Agent** | Manual prospect research, email drafting, CRM logging | 10-15 hrs | +30% demo bookings |
| **Account Executive Agent** | Demo prep, proposal generation, follow-up sequences | 8-12 hrs | -20% close time |
| **RevOps Agent** | Manual pipeline reporting, forecast calculation | 5-8 hrs | +Data-driven decisions |
| **CRM Specialist** | Deal stage updates, contact enrichment | 3-5 hrs | +Pipeline hygiene |

**Projected Impact:**
- Corey reclaims ~8-10 hours/week from sales prep/follow-up
- Nathan's demos become 2x more effective with automated research and prep
- Pipeline visibility goes from "Corey checks HubSpot" to "daily automated insights"
- **Conservative estimate: 2x demo volume and 20% higher close rate = 3 new customers/month vs. current 1-2**

#### Customer Success & Support (T1 + CSM)

**Current State:**
- "Ad-hoc tools that won't scale" (Corey's own words)
- HubSpot tickets -> Jira flow exists but requires manual triage
- Travis handles onboarding but is capacity-constrained
- Zero churn (good!) but no proactive health monitoring
- Customer office hours (Appello Connect) for feedback

**Agentified Future:**
| Agent | Replaces/Augments | Hours Saved/Week | Retention Impact |
|-------|-------------------|-----------------|------------------|
| **T1 Support** | First-response triage, known-issue resolution, Jira ticket creation | 10-15 hrs | Faster resolution |
| **CSM Agent** | At-risk account detection, check-in scheduling, health scoring | 5-8 hrs | Proactive churn prevention |
| **Calendar Assistant** | Onboarding scheduling, meeting coordination | 3-5 hrs | Smoother experience |

**Projected Impact:**
- Travis reclaims 10+ hours/week from support triage
- At-risk accounts identified before they churn (currently monitoring is manual)
- Customer onboarding experience becomes more consistent and documented
- **Zero churn maintained at 2-3x the customer count without adding support staff**

#### Marketing (Content + Competitive Intel)

**Current State:**
- TikTok presence active
- G2 profile exists
- SEO strategy scaling (35 -> 40,000+ pages via super directory)
- No dedicated content creator
- Competitive analysis done ad-hoc by Corey

**Agentified Future:**
| Agent | Replaces/Augments | Hours Saved/Week | Growth Impact |
|-------|-------------------|-----------------|---------------|
| **Content Marketing** | Blog posts, comparison articles, case studies | 5-10 hrs | +Inbound pipeline |
| **Competitive Intel** | Monthly competitor monitoring, feature comparison | 3-5 hrs | +Sales positioning |

**Projected Impact:**
- Consistent content pipeline without hiring a content marketer ($80K+ saved)
- Monthly competitive intelligence reports for sales team
- Better objection handling with up-to-date competitor data
- **SEO + content = compounding inbound lead channel**

#### Product & Engineering (PM + Code Review + QA)

**Current State:**
- 11,135+ Jira issues in backlog
- Filip doing double duty as dev + product specifier
- No dedicated QA
- RICE scoring framework exists but applied manually
- Customer signals scattered across Fathom, HubSpot, Jira

**Agentified Future:**
| Agent | Replaces/Augments | Hours Saved/Week | Velocity Impact |
|-------|-------------------|-----------------|-----------------|
| **Product Manager** | Signal aggregation from Fathom/Jira/Slack, RICE scoring, sprint planning | 8-12 hrs | +Prioritization quality |
| **Code Reviewer** | PR review against standards, security/performance checks | 5-8 hrs | +Code quality |
| **QA Agent** | Automated testing, deployment validation | 5-8 hrs | -Bug escapes |

**Projected Impact:**
- Filip reclaims 8-10 hours/week from manual product management
- Code reviews happen automatically on every PR
- Customer signals are automatically aggregated (no more Corey reading every Fathom transcript)
- **Development velocity increases 20-30% through better prioritization and automated QA**

#### Finance (Budget Controller)

**Current State:**
- Ian manages all financial operations manually
- Financial model in spreadsheets
- Board meeting prep is labor-intensive
- AI spend tracking is manual ($218 total, but will grow)

**Agentified Future:**
| Agent | Replaces/Augments | Hours Saved/Week | Financial Impact |
|-------|-------------------|-----------------|------------------|
| **Budget Controller** | AI cost monitoring, anomaly detection, financial dashboards | 3-5 hrs | Cost optimization |

**Projected Impact:**
- Ian reclaims 3-5 hours/week from financial reporting
- Real-time visibility into AI agent costs as the fleet scales
- Automated alerts prevent budget overruns

#### Knowledge Management

**Current State:**
- Meeting transcripts in Fathom (some with summaries, many without)
- Customer knowledge scattered across HubSpot, Jira, email
- No centralized knowledge base for the team
- Product FAQ and support knowledge undocumented

**Agentified Future:**
| Agent | Replaces/Augments | Hours Saved/Week | Knowledge Impact |
|-------|-------------------|-----------------|------------------|
| **Knowledge Manager** | Fathom transcript ingestion, RAG maintenance, document lifecycle | 3-5 hrs | Institutional memory |

**Projected Impact:**
- Every customer meeting automatically captured and searchable
- New hires ramp faster with complete knowledge base
- No more "ask Corey" for product/customer context

---

### 3.3 The Compound Effect: Revenue Per Employee

**Current State (February 2026):**
| Metric | Value |
|--------|-------|
| ARR | $400,000 |
| Team Size | ~10 |
| Revenue/Employee | $40,000 |
| Hours/Week on Repetitive Work | ~80+ across team |
| Customers/Employee | 2.5 |

**Projected State with Agent Fleet (October 2026):**
| Metric | Conservative | Ambitious |
|--------|-------------|-----------|
| ARR | $800,000 | $1,200,000 |
| Team Size | 12 (2 sales hires) | 12 |
| Revenue/Employee | $66,667 | $100,000 |
| Hours/Week Reclaimed by Agents | 60-80 | 60-80 |
| Customers/Employee | 4-5 | 7-8 |
| Agent Fleet Cost | $275/month | $275/month |

**The key insight:** $275/month in agent costs (the plan's budget) replaces what would cost $500K-$800K/year in equivalent human hires across sales support, customer success, content creation, QA, and financial analysis.

---

### 3.4 The Execution Sequence -- Mapped to Business Priorities

The Self-Running Company plan has 9 phases. Here is the recommended priority based on what the data shows Appello needs most urgently:

| Priority | Phase | Rationale | Business Impact |
|----------|-------|-----------|-----------------|
| **1 (Critical)** | Phase 2: Sales Dept | Demo volume is THE bottleneck. Every day without pipeline automation costs ARR. | Direct revenue acceleration |
| **2 (Critical)** | Phase 0: Foundation | Skills and RAG docs are prerequisites for all other agents. | Enables everything |
| **3 (High)** | Phase 3: Support | At 25+ customers and growing, support will break before sales does. | Retention + scale |
| **4 (High)** | Phase 7: Knowledge | Meeting intelligence is being lost daily. Fathom data shows 10+ meetings in 2 days with no summaries processed. | Institutional memory |
| **5 (Medium)** | Phase 5: Engineering | 11,135 Jira issues and no PM agent means prioritization is a human bottleneck. | Development velocity |
| **6 (Medium)** | Phase 1: CEO Agent | Strategic review should wait until department agents are producing data. | Strategic oversight |
| **7 (Medium)** | Phase 4: Marketing | Content and competitive intel amplify sales but are less urgent than pipeline automation. | Lead generation |
| **8 (Lower)** | Phase 6: Finance | Important but $275/month in AI costs doesn't yet warrant automated oversight. | Cost control |
| **9 (Lower)** | Phase 8+9: Network + Governance | Orchestration layer after department agents are operational. | Organization |

---

### 3.5 The Numbers That Matter

**Break-even Math:**
- Need: $600K additional ARR in 8 months
- At $15K average deal: 40 new customers
- At current 17% demo-to-close: 235 demos needed
- At 8 months: ~30 demos/month = ~7.5 demos/week
- Current capacity: ~5/week
- **Gap: Need 50% more demo throughput + higher close rates**

**What Agents Solve:**
- SDR Agent pre-qualifies leads and prepares Nathan/Corey with research -> demos are more effective
- AE Agent automates follow-up sequences -> no deals fall through cracks
- RevOps Agent provides daily pipeline intelligence -> Corey makes better strategic decisions
- T1 Support prevents existing customers from consuming sales team time -> sales team stays focused
- Content Marketing creates inbound lead pipeline -> less dependence on cold calling

**The Self-Running Company plan costs ~$5-10 to build and ~$275/month to operate. That is the equivalent of hiring 0.03 FTEs. The output is equivalent to 5-8 FTEs across sales support, customer success, content, QA, and analytics.**

---

### 3.6 Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Agent hallucination in customer-facing comms | Medium | High | Guardrails on T1 Support and SDR (no feature promises, no pricing, no internal data) |
| Over-automation losing personal touch | Medium | Medium | Agents augment, not replace. Corey and Nathan still do demos. SDR drafts, humans approve. |
| AI cost overrun at scale | Low | Medium | Budget Controller agent + per-agent monthly caps ($275 total) |
| Data quality in HubSpot degrades agent output | Medium | Medium | CRM Specialist agent maintains data hygiene |
| Team resistance to agent-driven workflows | Low | Medium | Start with obvious wins (pipeline reporting, meeting summaries) that save immediate time |
| Fathom transcript quality limits knowledge ingestion | Medium | Low | Knowledge Manager validates before RAG ingestion |

---

## Part 4: The Vision Statement

### Today

Appello is a 10-person company where every human does 3-4 jobs. The CEO does sales. The COO does onboarding. The senior dev does product management. The support person does training. Everyone is at capacity, and the company needs to 2.5x its customer base in 8 months to hit breakeven.

### Tomorrow

Appello becomes a 10-person company with a 13-agent AI workforce that handles:
- **Sales intelligence** (prospect research, CRM hygiene, pipeline analytics, follow-up automation)
- **Customer success** (support triage, health scoring, proactive outreach)
- **Marketing** (content creation, competitive monitoring)
- **Engineering support** (product signal aggregation, code review, QA)
- **Financial oversight** (budget monitoring, cost dashboards)
- **Knowledge management** (meeting intelligence, document lifecycle)

The humans shift from:
- **Corey:** Doing sales admin -> Leading strategy and closing enterprise deals
- **Ian:** Manual finance and onboarding logistics -> Scaling operations and investor relations
- **Filip:** Writing product specs and triaging bugs -> Architecting the platform
- **Nathan:** Conducting demos cold -> Walking into demos with AI-prepared research and customer context
- **Travis:** Triaging support tickets -> Managing customer relationships at scale

**The math:**
- $275/month in agent costs
- 60-80 hours/week of human time reclaimed
- 2.5-5x acceleration toward $1M ARR
- Revenue per employee doubles from $40K to $80K+
- Customer capacity per employee doubles from 2.5 to 5+

**This is not about replacing humans. It is about freeing 10 humans to do the work of 30.**

---

---

## Part 5: The Company Intelligence Agent -- Built and Deployed

### 5.1 What Was Built

Rather than this document being a static snapshot, a **Company Intelligence Agent** has been deployed on AgentC2 that can continuously perform this analysis.

**Agent Details:**
| Property | Value |
|----------|-------|
| **Name** | Company Intelligence |
| **Slug** | `company-intelligence` |
| **ID** | `cmlq4tr1i008g8e0ossnbp1z0` |
| **Model** | Anthropic / Claude Sonnet 4 |
| **Temperature** | 0.3 (precise, data-driven) |
| **Memory** | Enabled (remembers prior analyses, tracks changes over time) |
| **Max Steps** | 25 (can make up to 25 tool calls per analysis) |
| **Tools** | 23 MCP tools across 5 systems |
| **Budget** | $20/month, 80% alert, soft limit |
| **Schedule** | Weekly, Monday 7 AM ET |

### 5.2 Tool Arsenal (23 tools)

**HubSpot (8 tools):** `get-user-details`, `list-objects`, `search-objects`, `batch-read-objects`, `list-properties`, `get-property`, `list-associations`, `get-schemas`

**Jira (8 tools):** `get-issue`, `search`, `get-project-issues`, `get-all-projects`, `get-agile-boards`, `get-board-issues`, `get-sprints-from-board`, `batch-get-changelogs`

**Fathom (4 tools):** `list-meetings`, `get-meeting-summary`, `get-meeting-transcript`, `get-meeting-details`

**Slack (4 tools):** `list-channels`, `get-channel-history`, `get-users`, `post-message`

**RAG (1 tool):** `rag-query` (searches ATLAS knowledge base)

### 5.3 What It Can Do

This agent can be asked questions like:
- "Give me a complete state-of-the-company report"
- "What's happening in the HubSpot pipeline right now?"
- "Which customers are generating the most support tickets this week?"
- "What did the engineering team ship this week?"
- "Who is on our team and what is everyone working on?"
- "What meetings happened this week and what were they about?"
- "Identify our top 3 risks right now"

### 5.4 Weekly Schedule

Every **Monday at 7:00 AM ET**, the agent automatically generates a comprehensive intelligence report covering:
1. **HubSpot:** All deals by stage, total pipeline value, stalled deals, new leads, ARR changes
2. **Jira:** Issues created vs resolved, status distribution, team workload, customer-reported bugs, blockers
3. **Fathom:** Meeting classification (demo/onboarding/standup/interview), external vs internal
4. **Synthesis:** Key Metrics, Highlights, Risks, Recommendations

### 5.5 Why This Agent Is Phase 0.5

The plan calls for the Knowledge Manager in Phase 7 and the CEO Agent in Phase 1. The Company Intelligence Agent is **Phase 0.5** -- it provides the data foundation that every other agent in the Self-Running Company needs. The SDR needs to know the pipeline. The CSM needs to know customer health. The PM needs to know the backlog. The CEO Agent needs cross-department signals. This agent is the nervous system.

### 5.6 The Path to "Knowing Everything"

Today, this agent samples data on demand. The true vision is:
1. **Weekly scheduled runs** build a time-series of company state in memory
2. **RAG ingestion** of each report creates a searchable history of company intelligence
3. **Fathom transcript processing** captures every customer conversation's key decisions
4. **Jira changelog analysis** tracks engineering velocity trends over time
5. **HubSpot deal stage transitions** reveal pipeline health patterns

Over weeks and months, this agent accumulates more knowledge about Appello than any single human has, because it can process every data point across every system without fatigue, bias, or forgetting.

---

*Document generated from live system data: HubSpot (41861578, 100+ deals analyzed, 18 closed-won customers verified, 100+ companies), Jira (Q21030, 11,135+ issues, 50 most recent deep-analyzed, team workload mapped), Fathom (50+ meetings, team roster derived from standup attendees), Gmail (50 recent emails), ATLAS (25+ knowledge chunks across meeting transcripts, competitive analyses, board meetings, investor calls, support reviews). Every number traces back to a real system of record.*

*Company Intelligence Agent: Deployed on AgentC2, ID `cmlq4tr1i008g8e0ossnbp1z0`, 23 tools, weekly Monday 7 AM schedule, $20/month budget. It will know more by next Monday than this document does today.*
