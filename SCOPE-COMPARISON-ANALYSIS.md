# Google Calendar Scope Comparison Analysis

**Context**: Issue #164 - Understanding the difference between `calendar.readonly` and `calendar.events`

---

## Scope Definitions (From Google OAuth Documentation)

| Scope | Full URI | Permissions | Description |
|-------|----------|-------------|-------------|
| **calendar** | `https://www.googleapis.com/auth/calendar` | Full access | See, edit, share, and permanently delete all the calendars you can access using Google Calendar |
| **calendar.events** | `https://www.googleapis.com/auth/calendar.events` | Read/write events | View and edit events on all your calendars |
| **calendar.readonly** | `https://www.googleapis.com/auth/calendar.readonly` | Read-only | See all your calendars and events |
| **calendar.events.readonly** | `https://www.googleapis.com/auth/calendar.events.readonly` | Read events only | View events on all your calendars |

---

## Capability Matrix

| Operation | calendar | calendar.events | calendar.readonly | calendar.events.readonly |
|-----------|----------|-----------------|-------------------|--------------------------|
| List calendars | ✅ | ✅ | ✅ | ✅ |
| List events | ✅ | ✅ | ✅ | ✅ |
| Get event details | ✅ | ✅ | ✅ | ✅ |
| Search events | ✅ | ✅ | ✅ | ✅ |
| Create event | ✅ | ✅ | ❌ | ❌ |
| Update event | ✅ | ✅ | ❌ | ❌ |
| Delete event | ✅ | ✅ | ❌ | ❌ |
| Share/manage calendar | ✅ | ❌ | ❌ | ❌ |
| Delete calendar | ✅ | ❌ | ❌ | ❌ |

---

## AgentC2 Tool Requirements

| Tool ID | Operation | Min Scope Required | Works with calendar.readonly? |
|---------|-----------|-------------------|-------------------------------|
| `google-calendar-list-events` | List events in time range | `calendar.events` | ✅ Would work with `readonly` |
| `google-calendar-search-events` | Search events by text | `calendar.events` | ✅ Would work with `readonly` |
| `google-calendar-get-event` | Get single event details | `calendar.events` | ✅ Would work with `readonly` |
| `google-calendar-create-event` | Create new event | `calendar.events` | ❌ **Fails with readonly** |
| `google-calendar-update-event` | Update existing event | `calendar.events` | ❌ **Fails with readonly** |
| `google-calendar-delete-event` | Delete event | `calendar.events` | ❌ **Fails with readonly** |

**Key Insight**: While 3 of 6 tools would work with `calendar.readonly`, the platform uses `calendar.events` for ALL tools to ensure:
1. Consistent permission model
2. Agents can both read AND modify calendar
3. No confusing partial functionality
4. Future-proof for new calendar features

---

## Scope Evolution in AgentC2

### Historical Timeline (Inferred from Code)

| Phase | Scope Used | Rationale | Issue |
|-------|------------|-----------|-------|
| **Early Development** | `calendar` (full access) | Maximum permissions for prototyping | Over-permissioned |
| **Security Hardening** | `calendar.readonly` | Data minimization, principle of least privilege | Under-permissioned |
| **Current (Correct)** | `calendar.events` | Balance: Read/write events, no calendar management | ✅ Right balance |

### Why calendar.events Is the Right Choice

**Compared to `calendar` (too broad)**:
- ✅ Cannot delete entire calendars
- ✅ Cannot share calendars with others
- ✅ Cannot modify calendar metadata
- ✅ Follows principle of least privilege

**Compared to `calendar.readonly` (too narrow)**:
- ✅ Can create events (agent-initiated scheduling)
- ✅ Can update events (reschedule, add attendees)
- ✅ Can delete events (cancel meetings)
- ✅ Matches user expectations of "calendar management"

---

## Current State Analysis

### Where calendar.readonly Appears (❌ Incorrect)

| Location | Type | Impact | Fix Priority |
|----------|------|--------|--------------|
| `SetupWizard.tsx:70` | Code | **Critical** - Breaks re-authorization | Immediate |
| `SetupWizard.tsx:81` | Code comment | Low - Documentation only | Low |
| `search-events.ts:91` | Code comment | Low - Documentation only | Low |
| `privacy/page.tsx:147` | Public docs | Medium - User confusion | High |
| `security/page.tsx:272` | Public docs | Medium - Misleading claims | High |
| `PIPEDA-AUDIT.md:75` | Internal audit | Low - Internal only | Medium |
| `GDPR-AUDIT.md:33` | Internal audit | Low - Internal only | Medium |
| `build-a-sales-agent.mdx:134` | Public guide | Medium - Wrong instructions | High |

### Where calendar.events Appears (✅ Correct)

| Location | Type | Status |
|----------|------|--------|
| `google-scopes.ts:21` | Source of truth | ✅ Correct |
| `auth.ts:91` | Better Auth config | ✅ Correct (imports from SSoT) |
| `mcp/client.ts:630` | Google Calendar provider seed | ✅ Correct |
| `mcp/client.ts:633` | Google Calendar OAuth config | ✅ Correct |
| `gmail.ts:204` | Sibling sync | ✅ Correct |
| `google-calendar/shared.ts:20,23` | Tool constants | ✅ Correct |
| All 6 calendar tools | Scope validation | ✅ Correct |

---

## Why The Bug Wasn't Caught Earlier

### Testing Gaps

1. **No integration test for re-authorization flow**
   - Tests cover initial sign-up
   - Tests don't cover SetupWizard OAuth flow
   - No E2E test for "disconnect then reconnect"

2. **Connection test doesn't validate scopes**
   - Only checks token presence
   - Doesn't verify token capabilities
   - False positive for insufficient scopes

3. **No scope consistency check**
   - No validation that SetupWizard scopes match auth.ts scopes
   - No alert when fallback config is used
   - No automated check that all Google scope references match

### Detection Strategies for Future

1. **Scope Consistency Linter**:
   ```typescript
   // Build-time check in CI
   import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";
   import { OAUTH_PROVIDER_MAP } from "SetupWizard.tsx";
   
   if (OAUTH_PROVIDER_MAP.gmail.scopes !== GOOGLE_OAUTH_SCOPES) {
       throw new Error("SetupWizard Gmail scopes don't match auth.ts");
   }
   ```

2. **Runtime Scope Monitoring**:
   ```typescript
   // In checkGoogleScopes function
   if (missing.length > 0) {
       console.error("[Scope Mismatch]", {
           gmailAddress,
           required: requiredScopes,
           granted: Array.from(grantedScopes),
           missing
       });
       // Send to error tracking
   }
   ```

3. **Integration Test Coverage**:
   ```typescript
   test("SetupWizard OAuth scopes match GOOGLE_OAUTH_SCOPES", () => {
       // Extract OAUTH_PROVIDER_MAP.gmail.scopes
       // Compare with GOOGLE_OAUTH_SCOPES
       // Assert exact match
   });
   
   test("Re-authorization grants all required scopes", async () => {
       // Simulate disconnect + reconnect flow
       // Verify Account.scope contains calendar.events
       // Verify calendar tools work
   });
   ```

---

## Google OAuth Best Practices

Based on this bug, here are recommendations for managing OAuth scopes:

### 1. Single Source of Truth

✅ **Do**: Define scopes once, import everywhere
```typescript
// In google-scopes.ts
export const GOOGLE_OAUTH_SCOPES = [/* ... */];

// In auth.ts
import { GOOGLE_OAUTH_SCOPES } from "./google-scopes";
scope: [...GOOGLE_OAUTH_SCOPES]

// In SetupWizard.tsx
import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";
scopes: [...GOOGLE_OAUTH_SCOPES]

// In mcp/client.ts
import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";
scopes: [...GOOGLE_OAUTH_SCOPES]
```

❌ **Don't**: Duplicate scope arrays across files

### 2. Request All Scopes Every Time

✅ **Do**: Always request complete scope list, even if only using subset
```typescript
// When authorizing Gmail, request Gmail + Calendar + Drive scopes
scopes: [gmail.modify, calendar.events, drive.readonly, drive.file]
```

❌ **Don't**: Request incremental scopes
```typescript
// First auth: [gmail.modify]
// Later auth: [calendar.events]  
// ❌ Second auth OVERWRITES first, losing gmail.modify!
```

### 3. Validate Scopes at Multiple Layers

✅ **Do**: Check scopes at connection test, tool execution, AND runtime
```typescript
// Connection test
if (!hasRequiredScopes) return { success: false, error: "Missing scopes" };

// Tool execution
const scopeCheck = await checkGoogleScopes(address, REQUIRED_SCOPES);
if (!scopeCheck.ok) return { success: false, error: "Insufficient permissions" };

// Runtime monitoring
if (apiResponse.status === 403) {
    console.error("[Calendar API] 403 - Possible scope issue");
}
```

❌ **Don't**: Only check at one layer

### 4. Use Least Privilege (But Not Too Little)

✅ **Do**: Use narrowest scope that covers ALL features
```typescript
// calendar.events: Can read/write events, cannot delete calendars
// Perfect for agent use case
```

❌ **Don't**: Use too-narrow scope that breaks features
```typescript
// calendar.readonly: Can read events, but create/update/delete fail
```

❌ **Don't**: Use too-broad scope beyond what's needed
```typescript
// calendar: Can delete entire calendars — unnecessary risk
```

### 5. Document Scope Decisions

✅ **Do**: Explain why each scope is needed
```typescript
// In google-scopes.ts
export const GOOGLE_OAUTH_SCOPES = [
    // Gmail — gmail.modify is a superset covering read, compose, draft, send, label.
    // No need for gmail.send separately since gmail.modify already includes it.
    "https://www.googleapis.com/auth/gmail.modify",

    // Calendar — calendar.events allows read/write events but not calendar deletion.
    // Required for agent-initiated meeting scheduling and updates.
    "https://www.googleapis.com/auth/calendar.events",
    
    // ... etc
];
```

---

## References

- Google OAuth Scopes: https://developers.google.com/identity/protocols/oauth2/scopes
- Better Auth OAuth Docs: https://better-auth.com/docs/concepts/oauth
- Google Calendar API: https://developers.google.com/calendar/api/guides/overview
- Issue #164: https://github.com/Appello-Prototypes/agentc2/issues/164
- Full RCA: `/workspace/RCA-google-calendar-scope-missing.md`

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-12  
**Status**: Ready for review
