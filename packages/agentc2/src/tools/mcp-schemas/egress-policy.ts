import { McpToolDefinition, McpToolRoute } from "./types";

export const egressPolicyToolDefinitions: McpToolDefinition[] = [
    {
        name: "org-egress-policy-get",
        description:
            "Get the organization's network egress policy. Controls which external domains agents can make outbound requests to.",
        inputSchema: {
            type: "object",
            properties: {
                orgId: {
                    type: "string",
                    description: "Organization ID or slug"
                }
            },
            required: ["orgId"]
        },
        invoke_url: "/api/mcp",
        category: "governance"
    },
    {
        name: "org-egress-policy-update",
        description:
            "Create or update the organization's network egress policy. Set mode to 'allowlist' to only permit listed domains, or 'denylist' to block listed domains.",
        inputSchema: {
            type: "object",
            properties: {
                orgId: {
                    type: "string",
                    description: "Organization ID or slug"
                },
                mode: {
                    type: "string",
                    description:
                        "Policy mode: 'allowlist' (block all except listed) or 'denylist' (allow all except listed)"
                },
                domains: {
                    type: "array",
                    items: { type: "string" },
                    description: "Domain patterns (e.g. 'api.stripe.com', '*.example.com')"
                },
                enabled: {
                    type: "boolean",
                    description: "Whether the policy is actively enforced"
                }
            },
            required: ["orgId", "mode", "domains"]
        },
        invoke_url: "/api/mcp",
        category: "governance"
    },
    {
        name: "org-egress-policy-delete",
        description:
            "Remove the organization's network egress policy. All outbound requests will be allowed.",
        inputSchema: {
            type: "object",
            properties: {
                orgId: {
                    type: "string",
                    description: "Organization ID or slug"
                }
            },
            required: ["orgId"]
        },
        invoke_url: "/api/mcp",
        category: "governance"
    }
];

export const egressPolicyToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "org-egress-policy-get",
        method: "GET",
        path: "/api/organizations/{orgId}/egress-policy",
        pathParams: ["orgId"]
    },
    {
        kind: "internal",
        name: "org-egress-policy-update",
        method: "PUT",
        path: "/api/organizations/{orgId}/egress-policy",
        pathParams: ["orgId"],
        bodyParams: ["mode", "domains", "enabled"]
    },
    {
        kind: "internal",
        name: "org-egress-policy-delete",
        method: "DELETE",
        path: "/api/organizations/{orgId}/egress-policy",
        pathParams: ["orgId"]
    }
];
