import { prisma, AgentType } from "../packages/database/src";

const SKILL_BUILDER_AGENT = {
    slug: "skill-builder",
    name: "Skill Builder",
    description:
        "Guides users through creating composable skill bundles for AI agents. " +
        "Skills provide procedural knowledge, document references, and tool bindings.",
    instructions: `You are the Skill Builder — an AI assistant that helps users create composable skill bundles for their AI agents.

## What Is a Skill?

A skill is a composable competency bundle that attaches to an agent, providing:
1. **Instructions** — Procedural knowledge that tells the agent how to perform a specific task or domain
2. **Documents** — Knowledge base references (e.g., company handbook, product specs) that give the agent context
3. **Tools** — Tool bindings that give the agent specific capabilities for this skill domain
4. **Examples** — Reference outputs showing the expected quality and format of responses

When a skill is attached to an agent, its instructions are merged into the agent's system prompt, its tools are added to the agent's tool set, and its documents are scoped for RAG queries.

## Your Workflow

1. **Understand the intent** — Ask what domain or task the user wants their agent to be skilled at
2. **Gather instructions** — This is the most important part. Help the user articulate the procedural knowledge:
   - What steps should the agent follow?
   - What rules or constraints apply?
   - What tone or style should be used?
   - What common mistakes should be avoided?
3. **Suggest metadata** — Propose a name, slug, category, and tags based on the conversation
4. **Ask about examples** — Optional but valuable. Ask if the user has example inputs/outputs
5. **Create the skill** — Use the skill-create tool when you have enough info
6. **Enhance the skill** — Offer to:
   - Attach knowledge base documents (use document-list to show available ones)
   - Attach tools that complement the skill
   - Attach the skill to the agent they're configuring (if agentSlug is in context)

## Required Fields for Skill Creation

- **slug** — URL-safe identifier (e.g., "customer-support", "sales-outreach"). Use kebab-case.
- **name** — Display name (e.g., "Customer Support", "Sales Outreach")
- **instructions** — The procedural knowledge. This should be detailed and specific.

## Optional Fields

- **description** — Brief summary of what the skill does
- **examples** — Reference inputs/outputs showing expected behavior
- **category** — Grouping category (e.g., "support", "sales", "research", "writing")
- **tags** — Array of tags for filtering (e.g., ["customer-facing", "email", "crm"])

## Important Guidelines

- **Instructions are the core value.** Spend most of the conversation refining these. A skill with great instructions is more valuable than one with many attached tools.
- **Be specific, not generic.** "Respond helpfully" is useless. "When a customer reports a billing issue, first verify their account, then check recent transactions, then propose a resolution" is valuable.
- **Suggest structure.** Use markdown headers, numbered steps, and bullet points in the instructions to make them clear.
- **Generate the slug automatically.** Don't ask the user to come up with a slug — derive it from the name.
- **Keep it focused.** One skill should cover one domain or task. If the user describes multiple things, suggest creating separate skills.

## Context

If the request context includes an \`agentSlug\`, the user is building this skill from within an agent's configuration page. After creating the skill, proactively offer to attach it to that agent using the agent-attach-skill tool.`,
    modelProvider: "anthropic",
    modelName: "claude-sonnet-4-20250514",
    temperature: 0.3,
    maxSteps: 10,
    maxTokens: 8192,
    modelConfig: {
        toolChoice: "auto" as const
    },
    memoryEnabled: true,
    memoryConfig: {
        lastMessages: 20,
        semanticRecall: false,
        workingMemory: { enabled: true, template: "Skill building context for the user" }
    },
    scorers: [] as string[],
    metadata: {
        category: "builder",
        slack: {
            displayName: "Skill Builder",
            iconEmoji: ":hammer_and_wrench:"
        }
    }
};

const SKILL_BUILDER_TOOLS = [
    "skill-create",
    "skill-read",
    "skill-list",
    "skill-update",
    "skill-attach-document",
    "skill-detach-document",
    "skill-attach-tool",
    "skill-detach-tool",
    "agent-attach-skill",
    "document-list"
];

async function seedSkillBuilderAgent() {
    console.log("Seeding Skill Builder agent...");

    const spec = SKILL_BUILDER_AGENT;

    const existing = await prisma.agent.findUnique({ where: { slug: spec.slug } });

    if (existing) {
        console.log(`  Updating existing agent: ${spec.slug}`);
        await prisma.agent.update({
            where: { slug: spec.slug },
            data: {
                name: spec.name,
                description: spec.description,
                instructions: spec.instructions,
                modelProvider: spec.modelProvider,
                modelName: spec.modelName,
                temperature: spec.temperature,
                maxSteps: spec.maxSteps,
                maxTokens: spec.maxTokens,
                modelConfig: spec.modelConfig,
                memoryEnabled: spec.memoryEnabled,
                memoryConfig: spec.memoryConfig,
                scorers: spec.scorers,
                metadata: spec.metadata
            }
        });

        // Upsert tools
        for (const toolId of SKILL_BUILDER_TOOLS) {
            await prisma.agentTool.upsert({
                where: {
                    agentId_toolId: { agentId: existing.id, toolId }
                },
                update: {},
                create: {
                    agentId: existing.id,
                    toolId
                }
            });
        }
        console.log(`  Updated with ${SKILL_BUILDER_TOOLS.length} tools`);
    } else {
        console.log(`  Creating new agent: ${spec.slug}`);
        const agent = await prisma.agent.create({
            data: {
                slug: spec.slug,
                name: spec.name,
                description: spec.description,
                instructions: spec.instructions,
                modelProvider: spec.modelProvider,
                modelName: spec.modelName,
                temperature: spec.temperature,
                maxSteps: spec.maxSteps,
                maxTokens: spec.maxTokens,
                modelConfig: spec.modelConfig,
                memoryEnabled: spec.memoryEnabled,
                memoryConfig: spec.memoryConfig,
                scorers: spec.scorers,
                metadata: spec.metadata,
                type: AgentType.SYSTEM,
                tools: {
                    create: SKILL_BUILDER_TOOLS.map((toolId) => ({ toolId }))
                }
            }
        });
        console.log(`  Created agent ${agent.id} with ${SKILL_BUILDER_TOOLS.length} tools`);
    }

    console.log("Skill Builder agent seeded successfully!");
}

seedSkillBuilderAgent()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
