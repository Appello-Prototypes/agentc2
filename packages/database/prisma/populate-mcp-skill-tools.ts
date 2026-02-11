/**
 * Populate MCP Skill Tools
 *
 * Discovers MCP tools from connected servers and attaches them
 * to the corresponding MCP skills (mcp-crm-hubspot, mcp-project-jira, etc.)
 *
 * Run: bun run prisma/populate-mcp-skill-tools.ts
 * Requires: MCP servers to be configured and accessible via env vars
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Map MCP server keys to skill slugs
const SERVER_TO_SKILL: Record<string, string> = {
    hubspot: "mcp-crm-hubspot",
    jira: "mcp-project-jira",
    firecrawl: "mcp-web-firecrawl",
    playwright: "mcp-web-playwright",
    slack: "mcp-communication-slack",
    justcall: "mcp-communication-justcall",
    twilio: "mcp-communication-twilio",
    gdrive: "mcp-files-gdrive",
    github: "mcp-code-github",
    fathom: "mcp-knowledge-fathom",
    atlas: "mcp-automation-atlas"
};

async function populateMcpSkillTools() {
    console.log("\n--- Populating MCP Skill Tools ---\n");

    // Dynamically import the mastra module to get MCP tool definitions
    let listMcpToolDefinitions: (
        orgId?: string | null
    ) => Promise<Array<{ name: string; description: string; server: string }>>;

    try {
        const mastra = await import("../../../packages/mastra/src/mcp/client");
        listMcpToolDefinitions = mastra.listMcpToolDefinitions;
    } catch (err) {
        console.error(
            "Failed to import MCP client. Trying direct tool enumeration from API fallback clients..."
        );
        // If MCP client can't be imported, try listing tools from API fallback clients
        // For now, we'll use the known tool lists from the seed data
        await populateFromKnownTools();
        return;
    }

    try {
        console.log("  Discovering MCP tools from connected servers...");
        const definitions = await listMcpToolDefinitions(null);

        // Group by server
        const toolsByServer = new Map<string, string[]>();
        for (const def of definitions) {
            const existing = toolsByServer.get(def.server) || [];
            existing.push(def.name);
            toolsByServer.set(def.server, existing);
        }

        console.log(`  Found ${definitions.length} tools across ${toolsByServer.size} servers\n`);

        // Attach tools to corresponding skills
        for (const [server, toolIds] of toolsByServer) {
            const skillSlug = SERVER_TO_SKILL[server];
            if (!skillSlug) {
                console.log(`  ? No skill mapping for server "${server}" — skipping`);
                continue;
            }

            const skill = await prisma.skill.findUnique({
                where: { slug: skillSlug },
                select: { id: true, slug: true }
            });

            if (!skill) {
                console.log(`  ? Skill "${skillSlug}" not found — skipping`);
                continue;
            }

            // Replace existing tools with discovered ones
            await prisma.skillTool.deleteMany({ where: { skillId: skill.id } });
            await prisma.skillTool.createMany({
                data: toolIds.map((toolId) => ({
                    skillId: skill.id,
                    toolId
                })),
                skipDuplicates: true
            });

            console.log(`  + ${skillSlug}: ${toolIds.length} tools attached`);
        }
    } catch (err) {
        console.error("  MCP discovery failed, falling back to known tools:", err);
        await populateFromKnownTools();
    }

    console.log("\n--- Done ---\n");
}

/**
 * Fallback: populate from known API fallback tool lists.
 * Used when MCP servers can't be connected directly.
 */
async function populateFromKnownTools() {
    console.log("  Using known tool lists from API fallback clients...\n");

    // Known tools per server (from the API fallback clients in packages/mastra/src/mcp/api-clients/)
    const knownTools: Record<string, string[]> = {
        "mcp-crm-hubspot": [
            "hubspot_hubspot-get-contacts",
            "hubspot_hubspot-get-contact",
            "hubspot_hubspot-create-contact",
            "hubspot_hubspot-update-contact",
            "hubspot_hubspot-search-contacts",
            "hubspot_hubspot-get-companies",
            "hubspot_hubspot-get-company",
            "hubspot_hubspot-create-company",
            "hubspot_hubspot-get-deals",
            "hubspot_hubspot-get-deal",
            "hubspot_hubspot-create-deal",
            "hubspot_hubspot-get-user-details"
        ],
        "mcp-project-jira": [
            "jira_jira-search-issues",
            "jira_jira-get-issue",
            "jira_jira-create-issue",
            "jira_jira-update-issue",
            "jira_jira-add-comment",
            "jira_jira-get-comments",
            "jira_jira-transition-issue",
            "jira_jira-get-transitions",
            "jira_jira-get-projects",
            "jira_jira-get-myself"
        ],
        "mcp-web-firecrawl": [
            "firecrawl_firecrawl-scrape",
            "firecrawl_firecrawl-crawl",
            "firecrawl_firecrawl-map",
            "firecrawl_firecrawl-crawl-status",
            "firecrawl_firecrawl-cancel-crawl"
        ],
        "mcp-automation-atlas": ["atlas_atlas-trigger-workflow", "atlas_atlas-check-status"]
    };

    for (const [skillSlug, toolIds] of Object.entries(knownTools)) {
        const skill = await prisma.skill.findUnique({
            where: { slug: skillSlug },
            select: { id: true }
        });

        if (!skill) {
            console.log(`  ? Skill "${skillSlug}" not found — skipping`);
            continue;
        }

        // Replace existing tools
        await prisma.skillTool.deleteMany({ where: { skillId: skill.id } });
        await prisma.skillTool.createMany({
            data: toolIds.map((toolId) => ({
                skillId: skill.id,
                toolId
            })),
            skipDuplicates: true
        });

        console.log(`  + ${skillSlug}: ${toolIds.length} tools attached`);
    }
}

populateMcpSkillTools()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error("Populate failed:", e);
        await prisma.$disconnect();
        process.exit(1);
    });
