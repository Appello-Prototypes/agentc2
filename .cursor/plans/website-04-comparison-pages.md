---
name: "Website — Plan 4: Competitive Comparison Pages"
overview: "Build SEO-optimized comparison pages for 7 key competitors. Each page follows a consistent template: what they are, what we are, where we differ, feature comparison table, and CTA. These pages capture high-intent search traffic and serve as sales enablement."
todos:
    - id: phase-1-template-first-three
      content: "Phase 1: Create comparison page template + first 3 pages (vs LangChain, vs n8n, vs CrewAI)"
      status: pending
    - id: phase-2-model-providers
      content: "Phase 2: vs OpenAI Assistants + vs Microsoft Copilot Studio pages"
      status: pending
    - id: phase-3-agent-platforms
      content: "Phase 3: vs Relevance AI + vs Mastra pages"
      status: pending
    - id: phase-4-index-seo
      content: "Phase 4: Comparison index page + structured data + internal linking"
      status: pending
isProject: false
---

# Plan 4: Competitive Comparison Pages

**Brand Reference:** All comparison pages use Template C (Data-driven) from [docs/brand-style-guide.md](/docs/brand-style-guide.md).

**Priority:** High — captures high-intent "X vs Y" search traffic and enables sales conversations

**Depends on:** Plan 1 (Foundation)

**Estimated Effort:** Medium (3–4 days)

---

## Comparison Page Template

Every comparison page follows the same structure. Build this as a reusable template/component.

### Template Structure

**File:** `apps/frontend/src/components/marketing/comparison-page.tsx`

**Data:** `apps/frontend/src/app/(marketing)/compare/_data/[competitor].ts`

```
1. Hero
   - Title: "AgentC2 vs {Competitor}"
   - Subtitle: One-sentence summary of the key difference
   - CTA: "Get Started Free"

2. TL;DR Summary (3 columns)
   - What {Competitor} is (1–2 sentences)
   - What AgentC2 is (1–2 sentences)
   - The key difference (1–2 sentences)

3. Detailed Comparison (alternating sections)
   - 5–7 comparison dimensions, each with:
     - Dimension name
     - What {Competitor} offers
     - What AgentC2 offers
     - Why it matters

4. Feature Comparison Table
   - Rows: features
   - Columns: AgentC2 | {Competitor}
   - Cells: ✓ (has), ✗ (doesn't have), "Partial", or specific details

5. "What Problem Does AgentC2 Solve That {Competitor} Doesn't?"
   - 2–3 paragraphs with concrete scenarios

6. Who Should Choose {Competitor}
   - Honest assessment — builds credibility

7. Who Should Choose AgentC2
   - Target personas and scenarios

8. CTA Banner
   - "Ready to move beyond {Competitor}?"
   - "Get Started Free" + "See How It Works"

9. FAQ
   - 4–6 questions with schema markup (FAQPage)
```

### SEO Requirements

Each comparison page must have:

- Title: `AgentC2 vs {Competitor}: {Key Difference} | AgentC2`
- Meta description (150–160 chars) mentioning both products and the key differentiator
- H1 matching the title
- JSON-LD: FAQPage schema for the FAQ section
- Canonical URL
- Internal links to relevant platform pages, use case pages, and docs

---

## Phase 1: Template + First 3 Comparison Pages

### 1.1 Build the Comparison Page Template

Create the reusable template component and data structure. Each competitor's data is a TypeScript file that feeds into the template.

**Data structure:**

```typescript
interface ComparisonData {
    slug: string;
    competitor: string;
    competitorUrl: string;
    heroSubtitle: string;
    tldr: { them: string; us: string; difference: string };
    dimensions: Array<{
        name: string;
        them: string;
        us: string;
        whyItMatters: string;
    }>;
    featureTable: Array<{
        feature: string;
        us: string | boolean;
        them: string | boolean;
    }>;
    problemWeSolve: string;
    whoShouldChooseThem: string;
    whoShouldChooseUs: string;
    faqs: Array<{ question: string; answer: string }>;
    meta: { title: string; description: string };
}
```

### 1.2 AgentC2 vs LangChain/LangGraph (`/compare/langchain`)

**Priority:** Highest developer search volume

**Hero subtitle:** "Framework vs. Platform — why the gap between library and production matters"

**TL;DR:**

- **LangChain:** Python-first developer framework for building LLM applications. LangGraph adds graph-based orchestration. LangSmith adds observability.
- **AgentC2:** TypeScript-native production platform with full UI, multi-tenant governance, marketplace, and multi-channel deployment.
- **Key difference:** LangChain gives you building blocks and expects you to build the platform. AgentC2 is the platform.

**Comparison dimensions:**

1. Language & ecosystem (Python vs TypeScript)
2. Deployment (DIY infrastructure vs built-in hosting)
3. Multi-agent orchestration (LangGraph state machines vs Networks + Campaigns)
4. Governance (basic tracing vs full guardrail stack)
5. Voice & channels (none vs 7 channels + voice)
6. Marketplace (none vs Playbook Marketplace)
7. Federation (none vs encrypted cross-org collaboration)

**Feature table:** Multi-tenant, voice, WhatsApp, Telegram, federation, marketplace, coding pipeline, BIM, budget enforcement, continuous learning, embed system

### 1.3 AgentC2 vs n8n (`/compare/n8n`)

**Priority:** Highest automation search volume

**Hero subtitle:** "Workflow automation vs. AI agent operations — agents that think, not flows that execute"

**TL;DR:**

- **n8n:** Open-source visual workflow automation platform with AI agent nodes.
- **AgentC2:** AI-native agent operations platform where agents reason, plan, and adapt — not just follow predefined paths.
- **Key difference:** n8n automates tasks with optional AI. AgentC2 deploys intelligent agents that can build their own workflows, execute campaigns autonomously, and learn from every interaction.

**Comparison dimensions:**

1. Core paradigm (workflow-first vs agent-first)
2. Intelligence (AI as a node vs agents as the core primitive)
3. Autonomy (follows paths vs reasons, plans, delegates)
4. Governance (none vs full guardrail + budget + egress stack)
5. Voice & channels (none vs 7 channels + voice)
6. Learning (none vs continuous learning pipeline)
7. Federation (none vs cross-org collaboration)

### 1.4 AgentC2 vs CrewAI (`/compare/crewai`)

**Priority:** Highest multi-agent search volume

**Hero subtitle:** "Role-playing agents vs. production agent operations — from demo to deployment"

**TL;DR:**

- **CrewAI:** Python-based multi-agent framework with role/goal/backstory agent model and visual studio.
- **AgentC2:** TypeScript-native production platform with multi-agent networks, campaign execution, governance, and multi-channel deployment.
- **Key difference:** CrewAI makes multi-agent demos easy but burns 3x token overhead. AgentC2 runs agents in production with budget controls, continuous learning, and real channel deployment.

**Comparison dimensions:**

1. Language & ecosystem (Python vs TypeScript)
2. Token efficiency (3x overhead vs managed context windowing)
3. Orchestration depth (role/goal/task vs Networks + Campaign/Mission Command)
4. Production readiness (50-100 execution limits vs unlimited with budgets)
5. Governance (Enterprise-only vs every tier)
6. Voice & channels (none vs 7 channels + voice)
7. Marketplace (none vs Playbook Marketplace)

---

## Phase 2: Model Provider Comparisons

### 2.1 AgentC2 vs OpenAI (`/compare/openai`)

**Hero subtitle:** "Model provider vs. agent operations platform — intelligence is not enough"

**TL;DR:**

- **OpenAI:** The dominant AI model provider with Assistants API, GPTs, and ChatGPT Enterprise.
- **AgentC2:** Model-agnostic agent operations platform that uses OpenAI (and Anthropic and Google) as interchangeable model backends.
- **Key difference:** OpenAI sells intelligence. AgentC2 sells the operational layer that puts intelligence to work across your organization — with governance, multi-channel deployment, and learning that OpenAI doesn't offer.

**Comparison dimensions:**

1. Model flexibility (OpenAI-only vs model-agnostic with routing)
2. Multi-agent (basic assistants vs Networks + Campaigns)
3. Governance (usage limits vs guardrails + budgets + egress + audit)
4. Channels (web only vs 7 channels + voice)
5. Enterprise (ChatGPT Enterprise basics vs full multi-tenant platform)
6. Learning (none vs continuous learning pipeline)
7. Marketplace (GPT Store vs Playbook Marketplace with monetization)

### 2.2 AgentC2 vs Microsoft Copilot Studio (`/compare/copilot-studio`)

**Hero subtitle:** "Microsoft-locked vs. ecosystem-agnostic — freedom to integrate with everything"

**TL;DR:**

- **Copilot Studio:** Low-code agent builder deeply integrated with Microsoft 365 and Azure.
- **AgentC2:** Ecosystem-agnostic agent platform that integrates with 200+ MCP tools from any vendor — not just Microsoft.
- **Key difference:** Copilot Studio works beautifully if you're all-in on Microsoft. AgentC2 works with everything — and adds federation, voice, coding pipeline, and marketplace that Microsoft doesn't offer.

**Comparison dimensions:**

1. Ecosystem (M365-locked vs 200+ MCP integrations from any vendor)
2. Voice (none vs ElevenLabs + OpenAI + Twilio)
3. Channels (Teams/web/social vs WhatsApp + Telegram + Slack + Voice + embed)
4. Federation (none vs encrypted cross-org collaboration)
5. Learning (none vs continuous learning pipeline)
6. Coding pipeline (none vs Dark Factory)
7. Marketplace (none vs Playbook Marketplace)

---

## Phase 3: Agent Platform Comparisons

### 3.1 AgentC2 vs Relevance AI (`/compare/relevance-ai`)

**Hero subtitle:** "No-code agent builder vs. full-stack agent operations — breadth matters"

**TL;DR:**

- **Relevance AI:** Enterprise no-code platform for building AI agent workforces with 2000+ integrations.
- **AgentC2:** Full-stack agent operations platform with MCP integrations, multi-channel deployment, federation, coding pipeline, and marketplace.
- **Key difference:** Relevance AI is a strong no-code agent builder. AgentC2 goes further with cross-org federation, autonomous campaign execution, multi-channel deployment (WhatsApp, Telegram, voice), a coding pipeline, and a packaged solution marketplace.

**Comparison dimensions:**

1. Integration approach (proprietary 2000+ vs MCP standard 200+)
2. Channels (web + calling vs 7 channels + voice + embed)
3. Federation (none vs encrypted cross-org)
4. Autonomy (task execution vs Campaign/Mission Command)
5. Coding pipeline (none vs Dark Factory)
6. Marketplace (none vs Playbook Marketplace)
7. Pricing model (actions-based vs budget-hierarchy)

### 3.2 AgentC2 vs Mastra (`/compare/mastra`)

**Hero subtitle:** "Open-source framework vs. production platform — built on Mastra, beyond Mastra"

**TL;DR:**

- **Mastra:** Open-source TypeScript agent framework with agents, workflows, RAG, memory, MCP, and evals.
- **AgentC2:** Production SaaS platform built on Mastra that adds multi-tenancy, admin portal, governance, marketplace, federation, channels, voice, learning pipeline, embed system, and 200+ pre-built tools.
- **Key difference:** Mastra is the engine. AgentC2 is the vehicle, the road, the fuel station, the traffic laws, the dealership, and the service center.

**Comparison dimensions:**

1. Nature (OSS framework vs production SaaS)
2. Multi-tenancy (none vs orgs → workspaces → agents)
3. Admin (none vs full admin portal with lifecycle, flags, impersonation, audit)
4. Governance (none vs guardrails + budgets + egress + permissions + compliance)
5. Marketplace (none vs Playbook Marketplace with monetization)
6. Federation (none vs encrypted cross-org collaboration)
7. Channels (none vs WhatsApp + Telegram + Voice + Slack + embed)
8. Voice (none vs ElevenLabs + OpenAI + hybrid + Twilio)
9. Tools (limited built-in vs 200+ native + MCP dynamic loading)
10. Learning (basic evals vs full learning pipeline with A/B experiments)

**Tone:** Respectful — Mastra is our foundation. Frame as "built on, extended beyond." Acknowledge Mastra's contributions. Position AgentC2 as what happens when you take Mastra and build a production platform around it.

---

## Phase 4: Index Page + SEO + Internal Linking

### 4.1 Comparison Index (`/compare`)

**Purpose:** Central hub for all comparison pages. Captures "AgentC2 alternatives" and "AgentC2 competitors" searches.

**Content:**

- Hero: "How AgentC2 compares"
- Grid of comparison cards (one per competitor) with:
    - Competitor logo
    - Competitor category (Model Provider / Framework / Automation / Agent Platform)
    - One-line key difference
    - Link to full comparison page

**Category groupings:**

- Model Providers: OpenAI
- Agent Platforms: Copilot Studio, Relevance AI
- Developer Frameworks: LangChain, CrewAI, Mastra
- Automation: n8n

### 4.2 Structured Data

Each comparison page includes:

- FAQPage schema for the FAQ section
- BreadcrumbList schema
- WebPage schema with `about` referencing both products

### 4.3 Internal Linking

Every comparison page links to:

- Relevant platform pages (e.g., LangChain comparison links to Architecture page)
- Relevant use case pages
- The comparison index
- Signup

Add a "Compare" link in the global navigation that leads to `/compare`.

---

## Verification Checklist

- [ ] Comparison template renders correctly with all sections
- [ ] All 7 comparison pages have unique, accurate content
- [ ] Feature comparison tables are factually correct (verify against competitor docs)
- [ ] Each page has proper meta tags (title, description, canonical)
- [ ] FAQPage schema validates in Google's Rich Results Test
- [ ] Comparison index page lists all comparisons with correct links
- [ ] All internal links work
- [ ] Tone is confident but fair (not dismissive of competitors)
- [ ] MCP is mentioned and explained where relevant
- [ ] Pages are responsive
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
