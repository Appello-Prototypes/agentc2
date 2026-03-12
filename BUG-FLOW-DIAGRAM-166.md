# Visual Flow Diagram: Issue #166 Bug and Fix

---

## The Bug: Circular Dependency

```
┌─────────────────────────────────────────────────────────────────┐
│                    INITIAL TRIGGER EVENT                         │
│  (Network timeout, NPM download delay, API rate limit, etc.)   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
          ┌───────────────────────┐
          │   Health Check Runs   │
          │  (Every 6 hours)      │
          └───────────┬───────────┘
                      │
                      ▼
          ┌───────────────────────────────────────────┐
          │  Calls listMcpToolDefinitions(orgId)      │
          │         ↓                                  │
          │  Calls getMcpTools(orgId)                 │
          │         ↓                                  │
          │  Calls getIntegrationConnections()        │
          └───────────┬───────────────────────────────┘
                      │
                      ▼
          ┌─────────────────────────────────────┐
          │  FILTER: if (conn.errorMessage)     │
          │           return false              │◄─────┐
          └───────────┬─────────────────────────┘      │
                      │                                │
            ┌─────────┴────────────┐                  │
            │                      │                  │
      ┌─────▼──────┐      ┌───────▼────────┐         │
      │ First Run  │      │ Subsequent Runs│         │
      │ No error   │      │ Has errorMsg   │         │
      └─────┬──────┘      └───────┬────────┘         │
            │                     │                   │
            │                     ▼                   │
            │           ┌──────────────────┐          │
            │           │ Connection       │          │
            │           │ FILTERED OUT     │          │
            │           └────────┬─────────┘          │
            │                    │                    │
            │                    ▼                    │
            │           ┌──────────────────┐          │
            │           │ Server not in    │          │
            │           │ test list        │          │
            │           └────────┬─────────┘          │
            ▼                    │                    │
    ┌──────────────┐            ▼                    │
    │ Server       │   ┌──────────────────┐          │
    │ Fails ───────┼──►│ No tools found   │          │
    └──────┬───────┘   │ hasTools = false │          │
           │           └────────┬─────────┘          │
           │                    │                    │
           ▼                    ▼                    │
    ┌──────────────────────────────────────┐        │
    │ Set errorMessage =                    │        │
    │   "Health check failed: ..."         │        │
    └──────────────────┬───────────────────┘        │
                       │                            │
                       ▼                            │
    ┌────────────────────────────────────────────┐  │
    │ errorMessage: hasTools ? null : conn.err   │  │
    │                         ↑                  │  │
    │              Preserves old error!          │  │
    └────────────────────┬───────────────────────┘  │
                         │                          │
                         └──────────────────────────┘
                              STUCK FOREVER
```

---

## The Fix: Break the Circular Dependency

```
┌─────────────────────────────────────────────────────────────────┐
│                    Health Check Runs                            │
│                   (Every 6 hours)                               │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
          ┌───────────────────────────────────────┐
          │  ✅ NEW: Clear errorMessage FIRST     │
          │                                        │
          │  await prisma.integrationConnection    │
          │    .updateMany({                       │
          │      where: { errorMessage: not null },│
          │      data: { errorMessage: null }      │
          │    })                                  │
          └───────────┬───────────────────────────┘
                      │
                      ▼
          ┌───────────────────────────────────────┐
          │  Calls listMcpToolDefinitions(orgId)  │
          │         ↓                              │
          │  Calls getMcpTools(orgId)             │
          │         ↓                              │
          │  Calls getIntegrationConnections()    │
          └───────────┬───────────────────────────┘
                      │
                      ▼
          ┌─────────────────────────────────────┐
          │  FILTER: if (conn.errorMessage)     │
          │           return false              │
          │                                     │
          │  ✅ No connections filtered!        │
          │  (errorMessage was just cleared)    │
          └───────────┬─────────────────────────┘
                      │
                      ▼
          ┌─────────────────────────────┐
          │  ALL Connections Included   │
          └───────────┬─────────────────┘
                      │
            ┌─────────┴────────────┐
            │                      │
      ┌─────▼──────┐      ┌───────▼────────┐
      │ Server     │      │ Server         │
      │ Works ✓    │      │ Fails ✗        │
      └─────┬──────┘      └───────┬────────┘
            │                     │
            ▼                     ▼
    ┌──────────────┐   ┌──────────────────┐
    │ errorMessage │   │ errorMessage =   │
    │ = null       │   │ "Fresh error"    │
    │              │   │                  │
    │ ✅ HEALTHY   │   │ ⚠️ UNHEALTHY     │
    └──────────────┘   └────────┬─────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │  Next health check   │
                    │  will clear and      │
                    │  re-test             │
                    │                      │
                    │  ✅ AUTO-RECOVERY    │
                    └──────────────────────┘
```

---

## Data Flow: Before vs After

### BEFORE FIX (Broken)

```
Agent Resolution Request
    │
    ├──► getToolsByNamesAsync(["hubspot_search-objects", ...], orgId)
    │         │
    │         └──► getMcpToolsCached(orgId)
    │                   │
    │                   └──► getMcpTools(orgId)
    │                             │
    │                             └──► getIntegrationConnections(orgId)
    │                                       │
    │                                       ├─► Load from DB: isActive=true, errorMessage="Health check failed: timeout"
    │                                       │
    │                                       └─► FILTER: if (errorMessage) return false  ❌
    │                                                   │
    │                                                   └──► HubSpot connection EXCLUDED
    │                                                             │
    │         ┌─────────────────────────────────────────────────┘
    │         │
    │         └─► buildServerConfigs(connections=[/* no hubspot */])
    │                   │
    │                   └─► loadToolsPerServer(servers={/* no hubspot */})
    │                             │
    │                             └─► tools = {/* empty */}
    │
    └──► result = {/* no hubspot tools */}
              │
              └──► Agent instructions += "HubSpot tools unavailable"
                        │
                        └──► User sees: "Sorry, HubSpot integration is temporarily down"
```

### AFTER FIX (Working)

```
Health Check (Every 6 hours)
    │
    ├──► ✅ NEW: Clear errorMessage on all connections
    │         │
    │         └─► UPDATE IntegrationConnection SET errorMessage=NULL WHERE errorMessage IS NOT NULL
    │
    └──► listMcpToolDefinitions(orgId)
              │
              └──► getMcpTools(orgId)
                        │
                        └──► getIntegrationConnections(orgId)
                                  │
                                  ├─► Load from DB: isActive=true, errorMessage=NULL
                                  │
                                  └─► FILTER: if (errorMessage) return false  ✅ FALSE
                                            │
                                            └──► HubSpot connection INCLUDED
                                                      │
                                                      └─► buildServerConfigs(connections=[hubspot, jira, slack, ...])
                                                                │
                                                                └─► loadToolsPerServer(servers={hubspot, jira, slack, ...})
                                                                          │
                                                                          ├─► ✅ HubSpot loads successfully
                                                                          │        │
                                                                          │        └─► errorMessage = NULL (cleared)
                                                                          │
                                                                          └─► ❌ Jira times out
                                                                                   │
                                                                                   └─► errorMessage = "Fresh timeout error"
                                                                                            │
                                                                                            └─► Next cycle will retry!

Agent Resolution Request (after health check)
    │
    ├──► getToolsByNamesAsync(["hubspot_search-objects", ...], orgId)
    │         │
    │         └──► getMcpTools(orgId) [from cache or fresh load]
    │                   │
    │                   └─► tools = {hubspot_search-objects, hubspot_batch-read-objects, ...}
    │
    └──► result = {hubspot_search-objects: {...}, hubspot_batch-read-objects: {...}, ...}
              │
              └──► Agent instructions = normal (no "unavailable" notice)
                        │
                        └──► User gets: Successful HubSpot search results
```

---

## State Transition Diagram

### Connection Lifecycle

```
┌─────────────┐
│   CREATED   │
│ errorMsg=∅  │
└──────┬──────┘
       │
       │ Health check #1
       ▼
┌─────────────┐         ┌──────────────┐
│   HEALTHY   │────────►│  TRANSIENT   │
│ errorMsg=∅  │ Fails   │   FAILURE    │
└──────┬──────┘         │ errorMsg=set │
       │                └──────┬───────┘
       │ Stays healthy        │
       │                      │
       ▼                      ▼
┌─────────────┐         ┌──────────────┐
│   HEALTHY   │         │   FILTERED   │ ◄──┐
│ errorMsg=∅  │         │ (BEFORE FIX) │    │
└─────────────┘         │ errorMsg=set │    │
                        └──────┬───────┘    │
                               │            │
                               │ Next check │
                               │ (filtered) │
                               │            │
                               └────────────┘
                              STUCK FOREVER


With Fix:

┌─────────────┐
│   CREATED   │
│ errorMsg=∅  │
└──────┬──────┘
       │
       │ Health check
       ▼
┌─────────────┐         ┌──────────────┐
│   HEALTHY   │────────►│  TRANSIENT   │
│ errorMsg=∅  │ Fails   │   FAILURE    │
└──────┬──────┘         │ errorMsg=set │
       │                └──────┬───────┘
       │                       │
       │                       │ ✅ Next check
       │                       │ CLEARS error first
       │                       │
       │                ┌──────▼───────┐
       │                │   RETRYING   │
       │                │ errorMsg=∅   │
       │                └──────┬───────┘
       │                       │
       │               ┌───────┴────────┐
       │               │                │
       │         ┌─────▼──────┐   ┌────▼──────┐
       │         │   Works    │   │   Fails   │
       │         └─────┬──────┘   │   again   │
       │               │          └────┬──────┘
       │               │               │
       │               ▼               ▼
       │         ┌──────────┐    ┌──────────┐
       └────────►│ HEALTHY  │    │ PERSISTENT│
                 │errorMsg=∅│    │  FAILURE  │
                 └──────────┘    │errorMsg=  │
                                 │ "Fresh err│
                                 └─────┬─────┘
                                       │
                                       │ Retry every
                                       │ 6 hours
                                       │
                                       └───────┐
                                              │
                                       ┌──────▼─────┐
                                       │  RETRYING  │
                                       │ (cleared)  │
                                       └────────────┘
                                    AUTO-RECOVERY ENABLED
```

---

## Code Execution Flow

### BEFORE FIX: How Tools Fail to Load

```
User Request
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ agentResolver.resolve({ slug: "demo-prep-agent" })      │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ hydrate(record, context, threadId)                      │
│   │                                                      │
│   ├─► getToolsByNamesAsync(                             │
│   │      ["hubspot_hubspot-search-objects", ...],       │
│   │      organizationId                                 │
│   │   )                                                 │
│   │    │                                                │
│   │    └─► getMcpToolsCached(organizationId)           │
│   │         │                                           │
│   │         └─► getMcpTools(organizationId)            │
│   │              │                                      │
│   │              └─► getIntegrationConnections({       │
│   │                      organizationId                │
│   │                  })                                │
│   │                   │                                │
│   │                   └─► allConnections.filter(conn =>│
│   │                          !conn.errorMessage)       │
│   │                          ↓                         │
│   │                      ❌ HubSpot filtered out       │
│   │                          ↓                         │
│   │                      buildServerConfigs([])        │
│   │                          ↓                         │
│   │                      loadToolsPerServer({})        │
│   │                          ↓                         │
│   │                      tools = {} (empty)            │
│   │                                                    │
│   └─► tools = {} (no HubSpot tools loaded)            │
│                                                        │
│   expectedToolNames = ["hubspot_hubspot-search-...",  │
│                        "hubspot_hubspot-batch-...",   │
│                        ...]                            │
│   loadedToolNames = []                                │
│                                                        │
│   missingTools = ["hubspot_...", "hubspot_...", ...]  │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ finalInstructions += "Tool Availability Notice:         │
│   HubSpot tools unavailable (MCP server may be down)"   │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ Agent Response to User:                                  │
│ "I'm unable to search HubSpot right now as the          │
│  integration is temporarily unavailable."                │
└─────────────────────────────────────────────────────────┘
```

### AFTER FIX: How Tools Successfully Load

```
Health Check (6-hour cron)
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ integrationHealthCheckFunction()                        │
│   │                                                      │
│   ├─► ✅ prisma.integrationConnection.updateMany({      │
│   │       where: { errorMessage: not null },            │
│   │       data: { errorMessage: null }                  │
│   │    })                                               │
│   │    // HubSpot connection: errorMessage NULL ✓       │
│   │                                                      │
│   └─► listMcpToolDefinitions(orgId)                     │
│        │                                                 │
│        └─► getMcpTools(orgId)                           │
│             │                                            │
│             └─► getIntegrationConnections(orgId)        │
│                  │                                       │
│                  └─► allConnections.filter(conn =>      │
│                         !conn.errorMessage)             │
│                         ↓                               │
│                     ✅ HubSpot included (error cleared) │
│                         ↓                               │
│                     buildServerConfigs([hubspot, ...])  │
│                         ↓                               │
│                     loadToolsPerServer({hubspot, ...})  │
│                         ↓                               │
│                     ┌───────────┬──────────┐            │
│                     │           │          │            │
│                     ▼           ▼          ▼            │
│                 ✅ Success  ✅ Success  ❌ Fails        │
│                 hubspot     jira        firecrawl       │
│                     │           │          │            │
│                     └───────────┴──────────┘            │
│                             │                           │
│                             ▼                           │
│                     tools = {                           │
│                       hubspot_search-objects: {...},    │
│                       hubspot_batch-read-objects: {...},│
│                       jira_search-issues: {...},        │
│                       ...                               │
│                     }                                   │
│                     serverErrors = {                    │
│                       firecrawl: "timeout"              │
│                     }                                   │
│                                                         │
│   ├─► Update connections:                              │
│   │    • hubspot: errorMessage = null ✓                │
│   │    • jira: errorMessage = null ✓                   │
│   │    • firecrawl: errorMessage = "timeout" (fresh)   │
│   │                                                     │
│   └─► ✅ invalidateMcpCacheForOrg(orgId)               │
│        // Cache cleared, next agent run sees new tools │
└─────────────────────────────────────────────────────────┘

User Request (minutes later)
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ agentResolver.resolve({ slug: "demo-prep-agent" })      │
│   │                                                      │
│   └─► getToolsByNamesAsync(                             │
│          ["hubspot_hubspot-search-objects", ...],       │
│          organizationId                                 │
│      )                                                  │
│       │                                                 │
│       └─► getMcpToolsCached(organizationId)            │
│            │                                            │
│            └─► Cache miss (just invalidated)           │
│                 │                                       │
│                 └─► getMcpTools(organizationId)        │
│                      │                                  │
│                      └─► getIntegrationConnections()   │
│                           │                             │
│                           └─► ✅ HubSpot included       │
│                                  (errorMessage = null)  │
│                                  │                      │
│                                  └─► tools loaded ✓     │
│                                                         │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ Agent Response to User:                                  │
│ "I found 3 contacts in HubSpot matching 'John':         │
│  1. John Smith - john@example.com                       │
│  2. John Doe - jdoe@company.com                         │
│  3. John Lee - jlee@startup.io"                         │
│                                                          │
│ ✅ SUCCESS                                               │
└─────────────────────────────────────────────────────────┘
```

---

## Timeline Comparison

### Scenario: HubSpot has transient timeout

#### BEFORE FIX

| Time | Event | State |
|------|-------|-------|
| T+0h | Health check runs, HubSpot times out | `errorMessage = "timeout"` |
| T+1h | User runs agent | ❌ "Tools unavailable" |
| T+6h | Health check runs | HubSpot filtered out, error preserved |
| T+7h | User runs agent | ❌ "Tools unavailable" |
| T+12h | Health check runs | HubSpot filtered out, error preserved |
| T+13h | User runs agent | ❌ "Tools unavailable" |
| T+24h | User manually tests | ✅ Error clears, tools work |
| T+25h | User runs agent | ✅ Works (temporarily) |
| T+30h | Health check runs, transient failure | `errorMessage = "timeout"` again |
| T+31h | User runs agent | ❌ "Tools unavailable" |
| **FOREVER** | **Stuck in cycle** | **Manual intervention required** |

#### AFTER FIX

| Time | Event | State |
|------|-------|-------|
| T+0h | Health check runs, HubSpot times out | `errorMessage = "timeout"` |
| T+1h | User runs agent | ❌ "Tools unavailable" |
| T+6h | Health check runs | ✅ Error cleared, re-tested, succeeds |
| T+6h | Health check completes | `errorMessage = null` |
| T+7h | User runs agent | ✅ Works! Tools loaded |
| T+12h | Health check runs, all healthy | `errorMessage = null` |
| T+18h | Health check runs, all healthy | `errorMessage = null` |
| **STABLE** | **Auto-recovered** | **No intervention needed** |

---

## The Fix in Visual Form

### Current Code (Buggy)

```typescript
// apps/agent/src/lib/inngest-functions.ts:8294
await step.run(`health-check-org-${orgId}`, async () => {
    const { listMcpToolDefinitions } = await import("@repo/agentc2");
    
    try {
        const { definitions, serverErrors } = await listMcpToolDefinitions(orgId);
        // ↑ Internally filters connections by errorMessage ❌
        
        for (const conn of orgConnections) {
            // ...
            errorMessage: hasTools ? null : conn.errorMessage,  // ❌ Preserves stale error
        }
    }
});
```

### Fixed Code

```typescript
// apps/agent/src/lib/inngest-functions.ts:8294
await step.run(`health-check-org-${orgId}`, async () => {
    // ✅ ADDED: Clear errors first
    const connectionsToCheck = orgConnections.filter(c => c.errorMessage !== null);
    if (connectionsToCheck.length > 0) {
        await prisma.integrationConnection.updateMany({
            where: { id: { in: connectionsToCheck.map(c => c.id) } },
            data: { errorMessage: null }
        });
    }
    
    const { listMcpToolDefinitions } = await import("@repo/agentc2");
    
    try {
        const { definitions, serverErrors } = await listMcpToolDefinitions(orgId);
        // ↑ Now includes all connections ✓
        
        for (const conn of orgConnections) {
            // ...
            errorMessage: null,  // ✅ FIXED: Always clear when no server error
        }
        
        // ✅ ADDED: Invalidate cache
        const { invalidateMcpCacheForOrg } = await import("@repo/agentc2/mcp");
        invalidateMcpCacheForOrg(orgId);
    }
});
```

---

## Impact Visualization

### Affected Systems

```
                    getIntegrationConnections()
                      (filters by errorMessage)
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   Agent      │  │    Skill     │  │ Integration  │
    │  Resolution  │  │Tool Loading  │  │ Provisioning │
    │              │  │              │  │              │
    │ ❌ Broken    │  │ ❌ Broken    │  │ ❌ Broken    │
    └──────────────┘  └──────────────┘  └──────────────┘
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │    Tool      │  │   Health     │  │  Any Code    │
    │ Rediscovery  │  │   Checks     │  │ Using MCP    │
    │              │  │              │  │    Tools     │
    │ ❌ Broken    │  │ ❌ Broken    │  │ ❌ Broken    │
    └──────────────┘  └──────────────┘  └──────────────┘
                              │
                              └─► CIRCULAR DEPENDENCY
                                       │
                                       └─► STUCK FOREVER


AFTER FIX:

                    Health Check Clears Errors First
                              │
                              ▼
                    getIntegrationConnections()
                      (no connections filtered)
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   Agent      │  │    Skill     │  │ Integration  │
    │  Resolution  │  │Tool Loading  │  │ Provisioning │
    │              │  │              │  │              │
    │ ✅ WORKING   │  │ ✅ WORKING   │  │ ✅ WORKING   │
    └──────────────┘  └──────────────┘  └──────────────┘
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │    Tool      │  │   Health     │  │  Any Code    │
    │ Rediscovery  │  │   Checks     │  │ Using MCP    │
    │              │  │              │  │    Tools     │
    │ ✅ WORKING   │  │ ✅ WORKING   │  │ ✅ WORKING   │
    └──────────────┘  └──────────────┘  └──────────────┘
                              │
                              └─► LINEAR FLOW
                                       │
                                       └─► AUTO-RECOVERY
```

---

## MCP Providers Affected

All MCP providers are affected by this bug:

```
┌───────────────────────────────────────────────────────┐
│                   MCP PROVIDERS                       │
├───────────────┬───────────────────────┬───────────────┤
│   Category    │      Provider         │  Tools Count  │
├───────────────┼───────────────────────┼───────────────┤
│ CRM           │ HubSpot               │     15+       │
│ Productivity  │ Jira                  │     12+       │
│ Communication │ Slack                 │     18+       │
│ Code          │ GitHub                │     25+       │
│ Web           │ Firecrawl             │      8+       │
│ Communication │ JustCall              │      6+       │
│ Web           │ Playwright            │     12+       │
│ Knowledge     │ Fathom                │      5+       │
│ Automation    │ ATLAS (n8n)           │   Dynamic     │
│ Custom        │ Any custom MCP        │   Variable    │
└───────────────┴───────────────────────┴───────────────┘
              ALL AFFECTED BY THIS BUG
```

---

## Change Impact Matrix

| Code Path | Before Fix | After Fix | Recovery Time |
|-----------|------------|-----------|---------------|
| Agent tool loading | ❌ Fails | ✅ Works | Immediate (cache invalidation) |
| Skill tool loading | ❌ Fails | ✅ Works | Immediate (cache invalidation) |
| Health checks | ❌ Can't recover | ✅ Auto-recovers | Next cycle (6h) |
| Provisioning | ❌ Fails | ✅ Works | Immediate |
| Tool rediscovery | ❌ Skips | ✅ Works | Next cycle (daily) |
| Manual test | ✅ Temporary fix | ✅ Works | Immediate |
| UI display | ⚠️ Misleading | ✅ Accurate | Next refresh |

---

## Complexity Comparison

### Option 1: This Fix (Recommended)
```
┌─────────────────────────────────────────┐
│ Clear error → Test → Set result         │
│                                          │
│ Complexity:  ★☆☆☆☆ (Very Low)          │
│ Risk:        ★☆☆☆☆ (Very Low)          │
│ Effort:      ★☆☆☆☆ (30 minutes)        │
│ Impact:      ★★★★★ (Fixes everything)  │
└─────────────────────────────────────────┘
```

### Option 2: Remove Filter (Higher Risk)
```
┌─────────────────────────────────────────┐
│ Remove errorMessage filter entirely     │
│                                          │
│ Complexity:  ★☆☆☆☆ (Very Low)          │
│ Risk:        ★★★☆☆ (Medium)            │
│ Effort:      ★☆☆☆☆ (15 minutes)        │
│ Impact:      ★★★★★ (Fixes + simplifies)│
└─────────────────────────────────────────┘
```

### Option 3: Exponential Backoff (Future)
```
┌─────────────────────────────────────────┐
│ Skip failed connections with backoff    │
│                                          │
│ Complexity:  ★★★☆☆ (Medium)            │
│ Risk:        ★★☆☆☆ (Low-Medium)        │
│ Effort:      ★★★☆☆ (4 hours)           │
│ Impact:      ★★★☆☆ (Reduces noise)     │
└─────────────────────────────────────────┘
```

**Recommendation**: Option 1 (this fix) for immediate resolution. Consider Option 2 or 3 in future PRs.

---

## Key Takeaways

### For Engineers
1. **Pattern**: Always clear error state before retry operations
2. **Anti-pattern**: Filtering by error state in retry logic creates circular dependencies
3. **Lesson**: The manual test route had it right; health check should match

### For Architects
1. **Design Principle**: Error state must have recovery paths
2. **Resilience Pattern**: Transient failures should auto-recover, not require manual intervention
3. **Observability**: Error states that persist > 6 hours indicate circular dependency bugs

### For Product
1. **User Impact**: Silent degradation (UI says "connected", runtime fails)
2. **Severity**: Affects all customers using MCP integrations
3. **Workaround**: Manual test button (temporary, resets every 6h)
4. **Fix Urgency**: High (permanent unavailability is worse than transient failures)

---

## Next Steps

1. **Review** this diagram document for visual understanding
2. **Read** `RCA-SUMMARY-hubspot-tools-unavailability.md` for executive summary
3. **Follow** `IMPLEMENTATION-CHECKLIST-166.md` for implementation
4. **Use** `QUERIES-166.sql` for validation
5. **Deploy** and monitor for 24 hours
6. **Close** issue #166

---

**Diagram Created**: 2026-03-12  
**Status**: Complete visual reference for Issue #166
