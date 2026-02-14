/**
 * Integrations Module
 *
 * MCP OAuth2.1 client flow, auto-provisioning engine, and integration blueprints.
 */

// MCP OAuth2.1 client flow
export {
    discoverAuthServer,
    buildMcpAuthorizationUrl,
    exchangeMcpCodeForTokens,
    refreshMcpAccessToken,
    tokenNeedsRefresh,
    tokenIsExpired,
    generateCodeVerifier,
    generateCodeChallenge,
    type McpAuthServerMetadata,
    type McpOAuthTokens,
    type McpOAuthStartResult
} from "./mcp-oauth";

// Auto-provisioning engine
export { provisionIntegration } from "./provisioner";

// Lifecycle management
export {
    deprovisionIntegration,
    syncBlueprintVersions,
    rediscoverToolsForConnection
} from "./provisioner";
export type { DeprovisionResult, BlueprintSyncResult, ToolRediscoveryResult } from "./provisioner";

// Blueprint registry
export { getBlueprint, getAllBlueprints, hasBlueprint, getBlueprintCount } from "./blueprints";
export type { IntegrationBlueprint, ProvisionResult } from "./blueprints/types";
