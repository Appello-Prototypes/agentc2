import { JsonSchema } from "./types";

export const crudBaseResponseSchema: JsonSchema = {
    type: "object",
    properties: {
        success: { type: "boolean" },
        error: { type: "string" }
    }
};

export const modelConfigSchema: JsonSchema = {
    type: "object",
    properties: {
        reasoning: {
            type: "object",
            properties: { type: { type: "string", enum: ["enabled", "disabled"] } }
        },
        toolChoice: {
            oneOf: [
                { type: "string", enum: ["auto", "required", "none"] },
                {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["tool"] },
                        toolName: { type: "string" }
                    },
                    required: ["type", "toolName"]
                }
            ]
        },
        anthropic: {
            type: "object",
            description:
                "Anthropic-specific provider options (claude-sonnet-4-6, claude-opus-4-6, etc.)",
            properties: {
                thinking: {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["enabled", "adaptive", "disabled"] },
                        budgetTokens: { type: "number" }
                    }
                },
                effort: { type: "string", enum: ["max", "high", "medium", "low"] },
                speed: { type: "string", enum: ["fast", "standard"] },
                cacheControl: {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["ephemeral"] },
                        ttl: { type: "string" }
                    }
                },
                sendReasoning: { type: "boolean" },
                contextManagement: {
                    type: "object",
                    description:
                        "Context management for automatic context window management. Uses AI SDK types: clear_01 and compact_20260112.",
                    properties: {
                        edits: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: {
                                        type: "string",
                                        enum: ["clear_01", "compact_20260112"]
                                    },
                                    trigger: {
                                        type: "object",
                                        properties: {
                                            type: { type: "string", enum: ["input_tokens"] },
                                            value: { type: "number" }
                                        }
                                    },
                                    keep: {
                                        oneOf: [
                                            {
                                                type: "object",
                                                properties: {
                                                    type: {
                                                        type: "string",
                                                        enum: ["thinking_turns"]
                                                    },
                                                    value: { type: "number" }
                                                }
                                            },
                                            { type: "string", enum: ["all"] }
                                        ]
                                    },
                                    instructions: { type: "string" }
                                },
                                required: ["type"]
                            }
                        }
                    }
                }
            },
            additionalProperties: true
        },
        openai: {
            type: "object",
            description: "OpenAI-specific provider options (gpt-4o, o3, o4-mini, etc.)",
            properties: {
                parallelToolCalls: { type: "boolean" },
                reasoningEffort: { type: "string", enum: ["low", "medium", "high"] },
                structuredOutputMode: { type: "string", enum: ["auto", "strict", "compatible"] }
            },
            additionalProperties: true
        },
        thinking: {
            type: "object",
            description: "(Deprecated) Use anthropic.thinking instead",
            properties: {
                type: { type: "string", enum: ["enabled", "disabled"] },
                budget_tokens: { type: "number" }
            }
        },
        parallelToolCalls: {
            type: "boolean",
            description: "(Deprecated) Use openai.parallelToolCalls instead"
        },
        reasoningEffort: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "(Deprecated) Use openai.reasoningEffort instead"
        },
        cacheControl: {
            type: "object",
            description: "(Deprecated) Use anthropic.cacheControl instead",
            properties: { type: { type: "string", enum: ["ephemeral"] } }
        }
    },
    additionalProperties: true
};

export const memoryConfigSchema: JsonSchema = {
    type: "object",
    properties: {
        lastMessages: { type: "number" },
        semanticRecall: {
            oneOf: [
                { type: "boolean", enum: [false] },
                {
                    type: "object",
                    properties: {
                        topK: { type: "number" },
                        messageRange: { type: "number" }
                    },
                    additionalProperties: true
                }
            ]
        },
        workingMemory: {
            type: "object",
            properties: {
                enabled: { type: "boolean" },
                template: { type: "string" }
            },
            additionalProperties: true
        }
    },
    additionalProperties: true
};

export const agentToolBindingSchema: JsonSchema = {
    type: "object",
    properties: {
        toolId: { type: "string" },
        config: { type: "object", additionalProperties: true }
    },
    required: ["toolId"]
};

export const workflowDefinitionSchema: JsonSchema = {
    type: "object",
    properties: {
        steps: { type: "array", items: { type: "object", additionalProperties: true } }
    },
    required: ["steps"],
    additionalProperties: true
};

export const networkTopologySchema: JsonSchema = {
    type: "object",
    properties: {
        nodes: { type: "array", items: { type: "object", additionalProperties: true } },
        edges: { type: "array", items: { type: "object", additionalProperties: true } },
        viewport: { type: "object", additionalProperties: true }
    },
    required: ["nodes", "edges"],
    additionalProperties: true
};

export const networkPrimitiveSchema: JsonSchema = {
    type: "object",
    properties: {
        primitiveType: { type: "string", enum: ["agent", "workflow", "tool"] },
        agentId: { type: "string" },
        workflowId: { type: "string" },
        toolId: { type: "string" },
        description: { type: "string" },
        position: { type: "object", additionalProperties: true }
    },
    required: ["primitiveType"]
};

const modelConfigProperties =
    (modelConfigSchema as { properties?: Record<string, unknown> }).properties || {};

export const agentCreateInputSchema: JsonSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        slug: { type: "string" },
        description: { type: "string" },
        instructions: { type: "string" },
        instructionsTemplate: { type: "string" },
        modelProvider: { type: "string" },
        modelName: { type: "string" },
        temperature: { type: "number" },
        maxTokens: { type: "number" },
        modelConfig: modelConfigSchema,
        extendedThinking: {
            type: "boolean",
            description: "(Deprecated) Use adaptiveThinking for Sonnet 4.6/Opus 4.6"
        },
        thinkingBudget: {
            type: "number",
            description: "(Deprecated) Only used with extendedThinking"
        },
        adaptiveThinking: {
            type: "boolean",
            description: "Enable Anthropic adaptive thinking (recommended for Sonnet 4.6/Opus 4.6)"
        },
        thinkingEffort: {
            type: "string",
            enum: ["max", "high", "medium", "low"],
            description: "Anthropic thinking effort level (used with adaptiveThinking)"
        },
        parallelToolCalls: { type: "boolean" },
        reasoningEffort: { type: "string", enum: ["low", "medium", "high"] },
        cacheControl: { type: "boolean" },
        toolChoice: modelConfigProperties.toolChoice,
        reasoning: modelConfigProperties.reasoning,
        memoryEnabled: { type: "boolean" },
        memoryConfig: memoryConfigSchema,
        contextConfig: {
            type: "object",
            description:
                "Context window management config: {maxContextTokens, windowSize, toolResultCompression, providerContextEditing}",
            additionalProperties: true
        },
        maxSteps: { type: "number" },
        subAgents: { type: "array", items: { type: "string" } },
        workflows: { type: "array", items: { type: "string" } },
        toolIds: { type: "array", items: { type: "string" } },
        tools: { type: "array", items: agentToolBindingSchema },
        type: { type: "string", enum: ["USER"] },
        organizationId: { type: "string" },
        workspaceId: { type: "string" },
        ownerId: { type: "string" },
        visibility: { type: "string", enum: ["PRIVATE", "ORGANIZATION", "PUBLIC"] },
        requiresApproval: { type: "boolean" },
        maxSpendUsd: { type: "number" },
        metadata: { type: "object", additionalProperties: true },
        isActive: { type: "boolean" },
        createdBy: { type: "string" }
    },
    required: ["name", "instructions", "modelProvider", "modelName"],
    additionalProperties: true
};

export const agentUpdateInputSchema: JsonSchema = {
    type: "object",
    properties: {
        agentId: { type: "string" },
        restoreVersionId: { type: "string" },
        restoreVersion: { type: "number" },
        versionDescription: { type: "string" },
        createdBy: { type: "string" },
        data: agentCreateInputSchema
    },
    required: ["agentId"],
    additionalProperties: true
};

export const workflowCreateInputSchema: JsonSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        slug: { type: "string" },
        description: { type: "string" },
        definitionJson: workflowDefinitionSchema,
        compiledJson: { type: "object", additionalProperties: true },
        compiledAt: { type: "string" },
        compiledHash: { type: "string" },
        inputSchemaJson: { type: "object", additionalProperties: true },
        outputSchemaJson: { type: "object", additionalProperties: true },
        maxSteps: { type: "number" },
        timeout: { type: "number" },
        retryConfig: { type: "object", additionalProperties: true },
        isPublished: { type: "boolean" },
        isActive: { type: "boolean" },
        workspaceId: { type: "string" },
        ownerId: { type: "string" },
        type: { type: "string", enum: ["USER"] },
        versionDescription: { type: "string" },
        createdBy: { type: "string" }
    },
    required: ["name"],
    additionalProperties: true
};

export const workflowUpdateInputSchema: JsonSchema = {
    type: "object",
    properties: {
        workflowId: { type: "string" },
        restoreVersionId: { type: "string" },
        restoreVersion: { type: "number" },
        versionDescription: { type: "string" },
        createdBy: { type: "string" },
        data: workflowCreateInputSchema
    },
    required: ["workflowId"],
    additionalProperties: true
};

export const networkCreateInputSchema: JsonSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        slug: { type: "string" },
        description: { type: "string" },
        instructions: { type: "string" },
        modelProvider: { type: "string" },
        modelName: { type: "string" },
        temperature: { type: "number" },
        topologyJson: networkTopologySchema,
        memoryConfig: memoryConfigSchema,
        maxSteps: { type: "number" },
        isPublished: { type: "boolean" },
        isActive: { type: "boolean" },
        workspaceId: { type: "string" },
        ownerId: { type: "string" },
        type: { type: "string", enum: ["USER"] },
        primitives: { type: "array", items: networkPrimitiveSchema },
        versionDescription: { type: "string" },
        createdBy: { type: "string" }
    },
    required: ["name", "instructions", "modelProvider", "modelName"],
    additionalProperties: true
};

export const networkUpdateInputSchema: JsonSchema = {
    type: "object",
    properties: {
        networkId: { type: "string" },
        restoreVersionId: { type: "string" },
        restoreVersion: { type: "number" },
        versionDescription: { type: "string" },
        createdBy: { type: "string" },
        data: networkCreateInputSchema
    },
    required: ["networkId"],
    additionalProperties: true
};
