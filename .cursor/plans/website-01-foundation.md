---
name: "Website — Plan 1: Foundation & Structure"
overview: "Fix broken navigation, restructure routes so marketing landing is at root, create shared layout components, and establish the design system for all public pages. This plan unblocks all other website plans."
todos:
    - id: phase-1-navigation-fixes
      content: "Phase 1: Fix broken navigation — Log In links, footer URLs, contact email, signup redirect"
      status: pending
    - id: phase-2-route-restructure
      content: "Phase 2: Restructure routes — move marketing landing to /, create /platform /compare /use-cases /enterprise route groups"
      status: pending
    - id: phase-3-shared-layout
      content: "Phase 3: Create shared marketing layout system — header, footer, section components, design tokens"
      status: pending
    - id: phase-4-sitemap-seo
      content: "Phase 4: Update sitemap, robots.txt, and meta tags for new route structure"
      status: pending
isProject: false
---

# Plan 1: Website Foundation & Structure

**Priority:** Critical — structural issues block all other plans

**Estimated Effort:** Medium (2–3 days)

---

## Phase 1: Fix Broken Navigation

**Problem:** Multiple navigation issues identified in the site audit create a broken first impression.

### 1.1 Fix Log In Links

**Files:**

- `apps/frontend/src/components/marketing/nav-bar.tsx` — "Log In" links to `#hero` (same page anchor). Change to `/login` or the agent app login URL.
- `apps/frontend/src/components/site-header.tsx` — "Log In" links to `/` (root). Change to proper login route.

**Action:** Update both components to link to the correct login destination. If the login lives on the agent app (`/agent/login`), use the full URL or the Caddy-proxied path.

### 1.2 Fix Footer Placeholder URLs

**File:** `apps/frontend/src/components/footer.tsx`

**Issues:**

- GitHub link → `#` or generic URL → should link to the actual AgentC2 GitHub org or repo
- Status link → `#` → should link to a status page or be removed until one exists
- Careers link → `#` → should link to a careers page or be removed

**Action:** Update all placeholder URLs. For links without a real destination yet, either remove the link or add a `mailto:` or `/contact` fallback.

### 1.3 Fix Contact Email Inconsistency

**Issue:** Footer uses `hello@agentc2.com`, other places use `hello@agentc2.ai`.

**Action:** Standardize on `hello@agentc2.ai` across all files. Search for all occurrences and update.

### 1.4 Fix Signup Redirect

**File:** `apps/frontend/src/app/signup/page.tsx` (or equivalent)

**Issue:** After signup, redirects to `/dashboard` instead of `/workspace`.

**Action:** Update redirect target to `/workspace` (or the onboarding flow if the user hasn't completed onboarding).

---

## Phase 2: Route Restructure

**Problem:** Marketing landing content is at `/about`, while `/` is an embed-first experience. The embed is valuable but should be part of the marketing page, not a replacement for it.

### 2.1 Move Marketing Landing to Root

**Current state:**

- `/` → embed iframe or "AgentC2 is loading…" fallback
- `/about` → full marketing landing (Hero, Features, HowItWorks, Pricing, FAQ, CTA)

**Target state:**

- `/` → full marketing landing with interactive demo section (embed integrated as one section)
- `/about` → redirect to `/` (or become a company about page with team, mission, story)

**Files to modify:**

- `apps/frontend/src/app/page.tsx` — replace embed-first logic with marketing landing
- `apps/frontend/src/app/about/page.tsx` — convert to redirect or company-specific content

**Implementation:**

1. Copy the `LandingPage` component rendering from `/about/page.tsx` into `/page.tsx`
2. Move the embed logic into a dedicated section within the landing page (Section 10 in the home page plan)
3. Set up `/about` as either a redirect to `/` or a company-specific page (team, mission, values)

### 2.2 Create Route Groups for New Pages

Create the following route group directories (pages will be populated by subsequent plans):

```
apps/frontend/src/app/
├── (marketing)/          # Shared layout for all marketing pages
│   ├── layout.tsx        # Marketing layout (header + footer)
│   ├── page.tsx          # Home page (moved from about)
│   ├── platform/
│   │   ├── page.tsx              # Platform overview
│   │   ├── how-it-works/page.tsx
│   │   ├── architecture/page.tsx
│   │   ├── channels/page.tsx
│   │   ├── federation/page.tsx
│   │   ├── mission-command/page.tsx
│   │   ├── dark-factory/page.tsx
│   │   └── marketplace/page.tsx
│   ├── compare/
│   │   ├── page.tsx              # Comparison index
│   │   ├── [slug]/page.tsx       # Dynamic comparison pages
│   │   └── _data/                # Comparison data files
│   ├── use-cases/
│   │   ├── page.tsx              # Use cases index
│   │   └── [slug]/page.tsx       # Dynamic use case pages
│   ├── enterprise/page.tsx
│   ├── embed-partners/page.tsx
│   └── developers/
│       ├── page.tsx              # Developer overview
│       ├── api/page.tsx
│       └── mcp/page.tsx
```

**Note:** Use Next.js route groups `(marketing)` so these pages share a layout without affecting the URL structure. The existing `/docs`, `/blog`, `/security`, `/trust-center`, `/pricing` routes remain where they are.

### 2.3 Update Navigation to Include New Pages

**File:** `apps/frontend/src/components/site-header.tsx`

Update the primary navigation:

```
Platform (dropdown)
├── Platform Overview
├── How It Works
├── Architecture
├── Channels & Voice
├── Federation
├── Marketplace
├── Dark Factory

Solutions (dropdown)
├── Sales & Revenue
├── Customer Support
├── Engineering & DevOps
├── Construction & AEC
├── Operations
├── Partner Networks

Developers (dropdown)
├── Documentation
├── API Reference
├── MCP Integration
├── GitHub

Compare (link → /compare)

Pricing (link → /pricing)

Blog (link → /blog)
```

Right side:

```
Log In (link → proper login URL)
Get Started (button → /signup)
```

### 2.4 Add New Routes to Auth Proxy Allowlist

**File:** `apps/frontend/src/middleware.ts` (or equivalent proxy config)

Add all new marketing routes to the public (unauthenticated) allowlist:

- `/platform/*`
- `/compare/*`
- `/use-cases/*`
- `/enterprise`
- `/embed-partners`
- `/developers/*`

---

## Phase 3: Shared Marketing Layout System

**Reference:** All components must follow the [Brand Style Guide](/docs/brand-style-guide.md) — typography hierarchy, color tokens, spacing system, and section patterns.

**Problem:** Need consistent layout, typography, and component patterns across all new marketing pages.

### 3.1 Create Marketing Layout Component

**File:** `apps/frontend/src/app/(marketing)/layout.tsx`

```typescript
export default function MarketingLayout({ children }) {
    return (
        <>
            <SiteHeader />
            <main>{children}</main>
            <Footer />
        </>
    )
}
```

This ensures all marketing pages share the same header and footer.

### 3.2 Create Reusable Section Components

**File:** `apps/frontend/src/components/marketing/sections.tsx` (or directory)

Create reusable building blocks for marketing pages:

- **`PageHero`** — title, subtitle, CTAs, optional visual
- **`SectionHeader`** — section title + optional description
- **`FeatureGrid`** — grid of feature cards (icon, title, description)
- **`ComparisonTable`** — two-column or multi-column comparison
- **`TabSection`** — tabbed content area (for use cases, etc.)
- **`ProofBar`** — stats/trust badges in a horizontal row
- **`CTABanner`** — full-width call-to-action
- **`LogoGrid`** — integration/partner logo grid
- **`FlowDiagram`** — step-by-step visual flow

**Directory:** `apps/frontend/src/components/website/illustrations/`

Create SVG-style product illustration components (Appello-style React components that render stylized UI representations instead of raster screenshots). See the brand guide Section 8 for the full list of required illustrations and design standards. Key components include:

- **`AgentChatIllustration`** — chat bubbles with tool call panel, agent avatar
- **`AgentConfigIllustration`** — config card with model selector, tool list, guardrails
- **`WorkflowBuilderIllustration`** — step cards connected by arrows
- **`NetworkTopologyIllustration`** — central orchestrator with agent nodes
- **`ChannelDeploymentIllustration`** — agent hub with channel badges
- **`McpIntegrationIllustration`** — connection card with status and tool count
- **`GuardrailPanelIllustration`** — toggle rows with status indicators
- **`BudgetHierarchyIllustration`** — nested budget breakdown
- **`LearningPipelineIllustration`** — signal → proposal → experiment → promotion flow
- **`FederationIllustration`** — two orgs connected by encrypted channel
- **`CampaignIllustration`** — mission card with task list and AAR
- **`DarkFactoryIllustration`** — horizontal pipeline: ticket → plan → code → verify → deploy
- **`PlaybookCardIllustration`** — marketplace card with rating and install
- **`EvalScorecardIllustration`** — score bars with grade badge
- **`ObservabilityIllustration`** — mini dashboard with sparklines
- **`EmbedWidgetIllustration`** — browser frame with branded chat widget

These components should follow the existing shadcn/ui patterns, Tailwind CSS 4 design tokens, and the illustration design standards in the brand guide Section 8.

### 3.3 Define Marketing Design Tokens

All design tokens are defined in the [Brand Style Guide](/docs/brand-style-guide.md). The following are already established and must be used consistently:

- **Typography scale** — locked type scale from Display (48/52px) through Code (see brand guide Section 3)
- **Spacing** — section padding `py-20 md:py-28 lg:py-32`, gap system (see brand guide Section 4)
- **Max width** — `max-w-7xl` for full sections, `max-w-3xl` for text-heavy (see brand guide Section 4)
- **Color palette** — oklch design tokens from `@repo/ui` globals.css (see brand guide Section 2)
- **Card styles** — `rounded-2xl border border-border/60 bg-card` (see brand guide Section 5)
- **Section patterns** — standard, centered, alternating background, split content (see brand guide Section 6)

---

## Phase 4: Sitemap, Robots, and Meta

### 4.1 Update Sitemap

**File:** `apps/frontend/src/app/sitemap.ts`

Add all new routes to the sitemap with appropriate `changeFrequency` and `priority`:

- `/` — priority 1.0, weekly
- `/platform` — priority 0.9, monthly
- `/platform/*` sub-pages — priority 0.8, monthly
- `/compare/*` pages — priority 0.7, monthly
- `/use-cases/*` pages — priority 0.7, monthly
- `/enterprise` — priority 0.8, monthly
- `/developers` — priority 0.7, monthly
- `/pricing` — priority 0.9, weekly

### 4.2 Update Robots.txt

**File:** `apps/frontend/src/app/robots.ts`

Ensure all new marketing pages are allowed for crawling. Keep `/investor` as noindex.

### 4.3 Create Meta Tag Helpers

Create a helper function that generates consistent Open Graph and Twitter meta tags for all marketing pages:

```typescript
export function generateMarketingMeta(params: {
    title: string;
    description: string;
    path: string;
    ogImage?: string;
}): Metadata;
```

Each page should have:

- Unique title: `{Page Title} | AgentC2`
- Meta description (150–160 chars)
- Open Graph image (default to AgentC2 OG image if not specified)
- Canonical URL
- JSON-LD structured data where appropriate

---

## Verification Checklist

- [ ] All Log In links navigate to the correct login page
- [ ] Footer has no placeholder `#` URLs
- [ ] Contact email is consistent (`hello@agentc2.ai`) across all files
- [ ] Signup redirects to `/workspace` (or onboarding)
- [ ] `/` renders the marketing landing page
- [ ] `/about` redirects to `/` or serves company-specific content
- [ ] New route groups exist and render placeholder pages
- [ ] Navigation header includes Platform, Solutions, Developers, Compare dropdowns
- [ ] All new routes are in the auth proxy allowlist (public access)
- [ ] Sitemap includes all new routes
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
