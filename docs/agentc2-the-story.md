# The AgentC2 Story

---

Three years ago, Corey Shelson built Appello because he watched construction companies drown in paper. Timesheets scribbled on dashboards of pickup trucks. Safety forms stuffed in filing cabinets. Dispatchers spending their first hour every morning untangling yesterday's mess on a whiteboard. He knew the industry — ICI subcontractors, the mechanical insulators and electricians and sheet metal workers who build the buildings nobody thinks about until the heat stops working — and he knew they deserved better software.

So he built it. And it worked.

Eighteen companies signed up. Zero left. Not one. Vanos Insulations went from three payroll administrators to one. R.A. Barnes eliminated a full-time admin role. Darren Sloan at All Temp called his Appello dashboard "my little command center." The product hit $400K in annual revenue with a small team in London, Ontario — Corey, his COO Ian, a sales rep, a support person, and a handful of developers led by Filip, who personally touches 60% of every line of code that ships.

That's where the story could have ended: a solid vertical SaaS business growing toward a million dollars, serving a niche nobody else cared about. A good business. A small business.

But Corey kept building.

While his team shipped features for construction companies by day, Corey spent nights building something else entirely. He called it Catalyst at first, then renamed it AgentC2. It started as an internal experiment — what if AI agents could run Appello's own operations? What if instead of Corey manually checking HubSpot, reviewing Jira tickets, reading Fathom meeting transcripts, and correlating data across six dashboards every morning, an agent could do it for him?

So he connected the tools. Gmail. Slack. HubSpot. Jira. Fathom. Google Drive. GitHub. Sentry. Thirty integrations in all, wired through the Model Context Protocol so AI agents could read, search, and act across every system the business touches. He built 40 agents. The total AI cost to run all of them: $218. Not per month. Total, to date.

And then the obvious question: if this works for us, why wouldn't it work for our customers?

The answer is that it would. And the path is already paved.

Appello's 20 customers use Appello every day — scheduling crews, logging timesheets, tracking safety forms, managing job costs, billing progress. All of that data sits in Appello's database. Corey's team is already building a RESTful API on top of it, purpose-built for AI agents because the original GraphQL schema is 45,000 lines long — too complex for any model to reason about efficiently. OAuth2 authentication is in candidate release. The plumbing is nearly done.

The plan is to wrap that API in an MCP server — 20 tools to start, covering the five recipes that solve the problems customers complain about most. Travis McKenna, the developer who already built the QuickBooks integration and who Ian and Corey describe as a "rock star," will build it in four weeks. The first recipe, Morning Dispatch Intelligence, will run at 5:00 AM and tell a construction company owner three things before they get to the office: which crews have scheduling conflicts today, who didn't submit timesheets yesterday, and which jobs are trending over budget. The second recipe catches missing timesheets before Monday payroll. The third warns about job cost overruns weeks before the project closes. The fourth spots patterns in hundreds of safety forms that no human has time to read. The fifth alerts when a worker's certification is about to expire — before they show up to a job site and create a compliance violation.

This isn't hypothetical value. Vanos has six support tickets a week. Thermec has six contacts in the system across operations, accounting, and field management. All Temp's president already said the dashboard changed how he runs his company. These people will pay $250 a month for an AI layer on top of software they already love — that's a 20% increase on their average bill, less than what one payroll mistake costs them, and the first month is free.

Five pilots in April. Fifteen customers by June. All twenty by July. That's $90K in new annual revenue from a customer base with zero acquisition cost and zero churn history. And every one of those customers becomes a case study — with real numbers, real names, real hours saved — that feeds the second track.

Because the construction vertical isn't the business. It's the proof.

The business is AgentC2: a public platform at agentc2.ai where anyone — a sales rep drowning in CRM data entry, a support manager buried in tickets, an engineering lead losing velocity to bug triage, a CEO checking six dashboards every morning — can browse a library of pre-built recipes, connect their tools with one click, and have an AI agent running in five minutes. Deal Copilot auto-updates HubSpot after every email and meeting. Ticket Triager classifies and routes support tickets using your own knowledge base. Bug Bouncer turns Sentry errors into Jira tickets with stack traces and suggested fixes before the morning standup. Daily Briefing aggregates your entire business into a two-minute morning read.

Every one of these recipes uses integrations that are already built. HubSpot, Gmail, Slack, Jira, GitHub, Intercom, Sentry, Stripe, Shopify, Fathom, Firecrawl, ElevenLabs — all connected, all tested, all running in production today inside Appello's own operations. The landing page goes live in March. The free tier launches in April. Product Hunt in May. By the time OpenAI, Salesforce, and Microsoft are running their first enterprise pilots for their horizontal agent platforms, AgentC2 will have 35 paying construction customers with documented ROI and 500 free users exploring recipes.

The competitive position is simple: every other AI agent platform is selling a hypothesis. AgentC2 is selling a result. "We saved Vanos Insulations 15 hours a week" beats "imagine what AI could do for your business" in every sales conversation, every landing page, every investor meeting.

The math works. Track A (construction) reaches $210K ARR by December with unit economics that don't exist anywhere else in SaaS — zero CAC on the first 20 customers, 60:1 LTV-to-CAC ratio, 90% gross margins. Track B (public platform) adds another $120K by December through self-serve adoption. Combined: $330K in new revenue on top of Appello's core business, putting total company ARR above $1.3 million by year-end. At a 10x AI-SaaS multiple, that's a $13 million valuation — double what the board discussed at 6x on Appello alone.

And this is just the first vertical. Property management runs on the same stack — email, calendar, accounting, scheduling. Professional services firms are drowning in the same meeting notes and follow-up chaos. Healthcare clinics need the same appointment scheduling and compliance monitoring. The playbook repeats: find the vertical SaaS, build the MCP, create ten recipes, pilot with five companies, publish the case studies, add it to the platform.

The window is open. By the end of 2026, three to five platforms will dominate the AI agent space. The ones that win won't be the ones with the most features or the biggest models. They'll be the ones with the most proof. AgentC2 has 20 customers who've never churned, 50 workflows designed for their exact pain points, and a proprietary integration that no competitor can replicate without Appello's cooperation.

The first dollar of AgentC2 revenue is eight weeks away. The first case study is twelve weeks away. The first thousand users are six months away.

The construction industry taught Corey that you don't build a building by starting at the roof. You start with the foundation, and you don't cut corners, because people's lives depend on what you build. AgentC2 has its foundation. Now it's time to build.
