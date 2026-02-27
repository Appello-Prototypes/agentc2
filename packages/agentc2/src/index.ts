// Main Mastra instance
export { mastra } from "./mastra";

// Storage, Memory, and Vector
export { storage } from "./storage";
export { memory } from "./memory";
export { vector } from "./vector";

// Agents
export {
    assistantAgent,
    sidekickAgent,
    structuredAgent,
    schemas,
    visionAgent,
    visionAnalysisSchema,
    researchAgent,
    researchTools,
    mcpAgent,
    createMcpAgent,
    // Agent factory for stored agents
    createAgentFromConfig,
    createAgentFromConfigAsync,
    availableModels,
    getAvailableModels,
    getAvailableModelsAsync,
    // Agent resolver for database-driven agents
    AgentResolver,
    agentResolver,
    BudgetExceededError,
    // Model routing
    classifyComplexity,
    resolveRoutingDecision,
    resolveModelOverride
} from "./agents";
export type {
    StoredAgentConfig,
    RequestContext,
    ResolveOptions,
    HydratedAgent,
    AgentRecordWithTools,
    ActiveSkillInfo,
    RoutingConfig,
    RoutingTier,
    RoutingDecision
} from "./agents";

// Model provider resolver (org-scoped AI API keys)
export {
    resolveModelForOrg,
    getOrgApiKey,
    hasOrgApiKey,
    getAiProviderStatus,
    getFastCompressionModel
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
    truncateMcpResult,
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

// Scorers (Mastra-native scorer factory)
export {
    evaluateHelpfulness,
    evaluateCodeQuality,
    // Scorecard system
    DEFAULT_SCORECARD_CRITERIA,
    validateCriteriaWeights,
    computeWeightedScore,
    runTier2Auditor,
    buildAuditorPrompt,
    runTier1Prescreen,
    shouldRunTier2,
    normalizeTier1ToScorecard,
    generateScorecard,
    SCORECARD_TEMPLATES,
    // Scorer factory (Mastra-native primitives)
    buildBulkScorecardScorer,
    buildHeuristicScorer,
    getPrebuiltScorers,
    runAllScorers,
    generateAAR,
    formatForAgentScorer
} from "./scorers";
export type {
    ScorecardCriterion,
    AuditorOutput,
    Tier1Result,
    Tier2Result,
    EvalContext,
    CriterionResult,
    SkillAttribution,
    TurnEvaluation,
    AarOutput,
    ScorecardTemplateDefinition,
    ScorerResults
} from "./scorers";

// Tools
export {
    dateTimeTool,
    calculatorTool,
    generateIdTool,
    tools,
    webFetchTool,
    memoryRecallTool,
    createScopedMemoryRecallTool,
    workflowTriggerTool,
    jsonParserTool,
    askQuestionsTool,
    extendedTools,
    // Tool registry for stored agents
    mcpToolDefinitions,
    mcpToolRoutes,
    toolRegistry,
    toolCategoryMap,
    toolCategoryOrder,
    toolBehaviorMap,
    listAvailableTools,
    getToolsByNames,
    getToolsByNamesAsync,
    getToolByName,
    hasToolInRegistry,
    getAllMcpTools,
    invalidateMcpToolsCacheForOrg
} from "./tools";
export type { ToolInfo, ToolBehaviorType, ToolBehaviorMeta } from "./tools";

// Outlook Mail tools
export {
    outlookMailListEmailsTool,
    outlookMailGetEmailTool,
    outlookMailSendEmailTool,
    outlookMailArchiveEmailTool
} from "./tools/outlook-mail";

// Outlook Calendar tools
export {
    outlookCalendarListEventsTool,
    outlookCalendarGetEventTool,
    outlookCalendarCreateEventTool,
    outlookCalendarUpdateEventTool
} from "./tools/outlook-calendar";

// Dropbox tools
export {
    dropboxListFilesTool,
    dropboxGetFileTool,
    dropboxUploadFileTool,
    dropboxSearchFilesTool,
    dropboxGetSharingLinksTool
} from "./tools/dropbox";

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

// Guardrails
export {
    enforceInputGuardrails,
    enforceOutputGuardrails,
    getExecutionLimits,
    type GuardrailConfig,
    type GuardrailResult
} from "./guardrails";
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
    ragIndexExists,
    ingestDocument,
    queryRag,
    ragGenerate,
    ragGenerateStream,
    deleteDocument,
    listDocuments,
    keywordSearch,
    reciprocalRankFusion,
    rerankResults,
    type DocumentType,
    type ChunkOptions
} from "./rag";

// Documents (first-class primitive)
export {
    createDocument as createDocumentRecord,
    updateDocument as updateDocumentRecord,
    deleteDocument as deleteDocumentRecord,
    getDocument as getDocumentRecord,
    listDocuments as listDocumentRecords,
    searchDocuments as searchDocumentRecords,
    reembedDocument,
    getDocumentVersions,
    type CreateDocumentInput,
    type UpdateDocumentInput,
    type ListDocumentsInput,
    type SearchDocumentsInput
} from "./documents";

// Skills (first-class primitive)
export {
    createSkill,
    updateSkill,
    deleteSkill,
    getSkill,
    listSkills,
    attachDocument as skillAttachDocument,
    detachDocument as skillDetachDocument,
    attachTool as skillAttachTool,
    detachTool as skillDetachTool,
    attachToAgent as skillAttachToAgent,
    detachFromAgent as skillDetachFromAgent,
    getSkillVersions,
    forkSkill,
    getThreadSkillState,
    addThreadSkillActivations,
    setThreadSkillState,
    clearThreadSkillState,
    generateSkillForMcpServer,
    mcpSkillExists,
    getMcpSkillSlug,
    recommendSkills,
    type CreateSkillInput,
    type UpdateSkillInput,
    type ListSkillsInput
} from "./skills";

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

// Integrations (MCP OAuth, Auto-provisioning, Blueprints)
export {
    discoverAuthServer,
    buildMcpAuthorizationUrl,
    exchangeMcpCodeForTokens,
    refreshMcpAccessToken,
    tokenNeedsRefresh,
    tokenIsExpired,
    provisionIntegration,
    deprovisionIntegration,
    syncBlueprintVersions,
    rediscoverToolsForConnection,
    getBlueprint,
    getAllBlueprints,
    hasBlueprint,
    getBlueprintCount
} from "./integrations";
export type {
    McpAuthServerMetadata,
    McpOAuthTokens,
    McpOAuthStartResult,
    IntegrationBlueprint,
    ProvisionResult,
    DeprovisionResult,
    BlueprintSyncResult,
    ToolRediscoveryResult
} from "./integrations";

// Crypto (platform-wide security primitives)
export {
    encrypt,
    decrypt,
    encryptJson,
    decryptJson,
    signPayload,
    verifySignature,
    provisionOrgKeyPair,
    getActiveOrgKeyPair,
    rotateOrgKeyPair,
    revokeOrgKeyPairs,
    getOrgPublicKey
} from "./crypto";
export type { EncryptedPayload, OrgKeyPair } from "./crypto";

// Audit (platform-wide logging)
export { writeAuditLog, writeAuditLogAsync, queryAuditLogs } from "./audit";
export type { AuditEntry, AuditQueryOptions } from "./audit";

// Federation (cross-org agent communication)
export {
    requestConnection,
    approveConnection,
    suspendConnection,
    revokeConnection,
    listConnections,
    processInvocation,
    discoverFederatedAgents,
    getFederatedTools,
    invalidateFederationToolsCache,
    isFederatedToolId,
    parseFederatedToolId,
    evaluatePolicy
} from "./federation";
export type {
    AgentCard,
    FederationInvokeRequest,
    FederationInvokeResponse,
    ConnectionRequest,
    ConnectionApproval,
    AgreementSummary
} from "./federation";

// Budget management
export {
    BudgetEnforcementService,
    budgetEnforcement,
    calculateMarkup,
    calculateBilledCost,
    getPlatformMarkupRate
} from "./budget";
export type {
    BudgetCheckResult,
    BudgetCheckContext,
    BudgetViolation,
    MarkupResult
} from "./budget";

// Managed multi-step generation with context windowing
export { managedGenerate } from "./lib/managed-generate";
export type {
    ManagedGenerateOptions,
    ManagedGenerateResult,
    ContextConfig,
    StepSummary
} from "./lib/managed-generate";

// Phase-based task decomposition
export { runPhases } from "./lib/phase-runner";
export type { Phase, PhaseResult, PhaseRunnerOptions, PhaseRunResult } from "./lib/phase-runner";

// Tenant isolation helpers
export {
    orgScopedResourceId,
    orgScopedThreadId,
    parseOrgScopedResourceId,
    extractOrgFromScopedId
} from "./tenant-scope";

// Agent Sessions (Mesh Communication)
export {
    createSession,
    getSession,
    readScratchpad,
    writeScratchpad,
    recordPeerCall,
    recordParticipantInvocation,
    completeSession,
    type CreateSessionOptions,
    type SessionInfo
} from "./sessions";

// Communication Policy (Governance)
export {
    evaluateCommunicationPolicy,
    type CommunicationRule,
    type PolicyEvaluationContext,
    type PolicyDecision
} from "./governance";

// Tenant lifecycle (org deletion cleanup)
export { cleanupOrgVectors } from "./tenant-lifecycle";

// Playbook Marketplace
export {
    packagePlaybook,
    deployPlaybook,
    uninstallPlaybook,
    sanitizeManifest,
    detectHardcodedUrls,
    validateManifest,
    isValidManifest,
    playbookManifestSchema,
    mapIntegrations,
    deployStarterKit
} from "./playbooks";
export type {
    PlaybookManifest,
    PackagePlaybookOptions,
    DeployPlaybookOptions,
    AgentSnapshot,
    SkillSnapshot,
    DocumentSnapshot as PlaybookDocumentSnapshot,
    WorkflowSnapshot,
    NetworkSnapshot,
    CampaignTemplateSnapshot,
    GuardrailSnapshot,
    TestCaseSnapshot,
    ScorecardSnapshot,
    IntegrationMapping
} from "./playbooks";

// Re-export useful types from @mastra/core
export type { Agent } from "@mastra/core/agent";
export type { Mastra } from "@mastra/core/mastra";
