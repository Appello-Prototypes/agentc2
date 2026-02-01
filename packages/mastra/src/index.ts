// Main Mastra instance
export { mastra } from "./mastra";

// Storage, Memory, and Vector
export { storage } from "./storage";
export { memory } from "./memory";
export { vector } from "./vector";

// Agents
export {
    assistantAgent,
    structuredAgent,
    schemas,
    visionAgent,
    visionAnalysisSchema,
    researchAgent,
    researchTools,
    evaluatedAgent,
    mcpAgent,
    createMcpAgent,
    // Agent factory for stored agents
    createAgentFromConfig,
    createAgentFromConfigAsync,
    availableModels,
    getAvailableModels,
    // Agent resolver for database-driven agents
    AgentResolver,
    agentResolver,
    // Network resolver for database-driven agent networks
    NetworkResolver,
    networkResolver
} from "./agents";
export type {
    StoredAgentConfig,
    RequestContext,
    ResolveOptions,
    HydratedAgent,
    AgentRecordWithTools
} from "./agents";

// MCP
export {
    mcpClient,
    getMcpTools,
    getMcpToolsets,
    disconnectMcp,
    executeMcpTool,
    listMcpToolDefinitions,
    MCP_SERVER_CONFIGS,
    type McpServerConfig,
    type McpToolExecutionResult,
    type McpToolDefinition
} from "./mcp";

// Scorers
export {
    relevancyScorer,
    toxicityScorer,
    completenessScorer,
    toneScorer,
    scorers,
    evaluateHelpfulness,
    evaluateCodeQuality,
    evaluators
} from "./scorers";

// Scorer registry for database-driven agents
export {
    scorerRegistry,
    listAvailableScorers,
    getScorersByNames,
    getScorerByName,
    hasScorerInRegistry
} from "./scorers/registry";
export type { ScorerInfo } from "./scorers/registry";

// Tools
export {
    dateTimeTool,
    calculatorTool,
    generateIdTool,
    tools,
    webFetchTool,
    memoryRecallTool,
    workflowTriggerTool,
    jsonParserTool,
    extendedTools,
    // Tool registry for stored agents
    toolRegistry,
    listAvailableTools,
    getToolsByNames,
    getToolsByNamesAsync,
    getToolByName,
    hasToolInRegistry
} from "./tools";
export type { ToolInfo } from "./tools";

// Workflows
export {
    analysisWorkflow,
    parallelWorkflow,
    branchWorkflow,
    foreachWorkflow,
    doWhileWorkflow,
    humanApprovalWorkflow
} from "./workflows";

// RAG
export {
    createDocument,
    chunkDocument,
    initializeRagIndex,
    ingestDocument,
    queryRag,
    ragGenerate,
    ragGenerateStream,
    deleteDocument,
    listDocuments,
    type DocumentType,
    type ChunkOptions
} from "./rag";

// Orchestrator (Background Agent)
export {
    goalStore,
    GoalStore,
    goalExecutor,
    GoalExecutor,
    getOrchestratorAgent,
    resetOrchestratorAgent,
    type Goal,
    type GoalScore,
    type ExecutionResult
} from "./orchestrator";

// Channels (WhatsApp, Telegram, Voice)
export {
    // Registry
    channelRegistry,
    getChannel,
    initializeChannels,
    shutdownChannels,
    // Clients
    WhatsAppClient,
    TelegramClient,
    TwilioVoiceClient,
    // Types
    type ChannelType,
    type ChannelStatus,
    type ChannelHandler,
    type IncomingMessage,
    type OutgoingMessage,
    type SendResult,
    type MessageHandler,
    type MessageMedia,
    type ChannelSession,
    type ChannelCredentials,
    type ChannelsConfig,
    type WhatsAppConfig,
    type TelegramConfig,
    type VoiceConfig,
    type VoiceCall,
    type VoiceCallRequest
} from "./channels";

// Re-export useful types from @mastra/core
export type { Agent } from "@mastra/core/agent";
export type { Mastra } from "@mastra/core/mastra";
