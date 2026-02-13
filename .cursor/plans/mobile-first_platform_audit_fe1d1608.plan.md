---
name: Mobile-First Platform Audit
overview: Comprehensive audit and optimization of the entire Mastra platform for mobile-first usage. Covers every page, modal, sheet, dialog, interaction pattern, and component across both apps. 12 areas of work spanning infrastructure, navigation, layouts, visual builders, data pages, overlays, touch interactions, and accessibility.
todos:
    - id: viewport-meta
      content: Add viewport meta tag to agent app root layout and frontend root layout. Currently only embed layouts have it.
      status: completed
    - id: topbar-mobile
      content: Add mobile hamburger menu to AppTopBar (Sheet drawer) -- 10 nav items currently render in a horizontal row with zero mobile handling.
      status: completed
    - id: detail-shell
      content: "Create DetailPageShell component wrapping useIsMobile + Sheet for detail page sidebars. Desktop: fixed w-64. Mobile: Sheet drawer with toggle."
      status: completed
    - id: refactor-layouts
      content: Refactor all 5 detail page layouts (agent, network, workflow, skill, settings) to use DetailPageShell. Eliminates ~550 lines of duplicated sidebar code.
      status: completed
    - id: workspace-mobile
      content: Make ConversationSidebar responsive -- Sheet on mobile, toggle button in context bar, auto-close on select. Remove mouse-only resize handle on mobile.
      status: completed
    - id: builder-mobile
      content: Make BuilderShell (3-column fixed grid) responsive -- tab-based on mobile. Also fix CanvasBuilderPanel (300-600px resizable panel) for mobile.
      status: completed
    - id: react-flow-mobile
      content: Add touch support for React Flow canvases (workflow design, network topology). Reduce fixed heights, add pinch-zoom, replace mouse-only pan/scroll.
      status: completed
    - id: sheets-dialogs-fix
      content: Fix all fixed-width Sheets (w-[480px], w-[520px]) and Dialogs (max-w-5xl) to be mobile-safe. 6 instances across configure, skills, versions, knowledge.
      status: completed
    - id: tables-responsive
      content: Fix tables with min-w-[1200px], add column hiding for dense tables, fix TabsList grid-cols-5 overflow. Covers traces, live runs, triggers, MCP pages.
      status: completed
    - id: split-layouts-fix
      content: Fix w-1/3 + w-2/3 split layouts (MCP webhooks, automation page) and fixed-width grid-cols-[320px_1fr] layouts to stack on mobile.
      status: completed
    - id: spacing-and-grids
      content: Update p-6 to p-4 md:p-6 across main content areas. Fix grid-cols-6 without breakpoints (versions stats bar, run counts). Fix fixed grid-cols-[140px_1fr].
      status: completed
    - id: touch-polish
      content: Fix undersized touch targets (h-5, h-7 buttons), hide resize handles on mobile, add command palette trigger, fix hover-only dropdown visibility, keyboard-only navigation.
      status: completed
isProject: false
---

# Mobile-First Platform Audit -- Comprehensive

## Methodology

Audited every file in the following directories:

- `apps/agent/src/app/` -- 70+ page files across 20+ route groups
- `apps/agent/src/components/` -- 39 component files
- `apps/frontend/src/` -- all pages and components
- `packages/ui/src/components/` -- 40+ shared components + AI elements + canvas blocks
- `packages/ui/src/styles/globals.css` -- all responsive CSS rules

---

## Area 1: Viewport Meta Tag (Infrastructure)

**Problem:** The agent app root layout (`[apps/agent/src/app/layout.tsx](apps/agent/src/app/layout.tsx)`) and frontend root layout (`[apps/frontend/src/app/layout.tsx](apps/frontend/src/app/layout.tsx)`) have **no viewport meta tag**. Only the embed layouts set it. Without this, mobile browsers may not scale the page correctly -- users could see a zoomed-out desktop view.

**Files:**

- `apps/agent/src/app/layout.tsx` -- Add `export const viewport` with `width: "device-width", initialScale: 1`
- `apps/frontend/src/app/layout.tsx` -- Same

**Severity:** Blocking -- nothing else matters if the viewport isn't set.

---

## Area 2: Top Navigation Bar (Critical)

**Problem:** `[AppTopBar](packages/ui/src/components/app-topbar.tsx)` renders 10 nav items in a horizontal `<nav className="flex flex-1 items-center gap-6">` with no mobile handling. On a 375px screen this overflows.

**Fix:** Add mobile hamburger menu using Sheet + `useIsMobile`. Desktop nav gets `hidden md:flex`, hamburger button gets `md:hidden`.

**Files:**

- `[packages/ui/src/components/app-topbar.tsx](packages/ui/src/components/app-topbar.tsx)` -- Add Sheet-based mobile menu
- `[apps/agent/src/components/AgentHeader.tsx](apps/agent/src/components/AgentHeader.tsx)` -- Minor prop adjustments if needed

---

## Area 3: Detail Page Sidebars (Critical)

**Problem:** 5 layout files use identical pattern: `<aside className="bg-muted/30 flex w-64 flex-col border-r">` -- a fixed 256px sidebar with no responsive behavior. On mobile: 256px of 375px consumed by sidebar.

**Affected files (all identical pattern):**

- `[apps/agent/src/app/agents/[agentSlug]/layout.tsx](apps/agent/src/app/agents/[agentSlug]/layout.tsx)` -- 273 lines, 12 nav items
- `[apps/agent/src/app/networks/[networkSlug]/layout.tsx](apps/agent/src/app/networks/[networkSlug]/layout.tsx)` -- 157 lines, 8 nav items
- `[apps/agent/src/app/workflows/[workflowSlug]/layout.tsx](apps/agent/src/app/workflows/[workflowSlug]/layout.tsx)` -- similar
- `[apps/agent/src/app/skills/[skillSlug]/layout.tsx](apps/agent/src/app/skills/[skillSlug]/layout.tsx)` -- similar
- `[apps/agent/src/app/settings/layout.tsx](apps/agent/src/app/settings/layout.tsx)` -- 131 lines, 6 nav items

**Fix:** Create `DetailPageShell` component in `apps/agent/src/components/`. Uses `useIsMobile()` -- desktop renders fixed sidebar, mobile renders Sheet drawer with toggle button at top of content area. Refactor all 5 layouts to use it.

**Desktop cleanup benefit:** Eliminates ~550 lines of duplicated sidebar boilerplate.

---

## Area 4: Workspace Chat (Critical)

**Problem:** `[workspace/page.tsx](apps/agent/src/app/workspace/page.tsx)` (1289 lines) renders `<div className="flex h-full">` with `ConversationSidebar` (220px resizable, mouse-only drag handle) + chat area. On mobile, sidebar takes 220px.

**Sub-issues in ConversationSidebar (`[ConversationSidebar.tsx](apps/agent/src/components/ConversationSidebar.tsx)`):**

- Mouse-only resize handle (`onMouseDown`, `cursor-col-resize`)
- Dropdown menu visibility relies on hover (`opacity-0 group-hover:opacity-100`)
- `size-8` (~32px) touch targets -- below 44px minimum

**Fix:**

- Add `useIsMobile()` check. On mobile: render sidebar as Sheet, triggered by icon button in context bar
- Auto-close Sheet when conversation selected
- Hide resize handle on mobile
- Make dropdown menus always visible (not hover-gated)

---

## Area 5: Visual Builders -- BuilderShell and Canvas (Critical)

**Problem:** Three major builder experiences are completely desktop-only:

### 5a. BuilderShell (`[BuilderShell.tsx](apps/agent/src/components/builder/BuilderShell.tsx)`)

Fixed 3-column grid: `grid-cols-[260px_minmax(0,1fr)_360px]` = 620px minimum before content gets any space. Used by:

- Workflow design page (`workflows/[slug]/design/page.tsx`)
- Network topology page (`networks/[slug]/topology/page.tsx`)

### 5b. CanvasBuilderPanel (`[CanvasBuilderPanel.tsx](apps/agent/src/components/canvas/CanvasBuilderPanel.tsx)`)

Resizable panel: `sidebarWidth` state (300-600px), mouse-only resize handle. `h-[calc(100vh-3.5rem)]`. Used by:

- Canvas edit page (`canvas/[slug]/edit/page.tsx`)
- Canvas build page (`canvas/build/page.tsx`)

### 5c. Canvas viewer debug panel (`canvas/[slug]/page.tsx`)

Fixed: `w-[480px] min-w-[480px]` debug sidebar.

**Fix for 5a:** On mobile, convert BuilderShell to tabbed interface (Outline | Canvas | Inspector tabs). Desktop remains 3-column grid.

**Fix for 5b:** On mobile, full-width chat panel with canvas preview as collapsible section or tab. Hide resize handle.

**Fix for 5c:** Debug panel as Sheet overlay on mobile instead of fixed side panel.

---

## Area 6: React Flow Canvases (Important)

**Problem:** React Flow (used for workflow/network visual editors) has several mobile issues:

- `[WorkflowCanvas.tsx](apps/agent/src/components/workflows/WorkflowCanvas.tsx)` -- Fixed `h-[400px]`, mouse-only pan/scroll/zoom (`panOnScroll`, `zoomOnScroll`)
- `[WorkflowVisualizer.tsx](apps/agent/src/components/workflows/WorkflowVisualizer.tsx)` -- Fixed `h-[450px]`, absolute-positioned legend that overlaps on small screens
- `[WorkflowNode.tsx](apps/agent/src/components/workflows/WorkflowNode.tsx)` -- Fixed `min-w-[180px] max-w-[280px]` nodes
- Node dragging and edge connections are mouse-centric

**Fix:**

- Reduce fixed heights on mobile (`h-[300px] md:h-[400px]`)
- React Flow v11+ supports touch out of the box -- verify `panOnScroll` doesn't conflict with page scroll on mobile
- Make legend responsive (collapsible or bottom-positioned on mobile)
- Consider read-only view on mobile with link to "Edit on desktop" for complex graph editing

---

## Area 7: Fixed-Width Sheets and Dialogs (Important)

**Problem:** 6 instances of Sheets/Dialogs with widths that overflow on mobile:

| Component              | Width                        | File                                                                   |
| ---------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| Skill Builder Sheet    | `w-[480px] sm:max-w-[480px]` | `agents/[slug]/configure/page.tsx` line 1894                           |
| Skill Builder Sheet    | `w-[480px] sm:max-w-[480px]` | `skills/page.tsx` line 117                                             |
| Skill Detail Sheet     | `w-[520px] sm:max-w-[520px]` | `components/skills/SkillDetailSheet.tsx` line 104                      |
| Version Compare Dialog | `max-w-5xl` (1024px)         | `agents/[slug]/versions/components/version-compare-dialog.tsx` line 52 |
| Version Detail Sheet   | varies                       | `agents/[slug]/versions/components/version-detail-sheet.tsx`           |
| Upload Document Dialog | standard Dialog              | `knowledge/components/upload-document-dialog.tsx`                      |

**Fix:** Replace fixed widths with responsive patterns:

- Sheets: `w-full sm:w-[480px] sm:max-w-[480px]` -- full-width on mobile, fixed on desktop
- Version Compare Dialog: `max-w-[calc(100%-2rem)] sm:max-w-5xl` -- constrained on mobile
- Consider bottom Sheet on mobile for better thumb reach

---

## Area 8: Tables and Data-Dense Pages (Important)

**Problem:** Multiple pages with tables that force horizontal scrolling or overflow:

### Hard-coded wide tables:

- `agents/[agentSlug]/traces/page.tsx` line 535: `<table className="w-full min-w-[1200px]">` -- forces 1200px minimum
- `live/page.tsx` -- similar wide table pattern

### Fixed TabsList grids (no mobile breakpoint):

- `mcp/page.tsx` line 636: `TabsList className="grid w-full grid-cols-5"` -- 5 tabs squished on mobile
- `mcp/setup/page.tsx` line 574: `grid-cols-2` -- acceptable
- `bim/page.tsx`: `grid-cols-2` -- acceptable
- `demos/rag/page.tsx`: `grid-cols-3` -- tight but usable

### KPI stat grids without mobile breakpoints:

- `agents/[agentSlug]/versions/components/version-stats-bar.tsx` line 30: `grid-cols-6` -- no breakpoints
- Multiple pages with `md:grid-cols-6` -- acceptable (falls to `grid-cols-2` on mobile)
- `agents/[agentSlug]/overview/page.tsx` line 203: `grid-cols-2 md:grid-cols-3 lg:grid-cols-6` -- correct

**Fix:**

- Traces table: Add `hidden md:table-cell` to lower-priority columns (tokens, cost, model). Remove `min-w-[1200px]` -- let it be naturally responsive.
- MCP TabsList: Change `grid-cols-5` to scrollable horizontal tabs or `grid-cols-2 sm:grid-cols-3 md:grid-cols-5`
- Version stats bar: Add `grid-cols-2 sm:grid-cols-3 md:grid-cols-6` breakpoints

---

## Area 9: Split Layout Pages (Important)

**Problem:** Several pages use fixed fractional layouts that break on mobile:

- `[mcp/page.tsx](apps/agent/src/app/mcp/page.tsx)` -- Webhooks tab: `w-1/3` sidebar + `w-2/3` detail. On 375px: 125px + 250px.
- `agents/[agentSlug]/automation/page.tsx` -- Similar `w-1/3` + `w-2/3` split for trigger list vs detail.
- Multiple pages with `grid-cols-[320px_1fr]`: `workflows/[slug]/runs/page.tsx`, `workflows/[slug]/traces/page.tsx`, `networks/[slug]/runs/page.tsx`, `networks/[slug]/traces/page.tsx` -- 320px fixed sidebar.
- `triggers/page.tsx` -- `xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]` -- already responsive (stacks at <xl)
- `live/page.tsx` -- `xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]` -- already responsive

**Fix:**

- Change `w-1/3` + `w-2/3` layouts to `flex-col md:flex-row` + `md:w-1/3` + `md:w-2/3`
- Change `grid-cols-[320px_1fr]` to `grid-cols-1 lg:grid-cols-[320px_1fr]` -- stack on mobile
- `triggers/page.tsx` and `live/page.tsx` patterns are already correct (responsive at `xl:`)

---

## Area 10: Spacing, Padding, and Fixed Dimensions (Moderate)

### Padding issues

Many main content areas use `p-6` which wastes 24px on each side of a 375px screen (48px total = 13% of screen). Should be `p-4 md:p-6`.

**Key locations:**

- Detail page main content: `<main className="flex-1 overflow-y-auto"><div className="p-6">` (in all 5 detail layouts)
- Knowledge document page: `p-6`
- MCP setup page: `p-6`
- Multiple demo pages: `p-6`

### Fixed grid definitions without breakpoints

- `mcp/setup/page.tsx` lines 654-672: `grid-cols-[140px_1fr]` -- 140px label column. On mobile, leaves only 211px for content. Should be `grid-cols-1 sm:grid-cols-[140px_1fr]` (stack labels on mobile).

### Fixed heights that overflow mobile viewports

- `WorkflowCanvas.tsx`: `h-[400px]` -- too tall if mobile viewport is 667px with keyboard open
- `WorkflowVisualizer.tsx`: `h-[450px]` -- same issue
- `CanvasPreviewCard.tsx`: `max-h-[500px]` -- may dominate mobile screen
- `onboarding/TestStep.tsx`: `h-72` (288px) fixed chat area

---

## Area 11: Touch Interactions and Accessibility (Moderate)

### Undersized touch targets (below Apple's 44px minimum)

- `[ConnectionPowerBar.tsx](apps/agent/src/components/ConnectionPowerBar.tsx)`: Buttons `h-5` (~20px), badges `text-[10px]`
- `[CanvasPreviewCard.tsx](apps/agent/src/components/CanvasPreviewCard.tsx)`: Buttons `h-7` (~28px)
- `[channels/ChannelsTab.tsx](apps/agent/src/components/channels/ChannelsTab.tsx)`: Settings buttons `h-7 w-7` (~28px)
- `[InteractiveQuestions.tsx](apps/agent/src/components/InteractiveQuestions.tsx)`: Pagination dots `size-3.5` (~14px)
- `[webhooks/WebhookDetail.tsx](apps/agent/src/components/webhooks/WebhookDetail.tsx)`: Close button `h-6 w-6` (~24px)
- `ConversationSidebar.tsx`: Buttons `size-8` (~32px)

### Mouse-only interactions

- `ConversationSidebar.tsx`: Resize handle (`onMouseDown`, `cursor-col-resize`)
- `CanvasBuilderPanel.tsx`: Resize handle (`onMouseDown`, `cursor-col-resize`)
- `WorkflowCanvas.tsx`: Pan/zoom via mouse wheel
- `AgentSelector.tsx`: Star icon uses `onPointerDown` -- needs larger target
- `InteractiveQuestions.tsx`: Keyboard arrow navigation only -- no swipe

### Hover-only information

- `ConversationSidebar.tsx`: Dropdown menu gated by `opacity-0 group-hover:opacity-100`
- Tooltips (`packages/ui/src/components/tooltip.tsx`): Hover-only, no tap-to-show
- HoverCards (`packages/ui/src/components/hover-card.tsx`): Fixed `w-64`, hover-only

### Command palette

- Triggered only via keyboard shortcut (Cmd+K / Ctrl+B)
- No visible mobile trigger button exists

**Fix:**

- Increase all interactive elements to minimum `h-10` (40px) or `h-11` (44px) on mobile
- Hide resize handles on mobile (`hidden md:block`)
- Make dropdown menus always visible on mobile (remove hover gate)
- Add search/command button in AppTopBar for mobile
- Verify React Flow touch events work properly

---

## Area 12: Frontend App and Landing Page (Low Priority)

The frontend app is mostly well-handled:

- Landing page components all have responsive breakpoints (`md:grid-cols-3`, `lg:grid-cols-2`, etc.)
- Mobile hamburger menu exists in `NavBar`
- Authenticated layout uses `SidebarProvider` which auto-converts to Sheet on mobile
- Login page is mobile-friendly (`max-w-md`, centered, `p-4`)
- Onboarding layout is mobile-friendly (`max-w-2xl`, `px-4 py-8`)

### Minor frontend issues:

- Home page renders a full-screen iframe -- may not scale properly on mobile
- Privacy/Terms/Security page navigation links may overflow on narrow screens
- `AppSidebar.tsx` search input always visible -- may be cramped on mobile Sheet
- No viewport meta in root layout (same as agent app)

---

## Implementation Priority

```
Phase 1 - Unlocks mobile usage entirely:
  1. Viewport meta tags (Area 1) -- 5 minutes
  2. AppTopBar mobile menu (Area 2) -- 2-3 hours
  3. DetailPageShell component (Area 3) -- 3-4 hours
  4. Refactor 5 layouts (Area 3) -- 2 hours
  5. Workspace chat mobile (Area 4) -- 2-3 hours

Phase 2 - Makes complex pages usable:
  6. Sheet/Dialog width fixes (Area 7) -- 1 hour
  7. Split layout responsive (Area 9) -- 1-2 hours
  8. Table column hiding (Area 8) -- 2-3 hours
  9. TabsList overflow fix (Area 8) -- 1 hour

Phase 3 - Builder experiences:
  10. BuilderShell tabbed mobile (Area 5) -- 3-4 hours
  11. CanvasBuilderPanel mobile (Area 5) -- 2-3 hours
  12. React Flow touch support (Area 6) -- 2-3 hours

Phase 4 - Polish:
  13. Spacing/padding updates (Area 10) -- 1-2 hours
  14. Touch target sizing (Area 11) -- 2-3 hours
  15. Hover-only interaction fixes (Area 11) -- 1-2 hours
  16. Command palette mobile trigger (Area 11) -- 30 min
  17. Frontend minor fixes (Area 12) -- 1 hour
```

**Total estimate:** ~30-40 hours of focused work

**Key insight:** The DetailPageShell component (Phase 1) both enables mobile AND cleans up 550+ lines of duplicated desktop code. The mobile optimization improves the desktop codebase.
