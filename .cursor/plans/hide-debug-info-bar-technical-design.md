# Technical Design: Hide DebugInfoBar Component in Production

**Issue**: [#76 - Hide DebugInfoBar component in production builds](https://github.com/Appello-Prototypes/agentc2/issues/76)

**Priority**: High | **Scope**: Low | **Status**: Design Phase

**Author**: AI Agent | **Date**: 2026-03-04

---

## Executive Summary

The `DebugInfoBar` component in the workspace chat interface (`apps/agent/src/app/workspace/page.tsx`, lines 841-971) currently displays internal debug information (thread IDs, run IDs, agent slugs, turn indices) to all users in production environments. This creates an unprofessional user experience and leaks internal system architecture details.

**Solution**: Implement conditional rendering logic to show the debug bar only:
- In development environments (`NODE_ENV === "development"`)
- When a `?debug=true` query parameter is present (for production debugging)
- For authenticated admin/platform users (optional enhancement)

**Impact**: Minimal risk, no breaking changes, improved UX for end users, retained debugging capability for developers.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Technical Requirements](#2-technical-requirements)
3. [Proposed Architecture](#3-proposed-architecture)
4. [Implementation Design](#4-implementation-design)
5. [Integration Points](#5-integration-points)
6. [Security Considerations](#6-security-considerations)
7. [Testing Strategy](#7-testing-strategy)
8. [Risk Assessment](#8-risk-assessment)
9. [Phased Rollout Plan](#9-phased-rollout-plan)
10. [Alternative Approaches](#10-alternative-approaches)

---

## 1. Current State Analysis

### 1.1 Component Location and Structure

**File**: `apps/agent/src/app/workspace/page.tsx`

**Component Definition**: Lines 841-971
```tsx
function DebugInfoBar({
    threadId,
    runId,
    agentSlug,
    turnIndex
}: {
    threadId: string;
    runId: string | null;
    agentSlug: string;
    turnIndex: number | null;
}) {
    // Displays: Thread ID, Run ID, Turn Index, Agent Slug
    // Includes copy-to-clipboard and links to /observe page
}
```

**Usage**: Line 1873-1878 (within chat state render)
```tsx
{/* Debug info bar */}
<DebugInfoBar
    threadId={threadId}
    runId={currentRunId}
    agentSlug={selectedAgentSlug}
    turnIndex={currentTurnIndex}
/>
```

### 1.2 Information Exposed

The component displays:

1. **Thread ID** - Unique conversation identifier (format: `chat-{timestamp}` or `chat-{agent}-{timestamp}`)
2. **Run ID** - Mastra run execution identifier (UUID format)
3. **Turn Index** - Sequential turn counter within a run (integer)
4. **Agent Slug** - Internal agent identifier (e.g., `assistant`, `research`, `mcp-agent`)

Each field includes:
- Copy-to-clipboard functionality
- External links to `/observe?tab=runs&search={runId}` and `/observe?tab=conversations&search={threadId}`

### 1.3 Current Visibility

**Always Visible**: The component renders unconditionally when messages exist in the conversation (lines 1873-1878).

**User Impact**:
- End users see internal system identifiers they don't understand
- Exposes internal architecture and naming conventions
- Appears unprofessional in production
- May confuse users who click on "Debug" thinking it's a feature for them

### 1.4 Observe Page Integration

The `/observe` page (apps/agent/src/app/observe/page.tsx) provides:
- **Dashboard tab**: Metrics and analytics
- **Runs tab**: Detailed run execution logs with filtering by runId
- **Conversations tab**: Thread history with search by threadId
- **Triggers tab**: Activity logs for scheduled and webhook triggers

**Access Pattern**: Deep-linked from DebugInfoBar via query parameters (e.g., `/observe?tab=runs&search={runId}`)

### 1.5 Existing Conditional Rendering Patterns

The codebase demonstrates several patterns for conditional UI:

**1. Embed Config Pattern** (lines 1541-1542):
```tsx
{!embedConfig && <VoiceInputButton />}
{!embedConfig && (
    <PromptInputButton onClick={...}>
        <PhoneIcon className="size-4" />
    </PromptInputButton>
)}
```

**2. Feature Flag Pattern** (`apps/agent/src/app/signup/page.tsx:20`):
```tsx
const isInviteOnly = process.env.FEATURE_INVITE_ONLY !== "false";
```

**3. Query Parameter Pattern** (`apps/agent/src/app/observe/page.tsx:13`):
```tsx
const activeTab = searchParams.get("tab") || "dashboard";
```

**4. Environment Check Pattern** (`packages/next-config/src/index.ts:3`):
```tsx
const isDevelopment = process.env.NODE_ENV === "development";
```

---

## 2. Technical Requirements

### 2.1 Functional Requirements

**FR-1**: Hide DebugInfoBar in production by default
- Component must not render when `NODE_ENV === "production"` and no debug flag is set
- No visual artifacts or layout shifts from hidden component

**FR-2**: Show DebugInfoBar in development
- Always visible when `NODE_ENV === "development"`
- Maintains current functionality (expand/collapse, copy, links)

**FR-3**: Support query parameter override
- Show DebugInfoBar when `?debug=true` is present in URL (any environment)
- Hide when `?debug=false` is explicitly set (even in development)
- Default behavior when parameter is absent

**FR-4**: Maintain debugging capability
- Developers must still access thread/run IDs for production debugging
- Links to `/observe` page remain functional
- Copy-to-clipboard functionality preserved when visible

### 2.2 Non-Functional Requirements

**NFR-1**: Performance
- No performance degradation from visibility check
- Query parameter parsing must be efficient (already present via `useSearchParams()`)

**NFR-2**: Maintainability
- Solution follows existing codebase patterns
- Clear, self-documenting code
- Easy to extend for future debug features

**NFR-3**: Security
- No sensitive information exposure through debug flag
- Debug mode accessible to authenticated users only (inherited from page auth)

**NFR-4**: User Experience
- No layout shifts when component toggles visibility
- Consistent behavior across all deployment modes (app, embed)

---

## 3. Proposed Architecture

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    UnifiedChatPage (Client)                  │
│                  (apps/agent/src/app/workspace/page.tsx)     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ├──> useSearchParams() [existing]
                        │    └──> Extract ?debug query param
                        │
                        ├──> shouldShowDebugInfo() [NEW]
                        │    ├──> Check NODE_ENV
                        │    ├──> Check ?debug query param
                        │    └──> Return boolean
                        │
                        └──> {shouldShowDebug && <DebugInfoBar ... />}
```

### 3.2 Component Hierarchy

```
UnifiedChatPage (Client Component)
  ├── useSearchParams() - Next.js hook
  ├── shouldShowDebugInfo - New utility function
  │   ├── Reads process.env.NODE_ENV
  │   └── Reads searchParams.get("debug")
  └── DebugInfoBar (conditionally rendered)
      ├── Thread ID display + copy + link
      ├── Run ID display + copy + link
      ├── Turn Index display
      └── Agent Slug display + link
```

### 3.3 Data Flow

```
User visits /workspace
    │
    ├──> URL contains ?debug=true?
    │    ├──> Yes: Show DebugInfoBar
    │    └──> No: Continue...
    │
    ├──> NODE_ENV === "development"?
    │    ├──> Yes: Show DebugInfoBar
    │    └──> No: Hide DebugInfoBar
    │
    └──> Render chat interface
```

### 3.4 Environment Variable Strategy

**No new environment variables required**. Use existing `NODE_ENV` which is:
- Automatically set by Next.js build system
- `"development"` during `bun run dev`
- `"production"` during `bun run build` and deployment
- Available in both server and client components (via Next.js compilation)

**Alternative Considered**: Add `NEXT_PUBLIC_DEBUG_MODE` env var
- **Rejected**: Adds unnecessary configuration complexity
- Query parameter approach is more flexible and user-friendly

---

## 4. Implementation Design

### 4.1 Core Logic - `shouldShowDebugInfo()` Function

**Location**: Inline within `UnifiedChatPage` component (or extractable to utils)

```typescript
function shouldShowDebugInfo(debugParam: string | null): boolean {
    // Explicit query parameter takes precedence
    if (debugParam === "true") return true;
    if (debugParam === "false") return false;
    
    // Default: show in development, hide in production
    return process.env.NODE_ENV === "development";
}
```

**Design Decisions**:

1. **Query parameter precedence**: Allows production debugging without environment changes
2. **Explicit false override**: Developers can hide debug bar in development if desired
3. **Simple boolean logic**: Easy to understand and test
4. **No dependencies**: Uses only built-in capabilities

### 4.2 Component Integration

**Modification Location**: Line ~1872-1878 in `apps/agent/src/app/workspace/page.tsx`

**Before**:
```tsx
{/* Debug info bar */}
<DebugInfoBar
    threadId={threadId}
    runId={currentRunId}
    agentSlug={selectedAgentSlug}
    turnIndex={currentTurnIndex}
/>
```

**After**:
```tsx
{/* Debug info bar - visible in dev or with ?debug=true */}
{shouldShowDebugInfo(searchParams.get("debug")) && (
    <DebugInfoBar
        threadId={threadId}
        runId={currentRunId}
        agentSlug={selectedAgentSlug}
        turnIndex={currentTurnIndex}
    />
)}
```

**Note**: `searchParams` is already available in the component (line 985).

### 4.3 Type Safety

No new types required. The function uses:
- `string | null` - Return type of `searchParams.get()`
- `boolean` - Return type of `shouldShowDebugInfo()`

### 4.4 Alternative: Custom Hook Approach

**Option B**: Extract to a custom hook for reusability

```typescript
// apps/agent/src/hooks/useDebugMode.ts
"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export function useDebugMode(): boolean {
    const searchParams = useSearchParams();
    
    return useMemo(() => {
        const debugParam = searchParams.get("debug");
        if (debugParam === "true") return true;
        if (debugParam === "false") return false;
        return process.env.NODE_ENV === "development";
    }, [searchParams]);
}
```

**Usage**:
```tsx
const showDebug = useDebugMode();

{showDebug && <DebugInfoBar ... />}
```

**Trade-offs**:
- **Pro**: Reusable if other debug UI is added later
- **Pro**: Cleaner component code
- **Pro**: Testable in isolation
- **Con**: Adds another file to maintain
- **Con**: Overkill for single-use case

**Recommendation**: Start with inline function (Option A), extract to hook if debug features proliferate.

---

## 5. Integration Points

### 5.1 Direct Dependencies

1. **`useSearchParams()`** (Next.js)
   - Already imported and used (line 4, 985)
   - No additional imports needed
   - Client component requirement satisfied

2. **`process.env.NODE_ENV`** (Node.js/Next.js)
   - Available in client components via Next.js compilation
   - Statically replaced at build time
   - No runtime environment variable lookup needed

### 5.2 Affected Components

**Primary**:
- `UnifiedChatPage` - Main workspace chat page
- `DebugInfoBar` - The debug component itself (no changes needed to component internals)

**Secondary** (no changes required):
- `/observe` page - Still receives deep-linked URLs from DebugInfoBar when visible
- `ConversationSidebar` - No dependency on debug bar visibility
- Navigation components - No awareness of debug features

### 5.3 Downstream Impact

**Observe Page**: No changes needed
- Deep links from DebugInfoBar will continue to work when debug bar is shown
- Direct navigation to `/observe` remains available via main navigation
- Search functionality still works with manual thread/run ID entry

**Conversation Persistence**: No changes needed
- Thread IDs and run IDs are still generated and tracked internally
- Auto-save to localStorage continues normally
- Sidebar conversation list unaffected

**Analytics & Monitoring**: No changes needed
- Run metadata still tracked in database
- Telemetry unaffected by UI visibility
- Sentry error tracking continues normally

### 5.4 Embed Mode Compatibility

**Embed Sessions** (via `useEmbedConfig()`):
- Current behavior: DebugInfoBar shown if messages exist
- Proposed behavior: Hidden by default in production embeds
- Override: Partner can add `?debug=true` for troubleshooting
- No changes to embed configuration schema

**Recommendation**: Apply same visibility logic across all modes (app, embed, workspace) for consistency.

---

## 6. Security Considerations

### 6.1 Information Disclosure Analysis

**Current Exposure** (debug bar always visible):
- **Thread ID**: Client-generated timestamp-based ID (e.g., `chat-1709568234567`)
- **Run ID**: Server-generated UUID (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- **Agent Slug**: Internal agent identifier (e.g., `assistant`, `research`)
- **Turn Index**: Sequential counter (0, 1, 2, ...)

**Severity**: Low
- No authentication tokens or API keys exposed
- IDs are not directly exploitable without authentication
- Access to `/observe` page requires authentication (inherited from page-level auth)

**Impact**: Primarily UX/professionalism issue, not critical security vulnerability

### 6.2 Debug Mode Access Control

**Query Parameter Access** (`?debug=true`):
- **Risk**: Any authenticated user can enable debug mode
- **Mitigation**: Page already requires authentication (Better Auth session)
- **Rationale**: Authenticated users can already see their own thread/run data via `/observe`

**No Additional Authorization Needed**:
- Debug data is user-scoped (user's own conversations)
- No cross-user data leakage risk
- Thread IDs stored in localStorage (client-side, user-scoped)
- Run IDs fetched via authenticated API calls

### 6.3 Production Debug Access

**Use Cases**:
1. **Developer Troubleshooting**: Dev asks user to add `?debug=true` to URL, share screenshot
2. **Support Debugging**: Support staff enable debug mode to inspect IDs for database queries
3. **Internal Testing**: QA team uses debug mode on staging/production environments

**Best Practice**: Document debug mode in internal wiki/runbook, not public user documentation.

---

## 7. Testing Strategy

### 7.1 Manual Testing Checklist

**Development Environment**:
- [ ] DebugInfoBar visible by default (no query param)
- [ ] DebugInfoBar hidden with `?debug=false`
- [ ] All debug bar features work (expand, copy, links)
- [ ] No console errors

**Production Build (local)**:
- [ ] DebugInfoBar hidden by default (no query param)
- [ ] DebugInfoBar visible with `?debug=true`
- [ ] DebugInfoBar hidden with `?debug=false`
- [ ] Build completes without errors (`bun run build`)

**Cross-Browser**:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari

**Mobile Responsive**:
- [ ] Behavior consistent on mobile devices
- [ ] No layout issues when toggling visibility

### 7.2 Automated Testing

**Unit Tests** (optional, recommended if using custom hook):

```typescript
// apps/agent/src/hooks/__tests__/useDebugMode.test.ts

describe("useDebugMode", () => {
    it("returns true in development by default", () => {
        process.env.NODE_ENV = "development";
        // Mock useSearchParams to return no debug param
        expect(result).toBe(true);
    });
    
    it("returns false in production by default", () => {
        process.env.NODE_ENV = "production";
        expect(result).toBe(false);
    });
    
    it("returns true when ?debug=true in production", () => {
        process.env.NODE_ENV = "production";
        // Mock useSearchParams to return debug=true
        expect(result).toBe(true);
    });
    
    it("returns false when ?debug=false in development", () => {
        process.env.NODE_ENV = "development";
        // Mock useSearchParams to return debug=false
        expect(result).toBe(false);
    });
});
```

**Integration Tests** (E2E):

```typescript
// tests-e2e/debug-info-bar.spec.ts

test("debug bar hidden in production by default", async ({ page }) => {
    // Build with NODE_ENV=production
    await page.goto("/workspace");
    await page.getByRole("textbox").fill("Hello");
    await page.getByRole("textbox").press("Enter");
    await expect(page.getByText("Debug")).not.toBeVisible();
});

test("debug bar visible with ?debug=true", async ({ page }) => {
    await page.goto("/workspace?debug=true");
    await page.getByRole("textbox").fill("Hello");
    await page.getByRole("textbox").press("Enter");
    await expect(page.getByText("Debug")).toBeVisible();
});
```

### 7.3 Regression Testing

**Verify No Side Effects**:
- [ ] Conversation persistence still works (localStorage)
- [ ] Sidebar refresh still triggers (titleVersion state)
- [ ] Observe page deep links still work (when debug bar visible)
- [ ] Run finalization still occurs (onBeforeUnload handler)
- [ ] Agent switching still works
- [ ] Voice conversation overlay unaffected
- [ ] New conversation flow unaffected

---

## 8. Risk Assessment

### 8.1 Implementation Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Debug bar never shows (logic error) | Medium | Low | Comprehensive testing in dev/prod modes |
| Layout shift when toggling visibility | Low | Low | Use conditional rendering (not CSS hide) |
| Performance regression from query param check | Very Low | Very Low | `searchParams` already used in component |
| Breaking existing debug workflows | Medium | Low | Clear communication to dev team, update docs |

### 8.2 User Impact

**End Users** (production):
- **Positive**: Cleaner, more professional UI
- **Neutral**: No functional changes to chat experience
- **Negative**: None

**Developers**:
- **Positive**: Debug mode available on-demand via query param
- **Neutral**: Dev environment behavior unchanged
- **Negative**: One extra step to debug production issues (add `?debug=true`)

**Support Team**:
- **Positive**: Can guide users to add `?debug=true` for troubleshooting
- **Negative**: Need to update troubleshooting runbooks

### 8.3 Rollback Plan

**Simple Rollback**:
1. Remove conditional wrapper: `{shouldShowDebugInfo(...) && <DebugInfoBar ... />}`
2. Restore original: `<DebugInfoBar ... />`
3. Commit and push (no build config changes, no database migrations)

**Zero Risk**: No database schema changes, no API modifications, purely UI change.

---

## 9. Phased Rollout Plan

### Phase 1: Core Implementation ⚡ (1-2 hours)

**Objective**: Hide debug bar in production, show in development

**Tasks**:
1. Add `shouldShowDebugInfo()` function to `UnifiedChatPage`
2. Wrap `<DebugInfoBar>` in conditional render
3. Test locally in development mode (should still show)
4. Test local production build (`bun run build && bun run start`)

**Success Criteria**:
- ✅ Debug bar visible in dev mode
- ✅ Debug bar hidden in production build
- ✅ Build completes without errors
- ✅ Type checking passes (`bun run type-check`)

**Files Modified**:
- `apps/agent/src/app/workspace/page.tsx` (1 function + 1 conditional wrapper)

**No Database Changes**: None

**No API Changes**: None

**No Environment Variables**: None

---

### Phase 2: Query Parameter Support ⚡ (30 minutes)

**Objective**: Enable `?debug=true` override in production

**Tasks**:
1. Enhance `shouldShowDebugInfo()` to check `searchParams.get("debug")`
2. Test with various query param combinations
3. Update internal troubleshooting documentation

**Success Criteria**:
- ✅ `?debug=true` shows debug bar in production
- ✅ `?debug=false` hides debug bar in development
- ✅ No query param = default behavior

**Files Modified**:
- `apps/agent/src/app/workspace/page.tsx` (update function logic)

---

### Phase 3: Documentation & Communication (30 minutes)

**Objective**: Ensure team knows how to use debug mode

**Tasks**:
1. Add comment above `DebugInfoBar` explaining visibility rules
2. Update `/CLAUDE.md` with debug mode documentation (if relevant)
3. Notify dev team via Slack/email about change
4. Update support runbooks with `?debug=true` troubleshooting step

**Deliverables**:
- Code comments
- Internal documentation update
- Team notification

---

### Phase 4: Optional Enhancements (Future)

**Not included in initial scope, but potential follow-ups**:

**4.1 User Role-Based Visibility**
- Show debug bar to admin users automatically (requires user role check)
- Implementation: Check `session.user.role === "admin"` in `shouldShowDebugInfo()`

**4.2 Debug Menu Expansion**
- Add more debug features (memory state, tool registry, LLM params)
- Requires new components and state management

**4.3 Persistent Debug Mode Preference**
- Store user's debug mode preference in localStorage
- Auto-enable debug mode for returning developers

**4.4 Keyboard Shortcut Toggle**
- Add keyboard shortcut (e.g., `Cmd+Shift+D`) to toggle debug mode
- Requires event listener and state management

---

## 10. Alternative Approaches

### Approach A: Inline Conditional (Recommended)

**Implementation**: Direct conditional rendering with inline logic

```tsx
{(process.env.NODE_ENV === "development" || searchParams.get("debug") === "true") && 
    <DebugInfoBar ... />}
```

**Pros**:
- Simplest implementation
- No new files or functions
- Clear intent at call site

**Cons**:
- Logic duplicated if used in multiple places
- Slightly less readable (longer condition)

**Verdict**: ✅ Best for single-use case

---

### Approach B: Custom Hook (Alternative)

**Implementation**: `useDebugMode()` hook

```tsx
const showDebug = useDebugMode();
{showDebug && <DebugInfoBar ... />}
```

**Pros**:
- Reusable across components
- Testable in isolation
- Cleaner component code

**Cons**:
- Adds new file (hooks/useDebugMode.ts)
- Overkill for single use
- Slightly more complex

**Verdict**: ⚠️ Use if other debug UI components are planned

---

### Approach C: Environment Variable Flag

**Implementation**: Add `NEXT_PUBLIC_SHOW_DEBUG_BAR="true"`

**Pros**:
- Explicit configuration
- Easy to toggle per deployment

**Cons**:
- Requires environment variable management
- Less flexible than query parameter
- Adds configuration overhead

**Verdict**: ❌ Rejected - Over-engineered for this use case

---

### Approach D: CSS-Based Hiding

**Implementation**: Add CSS class that hides in production

```tsx
<DebugInfoBar className={process.env.NODE_ENV === "production" ? "hidden" : ""} />
```

**Pros**:
- Component always renders (maintains React tree structure)

**Cons**:
- Unnecessary React reconciliation for hidden element
- Still runs component logic (copy handlers, state)
- Worse performance than conditional rendering
- Element still in DOM (inspectable)

**Verdict**: ❌ Rejected - Inferior to conditional rendering

---

### Approach E: Server-Side Conditional

**Implementation**: Pass `showDebug` prop from server component

**Pros**:
- Centralized configuration
- Could integrate with user permissions

**Cons**:
- Page is already client component (`"use client"` at line 1)
- Would require major refactoring (split server/client)
- Incompatible with `useSearchParams()` (client-only)

**Verdict**: ❌ Rejected - Not compatible with existing architecture

---

## Appendix A: Code Locations Reference

| Element | File | Lines |
|---------|------|-------|
| Main workspace page | `apps/agent/src/app/workspace/page.tsx` | 1-1971 |
| DebugInfoBar component | `apps/agent/src/app/workspace/page.tsx` | 841-972 |
| DebugInfoBar render call | `apps/agent/src/app/workspace/page.tsx` | 1872-1878 |
| useSearchParams import | `apps/agent/src/app/workspace/page.tsx` | 4 |
| searchParams usage | `apps/agent/src/app/workspace/page.tsx` | 985 |
| Observe page | `apps/agent/src/app/observe/page.tsx` | 1-91 |
| Environment patterns | `packages/next-config/src/index.ts` | 3, 51, 61 |

---

## Appendix B: Example Debug Workflows

### Developer Workflow: Local Development

```bash
# Start dev server (debug bar always visible)
bun run dev

# Navigate to workspace
open https://catalyst.localhost/workspace

# Debug bar visible by default (NODE_ENV=development)
# Click "Debug" to expand and see thread/run IDs
# Click external link icons to view in /observe
```

### Developer Workflow: Production Debugging

```bash
# User reports issue in production
# Dev asks user to add ?debug=true to URL

# User visits:
https://agentc2.ai/workspace?debug=true

# User screenshots debug bar showing:
# - threadId: chat-1709568234567
# - runId: 550e8400-e29b-41d4-a716-446655440000

# Dev copies IDs and queries database:
# SELECT * FROM run WHERE id = '550e8400-e29b...';
# SELECT * FROM message WHERE thread_id = 'chat-1709568234567';
```

### Support Workflow: Customer Troubleshooting

```markdown
**Support Ticket**: User reports agent not responding

**Support Agent**:
1. Ask user to add `?debug=true` to URL
2. Request screenshot of expanded debug bar
3. Use thread ID to query `/observe?tab=conversations&search={threadId}`
4. Inspect run logs for errors
5. Escalate to engineering with run ID if needed
```

---

## Appendix C: Configuration Matrix

| Environment | Query Param | Debug Bar Visible? | Use Case |
|-------------|-------------|-------------------|----------|
| Development | (none) | ✅ Yes | Default dev workflow |
| Development | `?debug=true` | ✅ Yes | Explicit enable (redundant) |
| Development | `?debug=false` | ❌ No | Clean UI for demos/screenshots |
| Production | (none) | ❌ No | Normal end-user experience |
| Production | `?debug=true` | ✅ Yes | Production debugging |
| Production | `?debug=false` | ❌ No | Explicit hide (redundant) |

---

## Appendix D: Related Feature Flags

Existing feature flag patterns in the codebase:

| Flag | Type | Purpose |
|------|------|---------|
| `FEATURE_DB_AGENTS` | Server | Enable database-driven agents vs code-defined |
| `NEXT_PUBLIC_FEATURE_NEW_ONBOARDING` | Client | Toggle new integration-first onboarding flow |
| `FEATURE_INVITE_ONLY` | Server | Restrict signups to invite-only mode |
| `NODE_ENV` | Server+Client | Standard environment flag (development/production) |

**Pattern Consistency**: Our implementation follows the `NODE_ENV` pattern (standard) + query param override pattern (common in codebase).

---

## Appendix E: Dependencies

### Zero New Dependencies

This feature requires **no new npm packages, no new environment variables, no database migrations**.

**Used Existing**:
- `useSearchParams` from `next/navigation` (already imported)
- `process.env.NODE_ENV` (built-in, available everywhere)
- React conditional rendering (standard)

---

## Appendix F: Performance Impact

### Rendering Performance

**Before**: `<DebugInfoBar />` always renders (React reconciliation + DOM updates)

**After**: `{condition && <DebugInfoBar />}` - component only renders when condition true

**Impact**:
- **Production**: ~0.1-0.2ms faster render (component skipped entirely)
- **Development**: No change (still renders)
- **Memory**: Negligible (one fewer component in tree when hidden)

### Query Parameter Parsing

**Cost**: `searchParams.get("debug")` is O(1) lookup on URLSearchParams object

**Overhead**: <0.01ms (already used for agent selection)

**Conclusion**: Zero measurable performance impact

---

## Summary & Recommendation

### Recommended Approach

**Phase 1 Implementation** (Inline Conditional):
```tsx
function shouldShowDebugInfo(debugParam: string | null): boolean {
    if (debugParam === "true") return true;
    if (debugParam === "false") return false;
    return process.env.NODE_ENV === "development";
}

// ... in render:
{shouldShowDebugInfo(searchParams.get("debug")) && (
    <DebugInfoBar
        threadId={threadId}
        runId={currentRunId}
        agentSlug={selectedAgentSlug}
        turnIndex={currentTurnIndex}
    />
)}
```

### Why This Approach

1. **Minimal Changes**: Single function + conditional wrapper
2. **Zero Dependencies**: Uses existing imports and patterns
3. **Zero Risk**: No database, API, or build config changes
4. **Maximum Flexibility**: Query param override for production debugging
5. **Follows Patterns**: Consistent with existing codebase conventions

### Estimated Effort

- **Implementation**: 30 minutes
- **Testing**: 30 minutes
- **Documentation**: 15 minutes
- **Total**: ~1.5 hours

### Success Metrics

- ✅ Debug bar hidden in production (default)
- ✅ Debug bar visible in development (default)
- ✅ `?debug=true` override works in production
- ✅ All existing features continue working
- ✅ Build passes (`bun run build`)
- ✅ Type checking passes (`bun run type-check`)
- ✅ Linting passes (`bun run lint`)

---

## Conclusion

This is a straightforward UI visibility fix with minimal risk and high value. The proposed solution:

- Uses standard React conditional rendering
- Follows existing codebase patterns
- Requires no new dependencies or configuration
- Maintains debugging capability for developers
- Improves production user experience
- Can be implemented and tested in under 2 hours

**Status**: Ready for implementation approval

**Next Steps**: Proceed to implementation phase per phased rollout plan (Phases 1-3).
