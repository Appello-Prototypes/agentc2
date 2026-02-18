export interface AgentCard {
    name: string;
    description: string | null;
    provider: {
        organization: string;
        orgSlug: string;
        platform: "AgentC2";
        url: string;
    };
    url: string;
    version: string;
    capabilities: {
        streaming: boolean;
        pushNotifications: boolean;
        stateTransitionHistory: boolean;
    };
    authentication: {
        schemes: string[];
        federationAgreementRequired: boolean;
    };
    skills: AgentCardSkill[];
    agentc2: {
        agentSlug: string;
        agentId: string;
        exposureId: string;
        exposedSkills: string[];
        dataClassification: string;
        rateLimit: { requestsPerHour: number };
    };
}

export interface AgentCardSkill {
    id: string;
    name: string;
    description: string;
    tags: string[];
    inputModes: string[];
    outputModes: string[];
}

export interface FederationInvokeRequest {
    agreementId: string;
    targetOrgSlug: string;
    targetAgentSlug: string;
    conversationId: string;
    message: string;
    contentType?: "text" | "structured" | "tool_result";
    structuredData?: Record<string, unknown>;
}

export interface FederationInvokeResponse {
    success: boolean;
    conversationId: string;
    response: string;
    contentType: string;
    latencyMs: number;
    messageId: string;
    policyResult: string;
    error?: string;
}

export interface ConnectionRequest {
    targetOrgSlug?: string;
    targetEmail?: string;
    exposedAgentIds?: string[];
    message?: string;
}

export interface ConnectionApproval {
    exposedAgentIds: string[];
    maxRequestsPerHour?: number;
    maxRequestsPerDay?: number;
    dataClassification?: string;
}
