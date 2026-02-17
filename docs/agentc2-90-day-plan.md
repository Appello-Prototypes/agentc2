# AgentC2 — 90-Day Plan

**Start:** February 7, 2026
**End:** May 8, 2026 (13 weeks)
**Objective:** First paying Intelligence customers + public platform live with free tier + Product Hunt launched

---

## The 90-Day Scoreboard

| Milestone                                    | Target Date | Metric                                   |
| -------------------------------------------- | ----------- | ---------------------------------------- |
| Appello MCP server live (20 read-only tools) | March 6     | Tools callable from AgentC2              |
| First recipe running on Appello's own data   | March 13    | Morning Dispatch output delivered        |
| Recipe gallery live on agentc2.ai            | March 20    | 8 recipes browseable publicly            |
| 5 pilot customers connected to Intelligence  | April 3     | Receiving daily output via Slack/email   |
| Stripe billing functional                    | March 6     | Test charge processed                    |
| Free tier + self-serve signup live           | April 10    | New user can sign up and deploy a recipe |
| PostHog tracking deployed                    | February 21 | Events flowing                           |
| Product Hunt launch                          | May 1       | Listed and promoted                      |
| 5 pilots converted to paid ($250/month each) | May 8       | $15K ARR added                           |
| 10 more customers rolling onto Intelligence  | May 8       | 15 total Intelligence customers          |
| 100+ free platform signups                   | May 8       | Organic + PH                             |

---

## Week 1: February 7-13 — Decisions and Specs

**Theme:** Lock the plan. Assign owners. Spec everything before building anything.

| #   | Action                                                                                                                                          | Owner                | Deliverable                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------- |
| 1   | Approve GTM strategy and assign Track A / Track B ownership                                                                                     | Corey                | Written confirmation of who owns what |
| 2   | Travis specs 20 MVP Appello MCP tools — list each tool name, API endpoint it maps to, request/response schema                                   | Travis               | MCP spec document                     |
| 3   | Identify which Appello REST API endpoints already exist vs. need to be built for the 20 tools                                                   | Travis + Appello eng | Gap analysis                          |
| 4   | Spec recipe data model (TypeScript interface: id, name, tagline, category, platforms, ICP, steps, valueMetric)                                  | Engineering          | Interface committed to codebase       |
| 5   | Corey/Nathan call Vanos and Thermec this week — casual seed-planting: "We're building an AI layer on top of Appello, you'll be first to see it" | Corey/Nathan         | Verbal interest confirmed             |
| 6   | Write copy for 8 public recipes (name, tagline, pain point, value metric, step-by-step flow, platforms)                                         | Corey + AI           | 8 recipe briefs in docs/              |

**Track A exit criteria:** MCP spec document complete with all 20 tools mapped to API endpoints.
**Track B exit criteria:** Recipe data model interface and 8 recipe briefs written.

---

## Week 2: February 14-20 — Foundation Build Begins

**Theme:** Start building both tracks in parallel. Infrastructure first.

| #   | Action                                                                                                                 | Owner               | Deliverable                          |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------ |
| 1   | Begin Appello MCP server skeleton — project setup, multi-tenant auth routing (customer_id → instance_url), healthcheck | Travis              | MCP server repo with auth + /healthz |
| 2   | Begin extending Appello REST API for missing endpoints (scheduling, safety, training modules)                          | Appello engineering | First 3-5 new endpoints deployed     |
| 3   | Install and configure PostHog (self-hosted or cloud) — track page views, signups, recipe views                         | Engineering         | PostHog live on agentc2.ai           |
| 4   | Begin Stripe integration — customer creation, subscription management, webhook handling                                | Eric/Chris          | Stripe SDK wired, test mode working  |
| 5   | Begin RecipeCard component — platform logos, tagline, value metric, CTA button                                         | Emma                | Component in Storybook               |
| 6   | Call All Temp (Darren Sloan) and R.A. Barnes (Louise Metcalfe) — plant Intelligence seed                               | Corey/Nathan        | Verbal interest confirmed            |

**Track A exit criteria:** MCP server skeleton deployed with auth routing.
**Track B exit criteria:** PostHog live. Stripe in test mode. RecipeCard component rendered.

---

## Week 3: February 21-27 — MCP Tools + Recipe Gallery

**Theme:** First MCP tools callable. Recipe gallery taking shape.

| #   | Action                                                                                                          | Owner               | Deliverable                              |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------- |
| 1   | Implement first 10 MCP tools — timesheets, financials, project, CRM (modules where REST API exists)             | Travis              | 10 tools passing integration tests       |
| 2   | Continue extending REST API — scheduling reads, safety form reads                                               | Appello engineering | 5+ more endpoints                        |
| 3   | Build RecipeGallery component — filterable grid (by department, by platform, by business size)                  | Emma                | Gallery page rendering 8 recipes         |
| 4   | Build RecipeDetail page — full recipe with flow visualization, platform logos, ROI section, CTA                 | Emma                | Detail page for Deal Copilot as template |
| 5   | Stripe billing complete — subscription creation, plan tiers (Free/Starter/Pro), payment processing              | Eric/Chris          | Successful test payment end-to-end       |
| 6   | Call Rival Insulation (Chris Tremberth) — seed Intelligence. This is strategic: NIA president-elect + investor. | Corey               | Conversation completed                   |

**Track A exit criteria:** 10 MCP tools callable from AgentC2.
**Track B exit criteria:** Recipe gallery page rendering with filtering. Stripe processing test payments.

---

## Week 4: March 1-6 — MCP Complete + Landing Page Soft Launch

**Theme:** Appello MCP hits 20 tools. agentc2.ai recipe page goes live.

| #   | Action                                                                                 | Owner             | Deliverable                                                |
| --- | -------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------- |
| 1   | Complete remaining 10 MCP tools — scheduling, safety, training, equipment, reporting   | Travis            | 20 tools total, all passing tests                          |
| 2   | Test full MCP against Appello's own production instance                                | Travis + Corey    | All 20 tools return correct data for Appello's own account |
| 3   | Recipe gallery live on agentc2.ai — 8 recipes browseable publicly, no signup required  | Emma + Eric/Chris | URL live, visitable                                        |
| 4   | Updated hero section — tool selector + role selector → personalized recipe suggestions | Emma              | Hero section deployed                                      |
| 5   | Integration bar updated with all 30+ platform logos                                    | Emma              | Visible on landing page                                    |
| 6   | Usage metering — run counter per user, agent counter per org                           | Engineering       | Metering recording to database                             |

**MILESTONE: Appello MCP server live with 20 read-only tools.**
**MILESTONE: agentc2.ai recipe landing page live and publicly browseable.**

---

## Week 5: March 7-13 — First Recipe End-to-End

**Theme:** Morning Dispatch Intelligence runs on Appello's own data. Prove the loop.

| #   | Action                                                                                                                    | Owner          | Deliverable                               |
| --- | ------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------- |
| 1   | Build Morning Dispatch Intelligence recipe — agent config, MCP tool calls, output template, Inngest schedule (5 AM daily) | Corey + Travis | Recipe running on Appello's own data      |
| 2   | Build Timesheet Compliance Monitor recipe — missing timesheets, unapproved timesheets, Inngest schedule (Monday 6 AM)     | Corey          | Recipe running on Appello's own data      |
| 3   | Deliver Morning Dispatch output via Slack and email — verify formatting, accuracy, usefulness                             | Corey          | Corey receives and validates output daily |
| 4   | Free tier signup flow — email registration, org creation, 1 agent / 1 recipe / 100 runs limits                            | Engineering    | New user can sign up on agentc2.ai        |
| 5   | OAuth connect flow for public recipes — 1-click connect for Gmail, Slack, HubSpot, Google Calendar                        | Engineering    | OAuth flow working for 4 platforms        |
| 6   | Begin writing "How we run our business with AI agents" blog post (dogfooding narrative for PH launch)                     | Corey + AI     | Draft complete                            |

**MILESTONE: First Appello Intelligence recipe (Morning Dispatch) running end-to-end, delivering real insights from real data.**

---

## Week 6: March 14-20 — All 5 MVP Recipes + Self-Serve

**Theme:** Complete Track A recipe set. Track B self-serve functional.

| #   | Action                                                                                                                             | Owner       | Deliverable                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------- |
| 1   | Build Job Profitability Early Warning recipe                                                                                       | Corey       | Recipe running on Appello data                    |
| 2   | Build Safety Form Trend Analyzer recipe                                                                                            | Corey       | Recipe running on Appello data                    |
| 3   | Build Certification Expiry Countdown recipe                                                                                        | Corey       | Recipe running on Appello data                    |
| 4   | Self-serve recipe activation — pick recipe → connect platforms → configure delivery → deploy                                       | Engineering | End-to-end flow working for at least Deal Copilot |
| 5   | OAuth connect flow for remaining platforms — Jira, GitHub, Fathom, Intercom, Sentry                                                | Engineering | OAuth working for 9+ platforms                    |
| 6   | Prepare pilot onboarding package — what Intelligence is, what they'll receive, how to give feedback, Slack channel for pilot group | Corey       | Onboarding doc + Slack channel created            |

**Track A exit criteria:** 5 recipes running and validated on Appello's own data for 1+ week.
**Track B exit criteria:** A new user can sign up, connect tools, and deploy a recipe without assistance.

---

## Week 7: March 21-27 — Pilot Onboarding Begins

**Theme:** First external customer data flowing through Intelligence.

| #   | Action                                                                                                                              | Owner          | Deliverable                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------- |
| 1   | Connect Vanos Insulations — provision MCP credentials, configure instance routing, activate Morning Dispatch + Timesheet Compliance | Travis + Corey | Vanos receiving daily output    |
| 2   | Connect Thermec Insulation — same setup                                                                                             | Travis + Corey | Thermec receiving daily output  |
| 3   | Connect All Temp Insulations — same setup                                                                                           | Travis + Corey | All Temp receiving daily output |
| 4   | Daily Slack check-in with each connected pilot — is the output accurate? Useful? What's missing?                                    | Corey          | Feedback log started            |
| 5   | Begin platform-specific SEO pages: /solutions/hubspot, /solutions/slack, /solutions/jira                                            | Emma           | At least 3 pages live           |
| 6   | Onboarding email sequence for free signups who haven't activated a recipe                                                           | Engineering    | 3-email sequence configured     |

---

## Week 8: March 28 - April 3 — All 5 Pilots Live

**Theme:** Complete pilot cohort connected. Fix issues fast.

| #   | Action                                                                                                              | Owner          | Deliverable                                     |
| --- | ------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------- |
| 1   | Connect R.A. Barnes Electrical                                                                                      | Travis + Corey | R.A. Barnes receiving daily output              |
| 2   | Connect Rival Insulation (Chris Tremberth)                                                                          | Travis + Corey | Rival receiving daily output                    |
| 3   | Activate remaining recipes for all 5 pilots (Job Profitability, Safety Trends, Cert Countdown) as each is validated | Corey          | All 5 pilots on 3-5 recipes each                |
| 4   | Issue tracker: log every inaccuracy, false alert, missing data, formatting problem from pilot feedback              | Corey          | Issue list with severity                        |
| 5   | Fix critical issues from pilot feedback — recipe accuracy must hit 95%+                                             | Travis + Corey | Accuracy baseline established                   |
| 6   | Track B: Deal Copilot and Inbox Zero recipes fully functional as self-serve deployments                             | Engineering    | 2 recipes deployable end-to-end by public users |

**MILESTONE: 5 pilot customers connected and receiving daily Appello Intelligence output.**

---

## Week 9: April 4-10 — Stabilize + Scale Recipes

**Theme:** Pilots stable for 1+ week. Begin rolling to next customers. Free tier fully functional.

| #   | Action                                                                                           | Owner        | Deliverable                          |
| --- | ------------------------------------------------------------------------------------------------ | ------------ | ------------------------------------ |
| 1   | Pilot stability check — all 5 pilots receiving accurate output daily for 7+ consecutive days     | Corey        | Stability confirmed or issues logged |
| 2   | Capture first pilot quotes/testimonials — "What has Intelligence changed for you this week?"     | Corey/Nathan | At least 2 usable quotes             |
| 3   | Mention Intelligence on regular check-in calls with next 5 customers — show pilot output as demo | Corey/Nathan | 5 new verbal commitments             |
| 4   | Track B: Free tier fully functional — signup, connect, deploy, run, hit limit, upgrade prompt    | Engineering  | Complete free-to-paid funnel working |
| 5   | Track B: All 8 public recipes functional as self-serve deployments                               | Engineering  | 8 recipes deployable                 |
| 6   | Product Hunt launch prep — screenshots, product description, maker profile, launch day plan      | Corey        | PH draft listing ready for review    |

**MILESTONE: Free tier fully functional on agentc2.ai.**

---

## Week 10: April 11-17 — Expansion Wave 1

**Theme:** Next 5 customers onboarding. Product Hunt prep finalized.

| #   | Action                                                                                                                             | Owner              | Deliverable                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------- |
| 1   | Connect customers 6-10 to Appello Intelligence (from verbal commitments in Week 9)                                                 | Travis + Corey     | 10 total customers on Intelligence |
| 2   | Begin $250/month billing conversation with 5 original pilots — "Free month is ending, here's what you've received"                 | Corey/Nathan + Ian | Billing terms agreed with 5 pilots |
| 3   | Build remaining 5 Track A recipes (Equipment Inspection, Progress Billing, Executive Dashboard, OT Prevention, Estimate Follow-Up) | Corey              | 10 total construction recipes      |
| 4   | Finalize Product Hunt listing — screenshots, video demo (30 sec), launch copy, upvote strategy                                     | Corey              | PH listing submitted for review    |
| 5   | Publish blog post: "How we run our construction company with AI agents"                                                            | Corey              | Live on agentc2.ai/blog            |
| 6   | Set up monitoring/alerting for Intelligence delivery — if a recipe fails to deliver, Slack alert to Corey                          | Engineering        | Alert system live                  |

---

## Week 11: April 18-24 — First Revenue + PH Final Prep

**Theme:** First Intelligence invoices go out. Product Hunt launch imminent.

| #   | Action                                                                                               | Owner        | Deliverable                                   |
| --- | ---------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------- |
| 1   | Invoice 5 original pilots — $250/month Starter tier                                                  | Ian          | 5 invoices sent, $1,250/month MRR             |
| 2   | Connect customers 11-15 to Intelligence                                                              | Corey/Nathan | 15 total customers                            |
| 3   | Begin writing Vanos case study — before/after metrics, quote from Matt Vanos or Ron Kustermans       | Corey + AI   | Draft complete                                |
| 4   | Product Hunt launch day scheduled — coordinate upvote support, social media posts, community seeding | Corey        | Launch date confirmed (target: Week 12 or 13) |
| 5   | LinkedIn content push — 3 posts about AgentC2 targeting VPs of Sales, Ops, Engineering               | Corey        | Posts scheduled                               |
| 6   | Google Ads test — $1K budget on "HubSpot AI automation", "Slack AI agent", "Jira AI bot" keywords    | Corey        | Campaigns live                                |

**MILESTONE: First AgentC2 revenue. $15K ARR from 5 paying Intelligence customers.**

---

## Week 12: April 25 - May 1 — Product Hunt Launch

**Theme:** Go public. Maximum noise.

| #   | Action                                                                                                                                         | Owner        | Deliverable                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------- |
| 1   | **Product Hunt launch day** — "AgentC2: AI agents that connect your existing tools. 30+ integrations, pre-built recipes, deploy in 5 minutes." | Corey        | Listed and live                  |
| 2   | Social media blitz — LinkedIn, Twitter/X, Reddit (r/SaaS, r/startups, r/artificial), Hacker News                                               | Corey        | Posts live across all channels   |
| 3   | Dev community seeding — relevant Discord/Slack groups, indie hacker forums                                                                     | Corey        | 10+ community posts              |
| 4   | Monitor PH launch — respond to every comment, answer questions, share additional context                                                       | Corey        | 100% comment response rate       |
| 5   | Monitor free signups — PostHog dashboard tracking signups, recipe views, activations, OAuth connects                                           | Engineering  | Real-time dashboard              |
| 6   | Continue Intelligence rollout — customers 11-15 fully onboarded, receiving all applicable recipes                                              | Corey/Nathan | 15 stable Intelligence customers |

**MILESTONE: Product Hunt launched. Public awareness established.**

---

## Week 13: May 2-8 — Consolidate and Measure

**Theme:** First 90 days complete. Measure everything. Plan the next 90.

| #   | Action                                                                                                                                                             | Owner | Deliverable                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ------------------------------------- |
| 1   | 90-day scorecard review — measure every metric against targets                                                                                                     | Corey | Scorecard filled in                   |
| 2   | Invoice customers 6-10 for Intelligence ($250/month)                                                                                                               | Ian   | 10 paying customers, $2,500/month MRR |
| 3   | Publish Vanos case study on agentc2.ai and useappello.com                                                                                                          | Corey | Case study live                       |
| 4   | Analyze PH launch results — signups, activations, paid conversions, traffic sources                                                                                | Corey | PH retrospective                      |
| 5   | Analyze Google Ads test — CPC, signups, CAC. Kill or scale.                                                                                                        | Corey | Decision: continue or stop paid ads   |
| 6   | Plan next 90 days — expand to 20 Intelligence customers, scale to 200+ free platform users, begin second case study, begin paid acquisition if PH validated demand | Corey | Next-90-day plan written              |

**MILESTONE: 90 days complete. 15 Intelligence customers (5 paying). Platform live with free tier. Product Hunt launched.**

---

## Resource Allocation Summary

| Person                           | Track A (%)  | Track B (%) | Appello Core (%) |
| -------------------------------- | ------------ | ----------- | ---------------- |
| **Travis**                       | 80%          | 0%          | 20%              |
| **Emma**                         | 0%           | 50%         | 50%              |
| **Eric or Chris**                | 0%           | 40%         | 60%              |
| **Filip**                        | 0%           | 0%          | 100%             |
| **Corey**                        | 30%          | 20%         | 50%              |
| **Nathan**                       | 20%          | 0%          | 80%              |
| **Ian**                          | 5% (billing) | 0%          | 95%              |
| **Kylin**                        | 0%           | 0%          | 100%             |
| **Appello eng (API extensions)** | 20%          | 0%          | 80%              |

**Total effective FTEs on AgentC2:** ~2.5 (Travis 80% + Emma 50% + Eric/Chris 40% + Corey 50% across both + Nathan 20%)

---

## 90-Day Budget

| Item                                                           | Cost               | When       |
| -------------------------------------------------------------- | ------------------ | ---------- |
| Stripe fees (test + early billing)                             | ~$50               | Weeks 2-13 |
| PostHog (cloud free tier or self-hosted)                       | $0                 | Week 2     |
| Google Ads test budget                                         | $1,000             | Week 11    |
| AI costs (recipe execution, 15 customers)                      | ~$75-225/month     | Weeks 5-13 |
| Product Hunt (listing is free)                                 | $0                 | Week 12    |
| Contractor for landing page UI (optional, accelerates Track B) | $5,000-10,000      | Weeks 2-6  |
| **Total (without contractor):**                                | **~$1,500**        |            |
| **Total (with contractor):**                                   | **~$7,500-12,000** |            |

---

## Weekly Checkpoint Questions

Every Friday, answer these five questions:

1. **Track A:** How many MCP tools are working? How many recipes running? How many customers connected?
2. **Track B:** Can a stranger sign up and deploy a recipe without help right now?
3. **Accuracy:** What's the false alert / bad data rate on Intelligence output this week?
4. **Feedback:** What did pilot customers say? What needs to change?
5. **Blockers:** What's stuck? Who's overloaded? What do we cut?

---

## The Only Thing That Matters

At the end of 90 days, two things must be true:

1. **Five construction companies are paying $250/month for Appello Intelligence** — and the output is accurate enough that they'd be upset if you turned it off.

2. **A stranger can visit agentc2.ai, browse recipes, sign up for free, connect their tools, and have an AI agent running in under 10 minutes** — without talking to anyone.

Everything else is sequencing. These two outcomes are the plan.
