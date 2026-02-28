/**
 * Tool Registry
 *
 * Central registry of all available tools that can be attached to stored agents.
 * Tools are referenced by their registry key (e.g., "calculator", "web-fetch").
 * Also supports MCP tools dynamically via getMcpTools().
 */

import {
    gmailArchiveEmailTool,
    gmailSearchEmailsTool,
    gmailReadEmailTool,
    gmailDraftEmailTool,
    gmailSendEmailTool
} from "./gmail";
import {
    googleCalendarSearchEventsTool,
    googleCalendarListEventsTool,
    googleCalendarGetEventTool,
    googleCalendarCreateEventTool,
    googleCalendarUpdateEventTool,
    googleCalendarDeleteEventTool
} from "./google-calendar";
import {
    googleDriveSearchFilesTool,
    googleDriveReadFileTool,
    googleDriveCreateDocTool
} from "./google-drive";
import {
    outlookMailListEmailsTool,
    outlookMailGetEmailTool,
    outlookMailSendEmailTool,
    outlookMailArchiveEmailTool
} from "./outlook-mail";
import {
    outlookCalendarListEventsTool,
    outlookCalendarGetEventTool,
    outlookCalendarCreateEventTool,
    outlookCalendarUpdateEventTool
} from "./outlook-calendar";
import {
    teamsListTeamsTool,
    teamsListChannelsTool,
    teamsSendChannelMessageTool,
    teamsListChatsTool,
    teamsSendChatMessageTool
} from "./teams";
import {
    dropboxListFilesTool,
    dropboxGetFileTool,
    dropboxUploadFileTool,
    dropboxSearchFilesTool,
    dropboxGetSharingLinksTool
} from "./dropbox";
import { dateTimeTool, calculatorTool, generateIdTool } from "./example-tools";
import { webFetchTool } from "./web-fetch";
import { webSearchTool, webScrapeTool } from "./web-search";
import {
    exaSearchTool,
    exaFindSimilarTool,
    exaGetContentsTool,
    exaResearchTool
} from "./exa-search";
import { braveSearchTool, braveLocalSearchTool, braveNewsSearchTool } from "./brave-search";
import { perplexityResearchTool, perplexitySearchTool } from "./perplexity-search";
import { smartSearchTool } from "./search-router";
import {
    stripeAcsCreateSessionTool,
    stripeAcsGetProductTool,
    stripeAcsListProductsTool
} from "./stripe-acs";
import { recordOutcomeTool, agentROITool } from "./outcome-tracking";
import {
    youtubeGetTranscriptTool,
    youtubeSearchVideosTool,
    youtubeAnalyzeVideoTool,
    youtubeIngestToKnowledgeTool
} from "./youtube";
import { memoryRecallTool } from "./memory-recall";
import { jsonParserTool } from "./json-parser";
import {
    agentListTool,
    agentOverviewTool,
    agentAnalyticsTool,
    agentCostsTool,
    agentBudgetGetTool,
    agentBudgetUpdateTool,
    agentDiscoverTool,
    agentInvokeDynamicTool
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
import {
    playbookSearchTool,
    playbookDetailTool,
    playbookListInstalledTool,
    playbookDeployTool
} from "./playbook";
import {
    communityListBoardsTool,
    communityCreateBoardTool,
    communityJoinBoardTool,
    communityBrowsePostsTool,
    communityBrowseFeedTool,
    communityCreatePostTool,
    communityReadPostTool,
    communityCommentTool,
    communityVoteTool,
    communityMyStatsTool
} from "./community-tools";
import {
    sessionCreateTool,
    sessionInvokePeerTool,
    sessionReadScratchpadTool,
    sessionWriteScratchpadTool
} from "./session-tools";
import { agentRunCancelTool, agentRunRerunTool, agentRunTraceTool } from "./run-management-tools";
import {
    agentLearningSessionsTool,
    agentLearningStartTool,
    agentLearningSessionGetTool,
    agentLearningProposalApproveTool,
    agentLearningProposalRejectTool,
    agentLearningExperimentsTool,
    agentLearningMetricsTool,
    agentLearningPolicyTool,
    agentLearningPolicyUpdateTool
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
    triggerUnifiedDisableTool,
    triggerTestTool,
    triggerExecuteTool
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
    integrationConnectionCreateTool,
    integrationConnectionUpdateTool,
    integrationConnectionDeleteTool
} from "./integration-import-tools";
import {
    orgListTool,
    orgGetTool,
    orgMembersListTool,
    orgMemberAddTool,
    orgWorkspacesListTool,
    orgWorkspaceCreateTool
} from "./organization-tools";
import {
    goalCreateTool,
    goalListTool,
    goalGetTool,
    goalUpdateTool,
    goalDeleteTool
} from "./goal-tools";
import {
    campaignCreateTool,
    campaignListTool,
    campaignGetTool,
    campaignUpdateTool,
    campaignDeleteTool,
    campaignWriteMissionsTool,
    campaignWritePlanTool,
    campaignWriteAarTool
} from "./campaign-tools";
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
    agentSkillUpdateTool,
    agentDetachSkillTool,
    skillGetVersionsTool
} from "./skill-tools";
import { askQuestionsTool } from "./ask-questions";
import { searchSkillsTool, activateSkillTool, listActiveSkillsTool } from "./skill-discovery-tools";
import {
    executeCodeTool,
    writeWorkspaceFileTool,
    readWorkspaceFileTool,
    listWorkspaceFilesTool
} from "./sandbox-tools";
import { trackResourceTool, listResourcesTool, destroyResourceTool } from "./infra-tools";
import {
    backlogGetTool,
    backlogAddTaskTool,
    backlogListTasksTool,
    backlogUpdateTaskTool,
    backlogCompleteTaskTool
} from "./backlog-tools";
import {
    submitSupportTicketTool,
    listMyTicketsTool,
    viewTicketDetailsTool,
    commentOnTicketTool
} from "./support";
import {
    agentRunsListTool,
    agentRunsGetTool,
    triggerEventsListTool,
    triggerEventsGetTool,
    agentEvaluationsListTool,
    agentEvaluationsRunTool,
    agentVersionsListTool
} from "./agent-ops-extra-tools";
import {
    scheduleCreateTool,
    scheduleListTool,
    scheduleUpdateTool,
    scheduleDeleteTool
} from "./schedule-tools";
import {
    sidekickListAgentsTool,
    sidekickListAutomationsTool,
    sidekickCreateScheduleTool,
    sidekickEditScheduleTool,
    sidekickToggleScheduleTool,
    sidekickDeleteScheduleTool,
    sidekickDescribeScheduleTool
} from "./sidekick-schedule-tools";
import {
    workflowGenerateTool,
    workflowValidateTool,
    workflowDesignerChatTool
} from "./workflow-config-tools";
import {
    networkGenerateTool,
    networkValidateTool,
    networkDesignerChatTool
} from "./network-config-tools";
import {
    cursorLaunchAgentTool,
    cursorGetStatusTool,
    cursorAddFollowupTool,
    cursorGetConversationTool,
    cursorPollUntilDoneTool
} from "./cursor-tools";
import { verifyBranchTool, waitForChecksTool } from "./verify-tools";
import {
    ingestTicketTool,
    dispatchCodingPipelineTool,
    updatePipelineStatusTool
} from "./coding-pipeline-tools";
import { ticketToGithubIssueTool } from "./ticket-to-github-issue";
import { lookupPipelineConfigTool } from "./pipeline-config-tools";
import { mergePullRequestTool, awaitDeployTool } from "./merge-deploy-tools";
import { githubAddIssueCommentTool } from "./github-issue-comment";
import { githubCreatePullRequestTool } from "./github-create-pr";
import { runScenariosTool, calculateTrustScoreTool } from "./scenario-tools";
import {
    provisionComputeTool,
    remoteExecuteTool,
    remoteFileTransferTool,
    teardownComputeTool
} from "./remote-compute-tools";
import { platformDocsTool } from "./platform-docs-tool";
import {
    instanceListTool,
    instanceGetTool,
    instanceCreateTool,
    instanceUpdateTool,
    instanceDeleteTool,
    instanceBindChannelTool,
    instanceUnbindChannelTool
} from "./instance-tools";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getMcpTools, truncateMcpResult } from "../mcp/client";

/**
 * Logical category for each built-in tool.
 * Used by the UI to group the flat list of 145+ tools into collapsible sections.
 */
export const toolCategoryMap: Record<string, string> = {
    // Utilities
    "date-time": "Utilities",
    calculator: "Utilities",
    "generate-id": "Utilities",
    "web-fetch": "Utilities",
    "web-search": "Utilities",
    "web-scrape": "Utilities",
    "memory-recall": "Utilities",

    // Search
    "exa-search": "Search",
    "exa-find-similar": "Search",
    "exa-get-contents": "Search",
    "exa-research": "Search",
    "brave-search": "Search",
    "brave-local-search": "Search",
    "brave-news-search": "Search",
    "perplexity-research": "Search",
    "perplexity-search": "Search",
    "smart-search": "Search",

    // Commerce
    "stripe-acs-create-session": "Commerce",
    "stripe-acs-get-product": "Commerce",
    "stripe-acs-list-products": "Commerce",
    "record-outcome": "Commerce",
    "agent-roi": "Commerce",

    // YouTube
    "youtube-get-transcript": "YouTube",
    "youtube-search-videos": "YouTube",
    "youtube-analyze-video": "YouTube",
    "youtube-ingest-to-knowledge": "YouTube",
    "json-parser": "Utilities",
    "ask-questions": "Utilities",
    "execute-code": "Code Execution",
    "write-workspace-file": "Code Execution",
    "read-workspace-file": "Code Execution",
    "list-workspace-files": "Code Execution",
    "track-resource": "Infrastructure",
    "list-resources": "Infrastructure",
    "destroy-resource": "Infrastructure",

    // Coding Pipeline
    "cursor-launch-agent": "Coding Pipeline",
    "cursor-get-status": "Coding Pipeline",
    "cursor-add-followup": "Coding Pipeline",
    "cursor-get-conversation": "Coding Pipeline",
    "cursor-poll-until-done": "Coding Pipeline",
    "verify-branch": "Coding Pipeline",
    "wait-for-checks": "Coding Pipeline",
    "ingest-ticket": "Coding Pipeline",
    "dispatch-coding-pipeline": "Coding Pipeline",
    "update-pipeline-status": "Coding Pipeline",
    "lookup-pipeline-config": "Coding Pipeline",
    "merge-pull-request": "Coding Pipeline",
    "github-add-issue-comment": "Coding Pipeline",
    "github-create-pull-request": "Coding Pipeline",
    "await-deploy": "Coding Pipeline",
    "run-scenarios": "Coding Pipeline",
    "calculate-trust-score": "Coding Pipeline",
    "ticket-to-github-issue": "Coding Pipeline",

    // Remote Compute
    "provision-compute": "Remote Compute",
    "remote-execute": "Remote Compute",
    "remote-file-transfer": "Remote Compute",
    "teardown-compute": "Remote Compute",
    "backlog-get": "Backlog",
    "backlog-add-task": "Backlog",
    "backlog-list-tasks": "Backlog",
    "backlog-update-task": "Backlog",
    "backlog-complete-task": "Backlog",

    // Agent Sessions (Mesh Communication)
    "session-create": "Agent Sessions",
    "session-invoke-peer": "Agent Sessions",
    "session-read-scratchpad": "Agent Sessions",
    "session-write-scratchpad": "Agent Sessions",

    // Agent Management
    "agent-create": "Agent Management",
    "agent-read": "Agent Management",
    "agent-update": "Agent Management",
    "agent-delete": "Agent Management",
    "agent-list": "Agent Management",
    "agent-overview": "Agent Management",
    "agent-analytics": "Agent Management",
    "agent-costs": "Agent Management",
    "agent-budget-get": "Agent Management",
    "agent-budget-update": "Agent Management",
    "agent-discover": "Agent Management",
    "agent-invoke-dynamic": "Agent Management",

    // Agent Quality & Runs
    "agent-feedback-submit": "Agent Quality & Runs",
    "agent-feedback-list": "Agent Quality & Runs",
    "agent-guardrails-get": "Agent Quality & Runs",
    "agent-guardrails-update": "Agent Quality & Runs",
    "agent-guardrails-events": "Agent Quality & Runs",
    "agent-test-cases-list": "Agent Quality & Runs",
    "agent-test-cases-create": "Agent Quality & Runs",
    "agent-scorers-list": "Agent Quality & Runs",
    "agent-run-cancel": "Agent Quality & Runs",
    "agent-run-rerun": "Agent Quality & Runs",
    "agent-run-trace": "Agent Quality & Runs",
    "agent-runs-list": "Agent Quality & Runs",
    "agent-runs-get": "Agent Quality & Runs",
    "agent-evaluations-list": "Agent Quality & Runs",
    "agent-evaluations-run": "Agent Quality & Runs",
    "agent-versions-list": "Agent Quality & Runs",

    // Learning & Simulations
    "agent-learning-sessions": "Learning & Simulations",
    "agent-learning-start": "Learning & Simulations",
    "agent-learning-session-get": "Learning & Simulations",
    "agent-learning-proposal-approve": "Learning & Simulations",
    "agent-learning-proposal-reject": "Learning & Simulations",
    "agent-learning-experiments": "Learning & Simulations",
    "agent-learning-metrics": "Learning & Simulations",
    "agent-learning-policy": "Learning & Simulations",
    "agent-learning-policy-update": "Learning & Simulations",
    "agent-simulations-list": "Learning & Simulations",
    "agent-simulations-start": "Learning & Simulations",
    "agent-simulations-get": "Learning & Simulations",

    // Workflows
    "workflow-create": "Workflows",
    "workflow-read": "Workflows",
    "workflow-update": "Workflows",
    "workflow-delete": "Workflows",
    "workflow-execute": "Workflows",
    "workflow-list-runs": "Workflows",
    "workflow-get-run": "Workflows",
    "workflow-resume": "Workflows",
    "workflow-metrics": "Workflows",
    "workflow-versions": "Workflows",
    "workflow-stats": "Workflows",
    "workflow-generate": "Workflows",
    "workflow-validate": "Workflows",
    "workflow-designer-chat": "Workflows",

    // Networks
    "network-create": "Networks",
    "network-read": "Networks",
    "network-update": "Networks",
    "network-delete": "Networks",
    "network-execute": "Networks",
    "network-list-runs": "Networks",
    "network-get-run": "Networks",
    "network-metrics": "Networks",
    "network-versions": "Networks",
    "network-stats": "Networks",
    "network-generate": "Networks",
    "network-validate": "Networks",
    "network-designer-chat": "Networks",

    // Triggers
    "trigger-unified-list": "Triggers",
    "trigger-unified-get": "Triggers",
    "trigger-unified-create": "Triggers",
    "trigger-unified-update": "Triggers",
    "trigger-unified-delete": "Triggers",
    "trigger-unified-enable": "Triggers",
    "trigger-unified-disable": "Triggers",
    "trigger-test": "Triggers",
    "trigger-execute": "Triggers",
    "trigger-events-list": "Triggers",
    "trigger-events-get": "Triggers",
    "schedule-create": "Triggers",
    "schedule-list": "Triggers",
    "schedule-update": "Triggers",
    "schedule-delete": "Triggers",
    "sidekick-list-agents": "Sidekick",
    "sidekick-list-automations": "Sidekick",
    "sidekick-create-schedule": "Sidekick",
    "sidekick-edit-schedule": "Sidekick",
    "sidekick-toggle-schedule": "Sidekick",
    "sidekick-delete-schedule": "Sidekick",
    "sidekick-describe-schedule": "Sidekick",

    // RAG & Knowledge
    "rag-query": "RAG & Knowledge",
    "rag-ingest": "RAG & Knowledge",
    "rag-documents-list": "RAG & Knowledge",
    "rag-document-delete": "RAG & Knowledge",

    // Documents
    "document-create": "Documents",
    "document-read": "Documents",
    "document-update": "Documents",
    "document-delete": "Documents",
    "document-list": "Documents",
    "document-search": "Documents",

    // Skills
    "skill-create": "Skills",
    "skill-read": "Skills",
    "skill-update": "Skills",
    "skill-delete": "Skills",
    "skill-list": "Skills",
    "skill-attach-document": "Skills",
    "skill-detach-document": "Skills",
    "skill-attach-tool": "Skills",
    "skill-detach-tool": "Skills",
    "agent-attach-skill": "Skills",
    "agent-detach-skill": "Skills",
    "skill-get-versions": "Skills",
    "search-skills": "Skills",
    "activate-skill": "Skills",
    "list-active-skills": "Skills",

    // Monitoring & Metrics
    "metrics-live-summary": "Monitoring & Metrics",
    "metrics-agent-analytics": "Monitoring & Metrics",
    "metrics-agent-runs": "Monitoring & Metrics",
    "metrics-workflow-daily": "Monitoring & Metrics",
    "metrics-network-daily": "Monitoring & Metrics",
    "live-runs": "Monitoring & Metrics",
    "live-metrics": "Monitoring & Metrics",
    "live-stats": "Monitoring & Metrics",
    "audit-logs-list": "Monitoring & Metrics",

    // Integrations
    "integration-import-mcp-json": "Integrations",
    "integration-mcp-config": "Integrations",
    "integration-connection-test": "Integrations",
    "integration-providers-list": "Integrations",
    "integration-connections-list": "Integrations",
    "integration-connection-create": "Integrations",
    "integration-connection-update": "Integrations",
    "integration-connection-delete": "Integrations",
    "webhook-list-agents": "Integrations",
    "webhook-create": "Integrations",

    // Organization
    "org-list": "Organization",
    "org-get": "Organization",
    "org-members-list": "Organization",
    "org-member-add": "Organization",
    "org-workspaces-list": "Organization",
    "org-workspace-create": "Organization",
    "goal-create": "Organization",
    "goal-list": "Organization",
    "goal-get": "Organization",
    "goal-update": "Organization",
    "goal-delete": "Organization",
    "campaign-create": "Campaigns",
    "campaign-list": "Campaigns",
    "campaign-get": "Campaigns",
    "campaign-update": "Campaigns",
    "campaign-delete": "Campaigns",
    "campaign-write-missions": "Campaigns",
    "campaign-write-plan": "Campaigns",
    "campaign-write-aar": "Campaigns",
    "tool-registry-list": "Utilities",
    "platform-docs": "Platform Documentation",
    "instance-list": "Agent Instances",
    "instance-get": "Agent Instances",
    "instance-create": "Agent Instances",
    "instance-update": "Agent Instances",
    "instance-delete": "Agent Instances",
    "instance-bind-channel": "Agent Instances",
    "instance-unbind-channel": "Agent Instances",
    "workspace-intent-recommendation": "Organization",

    // Email & Calendar
    "gmail-archive-email": "Email & Calendar",
    "gmail-search-emails": "Email & Calendar",
    "gmail-read-email": "Email & Calendar",
    "gmail-draft-email": "Email & Calendar",
    "gmail-send-email": "Email & Calendar",
    "google-calendar-search-events": "Email & Calendar",
    "google-calendar-list-events": "Email & Calendar",
    "google-calendar-get-event": "Email & Calendar",
    "google-calendar-create-event": "Email & Calendar",
    "google-calendar-update-event": "Email & Calendar",
    "google-calendar-delete-event": "Email & Calendar",
    "outlook-mail-list-emails": "Email & Calendar",
    "outlook-mail-get-email": "Email & Calendar",
    "outlook-mail-send-email": "Email & Calendar",
    "outlook-mail-archive-email": "Email & Calendar",
    "outlook-calendar-list-events": "Email & Calendar",
    "outlook-calendar-get-event": "Email & Calendar",
    "outlook-calendar-create-event": "Email & Calendar",
    "outlook-calendar-update-event": "Email & Calendar",

    // Microsoft Teams
    "teams-list-teams": "Communication",
    "teams-list-channels": "Communication",
    "teams-send-channel-message": "Communication",
    "teams-list-chats": "Communication",
    "teams-send-chat-message": "Communication",

    // Google Drive
    "google-drive-search-files": "File Storage",
    "google-drive-read-file": "File Storage",
    "google-drive-create-doc": "File Storage",

    // Dropbox
    "dropbox-list-files": "File Storage",
    "dropbox-get-file": "File Storage",
    "dropbox-upload-file": "File Storage",
    "dropbox-search-files": "File Storage",
    "dropbox-get-sharing-links": "File Storage",

    // BIM
    "bim-query": "BIM",
    "bim-takeoff": "BIM",
    "bim-diff": "BIM",
    "bim-clash": "BIM",
    "bim-handover": "BIM",

    // Support
    "submit-support-ticket": "Support",
    "list-my-tickets": "Support",
    "view-ticket-details": "Support",
    "comment-on-ticket": "Support",

    // Playbook Marketplace
    "playbook-search": "Marketplace",
    "playbook-detail": "Marketplace",
    "playbook-list-installed": "Marketplace",
    "playbook-deploy": "Marketplace",

    // Community
    "community-list-boards": "Community",
    "community-create-board": "Community",
    "community-join-board": "Community",
    "community-browse-posts": "Community",
    "community-browse-feed": "Community",
    "community-create-post": "Community",
    "community-read-post": "Community",
    "community-comment": "Community",
    "community-vote": "Community",
    "community-my-stats": "Community",

    // Pulse
    "pulse-list": "Pulse",
    "pulse-create": "Pulse",
    "pulse-read": "Pulse",
    "pulse-update": "Pulse",
    "pulse-delete": "Pulse",
    "pulse-add-member": "Pulse",
    "pulse-remove-member": "Pulse",
    "pulse-list-members": "Pulse",
    "pulse-add-board": "Pulse",
    "pulse-evaluate": "Pulse",
    "pulse-evaluations": "Pulse"
};

/**
 * Display order for tool categories.
 * Categories not listed here will appear at the end in alphabetical order.
 */
export const toolCategoryOrder: string[] = [
    "Utilities",
    "Search",
    "Commerce",
    "Code Execution",
    "Remote Compute",
    "Backlog",
    "Agent Sessions",
    "Agent Management",
    "Agent Quality & Runs",
    "Learning & Simulations",
    "Workflows",
    "Networks",
    "Triggers",
    "RAG & Knowledge",
    "Documents",
    "Skills",
    "Monitoring & Metrics",
    "Integrations",
    "Organization",
    "Email & Calendar",
    "File Storage",
    "BIM",
    "Support"
];

// ---------------------------------------------------------------------------
// Tool Behavior Classification
// ---------------------------------------------------------------------------

export type ToolBehaviorType = "query" | "mutation";

export interface ToolBehaviorMeta {
    behavior: ToolBehaviorType;
    outputContentPath?: string;
}

export const toolBehaviorMap: Record<string, ToolBehaviorMeta> = {
    // Community
    "community-create-board": { behavior: "mutation" },
    "community-join-board": { behavior: "mutation" },
    "community-create-post": { behavior: "mutation", outputContentPath: "post.content" },
    "community-comment": { behavior: "mutation", outputContentPath: "comment.content" },
    "community-vote": { behavior: "mutation" },

    // Backlog
    "backlog-add-task": { behavior: "mutation", outputContentPath: "task.title" },
    "backlog-update-task": { behavior: "mutation" },
    "backlog-complete-task": { behavior: "mutation" },

    // Email & Calendar
    "gmail-send-email": { behavior: "mutation" },
    "gmail-archive-email": { behavior: "mutation" },
    "gmail-draft-email": { behavior: "mutation" },
    "outlook-mail-send-email": { behavior: "mutation" },
    "outlook-mail-archive-email": { behavior: "mutation" },
    "google-calendar-create-event": { behavior: "mutation" },
    "google-calendar-update-event": { behavior: "mutation" },
    "google-calendar-delete-event": { behavior: "mutation" },
    "outlook-calendar-create-event": { behavior: "mutation" },
    "outlook-calendar-update-event": { behavior: "mutation" },

    // Communication
    "teams-send-channel-message": { behavior: "mutation" },
    "teams-send-chat-message": { behavior: "mutation" },

    // Agent Management
    "agent-create": { behavior: "mutation" },
    "agent-update": { behavior: "mutation" },
    "agent-delete": { behavior: "mutation" },
    "agent-budget-update": { behavior: "mutation" },
    "agent-invoke-dynamic": { behavior: "mutation" },
    "agent-feedback-submit": { behavior: "mutation" },
    "agent-guardrails-update": { behavior: "mutation" },
    "agent-test-cases-create": { behavior: "mutation" },
    "agent-run-cancel": { behavior: "mutation" },
    "agent-run-rerun": { behavior: "mutation" },
    "agent-evaluations-run": { behavior: "mutation" },

    // Learning & Simulations
    "agent-learning-start": { behavior: "mutation" },
    "agent-learning-proposal-approve": { behavior: "mutation" },
    "agent-learning-proposal-reject": { behavior: "mutation" },
    "agent-learning-policy-update": { behavior: "mutation" },
    "agent-simulations-start": { behavior: "mutation" },

    // Workflows
    "workflow-create": { behavior: "mutation" },
    "workflow-update": { behavior: "mutation" },
    "workflow-delete": { behavior: "mutation" },
    "workflow-execute": { behavior: "mutation" },
    "workflow-resume": { behavior: "mutation" },
    "workflow-generate": { behavior: "mutation" },

    // Networks
    "network-create": { behavior: "mutation" },
    "network-update": { behavior: "mutation" },
    "network-delete": { behavior: "mutation" },
    "network-execute": { behavior: "mutation" },
    "network-generate": { behavior: "mutation" },

    // Triggers
    "trigger-unified-create": { behavior: "mutation" },
    "trigger-unified-update": { behavior: "mutation" },
    "trigger-unified-delete": { behavior: "mutation" },
    "trigger-unified-enable": { behavior: "mutation" },
    "trigger-unified-disable": { behavior: "mutation" },
    "trigger-execute": { behavior: "mutation" },
    "schedule-create": { behavior: "mutation" },
    "schedule-update": { behavior: "mutation" },
    "schedule-delete": { behavior: "mutation" },

    // Sidekick
    "sidekick-create-schedule": { behavior: "mutation" },
    "sidekick-edit-schedule": { behavior: "mutation" },
    "sidekick-toggle-schedule": { behavior: "mutation" },
    "sidekick-delete-schedule": { behavior: "mutation" },

    // RAG & Knowledge
    "rag-ingest": { behavior: "mutation" },
    "rag-document-delete": { behavior: "mutation" },

    // Documents
    "document-create": { behavior: "mutation" },
    "document-update": { behavior: "mutation" },
    "document-delete": { behavior: "mutation" },

    // Skills
    "skill-create": { behavior: "mutation" },
    "skill-update": { behavior: "mutation" },
    "skill-delete": { behavior: "mutation" },
    "skill-attach-document": { behavior: "mutation" },
    "skill-detach-document": { behavior: "mutation" },
    "skill-attach-tool": { behavior: "mutation" },
    "skill-detach-tool": { behavior: "mutation" },
    "agent-attach-skill": { behavior: "mutation" },
    "agent-detach-skill": { behavior: "mutation" },
    "activate-skill": { behavior: "mutation" },

    // Integrations
    "integration-import-mcp-json": { behavior: "mutation" },
    "integration-connection-create": { behavior: "mutation" },
    "integration-connection-update": { behavior: "mutation" },
    "integration-connection-delete": { behavior: "mutation" },
    "webhook-create": { behavior: "mutation" },

    // Organization
    "org-member-add": { behavior: "mutation" },
    "org-workspace-create": { behavior: "mutation" },
    "goal-create": { behavior: "mutation" },
    "goal-update": { behavior: "mutation" },
    "goal-delete": { behavior: "mutation" },
    "campaign-create": { behavior: "mutation" },
    "campaign-update": { behavior: "mutation" },
    "campaign-delete": { behavior: "mutation" },
    "campaign-write-missions": { behavior: "mutation" },
    "campaign-write-plan": { behavior: "mutation" },
    "campaign-write-aar": { behavior: "mutation" },

    // Commerce
    "stripe-acs-create-session": { behavior: "mutation" },
    "record-outcome": { behavior: "mutation" },

    // Code Execution
    "execute-code": { behavior: "mutation" },
    "write-workspace-file": { behavior: "mutation" },

    // Infrastructure
    "track-resource": { behavior: "mutation" },
    "destroy-resource": { behavior: "mutation" },

    // Remote Compute
    "provision-compute": { behavior: "mutation" },
    "remote-execute": { behavior: "mutation" },
    "remote-file-transfer": { behavior: "mutation" },
    "teardown-compute": { behavior: "mutation" },

    // Agent Sessions
    "session-create": { behavior: "mutation" },
    "session-invoke-peer": { behavior: "mutation" },
    "session-write-scratchpad": { behavior: "mutation" },

    // Coding Pipeline
    "cursor-launch-agent": { behavior: "mutation" },
    "cursor-add-followup": { behavior: "mutation" },
    "dispatch-coding-pipeline": { behavior: "mutation" },
    "update-pipeline-status": { behavior: "mutation" },
    "merge-pull-request": { behavior: "mutation" },
    "github-add-issue-comment": { behavior: "mutation" },
    "github-create-pull-request": { behavior: "mutation" },
    "ticket-to-github-issue": { behavior: "mutation" },
    "ingest-ticket": { behavior: "mutation" },

    // Agent Instances
    "instance-create": { behavior: "mutation" },
    "instance-update": { behavior: "mutation" },
    "instance-delete": { behavior: "mutation" },
    "instance-bind-channel": { behavior: "mutation" },
    "instance-unbind-channel": { behavior: "mutation" },

    // Support
    "submit-support-ticket": { behavior: "mutation" },
    "comment-on-ticket": { behavior: "mutation" },

    // Playbook Marketplace
    "playbook-deploy": { behavior: "mutation" },

    // YouTube
    "youtube-ingest-to-knowledge": { behavior: "mutation" },

    // File Storage
    "google-drive-create-doc": { behavior: "mutation" },
    "dropbox-upload-file": { behavior: "mutation" },

    // BIM
    "bim-takeoff": { behavior: "mutation" },
    "bim-handover": { behavior: "mutation" },

    // Pulse
    "pulse-create": { behavior: "mutation" },
    "pulse-update": { behavior: "mutation" },
    "pulse-delete": { behavior: "mutation" },
    "pulse-add-member": { behavior: "mutation" },
    "pulse-remove-member": { behavior: "mutation" },
    "pulse-add-board": { behavior: "mutation" },
    "pulse-evaluate": { behavior: "mutation" }
};

/**
 * Tool Registry List tool — lets agents discover available tools and capabilities.
 * Used by campaign-architect to understand what tools exist before designing agents/skills.
 * Defined before toolRegistry so it can be referenced in the registry object.
 */
export const toolRegistryListTool = createTool({
    id: "tool-registry-list",
    description:
        "List all available tools in the platform registry with their IDs, descriptions, and categories. Use this to discover what capabilities exist before creating agents or skills.",
    inputSchema: z.object({
        category: z
            .string()
            .optional()
            .describe("Filter by category (e.g., 'Email & Calendar', 'Skills', 'Campaigns')"),
        search: z.string().optional().describe("Search term to filter tools by ID or description")
    }),
    outputSchema: z.object({
        tools: z.array(
            z.object({
                id: z.string(),
                name: z.string(),
                description: z.string(),
                category: z.string()
            })
        ),
        totalCount: z.number()
    }),
    execute: async ({ category, search }) => {
        let tools = listAvailableTools();

        if (category) {
            tools = tools.filter((t) => t.category.toLowerCase() === category.toLowerCase());
        }

        if (search) {
            const term = search.toLowerCase();
            tools = tools.filter(
                (t) =>
                    t.id.toLowerCase().includes(term) || t.description.toLowerCase().includes(term)
            );
        }

        return { tools, totalCount: tools.length };
    }
});

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
    "web-search": webSearchTool,
    "web-scrape": webScrapeTool,
    "memory-recall": memoryRecallTool,

    // Search tools
    "exa-search": exaSearchTool,
    "exa-find-similar": exaFindSimilarTool,
    "exa-get-contents": exaGetContentsTool,
    "exa-research": exaResearchTool,
    "brave-search": braveSearchTool,
    "brave-local-search": braveLocalSearchTool,
    "brave-news-search": braveNewsSearchTool,
    "perplexity-research": perplexityResearchTool,
    "perplexity-search": perplexitySearchTool,
    "smart-search": smartSearchTool,

    // Commerce tools
    "stripe-acs-create-session": stripeAcsCreateSessionTool,
    "stripe-acs-get-product": stripeAcsGetProductTool,
    "stripe-acs-list-products": stripeAcsListProductsTool,
    "record-outcome": recordOutcomeTool,
    "agent-roi": agentROITool,

    // YouTube
    "youtube-get-transcript": youtubeGetTranscriptTool,
    "youtube-search-videos": youtubeSearchVideosTool,
    "youtube-analyze-video": youtubeAnalyzeVideoTool,
    "youtube-ingest-to-knowledge": youtubeIngestToKnowledgeTool,
    "json-parser": jsonParserTool,

    // Code execution & workspace tools
    "execute-code": executeCodeTool,
    "write-workspace-file": writeWorkspaceFileTool,
    "read-workspace-file": readWorkspaceFileTool,
    "list-workspace-files": listWorkspaceFilesTool,

    // Infrastructure tracking
    "track-resource": trackResourceTool,
    "list-resources": listResourcesTool,
    "destroy-resource": destroyResourceTool,

    // Coding Pipeline (Cursor Cloud Agent)
    "cursor-launch-agent": cursorLaunchAgentTool,
    "cursor-get-status": cursorGetStatusTool,
    "cursor-add-followup": cursorAddFollowupTool,
    "cursor-get-conversation": cursorGetConversationTool,
    "cursor-poll-until-done": cursorPollUntilDoneTool,

    // Verification
    "verify-branch": verifyBranchTool,
    "wait-for-checks": waitForChecksTool,

    // Pipeline orchestration
    "ingest-ticket": ingestTicketTool,
    "dispatch-coding-pipeline": dispatchCodingPipelineTool,
    "update-pipeline-status": updatePipelineStatusTool,
    "lookup-pipeline-config": lookupPipelineConfigTool,
    "merge-pull-request": mergePullRequestTool,
    "await-deploy": awaitDeployTool,
    "run-scenarios": runScenariosTool,
    "calculate-trust-score": calculateTrustScoreTool,
    "ticket-to-github-issue": ticketToGithubIssueTool,
    "github-add-issue-comment": githubAddIssueCommentTool,
    "github-create-pull-request": githubCreatePullRequestTool,

    // Remote Compute
    "provision-compute": provisionComputeTool,
    "remote-execute": remoteExecuteTool,
    "remote-file-transfer": remoteFileTransferTool,
    "teardown-compute": teardownComputeTool,

    // Backlog tools
    "backlog-get": backlogGetTool,
    "backlog-add-task": backlogAddTaskTool,
    "backlog-list-tasks": backlogListTasksTool,
    "backlog-update-task": backlogUpdateTaskTool,
    "backlog-complete-task": backlogCompleteTaskTool,

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
    "workflow-generate": workflowGenerateTool,
    "workflow-validate": workflowValidateTool,
    "workflow-designer-chat": workflowDesignerChatTool,
    "network-execute": networkExecuteTool,
    "network-list-runs": networkListRunsTool,
    "network-get-run": networkGetRunTool,
    "network-metrics": networkMetricsTool,
    "network-versions": networkVersionsTool,
    "network-stats": networkStatsTool,
    "network-generate": networkGenerateTool,
    "network-validate": networkValidateTool,
    "network-designer-chat": networkDesignerChatTool,

    // Trigger tools
    "trigger-unified-list": triggerUnifiedListTool,
    "trigger-unified-get": triggerUnifiedGetTool,
    "trigger-unified-create": triggerUnifiedCreateTool,
    "trigger-unified-update": triggerUnifiedUpdateTool,
    "trigger-unified-delete": triggerUnifiedDeleteTool,
    "trigger-unified-enable": triggerUnifiedEnableTool,
    "trigger-unified-disable": triggerUnifiedDisableTool,
    "trigger-test": triggerTestTool,
    "trigger-execute": triggerExecuteTool,
    "trigger-events-list": triggerEventsListTool,
    "trigger-events-get": triggerEventsGetTool,

    // Schedule tools
    "schedule-create": scheduleCreateTool,
    "schedule-list": scheduleListTool,
    "schedule-update": scheduleUpdateTool,
    "schedule-delete": scheduleDeleteTool,

    // Sidekick schedule tools (human-friendly)
    "sidekick-list-agents": sidekickListAgentsTool,
    "sidekick-list-automations": sidekickListAutomationsTool,
    "sidekick-create-schedule": sidekickCreateScheduleTool,
    "sidekick-edit-schedule": sidekickEditScheduleTool,
    "sidekick-toggle-schedule": sidekickToggleScheduleTool,
    "sidekick-delete-schedule": sidekickDeleteScheduleTool,
    "sidekick-describe-schedule": sidekickDescribeScheduleTool,

    // Agent operations
    "agent-list": agentListTool,
    "agent-overview": agentOverviewTool,
    "agent-analytics": agentAnalyticsTool,
    "agent-costs": agentCostsTool,
    "agent-budget-get": agentBudgetGetTool,
    "agent-budget-update": agentBudgetUpdateTool,
    "agent-discover": agentDiscoverTool,
    "agent-invoke-dynamic": agentInvokeDynamicTool,

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

    // Agent runs, evaluations, and versions
    "agent-runs-list": agentRunsListTool,
    "agent-runs-get": agentRunsGetTool,
    "agent-evaluations-list": agentEvaluationsListTool,
    "agent-evaluations-run": agentEvaluationsRunTool,
    "agent-versions-list": agentVersionsListTool,

    // Learning system
    "agent-learning-sessions": agentLearningSessionsTool,
    "agent-learning-start": agentLearningStartTool,
    "agent-learning-session-get": agentLearningSessionGetTool,
    "agent-learning-proposal-approve": agentLearningProposalApproveTool,
    "agent-learning-proposal-reject": agentLearningProposalRejectTool,
    "agent-learning-experiments": agentLearningExperimentsTool,
    "agent-learning-metrics": agentLearningMetricsTool,
    "agent-learning-policy": agentLearningPolicyTool,
    "agent-learning-policy-update": agentLearningPolicyUpdateTool,

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

    // Tool introspection
    "tool-registry-list": toolRegistryListTool,
    "platform-docs": platformDocsTool,
    "instance-list": instanceListTool,
    "instance-get": instanceGetTool,
    "instance-create": instanceCreateTool,
    "instance-update": instanceUpdateTool,
    "instance-delete": instanceDeleteTool,
    "instance-bind-channel": instanceBindChannelTool,
    "instance-unbind-channel": instanceUnbindChannelTool,

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
    "integration-connection-update": integrationConnectionUpdateTool,
    "integration-connection-delete": integrationConnectionDeleteTool,

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
    "goal-update": goalUpdateTool,
    "goal-delete": goalDeleteTool,

    // Campaign tools
    "campaign-create": campaignCreateTool,
    "campaign-list": campaignListTool,
    "campaign-get": campaignGetTool,
    "campaign-update": campaignUpdateTool,
    "campaign-delete": campaignDeleteTool,
    "campaign-write-missions": campaignWriteMissionsTool,
    "campaign-write-plan": campaignWritePlanTool,
    "campaign-write-aar": campaignWriteAarTool,

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
    "agent-skill-update": agentSkillUpdateTool,
    "agent-detach-skill": agentDetachSkillTool,
    "skill-get-versions": skillGetVersionsTool,

    // Gmail tools
    "gmail-archive-email": gmailArchiveEmailTool,
    "gmail-search-emails": gmailSearchEmailsTool,
    "gmail-read-email": gmailReadEmailTool,
    "gmail-draft-email": gmailDraftEmailTool,
    "gmail-send-email": gmailSendEmailTool,

    // Google Calendar tools
    "google-calendar-search-events": googleCalendarSearchEventsTool,
    "google-calendar-list-events": googleCalendarListEventsTool,
    "google-calendar-get-event": googleCalendarGetEventTool,
    "google-calendar-create-event": googleCalendarCreateEventTool,
    "google-calendar-update-event": googleCalendarUpdateEventTool,
    "google-calendar-delete-event": googleCalendarDeleteEventTool,

    // Google Drive tools
    "google-drive-search-files": googleDriveSearchFilesTool,
    "google-drive-read-file": googleDriveReadFileTool,
    "google-drive-create-doc": googleDriveCreateDocTool,

    // Outlook Mail tools
    "outlook-mail-list-emails": outlookMailListEmailsTool,
    "outlook-mail-get-email": outlookMailGetEmailTool,
    "outlook-mail-send-email": outlookMailSendEmailTool,
    "outlook-mail-archive-email": outlookMailArchiveEmailTool,

    // Outlook Calendar tools
    "outlook-calendar-list-events": outlookCalendarListEventsTool,
    "outlook-calendar-get-event": outlookCalendarGetEventTool,
    "outlook-calendar-create-event": outlookCalendarCreateEventTool,
    "outlook-calendar-update-event": outlookCalendarUpdateEventTool,

    // Microsoft Teams tools
    "teams-list-teams": teamsListTeamsTool,
    "teams-list-channels": teamsListChannelsTool,
    "teams-send-channel-message": teamsSendChannelMessageTool,
    "teams-list-chats": teamsListChatsTool,
    "teams-send-chat-message": teamsSendChatMessageTool,

    // Dropbox tools
    "dropbox-list-files": dropboxListFilesTool,
    "dropbox-get-file": dropboxGetFileTool,
    "dropbox-upload-file": dropboxUploadFileTool,
    "dropbox-search-files": dropboxSearchFilesTool,
    "dropbox-get-sharing-links": dropboxGetSharingLinksTool,

    // Interactive UI tools
    "ask-questions": askQuestionsTool,

    // Skill discovery meta-tools (Dynamic ReAct pattern)
    "search-skills": searchSkillsTool,
    "activate-skill": activateSkillTool,
    "list-active-skills": listActiveSkillsTool,

    // Support ticket tools
    "submit-support-ticket": submitSupportTicketTool,
    "list-my-tickets": listMyTicketsTool,
    "view-ticket-details": viewTicketDetailsTool,
    "comment-on-ticket": commentOnTicketTool,

    // Playbook Marketplace tools
    "playbook-search": playbookSearchTool,
    "playbook-detail": playbookDetailTool,
    "playbook-list-installed": playbookListInstalledTool,
    "playbook-deploy": playbookDeployTool,

    // Community tools
    "community-list-boards": communityListBoardsTool,
    "community-create-board": communityCreateBoardTool,
    "community-join-board": communityJoinBoardTool,
    "community-browse-posts": communityBrowsePostsTool,
    "community-browse-feed": communityBrowseFeedTool,
    "community-create-post": communityCreatePostTool,
    "community-read-post": communityReadPostTool,
    "community-comment": communityCommentTool,
    "community-vote": communityVoteTool,
    "community-my-stats": communityMyStatsTool,

    // Agent Sessions (Mesh Communication)
    "session-create": sessionCreateTool,
    "session-invoke-peer": sessionInvokePeerTool,
    "session-read-scratchpad": sessionReadScratchpadTool,
    "session-write-scratchpad": sessionWriteScratchpadTool
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
function wrapMcpToolsWithTruncation(tools: Record<string, any>): Record<string, any> {
    const wrapped: Record<string, (typeof tools)[string]> = {};
    for (const [name, tool] of Object.entries(tools)) {
        if (tool && typeof tool.execute === "function") {
            const originalExecute = tool.execute.bind(tool);
            wrapped[name] = {
                ...tool,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                execute: async (...args: any[]) => {
                    const result = await originalExecute(...args);
                    return truncateMcpResult(result);
                }
            };
        } else {
            wrapped[name] = tool;
        }
    }
    return wrapped;
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
        const { tools } = await getMcpTools(organizationId);
        const truncatedTools = wrapMcpToolsWithTruncation(tools);
        cachedMcpToolsByOrg.set(cacheKey, { tools: truncatedTools, loadedAt: now });
        return truncatedTools;
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
    category: string;
}

/**
 * List all available tools with their metadata
 */
export function listAvailableTools(): ToolInfo[] {
    return Object.entries(toolRegistry).map(([id, tool]) => ({
        id,
        name: id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (tool as any).description || "",
        category: toolCategoryMap[id] || "Other"
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

    // Find names not in static registry (likely MCP or federation tools)
    const unresolvedNames = names.filter((name) => !result[name]);

    if (unresolvedNames.length > 0) {
        // Split unresolved into federation tools and MCP tools
        const federationNames = unresolvedNames.filter((n) => n.startsWith("federation:"));
        const otherUnresolved = unresolvedNames.filter((n) => !n.startsWith("federation:"));

        // Load MCP tools for non-federation unresolved names
        if (otherUnresolved.length > 0) {
            const mcpTools = await getMcpToolsCached(organizationId);
            for (const name of otherUnresolved) {
                if (mcpTools[name]) {
                    result[name] = mcpTools[name];
                }
            }
        }

        // Load federation tools if any requested and org context available
        if (federationNames.length > 0 && organizationId) {
            try {
                const { getFederatedTools } = await import("../federation/tools");
                const fedTools = await getFederatedTools(organizationId);
                for (const name of federationNames) {
                    if (fedTools[name]) {
                        result[name] = fedTools[name];
                    }
                }
            } catch (error) {
                console.warn("[ToolRegistry] Failed to load federation tools:", error);
            }
        }
    }

    // Warn about tools that were requested but not found in any source
    const missing = names.filter((n) => !result[n]);
    if (missing.length > 0) {
        console.warn(
            `[ToolRegistry] ${missing.length} tool(s) not found: ${missing.join(", ")} ` +
                `(checked: registry=${Object.keys(toolRegistry).length}, ` +
                `resolved=${Object.keys(result).length}/${names.length})`
        );
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

// toolRegistryListTool is defined above the toolRegistry object (before line 525)
