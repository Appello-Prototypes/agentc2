export interface AgentSnapshot {
    slug: string;
    name: string;
    description: string | null;
    instructions: string;
    instructionsTemplate: string | null;
    modelProvider: string;
    modelName: string;
    temperature: number | null;
    maxTokens: number | null;
    modelConfig: unknown;
    routingConfig: unknown;
    contextConfig: unknown;
    subAgents: string[];
    workflows: string[];
    memoryEnabled: boolean;
    memoryConfig: unknown;
    maxSteps: number | null;
    scorers: string[];
    visibility: string;
    requiresApproval: boolean;
    maxSpendUsd: number | null;
    autoVectorize: boolean;
    deploymentMode: string | null;
    metadata: unknown;
    version: number;
    tools: AgentToolSnapshot[];
    skills: string[]; // skill slugs
    guardrail: GuardrailSnapshot | null;
    testCases: TestCaseSnapshot[];
    scorecard: ScorecardSnapshot | null;
}

export interface AgentToolSnapshot {
    toolId: string;
    config: unknown;
}

export interface SkillSnapshot {
    slug: string;
    name: string;
    description: string | null;
    instructions: string;
    examples: string | null;
    category: string | null;
    tags: string[];
    metadata: unknown;
    version: number;
    tools: SkillToolSnapshot[];
    documents: string[]; // document slugs
}

export interface SkillToolSnapshot {
    toolId: string;
}

export interface DocumentSnapshot {
    slug: string;
    name: string;
    description: string | null;
    content: string;
    contentType: string;
    category: string | null;
    tags: string[];
    metadata: unknown;
    version: number;
}

export interface WorkflowSnapshot {
    slug: string;
    name: string;
    description: string | null;
    definitionJson: unknown;
    inputSchemaJson: unknown;
    outputSchemaJson: unknown;
    maxSteps: number;
    timeout: number | null;
    retryConfig: unknown;
    version: number;
}

export interface NetworkSnapshot {
    slug: string;
    name: string;
    description: string | null;
    instructions: string;
    modelProvider: string;
    modelName: string;
    temperature: number | null;
    topologyJson: unknown;
    memoryConfig: unknown;
    maxSteps: number;
    version: number;
    primitives: NetworkPrimitiveSnapshot[];
}

export interface NetworkPrimitiveSnapshot {
    primitiveType: string;
    agentSlug: string | null;
    workflowSlug: string | null;
    toolId: string | null;
    description: string | null;
    position: unknown;
}

export interface GuardrailSnapshot {
    agentSlug: string;
    configJson: unknown;
    version: number;
}

export interface TestCaseSnapshot {
    agentSlug: string;
    name: string;
    inputText: string;
    expectedOutput: string | null;
    tags: string[];
}

export interface ScorecardSnapshot {
    agentSlug: string;
    criteria: unknown;
    version: number;
    samplingRate: number;
    auditorModel: string;
    evaluateTurns: boolean;
}

export interface CampaignTemplateSnapshot {
    slug: string;
    name: string;
    intent: string;
    endState: string;
    description: string | null;
    constraints: string[];
    restraints: string[];
    requireApproval: boolean;
    maxCostUsd: number | null;
    timeoutMinutes: number | null;
}

export interface PlaybookManifest {
    version: string;
    agents: AgentSnapshot[];
    skills: SkillSnapshot[];
    documents: DocumentSnapshot[];
    workflows: WorkflowSnapshot[];
    networks: NetworkSnapshot[];
    campaignTemplates: CampaignTemplateSnapshot[];
    guardrails: GuardrailSnapshot[];
    testCases: TestCaseSnapshot[];
    scorecards: ScorecardSnapshot[];
    requiredIntegrations: string[];
    entryPoint: { type: "agent" | "workflow" | "network"; slug: string };
}

export interface PackagePlaybookOptions {
    name: string;
    slug: string;
    description: string;
    category: string;
    tags?: string[];
    entryAgentId?: string;
    entryNetworkId?: string;
    entryWorkflowId?: string;
    includeSkills?: boolean;
    includeDocuments?: boolean;
    includeWorkflows?: string[];
    includeNetworks?: string[];
    organizationId: string;
    userId: string;
    pricingModel?: "FREE" | "ONE_TIME" | "SUBSCRIPTION" | "PER_USE";
    priceUsd?: number;
    monthlyPriceUsd?: number;
    perUsePriceUsd?: number;
    tagline?: string;
    coverImageUrl?: string;
    iconUrl?: string;
}

export interface IntegrationMapping {
    provider: string;
    connected: boolean;
    connectionId?: string;
}

export interface DeployPlaybookOptions {
    playbookId: string;
    versionNumber: number;
    targetOrgId: string;
    targetWorkspaceId: string;
    userId: string;
    purchaseId?: string;
    cleanSlugs?: boolean;
}
