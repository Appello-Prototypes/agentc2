---
name: "Website — Plan 2: Home Page Redesign"
overview: "Design and build a high-conviction marketing home page that immediately communicates what AgentC2 is, who it's for, and why it's different. Replaces the current embed-first root experience with a structured marketing page that includes the embed as an interactive demo section."
todos:
    - id: phase-1-hero
      content: "Phase 1: Hero section — headline, subheadline, CTAs, product screenshot or video loop"
      status: pending
    - id: phase-2-problem-pillars
      content: "Phase 2: Problem statement + Five Pillars section — Build, Deploy, Govern, Scale, Improve"
      status: pending
    - id: phase-3-channels-integrations
      content: "Phase 3: Channel deployment section + Integration ecosystem with logo grid"
      status: pending
    - id: phase-4-differentiators
      content: "Phase 4: Three unique differentiator cards — Federation, Mission Command, Marketplace"
      status: pending
    - id: phase-5-demo-cta
      content: "Phase 5: Interactive demo embed, use cases tabs, trust bar, how-it-works, and footer CTA"
      status: pending
isProject: false
---

# Plan 2: Home Page Redesign

**Priority:** Critical — the home page is the single highest-impact page

**Depends on:** Plan 1 (Foundation & Structure)

**Estimated Effort:** Large (4–5 days)

---

## Phase 1: Hero Section

The hero must communicate three things within 5 seconds: what we are, who it's for, why we're different.

### 1.1 Hero Component

**File:** `apps/frontend/src/components/marketing/hero-section.tsx` (new or replace existing)

**Content:**

**Headline:** "The AI Operating System for Your Organization"

**Subheadline:** "Build, deploy, and govern intelligent AI agents across web, Slack, WhatsApp, voice, and more — with enterprise security, a playbook marketplace, and the only cross-organization federation in the market."

**Primary CTA:** "Get Started Free" → `/signup`
**Secondary CTA:** "See How It Works" → smooth scroll to How It Works section

**Visual:** Product screenshot of the workspace view showing:

- An active agent conversation with visible tool activity
- The agent selector in the sidebar
- Channel indicator (showing multi-channel capability)

**Technical notes:**

- Use a real product screenshot, not an illustration or mockup
- Optimize image: WebP format, responsive sizes, lazy-load below fold
- Consider a 10-second looping video (muted, autoplay) as an alternative
- Dark background with the product screenshot in a browser frame for contrast

### 1.2 Announcement Bar (Optional)

A thin bar above the hero for time-sensitive announcements:

- "New: Playbook Marketplace is live — deploy agent solutions in one click →"
- Links to `/platform/marketplace`
- Dismissable with localStorage persistence

---

## Phase 2: Problem Statement + Five Pillars

### 2.1 Problem Statement Section

**Headline:** "The gap between AI models and AI operations is where organizations fail."

Three columns, each addressing a competitor category:

| Column | Title                                              | Body                                                                                                                                                              |
| ------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | "Models give you intelligence. Not operations."    | "OpenAI and Claude sell tokens. They don't give you multi-tenant governance, budget enforcement, multi-channel deployment, or agents that learn from production." |
| 2      | "Frameworks give you scaffolding. Not a platform." | "LangChain and CrewAI give you libraries. They don't give you a production system with monitoring, evaluation, compliance, and a marketplace."                    |
| 3      | "Automation gives you workflows. Not agents."      | "n8n and Zapier execute predefined steps. They don't give you agents that reason, plan, delegate, execute campaigns, and improve autonomously."                   |

**Design:** Clean 3-column grid with subtle icons or illustrations. Light background to contrast with the hero.

### 2.2 Five Pillars Section

**Headline:** "The complete stack for AI agent operations"

Five cards or columns, each with an icon, title, and 3–4 bullet points:

**Build:**

- Create agents with natural language instructions
- Attach skills, knowledge bases, and 200+ MCP tools
- Visual workflow and network designers
- Model-agnostic: OpenAI, Anthropic, Google — with automatic complexity-based routing

**Deploy:**

- One-click deployment to web, Slack, WhatsApp, Telegram, and voice
- White-label embed system for partner distribution
- Playbook Marketplace: install pre-built solutions in minutes
- Event-driven triggers, cron scheduling, and webhook automation

**Govern:**

- Input/output guardrails (PII, secrets, prompt injection, toxicity)
- Budget hierarchy: subscription → org → user → agent
- Tool permission guards and network egress control
- Full audit trail with compliance infrastructure (GDPR/CCPA)

**Scale:**

- Multi-tenant isolation (orgs → workspaces → environments)
- Cross-organization federation with encrypted channels
- Campaign/Mission Command for autonomous multi-step execution
- Remote compute provisioning for build verification

**Improve:**

- Continuous learning pipeline: signals → proposals → A/B experiments → auto-promotion
- Two-tier evaluation (heuristic + LLM-powered)
- After Action Reviews with failure taxonomy
- Calibration checks (AI vs. human feedback)

**Design:** Horizontal card row with hover expansion or accordion on mobile. Each card uses a distinct accent color or icon.

---

## Phase 3: Channel Deployment + Integration Ecosystem

### 3.1 Channel Deployment Section

**Headline:** "Deploy once. Reach everywhere."

**Visual:** A diagram or animation showing a single agent connected to multiple channels:

Web Chat — Slack — WhatsApp — Telegram — Voice (Twilio) — Email (Gmail/Outlook) — White-Label Embed

**Supporting copy:** "Your agents aren't trapped in a chat window. Deploy to every channel your team and customers use — with unified conversation memory, intelligent routing, and per-channel commands. Switch channels mid-conversation without losing context."

**Design:** Use channel logos/icons in a radial or linear layout around a central "Agent" node. Animate connections on scroll-into-view.

### 3.2 Integration Ecosystem Section

**Headline:** "Connected to 200+ tools via MCP"

**Subheadline:** "MCP (Model Context Protocol) is the open standard for connecting AI agents to external tools. AgentC2 supports 40+ integration blueprints with OAuth and API key authentication, encrypted per-organization credentials."

**Visual:** Logo grid organized by category:

- **CRM:** HubSpot, Salesforce, Pipedrive, Close, Intercom
- **Communication:** Slack, Teams, Gmail, Outlook, WhatsApp, Telegram, Twilio
- **Productivity:** Jira, GitHub, Linear, Notion, Asana, Monday, Airtable, ClickUp
- **File Storage:** Google Drive, Dropbox, Box
- **Automation:** n8n/ATLAS, Zapier, Make
- **Voice:** ElevenLabs, OpenAI, Twilio
- **Commerce:** Stripe, Shopify, Square
- **Cloud:** AWS, Azure, GCP, DigitalOcean
- **Web:** Playwright, Firecrawl, Apify

**CTA:** "See all integrations →" linking to a future integrations page or the docs MCP section.

**Design:** Grid of grayscale logos that colorize on hover. Category tabs or scrolling carousel on mobile.

---

## Phase 4: Three Unique Differentiators

Three feature spotlight cards with product screenshots or diagrams.

### 4.1 Federation Card

**Title:** "Federation — Agents That Cross Organizational Boundaries"

**Body:** "The only platform with cross-organization agent collaboration. Establish encrypted AES-GCM channels between organizations, expose specific agents with fine-grained controls, enforce rate limits and circuit breakers, scan for PII by data classification tier, and discover partner agents via agent cards. Your agents can securely work with your partners' agents."

**Visual:** Diagram showing two organizations with agents communicating through an encrypted channel.

**CTA:** "Learn about Federation →" linking to `/platform/federation`

### 4.2 Mission Command Card

**Title:** "Mission Command — Autonomous Campaign Execution"

**Body:** "Define intent and end state. AgentC2 decomposes into missions, assigns agents, executes tasks, generates After Action Reviews, and adapts through rework loops — all with human approval gates where you need them. Military-grade planning discipline applied to AI agent operations."

**Visual:** Flow diagram: Intent → Missions → Tasks → AARs → Complete

**CTA:** "Learn about Mission Command →" linking to `/platform/mission-command`

### 4.3 Playbook Marketplace Card

**Title:** "Playbook Marketplace — Deploy Proven Solutions in One Click"

**Body:** "Package entire agent solutions — agents, skills, documents, workflows, networks, guardrails, and test cases — into deployable playbooks. Install from the marketplace in one click, customize for your organization, or publish and monetize your own solutions with Stripe Connect payouts."

**Visual:** Screenshot of the marketplace browse interface or a playbook detail page.

**CTA:** "Explore the Marketplace →" linking to `/platform/marketplace`

**Design:** Large cards in a 3-column grid. Each card has a colored top border or accent. Product screenshots or technical diagrams preferred over illustrations.

---

## Phase 5: Demo, Use Cases, Trust, How It Works, Footer CTA

### 5.1 Interactive Demo Section

**Headline:** "Try it now. Talk to an AgentC2 agent."

Embed the existing welcome agent directly in the marketing page. Reuse the embed infrastructure from the current root page, but contained within a section — not full-screen.

**Implementation:**

- Render the embed iframe in a contained card/frame (max-height ~500px)
- Show the agent conversation with a few suggestion chips
- Include a small caption: "This agent is powered by AgentC2. It uses MCP tools, RAG knowledge, and conversation memory."

**Design:** Centered, bordered card on a contrasting background. Feels like a live product demo, not a chatbot widget.

### 5.2 Use Cases Tab Section

**Headline:** "From sales to engineering to operations"

Tabbed interface with 6 tabs:

| Tab                | Description                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Sales & Revenue    | CRM agents across HubSpot/Salesforce, pipeline management, outreach — deployed to Slack and email         |
| Customer Support   | Multi-channel agents (web, WhatsApp, Telegram, Slack) with knowledge-powered responses and escalation     |
| Engineering        | Dark Factory coding pipeline, Jira triage, GitHub automation, build verification with provisioned compute |
| Operations         | Campaign execution with Mission Command, scheduling, cross-department coordination                        |
| Construction & AEC | BIM model parsing, quantity takeoffs, clash detection — connected to Appello field management             |
| Partner Networks   | Federation-powered agent collaboration across organizations, encrypted channels, agent discovery          |

Each tab shows a short paragraph + 3–4 bullet points + a "Learn more →" link to the full use case page.

### 5.3 Trust & Proof Bar

Horizontal bar with key stats and trust signals:

- "200+ MCP tools"
- "40+ integration blueprints"
- "6 deployment channels"
- "AES-256-GCM encryption"
- "GDPR & CCPA compliant"
- "SOC 2 operational readiness"

Links to: Trust Center | Security Policy | AI Transparency

### 5.4 How It Works (3-Step)

**Headline:** "Production-ready in minutes"

1. **Connect** — "Link your tools. Gmail, Slack, HubSpot, Jira — OAuth or API key. Encrypted and isolated per organization."
2. **Deploy** — "Create agents from scratch or install from the Playbook Marketplace. Attach skills, knowledge, and workflows."
3. **Govern & Scale** — "Set guardrails, budgets, and permissions. Monitor runs. Let the learning loop improve your agents continuously."

**Design:** Three numbered steps with icons and connecting lines/arrows.

### 5.5 Footer CTA Section

**Headline:** "Your agents deserve a production platform."

**Subheadline:** "Start free. Scale to enterprise."

**Primary CTA:** "Get Started Free" → `/signup`
**Secondary CTA:** "Talk to Enterprise Sales" → `/enterprise` or `mailto:enterprise@agentc2.ai`

**Design:** Full-width section with strong background color. Large, high-contrast CTA buttons.

---

## Verification Checklist

- [ ] Home page loads at `/` with full marketing content
- [ ] Hero communicates what, who, and why within 5 seconds (ask 3 people)
- [ ] Product screenshot/video is real (not a mockup)
- [ ] Problem statement clearly separates from 3 competitor categories
- [ ] Five Pillars are scannable without reading full text
- [ ] Channel diagram shows all 7 deployment channels
- [ ] Integration logos are real and correctly attributed
- [ ] MCP is explained on first use, not removed
- [ ] Three differentiator cards link to detailed pages (even if placeholder)
- [ ] Interactive demo embed works and shows a live agent conversation
- [ ] Use case tabs have content for all 6 verticals
- [ ] Trust bar has correct stats and links
- [ ] Both CTAs work (signup + enterprise)
- [ ] Page is responsive (mobile, tablet, desktop)
- [ ] Lighthouse score ≥ 90 (performance, accessibility)
- [ ] Open Graph meta and preview image work correctly
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
