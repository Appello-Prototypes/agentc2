/**
 * HubSpot Direct API Client
 *
 * Provides direct API access to HubSpot when MCP stdio transport is unavailable.
 * Mirrors the functionality of @hubspot/mcp-server.
 */

import type {
    McpApiClient,
    ToolExecutionContext,
    ToolResult,
    UnifiedToolDefinition
} from "../types";

const HUBSPOT_API_BASE = "https://api.hubapi.com";

/**
 * HubSpot API Client for serverless environments
 */
export class HubSpotApiClient implements McpApiClient {
    serverId = "hubspot";
    private accessToken: string | undefined;

    constructor() {
        this.accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
    }

    isConfigured(): boolean {
        return !!this.accessToken;
    }

    private async apiRequest(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<{ success: boolean; data?: unknown; error?: string }> {
        if (!this.accessToken) {
            return { success: false, error: "HUBSPOT_ACCESS_TOKEN not configured" };
        }

        try {
            const response = await fetch(`${HUBSPOT_API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    "Content-Type": "application/json",
                    ...options.headers
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    error: `HubSpot API error ${response.status}: ${errorText}`
                };
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async listTools(): Promise<UnifiedToolDefinition[]> {
        return [
            {
                name: "hubspot-get-contacts",
                description: "Get a list of contacts from HubSpot CRM",
                serverId: this.serverId,
                parameters: {
                    limit: { type: "number", description: "Maximum number of contacts to return" },
                    after: { type: "string", description: "Pagination cursor" }
                },
                hasApiFallback: true
            },
            {
                name: "hubspot-get-contact",
                description: "Get a specific contact by ID",
                serverId: this.serverId,
                parameters: {
                    contactId: { type: "string", description: "The contact ID", required: true }
                },
                hasApiFallback: true
            },
            {
                name: "hubspot-create-contact",
                description: "Create a new contact in HubSpot",
                serverId: this.serverId,
                parameters: {
                    email: { type: "string", description: "Contact email", required: true },
                    firstName: { type: "string", description: "First name" },
                    lastName: { type: "string", description: "Last name" },
                    phone: { type: "string", description: "Phone number" },
                    company: { type: "string", description: "Company name" }
                },
                hasApiFallback: true
            },
            {
                name: "hubspot-update-contact",
                description: "Update an existing contact",
                serverId: this.serverId,
                parameters: {
                    contactId: { type: "string", description: "The contact ID", required: true },
                    properties: { type: "object", description: "Properties to update" }
                },
                hasApiFallback: true
            },
            {
                name: "hubspot-search-contacts",
                description: "Search contacts by query",
                serverId: this.serverId,
                parameters: {
                    query: { type: "string", description: "Search query", required: true },
                    limit: { type: "number", description: "Maximum results" }
                },
                hasApiFallback: true
            },
            {
                name: "hubspot-get-companies",
                description: "Get a list of companies from HubSpot CRM",
                serverId: this.serverId,
                parameters: {
                    limit: { type: "number", description: "Maximum number of companies" },
                    after: { type: "string", description: "Pagination cursor" }
                },
                hasApiFallback: true
            },
            {
                name: "hubspot-get-company",
                description: "Get a specific company by ID",
                serverId: this.serverId,
                parameters: {
                    companyId: { type: "string", description: "The company ID", required: true }
                },
                hasApiFallback: true
            },
            {
                name: "hubspot-create-company",
                description: "Create a new company in HubSpot",
                serverId: this.serverId,
                parameters: {
                    name: { type: "string", description: "Company name", required: true },
                    domain: { type: "string", description: "Company domain" },
                    industry: { type: "string", description: "Industry" }
                },
                hasApiFallback: true
            },
            {
                name: "hubspot-get-deals",
                description: "Get a list of deals from HubSpot CRM",
                serverId: this.serverId,
                parameters: {
                    limit: { type: "number", description: "Maximum number of deals" },
                    after: { type: "string", description: "Pagination cursor" }
                },
                hasApiFallback: true
            },
            {
                name: "hubspot-get-deal",
                description: "Get a specific deal by ID",
                serverId: this.serverId,
                parameters: {
                    dealId: { type: "string", description: "The deal ID", required: true }
                },
                hasApiFallback: true
            },
            {
                name: "hubspot-create-deal",
                description: "Create a new deal in HubSpot",
                serverId: this.serverId,
                parameters: {
                    dealname: { type: "string", description: "Deal name", required: true },
                    amount: { type: "number", description: "Deal amount" },
                    dealstage: { type: "string", description: "Deal stage" },
                    pipeline: { type: "string", description: "Pipeline ID" }
                },
                hasApiFallback: true
            },
            {
                name: "hubspot-get-user-details",
                description: "Get current user details",
                serverId: this.serverId,
                parameters: {},
                hasApiFallback: true
            }
        ];
    }

    async executeTool(toolName: string, params: ToolExecutionContext): Promise<ToolResult> {
        const startTime = Date.now();

        try {
            let result: { success: boolean; data?: unknown; error?: string };

            switch (toolName) {
                case "hubspot-get-contacts":
                    result = await this.getContacts(params);
                    break;
                case "hubspot-get-contact":
                    result = await this.getContact(params.contactId as string);
                    break;
                case "hubspot-create-contact":
                    result = await this.createContact(params);
                    break;
                case "hubspot-update-contact":
                    result = await this.updateContact(
                        params.contactId as string,
                        params.properties as Record<string, unknown>
                    );
                    break;
                case "hubspot-search-contacts":
                    result = await this.searchContacts(
                        params.query as string,
                        params.limit as number
                    );
                    break;
                case "hubspot-get-companies":
                    result = await this.getCompanies(params);
                    break;
                case "hubspot-get-company":
                    result = await this.getCompany(params.companyId as string);
                    break;
                case "hubspot-create-company":
                    result = await this.createCompany(params);
                    break;
                case "hubspot-get-deals":
                    result = await this.getDeals(params);
                    break;
                case "hubspot-get-deal":
                    result = await this.getDeal(params.dealId as string);
                    break;
                case "hubspot-create-deal":
                    result = await this.createDeal(params);
                    break;
                case "hubspot-get-user-details":
                    result = await this.getUserDetails();
                    break;
                default:
                    result = { success: false, error: `Unknown tool: ${toolName}` };
            }

            return {
                ...result,
                metadata: {
                    mode: "api",
                    executionTime: Date.now() - startTime,
                    serverId: this.serverId
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                metadata: {
                    mode: "api",
                    executionTime: Date.now() - startTime,
                    serverId: this.serverId
                }
            };
        }
    }

    // Contact methods
    private async getContacts(params: ToolExecutionContext) {
        const limit = (params.limit as number) || 10;
        const after = params.after as string | undefined;
        const query = after ? `?limit=${limit}&after=${after}` : `?limit=${limit}`;
        return this.apiRequest(`/crm/v3/objects/contacts${query}`);
    }

    private async getContact(contactId: string) {
        return this.apiRequest(`/crm/v3/objects/contacts/${contactId}`);
    }

    private async createContact(params: ToolExecutionContext) {
        const properties: Record<string, unknown> = {};
        if (params.email) properties.email = params.email;
        if (params.firstName) properties.firstname = params.firstName;
        if (params.lastName) properties.lastname = params.lastName;
        if (params.phone) properties.phone = params.phone;
        if (params.company) properties.company = params.company;

        return this.apiRequest("/crm/v3/objects/contacts", {
            method: "POST",
            body: JSON.stringify({ properties })
        });
    }

    private async updateContact(contactId: string, properties: Record<string, unknown>) {
        return this.apiRequest(`/crm/v3/objects/contacts/${contactId}`, {
            method: "PATCH",
            body: JSON.stringify({ properties })
        });
    }

    private async searchContacts(query: string, limit = 10) {
        return this.apiRequest("/crm/v3/objects/contacts/search", {
            method: "POST",
            body: JSON.stringify({
                query,
                limit,
                properties: ["email", "firstname", "lastname", "phone", "company"]
            })
        });
    }

    // Company methods
    private async getCompanies(params: ToolExecutionContext) {
        const limit = (params.limit as number) || 10;
        const after = params.after as string | undefined;
        const query = after ? `?limit=${limit}&after=${after}` : `?limit=${limit}`;
        return this.apiRequest(`/crm/v3/objects/companies${query}`);
    }

    private async getCompany(companyId: string) {
        return this.apiRequest(`/crm/v3/objects/companies/${companyId}`);
    }

    private async createCompany(params: ToolExecutionContext) {
        const properties: Record<string, unknown> = {};
        if (params.name) properties.name = params.name;
        if (params.domain) properties.domain = params.domain;
        if (params.industry) properties.industry = params.industry;

        return this.apiRequest("/crm/v3/objects/companies", {
            method: "POST",
            body: JSON.stringify({ properties })
        });
    }

    // Deal methods
    private async getDeals(params: ToolExecutionContext) {
        const limit = (params.limit as number) || 10;
        const after = params.after as string | undefined;
        const query = after ? `?limit=${limit}&after=${after}` : `?limit=${limit}`;
        return this.apiRequest(`/crm/v3/objects/deals${query}`);
    }

    private async getDeal(dealId: string) {
        return this.apiRequest(`/crm/v3/objects/deals/${dealId}`);
    }

    private async createDeal(params: ToolExecutionContext) {
        const properties: Record<string, unknown> = {};
        if (params.dealname) properties.dealname = params.dealname;
        if (params.amount) properties.amount = params.amount;
        if (params.dealstage) properties.dealstage = params.dealstage;
        if (params.pipeline) properties.pipeline = params.pipeline;

        return this.apiRequest("/crm/v3/objects/deals", {
            method: "POST",
            body: JSON.stringify({ properties })
        });
    }

    // User methods
    private async getUserDetails() {
        return this.apiRequest("/settings/v3/users/me");
    }
}

export const hubspotApiClient = new HubSpotApiClient();
