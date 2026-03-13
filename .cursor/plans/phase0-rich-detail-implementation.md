# Phase 0: Rich Step Detail View — Implementation Plan

> **Design Spec / Mockup:** [`phase0-rich-detail-design-spec.html`](phase0-rich-detail-design-spec.html) (open in browser for interactive mockup with per-type rendering examples)
>
> **Parent Work Package:** Workflow Run Controls Master Plan
>
> **Prerequisites:** None — this is the foundation phase.

---

## Objective

Replace the current raw JSON `<pre>` output display in `WorkflowStepsCard` with a structured, human-readable `StepDetailPanel` component that auto-detects content types (links, summaries, decisions, errors, metadata) and renders them appropriately for HITL audit review.

**Key constraint:** Frontend-only change. No API or database modifications required. The existing `/api/reviews/[id]/steps` route already returns `outputJson` — we just render it smarter.

---

## Files Changed

| Action     | File                                                          | Description                                                                                       |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Modify** | `apps/agent/src/app/command/components/WorkflowStepsCard.tsx` | Replace the `{selected && (...)}` block with new `StepDetailPanel` component + extraction helpers |

Single file. No new files, no API changes, no schema changes.

---

## Real Data Shapes (from production DB)

Understanding the actual `outputJson` shapes is critical. Here are the step types observed:

### 1. `transform` — Output Summary Step

```json
{
    "prUrl": "https://cursor.com/agents/bc-7dacbb42...",
    "issueUrl": "https://github.com/Appello-Prototypes/agentc2/issues/202",
    "prNumber": null,
    "repository": "Appello-Prototypes/agentc2",
    "issueNumber": 202,
    "analysisAgentId": "bc-b6b22da2-8d65...",
    "analysisSummary": "## Root Cause Analysis Complete ✅\n\nComprehensive root cause analysis...",
    "analysisDurationMs": 240000,
    "implementationBranch": "cursor/mcp-schema-model-parameter-005c",
    "implementationAgentId": "bc-7dacbb42...",
    "implementationSummary": "Successfully implemented the bugfix...",
    "implementationDurationMs": 345000
}
```

### 2. `human` — HITL Decision Step

```json
{
    "channel": "platform",
    "approved": true,
    "decision": "approved",
    "decidedBy": "cursor-agent"
}
```

### 3. `tool` — Tool Execution (with error)

```json
{
    "error": true,
    "message": "Tool input validation failed for merge-pull-request...",
    "validationErrors": {
        "_errors": [],
        "prNumber": { "_errors": ["Expected number, received null"] }
    }
}
```

### 4. `agent` — Agent Response

```json
{
    "text": "The proposed fix plan addresses the root cause correctly...",
    "verdict": "approved"
}
```

### 5. `branch` — Routing Decision

Typically a simple string or small object indicating which path was taken.

---

## Step-by-Step Implementation

### Step 1: Add Extraction Helper Functions

Add these functions to `WorkflowStepsCard.tsx` (above the component, alongside existing helpers):

#### `classifyUrl(url: string) → { icon, label }`

Maps known URL domains to icons and label prefixes:

- `github.com` → `🐙` + "GitHub"
- `cursor.com/agents` → `🔧` + "Cursor Agent Session"
- Default → `🔗` + truncated hostname

#### `extractLinks(output: unknown) → LinkItem[]`

Scans all fields in the output object:

- If value is a string matching `^https?://`, add to links array
- Skip if the value is `null`
- Use the key name to derive label (e.g., `issueUrl` → "Issue", `prUrl` → "PR")
- Combine with `classifyUrl()` for icon
- Pair URL keys with companion keys (e.g., `issueUrl` + `issueNumber` → "GitHub Issue #202")

```typescript
interface LinkItem {
    url: string;
    label: string;
    icon: string;
}
```

#### `extractMetadata(output: unknown) → MetadataItem[]`

Pulls specific field patterns into the metadata row:

- `repository` → "Repo"
- Keys containing `Branch` → "Branch" (monospace)
- Keys ending in `DurationMs` → humanized label (e.g., `analysisDurationMs` → "Analysis: 4m 0s")
- `channel` → "Channel"
- `decidedBy` → "Decided by"
- `issueNumber` → "Issue #N"

```typescript
interface MetadataItem {
    label: string;
    value: string;
    mono?: boolean;
}
```

#### `extractSummaries(output: unknown) → SummaryItem[]`

Finds text content fields:

- Keys ending in `Summary` → labeled with humanized key (e.g., `analysisSummary` → "Analysis Summary")
- Keys named `text`, `response`, `result`, `summary` → labeled "Response" or "Summary"
- Returns the text content with the key-derived label

```typescript
interface SummaryItem {
    label: string;
    text: string;
}
```

#### `extractDecision(output: unknown) → DecisionInfo | null`

Checks for decision-related fields:

- `decision` field → the decision value
- `approved` field → boolean
- Returns `{ decision, approved, decidedBy, channel }`

```typescript
interface DecisionInfo {
    decision: string;
    approved: boolean;
    decidedBy?: string;
    channel?: string;
}
```

#### `extractError(output: unknown, errorJson: unknown) → ErrorInfo | null`

Parses error information:

- If `output.error` is truthy, parse `output.message` and `output.validationErrors`
- If `errorJson` is present, use it
- Extract validation field errors from nested `_errors` arrays

```typescript
interface ErrorInfo {
    message: string;
    validationErrors?: { field: string; errors: string[] }[];
}
```

#### `getRemainingFields(output: unknown, handledKeys: Set<string>) → Record<string, unknown>`

Returns any fields not already handled by the extractors above, for the "raw JSON" fallback toggle.

---

### Step 2: Create StepDetailPanel Component

Replace the entire `{selected && (...)}` block (lines 161-217) with a new inline component:

```typescript
function StepDetailPanel({
    step,
    suspendedStep
}: {
    step: StepData
    suspendedStep?: string | null
}) {
    const [showRaw, setShowRaw] = useState(false)

    const output = step.outputJson
    const links = extractLinks(output)
    const metadata = extractMetadata(output)
    const summaries = extractSummaries(output)
    const decision = extractDecision(output)
    const error = extractError(output, step.errorJson)

    const handledKeys = new Set<string>(/* keys consumed by extractors */)
    const remaining = getRemainingFields(output, handledKeys)
    const remainingCount = Object.keys(remaining).length

    return (
        <div className="bg-muted/30 space-y-0 overflow-hidden rounded-lg border">
            {/* Header: Step name + type badge + status badge */}
            {/* Metadata row: duration, repo, branch, channel, etc. */}

            <div className="space-y-4 p-4">
                {/* Links section (if any) */}
                {/* Decision section (if human step) */}
                {/* Error section (if error present) */}
                {/* Summary sections (for each detected summary) */}
                {/* Raw JSON toggle (always present) */}
            </div>
        </div>
    )
}
```

---

### Step 3: Rendering Rules by Section

#### Header Row

```
┌─────────────────────────────────────────────────────────┐
│  Output Summary    [transform]              [completed] │
└─────────────────────────────────────────────────────────┘
```

- Left: Step name (`stepName || stepId`) + step type badge (muted variant)
- Right: Status badge (green for completed, red for failed, amber for suspended)

#### Metadata Row

```
┌─────────────────────────────────────────────────────────┐
│  Repo: Appello-Prototypes/agentc2  │  Issue: #202  │   │
│  Branch: cursor/mcp-schema...      │  Analysis: 4m │   │
└─────────────────────────────────────────────────────────┘
```

- Shown below header with a border-bottom separator
- Flex wrap, compact key-value pairs
- Duration fields converted with existing `formatDuration()`
- Branch values in monospace

#### Links Section

```
┌─────────────────────────────────────────────────────────┐
│  LINKS                                                  │
│  [🐙 GitHub Issue #202]  [🔧 Analysis Agent Session]   │
│  [🔧 Implementation Agent Session]                      │
└─────────────────────────────────────────────────────────┘
```

- Each link is a chip/pill with icon + label
- Opens in new tab (`target="_blank"`)
- Hover effect: blue background tint
- Skip links where URL is null

#### Decision Section (human steps only)

```
┌─────────────────────────────────────────────────────────┐
│  DECISION                                               │
│  [✓ Approved]  (green chip)                             │
│                                                         │
│  AUDIT TRAIL                                            │
│  channel    platform                                    │
│  decision   approved                                    │
│  decidedBy  cursor-agent                                │
└─────────────────────────────────────────────────────────┘
```

- Large decision chip (green for approved, red for rejected)
- Audit trail as compact key-value grid

#### Error Section (tool errors)

```
┌─────────────────────────────────────────────────────────┐
│  ERROR                                                  │
│  ┌──── red background ────────────────────────────────┐ │
│  │  ✕ Tool input validation failed                    │ │
│  │  merge-pull-request: Expected number, received null│ │
│  │  ─────────────────────────────────────────────     │ │
│  │  prNumber  Expected number, received null          │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

- Red background block with error icon
- Parse `validationErrors` to show field-level errors
- If `errorJson` exists separately, show that too

#### Summary Sections

```
┌─────────────────────────────────────────────────────────┐
│  ANALYSIS SUMMARY                                       │
│  ┌──── muted background ─────────────────────────────┐ │
│  │  **Root Cause Analysis Complete ✅**               │ │
│  │  Comprehensive root cause analysis for the...      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  IMPLEMENTATION SUMMARY                                 │
│  ┌──── muted background ─────────────────────────────┐ │
│  │  Successfully implemented the bugfix...            │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

- Each summary in its own labeled section
- `whitespace-pre-wrap` for markdown-like formatting
- First line auto-bolded (before first `\n`)
- `max-height: 200px` with overflow scroll

#### Raw JSON Toggle

```
┌─────────────────────────────────────────────────────────┐
│  ▶ View raw output (12 fields)                          │
│  ┌──── collapsible ──────────────────────────────────┐ │
│  │  { "prUrl": "https://...", ... }                   │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

- Always present at the bottom of the panel
- Shows count of total fields
- Collapsed by default
- `max-height: 200px` with overflow

---

### Step 4: Update the Selected Step Rendering

In the main `WorkflowStepsCard` component, replace:

```tsx
// OLD: lines 161-217
{
    selected && (
        <div className="bg-muted/30 space-y-3 rounded-lg border p-3">
            {/* ... raw JSON rendering ... */}
        </div>
    );
}
```

With:

```tsx
// NEW
{
    selected && <StepDetailPanel step={selected} suspendedStep={suspendedStep} />;
}
```

---

## Auto-Detection Priority Order

When processing `outputJson` fields, extractors run in this order to avoid rendering the same field twice:

1. **Links** — consume URL fields (`*Url`, `*AgentId` → cursor link)
2. **Metadata** — consume `repository`, `*Branch`, `*DurationMs`, `channel`, `decidedBy`, `issueNumber`, `prNumber`
3. **Decision** — consume `decision`, `approved`
4. **Error** — consume `error`, `message`, `validationErrors`
5. **Summaries** — consume `*Summary`, `text`, `response`, `result`
6. **Remaining** — anything left goes to raw JSON toggle

Each extractor adds consumed keys to a `Set<string>`. The raw toggle only shows unconsumed fields plus optionally the full object.

---

## Edge Cases

| Scenario                                         | Behavior                                                  |
| ------------------------------------------------ | --------------------------------------------------------- |
| `outputJson` is `null`                           | Show "No output recorded" placeholder                     |
| `outputJson` is a plain string                   | Render as summary text (not JSON)                         |
| `outputJson` is an empty object `{}`             | Show "Empty output" placeholder                           |
| All fields are consumed by extractors            | Raw toggle shows "(all fields rendered above)"            |
| Very long summary text (>2000 chars)             | Already truncated by API; render with `max-height` scroll |
| URL is `null` (e.g., `prUrl: null`)              | Skip, don't render link chip                              |
| Step has both `outputJson` error and `errorJson` | Show `outputJson` error first, then `errorJson` below     |
| `branch` step type                               | Typically small output — render as KV pairs               |
| Unknown field types                              | Render as KV pair in "Additional Details" section         |

---

## Playwright Test Plan

**Credentials:** `sdlc-test@agentc2.ai` / `FlywheelDemo2026!` on `http://localhost:3001`

| #   | Action                                                             | Expected Result                                                          |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1   | Navigate to `/command`, expand a card, click "View workflow steps" | Steps stepper visible                                                    |
| 2   | Click "Output Summary" step (transform type)                       | Structured panel with header, metadata, links, summaries                 |
| 3   | Verify links section                                               | GitHub issue link chip present and clickable                             |
| 4   | Verify metadata row                                                | Repository, branch, durations visible                                    |
| 5   | Verify summaries                                                   | "Analysis Summary" and "Implementation Summary" rendered with formatting |
| 6   | Click "View raw output" toggle                                     | Raw JSON appears below, scrollable                                       |
| 7   | Click "Review PR on GitHub" step (human type)                      | Decision chip "Approved" in green, audit trail KV grid                   |
| 8   | Click "Merge PR" step (tool with error)                            | Red error block with validation field errors                             |
| 9   | Click "Audit Fix Plan" step (agent type)                           | Agent response text in summary block                                     |
| 10  | Screenshot all states for human review                             | All step types render correctly, no raw JSON visible by default          |

---

## Acceptance Criteria

- [ ] Clicking a workflow step shows structured detail panel (not raw JSON)
- [ ] URLs are auto-detected and rendered as clickable link chips
- [ ] `*Summary` fields render as formatted text blocks with labels
- [ ] `*DurationMs` fields display as human-readable time
- [ ] Human steps show decision chip (approved/rejected) with audit trail
- [ ] Tool errors show structured error block with validation details
- [ ] Null values are hidden (not rendered)
- [ ] Raw JSON is always available via toggle at bottom
- [ ] No regressions in step stepper, status display, or step selection
- [ ] Playwright test passes all 10 steps

---

## Estimated Effort

| Task                                         | Estimate    |
| -------------------------------------------- | ----------- |
| Extraction helper functions (6 functions)    | 25 min      |
| `StepDetailPanel` component                  | 30 min      |
| Replace existing `{selected && (...)}` block | 5 min       |
| Edge case handling                           | 10 min      |
| Playwright testing + fixes                   | 20 min      |
| **Total**                                    | **~90 min** |
