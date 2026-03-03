# AgentC2 Brand Style Guide

This document is the single source of truth for the AgentC2 visual identity, design system, and brand voice. All website pages, marketing materials, and product interfaces should conform to these standards.

---

## 1. Brand Identity

### Name

- **Brand name:** AgentC2
- **Spelling:** Always "AgentC2" — capital A, capital C, numeral 2
- **Never:** "Agent C2", "agentc2", "AGENTC2", "Agent-C2"
- **Casual shorthand:** "C2" is acceptable in internal contexts and within the product UI

### Tagline

**Primary:** "The AI Operating System for Your Organization"
**Secondary:** "Build. Deploy. Govern. Scale."
**Descriptive:** "Build, deploy, and govern intelligent AI agents across your organization."

### Domain

- **Primary:** agentc2.ai
- **Email:** hello@agentc2.ai (marketing), sales@agentc2.ai (enterprise), support@agentc2.ai (support)
- **Social:** @agentc2ai (X/Twitter), /company/agentc2 (LinkedIn)

### Logo

| Variant      | Usage                               | File                                                            |
| ------------ | ----------------------------------- | --------------------------------------------------------------- |
| **Icon**     | Favicon, small contexts, app header | `/public/c2-icon.png`                                           |
| **Wordmark** | Marketing pages, footer, OG images  | Icon + "AgentC2" text at `text-lg font-semibold tracking-tight` |

**Logo clear space:** Maintain padding equal to the icon height on all sides.
**Minimum size:** Icon must be at least 24x24px. Wordmark must be at least 120px wide.

**Logo on backgrounds:**

- Dark backgrounds: White text, icon as-is
- Light backgrounds: Dark text, icon as-is

---

## 2. Color System

AgentC2 uses oklch color space for perceptually uniform colors that work across light and dark modes.

### Primary Palette

| Token                  | oklch Value                                     | Role             | Usage                                                  |
| ---------------------- | ----------------------------------------------- | ---------------- | ------------------------------------------------------ |
| `--primary`            | `oklch(0.57 0.26 230)`                          | **Primary Blue** | CTAs, active states, links, highlights, section labels |
| `--primary-foreground` | `color-mix(in oklch, var(--primary) 5%, white)` | Text on primary  | Button text on primary backgrounds                     |

### Neutral Palette (Dark Mode — Default)

| Token                | oklch Value                  | Role                                  |
| -------------------- | ---------------------------- | ------------------------------------- |
| `--background`       | `oklch(0.141 0.005 285.823)` | Page background                       |
| `--foreground`       | `oklch(0.985 0 0)`           | Primary text                          |
| `--card`             | `oklch(0.21 0.006 285.885)`  | Card/panel backgrounds                |
| `--card-foreground`  | `oklch(0.985 0 0)`           | Card text                             |
| `--muted`            | `oklch(0.274 0.006 286.033)` | Muted backgrounds, alternate sections |
| `--muted-foreground` | `oklch(0.705 0.015 286.067)` | Secondary text, descriptions          |
| `--border`           | `oklch(1 0 0 / 10%)`         | Borders, dividers                     |
| `--input`            | `oklch(1 0 0 / 15%)`         | Input field borders                   |

### Neutral Palette (Light Mode)

| Token                | oklch Value                  | Role              |
| -------------------- | ---------------------------- | ----------------- |
| `--background`       | `oklch(1 0 0)`               | Page background   |
| `--foreground`       | `oklch(0.141 0.005 285.823)` | Primary text      |
| `--card`             | `oklch(1 0 0)`               | Card backgrounds  |
| `--muted`            | `oklch(0.967 0.001 286.375)` | Muted backgrounds |
| `--muted-foreground` | `oklch(0.552 0.016 285.938)` | Secondary text    |
| `--border`           | `oklch(0.92 0.004 286.32)`   | Borders           |

### Semantic Colors

| Token                   | oklch Value                 | Usage                             |
| ----------------------- | --------------------------- | --------------------------------- |
| `--destructive` (dark)  | `oklch(0.704 0.191 22.216)` | Error states, destructive actions |
| `--destructive` (light) | `oklch(0.577 0.245 27.325)` | Error states, destructive actions |

### Extended Palette (Marketing)

These colors extend the core palette for marketing use cases. They are NOT new CSS variables — use Tailwind utility classes directly.

| Purpose         | Dark Mode Class    | Light Mode Class   | Usage                             |
| --------------- | ------------------ | ------------------ | --------------------------------- |
| **Success**     | `text-emerald-400` | `text-emerald-600` | Checkmarks, positive indicators   |
| **Warning**     | `text-amber-400`   | `text-amber-600`   | Warnings, attention indicators    |
| **Info**        | `text-sky-400`     | `text-sky-600`     | Informational elements            |
| **Accent warm** | `text-orange-400`  | `text-orange-600`  | Feature highlights, badge accents |

### Gradient Vocabulary

Gradients are used sparingly and consistently:

| Pattern             | Class                                                          | Usage                       |
| ------------------- | -------------------------------------------------------------- | --------------------------- |
| **Hero background** | `bg-linear-to-br from-primary/5 via-primary/3 to-transparent`  | Hero section subtle depth   |
| **CTA banner**      | `bg-linear-to-br from-primary/10 via-primary/5 to-transparent` | CTA sections                |
| **Glow effect**     | `bg-primary/5 rounded-full blur-3xl`                           | Background decorative blobs |
| **Edge fade**       | `bg-linear-to-r from-background to-transparent`                | Scroll container edges      |

**Rules:**

- Gradients use only `--primary` with opacity, never secondary colors
- Maximum opacity in gradients: 10% (`primary/10`)
- Blur radius for glow effects: `blur-3xl` (48px)
- Never use gradients on text
- Never use more than two gradient blobs per section

### Color Usage Rules

1. **Primary blue is for interaction and emphasis only** — links, buttons, active tabs, section labels, icon backgrounds. Never for large background fills.
2. **Text hierarchy uses only foreground and muted-foreground** — no custom grays.
3. **Borders are always `border-border` or `border-border/60`** — the `/60` variant for lighter dividers.
4. **Card backgrounds are `bg-card`** — never `bg-background` for elevated surfaces.
5. **Dark mode is the default** — design for dark first, verify in light.

---

## 3. Typography

### Font Stack

| Font           | Variable            | Role                      | Weight Range |
| -------------- | ------------------- | ------------------------- | ------------ |
| **DM Sans**    | `--font-sans`       | Display, headings, labels | 400–700      |
| **Geist**      | `--font-geist-sans` | Body text, UI             | 400–600      |
| **Geist Mono** | `--font-geist-mono` | Code, technical values    | 400          |

**Note:** `DM Sans` is loaded as the `--font-sans` variable and applied via the `font-sans` utility. Geist is applied to `<body>` via its CSS variable.

### Type Scale

This is the locked typographic hierarchy for all marketing pages. Do not deviate.

| Level          | Tailwind Classes                                            | Font       | Usage                                           |
| -------------- | ----------------------------------------------------------- | ---------- | ----------------------------------------------- |
| **Display**    | `text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight` | DM Sans    | Hero headlines only (one per page)              |
| **H1**         | `text-3xl md:text-4xl font-bold tracking-tight`             | DM Sans    | Page titles, major section headings             |
| **H2**         | `text-2xl md:text-3xl font-bold tracking-tight`             | DM Sans    | Section headings                                |
| **H3**         | `text-xl font-semibold`                                     | DM Sans    | Sub-section headings, card titles               |
| **H4**         | `text-lg font-semibold`                                     | DM Sans    | Feature titles, list headings                   |
| **Body Large** | `text-lg leading-relaxed`                                   | Geist      | Section descriptions, hero subtext              |
| **Body**       | `text-base leading-relaxed`                                 | Geist      | Standard body copy                              |
| **Body Small** | `text-sm leading-relaxed`                                   | Geist      | Card descriptions, feature bullets              |
| **Caption**    | `text-xs font-medium`                                       | Geist      | Timestamps, metadata, fine print                |
| **Overline**   | `text-xs font-semibold tracking-wider uppercase`            | DM Sans    | Section labels ("Capabilities", "How It Works") |
| **Code**       | `text-sm font-mono`                                         | Geist Mono | Inline code, API examples                       |

### Text Colors

| Purpose            | Class                     | Example                                  |
| ------------------ | ------------------------- | ---------------------------------------- |
| **Primary text**   | `text-foreground`         | Headlines, titles, body copy             |
| **Secondary text** | `text-muted-foreground`   | Descriptions, subtitles, metadata        |
| **Accent text**    | `text-primary`            | Links, overline labels, emphasized terms |
| **On primary**     | `text-primary-foreground` | Text on `bg-primary` buttons/badges      |

### Typography Rules

1. **Never use more than 3 font weights on a single page** — typically `font-bold`, `font-semibold`, and `font-normal`.
2. **Heading text is always `text-foreground`** — never muted.
3. **Body text is `text-foreground` for primary content, `text-muted-foreground` for supporting content.**
4. **Line height is always `leading-relaxed` for body text** — never `leading-tight` except for display headings.
5. **Letter spacing is `tracking-tight` on headings, `tracking-wider` on overlines, default on body.**
6. **Maximum line width for body text: `max-w-2xl` (672px).** For headings: `max-w-4xl` (896px).

---

## 4. Spacing & Layout

### Page-Level Spacing

| Element                | Class       | Pixels |
| ---------------------- | ----------- | ------ |
| **Content max-width**  | `max-w-7xl` | 1280px |
| **Horizontal padding** | `px-6`      | 24px   |
| **Center alignment**   | `mx-auto`   | —      |

Combined: every section uses `mx-auto max-w-7xl px-6`.

### Section Spacing

| Section Type                          | Vertical Padding        | Class                                |
| ------------------------------------- | ----------------------- | ------------------------------------ |
| **Hero**                              | 128px top, 128px bottom | `py-32` or `py-20 md:py-28 lg:py-36` |
| **Standard section**                  | 96px                    | `py-24`                              |
| **Tight section**                     | 64px                    | `py-16`                              |
| **Divider section** (integration bar) | 40px                    | `py-10`                              |
| **Between heading and content**       | 64px                    | `mb-16`                              |
| **Between overline and heading**      | 16px                    | `mb-4`                               |
| **Between heading and description**   | 16px                    | `mb-4`                               |

### Grid System

| Layout                | Class                                              | Usage                     |
| --------------------- | -------------------------------------------------- | ------------------------- |
| **2-column split**    | `grid lg:grid-cols-2 gap-12 lg:gap-16`             | Hero, feature + visual    |
| **3-column grid**     | `grid sm:grid-cols-2 lg:grid-cols-3 gap-6`         | Cards, steps, pricing     |
| **4-column grid**     | `grid sm:grid-cols-2 lg:grid-cols-4 gap-6`         | Stats, logos, small cards |
| **5-column (footer)** | `grid md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-12` | Footer layout             |

### Component Spacing

| Component              | Internal Padding               | Gap                                 |
| ---------------------- | ------------------------------ | ----------------------------------- |
| **Card**               | `p-6` or `p-8`                 | —                                   |
| **CTA banner**         | `px-8 py-16 md:px-16 md:py-20` | —                                   |
| **Nav height**         | `h-16`                         | —                                   |
| **Button gap**         | —                              | `gap-3` (inline), `gap-4` (stacked) |
| **Feature list items** | —                              | `space-y-3` or `space-y-2.5`        |
| **Icon + text**        | —                              | `gap-2`                             |

---

## 5. Components

### Cards

```
Standard card:
  rounded-2xl border border-border/60 bg-card p-6

Hover card (feature/capability):
  rounded-2xl border border-border/60 bg-card p-6
  hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5
  transition-all duration-300

Popular/highlighted card:
  rounded-2xl border border-primary/40 bg-card p-8
  shadow-lg shadow-primary/10

CTA banner card:
  rounded-3xl bg-linear-to-br from-primary/10 via-primary/5 to-transparent
  px-8 py-16 md:px-16 md:py-20
  overflow-hidden relative
```

### Buttons

Buttons use `buttonVariants` from `@repo/ui`. Standard variants:

| Variant   | Usage                                              |
| --------- | -------------------------------------------------- |
| `default` | Primary actions — "Get Started", "Start Trial"     |
| `outline` | Secondary actions — "Book a Demo", "Learn More"    |
| `ghost`   | Tertiary actions — navigation links in mobile menu |
| `link`    | Inline text links                                  |

**Sizes:**
| Size | Usage |
|------|-------|
| `sm` | Navigation CTAs, compact contexts |
| `default` | Standard buttons |
| `lg` | Hero CTAs, CTA banners |

**Rules:**

- Maximum 2 CTAs per section (1 primary + 1 secondary)
- Primary CTA is always `default` variant
- Secondary CTA is always `outline` variant
- CTA text is action-oriented: "Get Started Free", not "Learn More"

### Badges / Overline Labels

```
Section overline:
  text-primary text-xs font-semibold tracking-wider uppercase

Announcement badge:
  text-primary rounded-full border border-current/20 bg-current/5
  px-3 py-1 text-xs font-semibold tracking-wider uppercase

Popular badge:
  bg-primary text-primary-foreground rounded-full px-3 py-0.5
  text-xs font-semibold
```

### Icons

**Library:** HugeIcons (`@hugeicons/react`) for product UI. Custom SVGs (24x24, stroke-width 1.5) for landing page feature icons.

**Icon container:**

```
Standard:
  bg-primary/10 text-primary rounded-xl h-12 w-12
  flex items-center justify-center

Hover:
  group-hover:bg-primary/15 transition-colors
```

**Rules:**

- Landing page icons are 24x24 SVGs with `strokeWidth="1.5"`, `strokeLinecap="round"`, `strokeLinejoin="round"`
- HowItWorks icons are 32x32
- All icons use `currentColor` for stroke, never hardcoded colors
- Icon containers are always `rounded-xl` with `bg-primary/10`

### Navigation

**Fixed header, blur-on-scroll pattern:**

```
Default state:
  fixed top-0 inset-x-0 z-50 bg-transparent

Scrolled state:
  border-b border-border/50 bg-background/80 backdrop-blur-xl
```

**Nav link style:**

```
text-muted-foreground hover:text-foreground text-sm transition-colors
```

---

## 6. Section Patterns

Every marketing page is composed from these standardized section patterns.

### Pattern 1: Standard Section

```
<section className="py-24">
  <div className="mx-auto max-w-7xl px-6">
    {/* Overline */}
    <span className="text-primary text-xs font-semibold tracking-wider uppercase">
      Section Label
    </span>
    {/* Heading */}
    <h2 className="text-foreground mt-4 text-3xl font-bold tracking-tight md:text-4xl">
      Section Heading
    </h2>
    {/* Description */}
    <p className="text-muted-foreground mt-4 max-w-2xl text-lg">
      Supporting description text.
    </p>
    {/* Content (cards, grid, etc.) */}
    <div className="mt-16">
      ...
    </div>
  </div>
</section>
```

### Pattern 2: Centered Section

Same as Pattern 1, but with centered text alignment:

```
text-center     (on overline, heading, description)
mx-auto         (on description, to constrain width)
```

### Pattern 3: Alternating Background Section

For visual rhythm, alternate between default and muted backgrounds:

```
Default:    py-24                    (transparent/background)
Muted:      py-24 bg-muted/30       (subtle background shift)
```

**Rules:**

- Never use more than 2 consecutive sections with the same background
- The hero and CTA banner always use default background
- Pricing and HowItWorks use muted background

### Pattern 4: Split Content (Text + Visual)

```
<div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
  {/* Text side */}
  <div className="flex flex-col justify-center">
    ...
  </div>
  {/* Visual side */}
  <div className="flex items-center justify-center">
    ...
  </div>
</div>
```

Text is always on the left on desktop (reading order). Visual is always on the right.

---

## 7. Motion & Animation

### Scroll Reveal

Elements fade up as they enter the viewport.

```css
@keyframes landing-fade-in {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

**Class:** `animate-landing-fade-in`
**Duration:** 0.6s ease-out
**Usage:** Apply to section content containers, not individual elements. Stagger with `animation-delay` for multi-element reveals.

### Float Animation

Subtle vertical float for decorative elements.

```css
@keyframes landing-float {
    0%,
    100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-8px);
    }
}
```

**Class:** `animate-landing-float`
**Duration:** 4s ease-in-out infinite
**Usage:** Decorative nodes (integration icons in hero). Never on text or interactive elements.

### Infinite Scroll

Horizontal scroll for logo bars.

```css
@keyframes landing-scroll {
    0% {
        transform: translateX(0);
    }
    100% {
        transform: translateX(-50%);
    }
}
```

**Class:** `animate-landing-scroll`
**Duration:** 30s linear infinite
**Usage:** Integration bar only. Content is duplicated for seamless loop.

### Hover Transitions

| Element             | Transition                    | Duration        |
| ------------------- | ----------------------------- | --------------- |
| **Cards**           | `transition-all duration-300` | 300ms           |
| **Links**           | `transition-colors`           | 150ms (default) |
| **Buttons**         | Handled by `buttonVariants`   | —               |
| **Icon containers** | `transition-colors`           | 150ms           |
| **Nav background**  | `transition-all duration-300` | 300ms           |

### Animation Rules

1. **No gratuitous motion** — every animation must serve comprehension or delight, never decoration alone.
2. **No particle effects, 3D transforms, or "AI brain" animations.**
3. **Maximum 2 animated elements visible simultaneously** (excluding the infinite scroll bar).
4. **Respect `prefers-reduced-motion`** — disable animations for users who prefer reduced motion.
5. **Never animate text** — text should appear instantly or via fade-in only.

---

## 8. Imagery & Visual Assets

### Product Illustrations (SVG-Style React Components)

Instead of screenshots, AgentC2 uses **styled React components that visually represent product features** — the same approach used on useappello.com's "Modules & Platform Features" section. Each illustration is a self-contained React component that renders a stylized, simplified representation of a product capability using the design system's colors, typography, and card patterns.

**Why this approach:**

- Pixel-perfect on all screen sizes (no raster scaling issues)
- Automatically respects dark/light mode via CSS variables
- Can include subtle animations (float, pulse, fade)
- Data shown is always realistic and curated (never stale screenshots)
- Consistent visual language across all pages
- No maintenance burden when the product UI changes

**Required product illustrations:**

| Illustration                | Visual Content                                                                                                       | Used On                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Agent Chat**              | Chat message bubbles with tool call activity panel, agent avatar, timestamps                                         | Home hero, Platform Overview            |
| **Agent Config**            | Config card showing model selector, temperature slider, tool list, guardrail toggles                                 | Platform Overview, How It Works         |
| **Workflow Builder**        | Step cards connected by arrows — agent step, branch step, human approval step                                        | Platform Overview, How It Works         |
| **Network Topology**        | Central orchestrator node connected to 3-4 agent nodes with labeled connections                                      | Platform Overview, Architecture         |
| **Channel Deployment**      | Central agent hub with radiating connections to channel badges (Slack, WhatsApp, Telegram, Voice, Web, Email, Embed) | Home, Channels page                     |
| **MCP Integration**         | Connection card showing server name, status badge, tool count, credential indicator                                  | Integrations section, Architecture      |
| **Guardrail Panel**         | Panel with toggle rows (PII blocking, prompt injection, toxicity, egress control) and status indicators              | Security page, Home differentiators     |
| **Budget Hierarchy**        | Nested bars or cards showing Subscription → Org → User → Agent budget breakdown with amounts                         | Security page, Enterprise               |
| **Learning Pipeline**       | Flow: Signal extraction → Proposal card → A/B experiment bars → Promotion badge                                      | Home differentiators, Platform Overview |
| **Federation**              | Two org cards connected by encrypted channel with lock icon, PII scanner, rate limit indicators                      | Home differentiators, Federation page   |
| **Campaign/Mission**        | Mission card with intent, tasks list with status badges, AAR summary                                                 | Mission Command page                    |
| **Dark Factory Pipeline**   | Horizontal step flow: Ticket → Plan → Code → Build → Verify → Merge → Deploy                                         | Dark Factory page                       |
| **Playbook Card**           | Marketplace-style card with playbook name, component count, rating, install button                                   | Marketplace page, Home                  |
| **Eval Scorecard**          | Score bars for multiple criteria, overall grade badge, tier indicator                                                | Platform Overview                       |
| **Observability Dashboard** | Mini dashboard with run count, success rate bar, cost total, trend sparkline                                         | Platform Overview, Use Cases            |
| **Embed Widget**            | Browser frame containing a chat widget with custom branding, partner logo, domain badge                              | Embed Partners page                     |

**Component location:** `apps/frontend/src/components/website/illustrations/`

**Illustration design standards:**

```
Container:
  rounded-2xl border border-border/60 bg-card p-4 md:p-6
  overflow-hidden

Header bar (mimics app chrome):
  flex items-center gap-2 mb-3 pb-3 border-b border-border/40
  - Status dot: h-2 w-2 rounded-full bg-emerald-400
  - Title: text-xs font-semibold text-foreground uppercase tracking-wider
  - Badge: text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary

Data rows:
  flex items-center justify-between py-2
  - Label: text-xs text-muted-foreground
  - Value: text-xs font-medium text-foreground

Mini badges:
  text-[10px] px-1.5 py-0.5 rounded-full font-medium
  - Active/success: bg-emerald-500/10 text-emerald-400
  - Warning: bg-amber-500/10 text-amber-400
  - Info: bg-sky-500/10 text-sky-400
  - Error: bg-red-500/10 text-red-400

Connecting lines (SVG):
  stroke="currentColor" className="text-border"
  strokeWidth="1" strokeDasharray="4 4" opacity="0.5"

Floating elements:
  animate-landing-float with staggered animation-delay
```

**Rules:**

- Every illustration uses ONLY design system tokens — no hardcoded colors
- Text inside illustrations uses realistic but curated data (real tool names, real agent names, real metrics)
- Illustrations should be self-contained components with no external dependencies beyond `@repo/ui`
- Maximum complexity: 15-20 visual elements per illustration. Keep them clean and scannable.
- Subtle animation is encouraged (float, pulse on status dots) but never distracting
- Each illustration component accepts optional `className` for sizing by the parent

### Diagrams

Architecture and flow diagrams use a consistent visual language:

- **Background:** transparent (inherits section background)
- **Lines:** `text-border` with `strokeDasharray="4 4"` and `opacity="0.5"` for connections
- **Nodes:** `bg-background border-border rounded-2xl border shadow-md` for elements
- **Hub/center node:** `bg-primary/10 border-primary/20 border-2 rounded-3xl shadow-xl`
- **Text in nodes:** `text-foreground text-xs font-semibold`

### Integration Logos

- Prefer official SVG logos where available
- Fallback: colored letter icon in a rounded container (existing `IntegrationIcon` pattern)
- Display as grayscale by default, colorize on hover for interactivity
- Minimum grid: top 20 integrations for the integration section

### OG / Social Images

- Dimensions: 1200x630px
- Background: `--background` (dark)
- AgentC2 wordmark centered or top-left
- Page title in Display typography
- Generated dynamically via `opengraph-image.tsx` using `ImageResponse`

---

## 9. Voice & Tone

### Brand Personality

AgentC2 is **confident, technical, and direct**. We respect our audience's intelligence. We don't hype, and we don't hide behind jargon.

### Writing Principles

| Principle                         | Do                                            | Don't                                             |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------- |
| **Be specific**                   | "200+ MCP tool integrations"                  | "Powerful integrations"                           |
| **Be direct**                     | "Deploy agents to Slack, WhatsApp, and voice" | "Seamlessly connect across channels"              |
| **Be honest**                     | "SOC 2 operational readiness (in progress)"   | "Enterprise-grade security" without qualification |
| **Be technical when appropriate** | "AES-256-GCM credential encryption"           | "Military-grade encryption"                       |
| **Respect the reader**            | "Agents that reason, plan, and adapt"         | "AI-powered synergistic automation"               |

### Terminology Guide

| Term                | Usage                                                                                                                      | Context                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **MCP**             | Keep. Explain on first use: "MCP (Model Context Protocol) — the open standard for connecting AI agents to external tools." | All pages. Explain once per page, then use freely.                |
| **RAG**             | Use "knowledge-powered" on marketing pages. Keep "RAG" on technical and developer pages.                                   | Marketing: "knowledge-powered agents." Technical: "RAG pipeline." |
| **Federation**      | Keep. Explain on first use: "cross-organization agent collaboration."                                                      | All pages where relevant.                                         |
| **Mission Command** | Keep. Explain on first use: "autonomous multi-step campaign execution."                                                    | Platform and enterprise pages.                                    |
| **Dark Factory**    | Keep. Explain on first use: "autonomous coding pipeline."                                                                  | Engineering use case and platform pages.                          |
| **Guardrails**      | Use freely — broadly understood.                                                                                           | All pages.                                                        |
| **Playbook**        | Use freely — broadly understood.                                                                                           | All pages.                                                        |
| **Agent**           | Always means "AI agent" in AgentC2 context. No need to qualify.                                                            | All pages.                                                        |
| **Workflow**        | Multi-step orchestration. Not "process" or "automation."                                                                   | All pages.                                                        |
| **Network**         | Multi-agent topology, not computer network. Clarify on first use.                                                          | Platform and technical pages.                                     |

### Headlines

- Headlines are declarative statements, not questions.
- Headlines communicate what the thing IS, not what it DOES.
- Maximum headline length: 10 words.

**Good:** "The AI Operating System for Your Organization"
**Good:** "Deploy once. Reach everywhere."
**Bad:** "What if your AI agents could work across every channel?"
**Bad:** "Unlock the power of autonomous AI-driven enterprise solutions"

### CTAs

CTAs are action verbs + clear outcome:

| Good                      | Bad          |
| ------------------------- | ------------ |
| "Get Started Free"        | "Learn More" |
| "See How It Works"        | "Discover"   |
| "Talk to Sales"           | "Contact Us" |
| "Explore the Marketplace" | "Browse"     |
| "Start Building"          | "Try It"     |

---

## 10. Page Templates

Three standardized page layouts for the marketing site.

### Template A: Hero + Sections (Home, Platform Overview)

```
[Nav - fixed, blur on scroll, h-16]
[Hero - py-32, Display heading, product visual right]
[Integration bar - py-10, border-y]
[Section - py-24, centered overline + heading, grid cards]
[Section - py-24 bg-muted/30, centered, 3-step flow]
[Section - py-24, split content + visual]
[Section - py-24 bg-muted/30, tabs]
[Proof bar - py-16, stats + badges]
[CTA banner - py-24, rounded-3xl gradient card]
[Footer - py-16, border-t, 5-column grid]
```

### Template B: Long-form Content (Architecture, Security, Federation)

```
[Nav]
[Page hero - py-24, H1 + description, no visual]
[Content - py-16, max-w-4xl mx-auto, prose-style sections with anchored headings]
[Related pages - py-16, 3 linked cards]
[CTA banner]
[Footer]
```

### Template C: Data-driven (Comparisons, Use Cases)

```
[Nav]
[Page hero - py-24, H1 + one-line differentiator]
[TL;DR cards - 3 columns]
[Comparison table or feature grid]
[Detailed alternating sections]
[FAQ accordion with schema]
[CTA banner]
[Footer]
```

---

## 11. Responsive Behavior

### Breakpoints

Uses Tailwind's default breakpoints:

| Breakpoint | Min Width | Usage                               |
| ---------- | --------- | ----------------------------------- |
| `sm`       | 640px     | 2-column grids, mobile menu hidden  |
| `md`       | 768px     | 3-column grids, desktop nav visible |
| `lg`       | 1024px    | 2-column splits, full layouts       |
| `xl`       | 1280px    | Max-width container limit           |

### Mobile Patterns

- **Navigation:** Hamburger menu with slide-down panel (existing `NavBar` pattern)
- **Grids:** Collapse to single column below `sm`
- **Hero visual:** Hidden on mobile (`hidden lg:flex`)
- **Typography:** Display text scales down (`text-4xl` mobile → `text-6xl` desktop)
- **CTAs:** Stack vertically on mobile (`flex-col sm:flex-row`)
- **Screenshots:** Full-width on mobile, constrained on desktop

---

## 12. Accessibility

### Color Contrast

- All text meets WCAG 2.2 AA contrast ratios (4.5:1 for normal text, 3:1 for large text)
- `text-foreground` on `bg-background`: ratio > 15:1 (dark mode), > 15:1 (light mode)
- `text-muted-foreground` on `bg-background`: ratio > 4.5:1
- `text-primary` on `bg-background`: verify > 4.5:1

### Keyboard Navigation

- All interactive elements are keyboard accessible
- Focus rings use `outline-ring/50` (defined in base styles)
- Skip-to-content link on every page

### Screen Readers

- All images have descriptive `alt` text
- Decorative SVGs have `aria-hidden="true"`
- Interactive elements have `aria-label` when visual label is insufficient
- Section landmarks use semantic HTML (`<nav>`, `<main>`, `<section>`, `<footer>`)

### Reduced Motion

- Respect `prefers-reduced-motion: reduce`
- Disable `animate-landing-float`, `animate-landing-scroll`, and `animate-landing-fade-in`
- Hover transitions remain (they are user-initiated)

---

## 13. File Organization

### Marketing Components

```
apps/frontend/src/components/
├── landing/          # Existing v1 landing components (preserved)
│   ├── nav-bar.tsx
│   ├── footer.tsx
│   ├── hero-section.tsx
│   └── ...
│
└── website/          # V2 marketing components (new)
    ├── layout/       # Header, footer, section wrapper
    ├── sections/     # Reusable section components
    ├── home/         # Home page sections
    ├── comparison/   # Comparison page template
    ├── use-case/     # Use case page template
    └── seo/          # Structured data helpers
```

### Content Data

```
apps/frontend/src/data/
└── website/
    ├── integrations.ts      # Integration names, categories
    ├── comparisons/         # Per-competitor data files
    └── use-cases/           # Per-vertical data files
```

---

## 14. Checklist: Applying This Guide

When building a new marketing page, verify:

- [ ] Uses one of the three page templates (A, B, or C)
- [ ] Typography follows the locked hierarchy (no custom sizes)
- [ ] Section spacing uses standardized values (py-24, py-16, py-32)
- [ ] Colors use only semantic tokens (text-foreground, text-muted-foreground, text-primary)
- [ ] Cards use the standard card pattern (rounded-2xl, border-border/60, bg-card)
- [ ] Maximum 2 CTAs per section (1 primary, 1 secondary)
- [ ] CTA text is action-oriented verb + outcome
- [ ] Section labels use the Overline pattern (text-primary, uppercase, tracking-wider)
- [ ] MCP is explained on first use per page
- [ ] Technical terms are explained on first use per page
- [ ] Dark mode renders correctly (check all backgrounds, borders, text)
- [ ] Mobile responsive (test at 375px width)
- [ ] Generates `metadata` with unique title, description, and OG image
- [ ] Has JSON-LD structured data (WebPage + BreadcrumbList minimum)
- [ ] All images have `alt` text
- [ ] No more than 3 font weights on the page
- [ ] Body text does not exceed `max-w-2xl`
