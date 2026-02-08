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
    getIntegrationProviders,
    getMcpTools,
    getMcpToolsForServer,
    exportMcpConfig,
    importMcpConfig,
    analyzeMcpConfigImpact,
    testMcpServer,
    getMcpToolsets,
    disconnectMcp,
    executeMcpTool,
    invalidateMcpCacheForOrg,
    resetMcpClients,
    listMcpToolDefinitions,
    MCP_SERVER_CONFIGS,
    type McpServerConfig,
    type McpServerTestPhase,
    type McpServerTestResult,
    type McpToolExecutionResult,
    type McpToolDefinition,
    type McpConfigImpact,
    type McpConfigImpactAgent,
    type McpConfigImpactServer
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
    mcpToolDefinitions,
    mcpToolRoutes,
    toolRegistry,
    listAvailableTools,
    getToolsByNames,
    getToolsByNamesAsync,
    getToolByName,
    hasToolInRegistry,
    getAllMcpTools,
    invalidateMcpToolsCacheForOrg
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

export { buildNetworkAgent } from "./networks/runtime";
export {
    buildNetworkTopologyFromPrimitives,
    isNetworkTopologyEmpty,
    type NetworkPrimitiveInput,
    type NetworkTopology
} from "./networks/topology";

export {
    executeWorkflowDefinition,
    type WorkflowDefinition,
    type WorkflowStep,
    type WorkflowExecutionResult,
    type WorkflowExecutionStep,
    type WorkflowExecutionContext,
    type WorkflowResumeInput
} from "./workflows/builder";

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

// BIM
export {
    ingestBimModel,
    ingestBimElementsForVersion,
    queryBimElements,
    ingestBimElementsToRag,
    queryBimHybrid,
    computeTakeoff,
    computeDiff,
    computeClashes,
    computeHandoverRegister,
    uploadBimObject,
    getBimObjectBuffer,
    headBimObject,
    parseIfcBuffer,
    ifcAdapter,
    speckleAdapter,
    csvAdapter
} from "./bim";
export type {
    BimAdapter,
    BimAdapterContext,
    BimElementNormalized,
    BimGeometrySummary,
    BimParsedModel,
    BimPropertyEntry,
    IfcParseOptions
} from "./bim";

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
