import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { prisma } from "@repo/database";
import { agentResolver, type RequestContext } from "../agents/resolver";
import { storage } from "../storage";
import { vector } from "../vector";
import { getToolsByNamesAsync } from "../tools/registry";
import { executeWorkflowDefinition, type WorkflowDefinition } from "../workflows/builder";

/**
 * Build memory for a network. Returns undefined when memory is disabled
 * to avoid requiring the memory_messages table when it's not needed.
 */
function buildNetworkMemory(
    memoryConfig: Record<string, unknown> | null | undefined
): Memory | undefined {
    // Guard: if no config or all memory features are disabled, skip Memory creation
    if (!memoryConfig) return undefined;

    const lastMessages = memoryConfig.lastMessages;
    const semanticRecall = memoryConfig.semanticRecall;
    const workingMemory = memoryConfig.workingMemory as { enabled?: boolean } | undefined | null;

    const memoryDisabled =
        (lastMessages === 0 || lastMessages === undefined) &&
        (semanticRecall === false || semanticRecall === undefined) &&
        (!workingMemory || workingMemory.enabled === false);

    if (memoryDisabled) {
        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {};
    if (lastMessages !== undefined) {
        options.lastMessages = lastMessages;
    }
    if (semanticRecall !== undefined) {
        options.semanticRecall = semanticRecall;
    }
    if (workingMemory !== undefined) {
        options.workingMemory = workingMemory;
    }

    const hasSemanticRecall =
        semanticRecall !== undefined &&
        semanticRecall !== false &&
        typeof semanticRecall === "object";

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

/**
 * Wrap a database workflow as a Mastra workflow step for use in a network.
 * Accepts optional requestContext so MCP tools inside the workflow
 * can resolve org-scoped connections.
 */
async function buildWorkflowWrapper(workflowId: string, requestContext?: RequestContext) {
    const dbWorkflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!dbWorkflow?.definitionJson) {
        console.warn(
            `[NetworkRuntime] Workflow wrapper: workflow "${workflowId}" not found or has no definition`
        );
        return null;
    }

    const step = createStep({
        id: `db-workflow-${dbWorkflow.slug}`,
        description: dbWorkflow.description || `Database workflow: ${dbWorkflow.slug}`,
        inputSchema: z.any(),
        outputSchema: z.any(),
        execute: async ({ inputData }) => {
            const result = await executeWorkflowDefinition({
                definition: dbWorkflow.definitionJson as unknown as WorkflowDefinition,
                input: inputData,
                requestContext
            });
            if (result.status === "success") {
                return result.output;
            }
            if (result.status === "suspended") {
                // Return structured suspension instead of throwing
                return {
                    _suspended: true,
                    stepId: result.suspended?.stepId,
                    data: result.suspended?.data,
                    message: `Workflow "${dbWorkflow.slug}" is suspended at step "${result.suspended?.stepId}"`
                };
            }
            throw new Error(
                result.error || `Workflow "${dbWorkflow.slug}" (id: ${workflowId}) execution failed`
            );
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

    // Build requestContext for workflow wrappers
    const requestContext: RequestContext | undefined = organizationId
        ? { resource: { tenantId: organizationId } }
        : undefined;

    // Collect resolution errors for diagnostics
    const resolutionErrors: string[] = [];

    for (const primitive of network.primitives) {
        try {
            if (primitive.primitiveType === "agent" && primitive.agentId) {
                const { agent, record } = await agentResolver.resolve({
                    id: primitive.agentId,
                    fallbackToSystem: true,
                    requestContext
                });
                const key = record?.slug || primitive.agentId;
                agents[key] = agent;
            }
            if (primitive.primitiveType === "workflow" && primitive.workflowId) {
                const wrapper = (await buildWorkflowWrapper(
                    primitive.workflowId,
                    requestContext
                )) as {
                    id: string;
                } | null;
                if (wrapper) {
                    workflows[wrapper.id] = wrapper;
                } else {
                    resolutionErrors.push(
                        `Workflow "${primitive.workflowId}" could not be wrapped (no definition)`
                    );
                }
            }
            if (primitive.primitiveType === "tool" && primitive.toolId) {
                const tool = resolvedTools[primitive.toolId];
                if (tool) {
                    tools[primitive.toolId] = tool;
                } else {
                    resolutionErrors.push(`Tool "${primitive.toolId}" not found in registry`);
                }
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            resolutionErrors.push(
                `${primitive.primitiveType} "${primitive.agentId || primitive.workflowId || primitive.toolId}": ${msg}`
            );
        }
    }

    // Log any resolution issues
    if (resolutionErrors.length > 0) {
        console.warn(
            `[NetworkRuntime] Primitive resolution warnings for network "${network.slug}":\n` +
                resolutionErrors.map((e) => `  - ${e}`).join("\n")
        );
    }

    // Throw if nothing resolved at all
    const totalPrimitives =
        Object.keys(agents).length + Object.keys(workflows).length + Object.keys(tools).length;
    if (totalPrimitives === 0 && network.primitives.length > 0) {
        throw new Error(
            `Network "${network.slug}": all ${network.primitives.length} primitives failed to resolve. ` +
                `Errors: ${resolutionErrors.join("; ")}`
        );
    }

    const model = `${network.modelProvider}/${network.modelName}`;
    const memory = buildNetworkMemory(network.memoryConfig as Record<string, unknown> | null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentArgs: any = {
        id: network.id,
        name: network.name,
        description: network.description || undefined,
        instructions: network.instructions,
        model,
        agents,
        workflows,
        tools
    };

    // Only add memory if it was actually created
    if (memory) {
        agentArgs.memory = memory;
    }

    const routingAgent = new Agent(agentArgs);

    return { network, agent: routingAgent };
}
