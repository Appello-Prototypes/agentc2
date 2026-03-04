export { assistantAgent } from "./assistant";
export { sidekickAgent } from "./sidekick";
export { structuredAgent, schemas } from "./structured";
export { visionAgent, visionAnalysisSchema } from "./vision";
export { researchAgent, researchTools } from "./research";

export { mcpAgent, createMcpAgent } from "./mcp-agent";
export {
    openaiVoiceAgent,
    elevenlabsVoiceAgent,
    hybridVoiceAgent,
    voiceProviders,
    openaiSpeakers
} from "./voice";

// Agent factory for stored agents
export {
    createAgentFromConfig,
    createAgentFromConfigAsync,
    availableModels,
    getAvailableModels,
    getAvailableModelsAsync
} from "./factory";
export type { StoredAgentConfig } from "./factory";

// Provider-aware model configuration types
export { supportsAdaptiveThinking } from "./model-config-types";
export type {
    ModelConfig,
    AnthropicProviderConfig,
    OpenAIProviderConfig,
    AnthropicThinkingConfig
} from "./model-config-types";

// Provider parameter schema for dynamic UI rendering
export {
    PROVIDER_PARAMS,
    SHARED_PARAMS,
    getParamsForProvider,
    getNestedValue,
    setNestedValue,
    isDependencyMet,
    cleanProviderConfig,
    getProvidersWithParams
} from "./model-params";
export type { ProviderParam, ProviderParamGroup, ProviderParamOption } from "./model-params";

// Model registry — centralized, API-driven model information
export {
    getModelsForApi,
    getAllModels,
    getModelsByProvider,
    getModelPricingFromRegistry,
    clearModelCache,
    resolveModelAlias,
    MODEL_ALIASES,
    FALLBACK_AVAILABLE_MODELS
} from "./model-registry";
export type {
    ModelDefinition,
    ModelProvider,
    ModelCategory,
    ModelCapabilities,
    ModelPricing
} from "./model-registry";

// Agent resolver for database-driven agents
export {
    AgentResolver,
    agentResolver,
    BudgetExceededError,
    classifyComplexity,
    resolveRoutingDecision,
    resolveModelOverride
} from "./resolver";
export type {
    RequestContext,
    ResolveOptions,
    HydratedAgent,
    AgentRecordWithTools,
    ActiveSkillInfo,
    RoutingConfig,
    RoutingTier,
    RoutingDecision
} from "./resolver";

// Model provider resolver for org-scoped API keys
export {
    resolveModelForOrg,
    getOrgApiKey,
    hasOrgApiKey,
    getAiProviderStatus,
    getFastCompressionModel
} from "./model-provider";
