export interface VersionSnapshot {
    name?: string;
    description?: string;
    instructions?: string;
    instructionsTemplate?: string;
    modelProvider?: string;
    modelName?: string;
    temperature?: number;
    maxTokens?: number;
    modelConfig?: Record<string, unknown>;
    memoryEnabled?: boolean;
    memoryConfig?: Record<string, unknown>;
    maxSteps?: number;
    scorers?: string[];
    tools?: Array<{ toolId: string; config?: Record<string, unknown> }>;
    skills?: Array<{ skillId: string; pinned?: boolean }>;
    isPublic?: boolean;
    metadata?: Record<string, unknown>;
}

export interface VersionStats {
    runs: number;
    successRate: number;
    avgQuality: number;
    totalCost: number;
    avgDurationMs: number | null;
    feedbackSummary: { thumbsUp: number; thumbsDown: number };
}

export interface ExperimentResult {
    winRate: number | null;
    gatingResult: string | null;
    status: string;
}

export interface AgentVersion {
    id: string;
    version: number;
    createdAt: string;
    createdBy: string;
    description: string;
    instructions: string;
    changes: string[];
    isActive: boolean;
    isRollback: boolean;
    previousVersion: number | null;
    modelProvider: string;
    modelName: string;
    snapshot: VersionSnapshot | null;
    stats: VersionStats;
    experimentResult: ExperimentResult | null;
}
