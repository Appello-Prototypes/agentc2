# Quick Fix Guide: React Error #300 Workspace Chat

**Status:** Ready for Implementation  
**Severity:** P0 Critical  
**Est. Time:** 3-5 hours  

## Problem

Workspace chat crashes with React error #300 after 3-8 seconds on every interaction.

## Root Cause

Conditional return at line 1773 in `apps/agent/src/app/workspace/page.tsx` that switches between landing/chat states based on `hasMessages`.

```typescript
// ❌ CURRENT (BROKEN)
if (!hasMessages) {
    return <LandingState />; // Line 1773
}
return <ChatState />; // Line 1844
```

## Fix

Replace conditional return with conditional rendering:

```typescript
// ✅ FIXED
return (
    <div className="flex h-full">
        {!hasMessages && <LandingState />}
        {hasMessages && <ChatState />}
    </div>
);
```

## Files to Change

- `apps/agent/src/app/workspace/page.tsx` - Lines 1770-1969

## Pre-Push Checklist

```bash
bun run type-check  # Must pass
bun run lint        # Must pass
bun run format      # Must pass
bun run build       # Must pass
```

## Testing Checklist

- [ ] Landing state renders (greeting + suggestions)
- [ ] Submit message transitions to chat state
- [ ] Streaming response completes without crash (wait 10+ seconds)
- [ ] Agent switching works
- [ ] Conversation loading from sidebar works
- [ ] Voice overlay works
- [ ] File attachments work

## Commit Message

```
fix: resolve React error #300 in workspace chat by eliminating conditional return

- Restructure UnifiedChatPage to use conditional rendering within single return
- Remove early return at line 1773 that caused hook count mismatch during streaming
- Maintain identical functionality and visual output
- Fix 100% reproducible crash affecting all workspace chat interactions

Closes #75
```

## Full Documentation

See `docs/rca-react-error-300-workspace-chat.md` for complete root cause analysis.
