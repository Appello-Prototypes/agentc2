/**
 * Skill Auto-Generator
 *
 * Automatically creates or updates skills when new MCP servers are connected.
 * Maps MCP server tools into composable skill bundles with auto-generated
 * descriptions and instructions.
 */

import { prisma } from "@repo/database";

/**
 * Server-to-skill slug mapping for known MCP servers.
 */
const SERVER_SKILL_MAP: Record<
    string,
    {
        slug: string;
        name: string;
        category: string;
        tags: string[];
    }
> = {
    hubspot: {
        slug: "mcp-crm-hubspot",
        name: "HubSpot CRM",
        category: "integration",
        tags: ["crm", "hubspot", "sales", "contacts"]
    },
    jira: {
        slug: "mcp-project-jira",
        name: "Jira Project Management",
        category: "integration",
        tags: ["jira", "project-management", "issues", "agile"]
    },
    firecrawl: {
        slug: "mcp-web-firecrawl",
        name: "Firecrawl Web Scraping",
        category: "integration",
        tags: ["web", "scraping", "firecrawl"]
    },
    playwright: {
        slug: "mcp-web-playwright",
        name: "Playwright Browser Automation",
        category: "integration",
        tags: ["browser", "automation", "playwright", "testing"]
    },
    slack: {
        slug: "mcp-communication-slack",
        name: "Slack Messaging",
        category: "integration",
        tags: ["slack", "messaging", "communication"]
    },
    justcall: {
        slug: "mcp-communication-justcall",
        name: "JustCall Phone & SMS",
        category: "integration",
        tags: ["justcall", "phone", "sms", "communication"]
    },
    twilio: {
        slug: "mcp-communication-twilio",
        name: "Twilio Voice Calls",
        category: "integration",
        tags: ["twilio", "voice", "calls", "communication"]
    },
    gdrive: {
        slug: "mcp-files-gdrive",
        name: "Google Drive Files",
        category: "integration",
        tags: ["gdrive", "google-drive", "files", "documents"]
    },
    github: {
        slug: "mcp-code-github",
        name: "GitHub Repository Management",
        category: "integration",
        tags: ["github", "code", "repositories", "issues", "prs"]
    },
    fathom: {
        slug: "mcp-knowledge-fathom",
        name: "Fathom Meeting Knowledge",
        category: "integration",
        tags: ["fathom", "meetings", "transcripts", "knowledge"]
    },
    atlas: {
        slug: "mcp-automation-atlas",
        name: "ATLAS Workflow Automation",
        category: "integration",
        tags: ["atlas", "n8n", "automation", "workflows"]
    }
};

interface ToolDefinition {
    name: string;
    description?: string;
}

/**
 * Generate a skill for an MCP server.
 *
 * If the skill already exists, updates its tool list.
 * If it doesn't exist, creates a new SYSTEM skill.
 *
 * @param serverKey - MCP server key (e.g., "hubspot", "jira")
 * @param tools - Array of tool definitions from the MCP server
 * @returns The created or updated skill
 */
export async function generateSkillForMcpServer(
    serverKey: string,
    tools: ToolDefinition[]
): Promise<{ skillId: string; slug: string; created: boolean; toolCount: number }> {
    const serverConfig = SERVER_SKILL_MAP[serverKey];

    // For unknown servers, generate a generic slug/name
    const slug = serverConfig?.slug || `mcp-custom-${serverKey}`;
    const name = serverConfig?.name || `${serverKey} Integration`;
    const category = serverConfig?.category || "integration";
    const tags = serverConfig?.tags || [serverKey, "mcp", "integration"];

    // Generate description from tool list
    const description = generateDescription(name, tools);
    const instructions = generateInstructions(name, serverKey, tools);

    // Prefix tool names with server key (MCP naming convention)
    const toolIds = tools.map((t) => {
        // MCP tools are already prefixed like "hubspot_hubspot-get-contacts"
        // If not prefixed, add the prefix
        return t.name.startsWith(`${serverKey}_`) ? t.name : `${serverKey}_${t.name}`;
    });

    // Upsert the skill
    const skill = await prisma.skill.upsert({
        where: { slug },
        update: {
            name,
            description,
            instructions,
            category,
            tags
        },
        create: {
            slug,
            name,
            description,
            instructions,
            category,
            tags,
            type: "SYSTEM"
        }
    });

    // Update tool attachments
    await prisma.skillTool.deleteMany({ where: { skillId: skill.id } });
    if (toolIds.length > 0) {
        await prisma.skillTool.createMany({
            data: toolIds.map((toolId) => ({
                skillId: skill.id,
                toolId
            })),
            skipDuplicates: true
        });
    }

    const created =
        skill.createdAt.getTime() === skill.updatedAt.getTime() ||
        Math.abs(skill.createdAt.getTime() - skill.updatedAt.getTime()) < 1000;

    console.log(
        `[SkillAutoGenerator] ${created ? "Created" : "Updated"} skill "${slug}" with ${toolIds.length} tools`
    );

    return {
        skillId: skill.id,
        slug,
        created,
        toolCount: toolIds.length
    };
}

/**
 * Generate a concise description (manifest) from tool list.
 */
function generateDescription(serverName: string, tools: ToolDefinition[]): string {
    if (tools.length === 0) {
        return `${serverName} integration tools.`;
    }

    // Extract unique action verbs from tool descriptions
    const actions = new Set<string>();
    for (const tool of tools) {
        const desc = tool.description?.toLowerCase() || tool.name;
        if (desc.includes("search") || desc.includes("find") || desc.includes("list"))
            actions.add("search");
        if (desc.includes("create") || desc.includes("add") || desc.includes("new"))
            actions.add("create");
        if (desc.includes("update") || desc.includes("edit") || desc.includes("modify"))
            actions.add("update");
        if (desc.includes("delete") || desc.includes("remove")) actions.add("delete");
        if (desc.includes("get") || desc.includes("read") || desc.includes("fetch"))
            actions.add("read");
        if (desc.includes("send") || desc.includes("post") || desc.includes("write"))
            actions.add("send");
    }

    const actionStr = [...actions].slice(0, 4).join(", ");
    return `${serverName}: ${actionStr || "interact with"} data using ${tools.length} tools.`;
}

/**
 * Generate procedural instructions from tool list.
 */
function generateInstructions(
    serverName: string,
    serverKey: string,
    tools: ToolDefinition[]
): string {
    let instructions = `## ${serverName} Integration\n\n`;
    instructions += `Access ${serverName} through MCP tools (${serverKey} server).\n\n`;

    if (tools.length > 0) {
        instructions += `### Available Tools (${tools.length}):\n`;
        for (const tool of tools.slice(0, 20)) {
            const desc = tool.description ? `: ${tool.description}` : "";
            instructions += `- **${tool.name}**${desc}\n`;
        }
        if (tools.length > 20) {
            instructions += `- ... and ${tools.length - 20} more tools\n`;
        }
    }

    return instructions;
}

/**
 * Check if a skill exists for a given MCP server key.
 */
export async function mcpSkillExists(serverKey: string): Promise<boolean> {
    const slug = SERVER_SKILL_MAP[serverKey]?.slug || `mcp-custom-${serverKey}`;
    const count = await prisma.skill.count({ where: { slug } });
    return count > 0;
}

/**
 * Get the skill slug for a given MCP server key.
 */
export function getMcpSkillSlug(serverKey: string): string {
    return SERVER_SKILL_MAP[serverKey]?.slug || `mcp-custom-${serverKey}`;
}
