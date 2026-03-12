# Integration OAuth Flow Diagrams

Visual representations of the Google integration OAuth flows for issue #159.

---

## 1. Current Broken Flow (Google Calendar/Drive)

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: Navigate to /mcp/providers/google-calendar        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ SetupWizard Component                                           │
│  - Loads provider: google-calendar                              │
│  - Detects: authType = "oauth", has oauthConfig                 │
│  - isNativeOAuth = true ✅                                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: Click "Continue" button                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ handleNextFromOverview()                                        │
│  - Checks: isNativeOAuth = true                                 │
│  - Calls: handleNativeOAuth() ✅                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ handleNativeOAuth()                                             │
│  - Calls Better Auth linkSocial({                               │
│      provider: "google",                                        │
│      scopes: ["...calendar.events"],                            │
│      callbackURL: "/mcp/providers/google-calendar?oauth_return=1"│
│    })                                                            │
│  - User redirected to Google OAuth consent screen               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: Grant permissions on Google consent screen         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Google OAuth Server                                             │
│  - Generates auth code                                          │
│  - Redirects to: /api/auth/callback/google?code=xxx&state=yyy  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Better Auth Callback Handler                                   │
│  - Exchanges code for tokens ✅                                 │
│  - Stores in Account table:                                     │
│    * providerId: "google"                                       │
│    * accessToken: "ya29.xxx..." ✅                              │
│    * refreshToken: "1//xxx..." ✅                               │
│    * scope: "...calendar.events..." ✅                          │
│  - Checks: existing user with org membership                    │
│  - Post-bootstrap hooks NOT called (existing user) ✅           │
│  - Redirects to callbackURL                                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Browser navigates to:                                           │
│ /mcp/providers/google-calendar?oauth_return=1                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ SetupWizard useEffect (line 1102-1154)                          │
│  - Detects: oauth_return = "1" ✅                               │
│  - Gets oauthConfig for google-calendar:                        │
│    {                                                             │
│      socialProvider: "google",                                  │
│      scopes: ["...calendar.events"],                            │
│      siblingOf: "gmail"  ← Note: indicates shared OAuth         │
│      ❌ syncEndpoint: UNDEFINED                                  │
│      ❌ statusEndpoint: UNDEFINED                                │
│    }                                                             │
│  - Line 1108: if (!oauthCfg?.syncEndpoint) return; ← EXITS ❌   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ ❌ RESULT: SILENT FAILURE                                        │
│  - No IntegrationConnection created                             │
│  - No success message shown                                     │
│  - No error message shown                                       │
│  - User sees: page unchanged, integration still "disconnected"  │
│  - User tries again → same result                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Working Flow (Gmail)

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: Navigate to /mcp/gmail                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Custom Gmail Page (not SetupWizard)                            │
│  - Shows "Reconnect Gmail" button                               │
│  - Shows agent/Slack configuration form                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: Click "Reconnect Gmail"                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ handleReconnect()                                               │
│  - Calls linkSocial({                                           │
│      provider: "google",                                        │
│      scopes: [ALL_GOOGLE_SCOPES], ← Includes Gmail+Calendar+Drive│
│      callbackURL: "/mcp/gmail"                                  │
│    })                                                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
         [OAuth flow - same as above]
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Better Auth redirects to: /mcp/gmail (no oauth_return param!)  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Gmail Page Loads                                                │
│  - Note: Does NOT auto-trigger sync                             │
│  - User sees status: connected/not connected                    │
│  - (For NEW users: post-bootstrap hook already ran sync ✅)     │
│  - (For EXISTING users: sync not triggered automatically ❌)    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
    ┌───────────────────────┴─────────────────────────┐
    │                                                   │
    ▼                                                   ▼
┌───────────────────────────┐    ┌──────────────────────────────────┐
│ NEW USER:                 │    │ EXISTING USER:                   │
│ Post-bootstrap hook ran   │    │ Must trigger sync manually:      │
│ during OAuth callback ✅  │    │  - Different UI flow, OR         │
│                           │    │  - Admin calls sync API          │
│ Gmail sync ran:           │    │                                  │
│  - Gmail connection ✅    │    │ (User may not know how!)         │
│  - Calendar connection ✅ │    │                                  │
│  - Drive connection ✅    │    │                                  │
└───────────────────────────┘    └──────────────────────────────────┘
```

---

## 3. Fixed Flow (Option A - Recommended)

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: Navigate to /mcp/providers/google-calendar        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ SetupWizard Component                                           │
│  - Loads provider: google-calendar                              │
│  - Config NOW includes:                                         │
│    * syncEndpoint: "/api/integrations/google-calendar/sync" ✅  │
│    * statusEndpoint: "/api/integrations/google-calendar/status"✅│
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
         [OAuth flow - same as before]
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Better Auth redirects to:                                       │
│ /mcp/providers/google-calendar?oauth_return=1                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ SetupWizard useEffect (line 1102-1154)                          │
│  - Detects: oauth_return = "1" ✅                               │
│  - Gets oauthConfig:                                            │
│    {                                                             │
│      socialProvider: "google",                                  │
│      scopes: ["...calendar.events"],                            │
│      siblingOf: "gmail",                                        │
│      syncEndpoint: "/api/integrations/google-calendar/sync" ✅  │
│    }                                                             │
│  - Line 1108: syncEndpoint exists! ✅                           │
│  - Continues to call sync endpoint...                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ POST /api/integrations/google-calendar/sync                    │
│  - Calls syncGmailFromAccount(userId, orgId)                    │
│    └─> Reads Better Auth Account table ✅                       │
│    └─> Calls saveGmailCredentials() ✅                          │
│        └─> Creates/updates Gmail IntegrationConnection ✅       │
│    └─> Calls syncSiblingGoogleConnections() ✅                  │
│        └─> Checks Calendar scopes ✅                            │
│        └─> Creates Calendar IntegrationConnection ✅            │
│        └─> Creates Drive IntegrationConnection ✅               │
│        └─> Triggers auto-provisioning for each ✅               │
│  - Returns { success: true, connected: true }                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ SetupWizard Success Handler                                    │
│  - Receives sync response: success = true ✅                    │
│  - Sets step to "success" ✅                                    │
│  - Shows success screen with checkmark ✅                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ ✅ USER SEES: Success screen                                     │
│  - "Google Calendar Connected!" message                         │
│  - Tool count displayed                                         │
│  - "Back to Integrations" button                                │
│                                                                  │
│ ✅ DATABASE STATE:                                               │
│  - IntegrationConnection for gmail (created)                    │
│  - IntegrationConnection for google-calendar (created) ✅       │
│  - IntegrationConnection for google-drive (created)             │
│  - Skill for google-calendar (provisioned)                      │
│  - Agent for google-calendar (provisioned)                      │
│                                                                  │
│ ✅ TOOLS AVAILABLE:                                              │
│  - google-calendar-list-events                                  │
│  - google-calendar-create-event                                 │
│  - google-calendar-update-event                                 │
│  - google-calendar-delete-event                                 │
│  - ... and all other Calendar tools                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow Comparison

### Before Fix

```
Better Auth Account Table          IntegrationConnection Table
┌─────────────────────┐            ┌─────────────────────┐
│ providerId: google  │            │ (empty for Calendar)│
│ accessToken: ✅     │  ╳──╳──╳> │                     │
│ refreshToken: ✅    │  No sync   │ (empty for Drive)   │
│ scope: "...cal..."  │  endpoint  │                     │
│ expiresAt: ✅       │            │                     │
└─────────────────────┘            └─────────────────────┘
      Tokens stored                   Connections NOT created
      but unusable!                   Tools unavailable!
```

### After Fix

```
Better Auth Account Table          IntegrationConnection Table
┌─────────────────────┐            ┌─────────────────────────────┐
│ providerId: google  │            │ provider: gmail             │
│ accessToken: ✅     │───sync───> │ credentials: ✅ (encrypted) │
│ refreshToken: ✅    │ endpoint   │ isActive: true              │
│ scope: "...cal..."  │            ├─────────────────────────────┤
│ expiresAt: ✅       │            │ provider: google-calendar   │
└─────────────────────┘            │ credentials: ✅ (encrypted) │
                                   │ isActive: true              │
                                   ├─────────────────────────────┤
                                   │ provider: google-drive      │
                                   │ credentials: ✅ (encrypted) │
                                   │ isActive: true              │
                                   └─────────────────────────────┘
                                        All connections created!
                                        Tools available! ✅
```

---

## 3. Architecture Overview

### Current Architecture (Fragmented)

```
┌──────────────────────────────────────────────────────────────────┐
│                    INTEGRATIONS UI                               │
│                                                                  │
│  ┌────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   Gmail    │  │ Google Calendar │  │  Google Drive   │      │
│  │            │  │                 │  │                 │      │
│  │ [Connect]  │  │   [Connect]     │  │   [Connect]     │      │
│  └─────┬──────┘  └────────┬────────┘  └────────┬────────┘      │
│        │                  │                     │                │
└────────┼──────────────────┼─────────────────────┼────────────────┘
         │                  │                     │
         │                  │                     │
         ▼                  ▼                     ▼
    Works! ✅          Broken ❌            Broken ❌
    Has sync           No sync             No sync
    endpoint           endpoint            endpoint
         │                  │                     │
         ▼                  │                     │
   Creates all 3           │                     │
   connections ✅          │                     │
         │                  ▼                     ▼
         │          OAuth succeeds         OAuth succeeds
         │          but no connection      but no connection
         │          created ❌              created ❌
         │
         └──────> All share same Google OAuth tokens
```

### Intended Architecture (Unified)

```
┌──────────────────────────────────────────────────────────────────┐
│              GOOGLE WORKSPACE OAUTH                              │
│                                                                  │
│  Single OAuth consent grants access to all services:            │
│  ✓ Gmail                                                         │
│  ✓ Calendar                                                      │
│  ✓ Drive                                                         │
│  ✓ Search Console                                               │
│                                                                  │
│  All tokens stored in Better Auth Account table                 │
└────────────────────────────┬─────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
  │   Gmail     │   │   Calendar   │   │    Drive     │
  │   Sync      │   │   Sync       │   │    Sync      │
  │   Endpoint  │   │   Endpoint   │   │   Endpoint   │
  └──────┬──────┘   └──────┬───────┘   └──────┬───────┘
         │                 │                   │
         │                 │                   │
         └─────────────────┼───────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │ syncGmailFromAccount()  │
              │ (Shared sync logic)     │
              └────────────┬────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │ Creates connections for:│
              │  ✓ Gmail                │
              │  ✓ Calendar             │
              │  ✓ Drive                │
              │  ✓ Search Console       │
              └─────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │ Auto-provisions:        │
              │  ✓ Skills               │
              │  ✓ Agents               │
              │  ✓ Tools registered     │
              └─────────────────────────┘
```

---

## 4. Fix Implementation Map

### Files to Create

```
apps/agent/src/app/api/integrations/
├── google-calendar/
│   ├── sync/
│   │   └── route.ts          ← CREATE (delegates to Gmail sync)
│   └── status/
│       └── route.ts          ← CREATE (checks Calendar connection)
│
└── google-drive/
    ├── sync/
    │   └── route.ts          ← CREATE (delegates to Gmail sync)
    └── status/
        └── route.ts          ← CREATE (checks Drive connection)
```

### Files to Modify

```
packages/agentc2/src/mcp/client.ts
├── Line ~634: Add syncEndpoint to google-calendar config
└── Line ~658: Add syncEndpoint to google-drive config

apps/agent/src/components/integrations/SetupWizard.tsx (optional)
└── Line 1108: Add error message instead of silent return
```

---

## 5. Decision Matrix

| Approach | Pros | Cons | Effort | Risk |
|----------|------|------|--------|------|
| **Option A: Add Sync Endpoints** | ✅ Fixes bug directly<br>✅ Maintains current UX<br>✅ Low risk<br>✅ Reuses existing logic | ⚠️ Adds API routes<br>⚠️ Slight duplication | 2-3h | 🟢 Low |
| **Option B: Smart Sibling Detection** | ✅ No new routes<br>✅ Handles future siblings | ⚠️ More complex<br>⚠️ Changes core logic<br>⚠️ Race conditions | 3-5h | 🟡 Medium |
| **Option C: UI/UX Warnings** | ✅ Guides users<br>✅ Prevents issue | ❌ Doesn't fix bug<br>❌ Adds friction | 1-2h | 🟢 Low |
| **Option A + C: Combined** | ✅ Fixes bug<br>✅ Improves UX<br>✅ Future-proof | ⚠️ More testing | 3-4h | 🟢 Low |

**Recommendation:** Start with Option A, then add Option C in a follow-up PR.

---

**For complete technical details, see:** [`ROOT_CAUSE_ANALYSIS_GOOGLE_INTEGRATIONS.md`](./ROOT_CAUSE_ANALYSIS_GOOGLE_INTEGRATIONS.md)
