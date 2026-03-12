-- Root Cause Analysis Queries: Issue #166
-- HubSpot MCP Tools Unavailability
-- Run these queries to diagnose and monitor the bug

-- ============================================================================
-- DIAGNOSTIC QUERIES (Run before and after fix)
-- ============================================================================

-- Query 1: Find all connections currently in error state
-- Expected BEFORE fix: Multiple rows with stale errors
-- Expected AFTER fix: Zero rows with errors > 7 hours old
SELECT 
    ic.id,
    ic.name,
    ip.key as provider,
    ip.name as provider_name,
    ic."organizationId",
    ic."errorMessage",
    ic."lastTestedAt",
    ic."updatedAt",
    EXTRACT(EPOCH FROM (NOW() - ic."updatedAt"))/3600 as hours_in_error,
    (ic.metadata->>'healthStatus')::text as health_status,
    (ic.metadata->>'lastHealthCheck')::text as last_health_check
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
WHERE ic."isActive" = true 
  AND ic."errorMessage" IS NOT NULL
ORDER BY ic."updatedAt" ASC;

-- Query 2: Count connections by error state
-- Expected AFTER fix: error_count should decrease to near-zero
SELECT 
    ip.key as provider,
    COUNT(*) as connection_count,
    SUM(CASE WHEN ic."errorMessage" IS NOT NULL THEN 1 ELSE 0 END) as error_count,
    ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - ic."updatedAt"))/3600)::numeric, 1) as avg_hours_since_update,
    MAX((ic.metadata->>'healthStatus')::text) as latest_health_status
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
WHERE ic."isActive" = true
  AND ip."providerType" = 'mcp'
GROUP BY ip.key
ORDER BY error_count DESC, provider;

-- Query 3: Find the specific reported connection
-- HubSpot Connection ID: cmlfge60b007n8erhsakptjvi
SELECT 
    ic.id,
    ic.name,
    ip.key as provider,
    ic."errorMessage",
    ic."lastTestedAt",
    ic."updatedAt",
    ic.metadata,
    ic.credentials IS NOT NULL as has_credentials
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
WHERE ic.id = 'cmlfge60b007n8erhsakptjvi';

-- Query 4: Find agents affected by missing HubSpot tools
-- These agents have HubSpot tools attached but can't load them
SELECT 
    a.id,
    a.slug,
    a.name,
    a."workspaceId",
    w."organizationId",
    COUNT(at."toolId") as hubspot_tool_count,
    array_agg(at."toolId") as hubspot_tools
FROM "Agent" a
JOIN "AgentTool" at ON a.id = at."agentId"
JOIN "Workspace" w ON a."workspaceId" = w.id
WHERE at."toolId" LIKE 'hubspot_%'
  AND a."isActive" = true
GROUP BY a.id, a.slug, a.name, a."workspaceId", w."organizationId"
ORDER BY hubspot_tool_count DESC;

-- Query 5: Find skills affected by missing HubSpot tools
SELECT 
    s.id,
    s.slug,
    s.name,
    s."workspaceId",
    w."organizationId",
    COUNT(st."toolId") as hubspot_tool_count,
    array_agg(st."toolId") as hubspot_tools
FROM "Skill" s
JOIN "SkillTool" st ON s.id = st."skillId"
JOIN "Workspace" w ON s."workspaceId" = w.id
WHERE st."toolId" LIKE 'hubspot_%'
  AND s."isActive" = true
GROUP BY s.id, s.slug, s.name, s."workspaceId", w."organizationId"
ORDER BY hubspot_tool_count DESC;

-- ============================================================================
-- VALIDATION QUERIES (Run after fix is deployed)
-- ============================================================================

-- Query 6: Verify errors are being cleared by health checks
-- Run this AFTER one health check cycle (6 hours)
-- Expected: 0 rows (or only connections with fresh errors < 1 hour old)
SELECT 
    ic.id,
    ic.name,
    ip.key as provider,
    ic."errorMessage",
    ic."updatedAt",
    EXTRACT(EPOCH FROM (NOW() - ic."updatedAt"))/60 as minutes_since_update,
    (ic.metadata->>'lastHealthCheck')::text as last_health_check
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
WHERE ic."isActive" = true 
  AND ic."errorMessage" IS NOT NULL
  AND ic."updatedAt" < NOW() - INTERVAL '7 hours'
ORDER BY ic."updatedAt" ASC;

-- Query 7: Check health check execution history
-- Look for "lastHealthCheck" timestamps updating
SELECT 
    ip.key as provider,
    COUNT(*) as connection_count,
    MAX((ic.metadata->>'lastHealthCheck')::text) as most_recent_check,
    EXTRACT(EPOCH FROM (NOW() - MAX((ic.metadata->>'lastHealthCheck')::timestamp)))/60 as minutes_since_last_check,
    SUM(CASE WHEN (ic.metadata->>'healthStatus')::text = 'healthy' THEN 1 ELSE 0 END) as healthy_count,
    SUM(CASE WHEN (ic.metadata->>'healthStatus')::text = 'unhealthy' THEN 1 ELSE 0 END) as unhealthy_count,
    SUM(CASE WHEN ic."errorMessage" IS NOT NULL THEN 1 ELSE 0 END) as error_count
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
WHERE ic."isActive" = true
  AND ip."providerType" = 'mcp'
GROUP BY ip.key
ORDER BY most_recent_check DESC;

-- Query 8: Agent tool health metrics
-- Check if agents are successfully resolving their tools
SELECT 
    a.slug,
    a.name,
    COUNT(at."toolId") as total_tools,
    COUNT(CASE WHEN at."toolId" LIKE '%\_%' THEN 1 END) as mcp_tool_count,
    array_agg(DISTINCT SUBSTRING(at."toolId", 1, POSITION('_' IN at."toolId"))) 
        FILTER (WHERE at."toolId" LIKE '%\_%') as mcp_providers_used
FROM "Agent" a
JOIN "AgentTool" at ON a.id = at."agentId"
WHERE a."isActive" = true
  AND a.slug = 'demo-prep-agent-appello'
GROUP BY a.slug, a.name;

-- ============================================================================
-- MONITORING QUERIES (Run periodically after fix)
-- ============================================================================

-- Query 9: Error rate over time (daily aggregation)
-- Run daily to monitor error trends
SELECT 
    DATE_TRUNC('day', ic."updatedAt") as error_date,
    ip.key as provider,
    COUNT(*) as error_events,
    COUNT(DISTINCT ic.id) as unique_connections,
    array_agg(DISTINCT SUBSTRING(ic."errorMessage", 1, 50)) as error_types
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
WHERE ic."updatedAt" > NOW() - INTERVAL '7 days'
  AND ic."errorMessage" IS NOT NULL
GROUP BY DATE_TRUNC('day', ic."updatedAt"), ip.key
ORDER BY error_date DESC, error_events DESC;

-- Query 10: Connection health dashboard
-- Overall health snapshot for all MCP providers
SELECT 
    ip.key as provider,
    ip.name,
    COUNT(ic.id) as total_connections,
    SUM(CASE WHEN ic."errorMessage" IS NULL THEN 1 ELSE 0 END) as healthy_count,
    SUM(CASE WHEN ic."errorMessage" IS NOT NULL THEN 1 ELSE 0 END) as error_count,
    ROUND(
        100.0 * SUM(CASE WHEN ic."errorMessage" IS NULL THEN 1 ELSE 0 END) / COUNT(ic.id), 
        1
    ) as health_percentage,
    MAX((ic.metadata->>'lastHealthCheck')::text) as most_recent_check
FROM "IntegrationProvider" ip
LEFT JOIN "IntegrationConnection" ic ON ip.id = ic."providerId" AND ic."isActive" = true
WHERE ip."providerType" = 'mcp'
  AND ip."isActive" = true
GROUP BY ip.key, ip.name
ORDER BY error_count DESC, provider;

-- ============================================================================
-- CLEANUP QUERIES (Use with caution)
-- ============================================================================

-- Query 11: Manual error clearing (if rollback is needed)
-- CAUTION: This bypasses the health check. Only use in emergencies.
UPDATE "IntegrationConnection"
SET 
    "errorMessage" = NULL,
    metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{manualRecovery}',
        to_jsonb(NOW()::text)
    )
WHERE "isActive" = true 
  AND "errorMessage" IS NOT NULL;
-- Returns: Number of rows updated

-- Query 12: Clear specific connection error
-- Use for targeted recovery (e.g., the reported HubSpot connection)
UPDATE "IntegrationConnection"
SET 
    "errorMessage" = NULL,
    metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{manualRecovery}',
        to_jsonb(NOW()::text)
    )
WHERE id = 'cmlfge60b007n8erhsakptjvi';

-- ============================================================================
-- AUDIT QUERIES (Historical analysis)
-- ============================================================================

-- Query 13: Find activity log entries for integration alerts
-- Shows when connections first failed
SELECT 
    type,
    "agentSlug",
    summary,
    detail,
    status,
    source,
    metadata,
    "timestamp"
FROM "Activity"
WHERE source = 'integration-health'
  OR summary LIKE '%Integration unhealthy%'
  OR detail LIKE '%Health check failed%'
ORDER BY "timestamp" DESC
LIMIT 50;

-- Query 14: Recent agent runs with tool health warnings
-- Shows which agents are affected by missing tools
SELECT 
    r.id,
    r."agentId",
    a.slug as agent_slug,
    r.status,
    r."createdAt",
    r.metadata->'toolHealth' as tool_health,
    r.metadata->'missingTools' as missing_tools
FROM "Run" r
JOIN "Agent" a ON r."agentId" = a.id
WHERE r.metadata->'toolHealth' IS NOT NULL
  AND r.metadata->'toolHealth'->>'missingTools' IS NOT NULL
  AND r."createdAt" > NOW() - INTERVAL '24 hours'
ORDER BY r."createdAt" DESC
LIMIT 20;

-- ============================================================================
-- PERFORMANCE QUERIES
-- ============================================================================

-- Query 15: Health check performance metrics
-- Monitor execution time and failure rates
SELECT 
    DATE_TRUNC('hour', "timestamp") as check_hour,
    COUNT(*) as check_count,
    AVG(CAST(metadata->>'healthy' AS INTEGER)) as avg_healthy,
    AVG(CAST(metadata->>'unhealthy' AS INTEGER)) as avg_unhealthy,
    MAX(metadata->>'checked') as max_checked
FROM "Activity"
WHERE source = 'integration-health-check'
  AND "timestamp" > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', "timestamp")
ORDER BY check_hour DESC;

-- ============================================================================
-- DEVELOPER NOTES
-- ============================================================================

/*

IMPORTANT: These queries are safe to run in production (all are SELECT or 
targeted UPDATE). However, Query 11 (bulk error clearing) should only be 
used if rollback is necessary.

CACHE INVALIDATION: After manually clearing errors via SQL, invalidate the
MCP cache via API or Node.js console:

```typescript
import { invalidateMcpCacheForOrg } from "@repo/agentc2/mcp";
await invalidateMcpCacheForOrg("org-id-here");
```

Or wait 60 seconds for cache TTL to expire naturally.

TESTING IN DEV: To simulate the bug locally, set errorMessage on a connection
and try to resolve an agent. The agent should show "tools unavailable" notice.
After applying the fix and triggering a health check, the error should clear.

*/
