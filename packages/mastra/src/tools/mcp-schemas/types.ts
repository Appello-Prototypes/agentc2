export type JsonSchema = Record<string, unknown>;

export type McpToolDefinition = {
    name: string;
    description: string;
    inputSchema: JsonSchema;
    outputSchema?: JsonSchema;
    invoke_url?: string;
    category: string;
};

export type InternalToolRoute = {
    kind: "internal";
    name: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
    pathParams?: string[];
    queryParams?: string[];
    bodyParams?: string[];
    staticBody?: Record<string, unknown>;
    expectSuccess?: boolean;
};

export type RegistryToolRoute = {
    kind: "registry";
    name: string;
    applyDefaults?: boolean;
    injectOrg?: boolean;
    injectUser?: boolean;
};

export type CustomToolRoute = {
    kind: "custom";
    name: string;
    handler: "workflowExecute" | "networkExecute" | "agentVersionsList";
};

export type McpToolRoute = InternalToolRoute | RegistryToolRoute | CustomToolRoute;
