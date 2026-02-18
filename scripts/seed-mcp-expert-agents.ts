import { prisma, AgentType } from "../packages/database/src";
import { listMcpToolDefinitions, MCP_SERVER_CONFIGS } from "../packages/mastra/src";

const DEFAULT_MODEL_PROVIDER = "anthropic";
const DEFAULT_MODEL_NAME = "claude-sonnet-4-20250514";
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_STEPS = 5;
const DEFAULT_MAX_TOKENS = 4096;

function buildInstructions(config: {
    name: string;
    description: string;
    category: string;
    envVars?: string[];
}) {
    const envHint =
        config.envVars && config.envVars.length > 0
            ? `If tools are unavailable, explain that ${config.name} MCP is not configured and mention required env vars: ${config.envVars.join(", ")}.`
            : `If tools are unavailable, explain that the ${config.name} MCP server is not configured.`;

    return `You are the ${config.name} MCP expert. You specialize in ${config.description}.

## Scope
- Use ONLY ${config.name} MCP tools to perform actions and fetch data.
- If a request needs another system, say so and suggest the matching MCP expert.
- Category focus: ${config.category}.

## Tool use
- Ask for required identifiers or filters before running tools.
- Do not guess results; call tools and summarize outputs.
- ${envHint}

## Output
- Provide concise, actionable answers.
- Include any IDs or links returned by tools.`;
}

function buildExpertSpecs() {
    return MCP_SERVER_CONFIGS.map((config) => ({
        slug: `mcp-${config.id}-expert`,
        name: `${config.name} MCP Expert`,
        description: `Purpose-built agent for ${config.name} MCP tools.`,
        instructions: buildInstructions(config),
        modelProvider: DEFAULT_MODEL_PROVIDER,
        modelName: DEFAULT_MODEL_NAME,
        temperature: DEFAULT_TEMPERATURE,
        maxSteps: DEFAULT_MAX_STEPS,
        maxTokens: DEFAULT_MAX_TOKENS,
        modelConfig: {
            toolChoice: "required"
        },
        memoryEnabled: false,
        memoryConfig: null,
        scorers: [] as string[],
        metadata: {
            category: "mcp-expert",
            mcpServerId: config.id
        }
    }));
}

async function seedMcpExpertAgents() {
    console.log("Seeding MCP expert agents...");

    const { definitions: toolDefinitions } = await listMcpToolDefinitions();
    const toolsByServer = toolDefinitions.reduce<Record<string, string[]>>((acc, toolDef) => {
        if (!acc[toolDef.server]) {
            acc[toolDef.server] = [];
        }
        acc[toolDef.server].push(toolDef.name);
        return acc;
    }, {});

    const specs = buildExpertSpecs();
    let created = 0;
    let updated = 0;

    for (const spec of specs) {
        const serverId = spec.metadata.mcpServerId;
        const tools = toolsByServer[serverId] || [];

        if (tools.length === 0) {
            const config = MCP_SERVER_CONFIGS.find((item) => item.id === serverId);
            const envNote =
                config?.envVars && config.envVars.length > 0
                    ? ` Required env vars: ${config.envVars.join(", ")}.`
                    : "";
            console.log(
                `Warning: No tools found for MCP server "${serverId}". Ensure the server is configured and reachable.${envNote}`
            );
        }

        const existing = await prisma.agent.findUnique({
            where: { slug: spec.slug }
        });

        const agent = await prisma.agent.upsert({
            where: { slug: spec.slug },
            update: {
                name: spec.name,
                description: spec.description,
                instructions: spec.instructions,
                instructionsTemplate: null,
                modelProvider: spec.modelProvider,
                modelName: spec.modelName,
                temperature: spec.temperature,
                maxTokens: spec.maxTokens,
                modelConfig: spec.modelConfig,
                memoryEnabled: spec.memoryEnabled,
                memoryConfig: spec.memoryConfig,
                maxSteps: spec.maxSteps,
                scorers: spec.scorers,
                type: AgentType.USER,
                visibility: "PUBLIC",
                isActive: true,
                metadata: spec.metadata
            },
            create: {
                slug: spec.slug,
                name: spec.name,
                description: spec.description,
                instructions: spec.instructions,
                instructionsTemplate: null,
                modelProvider: spec.modelProvider,
                modelName: spec.modelName,
                temperature: spec.temperature,
                maxTokens: spec.maxTokens,
                modelConfig: spec.modelConfig,
                memoryEnabled: spec.memoryEnabled,
                memoryConfig: spec.memoryConfig,
                maxSteps: spec.maxSteps,
                scorers: spec.scorers,
                type: AgentType.USER,
                visibility: "PUBLIC",
                isActive: true,
                metadata: spec.metadata
            }
        });

        await prisma.agentTool.deleteMany({
            where: { agentId: agent.id }
        });

        const uniqueTools = Array.from(new Set(tools));
        if (uniqueTools.length > 0) {
            await prisma.agentTool.createMany({
                data: uniqueTools.map((toolId) => ({
                    agentId: agent.id,
                    toolId
                }))
            });
        }

        if (existing) {
            console.log(`Updated: ${spec.name} (${spec.slug})`);
            updated += 1;
        } else {
            console.log(`Created: ${spec.name} (${spec.slug})`);
            created += 1;
        }
    }

    console.log(`Seeding complete. Created: ${created}. Updated: ${updated}.`);
}

seedMcpExpertAgents()
    .catch((error) => {
        console.error("Error seeding MCP expert agents:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
