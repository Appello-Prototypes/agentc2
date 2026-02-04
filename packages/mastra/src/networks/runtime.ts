import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { prisma } from "@repo/database";
import { agentResolver } from "../agents/resolver";
import { storage } from "../storage";
import { vector } from "../vector";
import { getToolsByNamesAsync } from "../tools/registry";
import { executeWorkflowDefinition, type WorkflowDefinition } from "../workflows/builder";

function buildNetworkMemory(memoryConfig: Record<string, unknown>): Memory {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {};
    if (memoryConfig.lastMessages !== undefined) {
        options.lastMessages = memoryConfig.lastMessages;
    }
    if (memoryConfig.semanticRecall !== undefined) {
        options.semanticRecall = memoryConfig.semanticRecall;
    }
    if (memoryConfig.workingMemory !== undefined) {
        options.workingMemory = memoryConfig.workingMemory;
    }

    const hasSemanticRecall =
        memoryConfig.semanticRecall !== undefined &&
        memoryConfig.semanticRecall !== false &&
        typeof memoryConfig.semanticRecall === "object";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memoryArgs: any = {
        storage,
        options
    };

    if (hasSemanticRecall) {
        memoryArgs.vector = vector;
        memoryArgs.embedder = new ModelRouterEmbeddingModel("openai/text-embedding-3-small");
    }

    return new Memory(memoryArgs);
}

async function buildWorkflowWrapper(workflowId: string) {
    const dbWorkflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!dbWorkflow?.definitionJson) {
        return null;
    }

    const step = createStep({
        id: `db-workflow-${dbWorkflow.slug}`,
        description: dbWorkflow.description || "Database workflow",
        inputSchema: z.any(),
        outputSchema: z.any(),
        execute: async ({ inputData }) => {
            const result = await executeWorkflowDefinition({
                definition: dbWorkflow.definitionJson as unknown as WorkflowDefinition,
                input: inputData
            });
            if (result.status === "success") {
                return result.output;
            }
            if (result.status === "suspended") {
                throw new Error("Workflow suspended");
            }
            throw new Error(result.error || "Workflow execution failed");
        }
    });

    const workflow = createWorkflow({
        id: dbWorkflow.slug,
        description: dbWorkflow.description || "",
        inputSchema: z.any(),
        outputSchema: z.any()
    })
        .then(step)
        .commit();
    return workflow as unknown;
}

export async function buildNetworkAgent(networkId: string) {
    const network = await prisma.network.findUnique({
        where: { id: networkId },
        include: {
            primitives: true,
            workspace: { select: { organizationId: true } }
        }
    });

    if (!network) {
        throw new Error(`Network '${networkId}' not found`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agents: Record<string, Agent<any, any, any, any>> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workflows: Record<string, any> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: Record<string, any> = {};

    const toolIds = network.primitives
        .filter((primitive) => primitive.primitiveType === "tool" && primitive.toolId)
        .map((primitive) => primitive.toolId as string);
    const organizationId = network.workspace?.organizationId || null;
    const resolvedTools =
        toolIds.length > 0 ? await getToolsByNamesAsync(toolIds, organizationId) : {};

    for (const primitive of network.primitives) {
        if (primitive.primitiveType === "agent" && primitive.agentId) {
            const { agent, record } = await agentResolver.resolve({
                id: primitive.agentId,
                fallbackToSystem: true,
                requestContext: organizationId
                    ? { resource: { tenantId: organizationId } }
                    : undefined
            });
            const key = record?.slug || primitive.agentId;
            agents[key] = agent;
        }
        if (primitive.primitiveType === "workflow" && primitive.workflowId) {
            const wrapper = (await buildWorkflowWrapper(primitive.workflowId)) as {
                id: string;
            } | null;
            if (wrapper) {
                workflows[wrapper.id] = wrapper;
            }
        }
        if (primitive.primitiveType === "tool" && primitive.toolId) {
            const tool = resolvedTools[primitive.toolId];
            if (tool) {
                tools[primitive.toolId] = tool;
            }
        }
    }

    const model = `${network.modelProvider}/${network.modelName}`;
    const memory = buildNetworkMemory(network.memoryConfig as Record<string, unknown>);

    const routingAgent = new Agent({
        id: network.id,
        name: network.name,
        description: network.description || undefined,
        instructions: network.instructions,
        model,
        agents,
        workflows,
        tools,
        memory
    } as ConstructorParameters<typeof Agent>[0]);

    return { network, agent: routingAgent };
}
