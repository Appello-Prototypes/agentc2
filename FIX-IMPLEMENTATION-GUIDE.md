# Fix Implementation Guide - Issue #164

**Quick reference for implementing the Google Calendar scope fix.**

---

## Pre-Implementation Checklist

- [ ] Read full RCA: `RCA-google-calendar-scope-missing.md`
- [ ] Review issue: https://github.com/Appello-Prototypes/agentc2/issues/164
- [ ] Backup database (optional but recommended)
- [ ] Ensure Google Cloud Console has `calendar.events` scope approved
- [ ] Create feature branch: `git checkout -b fix/calendar-events-scope`

---

## Implementation Steps

### Step 1: Fix SetupWizard (5 minutes)

**File**: `apps/agent/src/components/integrations/SetupWizard.tsx`

**Change 1**: Add import at top of file (around line 6)
```typescript
import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";
```

**Change 2**: Replace lines 64-75
```typescript
// BEFORE:
const OAUTH_PROVIDER_MAP: Record<string, OAuthConfig> = {
    gmail: {
        socialProvider: "google",
        scopes: [
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/calendar.readonly"
        ],
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    }
};

// AFTER:
const OAUTH_PROVIDER_MAP: Record<string, OAuthConfig> = {
    gmail: {
        socialProvider: "google",
        scopes: [...GOOGLE_OAUTH_SCOPES],
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    }
};
```

**Change 3**: Add scope description (around line 81)
```typescript
const SCOPE_DESCRIPTIONS: Record<string, string> = {
    "https://www.googleapis.com/auth/gmail.modify": "Read and manage your emails",
    "https://www.googleapis.com/auth/gmail.send": "Send emails on your behalf",
    "https://www.googleapis.com/auth/calendar.readonly": "View your calendar events",
    "https://www.googleapis.com/auth/calendar.events": "Manage your calendar events (create/update/delete)",  // ✅ ADD THIS
    "https://www.googleapis.com/auth/calendar": "Manage your calendar events",
    // ... rest unchanged
};
```

### Step 2: Fix Database Seed (5 minutes)

**File**: `packages/agentc2/src/mcp/client.ts`

**Location**: Around line 594-601 (in INTEGRATION_PROVIDER_SEEDS array, gmail object)

**Replace**:
```typescript
// BEFORE:
configJson: {
    requiredScopes: ["https://www.googleapis.com/auth/gmail.modify"],
    oauthConfig: {
        socialProvider: "google",
        scopes: ["https://www.googleapis.com/auth/gmail.modify"],
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    },
    setupUrl: "/mcp/gmail",
    setupLabel: "Open OAuth Setup"
}

// AFTER:
configJson: {
    requiredScopes: [
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/calendar.events"
    ],
    oauthConfig: {
        socialProvider: "google",
        scopes: [
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/webmasters.readonly"
        ],
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    },
    setupUrl: "/mcp/gmail",
    setupLabel: "Open OAuth Setup"
}
```

---

## Verification Steps

### Step 3: Build and Test Locally (10 minutes)

```bash
# 1. Format code
bun run format

# 2. Type check
bun run type-check

# 3. Lint
bun run lint

# 4. Build
bun run build

# 5. Start dev server
bun run dev
```

### Step 4: Test Re-Authorization Flow (5 minutes)

1. Navigate to `http://localhost:3001/mcp/providers/gmail`
2. Open browser console, add breakpoint in `getOAuthConfig()`
3. Click "Connect" button
4. Verify in console that scopes include `calendar.events`
5. Complete OAuth flow (or cancel to avoid updating test data)

### Step 5: Verify Database Seed (2 minutes)

```bash
# Open Prisma Studio
bun run db:studio

# Navigate to IntegrationProvider table
# Find record where key = "gmail"
# Check configJson.oauthConfig.scopes
# Should include all 5 Google scopes
```

---

## Deployment Steps

### Step 6: Commit Changes (2 minutes)

```bash
git add apps/agent/src/components/integrations/SetupWizard.tsx
git add packages/agentc2/src/mcp/client.ts
git commit -m "fix: correct Google Calendar OAuth scope (calendar.events not calendar.readonly)

- Update SetupWizard OAUTH_PROVIDER_MAP to use GOOGLE_OAUTH_SCOPES
- Update mcp/client.ts Gmail provider seed with complete Google scopes
- Fixes #164"
```

### Step 7: Push and Deploy (5 minutes)

```bash
# Push to remote
git push origin fix/calendar-events-scope

# Create PR or merge to main (depending on team workflow)

# After merge, GitHub Actions will auto-deploy to production
# Or manually deploy if needed:
# ssh to server and run deployment script
```

### Step 8: Verify Production (5 minutes)

```bash
# SSH to production server
ssh user@production-server

# Check server logs
pm2 logs agent --lines 50

# Verify database seed ran
# Look for "[MCP] Ensuring integration providers..." in logs

# Test API endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://your-domain.com/api/integrations/providers | jq '.providers[] | select(.key=="gmail") | .config.oauthConfig.scopes'

# Should return array with 5 scopes including calendar.events
```

---

## User Communication

### For Affected User (nathan@useappello.com)

**Email Template**:

> Subject: Google Calendar Integration Fixed
> 
> Hi Nathan,
> 
> We've identified and fixed the issue with your Google Calendar integration. The problem was caused by an incorrect permission scope in our re-authorization flow.
> 
> **Action Required**: Please reconnect your Google Calendar:
> 
> 1. Go to Settings > Integrations
> 2. Find "Gmail" and click "Disconnect"
> 3. Click "Connect" and complete the authorization
> 4. Test the calendar functionality with your demo-prep-agent-appello
> 
> After re-connecting, all calendar tools (list, search, create, update events) should work correctly.
> 
> If you encounter any issues, please reply to this email or open a support ticket.
> 
> Thanks for your patience!

---

## Post-Deployment Monitoring

### Metrics to Watch (First 24h)

1. **OAuth Re-Authorization Rate**:
   ```sql
   SELECT COUNT(*), DATE_TRUNC('hour', "updatedAt") as hour
   FROM "Account"
   WHERE "providerId" = 'google'
   AND "updatedAt" > NOW() - INTERVAL '24 hours'
   GROUP BY hour
   ORDER BY hour;
   ```

2. **Calendar Tool Success Rate**:
   ```sql
   -- Requires logging infrastructure
   SELECT 
       tool_name,
       COUNT(*) as attempts,
       SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successes,
       ROUND(100.0 * SUM(CASE WHEN success = true THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
   FROM tool_execution_logs
   WHERE tool_name LIKE 'google-calendar-%'
   AND created_at > NOW() - INTERVAL '24 hours'
   GROUP BY tool_name;
   ```

3. **Scope Error Rate**:
   ```bash
   # Check application logs for scope errors
   pm2 logs agent | grep "missing authorization scope"
   ```

### Success Criteria

- [ ] No new scope error logs for calendar tools
- [ ] Connection test pass rate > 95%
- [ ] Calendar tool success rate > 90%
- [ ] Affected user confirms calendar functionality restored
- [ ] No reports of new scope-related issues

---

## Rollback Plan (If Needed)

If the fix causes unexpected issues:

```bash
# 1. Revert commit
git revert <commit-hash>
git push origin main

# 2. Or manually restore previous code
git checkout <previous-commit> -- apps/agent/src/components/integrations/SetupWizard.tsx
git checkout <previous-commit> -- packages/agentc2/src/mcp/client.ts
git commit -m "revert: rollback calendar scope fix"
git push origin main

# 3. Re-deploy
# GitHub Actions will auto-deploy or manually:
ssh user@server
cd /path/to/app
git pull
pm2 restart agent
```

**Database Rollback** (if needed):
```sql
-- Restore previous Gmail provider config
UPDATE "IntegrationProvider"
SET "configJson" = '{"requiredScopes":["https://www.googleapis.com/auth/gmail.modify"],"oauthConfig":{"socialProvider":"google","scopes":["https://www.googleapis.com/auth/gmail.modify"],"statusEndpoint":"/api/integrations/gmail/status","syncEndpoint":"/api/integrations/gmail/sync"},"setupUrl":"/mcp/gmail","setupLabel":"Open OAuth Setup"}'::jsonb
WHERE key = 'gmail';
```

---

## Related Documents

- **Full RCA**: `/workspace/RCA-google-calendar-scope-missing.md`
- **Executive Summary**: `/workspace/ISSUE-164-SUMMARY.md`
- **GitHub Issue**: https://github.com/Appello-Prototypes/agentc2/issues/164
- **Related RCA**: `/workspace/RCA-gmail-calendar-drive-connection-bug.md` (Issue #158 - different root cause)

---

## Contact

Questions or issues during implementation?
- Review full RCA for technical details
- Check Better Auth docs: https://better-auth.com/docs/concepts/oauth
- Test in local environment before deploying to production

---

**Last Updated**: 2026-03-12  
**Status**: Ready for implementation
