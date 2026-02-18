# AgentC2 Documentation & Content Implementation Plan

## Current State Assessment

### What's Done (Infrastructure)

- robots.txt, sitemap.ts, canonical URLs, JSON-LD schemas -- all functional
- Docs route system: `/docs` index + `/docs/[...slug]` detail pages rendering 90+ page definitions
- Blog route system: `/blog` index + `/blog/[slug]` detail pages rendering 12 post definitions
- DocsShell component with left sidebar nav + right "On this page" TOC
- OG image generation for root, /docs, /blog, and /blog/[slug]
- GA4 analytics wiring with content tracking events
- Proxy allows /docs and /blog as public routes
- Planning artifacts in docs/seo-docs-program/

### What's NOT Done (Critical Gaps)

#### Gap 1: Users cannot reach /docs or /blog from agentc2.ai

- **Caddyfile.production** only routes `/terms`, `/privacy`, `/security` to frontend (port 3000). Everything else falls through to agent app (port 3001). `/docs` and `/blog` are NOT routed to the frontend app.
- **Nav bar** (`nav-bar.tsx`) has zero links to /docs or /blog. Links: Platform, Solutions, Pricing, FAQ, Privacy.
- **Footer** (`footer.tsx`) has placeholder `#` hrefs for "Documentation", "API Reference", "Blog", "About", "Careers", "Status".

#### Gap 2: Content is ~30% real

- 15 of 90+ docs pages have custom body text. The other ~75 use auto-generated placeholder sentences like _"Creating Agents explains how AgentC2 approaches AI agent orchestration platform with production reliability in mind."_
- 6 of 12 blog posts have full sections. The other 6 are skeletons with one "Overview" paragraph.
- Zero code examples, screenshots, diagrams, or visual content anywhere.

#### Gap 3: Minor polish issues

- Debug text "Slug: {currentSlug}" visible on every docs page (line 71 in docs-shell.tsx)
- Docs sidebar only shows section-level links, not individual page links within a section
- No "previous / next" page navigation within docs sections
- Blog author is generic "AgentC2 Editorial Team" with no profile/bio

---

## Implementation Plan

### Phase 0: Make Docs/Blog Reachable from agentc2.ai (Prerequisite)

This must ship before any content work matters.

#### 0.1 Update Caddyfile for production routing

**File:** `apps/caddy/Caddyfile.production`

Add a new route block BEFORE the catch-all handler that routes `/docs` and `/blog` to the frontend app (port 3000):

```
# Public docs and blog pages -- route to frontend app
@public_content {
    path /docs /docs/* /blog /blog/*
}

handle @public_content {
    reverse_proxy localhost:3000
}
```

This block must be placed after the `@public_legal` handler (line 50) and before the `@admin_routes` handler (line 61).

#### 0.2 Update landing page nav bar

**File:** `apps/frontend/src/components/landing/nav-bar.tsx`

Add "Docs" and "Blog" links to the desktop nav (between FAQ and Privacy) and to the mobile menu:

Desktop (after FAQ link, before Privacy link):

- `<Link href="/docs">Docs</Link>`
- `<Link href="/blog">Blog</Link>`

Mobile (same position in mobile menu list).

#### 0.3 Update landing page footer

**File:** `apps/frontend/src/components/landing/footer.tsx`

Change placeholder `#` hrefs to real destinations:

- "Documentation" -> `/docs`
- "API Reference" -> `/docs/api-reference/agents`
- "Blog" -> `/blog`
- "About" -> `/about`

#### 0.4 Remove debug text from docs shell

**File:** `apps/frontend/src/components/docs/docs-shell.tsx`

Remove line 71: `<p className="text-muted-foreground mt-3 text-xs">Slug: {currentSlug}</p>`

#### 0.5 Acceptance criteria

- User visits agentc2.ai -> clicks "Docs" in nav -> arrives at /docs index
- User clicks "Blog" in nav -> arrives at /blog index
- Footer Documentation/Blog links work
- No debug text visible on docs pages
- Works in both local dev (localhost:3000) and production (behind Caddy)

---

### Phase 1: Docs Shell UX Improvements

#### 1.1 Expand sidebar to show per-section page links

**File:** `apps/frontend/src/components/docs/docs-shell.tsx`

The sidebar currently shows 12 section names. Expand it so clicking a section reveals the individual page links within that section. Use the existing `DOCS_PAGES` data to filter pages by `section` field.

Implementation:

- Import `DOCS_PAGES` alongside `DOCS_SECTIONS`
- For the active section, render child page links beneath the section heading
- Highlight the current page with active styling
- Other sections remain collapsed (section name only)

#### 1.2 Add previous/next page navigation

**File:** `apps/frontend/src/app/docs/[...slug]/page.tsx`

At the bottom of each docs detail page, add "Previous" and "Next" links based on page order within the same section. Use the `DOCS_PAGES` array filtered by section to determine ordering.

#### 1.3 Add docs header with global search placeholder

**File:** `apps/frontend/src/app/docs/layout.tsx` (new file)

Create a docs layout that wraps all `/docs/*` pages with a consistent top bar showing:

- AgentC2 logo linking to `/`
- "Documentation" title
- Future search input placeholder
- Link back to main site

#### 1.4 Acceptance criteria

- Sidebar expands current section to show all child pages
- Current page is highlighted in sidebar
- Previous/Next links appear at bottom of every docs page
- Docs pages have a consistent header

---

### Phase 2: Write Real Documentation Content (90+ Pages)

This is the bulk of the work. Every page needs substantive, technically accurate content derived from the actual codebase. The content system is in `apps/frontend/src/lib/content/docs.ts` where each page's `body` array contains paragraphs.

#### Content production approach

Each page's `body` field in `docs.ts` must be replaced with real content. The content should:

- Explain the concept/feature with specificity to AgentC2's actual implementation
- Include at least one concrete example or usage pattern
- Reference actual API routes, configuration fields, or UI flows from the codebase
- Contain 400-1200 words per page (4-12 paragraphs)
- Use the target keywords naturally

#### 2.1 Getting Started section (5 pages)

| Page         | Content Source                                                                       |
| ------------ | ------------------------------------------------------------------------------------ |
| introduction | CLAUDE.md system overview, product positioning from docs/agentc2-product-overview.md |
| quickstart   | Agent creation flow from apps/agent, tool attachment patterns                        |
| architecture | Monorepo structure, database schema overview, Mastra core                            |
| key-concepts | Agent/Workflow/Network/Skill definitions from packages/mastra                        |
| first-agent  | Step-by-step from database seed to chat interaction                                  |

#### 2.2 Agents section (15 pages)

| Page              | Content Source                                             |
| ----------------- | ---------------------------------------------------------- |
| overview          | packages/mastra/src/agents/resolver.ts, Prisma Agent model |
| creating-agents   | API route apps/agent/src/app/api/agents/route.ts           |
| configuration     | Agent model fields, modelProvider/modelName, temperature   |
| model-providers   | packages/mastra/src/agents/resolver.ts model registry      |
| memory            | @mastra/memory integration, memoryConfig field             |
| tools             | packages/mastra/src/tools/registry.ts, 145+ tool list      |
| version-control   | AgentVersion model, rollback API route                     |
| budgets-and-costs | BudgetPolicy model, CostEvent tracking                     |
| guardrails        | GuardrailPolicy model, packages/mastra/src/guardrails/     |
| evaluations       | AgentEvaluation model, scorers, scorecards                 |
| learning          | LearningSession/Signal/Proposal/Experiment models          |
| simulations       | SimulationSession model                                    |
| output-actions    | OutputAction model                                         |
| public-embedding  | Embed pages, publicToken, visibility levels                |
| api-reference     | All /api/agents/\* endpoint signatures                     |

#### 2.3 Skills section (6 pages)

| Page                   | Content Source                        |
| ---------------------- | ------------------------------------- |
| overview               | Skill/SkillVersion/AgentSkill models  |
| creating-skills        | packages/mastra/src/skills/service.ts |
| progressive-disclosure | Skill activation logic                |
| auto-generated-skills  | MCP provisioner auto-skill creation   |
| version-control        | SkillVersion model                    |
| api-reference          | /api/skills/\* endpoints              |

#### 2.4 Workflows section (8 pages)

| Page               | Content Source                                   |
| ------------------ | ------------------------------------------------ |
| overview           | Workflow model, packages/mastra/src/workflows/   |
| creating-workflows | Workflow builder, /api/workflows/route.ts        |
| step-types         | WorkflowRunStep types                            |
| control-flow       | packages/mastra/src/workflows/builder/runtime.ts |
| human-in-the-loop  | Approval gates in workflows                      |
| ai-assisted-design | /api/workflows/[slug]/designer-chat              |
| version-control    | WorkflowVersion model                            |
| api-reference      | All /api/workflows/\* endpoints                  |

#### 2.5 Networks section (6 pages)

| Page               | Content Source                     |
| ------------------ | ---------------------------------- |
| overview           | Network/NetworkPrimitive models    |
| topology           | Topology builder logic             |
| creating-networks  | /api/networks/route.ts             |
| ai-assisted-design | /api/networks/[slug]/designer-chat |
| version-control    | NetworkVersion model               |
| api-reference      | All /api/networks/\* endpoints     |

#### 2.6 Integrations section (17 pages)

| Page                   | Content Source                                               |
| ---------------------- | ------------------------------------------------------------ |
| overview               | packages/mastra/src/mcp/client.ts, IntegrationProvider model |
| model-context-protocol | @mastra/mcp architecture, tool execution                     |
| hubspot                | HubSpot MCP server config                                    |
| jira                   | Jira MCP server config                                       |
| slack                  | Slack integration, /api/slack/events                         |
| github                 | GitHub MCP server config                                     |
| gmail                  | Gmail OAuth integration                                      |
| google-drive           | Google Drive MCP server                                      |
| google-calendar        | Calendar OAuth integration                                   |
| microsoft-outlook      | Microsoft Graph API integration                              |
| microsoft-teams        | Teams integration                                            |
| dropbox                | Dropbox OAuth integration                                    |
| elevenlabs             | Voice agent integration                                      |
| firecrawl              | Firecrawl MCP config                                         |
| fathom                 | Fathom MCP config                                            |
| justcall               | JustCall MCP config                                          |
| building-custom        | How to add a new MCP server                                  |

#### 2.7 Channels section (6 pages)

| Page     | Content Source                 |
| -------- | ------------------------------ |
| overview | Channel system architecture    |
| slack    | Slack bot setup from CLAUDE.md |
| whatsapp | WhatsApp/Baileys integration   |
| telegram | Telegram/grammy integration    |
| voice    | Twilio voice integration       |
| embed    | Embed pages, /embed/[slug]     |

#### 2.8 Knowledge section (5 pages)

| Page               | Content Source                  |
| ------------------ | ------------------------------- |
| overview           | @mastra/rag, RagDocument model  |
| document-ingestion | Document/DocumentVersion models |
| vector-search      | @mastra/rag vector search       |
| hybrid-search      | Combined search approach        |
| api-reference      | /api/rag/\* endpoints           |

#### 2.9 Campaigns section (4 pages)

| Page                 | Content Source                      |
| -------------------- | ----------------------------------- |
| overview             | Campaign/Mission/MissionTask models |
| creating-campaigns   | /api/campaigns/route.ts             |
| templates            | CampaignTemplate model              |
| after-action-reviews | AAR system in campaigns             |

#### 2.10 Platform section (8 pages)

| Page                   | Content Source                                             |
| ---------------------- | ---------------------------------------------------------- |
| multi-tenancy          | Organization/Workspace models                              |
| authentication         | Better Auth, @repo/auth                                    |
| security               | AES-256-GCM credential encryption, /security page content  |
| observability          | AgentTrace/AgentTraceStep, health scores                   |
| federation             | FederationAgreement/Exposure/Message models                |
| triggers-and-schedules | AgentTrigger/AgentSchedule models                          |
| background-jobs        | Inngest functions, apps/agent/src/lib/inngest-functions.ts |
| deployment             | DEPLOY.md, Digital Ocean setup                             |

#### 2.11 API Reference section (8 pages)

| Page         | Content Source                                          |
| ------------ | ------------------------------------------------------- |
| agents       | All /api/agents/\* routes with methods/params/responses |
| workflows    | All /api/workflows/\* routes                            |
| networks     | All /api/networks/\* routes                             |
| skills       | All /api/skills/\* routes                               |
| integrations | All /api/integrations/\* routes                         |
| knowledge    | All /api/rag/_ and /api/documents/_ routes              |
| campaigns    | All /api/campaigns/\* routes                            |
| platform     | All /api/organizations/\*, /api/activity, etc.          |

#### 2.12 Guides section (8 pages)

| Page                           | Content                                                     |
| ------------------------------ | ----------------------------------------------------------- |
| build-a-customer-support-agent | End-to-end: create agent, add Slack, set guardrails, deploy |
| build-a-research-agent         | Create agent with RAG + Firecrawl + web-fetch tools         |
| build-a-sales-agent            | Create agent with HubSpot + Gmail integrations              |
| multi-agent-orchestration      | Build a network with 3+ specialized agents                  |
| add-voice-to-your-agent        | ElevenLabs + OpenAI voice setup                             |
| continuous-learning-setup      | Enable learning sessions, review proposals                  |
| production-guardrails          | Configure org + agent guardrails for production             |
| migrate-from-langchain         | Map LangChain/LangGraph concepts to AgentC2 equivalents     |

#### 2.13 Acceptance criteria

- Every docs page has 400+ words of substantive, technically accurate content
- Content references actual codebase patterns and API routes
- No auto-generated placeholder text remains
- At least 5 pages include inline code examples

---

### Phase 3: Complete Blog Content (6 Remaining Posts)

Complete the 6 skeleton blog posts with full multi-section content.

#### 3.1 Posts to complete

| Post                                              | Target Words | Sections Needed |
| ------------------------------------------------- | ------------ | --------------- |
| multi-agent-networks-orchestrating-ai-teams       | 1500         | 4-5 sections    |
| skills-system-composable-competency-for-ai-agents | 1200         | 3-4 sections    |
| ai-agent-cost-management-llm-spend-control        | 1200         | 3-4 sections    |
| deploying-ai-agents-to-production-checklist       | 1500         | 5-6 sections    |
| human-in-the-loop-ai-approval-workflows           | 1200         | 3-4 sections    |
| ai-agent-evaluation-how-to-measure-performance    | 1200         | 3-4 sections    |

Each post must have:

- 3+ fully written sections with 2-3 paragraphs each
- At least 2 internal links to related docs pages
- Practical guidance, not just conceptual overview

#### 3.2 Acceptance criteria

- All 12 blog posts have complete multi-section content
- No skeleton "Overview" only posts remain
- Every post links to 2+ docs pages

---

### Phase 4: Production Deployment

#### 4.1 Deploy Caddy routing changes

- Push updated Caddyfile.production
- Reload Caddy on production server
- Verify /docs and /blog are reachable at agentc2.ai

#### 4.2 Set environment variables

- Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in production .env
- Verify GA4 events are firing

#### 4.3 Submit to Search Console

- Verify agentc2.ai domain in Google Search Console
- Submit sitemap.xml
- Request indexing of high-priority pages

#### 4.4 Acceptance criteria

- agentc2.ai/docs loads and renders correctly
- agentc2.ai/blog loads and renders correctly
- agentc2.ai/sitemap.xml includes all docs/blog URLs
- agentc2.ai/robots.txt is accessible
- GA4 events appear in Google Analytics dashboard
- Search Console shows sitemap submitted and pages indexed

---

## File Change Summary

### Files to modify

| File                                               | Change                                            |
| -------------------------------------------------- | ------------------------------------------------- |
| `apps/caddy/Caddyfile.production`                  | Add /docs and /blog routing to frontend app       |
| `apps/frontend/src/components/landing/nav-bar.tsx` | Add Docs and Blog nav links (desktop + mobile)    |
| `apps/frontend/src/components/landing/footer.tsx`  | Fix placeholder # links                           |
| `apps/frontend/src/components/docs/docs-shell.tsx` | Remove debug text, expand sidebar with page links |
| `apps/frontend/src/app/docs/[...slug]/page.tsx`    | Add previous/next page navigation                 |
| `apps/frontend/src/lib/content/docs.ts`            | Replace placeholder body content on ~75 pages     |
| `apps/frontend/src/lib/content/blog.ts`            | Complete 6 skeleton blog posts                    |

### Files to create

| File                                    | Purpose                          |
| --------------------------------------- | -------------------------------- |
| `apps/frontend/src/app/docs/layout.tsx` | Docs-specific layout with header |

### Files NOT to modify

- Plan file
- SEO infrastructure (already production-ready)
- Sitemap, robots.txt, metadata utilities (already correct)
- Analytics wiring (already functional)
- OG image routes (already working)

---

## Execution Order

1. **Phase 0** first -- this unblocks everything else (routing + nav + footer + debug fix)
2. **Phase 1** next -- docs UX improvements make content review possible
3. **Phase 2** in batches -- content production by section, starting with Getting Started and Agents
4. **Phase 3** after Phase 2 -- blog completion
5. **Phase 4** last -- deploy everything to production

---

## Risk: Content Accuracy

Every docs page must be verified against the actual codebase. The content definitions live in `apps/frontend/src/lib/content/docs.ts` as string arrays. For the content to be trustworthy:

- Cross-reference Prisma schema for model fields
- Cross-reference API routes for endpoint signatures
- Cross-reference packages/mastra for implementation details
- Flag any feature described in docs that doesn't exist in code
