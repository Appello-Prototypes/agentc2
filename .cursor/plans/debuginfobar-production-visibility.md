# Technical Design: Hide DebugInfoBar in Production

**Issue:** [#76](https://github.com/Appello-Prototypes/agentc2/issues/76)  
**Scope:** Low | **Priority:** Medium  
**Created:** 2026-03-04

---

## Executive Summary

The `DebugInfoBar` component in workspace chat (`apps/agent/src/app/workspace/page.tsx`) currently renders in production, exposing internal debugging information (thread IDs, run IDs, agent slugs, turn indices) to end users. This represents an information leak and presents an unprofessional user experience.

**Proposed Solution:** Implement conditional rendering logic to hide the DebugInfoBar in production environments unless explicitly enabled via a `?debug=true` query parameter.

**Estimated Complexity:** Low (single file change, no database or API modifications required)

---

## Current Implementation Analysis

### Component Location

```tsx
// apps/agent/src/app/workspace/page.tsx:841-972
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
    // ... implementation details
    // Displays: threadId, runId, turnIndex, agentSlug
    // Features: Copy to clipboard, links to /observe page
}
```

**Rendered at:** Line 1873-1878 in the chat state section

```tsx
{/* Debug info bar */}
<DebugInfoBar
    threadId={threadId}
    runId={currentRunId}
    agentSlug={selectedAgentSlug}
    turnIndex={currentTurnIndex}
/>
```

### Information Exposed

The DebugInfoBar currently exposes:

1. **Thread ID** - Full conversation thread identifier (e.g., `chat-assistant-1709568123456`)
2. **Run ID** - Agent execution run identifier (e.g., `run_abc123xyz...`)
3. **Turn Index** - Conversation turn counter (incremental integer)
4. **Agent Slug** - Internal agent identifier (e.g., `bigjim2-appello`, `assistant`)
5. **Direct Links** - Links to internal `/observe` debugging interface with pre-filled search queries

### Security & Privacy Implications

**Low-to-Medium Risk:**

- **Information Disclosure:** Internal identifiers and system architecture exposed to end users and potential attackers
- **Professional Image:** Debug UI visible to customers/partners damages product perception
- **Attack Surface:** Internal URLs and navigation patterns exposed
- **No Direct Exploit:** IDs alone don't grant access, but they aid reconnaissance

**Not Affected:**
- No sensitive user data (PII) is directly exposed
- Authentication/authorization remains intact
- No credential leakage

---

## Technical Design

### Architecture Overview

**Pattern:** Client-side conditional rendering based on:
1. **Environment detection** - `process.env.NODE_ENV !== "production"`
2. **Query parameter override** - `?debug=true` in URL

**Implementation Location:** Single file change in `apps/agent/src/app/workspace/page.tsx`

### Component Structure Changes

#### Option A: Inline Conditional Rendering (Recommended)

**Advantages:**
- Minimal code change (2-3 lines)
- No new files or abstractions
- Direct and explicit
- Easy to review and understand

**Implementation:**

```tsx
// Add debug visibility check at component top level (after imports)
const isDebugVisible = useMemo(() => {
    // Show in development always
    if (process.env.NODE_ENV !== "production") return true;
    
    // Show in production only if ?debug=true
    return searchParams.get("debug") === "true";
}, [searchParams]);

// Later in JSX (line 1872-1878)
{isDebugVisible && (
    <DebugInfoBar
        threadId={threadId}
        runId={currentRunId}
        agentSlug={selectedAgentSlug}
        turnIndex={currentTurnIndex}
    />
)}
```

#### Option B: Extract to Utility Hook

**Advantages:**
- Reusable across other components
- Centralizes debug visibility logic
- Easier to extend with additional conditions later

**Disadvantages:**
- More files to maintain
- Overkill for a single-use case (currently)
- Harder to understand at a glance

**Implementation:**

```tsx
// apps/agent/src/hooks/useDebugMode.ts (new file)
"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export function useDebugMode(): boolean {
    const searchParams = useSearchParams();
    
    return useMemo(() => {
        // Always show in development
        if (process.env.NODE_ENV !== "production") return true;
        
        // Show in production only if ?debug=true
        return searchParams.get("debug") === "true";
    }, [searchParams]);
}

// Usage in workspace/page.tsx
const isDebugVisible = useDebugMode();
```

#### Option C: Environment Variable Feature Flag

**Advantages:**
- Deployment-level control without code changes
- Can disable debug bar server-wide in production
- Can enable for specific staging environments

**Disadvantages:**
- Removes query parameter override flexibility
- Requires environment variable management
- Less discoverable for developers/support teams

**Implementation:**

```tsx
// .env.example (add)
NEXT_PUBLIC_ENABLE_DEBUG_BAR="false"

// workspace/page.tsx
const isDebugVisible = useMemo(() => {
    // Check feature flag first
    if (process.env.NEXT_PUBLIC_ENABLE_DEBUG_BAR === "false") return false;
    
    // Show in development
    if (process.env.NODE_ENV !== "production") return true;
    
    // Show in production if ?debug=true
    return searchParams.get("debug") === "true";
}, [searchParams]);
```

**Recommendation:** **Option A (Inline Conditional)** - Simplest, most maintainable, sufficient for current needs.

---

## Detailed Implementation Plan

### Phase 1: Core Implementation (Single PR)

#### Step 1: Add Debug Visibility Logic

**File:** `apps/agent/src/app/workspace/page.tsx`

**Location:** After line 1014 (after `voiceConversationActive` state declaration)

**Code Addition:**

```tsx
// Debug bar visibility: hidden in production unless ?debug=true
const isDebugVisible = useMemo(() => {
    if (process.env.NODE_ENV !== "production") return true;
    return searchParams.get("debug") === "true";
}, [searchParams]);
```

**Dependencies:** 
- `searchParams` already imported via `useSearchParams()` (line 985)
- `useMemo` already imported (line 3)
- No new imports needed

#### Step 2: Conditionally Render DebugInfoBar

**File:** `apps/agent/src/app/workspace/page.tsx`

**Location:** Lines 1872-1878

**Change:**

```tsx
// Before
{/* Debug info bar */}
<DebugInfoBar
    threadId={threadId}
    runId={currentRunId}
    agentSlug={selectedAgentSlug}
    turnIndex={currentTurnIndex}
/>

// After
{/* Debug info bar */}
{isDebugVisible && (
    <DebugInfoBar
        threadId={threadId}
        runId={currentRunId}
        agentSlug={selectedAgentSlug}
        turnIndex={currentTurnIndex}
    />
)}
```

#### Step 3: Testing

**Manual Test Cases:**

1. **Development Mode (default visible)**
   - Start: `bun run dev`
   - Navigate to: `/workspace`
   - Expected: DebugInfoBar visible
   - Verify: Can expand/collapse, copy IDs, navigate to observe

2. **Production Build (default hidden)**
   - Build: `NODE_ENV=production bun run build`
   - Start: `NODE_ENV=production bun run start`
   - Navigate to: `/workspace`
   - Expected: DebugInfoBar hidden
   - Verify: No debug bar, chat functions normally

3. **Production with Debug Override (visible)**
   - Build: `NODE_ENV=production bun run build`
   - Start: `NODE_ENV=production bun run start`
   - Navigate to: `/workspace?debug=true`
   - Expected: DebugInfoBar visible
   - Verify: Debug bar appears, fully functional

4. **Embed Mode (should hide regardless)**
   - Test iframe embed with debug=true
   - Expected: DebugInfoBar respects visibility rules
   - Note: Embed contexts typically shouldn't expose debug info

**Automated Test Cases:**

No automated tests required for this change (UI-only, no business logic). Manual verification sufficient.

#### Step 4: Quality Checks

```bash
# Type checking
bun run type-check

# Linting
bun run lint

# Format
bun run format

# Build verification (must succeed in both modes)
NODE_ENV=development bun run build
NODE_ENV=production bun run build
```

---

## Integration Points

### Existing Code Dependencies

**Direct Dependencies:**
- `useSearchParams()` from `next/navigation` (already imported)
- `useMemo()` from React (already imported)
- `process.env.NODE_ENV` (available globally)

**No Changes Required To:**
- DebugInfoBar component itself (remains functional)
- State management (`threadId`, `runId`, etc. still tracked)
- Conversation persistence logic
- Agent switching logic
- Sidebar integration

### Affected User Flows

**✅ Unaffected Flows:**
- Normal chat conversations
- Agent switching
- Voice conversations
- File attachments
- Task suggestions
- Conversation history
- New conversation creation

**✅ Enhanced Flows:**
- Production chat experience (cleaner, no debug UI)
- Support/debugging (can add `?debug=true` when needed)

---

## Edge Cases & Considerations

### 1. Embed Mode

**Current Behavior:**
- `useEmbedConfig()` hook already present (line 987)
- Embed mode detected when page is in iframe
- Embed contexts used by partners/customers

**Recommendation:** Debug bar should be hidden in embed mode regardless of environment, unless explicitly overridden with `?debug=true`.

**Extended Implementation:**

```tsx
const isDebugVisible = useMemo(() => {
    // Never show in embed mode (unless debug=true override)
    if (embedConfig && searchParams.get("debug") !== "true") return false;
    
    // Show in development
    if (process.env.NODE_ENV !== "production") return true;
    
    // Show in production only if ?debug=true
    return searchParams.get("debug") === "true";
}, [searchParams, embedConfig]);
```

### 2. Server-Side Rendering (SSR)

**Issue:** `searchParams` is client-side only (from `useSearchParams()` hook)

**Current State:** 
- The entire workspace page is marked `"use client"` (line 1)
- No SSR concerns - all logic executes client-side
- `process.env.NODE_ENV` is available at build time and inlined by Next.js

**No Action Required:** Component already client-side, no SSR considerations.

### 3. Query Parameter Persistence

**Behavior:** 
- If user adds `?debug=true`, it persists only for that page load
- Navigating away or refreshing without query param hides debug bar again
- This is desired behavior (debug mode should be explicitly enabled)

**No Action Required:** Default Next.js behavior is correct.

### 4. State Management Impact

**Question:** Does hiding the DebugInfoBar break anything that depends on threadId/runId/turnIndex state?

**Answer:** No. The state variables are still maintained in the component:
- `threadId` - used for transport, conversation saving, sidebar
- `currentRunId` - used for run finalization, API calls
- `currentTurnIndex` - used for metadata tracking
- `selectedAgentSlug` - used for agent selection, transport

**The DebugInfoBar is purely presentational** - it displays state but doesn't manage it.

### 5. Accessibility

**Current State:** DebugInfoBar has some accessibility features:
- `aria-label` on buttons
- Semantic HTML structure
- Keyboard navigation support

**Impact:** No accessibility regression - component either renders (with a11y) or doesn't render.

### 6. Performance

**Impact:** Negligible
- Component renders conditionally (React optimization)
- `useMemo` hook prevents unnecessary recalculations
- No network requests or heavy computations

---

## Alternative Approaches Considered

### Alternative 1: CSS Display None

**Approach:** Use CSS to hide the component instead of conditional rendering

```tsx
<div className={isDebugVisible ? "" : "hidden"}>
    <DebugInfoBar ... />
</div>
```

**Rejected Because:**
- Component still renders in React tree (unnecessary)
- Still executes all hooks and state management
- Source code still visible in browser DevTools
- Not idiomatic React pattern for conditional rendering

### Alternative 2: Separate Debug Route

**Approach:** Move debug info to a dedicated route like `/workspace/debug`

**Rejected Because:**
- Much larger change (routing, navigation, state persistence)
- Breaks existing links to `/observe` with pre-filled search
- Disrupts support/debugging workflows
- Over-engineered for the problem

### Alternative 3: Collapse by Default in Production

**Approach:** Render the component but keep it collapsed unless expanded

**Rejected Because:**
- Still visible to users (shows collapsed "Debug" button)
- Doesn't solve information disclosure concern
- Adds UI complexity without benefit
- Partial solution to stated problem

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Break debug workflows for internal team | Low | Medium | Communicate `?debug=true` override to team, update documentation |
| Query param conflicts with other features | Very Low | Low | `debug` is generic but isolated to this component |
| Environment variable detection fails | Very Low | High | Extensive existing usage in codebase validates reliability |
| Breaks in embed contexts | Low | Medium | Test embed scenarios explicitly |

### Rollback Plan

If issues arise post-deployment:

1. **Immediate Rollback:** Revert single commit (1 file change)
2. **Partial Rollback:** Change condition to always show (remove production check)
3. **Verification:** Visual inspection of `/workspace` page

**Rollback Time:** < 5 minutes (one-line change)

---

## Impact Assessment

### User-Facing Changes

**✅ Positive Impacts:**
- Cleaner, more professional UI in production
- No internal implementation details exposed
- Improved information security posture

**⚠️ Potential Concerns:**
- Support team loses easy access to debug info
  - **Mitigation:** Document `?debug=true` override, train support team
  - **Alternative:** Add dedicated support tools page with full debug context

### Developer Experience

**Development (Local):**
- No change - debug bar always visible
- Same debugging workflows
- Same access to thread/run IDs

**Production (Deployed):**
- Debug bar hidden by default
- Accessible via `?debug=true` when needed
- Requires conscious opt-in (security by default)

### Existing Functionality

**No Impact On:**
- Conversation persistence (localStorage)
- Agent switching
- Message rendering
- Tool invocations
- Voice conversations
- File attachments
- Activity log
- Sidebar integration
- API communication
- Run finalization
- Memory tracking

**The DebugInfoBar is purely presentational** - removing it from the render tree doesn't affect any business logic or state management.

---

## Implementation Phases

### Phase 1: Core Implementation ✅ (Single PR)

**Deliverables:**
1. Add `isDebugVisible` conditional logic
2. Wrap DebugInfoBar in conditional render
3. Manual testing (dev + production builds)
4. Quality checks (type-check, lint, format, build)

**Timeline:** 1 hour  
**Effort:** 1 developer  
**Files Changed:** 1 (`apps/agent/src/app/workspace/page.tsx`)  
**Lines Changed:** ~10 lines

**Acceptance Criteria:**
- ✅ Debug bar hidden in production by default
- ✅ Debug bar visible in development
- ✅ Debug bar visible in production with `?debug=true`
- ✅ All existing functionality unaffected
- ✅ Build succeeds
- ✅ No TypeScript errors
- ✅ No linting errors

---

### Phase 2: Enhanced Implementation (Optional Future Work)

**Not required for issue resolution, but potential enhancements:**

#### 2.1: Dedicated Debug Hook (Optional)

**When:** If additional components need similar debug visibility logic

**Deliverables:**
- Extract `useDebugMode()` hook to `apps/agent/src/hooks/useDebugMode.ts`
- Update workspace page to use hook
- Document hook usage in code comments

**Effort:** 30 minutes

#### 2.2: Additional Debug Controls (Optional)

**When:** Support team requests more granular debug controls

**Deliverables:**
- Support for `?debug=verbose` (show additional diagnostics)
- Support for `?debug=minimal` (show only critical IDs)
- Keyboard shortcut (e.g., `Ctrl+Shift+D`) to toggle debug mode

**Effort:** 2-3 hours

#### 2.3: Embed Mode Hardening (Optional)

**When:** Partners/customers report concerns about debug info in embeds

**Deliverables:**
- Force hide debug bar in embed contexts (even with `?debug=true`)
- Separate `?embed_debug=true` parameter for partner testing

**Effort:** 1 hour

#### 2.4: Support Tools Dashboard (Optional)

**When:** Support team needs persistent access to debug info in production

**Deliverables:**
- New route: `/support/debug` (auth-gated)
- Full debug context for any conversation
- Search by thread/run ID
- Enhanced observability tools

**Effort:** 1-2 days

---

## Code Changes Specification

### File: `apps/agent/src/app/workspace/page.tsx`

#### Change 1: Add Debug Visibility Logic

**Location:** After line 1014 (after `voiceConversationActive` state)

**Insertion:**

```tsx
// Debug bar visibility: hidden in production unless ?debug=true
const isDebugVisible = useMemo(() => {
    // Always show in development
    if (process.env.NODE_ENV !== "production") return true;
    
    // Show in production only if ?debug=true query parameter is present
    return searchParams.get("debug") === "true";
}, [searchParams]);
```

**Dependencies:**
- ✅ `searchParams` already available (line 985: `const searchParams = useSearchParams()`)
- ✅ `useMemo` already imported (line 3)
- ✅ `process.env.NODE_ENV` available globally (build-time constant)

#### Change 2: Conditional Render

**Location:** Lines 1872-1878

**Before:**

```tsx
{/* Debug info bar */}
<DebugInfoBar
    threadId={threadId}
    runId={currentRunId}
    agentSlug={selectedAgentSlug}
    turnIndex={currentTurnIndex}
/>
```

**After:**

```tsx
{/* Debug info bar - hidden in production unless ?debug=true */}
{isDebugVisible && (
    <DebugInfoBar
        threadId={threadId}
        runId={currentRunId}
        agentSlug={selectedAgentSlug}
        turnIndex={currentTurnIndex}
    />
)}
```

**Total Changes:**
- **Lines Added:** ~7 lines (visibility logic)
- **Lines Modified:** ~2 lines (add conditional wrapper)
- **Lines Deleted:** 0
- **Files Changed:** 1
- **New Files:** 0

---

## Testing Strategy

### Manual Testing Checklist

#### Test Environment: Development

```bash
# Start development server
bun run dev

# Navigate to workspace
open https://catalyst.localhost/workspace
# OR
open http://localhost:3001/workspace
```

**Expected Results:**
- ✅ DebugInfoBar visible at top of chat
- ✅ Can expand/collapse
- ✅ Thread ID, Run ID, Turn Index displayed
- ✅ Copy buttons functional
- ✅ Links to /observe work
- ✅ All chat functionality works normally

#### Test Environment: Production (Local)

```bash
# Build for production
NODE_ENV=production bun run build

# Start production server
NODE_ENV=production bun run start
# OR (if using pm2)
NODE_ENV=production pm2 start ecosystem.config.js

# Navigate to workspace
open http://localhost:3001/workspace
```

**Expected Results:**
- ✅ DebugInfoBar **NOT visible**
- ✅ Chat interface clean, no debug UI
- ✅ All chat functionality works normally
- ✅ No console errors
- ✅ State management unaffected

#### Test Environment: Production with Debug Override

```bash
# (Same production build from above)

# Navigate to workspace with debug param
open http://localhost:3001/workspace?debug=true
```

**Expected Results:**
- ✅ DebugInfoBar **visible**
- ✅ Full debug functionality available
- ✅ Persists while on page
- ✅ Disappears when navigating without ?debug=true

#### Test Environment: Embed Mode

```bash
# Create test embed page or use existing embed deployment

# Navigate to embed URL
open https://example.com/embed/agent-chat?token=...

# Navigate with debug override
open https://example.com/embed/agent-chat?token=...&debug=true
```

**Expected Results:**
- ✅ Without `?debug=true`: Debug bar hidden (clean embed experience)
- ✅ With `?debug=true`: Debug bar visible (for partner debugging)

### Regression Testing

**Critical User Flows to Verify:**

1. **Start new conversation** - Success, no errors
2. **Send message** - Agent responds, run ID tracked
3. **Switch agents mid-conversation** - Works, thread resets correctly
4. **Load existing conversation from sidebar** - Loads correctly, IDs preserved
5. **Voice conversation** - Launches, transcripts work
6. **File upload** - Attaches correctly, sent to agent
7. **Tool invocations** - Render correctly in message stream
8. **Stop generation** - Stops streaming, finalizes run

**Expected:** All flows work identically with or without debug bar visible.

### Browser Compatibility

**No Impact:** 
- Uses standard React conditional rendering
- `process.env.NODE_ENV` inlined at build time (no runtime issues)
- `searchParams.get()` supported in all modern browsers
- No new APIs or browser features required

---

## Documentation Updates

### Internal Documentation

**File:** `CLAUDE.md`

**Section:** Troubleshooting or Development Commands

**Addition:**

```markdown
### Debug Mode in Production

The workspace chat debug bar is hidden in production by default. To enable it:

1. Add `?debug=true` query parameter to the URL:
   - Example: `https://agentc2.ai/workspace?debug=true`

2. The debug bar displays:
   - Thread ID (conversation identifier)
   - Run ID (current agent execution)
   - Turn Index (conversation turn counter)
   - Agent Slug (active agent identifier)
   - Quick links to Observe page

3. Use this for:
   - Support debugging
   - Production issue investigation
   - Customer support calls
```

### Support Team Training

**Slack Announcement (Post-Deployment):**

> **🔧 Workspace Debug Bar Now Hidden in Production**
> 
> The debug info bar in workspace chat is now hidden for end users. Internal team members can enable it by adding `?debug=true` to the URL.
> 
> **When to use:**
> - Debugging customer issues
> - Investigating production errors
> - Support calls requiring technical details
> 
> **What it shows:**
> - Thread ID, Run ID, Turn Index, Agent Slug
> - Direct links to Observe page
> 
> Questions? Ask in #engineering

### Customer-Facing Documentation

**No changes required** - feature is internal, not customer-facing.

---

## Monitoring & Observability

### Metrics to Track

**Not Required for This Change**

The change is purely UI/cosmetic. No backend behavior changes, so no new metrics needed.

**Existing Metrics Remain Unchanged:**
- Conversation creation rate
- Message volume
- Agent response times
- Error rates
- Run completion rates

### Logging Considerations

**No New Logs Required**

The debug bar visibility is a frontend concern. Backend logging already captures:
- Thread IDs (via `AgentRunTurn` records)
- Run IDs (via `AgentRun` records)
- Agent slugs (via agent resolver logs)

---

## Deployment Strategy

### Deployment Method

**Standard GitHub Push → Auto-Deploy Pipeline**

1. Create feature branch: `git checkout -b cursor/debuginfobar-production-visibility-bdc0`
2. Implement changes
3. Run quality checks (type-check, lint, format, build)
4. Commit: `git commit -m "fix: hide DebugInfoBar in production unless ?debug=true"`
5. Push: `git push origin cursor/debuginfobar-production-visibility-bdc0`
6. GitHub Actions triggers automatic deployment to production

### Rollout Plan

**Single-Stage Deployment (No Canary Needed)**

- **Why:** UI-only change, no data migrations, no API changes
- **Risk:** Very low
- **Rollback:** Immediate (revert commit)

**Production Deployment Checklist:**

- ✅ All tests pass locally
- ✅ Build succeeds (`bun run build`)
- ✅ No TypeScript errors
- ✅ No linting errors
- ✅ Code formatted
- ✅ Tested in dev mode
- ✅ Tested in production build locally
- ✅ Tested with `?debug=true` override
- ✅ PR reviewed (if applicable)

### Post-Deployment Verification

**Within 5 minutes of deployment:**

1. Navigate to production workspace: `https://agentc2.ai/workspace`
2. Verify: Debug bar NOT visible
3. Navigate to: `https://agentc2.ai/workspace?debug=true`
4. Verify: Debug bar visible
5. Send test message, verify chat works
6. Check browser console for errors

**If Issues Detected:**
- Revert commit immediately
- Investigate locally
- Re-deploy with fix

---

## Security Considerations

### Threat Model

**Before Change:**
- **Information Disclosure:** Internal IDs and architecture visible
- **Reconnaissance:** Attackers can observe system behavior via exposed IDs
- **Social Engineering:** Professional credibility undermined by debug UI

**After Change:**
- **Information Disclosure:** Eliminated for general users
- **Debug Override:** Accessible only to users who know the `?debug=true` parameter
- **Obfuscation:** Not security through obscurity - authentication/authorization unchanged

### Security Improvements

1. **Reduced Attack Surface:** Internal identifiers no longer visible by default
2. **Professional Appearance:** Production UI doesn't reveal implementation details
3. **Controlled Access:** Debug mode opt-in via query parameter

### Limitations

**This Does NOT Provide:**
- Protection against authenticated users accessing debug mode
- Prevention of debug mode discovery (parameter name is guessable)
- Backend API security improvements

**This Is NOT:**
- A replacement for proper access controls
- A security-critical fix (no active exploit)
- Protection against determined attackers

**Recommendation:** Accept these limitations. The primary goal is professional UI and basic information hygiene, not security hardening.

---

## Future Enhancements

### Potential Follow-Up Features

#### 1. Admin-Only Debug Mode

**Description:** Restrict `?debug=true` to users with admin role

**Implementation:**
```tsx
const { data: session } = useSession();
const isAdmin = session?.user?.role === "admin";

const isDebugVisible = useMemo(() => {
    if (process.env.NODE_ENV !== "production") return true;
    // Only admins can enable debug in production
    return searchParams.get("debug") === "true" && isAdmin;
}, [searchParams, isAdmin]);
```

**Effort:** 15 minutes  
**Value:** Medium (restricts debug access to authorized users)

#### 2. Persistent Debug Preference

**Description:** Remember debug mode preference in localStorage

**Implementation:**
```tsx
const [debugEnabled, setDebugEnabled] = useLocalStorage("debug-mode", false);

const isDebugVisible = useMemo(() => {
    if (process.env.NODE_ENV !== "production") return true;
    return debugEnabled || searchParams.get("debug") === "true";
}, [searchParams, debugEnabled]);
```

**Effort:** 30 minutes  
**Value:** Low (convenience feature for frequent debuggers)

#### 3. Debug Toolbar (Developer Experience)

**Description:** Enhanced debug UI with additional tools:
- Performance metrics
- Network request log
- State inspector
- Console output
- Redux DevTools integration

**Effort:** 1-2 weeks  
**Value:** High for internal team, zero value for customers

#### 4. Telemetry Integration

**Description:** Track debug mode usage to understand support patterns

**Implementation:**
```tsx
useEffect(() => {
    if (isDebugVisible && process.env.NODE_ENV === "production") {
        // Log to analytics
        logger.info({ userId: session?.user?.id, page: "/workspace" }, "Debug mode enabled in production");
    }
}, [isDebugVisible, session?.user?.id]);
```

**Effort:** 30 minutes  
**Value:** Medium (insights into support debugging patterns)

---

## Alternatives for Support Team

### Problem Statement

Support team may rely on debug bar for quick access to thread/run IDs when assisting customers.

### Proposed Solutions

#### Solution 1: Document Query Parameter Override (Immediate)

**Approach:** Train support team to use `?debug=true`

**Pros:**
- Zero development effort
- Works immediately
- No UI changes needed

**Cons:**
- Requires manual parameter addition
- Easy to forget during support calls

#### Solution 2: Browser Extension (Future)

**Approach:** Chrome/Firefox extension that automatically adds `?debug=true` to AgentC2 URLs

**Pros:**
- Automatic for support team
- No code changes to product
- Team-scoped (not customer-facing)

**Cons:**
- Requires extension development and distribution
- Browser-specific
- Maintenance overhead

**Effort:** 2-3 days

#### Solution 3: Support Dashboard (Future)

**Approach:** Dedicated `/support/conversations` page with search and debug context

**Pros:**
- Professional support tooling
- Enhanced search and filtering
- Doesn't require debug mode in chat
- Can include additional context (logs, metrics, etc.)

**Cons:**
- Significant development effort
- Requires authentication/authorization
- Additional maintenance surface

**Effort:** 1-2 weeks

**Recommendation:** Start with **Solution 1** (document override). If support team friction is high after 2-4 weeks, evaluate **Solution 3**.

---

## Open Questions

### Q1: Should embed mode force-hide debug bar regardless of ?debug=true?

**Analysis:**
- **Pro:** Cleaner embed experience, partners never see debug UI
- **Con:** Harder to debug embed-specific issues
- **Recommendation:** Allow `?debug=true` in embeds for now, revisit if partners complain

**Decision:** Allow debug override in embeds (keep simple implementation)

### Q2: Should we add a visual indicator that debug mode is active?

**Analysis:**
- Could add small badge to header: "Debug Mode Active"
- Helps users understand they're in non-standard state
- Minimal effort (1-2 lines of JSX)

**Recommendation:** Not necessary for initial implementation. Add if users report confusion.

**Decision:** Skip for Phase 1

### Q3: Should the query parameter be ?debug=true or ?debug=1 or ?debug?

**Analysis:**
- `?debug=true` - Explicit, readable, boolean-like
- `?debug=1` - Shorter, common in legacy systems
- `?debug` - Shortest, but requires different check (`searchParams.has("debug")`)

**Existing Pattern in Codebase:**
```typescript
// From apps/agent/src/app/api/models/route.ts:25
const forceRefresh = searchParams.get("refresh") === "true";

// From apps/agent/src/app/api/mcp/route.ts:192
const includeInactive = searchParams.get("includeInactive") === "true";

// From apps/agent/src/app/api/embed-partners/[id]/route.ts:147
// Requires ?confirm=true for deletion
```

**Recommendation:** Use `?debug=true` to match existing codebase patterns.

**Decision:** `?debug=true`

### Q4: Should we log when debug mode is enabled in production?

**Analysis:**
- **Pro:** Security audit trail, understand usage patterns
- **Con:** Adds logging noise, minimal security value
- **Effort:** 5 minutes

**Recommendation:** Not necessary initially. Add if security team requests audit trail.

**Decision:** Skip for Phase 1

---

## Success Criteria

### Definition of Done

- [x] Design document completed and reviewed
- [ ] Implementation completed (Phase 1)
- [ ] Debug bar hidden in production by default
- [ ] Debug bar visible in development
- [ ] Debug bar visible with `?debug=true` override
- [ ] All quality checks pass (type-check, lint, format, build)
- [ ] Manual testing completed (dev + prod builds)
- [ ] Code pushed to GitHub
- [ ] Deployed to production
- [ ] Post-deployment verification completed
- [ ] Support team notified of change
- [ ] Internal documentation updated

### Acceptance Testing

**Given** a production build of the agent app  
**When** a user navigates to `/workspace`  
**Then** the DebugInfoBar should NOT be visible

**Given** a development build of the agent app  
**When** a user navigates to `/workspace`  
**Then** the DebugInfoBar should be visible

**Given** a production build of the agent app  
**When** a user navigates to `/workspace?debug=true`  
**Then** the DebugInfoBar should be visible

**Given** the DebugInfoBar is visible (any mode)  
**When** a user interacts with it (expand, copy, click links)  
**Then** all functionality should work as before

**Given** the DebugInfoBar is hidden  
**When** a user sends messages and uses the chat  
**Then** all chat functionality should work identically to before

---

## Dependencies & Prerequisites

### Code Dependencies

**Required (Already Present):**
- ✅ `next/navigation` - `useSearchParams()` hook
- ✅ React - `useMemo()` hook
- ✅ TypeScript
- ✅ Next.js build process

**No New Dependencies Required**

### Environment Variables

**No New Variables Required**

**Existing Variables Used:**
- `NODE_ENV` - Set by Node.js/Next.js (build-time constant)
  - Development: `NODE_ENV=development`
  - Production: `NODE_ENV=production`

### Build Configuration

**No Changes Required**

**Existing Configuration Supports:**
- `process.env.NODE_ENV` is replaced at build time by Next.js
- Production builds already set `NODE_ENV=production`
- Development mode already sets `NODE_ENV=development`

---

## Performance Impact

### Bundle Size

**Impact:** Negligible (~0 bytes)

- No new dependencies
- Conditional rendering removes component from tree (slight reduction in prod)
- `useMemo` hook adds ~10 bytes of logic

**Measurement:** Not necessary (sub-1KB change)

### Runtime Performance

**Impact:** Positive (slight improvement)

- Production: One less component in render tree
- Development: No change
- `useMemo` memoization prevents unnecessary recalculations

**Before:**
```
DebugInfoBar always renders → DOM manipulation → Paint
```

**After (Production):**
```
Conditional check → Skip render → No DOM manipulation → No paint
```

### Network Performance

**Impact:** None

- No API calls affected
- No additional network requests
- Frontend-only change

---

## Maintenance Considerations

### Long-Term Maintainability

**Code Complexity:** Very Low
- Single conditional check
- No new abstractions
- Inline with existing component

**Testing Overhead:** Minimal
- Manual testing sufficient
- No automated tests needed
- Quick smoke test on deploy

**Documentation Burden:** Low
- One section in CLAUDE.md
- One Slack announcement
- No customer docs needed

### Technical Debt Assessment

**Debt Introduced:** None

**Debt Resolved:** 
- Removes unintended information disclosure
- Improves production UI professionalism

**Future Considerations:**
- If more components need similar logic, extract to `useDebugMode()` hook
- If support team struggles, build dedicated support tools
- Monitor for requests to re-enable debug bar by default

---

## Compliance & Privacy

### GDPR / Data Protection

**Impact:** Positive (reduces information disclosure)

- Thread IDs, Run IDs may be considered system-generated identifiers
- Removing from default UI reduces unnecessary data exposure
- No user consent required (internal system IDs, not PII)

### Accessibility (WCAG)

**Impact:** Neutral

- Component either renders (accessible) or doesn't render
- No accessibility regression
- Keyboard navigation unaffected
- Screen reader experience unaffected

### Security Standards

**Alignment:**
- ✅ Principle of Least Privilege (don't show what users don't need)
- ✅ Defense in Depth (reduce information leakage)
- ✅ Secure by Default (debug mode opt-in)

---

## Cost-Benefit Analysis

### Development Cost

**Initial Implementation (Phase 1):**
- Design: 1 hour (this document)
- Implementation: 30 minutes
- Testing: 30 minutes
- Documentation: 15 minutes
- **Total:** ~2.5 hours

**Ongoing Maintenance:**
- Near zero (simple conditional, no complexity)

### Business Value

**Quantitative Benefits:**
- Information security: Reduced reconnaissance surface (low-medium value)
- Professional appearance: Better customer impression (medium value)
- Support efficiency: May decrease slightly if team relies on debug bar (low negative)

**Qualitative Benefits:**
- **Professional Polish:** Production UI looks intentional, not accidentally "debug mode"
- **Customer Trust:** Less exposure of internal workings builds confidence
- **Competitive Advantage:** More polished than competitors showing debug info

**ROI:** High (2.5 hours investment, immediate UX improvement, no ongoing cost)

---

## References

### Existing Codebase Patterns

**Environment Detection:**
```tsx
// packages/agentc2/src/lib/logger.ts:23
const isDev = process.env.NODE_ENV !== "production";

// packages/next-config/src/index.ts:3
const isDevelopment = process.env.NODE_ENV === "development";
```

**Query Parameter Access:**
```tsx
// apps/agent/src/app/api/models/route.ts:25
const forceRefresh = searchParams.get("refresh") === "true";

// apps/agent/src/app/api/mcp/route.ts:192
const includeInactive = searchParams.get("includeInactive") === "true";
```

**Conditional Rendering:**
```tsx
// apps/agent/src/app/workspace/page.tsx:1541
{!embedConfig && <VoiceInputButton />}

// apps/agent/src/app/workspace/page.tsx:1551
{!lockedAgentSlug && (
    <AgentSelector ... />
)}
```

### Related Files

- **Main File:** `apps/agent/src/app/workspace/page.tsx`
- **Next Config:** `apps/agent/next.config.ts`
- **Shared Config:** `packages/next-config/src/index.ts`
- **Environment Example:** `.env.example`
- **Documentation:** `CLAUDE.md`, `DEPLOY.md`

---

## Appendix: Full Code Diff Preview

### File: `apps/agent/src/app/workspace/page.tsx`

#### Addition at line ~1015 (after `voiceConversationActive` state):

```tsx
// Debug bar visibility: hidden in production unless ?debug=true
const isDebugVisible = useMemo(() => {
    // Always show in development
    if (process.env.NODE_ENV !== "production") return true;
    
    // Show in production only if ?debug=true query parameter is present
    return searchParams.get("debug") === "true";
}, [searchParams]);
```

#### Modification at lines 1872-1878:

**Before:**
```tsx
{/* Debug info bar */}
<DebugInfoBar
    threadId={threadId}
    runId={currentRunId}
    agentSlug={selectedAgentSlug}
    turnIndex={currentTurnIndex}
/>
```

**After:**
```tsx
{/* Debug info bar - hidden in production unless ?debug=true */}
{isDebugVisible && (
    <DebugInfoBar
        threadId={threadId}
        runId={currentRunId}
        agentSlug={selectedAgentSlug}
        turnIndex={currentTurnIndex}
    />
)}
```

---

## Conclusion

This is a **low-risk, high-value change** that improves production UX and reduces information disclosure. The implementation is straightforward, follows existing codebase patterns, and requires minimal testing.

**Recommended Approach:** 
- Implement Phase 1 (core implementation) immediately
- Monitor support team feedback for 2-4 weeks
- Evaluate Phase 2 enhancements based on actual usage patterns

**Timeline:** Ready to implement immediately. Total effort: 2-3 hours including testing and deployment.

**Approval:** Ready for implementation upon stakeholder review.

---

## Stakeholder Sign-Off

- [ ] **Engineering Lead:** Reviewed technical approach
- [ ] **Product Owner:** Accepts UX changes
- [ ] **Support Lead:** Aware of `?debug=true` override
- [ ] **Security Team:** Reviewed security implications (if applicable)

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-04  
**Author:** Claude (AI Agent)  
**Status:** Ready for Review
