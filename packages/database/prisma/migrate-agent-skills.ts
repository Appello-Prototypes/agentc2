/**
 * Migration Script: Attach Skills to Agents
 *
 * Attaches the seeded skills to existing agents using the new
 * pinned/discoverable progressive disclosure pattern.
 *
 * Run: bun run prisma/migrate-agent-skills.ts
 * Prerequisites: seed-skills.ts must have been run first
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface AgentSkillConfig {
    agentSlug: string;
    pinnedSlugs: string[];
    discoverableSlugs: string[];
}

const agentSkillConfigs: AgentSkillConfig[] = [
    // workspace-concierge: Full platform access via progressive disclosure
    {
        agentSlug: "workspace-concierge",
        pinnedSlugs: ["core-utilities", "user-interaction"],
        discoverableSlugs: [
            "platform-agent-management",
            "platform-workflow-management",
            "platform-workflow-execution",
            "platform-network-management",
            "platform-network-execution",
            "platform-triggers-schedules",
            "platform-observability",
            "platform-quality-safety",
            "platform-learning",
            "platform-simulations",
            "platform-knowledge-management",
            "platform-skill-management",
            "platform-integrations",
            "platform-organization",
            "platform-webhooks",
            "platform-goals",
            "agent-collaboration",
            "web-research",
            "bim-engineering",
            "email-management",
            // MCP skills — discoverable
            "mcp-crm-hubspot",
            "mcp-project-jira",
            "mcp-web-firecrawl",
            "mcp-web-playwright",
            "mcp-communication-slack",
            "mcp-communication-justcall",
            "mcp-communication-twilio",
            "mcp-files-gdrive",
            "mcp-code-github",
            "mcp-knowledge-fathom",
            "mcp-automation-atlas"
        ]
    },

    // assistant: Simple, focused agent
    {
        agentSlug: "assistant",
        pinnedSlugs: ["core-utilities", "web-research"],
        discoverableSlugs: []
    },

    // skill-builder: Focused builder
    {
        agentSlug: "skill-builder",
        pinnedSlugs: ["platform-skill-management", "core-utilities"],
        discoverableSlugs: []
    },

    // webhook-wizard: Focused builder
    {
        agentSlug: "webhook-wizard",
        pinnedSlugs: ["platform-webhooks"],
        discoverableSlugs: []
    },

    // mcp-setup-agent: Focused builder
    {
        agentSlug: "mcp-setup-agent",
        pinnedSlugs: ["platform-integrations"],
        discoverableSlugs: []
    },

    // Campaign System Agents — each gets its single purpose-built skill pinned
    {
        agentSlug: "campaign-analyst",
        pinnedSlugs: ["campaign-analysis"],
        discoverableSlugs: []
    },
    {
        agentSlug: "campaign-planner",
        pinnedSlugs: ["campaign-planning"],
        discoverableSlugs: []
    },
    {
        agentSlug: "campaign-architect",
        pinnedSlugs: ["campaign-architecture"],
        discoverableSlugs: []
    },
    {
        agentSlug: "campaign-reviewer",
        pinnedSlugs: ["campaign-review"],
        discoverableSlugs: []
    }
];

async function migrateAgentSkills() {
    console.log("\n--- Migrating Agent Skills ---\n");

    for (const config of agentSkillConfigs) {
        const agent = await prisma.agent.findFirst({
            where: { slug: config.agentSlug },
            select: { id: true, slug: true, name: true }
        });

        if (!agent) {
            console.log(`  ⚠ Agent "${config.agentSlug}" not found, skipping`);
            continue;
        }

        // Clear existing AgentSkill junctions for this agent
        await prisma.agentSkill.deleteMany({ where: { agentId: agent.id } });

        let attachedCount = 0;

        // Attach pinned skills
        for (const skillSlug of config.pinnedSlugs) {
            const skill = await prisma.skill.findFirst({
                where: { slug: skillSlug },
                select: { id: true }
            });
            if (!skill) {
                console.log(`    ⚠ Skill "${skillSlug}" not found, skipping`);
                continue;
            }
            await prisma.agentSkill.create({
                data: {
                    agentId: agent.id,
                    skillId: skill.id,
                    pinned: true
                }
            });
            attachedCount++;
        }

        // Attach discoverable skills
        for (const skillSlug of config.discoverableSlugs) {
            const skill = await prisma.skill.findFirst({
                where: { slug: skillSlug },
                select: { id: true }
            });
            if (!skill) {
                console.log(`    ⚠ Skill "${skillSlug}" not found, skipping`);
                continue;
            }
            await prisma.agentSkill.create({
                data: {
                    agentId: agent.id,
                    skillId: skill.id,
                    pinned: false
                }
            });
            attachedCount++;
        }

        const pinnedCount = config.pinnedSlugs.length;
        const discoverableCount = config.discoverableSlugs.length;
        console.log(
            `  ✓ ${agent.slug} (${agent.name}): ${attachedCount} skills ` +
                `(${pinnedCount} pinned, ${discoverableCount} discoverable)`
        );
    }

    // Also attach skills to MCP expert agents (pattern: mcp-*-expert)
    const mcpExperts = await prisma.agent.findMany({
        where: {
            slug: { contains: "-expert" },
            metadata: { path: ["category"], equals: "mcp-expert" }
        },
        select: { id: true, slug: true, name: true, metadata: true }
    });

    for (const expert of mcpExperts) {
        const meta = expert.metadata as Record<string, unknown> | null;
        const mcpServerId = meta?.mcpServerId as string | undefined;
        if (!mcpServerId) continue;

        // Map MCP server ID to skill slug
        const skillSlug = mapMcpServerToSkillSlug(mcpServerId);
        if (!skillSlug) continue;

        const skill = await prisma.skill.findFirst({
            where: { slug: skillSlug },
            select: { id: true }
        });
        if (!skill) continue;

        // Clear existing and attach
        await prisma.agentSkill.deleteMany({ where: { agentId: expert.id } });

        // Attach MCP skill as pinned (expert agents always load their skill)
        await prisma.agentSkill.create({
            data: { agentId: expert.id, skillId: skill.id, pinned: true }
        });

        // Also attach core-utilities as pinned
        const coreSkill = await prisma.skill.findFirst({
            where: { slug: "core-utilities" },
            select: { id: true }
        });
        if (coreSkill) {
            await prisma.agentSkill.create({
                data: { agentId: expert.id, skillId: coreSkill.id, pinned: true }
            });
        }

        console.log(`  ✓ ${expert.slug}: 2 pinned skills (${skillSlug} + core-utilities)`);
    }

    console.log("\n--- Migration Complete ---\n");
}

function mapMcpServerToSkillSlug(serverId: string): string | null {
    const mapping: Record<string, string> = {
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
    return mapping[serverId] || null;
}

migrateAgentSkills()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error("Migration failed:", e);
        await prisma.$disconnect();
        process.exit(1);
    });
