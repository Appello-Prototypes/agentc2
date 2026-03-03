---
name: "Website — Plan 7: Content Strategy & SEO Infrastructure"
overview: "Establish SEO infrastructure across all new pages, optimize structured data, build internal linking strategy, define content calendar for blog and docs alignment, and set up analytics foundations."
todos:
    - id: phase-1-structured-data
      content: "Phase 1: Structured data (JSON-LD) across all marketing pages — Organization, WebPage, FAQPage, BreadcrumbList, Product"
      status: pending
    - id: phase-2-internal-linking
      content: "Phase 2: Internal linking strategy — cross-link platform, comparison, use case, and developer pages"
      status: pending
    - id: phase-3-content-calendar
      content: "Phase 3: Content calendar — blog topics and docs updates aligned with new pages"
      status: pending
isProject: false
---

# Plan 7: Content Strategy & SEO Infrastructure

**Priority:** Medium — long-term organic growth engine

**Depends on:** Plans 2–6 (needs pages to optimize)

**Estimated Effort:** Medium (2–3 days)

---

## Phase 1: Structured Data (JSON-LD)

### 1.1 Organization Schema

**File:** `apps/frontend/src/app/layout.tsx` (add to root layout)

Add Organization JSON-LD to the root layout so it appears on every page:

```json
{
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "AgentC2",
    "url": "https://agentc2.ai",
    "logo": "https://agentc2.ai/logo.png",
    "description": "The AI operating system for organizations — build, deploy, govern, and scale intelligent AI agents.",
    "sameAs": [
        "https://github.com/agentc2",
        "https://x.com/agentc2",
        "https://linkedin.com/company/agentc2"
    ],
    "contactPoint": {
        "@type": "ContactPoint",
        "email": "hello@agentc2.ai",
        "contactType": "sales"
    }
}
```

### 1.2 Page-Level Schemas

Each page type gets appropriate JSON-LD:

| Page Type        | Schemas                                                |
| ---------------- | ------------------------------------------------------ |
| Home page        | Organization + WebPage + Product                       |
| Platform pages   | WebPage + BreadcrumbList                               |
| Comparison pages | WebPage + BreadcrumbList + FAQPage                     |
| Use case pages   | WebPage + BreadcrumbList                               |
| Enterprise       | WebPage + BreadcrumbList                               |
| Pricing          | WebPage + Product (with Offers)                        |
| Blog posts       | Article + BreadcrumbList (already exists — verify)     |
| Docs             | TechArticle + BreadcrumbList (already exists — verify) |

### 1.3 Product Schema for Pricing

Add Product schema to the pricing page with Offer entries for each tier:

```json
{
    "@type": "Product",
    "name": "AgentC2",
    "description": "AI Agent Operations Platform",
    "offers": [
        {
            "@type": "Offer",
            "name": "Starter",
            "price": "0",
            "priceCurrency": "USD"
        },
        {
            "@type": "Offer",
            "name": "Pro",
            "price": "79",
            "priceCurrency": "USD",
            "billingIncrement": "month"
        }
    ]
}
```

### 1.4 BreadcrumbList Schema

Create a reusable breadcrumb component that:

- Renders visible breadcrumbs on the page
- Includes BreadcrumbList JSON-LD
- Automatically builds from the route hierarchy

Example for `/platform/channels`:

```
Home > Platform > Channels & Voice
```

### 1.5 Create a JSON-LD Helper

**File:** `apps/frontend/src/lib/structured-data.ts` (new)

Create helper functions that generate JSON-LD for each schema type:

```typescript
export function generateOrganizationSchema(): object
export function generateWebPageSchema(params: { title: string; description: string; url: string }): object
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>): object
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>): object
export function generateProductSchema(params: { ... }): object
```

Each marketing page imports and uses the appropriate helpers.

---

## Phase 2: Internal Linking Strategy

### 2.1 Cross-Page Link Map

Define a systematic internal linking strategy where every page links to related pages:

**Home page links to:**

- All platform pages (from Five Pillars section)
- All use case pages (from Use Cases tabs)
- Comparison index (from Problem Statement)
- Pricing
- Signup

**Platform Overview links to:**

- All platform sub-pages
- Relevant use case pages
- Developer pages
- Enterprise page

**Each comparison page links to:**

- Comparison index
- Relevant platform pages (e.g., LangChain → Architecture, Channels)
- Relevant use case pages
- Enterprise page (for governance comparisons)
- Signup

**Each use case page links to:**

- Use case index
- Relevant platform pages (e.g., Sales → Channels, Marketplace)
- Relevant comparison pages (e.g., Sales → vs Relevance AI)
- Relevant marketplace playbooks
- Signup

**Enterprise page links to:**

- Security page
- Trust Center
- Federation page
- Admin portal features (in docs)
- Pricing

**Developer pages link to:**

- Full docs
- API reference (in docs)
- MCP docs (in docs)
- GitHub repo
- Architecture page

### 2.2 Contextual Link Components

Create reusable components for contextual linking:

- **RelatedPages** — "Related" sidebar or bottom section showing 3–4 related pages
- **NextSteps** — "Next Steps" section at the bottom of each page suggesting where to go next
- **InlineLink** — Styled inline link for within-paragraph cross-references

### 2.3 Navigation Footer Links

Update the footer to include links to all new sections:

```
Product                     Solutions               Developers          Compare
├── Platform Overview       ├── Sales & Revenue     ├── Documentation   ├── vs LangChain
├── How It Works            ├── Customer Support    ├── API Reference   ├── vs n8n
├── Architecture            ├── Engineering         ├── MCP Guide       ├── vs CrewAI
├── Channels & Voice        ├── Construction        ├── GitHub          ├── vs OpenAI
├── Federation              ├── Operations          └── Embed SDK       ├── vs Copilot Studio
├── Mission Command         └── Partner Networks                        ├── vs Relevance AI
├── Dark Factory                                                        └── vs Mastra
├── Marketplace
└── Pricing

Company                     Legal
├── About                   ├── Privacy Policy
├── Blog                    ├── Terms of Service
├── Careers                 ├── Security
├── Contact                 ├── Trust Center
└── Enterprise              ├── AI Transparency
                            └── Subprocessors
```

---

## Phase 3: Content Calendar & Blog/Docs Alignment

### 3.1 Blog Content Aligned with New Pages

Each new page should have supporting blog content that links back to the page and captures long-tail search traffic:

| Blog Topic                                                               | Supports Page          | Target Keywords                             |
| ------------------------------------------------------------------------ | ---------------------- | ------------------------------------------- |
| "What is AI Agent Operations (AgentOps)?"                                | Home, Platform         | ai agent operations, agentops               |
| "How to Deploy AI Agents to WhatsApp and Telegram"                       | Channels               | deploy ai agent whatsapp, ai agent telegram |
| "Cross-Organization AI Agent Federation: A Technical Guide"              | Federation             | ai agent federation, cross-org ai agents    |
| "Autonomous Coding Pipelines: From Ticket to Deploy"                     | Dark Factory           | autonomous coding, ai coding pipeline       |
| "Building a Playbook Marketplace for AI Agents"                          | Marketplace            | ai agent marketplace, agent playbook        |
| "AI Agent Guardrails: PII Detection, Prompt Injection, and More"         | Security               | ai guardrails, prompt injection detection   |
| "MCP (Model Context Protocol): Connecting AI Agents to 200+ Tools"       | Developers/MCP         | model context protocol, mcp ai tools        |
| "AgentC2 vs LangChain: Framework vs Platform"                            | Compare/LangChain      | agentc2 vs langchain                        |
| "AgentC2 vs n8n: Workflow Automation vs Agent Operations"                | Compare/n8n            | agentc2 vs n8n                              |
| "AI Agents for Construction: BIM, Takeoffs, and Field Coordination"      | Use Cases/Construction | ai agents construction, bim ai              |
| "AI Agents for Sales: CRM Automation That Actually Works"                | Use Cases/Sales        | ai agents sales, crm ai automation          |
| "Enterprise AI Agent Governance: Budgets, Permissions, and Audit Trails" | Enterprise             | enterprise ai governance, ai agent budget   |
| "White-Label AI Agents: The Embed Partner Model"                         | Embed Partners         | white label ai agent, embed ai agent        |
| "Mission Command for AI: Autonomous Multi-Step Execution"                | Mission Command        | autonomous ai execution, ai campaign        |

**Note:** The blog already has comparison and thought leadership content. Cross-reference existing posts and update them to link to new pages where relevant.

### 3.2 Documentation Updates

Ensure docs align with new marketing pages:

| Doc Topic                 | Aligns With          | Status                        |
| ------------------------- | -------------------- | ----------------------------- |
| MCP overview              | Developers/MCP page  | Exists — verify links         |
| Agent configuration       | Platform Overview    | Exists — verify links         |
| Guardrails guide          | Security page        | Exists — verify links         |
| Continuous learning guide | Platform Overview    | Exists — verify links         |
| Deploy to Slack guide     | Channels page        | Exists — verify links         |
| Federation setup          | Federation page      | Needs creation or enhancement |
| Embed integration         | Embed Partners page  | Needs creation or enhancement |
| Dark Factory setup        | Dark Factory page    | Needs creation                |
| Campaign/Mission Command  | Mission Command page | Needs creation or enhancement |
| Playbook authoring        | Marketplace page     | Needs creation or enhancement |

### 3.3 SEO Meta Templates

Create meta tag templates for each page type to ensure consistency:

**Home page:**

- Title: "AgentC2 — The AI Operating System for Your Organization"
- Description: "Build, deploy, and govern AI agents across web, Slack, WhatsApp, and voice. 200+ MCP tool integrations. Enterprise security. Playbook marketplace. Start free."

**Platform pages:**

- Title: "{Feature} | AgentC2 Platform"
- Description: "{Feature description in 150 chars} — part of the AgentC2 AI agent operations platform."

**Comparison pages:**

- Title: "AgentC2 vs {Competitor}: {Key Difference} | AgentC2"
- Description: "Compare AgentC2 and {Competitor}. {One-sentence key difference}. See the full feature comparison."

**Use case pages:**

- Title: "AI Agents for {Vertical} | AgentC2"
- Description: "Deploy AI agents for {vertical}. {Key capability}. {Key integration}. Start free with AgentC2."

**Enterprise:**

- Title: "Enterprise AI Agent Platform | AgentC2"
- Description: "Multi-tenant AI agent platform with governance, compliance, and admin controls. SOC 2 ready. GDPR/CCPA compliant. Talk to sales."

---

## Verification Checklist

- [ ] Organization JSON-LD present on every page
- [ ] Each page has appropriate schema types
- [ ] BreadcrumbList renders correctly and matches URL hierarchy
- [ ] FAQPage schema validates in Google Rich Results Test
- [ ] Product schema on pricing page is accurate
- [ ] Internal links connect all related pages (no orphan pages)
- [ ] Footer includes links to all new sections
- [ ] Blog content calendar is documented and aligns with pages
- [ ] Meta descriptions are unique and within 150–160 chars
- [ ] Canonical URLs are correct
- [ ] Open Graph images are set for social sharing
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
