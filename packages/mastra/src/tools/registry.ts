/**
 * Tool Registry
 *
 * Central registry of all available tools that can be attached to stored agents.
 * Tools are referenced by their registry key (e.g., "calculator", "web-fetch").
 * Also supports MCP tools dynamically via getMcpTools().
 */

import { gmailArchiveEmailTool } from "./gmail";
import { dateTimeTool, calculatorTool, generateIdTool } from "./example-tools";
import { webFetchTool } from "./web-fetch";
import { memoryRecallTool } from "./memory-recall";
import { jsonParserTool } from "./json-parser";
import {
    agentListTool,
    agentOverviewTool,
    agentAnalyticsTool,
    agentCostsTool,
    agentBudgetGetTool,
    agentBudgetUpdateTool
} from "./agent-operations-tools";
import {
    agentFeedbackSubmitTool,
    agentFeedbackListTool,
    agentGuardrailsGetTool,
    agentGuardrailsUpdateTool,
    agentGuardrailsEventsTool,
    agentTestCasesListTool,
    agentTestCasesCreateTool
} from "./agent-quality-tools";
import { agentRunCancelTool, agentRunRerunTool, agentRunTraceTool } from "./run-management-tools";
import {
    agentLearningSessionsTool,
    agentLearningStartTool,
    agentLearningSessionGetTool,
    agentLearningProposalApproveTool,
    agentLearningProposalRejectTool,
    agentLearningExperimentsTool,
    agentLearningMetricsTool,
    agentLearningPolicyTool
} from "./agent-learning-tools";
import {
    ragQueryTool,
    ragIngestTool,
    ragDocumentsListTool,
    ragDocumentDeleteTool
} from "./rag-tools";
import {
    agentSimulationsListTool,
    agentSimulationsStartTool,
    agentSimulationsGetTool
} from "./simulation-tools";
import {
    agentCreateTool,
    agentDeleteTool,
    agentReadTool,
    agentUpdateTool
} from "./agent-crud-tools";
import {
    workflowCreateTool,
    workflowDeleteTool,
    workflowReadTool,
    workflowUpdateTool
} from "./workflow-crud-tools";
import {
    triggerUnifiedListTool,
    triggerUnifiedGetTool,
    triggerUnifiedCreateTool,
    triggerUnifiedUpdateTool,
    triggerUnifiedDeleteTool,
    triggerUnifiedEnableTool,
    triggerUnifiedDisableTool
} from "./trigger-tools";
import {
    networkCreateTool,
    networkDeleteTool,
    networkReadTool,
    networkUpdateTool
} from "./network-crud-tools";
import {
    workflowExecuteTool,
    workflowGetRunTool,
    workflowListRunsTool,
    workflowResumeTool,
    workflowMetricsTool,
    workflowVersionsTool,
    workflowStatsTool
} from "./workflow-tools";
import {
    networkExecuteTool,
    networkGetRunTool,
    networkListRunsTool,
    networkMetricsTool,
    networkVersionsTool,
    networkStatsTool
} from "./network-tools";
import {
    metricsLiveSummaryTool,
    metricsAgentAnalyticsTool,
    metricsAgentRunsTool,
    metricsWorkflowDailyTool,
    metricsNetworkDailyTool,
    liveRunsTool,
    liveMetricsTool,
    liveStatsTool,
    auditLogsListTool
} from "./metrics-tools";
import {
    bimQueryTool,
    bimTakeoffTool,
    bimDiffTool,
    bimClashTool,
    bimHandoverTool
} from "./bim-tools";
import { workspaceIntentRecommendationTool } from "./workspace-intent-tools";
import { webhookListAgentsTool, webhookCreateTool } from "./webhook-tools";
import {
    integrationImportMcpJsonTool,
    integrationMcpConfigTool,
    integrationConnectionTestTool,
    integrationProvidersListTool,
    integrationConnectionsListTool,
    integrationConnectionCreateTool
} from "./integration-import-tools";
import {
    orgListTool,
    orgGetTool,
    orgMembersListTool,
    orgMemberAddTool,
    orgWorkspacesListTool,
    orgWorkspaceCreateTool
} from "./organization-tools";
import { goalCreateTool, goalListTool, goalGetTool } from "./goal-tools";
import {
    documentCreateTool,
    documentReadTool,
    documentUpdateTool,
    documentDeleteTool,
    documentListTool,
    documentSearchTool
} from "./document-tools";
import {
    skillCreateTool,
    skillReadTool,
    skillUpdateTool,
    skillDeleteTool,
    skillListTool,
    skillAttachDocumentTool,
    skillDetachDocumentTool,
    skillAttachToolTool,
    skillDetachToolTool,
    agentAttachSkillTool,
    agentDetachSkillTool
} from "./skill-tools";
import {
    canvasCreateTool,
    canvasReadTool,
    canvasUpdateTool,
    canvasDeleteTool,
    canvasListTool,
    canvasQueryPreviewTool,
    canvasListBlocksTool
} from "./canvas-tools";
import { askQuestionsTool } from "./ask-questions";
import { getMcpTools } from "../mcp/client";

/**
 * Tool registry mapping names to tool instances.
 * Add new tools here to make them available for stored agents.
 * Using Record<string, unknown> to avoid complex Mastra Tool typing issues.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toolRegistry: Record<string, any> = {
    // Example tools
    "date-time": dateTimeTool,
    calculator: calculatorTool,
    "generate-id": generateIdTool,

    // Utility tools
    "web-fetch": webFetchTool,
    "memory-recall": memoryRecallTool,
    "json-parser": jsonParserTool,

    // CRUD tools
    "agent-create": agentCreateTool,
    "agent-read": agentReadTool,
    "agent-update": agentUpdateTool,
    "agent-delete": agentDeleteTool,
    "workflow-create": workflowCreateTool,
    "workflow-read": workflowReadTool,
    "workflow-update": workflowUpdateTool,
    "workflow-delete": workflowDeleteTool,
    "network-create": networkCreateTool,
    "network-read": networkReadTool,
    "network-update": networkUpdateTool,
    "network-delete": networkDeleteTool,

    // Workflow and network tools
    "workflow-execute": workflowExecuteTool,
    "workflow-list-runs": workflowListRunsTool,
    "workflow-get-run": workflowGetRunTool,
    "workflow-resume": workflowResumeTool,
    "workflow-metrics": workflowMetricsTool,
    "workflow-versions": workflowVersionsTool,
    "workflow-stats": workflowStatsTool,
    "network-execute": networkExecuteTool,
    "network-list-runs": networkListRunsTool,
    "network-get-run": networkGetRunTool,
    "network-metrics": networkMetricsTool,
    "network-versions": networkVersionsTool,
    "network-stats": networkStatsTool,

    // Trigger tools
    "trigger-unified-list": triggerUnifiedListTool,
    "trigger-unified-get": triggerUnifiedGetTool,
    "trigger-unified-create": triggerUnifiedCreateTool,
    "trigger-unified-update": triggerUnifiedUpdateTool,
    "trigger-unified-delete": triggerUnifiedDeleteTool,
    "trigger-unified-enable": triggerUnifiedEnableTool,
    "trigger-unified-disable": triggerUnifiedDisableTool,

    // Agent operations
    "agent-list": agentListTool,
    "agent-overview": agentOverviewTool,
    "agent-analytics": agentAnalyticsTool,
    "agent-costs": agentCostsTool,
    "agent-budget-get": agentBudgetGetTool,
    "agent-budget-update": agentBudgetUpdateTool,

    // Agent quality and safety
    "agent-feedback-submit": agentFeedbackSubmitTool,
    "agent-feedback-list": agentFeedbackListTool,
    "agent-guardrails-get": agentGuardrailsGetTool,
    "agent-guardrails-update": agentGuardrailsUpdateTool,
    "agent-guardrails-events": agentGuardrailsEventsTool,
    "agent-test-cases-list": agentTestCasesListTool,
    "agent-test-cases-create": agentTestCasesCreateTool,

    // Run management
    "agent-run-cancel": agentRunCancelTool,
    "agent-run-rerun": agentRunRerunTool,
    "agent-run-trace": agentRunTraceTool,

    // Learning system
    "agent-learning-sessions": agentLearningSessionsTool,
    "agent-learning-start": agentLearningStartTool,
    "agent-learning-session-get": agentLearningSessionGetTool,
    "agent-learning-proposal-approve": agentLearningProposalApproveTool,
    "agent-learning-proposal-reject": agentLearningProposalRejectTool,
    "agent-learning-experiments": agentLearningExperimentsTool,
    "agent-learning-metrics": agentLearningMetricsTool,
    "agent-learning-policy": agentLearningPolicyTool,

    // RAG pipeline
    "rag-query": ragQueryTool,
    "rag-ingest": ragIngestTool,
    "rag-documents-list": ragDocumentsListTool,
    "rag-document-delete": ragDocumentDeleteTool,

    // Simulations
    "agent-simulations-list": agentSimulationsListTool,
    "agent-simulations-start": agentSimulationsStartTool,
    "agent-simulations-get": agentSimulationsGetTool,

    // Metrics tools
    "metrics-live-summary": metricsLiveSummaryTool,
    "metrics-agent-analytics": metricsAgentAnalyticsTool,
    "metrics-agent-runs": metricsAgentRunsTool,
    "metrics-workflow-daily": metricsWorkflowDailyTool,
    "metrics-network-daily": metricsNetworkDailyTool,
    "live-runs": liveRunsTool,
    "live-metrics": liveMetricsTool,
    "live-stats": liveStatsTool,
    "audit-logs-list": auditLogsListTool,

    // Workspace intent tools
    "workspace-intent-recommendation": workspaceIntentRecommendationTool,

    // BIM tools
    "bim-query": bimQueryTool,
    "bim-takeoff": bimTakeoffTool,
    "bim-diff": bimDiffTool,
    "bim-clash": bimClashTool,
    "bim-handover": bimHandoverTool,

    // Webhook tools
    "webhook-list-agents": webhookListAgentsTool,
    "webhook-create": webhookCreateTool,

    // MCP import tools
    "integration-import-mcp-json": integrationImportMcpJsonTool,
    "integration-mcp-config": integrationMcpConfigTool,
    "integration-connection-test": integrationConnectionTestTool,
    "integration-providers-list": integrationProvidersListTool,
    "integration-connections-list": integrationConnectionsListTool,
    "integration-connection-create": integrationConnectionCreateTool,

    // Organization tools
    "org-list": orgListTool,
    "org-get": orgGetTool,
    "org-members-list": orgMembersListTool,
    "org-member-add": orgMemberAddTool,
    "org-workspaces-list": orgWorkspacesListTool,
    "org-workspace-create": orgWorkspaceCreateTool,
    "goal-create": goalCreateTool,
    "goal-list": goalListTool,
    "goal-get": goalGetTool,

    // Document tools
    "document-create": documentCreateTool,
    "document-read": documentReadTool,
    "document-update": documentUpdateTool,
    "document-delete": documentDeleteTool,
    "document-list": documentListTool,
    "document-search": documentSearchTool,

    // Skill tools
    "skill-create": skillCreateTool,
    "skill-read": skillReadTool,
    "skill-update": skillUpdateTool,
    "skill-delete": skillDeleteTool,
    "skill-list": skillListTool,
    "skill-attach-document": skillAttachDocumentTool,
    "skill-detach-document": skillDetachDocumentTool,
    "skill-attach-tool": skillAttachToolTool,
    "skill-detach-tool": skillDetachToolTool,
    "agent-attach-skill": agentAttachSkillTool,
    "agent-detach-skill": agentDetachSkillTool,

    // Gmail tools
    "gmail-archive-email": gmailArchiveEmailTool,

    // Canvas tools
    "canvas-create": canvasCreateTool,
    "canvas-read": canvasReadTool,
    "canvas-update": canvasUpdateTool,
    "canvas-delete": canvasDeleteTool,
    "canvas-list": canvasListTool,
    "canvas-query-preview": canvasQueryPreviewTool,
    "canvas-list-blocks": canvasListBlocksTool,

    // Interactive UI tools
    "ask-questions": askQuestionsTool
};

/**
 * Get MCP tools (cached for performance)
 * Returns an empty object if MCP is not available
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cachedMcpToolsByOrg = new Map<string, { tools: Record<string, any>; loadedAt: number }>();
const MCP_CACHE_TTL = 60000; // 1 minute cache

export function invalidateMcpToolsCacheForOrg(organizationId?: string | null) {
    const cacheKey = organizationId || "__default__";
    cachedMcpToolsByOrg.delete(cacheKey);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMcpToolsCached(organizationId?: string | null): Promise<Record<string, any>> {
    const cacheKey = organizationId || "__default__";
    const now = Date.now();
    const cached = cachedMcpToolsByOrg.get(cacheKey);
    if (cached && now - cached.loadedAt < MCP_CACHE_TTL) {
        return cached.tools;
    }

    try {
        const tools = await getMcpTools(organizationId);
        cachedMcpToolsByOrg.set(cacheKey, { tools, loadedAt: now });
        return tools;
    } catch (error) {
        console.warn("[Tool Registry] Failed to load MCP tools:", error);
        return {};
    }
}

/**
 * Get tool metadata for UI display
 */
export interface ToolInfo {
    id: string;
    name: string;
    description: string;
}

/**
 * List all available tools with their metadata
 */
export function listAvailableTools(): ToolInfo[] {
    return Object.entries(toolRegistry).map(([id, tool]) => ({
        id,
        name: id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (tool as any).description || ""
    }));
}

/**
 * Get tools by their registry names (sync - static tools only)
 *
 * @param names - Array of tool registry names (e.g., ["calculator", "web-fetch"])
 * @returns Record of tool name to tool instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getToolsByNames(names: string[]): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};

    for (const name of names) {
        const tool = toolRegistry[name];
        if (tool) {
            result[name] = tool;
        }
    }

    return result;
}

/**
 * Get tools by their names (async - includes MCP tools)
 *
 * Checks both the static registry and MCP tools.
 * MCP tools are identified by underscore naming: serverName_toolName
 *
 * @param names - Array of tool names (e.g., ["calculator", "hubspot_hubspot-get-contacts"])
 * @returns Record of tool name to tool instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getToolsByNamesAsync(
    names: string[],
    organizationId?: string | null
): Promise<Record<string, any>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};

    // First, get static tools
    for (const name of names) {
        const tool = toolRegistry[name];
        if (tool) {
            result[name] = tool;
        }
    }

    // Find names not in static registry (likely MCP tools)
    const unresolvedNames = names.filter((name) => !result[name]);

    if (unresolvedNames.length > 0) {
        // Load MCP tools and check for matches
        const mcpTools = await getMcpToolsCached(organizationId);

        for (const name of unresolvedNames) {
            if (mcpTools[name]) {
                result[name] = mcpTools[name];
            }
        }
    }

    return result;
}

/**
 * Check if a tool exists in the registry
 */
export function hasToolInRegistry(name: string): boolean {
    return name in toolRegistry;
}

/**
 * Get a single tool by name
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getToolByName(name: string): any | undefined {
    return toolRegistry[name];
}

/**
 * Get all available MCP tools (cached)
 *
 * Use this to attach all MCP tools to MCP-enabled agents.
 * Returns an empty object if MCP is not available.
 *
 * @returns Record of MCP tool name to tool instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAllMcpTools(organizationId?: string | null): Promise<Record<string, any>> {
    return getMcpToolsCached(organizationId);
}
