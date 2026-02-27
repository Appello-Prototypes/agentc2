import { agentOpsToolDefinitions, agentOpsToolRoutes } from "./agent-ops";
import { agentOperationsToolDefinitions, agentOperationsToolRoutes } from "./agent-operations";
import { agentQualityToolDefinitions, agentQualityToolRoutes } from "./agent-quality";
import { agentLearningToolDefinitions, agentLearningToolRoutes } from "./agent-learning";
import { runManagementToolDefinitions, runManagementToolRoutes } from "./run-management";
import { ragToolDefinitions, ragToolRoutes } from "./rag";
import { simulationToolDefinitions, simulationToolRoutes } from "./simulations";
import { monitoringToolDefinitions, monitoringToolRoutes } from "./monitoring";
import { organizationToolDefinitions, organizationToolRoutes } from "./organization";
import { goalToolDefinitions, goalToolRoutes } from "./goals";
import { crudToolDefinitions, crudToolRoutes } from "./crud";
import { executionTriggerToolDefinitions, executionTriggerToolRoutes } from "./execution-triggers";
import { integrationToolDefinitions, integrationToolRoutes } from "./integrations";
import { networkConfigToolDefinitions, networkConfigToolRoutes } from "./network-config";
import { networkOpsToolDefinitions, networkOpsToolRoutes } from "./network-ops";
import { scheduleToolDefinitions, scheduleToolRoutes } from "./schedules";
import { triggerToolDefinitions, triggerToolRoutes } from "./triggers";
import { workflowConfigToolDefinitions, workflowConfigToolRoutes } from "./workflow-config";
import { workflowOpsToolDefinitions, workflowOpsToolRoutes } from "./workflow-ops";
import { documentToolDefinitions, documentToolRoutes } from "./documents";
import { skillToolDefinitions, skillToolRoutes } from "./skills";
import { campaignToolDefinitions, campaignToolRoutes } from "./campaigns";
import { sandboxToolDefinitions, sandboxToolRoutes } from "./sandbox";
import { infraToolDefinitions, infraToolRoutes } from "./infra";
import { backlogToolDefinitions, backlogToolRoutes } from "./backlog";
import { outputActionToolDefinitions, outputActionToolRoutes } from "./output-actions";
import { codingPipelineToolDefinitions, codingPipelineToolRoutes } from "./coding-pipeline";
import { remoteComputeToolDefinitions, remoteComputeToolRoutes } from "./remote-compute";
import { supportToolDefinitions, supportToolRoutes } from "./support";
import { orgGuardrailToolDefinitions, orgGuardrailToolRoutes } from "./org-guardrails";
import { platformDocsToolDefinitions, platformDocsToolRoutes } from "./platform-docs";
import { instanceToolDefinitions, instanceToolRoutes } from "./instances";
import { searchToolDefinitions, searchToolRoutes } from "./search";
import { sessionOpsToolDefinitions, sessionOpsToolRoutes } from "./session-ops";
import { pulseToolDefinitions, pulseToolRoutes } from "./pulse";
import type { McpToolDefinition, McpToolRoute } from "./types";

export type { McpToolDefinition, McpToolRoute } from "./types";
export * from "./shared";

export const mcpToolDefinitions: McpToolDefinition[] = [
    ...agentOperationsToolDefinitions,
    ...agentQualityToolDefinitions,
    ...agentLearningToolDefinitions,
    ...runManagementToolDefinitions,
    ...ragToolDefinitions,
    ...simulationToolDefinitions,
    ...monitoringToolDefinitions,
    ...organizationToolDefinitions,
    ...goalToolDefinitions,
    ...crudToolDefinitions,
    ...workflowOpsToolDefinitions,
    ...workflowConfigToolDefinitions,
    ...agentOpsToolDefinitions,
    ...networkOpsToolDefinitions,
    ...networkConfigToolDefinitions,
    ...scheduleToolDefinitions,
    ...triggerToolDefinitions,
    ...executionTriggerToolDefinitions,
    ...integrationToolDefinitions,
    ...documentToolDefinitions,
    ...skillToolDefinitions,
    ...campaignToolDefinitions,
    ...sandboxToolDefinitions,
    ...infraToolDefinitions,
    ...backlogToolDefinitions,
    ...outputActionToolDefinitions,
    ...codingPipelineToolDefinitions,
    ...remoteComputeToolDefinitions,
    ...supportToolDefinitions,
    ...orgGuardrailToolDefinitions,
    ...platformDocsToolDefinitions,
    ...instanceToolDefinitions,
    ...searchToolDefinitions,
    ...sessionOpsToolDefinitions,
    ...pulseToolDefinitions
];

export const mcpToolRoutes: McpToolRoute[] = [
    ...agentOperationsToolRoutes,
    ...agentQualityToolRoutes,
    ...agentLearningToolRoutes,
    ...runManagementToolRoutes,
    ...ragToolRoutes,
    ...simulationToolRoutes,
    ...monitoringToolRoutes,
    ...organizationToolRoutes,
    ...goalToolRoutes,
    ...crudToolRoutes,
    ...workflowOpsToolRoutes,
    ...workflowConfigToolRoutes,
    ...agentOpsToolRoutes,
    ...networkOpsToolRoutes,
    ...networkConfigToolRoutes,
    ...scheduleToolRoutes,
    ...triggerToolRoutes,
    ...executionTriggerToolRoutes,
    ...integrationToolRoutes,
    ...documentToolRoutes,
    ...skillToolRoutes,
    ...campaignToolRoutes,
    ...sandboxToolRoutes,
    ...infraToolRoutes,
    ...backlogToolRoutes,
    ...outputActionToolRoutes,
    ...codingPipelineToolRoutes,
    ...remoteComputeToolRoutes,
    ...supportToolRoutes,
    ...orgGuardrailToolRoutes,
    ...platformDocsToolRoutes,
    ...instanceToolRoutes,
    ...searchToolRoutes,
    ...sessionOpsToolRoutes,
    ...pulseToolRoutes
];
