---
name: agentc2-uis
description: Generate a Unified Implementation Spec (UIS) -- a single interactive HTML document that serves as both the design mockup and engineering implementation plan for a UI feature. Use when the user says "create UIS", "generate UIS", "make a UIS", "implementation spec", "design spec", or asks for a combined design + implementation document for a feature.
---

# Unified Implementation Spec (UIS) Generator

A UIS is a single interactive HTML file that replaces separate design specs and implementation plans. It is the sole source of truth for a feature -- visually compelling enough for design review, technically precise enough for engineering handoff.

## When to Use

- User says "create UIS", "generate UIS", "make a UIS"
- User asks for a design spec + implementation plan for a UI feature
- User asks for an interactive mockup with engineering details
- Any feature that touches UI and needs both visual and technical documentation

## Pre-Work: Gather Context

Before generating, you MUST understand the feature deeply:

1. **Read relevant source files** -- components being modified, API routes, hooks, types
2. **Read the Prisma schema** for any models involved (`packages/database/prisma/schema.prisma`)
3. **Query real data shapes** if the feature renders database content -- run a Prisma query or read existing API responses to capture actual `outputJson`, `errorJson`, etc.
4. **Read existing UI components** in `packages/ui/src/components/` to identify reusable primitives (Badge, Stepper, Collapsible, etc.)
5. **Identify the pattern file** -- find an existing file that follows the same pattern as what you're building (e.g., an existing cancel route, an existing detail panel)

## Output

Generate a single HTML file at `.cursor/plans/{feature-name}-uis.html` following the structure in [uis-template.md](uis-template.md).

## Examples

See the [examples/](examples/) folder for real UIS documents produced for this project:

| File                                        | Description                                               |
| ------------------------------------------- | --------------------------------------------------------- |
| [phase0-uis.html](examples/phase0-uis.html) | Phase 0 -- Rich detail rendering for workflow step output |
| [phase1-uis.html](examples/phase1-uis.html) | Phase 1 -- Cancel running workflow functionality          |
| [phase2-uis.html](examples/phase2-uis.html) | Phase 2 -- Feature spec (review these for style variety)  |
| [phase3-uis.html](examples/phase3-uis.html) | Phase 3 -- Feature spec (review these for style variety)  |

Open any example in a browser to see the interactive mockups, state toggles, and visual design language in action. Use them as reference for tone, depth, and interactivity when generating new UIS documents.

## UIS Sections (in order)

| #   | Section                     | Purpose                                                                 |
| --- | --------------------------- | ----------------------------------------------------------------------- |
| 1   | Header                      | Phase tag, title, one-paragraph summary with key constraint             |
| 2   | Architecture / Flow         | Visual flow diagram (user action -> component -> API -> DB -> response) |
| 3   | Interactive UI Mockup       | Pixel-accurate dark-theme mockup with clickable states                  |
| 4   | Files Changed               | Table: Action, Full path, One-line description                          |
| 5   | Real Data Shapes            | Actual JSON from production DB, annotated                               |
| 6   | Step-by-Step Implementation | Numbered steps with file, pattern ref, interfaces, imports, logic       |
| 7   | Rendering / Detection Rules | Content-adaptive rendering table (if applicable)                        |
| 8   | Edge Cases                  | Table: Scenario, Backend behavior, Frontend behavior                    |
| 9   | Component Architecture      | Table: Component/Function, Purpose                                      |
| 10  | Data Flow Trace             | Call chain from user action to final state                              |
| 11  | Playwright Test Plan        | Numbered steps with assertions                                          |
| 12  | Acceptance Criteria         | Checkbox-style pass/fail list                                           |
| 13  | Effort Estimate             | Task breakdown in minutes                                               |

Skip sections that don't apply (e.g., no Architecture/Flow for frontend-only changes, no Rendering Rules for non-content-adaptive features).

## Visual Design Rules

**Mandatory -- every UIS must follow these:**

- Dark theme: bg `#08-0a`, surface `#0e-14`, elevated `#14-1c`
- Two fonts via Google Fonts: one display + one mono (never use Inter, Roboto, Arial, or system fonts)
- Color system: green=success, amber=warning, red=destructive, blue=info, purple=code
- Section eyebrows: monospace, 10px, uppercase, 2.5px letter-spacing, muted color
- Chrome frame (colored dots + label bar) around interactive mockups
- Callout boxes for key decisions: blue left border, blue-tinted background
- Status badges, link chips consistent with AgentC2 app design language
- All interactive elements must work (onclick, toggles, expand/collapse)
- No external CSS/JS libraries -- everything inline
- Vary fonts between UIS documents -- never reuse the same pair

## Implementation Section Rules

**What to include:**

- TypeScript interfaces for new types, props, return shapes
- Function signatures (not full implementations)
- Import statements for non-obvious dependencies
- Pattern file reference ("follows `path/to/existing/file.ts`")
- Logic as numbered sub-lists, not prose
- Error response tables (HTTP code + condition) for API routes
- Extractor priority order if content-adaptive (to avoid rendering fields twice)

**What NOT to include:**

- Full component implementations (the engineer writes the code)
- Obvious imports (`import React from "react"`)
- Explanations of how React/Next.js works

## Quality Checklist

Before delivering, verify:

- [ ] Mockup uses realistic data (not lorem ipsum)
- [ ] All visual states are interactive (toggle between default/loading/success/error)
- [ ] Every file to be changed is listed with full path
- [ ] Real JSON data shapes are included (from DB or realistic examples)
- [ ] Step-by-step implementation is in dependency order
- [ ] Edge cases cover null data, race conditions, network errors
- [ ] Playwright test plan has specific assertions per step
- [ ] Acceptance criteria are individually testable statements
- [ ] Effort estimate is broken down by task
- [ ] The document renders correctly when opened in a browser
- [ ] All onclick handlers work

## Serving the UIS

After generating, serve it for review:

```bash
cd .cursor/plans && python3 -m http.server 8765
open http://localhost:8765/{feature-name}-uis.html
```

## Template Reference

See [uis-template.md](uis-template.md) for the complete HTML boilerplate with all 13 sections, CSS variables, and placeholder content.
