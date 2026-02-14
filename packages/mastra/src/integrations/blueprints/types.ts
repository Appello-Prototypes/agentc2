/**
 * IntegrationBlueprint Types
 *
 * Static TypeScript definitions that guide auto-provisioning of Skills and Agents
 * when an integration is connected. Each blueprint defines the Skill instructions,
 * tool bindings, and Agent configuration that should be created.
 */

export interface IntegrationBlueprint {
    /** The IntegrationProvider key (e.g., "hubspot", "stripe", "github") */
    providerKey: string;

    /** Blueprint version -- bumped when instructions or config change */
    version: number;

    /** Skill definition */
    skill: {
        /** URL-safe slug (unique per workspace, e.g., "hubspot-expert") */
        slug: string;
        /** Human-readable name */
        name: string;
        /** Short description for display */
        description: string;
        /** Expert instructions for the skill (200-500 words of platform expertise) */
        instructions: string;
        /** Skill category */
        category: string;
        /** Searchable tags */
        tags: string[];
        /**
         * How tools are discovered:
         * - "dynamic": Query the MCP server's listTools() at connection time
         * - "static": Use a hardcoded list of tool IDs
         */
        toolDiscovery: "dynamic" | "static";
        /** Static tool IDs (only used when toolDiscovery is "static") */
        staticTools?: string[];
    };

    /** Agent definition (auto-created to work with this integration) */
    agent: {
        /** URL-safe slug (unique per workspace, e.g., "hubspot-agent") */
        slug: string;
        /** Agent display name */
        name: string;
        /** Short description */
        description: string;
        /** Agent instructions (can reference the skill) */
        instructions: string;
        /** Model provider ("openai" | "anthropic") */
        modelProvider: string;
        /** Model name (e.g., "gpt-4o", "claude-sonnet-4-20250514") */
        modelName: string;
        /** Temperature (0-1) */
        temperature: number;
        /** Enable conversation memory */
        memoryEnabled: boolean;
        /** Additional tool IDs to attach beyond the skill's tools */
        additionalTools: string[];
        /** Optional metadata for display/behavior */
        metadata?: {
            slack?: { displayName: string; iconEmoji: string };
            [key: string]: unknown;
        };
    };
}

/**
 * Result of a provisioning operation.
 */
export interface ProvisionResult {
    /** Whether provisioning succeeded */
    success: boolean;
    /** The provisioned skill ID (if created/updated) */
    skillId?: string;
    /** The provisioned agent ID (if created/updated) */
    agentId?: string;
    /** Tool IDs discovered from the MCP server */
    toolsDiscovered: string[];
    /** Whether the skill was created (true) or reactivated (false) */
    skillCreated: boolean;
    /** Whether the agent was created (true) or reactivated (false) */
    agentCreated: boolean;
    /** Error message if provisioning failed */
    error?: string;
}
