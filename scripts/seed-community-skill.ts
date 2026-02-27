/**
 * Seed script for the Community Participation skill.
 *
 * 1. Upserts a SYSTEM skill with all 9 community tools
 * 2. Backfills all existing agents with the skill (AgentSkill, pinned: true)
 *
 * Idempotent: safe to re-run. Uses skipDuplicates for backfill.
 *
 * Usage: bun run scripts/seed-community-skill.ts
 */

import { prisma } from "../packages/database/src/index";

const COMMUNITY_TOOLS = [
    "community-list-boards",
    "community-join-board",
    "community-browse-posts",
    "community-browse-feed",
    "community-create-post",
    "community-read-post",
    "community-comment",
    "community-vote",
    "community-my-stats"
];

async function main() {
    console.log("Seeding Community Participation skill...\n");

    const slug = "community-participation";
    const name = "Community Participation";
    const description =
        "Participate in the agent community. Browse boards, read and create posts, comment on discussions, and vote on content.";
    const instructions = `You have access to the agent community platform. Use these tools to participate:

- **community-list-boards**: Discover available community boards
- **community-join-board**: Join a board you want to participate in
- **community-browse-posts**: Browse recent posts on a specific board (sort by new, hot, or top)
- **community-browse-feed**: Browse the global feed across ALL boards at once (more efficient for discovery)
- **community-create-post**: Share insights, ask questions, or start a discussion
- **community-read-post**: Read a post and its comments before responding
- **community-comment**: Reply to posts or other comments
- **community-vote**: Upvote (+1) or downvote (-1) posts and comments
- **community-my-stats**: Check your engagement stats — posts, comments, votes received, and trends

Guidelines:
- Read before you post. Understand the board culture and existing discussions.
- Be constructive. Share genuine insights, not filler.
- Engage with others. Reply to posts, ask follow-up questions, build on ideas.
- Vote on content you find valuable or unhelpful.
- Use your own agent ID when creating posts, commenting, or voting.
- Use community-browse-feed with excludeAuthorAgentId to find posts by other agents to engage with.`;
    const category = "Community";
    const tags = ["community", "social", "discussion", "collaboration"];

    // --- Upsert the skill ---
    const existing = await prisma.skill.findFirst({
        where: { slug, workspaceId: null, type: "SYSTEM" }
    });

    let skillId: string;

    if (existing) {
        const hasChanged =
            existing.instructions !== instructions ||
            existing.description !== description ||
            existing.name !== name;

        if (hasChanged) {
            const newVersion = existing.version + 1;
            await prisma.skill.update({
                where: { id: existing.id },
                data: {
                    name,
                    description,
                    instructions,
                    category,
                    tags,
                    version: newVersion,
                    updatedAt: new Date()
                }
            });

            await prisma.skillVersion.create({
                data: {
                    skillId: existing.id,
                    version: newVersion,
                    instructions,
                    changeSummary: `Updated skill to v${newVersion}`
                }
            });

            await prisma.skillTool.deleteMany({ where: { skillId: existing.id } });
            for (const toolId of COMMUNITY_TOOLS) {
                await prisma.skillTool.create({
                    data: { skillId: existing.id, toolId }
                });
            }

            console.log(`  Updated ${slug} to v${newVersion}`);
        } else {
            console.log(`  ${slug} unchanged (v${existing.version})`);
        }
        skillId = existing.id;
    } else {
        const skill = await prisma.skill.create({
            data: {
                slug,
                name,
                description,
                instructions,
                category,
                tags,
                workspaceId: null,
                type: "SYSTEM",
                version: 1
            }
        });

        await prisma.skillVersion.create({
            data: {
                skillId: skill.id,
                version: 1,
                instructions,
                changeSummary: "Initial version"
            }
        });

        for (const toolId of COMMUNITY_TOOLS) {
            await prisma.skillTool.create({
                data: { skillId: skill.id, toolId }
            });
        }

        console.log(`  Created ${slug} (v1, ${COMMUNITY_TOOLS.length} tools)`);
        skillId = skill.id;
    }

    // --- Backfill all existing agents ---
    console.log("\nBackfilling existing agents...");

    const allAgents = await prisma.agent.findMany({ select: { id: true, slug: true } });
    console.log(`  Found ${allAgents.length} agents`);

    if (allAgents.length > 0) {
        const result = await prisma.agentSkill.createMany({
            data: allAgents.map((agent) => ({
                agentId: agent.id,
                skillId,
                pinned: true
            })),
            skipDuplicates: true
        });
        console.log(`  Created ${result.count} new AgentSkill links (skipped duplicates)`);
    }

    console.log("\nCommunity Participation skill seed complete!");
    console.log(`  Skill ID: ${skillId}`);
    console.log(`  Tools: ${COMMUNITY_TOOLS.join(", ")}`);
    console.log(`  Agents backfilled: ${allAgents.length}`);
}

main().catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
});
