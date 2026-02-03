/**
 * MCP API Clients
 *
 * Direct API implementations for MCP integrations that work in serverless environments.
 * These clients provide the same functionality as MCP servers but use direct HTTP calls.
 */

export { HubSpotApiClient, hubspotApiClient } from "./hubspot";
export { FirecrawlApiClient, firecrawlApiClient } from "./firecrawl";
export { JiraApiClient, jiraApiClient } from "./jira";
export { AtlasApiClient, atlasApiClient } from "./atlas";
export { PlaywrightApiClient, playwrightApiClient } from "./playwright";

import { hubspotApiClient } from "./hubspot";
import { firecrawlApiClient } from "./firecrawl";
import { jiraApiClient } from "./jira";
import { atlasApiClient } from "./atlas";
import { playwrightApiClient } from "./playwright";
import type { McpApiClient } from "../types";

/**
 * Registry of all API clients by server ID
 */
export const apiClientRegistry: Record<string, McpApiClient> = {
    hubspot: hubspotApiClient,
    firecrawl: firecrawlApiClient,
    jira: jiraApiClient,
    atlas: atlasApiClient,
    playwright: playwrightApiClient
};

/**
 * Get an API client by server ID
 */
export function getApiClient(serverId: string): McpApiClient | undefined {
    return apiClientRegistry[serverId];
}

/**
 * Get all configured API clients
 */
export function getConfiguredApiClients(): McpApiClient[] {
    return Object.values(apiClientRegistry).filter((client) => client.isConfigured());
}

/**
 * Check if an API client exists for a server
 */
export function hasApiClient(serverId: string): boolean {
    return serverId in apiClientRegistry;
}
