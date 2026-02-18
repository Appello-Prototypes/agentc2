# AgentC2 Competitive Landscape Analysis

**Date:** February 17, 2026
**Status:** Strategic Analysis — Options & Proposal
**Scope:** 13 competitors analyzed across positioning, product, placement, pricing

---

## Executive Summary

The AI agent platform market is valued at ~$8-11B in 2026, growing at 40-45% CAGR toward $50-200B by 2030-2034. Despite broad experimentation (62% of organizations), only 2% have achieved scaled deployment — a "trust cliff" that represents AgentC2's core opportunity.

The competitive field is crowded but segmented. This analysis maps 13 platforms across four quadrants and identifies AgentC2's unique position as the **only player combining vertical proof (construction) with horizontal platform ambition and a pre-built recipe ecosystem backed by 30+ MCP integrations.** No other competitor has paying customers in a live vertical AND a self-serve horizontal play AND cross-tool orchestration (not single-tool agents).

The analysis concludes with three strategic options (each with a complete 4P framework) and a final proposal.

---

## Part 1: Competitive Field — The 13 Platforms

### 1.1 Platform Profiles

#### Tier 1: Big Tech Platforms (Unlimited Resources, Generic Positioning)

**OpenAI (ChatGPT + Codex)**

| Dimension             | Detail                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What it is**        | AI assistant (ChatGPT) + cloud coding agent (Codex), bundled into subscription tiers                                                               |
| **Target**            | Everyone — consumers, prosumers, developers, enterprises                                                                                           |
| **Pricing**           | Free / Go (~$10) / Plus ($20) / Pro ($200) / Business ($25-30/seat) / Enterprise (custom). Credits system for premium features.                    |
| **Strengths**         | Brand awareness (200M+ users), massive model investment, Codex integrates into Slack/GitHub, bundled value                                         |
| **Weaknesses**        | Generic — not customized for any workflow. No MCP ecosystem. Agents are single-purpose (coding). No cross-tool orchestration for business ops.     |
| **Threat to AgentC2** | **Medium.** OpenAI sells the model, not the workflow. A sales VP won't use Codex to auto-update HubSpot after meetings. Different buying decision. |

**Anthropic (Claude + Claude Code)**

| Dimension             | Detail                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **What it is**        | AI assistant (Claude.ai) + terminal/IDE coding agent (Claude Code). Dual pricing: subscription + API.                              |
| **Target**            | Knowledge workers (Claude.ai), developers (Claude Code), enterprises (API)                                                         |
| **Pricing**           | Free / Pro ($17-20/mo) / Team (custom) / Enterprise (custom). API: $1-25/M tokens by model. Claude Code costs ~$100-200/dev/month. |
| **Strengths**         | Best-in-class safety/alignment reputation, developer trust, strong API, Claude Code is a genuine productivity multiplier           |
| **Weaknesses**        | No business automation platform. No integrations ecosystem. No recipes. Claude Code is coding-only.                                |
| **Threat to AgentC2** | **Low.** Anthropic is a model provider, not a workflow orchestrator. AgentC2 uses Claude as a backend, not competes with it.       |

**Cursor**

| Dimension             | Detail                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **What it is**        | AI-powered IDE with coding agents. Shifted from request-based to usage-based pricing in June 2025.                                |
| **Target**            | Software developers                                                                                                               |
| **Pricing**           | Hobby (free) / Pro ($20/mo, $20 in credits) / Pro+ ($60, 3x) / Ultra ($200, 20x) / Teams ($40/seat) / Enterprise (custom)         |
| **Strengths**         | $29.3B valuation. Dominant in AI-assisted coding. Usage-based pricing is well-calibrated. Multiplier tiers (3x, 20x) are elegant. |
| **Weaknesses**        | Developer-only. No business operations capability. No integrations beyond code.                                                   |
| **Threat to AgentC2** | **None.** Different market entirely. Cursor is a pricing model reference, not a competitor.                                       |

---

#### Tier 2: Automation Platforms (Established User Base, Adding AI)

**Zapier (Zapier Agents)**

| Dimension             | Detail                                                                                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What it is**        | The dominant iPaaS (integration platform), now adding AI agents on top of 8,000+ app connections                                                                                                                                         |
| **Target**            | Operations teams, no-code builders, SMBs                                                                                                                                                                                                 |
| **Pricing**           | Free (100 tasks) / Professional ($20/mo, 250-750 tasks) / Team ($69/mo, 10K tasks) / Company ($299-599/mo) / Enterprise (custom). 1 tool call = 2 tasks.                                                                                 |
| **Strengths**         | 2.2M companies, 8,000+ integrations, massive brand awareness in automation, established billing/metering                                                                                                                                 |
| **Weaknesses**        | Agents are bolted onto an iPaaS — they're fancy Zaps, not true multi-agent systems. No memory, no RAG, no voice, no multi-agent networks. If/then logic with an LLM wrapper. No vertical expertise.                                      |
| **Threat to AgentC2** | **High.** Zapier is the first thing an operations manager thinks of when they hear "connect my tools." AgentC2 must clearly articulate why recipes are different from Zaps — the LLM reasoning at every step, not just trigger → action. |

**n8n**

| Dimension             | Detail                                                                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What it is**        | Open-source workflow automation with AI agent capabilities. Self-hostable.                                                                                                                          |
| **Target**            | Developers, technical ops teams                                                                                                                                                                     |
| **Pricing**           | Community (free, self-host) / Starter (~€20/mo) / Pro (~€50-200/mo) / Enterprise (~€667/mo)                                                                                                         |
| **Strengths**         | Open source, self-hostable, developer-friendly, 400+ integrations, strong community. AI agent nodes added.                                                                                          |
| **Weaknesses**        | Steep learning curve. Requires technical setup. No pre-built recipes — you build everything from scratch. No vertical specialization. No voice. No multi-agent orchestration beyond chaining nodes. |
| **Threat to AgentC2** | **Medium.** n8n attracts technical builders who want control. AgentC2 attracts people who want turnkey outcomes. Different buyer psychographics.                                                    |

---

#### Tier 3: AI-Native Agent Platforms (Direct Competitors)

**Relevance AI**

| Dimension             | Detail                                                                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What it is**        | No-code AI agent builder with 100+ templates. "Build your AI workforce."                                                                                                                                                        |
| **Target**            | Business teams across sales, marketing, support, research                                                                                                                                                                       |
| **Pricing**           | Free (200 actions) / Pro ($19-29/mo, 2,500 actions) / Team ($234-349/mo, 7,000 actions) / Enterprise (custom)                                                                                                                   |
| **Strengths**         | Template library (100+), no-code builder, multi-LLM support (OpenAI, Google, Anthropic), Zapier/Snowflake integrations. Clean UI.                                                                                               |
| **Weaknesses**        | Credit-based pricing is unpredictable at scale. No deep vertical expertise. Templates are shallow — "set up your agent" not "deploy a proven workflow with documented ROI." No voice. No MCP protocol. No multi-agent networks. |
| **Threat to AgentC2** | **High.** Closest direct competitor in positioning. Similar template/recipe model. Similar ICP (business teams). The difference is depth: Relevance AI templates are starting points; AgentC2 recipes are outcomes.             |

**Lindy AI**

| Dimension             | Detail                                                                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What it is**        | AI agent platform with credit-based pricing. Supports text, email, phone agents.                                                                                                          |
| **Target**            | Business professionals, sales teams, support teams                                                                                                                                        |
| **Pricing**           | Free (400 credits) / Pro ($50/mo, 5K credits) / Business ($199-299/mo, 20-30K credits) / Enterprise (custom). Voice: +$50-200/mo. Simple tasks: 3-32 credits. Phone calls: 265 credits.   |
| **Strengths**         | Voice agent support (rare), credit model gives flexibility, agents can pause and resume, decent integration coverage                                                                      |
| **Weaknesses**        | Credit pricing is extremely opaque — a phone call costs 265 credits but a Slack message costs 3. Users report bill shock. Voice is expensive add-on. No vertical depth. No MCP ecosystem. |
| **Threat to AgentC2** | **Medium.** Lindy has voice (like AgentC2) and a similar horizontal positioning. But its pricing model generates user complaints. AgentC2 can win on transparency and vertical proof.     |

**CrewAI**

| Dimension             | Detail                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What it is**        | Multi-agent orchestration framework. Open-source core + hosted platform.                                                                             |
| **Target**            | Developers building custom agent systems                                                                                                             |
| **Pricing**           | Basic (free, 50 executions) / Professional ($25/mo, 100 executions) / Enterprise (custom)                                                            |
| **Strengths**         | Open-source credibility, multi-agent orchestration (crews of agents), developer-first, low cost entry                                                |
| **Weaknesses**        | Developer-only — no business user path. Very low execution limits on paid tiers. No integrations marketplace. No recipes. No voice. Requires coding. |
| **Threat to AgentC2** | **Low.** CrewAI competes for developers building agent systems from scratch. AgentC2 competes for business users deploying pre-built solutions.      |

---

#### Tier 4: Emerging / Niche Entrants

**Tasklet (by Shortwave)**

| Dimension             | Detail                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What it is**        | AI automation platform from the Shortwave (email) team. Currently in beta. Plain-English automation setup with webhook triggers, scheduled tasks, and virtual computer for browser automation.                                                                                                                                                                                                                 |
| **Target**            | COOs, founders, operations leaders                                                                                                                                                                                                                                                                                                                                                                             |
| **Pricing**           | Beta — likely freemium, details not public. Running Google Ads (the URL you shared was a paid campaign).                                                                                                                                                                                                                                                                                                       |
| **Strengths**         | Clean UX, plain-English automation creation, virtual computer for browser tasks, webhook triggers, CASA Tier 2 certified (SOC 2 in progress). Backed by Shortwave's email expertise. Pre-built templates for email tracking, Calendly briefings, LinkedIn automation, sales qualification.                                                                                                                     |
| **Weaknesses**        | Beta product — not production-proven. Small integration footprint. No multi-agent orchestration. No voice. No vertical specialization. No recipe ecosystem at scale. Unknown pricing (risk of high prices once beta ends).                                                                                                                                                                                     |
| **Threat to AgentC2** | **Medium-High.** Tasklet targets the exact same buyer (ops leaders) with the same value prop (automate business processes in plain English). Its UX is polished and its templates map to real pain points. However, it lacks AgentC2's vertical depth, MCP breadth, and multi-agent sophistication. Watch this one closely — if they raise and scale fast, they could capture the "simple automation" segment. |

**DoAnything**

| Dimension             | Detail                                                                                                                                                                                                                                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What it is**        | Autonomous AI agent that acts on your behalf — makes calls, sends emails, browses web, signs up for services, manages social media. "Not a chatbot. Not an assistant. An autonomous agent that actually does the work for you."                                                                                                                            |
| **Target**            | Consumers, solopreneurs, busy professionals                                                                                                                                                                                                                                                                                                                |
| **Pricing**           | Credit-based. Pro: 5,000 credits/month (rolling to 10K max). Specific pricing not public.                                                                                                                                                                                                                                                                  |
| **Strengths**         | Bold vision — agent has its own identity (name, email, social accounts). 3,000+ app connections. 10+ tool types (email, phone, browser, code, documents, websites, images, subagents). Self-reflection when user doesn't respond. SMS notifications. Smart pacing (pause/resume).                                                                          |
| **Weaknesses**        | Feels consumer/prosumer, not enterprise. "Start and run a business from scratch" is aspirational marketing, not a proven capability. No vertical depth. No MCP protocol. No observability, audit logs, or governance. Alpha stage. The agent-has-its-own-identity approach may concern enterprise buyers (who owns the account? compliance implications?). |
| **Threat to AgentC2** | **Low.** Different market segment (consumer/solopreneur vs. business teams). The "agent does everything" positioning is the opposite of AgentC2's "recipes for specific outcomes" approach. However, if DoAnything matures and adds enterprise features, the autonomous identity concept could be compelling.                                              |

---

### 1.2 Competitive Landscape Map

```
                         ENTERPRISE ←————————————————————→ SMB/CONSUMER
                              |                                |
                              |                                |
HORIZONTAL        OpenAI ChatGPT/Codex              Zapier Agents
(generic,         Anthropic Claude/Code             Relevance AI
 any use case)    Microsoft Copilot Studio          Lindy AI
                  Salesforce AgentForce             n8n + AI
                              |                     CrewAI
                              |                     DoAnything
                              |                     Tasklet
                              |                                |
                              |                                |
                              |      ┌───────────────┐         |
                              |      │   ★ AgentC2 ★  │        |
                              |      │               │         |
                              |      │ vertical-first │        |
                              |      │ + horizontal   │        |
                              |      │ + recipes      │        |
                              |      │ + MCP          │        |
                              |      │ + voice        │        |
                              |      └───────────────┘         |
                              |                                |
VERTICAL          Palantir AIP                 ServiceTitan AI
(industry-        C3.ai                        Procore AI
 specific)        (enterprise only)            (not agent-native)
                              |                                |
```

**AgentC2's unique position:** No other platform sits at the intersection of vertical proof + horizontal platform + recipe ecosystem + MCP breadth + voice + multi-agent orchestration. Every competitor is missing at least 2-3 of these.

---

## Part 2: Competitive Comparison Matrix

### 2.1 Feature Comparison

| Capability                          | AgentC2                         | OpenAI                 | Claude          | Cursor       | Zapier                | n8n              | Relevance       | Lindy               | CrewAI          | Tasklet           | DoAnything        |
| ----------------------------------- | ------------------------------- | ---------------------- | --------------- | ------------ | --------------------- | ---------------- | --------------- | ------------------- | --------------- | ----------------- | ----------------- |
| **Multi-agent orchestration**       | Yes (networks, workflows)       | No                     | No              | No           | No                    | Basic (chaining) | No              | No                  | Yes (crews)     | No                | Yes (subagents)   |
| **Pre-built recipes/templates**     | 25+ (growing to 50+)            | No                     | No              | No           | Templates (Zaps)      | Templates        | 100+ templates  | Some                | No              | ~6 templates      | No                |
| **MCP integrations**                | 30+                             | No                     | No              | No           | 8,000+ apps (not MCP) | 400+ nodes       | Zapier bridge   | Some                | No              | Some              | 3,000+ apps       |
| **Voice agents**                    | Yes (ElevenLabs + OpenAI)       | TTS only               | No              | No           | No                    | No               | No              | Yes ($50-200 extra) | No              | No                | Yes (phone calls) |
| **RAG / Knowledge base**            | Yes (built-in)                  | No                     | No              | No           | No                    | No               | Basic           | No                  | No              | No                | No                |
| **Memory / Context**                | Yes (working + semantic)        | Basic (ChatGPT memory) | Basic           | Session-only | No                    | No               | No              | No                  | No              | No                | No                |
| **Canvas / Dashboards**             | Yes                             | No                     | No              | No           | No                    | No               | No              | No                  | No              | No                | No                |
| **Continuous learning**             | Yes (A/B, proposals)            | No                     | No              | No           | No                    | No               | No              | No                  | No              | No                | No                |
| **Observability / Audit**           | Yes (traces, logs, costs)       | Basic                  | Cost tracking   | No           | Basic                 | Execution logs   | Basic           | Basic               | Basic           | No                | No                |
| **Guardrails / Safety**             | Yes (content, budget, policies) | No (user-level)        | Constitution AI | No           | No                    | No               | No              | No                  | No              | No                | No                |
| **Vertical specialization**         | Construction (proven)           | None                   | None            | Coding       | None                  | None             | None            | None                | None            | None              | None              |
| **Self-serve signup**               | Coming (Apr 2026)               | Yes                    | Yes             | Yes          | Yes                   | Yes              | Yes             | Yes                 | Yes             | Beta              | Yes (alpha)       |
| **Enterprise features (SSO, SCIM)** | Yes                             | Yes                    | Yes             | Yes          | No                    | Enterprise only  | Enterprise only | Enterprise only     | Enterprise only | SOC 2 in progress | No                |

### 2.2 Pricing Comparison

| Platform                   | Free                   | Entry Paid                   | Mid                          | High                   | Enterprise | Unit               | Voice       |
| -------------------------- | ---------------------- | ---------------------------- | ---------------------------- | ---------------------- | ---------- | ------------------ | ----------- |
| **AgentC2** (current page) | $0 (1 agent, 100 runs) | $49/mo (unlimited, 10K runs) | $149/mo (100K runs)          | $29/user/mo (team)     | Custom     | Runs               | Included    |
| **OpenAI ChatGPT**         | Free (limited)         | $20/mo (Plus)                | $200/mo (Pro)                | $25-30/seat (Business) | Custom     | Messages + credits | TTS only    |
| **Anthropic Claude**       | Free                   | $17-20/mo (Pro)              | Custom (Team)                | Custom (Enterprise)    | Custom     | Messages           | No          |
| **Cursor**                 | Free (limited)         | $20/mo ($20 credits)         | $60/mo (3x)                  | $200/mo (20x)          | Custom     | Token credits      | No          |
| **Zapier**                 | 100 tasks              | $20/mo (250-750 tasks)       | $69/mo (10K tasks)           | $299-599/mo            | Custom     | Tasks              | No          |
| **n8n**                    | Self-host free         | ~€20/mo                      | ~€50-200/mo                  | ~€667/mo               | Custom     | Executions         | No          |
| **Relevance AI**           | 200 actions            | $19-29/mo (2,500 actions)    | $234-349/mo (7K actions)     | Custom                 | Custom     | Actions            | No          |
| **Lindy AI**               | 400 credits            | $50/mo (5K credits)          | $199-299/mo (20-30K credits) | Custom                 | Custom     | Credits (variable) | +$50-200/mo |
| **CrewAI**                 | 50 executions          | $25/mo (100 executions)      | —                            | Custom                 | Custom     | Executions         | No          |
| **Tasklet**                | Beta (free?)           | TBD                          | TBD                          | TBD                    | TBD        | TBD                | No          |
| **DoAnything**             | Unknown                | Pro (5K credits)             | Unknown                      | Unknown                | Unknown    | Credits            | Included    |

---

## Part 3: 4P Analysis — Positioning, Product, Placement, Pricing

### 3.1 Where AgentC2 Wins

| Advantage                    | Evidence                                                                    | Competitor Gap                                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Vertical proof**           | 20 Appello customers, zero churn, documented ROI (Vanos: 3 admins → 1)      | No competitor has a single vertical with paying customers and case studies                                                   |
| **Cross-tool orchestration** | Recipes span 3-6 tools (HubSpot + Gmail + Calendar + Slack in Deal Copilot) | Zapier chains tools but doesn't reason about context. OpenAI/Claude are single-model, single-tool.                           |
| **MCP protocol**             | 30+ MCP servers, standard protocol, extensible                              | Zapier has more integrations (8,000) but uses proprietary connectors. No other agent platform uses MCP at this scale.        |
| **Voice agents**             | ElevenLabs + OpenAI voice, live conversational agents                       | Only Lindy (expensive add-on) and DoAnything (alpha) have voice. Zapier, Relevance, CrewAI, n8n do not.                      |
| **Recipe framework**         | Recipes are outcome-focused with measurable value metrics                   | Relevance AI has templates but they're builder-focused, not outcome-focused. Zapier templates are if/then, not LLM-reasoned. |
| **Proprietary MCP moat**     | Appello MCP gives exclusive access to construction operational data         | Impossible for any competitor to replicate without Appello cooperation                                                       |
| **Full-stack orchestration** | Networks + Workflows + Skills + Campaigns + Canvas                          | CrewAI has multi-agent but no workflows. n8n has workflows but no agents. Nobody has all five.                               |

### 3.2 Where AgentC2 Is Vulnerable

| Vulnerability            | Risk                                                                                                                        | Mitigation                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Integration count**    | Zapier has 8,000 apps vs. AgentC2's 30+ MCP servers. "But can it connect to [obscure tool]?"                                | Position quality over quantity: "30+ deep integrations vs. 8,000 shallow connections." Add a Zapier MCP bridge for long-tail. |
| **Brand awareness**      | Zero brand recognition vs. OpenAI (household name), Zapier (2.2M companies)                                                 | Vertical-first strategy builds credibility in a niche, then expands. Case studies are the marketing.                          |
| **Self-serve maturity**  | No free tier, no Stripe billing, no onboarding flow today                                                                   | Must ship before public launch. This is table stakes, not differentiator.                                                     |
| **Template count**       | Relevance AI has 100+ templates; AgentC2 will launch with 8 recipes                                                         | Recipes > templates. 8 deeply proven recipes with ROI data beat 100 shallow templates. But need to communicate this clearly.  |
| **Enterprise readiness** | SOC 2 in progress (target April). Competitors like OpenAI and Zapier already have it.                                       | Timeline is tight but achievable. Construction vertical doesn't require SOC 2 immediately.                                    |
| **Tasklet threat**       | Tasklet targets the same buyer (ops leader), same pitch (plain English automation), with a polished UX and Google Ads spend | Ship faster. The recipe depth and vertical proof are the moat. Tasklet has 6 templates; AgentC2 will have 25+.                |

---

## Part 4: Strategic Options (Full 4P Framework)

### OPTION A: "The Vertical Wedge" — Construction-First, Platform-Second

**Philosophy:** Lead with construction credibility. Position AgentC2 as "the AI agent platform that's already proven" and let vertical success pull the horizontal platform. The construction story IS the marketing.

#### Positioning

> **Tagline:** "AI agents with proof."
>
> **Positioning statement:** "AgentC2 is the only AI agent platform with documented results in a real industry. 35 construction companies save 15+ hours/week with autonomous agents that connect their existing tools. Now available for every business."
>
> **Against competitors:**
>
> - vs. Zapier: "Zapier connects your tools. AgentC2 thinks about your business."
> - vs. Relevance AI: "Templates tell you how to build. Recipes tell you what you'll save."
> - vs. OpenAI: "ChatGPT answers questions. AgentC2 runs your operations."
> - vs. Tasklet: "Tasklet automates tasks. AgentC2 automates outcomes."

#### Product

| Dimension             | Spec                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Hero offering**     | Recipe Discovery Engine — browse by role, by tools, by industry                                              |
| **Launch recipes**    | 8 horizontal + 10 construction = 18 recipes at public launch                                                 |
| **Differentiation**   | Every recipe has a documented value metric ("Save 8 hrs/week") and a before/after story from a real customer |
| **Vertical packages** | "AgentC2 for Construction" as the first vertical bundle (powered by Appello Intelligence)                    |
| **Key features**      | Recipes, multi-agent networks, workflows, voice, RAG, Canvas dashboards, continuous learning                 |

#### Placement

| Channel                  | Strategy                                                                                           | Priority |
| ------------------------ | -------------------------------------------------------------------------------------------------- | -------- |
| **agentc2.ai**           | Recipe gallery landing page with construction case studies prominently featured                    | P0       |
| **Appello website**      | "Powered by AgentC2" badge, Intelligence tier pricing on Appello pricing page                      | P0       |
| **Industry conferences** | TIAC, BCICA, NIA — live demos with construction customer data                                      | P1       |
| **Product Hunt**         | Launch as "AI agents that actually work — proven in construction"                                  | P1       |
| **SEO**                  | `/solutions/construction`, `/solutions/hubspot`, `/solutions/slack` — recipe-focused landing pages | P1       |
| **LinkedIn Ads**         | Target VPs of Sales/Ops/Engineering with role-specific recipe ads                                  | P2       |
| **Google Ads**           | "[Platform] AI automation" keywords (e.g., "HubSpot AI agent")                                     | P2       |
| **Content**              | Blog series: "How we saved X hours at [Construction Company]" — then generalize the pattern        | P2       |

#### Pricing

**Track A (Appello Intelligence) — Bundled subscription:**

| Tier       | Price      | What's Included                               |
| ---------- | ---------- | --------------------------------------------- |
| Starter    | +$250/mo   | 3 core recipes, daily Slack/email delivery    |
| Pro        | +$500/mo   | All recipes, custom alerts, Slack bot         |
| Enterprise | +$1,000/mo | Full library, voice, Canvas, priority support |

**Track B (AgentC2 Public) — Tiered with included runs:**

| Tier       | Price   | Agents    | Recipes   | Runs/mo   | Key Features                                 |
| ---------- | ------- | --------- | --------- | --------- | -------------------------------------------- |
| Free       | $0      | 1         | 1         | 200       | Community support, 3 integrations            |
| Starter    | $29/mo  | 3         | 5         | 1,500     | All integrations, basic analytics            |
| Pro        | $79/mo  | Unlimited | Unlimited | 8,000     | Workflows, networks, advanced analytics      |
| Business   | $199/mo | Unlimited | Unlimited | 25,000    | 5 seats, RBAC, team library, voice (100 min) |
| Enterprise | Custom  | Unlimited | Unlimited | Unlimited | SSO, SLA, dedicated infra, custom MCP        |

Add-ons: Additional runs ($8/1,000), Additional seats ($19/seat), Voice minutes ($0.12/min), Custom MCP setup ($500 one-time)

---

### OPTION B: "The Platform Play" — Lead with Breadth, Prove with Depth

**Philosophy:** Position AgentC2 as the broadest AI agent platform (30+ MCP integrations, recipes for every department), and use construction as one of many proof points rather than the central narrative. Compete head-to-head with Relevance AI, Lindy, and Tasklet on horizontal positioning.

#### Positioning

> **Tagline:** "Your tools. Your recipes. Your agents."
>
> **Positioning statement:** "AgentC2 connects 30+ platforms through MCP and deploys pre-built AI agent recipes for sales, marketing, support, engineering, and operations. Pick a recipe, connect your tools, deploy in 5 minutes."
>
> **Against competitors:**
>
> - vs. Zapier: "8,000 shallow connections vs. 30 deep MCP integrations with real AI reasoning."
> - vs. Relevance AI: "We don't just give you a builder. We give you proven recipes with documented results."
> - vs. Lindy: "Transparent pricing, no credit roulette. You know what you'll pay."
> - vs. DoAnything: "Enterprise-grade observability, not consumer-grade autonomy."

#### Product

| Dimension             | Spec                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Hero offering**     | "What tools does your team use?" → personalized recipe recommendations                                                  |
| **Launch recipes**    | 25+ recipes across 9 categories (Sales, Marketing, Support, Engineering, Ops, Executive, E-commerce, Voice, Freelancer) |
| **Differentiation**   | Broadest MCP integration ecosystem + multi-agent networks + voice + RAG. Full-stack, not single-agent.                  |
| **Vertical packages** | Available but not the lead — "Industry Solutions" tab with Construction as first                                        |
| **Key features**      | Recipe marketplace, MCP marketplace, multi-agent networks, workflows, voice, RAG, Canvas                                |

#### Placement

| Channel                 | Strategy                                                                                                     | Priority |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| **agentc2.ai**          | Recipe discovery engine — filter by role, tool, industry                                                     | P0       |
| **Product Hunt**        | Lead with recipe count and integration breadth: "25+ recipes, 30+ integrations"                              | P0       |
| **SEO**                 | Platform-specific pages: `/solutions/hubspot`, `/solutions/jira`, `/solutions/shopify` (high-value keywords) | P1       |
| **Google Ads**          | Bid on "[platform] AI agent" and "[platform] automation" keywords                                            | P1       |
| **Developer community** | Open-source the MCP recipe framework, build ecosystem                                                        | P1       |
| **LinkedIn Ads**        | Department-specific ads (Sales VP sees Deal Copilot, CTO sees Bug Bouncer)                                   | P2       |
| **Content**             | Comparison pages: "AgentC2 vs Zapier," "AgentC2 vs Relevance AI"                                             | P2       |
| **Partner channel**     | Vertical SaaS companies build MCPs, AgentC2 distributes                                                      | P3       |

#### Pricing

**Unified model (Cursor-inspired volume multiplier):**

| Tier       | Price       | What's Included                                           | Target          |
| ---------- | ----------- | --------------------------------------------------------- | --------------- |
| Free       | $0/mo       | 1 agent, 1 recipe, 200 runs, 3 integrations               | Tire kickers    |
| Starter    | $19/mo      | 3 agents, all recipes, 1,000 runs, all integrations       | Solopreneurs    |
| Pro        | $49/mo      | Unlimited agents/recipes, 5,000 runs, workflows, networks | Professionals   |
| Pro+       | $99/mo      | Everything in Pro, 15,000 runs (3x)                       | Power users     |
| Max        | $199/mo     | Everything in Pro, 50,000 runs (10x), voice (200 min)     | Heavy workloads |
| Teams      | $39/user/mo | Everything in Pro, shared library, RBAC, analytics        | Departments     |
| Enterprise | Custom      | Unlimited runs, SSO, SLA, custom MCP, dedicated infra     | Organizations   |

**Construction vertical:** Sold separately through Appello as "Appello Intelligence" at $250-1,000/mo, bundled on the Appello bill. Not visible on the AgentC2 pricing page.

**Competitive pricing anchors:**

- Starter at $19 undercuts Relevance AI Pro ($29) and Lindy Pro ($50)
- Pro at $49 matches AgentC2's current page and is 2.5x less than Lindy Business
- Teams at $39/seat is competitive with Cursor Teams ($40/seat) and below Zapier Team ($69/mo)

---

### OPTION C: "The Outcomes Company" — Price on Value, Not Volume

**Philosophy:** Don't compete on runs, credits, or tasks. Compete on outcomes. Each recipe has a documented value (hours saved, revenue recovered, errors prevented). Price tiers based on the VALUE of the outcomes delivered, not the VOLUME of compute consumed.

#### Positioning

> **Tagline:** "Results, not runs."
>
> **Positioning statement:** "Every other AI agent platform charges you for compute. AgentC2 charges you for outcomes. Deploy a recipe, measure the result, scale what works. The only platform where you can calculate your ROI before you sign up."
>
> **Against competitors:**
>
> - vs. Everyone: "They charge per run/credit/task. We charge for the outcome. Deal Copilot saves 8 hours/week per rep — that's worth $400/week in recovered selling time. We charge $49/month."
> - vs. Zapier: "You pay Zapier per task, hoping the automation works. You pay AgentC2 per recipe, knowing exactly what it saves."
> - vs. Relevance AI: "200 actions means nothing. 8 hours/week saved means everything."

#### Product

| Dimension             | Spec                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| **Hero offering**     | ROI Calculator — select your role, team size, hourly cost → see exactly what each recipe saves |
| **Launch recipes**    | 8 deeply validated recipes, each with an ROI calculator and value guarantee                    |
| **Differentiation**   | Every recipe has a measurable, published outcome metric. No other platform does this.          |
| **Vertical packages** | Construction as the flagship case study — "See the proof"                                      |
| **Key features**      | ROI tracking per recipe, value dashboards, before/after comparison, cost-per-outcome analytics |

#### Placement

| Channel          | Strategy                                                                              | Priority |
| ---------------- | ------------------------------------------------------------------------------------- | -------- |
| **agentc2.ai**   | ROI-first landing page: "Calculate your savings" as the hero CTA                      | P0       |
| **Case studies** | Central to everything — every page, every ad, every email leads with customer results | P0       |
| **LinkedIn Ads** | ROI-focused copy: "Our customers save an average of $X/month. See if you qualify."    | P1       |
| **Webinars**     | "How [Company] saved [X hours/week]" — outcome-focused demos                          | P1       |
| **SEO**          | Long-tail: "how to automate CRM data entry," "AI customer support automation ROI"     | P2       |

#### Pricing

**Outcome-anchored tiers:**

| Tier       | Price   | Recipes                                      | Positioning                            | ROI Anchor                      |
| ---------- | ------- | -------------------------------------------- | -------------------------------------- | ------------------------------- |
| Free       | $0/mo   | 1 recipe, 100 runs                           | "See what's possible"                  | —                               |
| Solo       | $49/mo  | 3 recipes, 2,000 runs                        | "Save 5+ hours/week"                   | $49/mo to save ~$800/mo in time |
| Team       | $149/mo | 10 recipes, 5 seats, 10K runs                | "Save 25+ hours/week across your team" | $149/mo to save ~$4,000/mo      |
| Business   | $399/mo | Unlimited recipes, 20 seats, 50K runs, voice | "Transform a department"               | $399/mo to save ~$10,000/mo     |
| Enterprise | Custom  | Unlimited everything, SSO, SLA               | "Transform the organization"           | Custom ROI analysis             |

**Key differentiator:** Every tier is described in terms of OUTCOMES, not FEATURES. "Save 5+ hours/week" is infinitely more compelling than "3 agents, 2,000 runs" to a VP of Sales.

**Construction (Appello Intelligence) maps naturally:**

| Tier       | Price      | Anchor                                                               |
| ---------- | ---------- | -------------------------------------------------------------------- |
| Starter    | +$250/mo   | "Catch scheduling conflicts before your team arrives"                |
| Pro        | +$500/mo   | "Save 10+ hours/week on admin" (less than cost of one payroll error) |
| Enterprise | +$1,000/mo | "Complete operational intelligence"                                  |

---

## Part 5: Comparative Assessment

### 5.1 Options Scorecard

| Criterion                       | Weight | Option A (Vertical Wedge)                      | Option B (Platform Play)                           | Option C (Outcomes)                              |
| ------------------------------- | ------ | ---------------------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| **Alignment with GTM plan**     | 25%    | 9/10 — perfectly mirrors dual-track            | 7/10 — platform-first deemphasizes construction    | 8/10 — works for both tracks                     |
| **Competitive differentiation** | 20%    | 9/10 — nobody else has vertical proof          | 6/10 — competing on breadth against bigger players | 10/10 — nobody prices on outcomes                |
| **Ease of implementation**      | 15%    | 7/10 — two pricing models to build             | 8/10 — one unified model                           | 6/10 — ROI calculators need data                 |
| **Revenue optimization**        | 15%    | 8/10 — captures vertical premium               | 7/10 — lower prices to compete on volume           | 9/10 — value-based pricing captures more         |
| **Scalability**                 | 10%    | 7/10 — vertical model needs replication        | 9/10 — single model scales everywhere              | 8/10 — outcome claims need validation per recipe |
| **Sales story clarity**         | 15%    | 9/10 — "proven in construction, built for you" | 7/10 — "broadest platform" is generic              | 10/10 — "here's your ROI" closes deals           |
| **WEIGHTED SCORE**              | 100%   | **8.3**                                        | **7.2**                                            | **8.5**                                          |

### 5.2 Risk Assessment by Option

| Risk                                                   | Option A                          | Option B                                          | Option C                                               |
| ------------------------------------------------------ | --------------------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| Construction customers discover cheaper public pricing | Medium — separate brands mitigate | Low — construction is just another vertical       | Medium — value anchoring justifies premium             |
| Competitors copy positioning                           | Low — can't copy vertical proof   | High — "broadest platform" is claimable by anyone | Medium — outcome claims are hard to fake               |
| Engineering complexity                                 | Medium — two pricing models       | Low — one model                                   | High — ROI tracking, calculators, per-recipe analytics |
| Market perception                                      | Strong — "proven results"         | Weak — "another AI platform"                      | Very strong — "the only platform that guarantees ROI"  |

---

## Part 6: Proposal

### Recommended Strategy: Option A Foundation + Option C Messaging

**Take the structural framework from Option A (Vertical Wedge) and overlay the messaging framework from Option C (Outcomes Company).** This gives you:

1. **Two pricing tracks** (A for construction, B for public) that match your actual business structure
2. **Outcome-anchored messaging** that differentiates from every competitor who prices on compute
3. **Construction proof as the hero story** that no competitor can replicate

### Proposed Pricing

**Track A — Appello Intelligence (bundled on Appello bill):**

| Tier       | Price      | Outcome Anchor                               | Recipes                       |
| ---------- | ---------- | -------------------------------------------- | ----------------------------- |
| Starter    | +$250/mo   | "Know your day before you get to the office" | 3 core recipes                |
| Pro        | +$500/mo   | "Save 10+ hours/week on admin"               | All recipes + Slack bot       |
| Enterprise | +$1,000/mo | "Complete operational intelligence"          | Full library + voice + Canvas |

**Track B — AgentC2 Public Platform:**

| Tier       | Price   | Outcome Anchor               | Specs                                                     |
| ---------- | ------- | ---------------------------- | --------------------------------------------------------- |
| Free       | $0/mo   | "See what's possible"        | 1 agent, 1 recipe, 200 runs, 3 integrations               |
| Starter    | $29/mo  | "Save 3+ hours/week"         | 3 agents, 5 recipes, 1,500 runs, all integrations         |
| Pro        | $79/mo  | "Automate a function"        | Unlimited agents/recipes, 8,000 runs, workflows, networks |
| Business   | $199/mo | "Transform a department"     | Everything + 5 seats, 25,000 runs, RBAC, voice (100 min)  |
| Enterprise | Custom  | "Transform the organization" | Unlimited, SSO, SLA, custom MCP, dedicated infra          |

**Add-ons (any paid tier):**

- Additional runs: $8 per 1,000
- Additional seats: $19/seat/mo
- Voice minutes: $0.12/min beyond included
- Custom MCP integration: $500 setup + $100/mo

### Proposed Positioning Statement

> **For the landing page hero:**
> "AI agents that deliver results, not just responses."
>
> **Subheadline:**
> "Connect your existing tools. Deploy a recipe. Measure the outcome. The only agent platform where 35 companies already have the proof."

### Proposed Product Hierarchy

```
FREE → Try a recipe, see the value
  ↓
STARTER → Deploy recipes that save real hours
  ↓
PRO → Automate entire workflows with multi-agent orchestration
  ↓
BUSINESS → Team-wide deployment with voice, Canvas, and governance
  ↓
ENTERPRISE → Custom everything, dedicated infrastructure
```

### Proposed Placement Priority (First 90 Days)

| Week  | Action                                              | Channel   |
| ----- | --------------------------------------------------- | --------- |
| 1-2   | Recipe data model + 8 recipe detail pages           | Product   |
| 3-4   | Landing page with recipe gallery + updated pricing  | Website   |
| 5-6   | Free tier + self-serve signup + Stripe billing      | Product   |
| 7-8   | Product Hunt launch                                 | Community |
| 9-10  | `/solutions/hubspot` + `/solutions/slack` SEO pages | SEO       |
| 11-12 | Google Ads on "[platform] AI agent" keywords        | Paid      |

### What This Looks Like Against Competitors

|                    | AgentC2            | Zapier      | Relevance AI | Lindy       | Tasklet |
| ------------------ | ------------------ | ----------- | ------------ | ----------- | ------- |
| **Free tier**      | 200 runs           | 100 tasks   | 200 actions  | 400 credits | Beta    |
| **Entry paid**     | $29/mo             | $20/mo      | $19-29/mo    | $50/mo      | TBD     |
| **Mid tier**       | $79/mo             | $69/mo      | $234-349/mo  | $199-299/mo | TBD     |
| **High tier**      | $199/mo            | $299-599/mo | Custom       | Custom      | TBD     |
| **Voice included** | Yes (Business+)    | No          | No           | +$50-200/mo | No      |
| **Vertical proof** | Yes (35 companies) | No          | No           | No          | No      |
| **Multi-agent**    | Yes                | No          | No           | No          | No      |
| **ROI on page**    | Yes (per recipe)   | No          | No           | No          | No      |

**AgentC2 is price-competitive at entry ($29 vs. $19-50), significantly cheaper at mid-tier ($79 vs. $234-349), includes voice where competitors charge extra, and is the only platform with documented vertical proof and per-recipe ROI claims.**

---

## Part 7: Key Decisions to Make

| #   | Decision                                              | Recommendation                                                                           | Reasoning                                                                                                                                            |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **One pricing model or two?**                         | Two (Track A subscription, Track B tiered + runs)                                        | Different buyers need different models. Construction operators want simplicity. Platform users want flexibility.                                     |
| 2   | **What's the value unit?**                            | "Runs" (1 recipe execution = 1 run, regardless of steps)                                 | Simplest to understand. Aligns with value delivered. Don't expose internal token math.                                                               |
| 3   | **Feature-gated or volume-gated?**                    | Hybrid — voice and team features gated to Business+, everything else available on Pro    | Don't gate workflows/networks — they're core. Gate voice (high cost) and seats (team value).                                                         |
| 4   | **Free tier size?**                                   | 200 runs/month (up from 100)                                                             | 100 is too low for daily recipes. 200 = ~6 runs/day, enough to experience real value. Competitive with Relevance AI (200 actions).                   |
| 5   | **Annual discounts?**                                 | 17% (2 months free) — $290/yr for Starter, $790/yr for Pro, $1,990/yr for Business       | Industry standard. Improves cash flow, reduces churn, signals confidence.                                                                            |
| 6   | **Pricing page structure?**                           | Remove Individual/Team tabs. Single ladder: Free → Starter → Pro → Business → Enterprise | The current two-tab structure (Individual vs. Team) fragments the narrative. One ladder with seats as an add-on is cleaner.                          |
| 7   | **Drop Enterprise+ tier?**                            | Yes — merge into Enterprise (custom)                                                     | Two custom-priced tiers is confusing. Multi-region, HIPAA, etc. are line items in the enterprise conversation.                                       |
| 8   | **Should pricing be on the landing page pre-launch?** | Yes — transparent pricing builds trust and filters leads                                 | Competitors who hide pricing (CrewAI Enterprise, Tasklet) lose to transparent ones. "If you have to ask, you can't afford it" doesn't work for SMBs. |

---

## Appendix: Competitor Quick-Reference Cards

### Tasklet.ai

- **By:** Shortwave (email startup)
- **Stage:** Beta
- **Target:** COOs, founders, operations leaders
- **Model:** Plain-English automation with webhooks, scheduled triggers, virtual computer
- **Integrations:** Growing (32 new announced), plus custom APIs and MCP servers
- **Pricing:** Not public (beta)
- **Compliance:** CASA Tier 2, SOC 2 in progress
- **Watch factor:** High — same buyer, same pitch, polished UX, running Google Ads

### DoAnything.com

- **Stage:** Alpha
- **Target:** Consumers, solopreneurs
- **Model:** Fully autonomous agent with its own identity (email, social accounts)
- **Capabilities:** Email, phone calls, browser, code, documents, websites, images, subagents
- **Pricing:** Credit-based, Pro: 5,000 credits/mo
- **Differentiator:** Agent has own identity (signs up for services, manages profiles)
- **Watch factor:** Low — consumer/prosumer, not enterprise. But the autonomous identity concept is novel.

### Sources

- [OpenAI ChatGPT Pricing](https://chatgpt.com/pricing)
- [Anthropic Claude Pricing](https://www.anthropic.com/pricing)
- [Cursor Pricing](https://www.cursor.com/pricing)
- [Cursor June 2025 Pricing Blog](https://cursor.com/blog/june-2025-pricing)
- [Zapier Pricing](https://zapier.com/pricing)
- [Relevance AI Pricing](https://relevanceai.com/pricing)
- [Lindy AI Pricing](https://lindy.ai/pricing)
- [CrewAI Pricing](https://www.crewai.com/pricing)
- [Tasklet](https://tasklet.ai)
- [DoAnything](https://doanything.com)
- [RAYSolute Global Agentic AI Landscape Q1 2026](https://www.raysolute.com/agentic-ai-report.html)
- [CB Insights AI Agent Market Map](https://www.cbinsights.com/research/ai-agent-market-map-2025/)
