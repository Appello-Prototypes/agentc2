#!/usr/bin/env bun
/**
 * V&V Database Reset Script
 *
 * Deletes ALL data except Organization, Workspace, User, Membership, and auth tables.
 * Use this to start the Mastra platform from a clean slate for V&V testing.
 *
 * Usage:
 *   cd /path/to/mastra-experiment
 *   dotenv -e .env -- bun run scripts/vv-reset-db.ts
 *
 * Or on the server:
 *   export PATH="/root/.bun/bin:/root/.local/bin:$PATH"
 *   cd /var/www/mastra
 *   dotenv -e .env -- bun run scripts/vv-reset-db.ts
 */

import { prisma } from "@repo/database"

// Using shared prisma instance from @repo/database

async function resetDatabase() {
    console.log("=== V&V Database Reset ===")
    console.log("This will delete ALL data except Organization, Workspace, User, Membership, and auth tables.\n")

    // Pre-reset counts
    const agentCount = await prisma.agent.count()
    const providerCount = await prisma.integrationProvider.count()
    const connectionCount = await prisma.integrationConnection.count()
    const runCount = await prisma.agentRun.count()
    const workflowCount = await prisma.workflow.count()
    const networkCount = await prisma.network.count()
    const auditCount = await prisma.auditLog.count()

    console.log("Current state:")
    console.log(`  Agents: ${agentCount}`)
    console.log(`  Providers: ${providerCount}`)
    console.log(`  Connections: ${connectionCount}`)
    console.log(`  Agent Runs: ${runCount}`)
    console.log(`  Workflows: ${workflowCount}`)
    console.log(`  Networks: ${networkCount}`)
    console.log(`  Audit Logs: ${auditCount}`)
    console.log("")

    // Preserved tables
    const orgCount = await prisma.organization.count()
    const workspaceCount = await prisma.workspace.count()
    const userCount = await prisma.user.count()
    const memberCount = await prisma.membership.count()
    console.log("Preserving:")
    console.log(`  Organizations: ${orgCount}`)
    console.log(`  Workspaces: ${workspaceCount}`)
    console.log(`  Users: ${userCount}`)
    console.log(`  Memberships: ${memberCount}`)
    console.log("")

    console.log("Deleting in dependency order...\n")

    // Level 1: Leaf nodes
    const l1 = await Promise.all([
        prisma.agentTraceStep.deleteMany().then((r) => ({ table: "AgentTraceStep", count: r.count })),
        prisma.agentToolCall.deleteMany().then((r) => ({ table: "AgentToolCall", count: r.count })),
        prisma.workflowRunStep.deleteMany().then((r) => ({ table: "WorkflowRunStep", count: r.count })),
        prisma.networkRunStep.deleteMany().then((r) => ({ table: "NetworkRunStep", count: r.count })),
        prisma.emailMessage.deleteMany().then((r) => ({ table: "EmailMessage", count: r.count })),
    ])
    for (const r of l1) console.log(`  ${r.table}: ${r.count} deleted`)

    // Level 2: Depend on leaf nodes
    const l2 = await Promise.all([
        prisma.agentTrace.deleteMany().then((r) => ({ table: "AgentTrace", count: r.count })),
        prisma.emailThread.deleteMany().then((r) => ({ table: "EmailThread", count: r.count })),
    ])
    for (const r of l2) console.log(`  ${r.table}: ${r.count} deleted`)

    // Level 2b: Runs (depend on traces)
    const l2b = await Promise.all([
        prisma.agentRun.deleteMany().then((r) => ({ table: "AgentRun", count: r.count })),
        prisma.workflowRun.deleteMany().then((r) => ({ table: "WorkflowRun", count: r.count })),
        prisma.networkRun.deleteMany().then((r) => ({ table: "NetworkRun", count: r.count })),
    ])
    for (const r of l2b) console.log(`  ${r.table}: ${r.count} deleted`)

    // Level 3: Agent sub-entities
    const l3 = await Promise.all([
        prisma.agentTool.deleteMany().then((r) => ({ table: "AgentTool", count: r.count })),
        prisma.agentVersion.deleteMany().then((r) => ({ table: "AgentVersion", count: r.count })),
        prisma.agentSchedule.deleteMany().then((r) => ({ table: "AgentSchedule", count: r.count })),
        prisma.agentTrigger.deleteMany().then((r) => ({ table: "AgentTrigger", count: r.count })),
        prisma.agentAlert.deleteMany().then((r) => ({ table: "AgentAlert", count: r.count })),
        prisma.agentEvaluation.deleteMany().then((r) => ({ table: "AgentEvaluation", count: r.count })),
        prisma.agentFeedback.deleteMany().then((r) => ({ table: "AgentFeedback", count: r.count })),
        prisma.agentTestCase.deleteMany().then((r) => ({ table: "AgentTestCase", count: r.count })),
        prisma.agentTestRun.deleteMany().then((r) => ({ table: "AgentTestRun", count: r.count })),
        prisma.agentConversation.deleteMany().then((r) => ({ table: "AgentConversation", count: r.count })),
        prisma.budgetPolicy.deleteMany().then((r) => ({ table: "BudgetPolicy", count: r.count })),
        prisma.costEvent.deleteMany().then((r) => ({ table: "CostEvent", count: r.count })),
        prisma.agentCostDaily.deleteMany().then((r) => ({ table: "AgentCostDaily", count: r.count })),
        prisma.agentModelCostDaily.deleteMany().then((r) => ({ table: "AgentModelCostDaily", count: r.count })),
        prisma.costRecommendation.deleteMany().then((r) => ({ table: "CostRecommendation", count: r.count })),
        prisma.guardrailPolicy.deleteMany().then((r) => ({ table: "GuardrailPolicy", count: r.count })),
        prisma.guardrailEvent.deleteMany().then((r) => ({ table: "GuardrailEvent", count: r.count })),
        prisma.agentStatsDaily.deleteMany().then((r) => ({ table: "AgentStatsDaily", count: r.count })),
        prisma.agentMetricDaily.deleteMany().then((r) => ({ table: "AgentMetricDaily", count: r.count })),
        prisma.agentToolMetricDaily.deleteMany().then((r) => ({ table: "AgentToolMetricDaily", count: r.count })),
        prisma.agentModelMetricDaily.deleteMany().then((r) => ({ table: "AgentModelMetricDaily", count: r.count })),
        prisma.agentQualityMetricDaily.deleteMany().then((r) => ({ table: "AgentQualityMetricDaily", count: r.count })),
        prisma.agentFeedbackAggregateDaily.deleteMany().then((r) => ({ table: "AgentFeedbackAggregateDaily", count: r.count })),
        prisma.agentVersionStats.deleteMany().then((r) => ({ table: "AgentVersionStats", count: r.count })),
        prisma.evaluationTheme.deleteMany().then((r) => ({ table: "EvaluationTheme", count: r.count })),
        prisma.insight.deleteMany().then((r) => ({ table: "Insight", count: r.count })),
        prisma.triggerEvent.deleteMany().then((r) => ({ table: "TriggerEvent", count: r.count })),
        prisma.gmailIntegration.deleteMany().then((r) => ({ table: "GmailIntegration", count: r.count })),
    ])
    for (const r of l3) console.log(`  ${r.table}: ${r.count} deleted`)

    // Level 3b: Learning system
    const l3b = await Promise.all([
        prisma.learningApproval.deleteMany().then((r) => ({ table: "LearningApproval", count: r.count })),
        prisma.learningExperiment.deleteMany().then((r) => ({ table: "LearningExperiment", count: r.count })),
        prisma.learningProposal.deleteMany().then((r) => ({ table: "LearningProposal", count: r.count })),
        prisma.learningSignal.deleteMany().then((r) => ({ table: "LearningSignal", count: r.count })),
        prisma.learningDataset.deleteMany().then((r) => ({ table: "LearningDataset", count: r.count })),
        prisma.learningSession.deleteMany().then((r) => ({ table: "LearningSession", count: r.count })),
        prisma.learningPolicy.deleteMany().then((r) => ({ table: "LearningPolicy", count: r.count })),
        prisma.learningMetricDaily.deleteMany().then((r) => ({ table: "LearningMetricDaily", count: r.count })),
        prisma.simulationSession.deleteMany().then((r) => ({ table: "SimulationSession", count: r.count })),
    ])
    for (const r of l3b) console.log(`  ${r.table}: ${r.count} deleted`)

    // Level 3c: Workflow/Network sub-entities
    const l3c = await Promise.all([
        prisma.workflowVersion.deleteMany().then((r) => ({ table: "WorkflowVersion", count: r.count })),
        prisma.workflowMetricDaily.deleteMany().then((r) => ({ table: "WorkflowMetricDaily", count: r.count })),
        prisma.networkPrimitive.deleteMany().then((r) => ({ table: "NetworkPrimitive", count: r.count })),
        prisma.networkVersion.deleteMany().then((r) => ({ table: "NetworkVersion", count: r.count })),
        prisma.networkMetricDaily.deleteMany().then((r) => ({ table: "NetworkMetricDaily", count: r.count })),
        prisma.deployment.deleteMany().then((r) => ({ table: "Deployment", count: r.count })),
    ])
    for (const r of l3c) console.log(`  ${r.table}: ${r.count} deleted`)

    // Level 4: Core entities
    const l4 = await Promise.all([
        prisma.agent.deleteMany().then((r) => ({ table: "Agent", count: r.count })),
        prisma.workflow.deleteMany().then((r) => ({ table: "Workflow", count: r.count })),
        prisma.network.deleteMany().then((r) => ({ table: "Network", count: r.count })),
    ])
    for (const r of l4) console.log(`  ${r.table}: ${r.count} deleted`)

    // Level 5: Integration and misc
    const l5 = await Promise.all([
        prisma.chatMessage.deleteMany().then((r) => ({ table: "ChatMessage", count: r.count })),
        prisma.meetingTranscript.deleteMany().then((r) => ({ table: "MeetingTranscript", count: r.count })),
        prisma.actionItem.deleteMany().then((r) => ({ table: "ActionItem", count: r.count })),
        prisma.approvalRequest.deleteMany().then((r) => ({ table: "ApprovalRequest", count: r.count })),
        prisma.identityMapping.deleteMany().then((r) => ({ table: "IdentityMapping", count: r.count })),
        prisma.crmAuditLog.deleteMany().then((r) => ({ table: "CrmAuditLog", count: r.count })),
        prisma.integrationConnection.deleteMany().then((r) => ({ table: "IntegrationConnection", count: r.count })),
        prisma.toolCredential.deleteMany().then((r) => ({ table: "ToolCredential", count: r.count })),
        prisma.organizationInvite.deleteMany().then((r) => ({ table: "OrganizationInvite", count: r.count })),
        prisma.organizationDomain.deleteMany().then((r) => ({ table: "OrganizationDomain", count: r.count })),
    ])
    for (const r of l5) console.log(`  ${r.table}: ${r.count} deleted`)

    // Level 5b: Providers (after connections)
    const l5b = await prisma.integrationProvider.deleteMany()
    console.log(`  IntegrationProvider: ${l5b.count} deleted`)

    // Level 6: Other
    const l6 = await Promise.all([
        prisma.channelSession.deleteMany().then((r) => ({ table: "ChannelSession", count: r.count })),
        prisma.channelCredentials.deleteMany().then((r) => ({ table: "ChannelCredentials", count: r.count })),
        prisma.voiceCallLog.deleteMany().then((r) => ({ table: "VoiceCallLog", count: r.count })),
        prisma.voiceAgentTrace.deleteMany().then((r) => ({ table: "VoiceAgentTrace", count: r.count })),
        prisma.auditLog.deleteMany().then((r) => ({ table: "AuditLog", count: r.count })),
        prisma.storedAgent.deleteMany().then((r) => ({ table: "StoredAgent", count: r.count })),
    ])
    for (const r of l6) console.log(`  ${r.table}: ${r.count} deleted`)

    // Also clean Mastra-managed tables (not in Prisma schema but may have data)
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM mastra_message`)
        console.log("  mastra_message: cleared")
    } catch { /* table may not exist */ }
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM mastra_thread`)
        console.log("  mastra_thread: cleared")
    } catch { /* table may not exist */ }
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM mastra_resource`)
        console.log("  mastra_resource: cleared")
    } catch { /* table may not exist */ }

    // Clean RAG vector data
    try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS rag_documents`)
        console.log("  rag_documents: dropped")
    } catch { /* table may not exist */ }

    console.log("\n=== Reset Complete ===")

    // Post-reset verification
    const postAgents = await prisma.agent.count()
    const postProviders = await prisma.integrationProvider.count()
    const postConnections = await prisma.integrationConnection.count()
    const postOrgs = await prisma.organization.count()
    const postWorkspaces = await prisma.workspace.count()
    const postUsers = await prisma.user.count()
    const postMembers = await prisma.membership.count()

    console.log("\nPost-reset state:")
    console.log(`  Agents: ${postAgents} (should be 0)`)
    console.log(`  Providers: ${postProviders} (should be 0)`)
    console.log(`  Connections: ${postConnections} (should be 0)`)
    console.log(`  Organizations: ${postOrgs} (preserved)`)
    console.log(`  Workspaces: ${postWorkspaces} (preserved)`)
    console.log(`  Users: ${postUsers} (preserved)`)
    console.log(`  Memberships: ${postMembers} (preserved)`)
}

resetDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Reset failed:", error)
        process.exit(1)
    })
