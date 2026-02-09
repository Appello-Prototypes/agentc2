#!/usr/bin/env bun
/**
 * Database Dump / Snapshot
 *
 * Captures row counts and optional sample data from every table in the Mastra database.
 * Outputs a structured JSON report to stdout and optionally saves to a timestamped file.
 *
 * Usage:
 *   cd /path/to/mastra-experiment
 *   set -a && source .env && set +a && bun run packages/database/src/db-dump.ts
 *
 * Options (via env vars):
 *   DB_DUMP_SAMPLES=5        Number of sample rows per table (default: 0, counts only)
 *   DB_DUMP_OUTPUT=file      Save to scripts/dumps/ directory (default: stdout only)
 *   DB_DUMP_FORMAT=json      Output format: json or table (default: table)
 */

import { prisma } from "./index"

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const SAMPLE_ROWS = parseInt(process.env.DB_DUMP_SAMPLES ?? "0", 10)
const OUTPUT_MODE = process.env.DB_DUMP_OUTPUT ?? "stdout" // "stdout" | "file"
const FORMAT = process.env.DB_DUMP_FORMAT ?? "table" // "table" | "json"

// ---------------------------------------------------------------------------
// Table categories (same dependency order as vv-reset)
// ---------------------------------------------------------------------------
interface TableDef {
    name: string
    sql: string // table name in SQL (may need quoting)
    category: string
}

const tables: TableDef[] = [
    // Auth & Identity (preserved during V&V reset)
    { name: "User", sql: '"user"', category: "Auth (preserved)" },
    { name: "Session", sql: "session", category: "Auth (preserved)" },
    { name: "Account", sql: "account", category: "Auth (preserved)" },
    { name: "Verification", sql: "verification", category: "Auth (preserved)" },
    { name: "Organization", sql: "organization", category: "Auth (preserved)" },
    { name: "Workspace", sql: "workspace", category: "Auth (preserved)" },
    { name: "Membership", sql: "membership", category: "Auth (preserved)" },

    // Core Entities
    { name: "Agent", sql: "agent", category: "Core" },
    { name: "Workflow", sql: "workflow", category: "Core" },
    { name: "Network", sql: "network", category: "Core" },

    // Agent Sub-Entities
    { name: "AgentTool", sql: "agent_tool", category: "Agent Config" },
    { name: "AgentVersion", sql: "agent_version", category: "Agent Config" },
    { name: "AgentSchedule", sql: "agent_schedule", category: "Agent Config" },
    { name: "AgentTrigger", sql: "agent_trigger", category: "Agent Config" },

    // Runs & Traces
    { name: "AgentRun", sql: "agent_run", category: "Runs" },
    { name: "AgentTrace", sql: "agent_trace", category: "Runs" },
    { name: "AgentTraceStep", sql: "agent_trace_step", category: "Runs" },
    { name: "AgentToolCall", sql: "agent_tool_call", category: "Runs" },
    { name: "WorkflowRun", sql: "workflow_run", category: "Runs" },
    { name: "WorkflowRunStep", sql: "workflow_run_step", category: "Runs" },
    { name: "NetworkRun", sql: "network_run", category: "Runs" },
    { name: "NetworkRunStep", sql: "network_run_step", category: "Runs" },

    // Quality & Governance
    { name: "AgentEvaluation", sql: "agent_evaluation", category: "Quality" },
    { name: "AgentFeedback", sql: "agent_feedback", category: "Quality" },
    { name: "AgentTestCase", sql: "agent_test_case", category: "Quality" },
    { name: "AgentTestRun", sql: "agent_test_run", category: "Quality" },
    { name: "BudgetPolicy", sql: "budget_policy", category: "Quality" },
    { name: "GuardrailPolicy", sql: "guardrail_policy", category: "Quality" },
    { name: "GuardrailEvent", sql: "guardrail_event", category: "Quality" },
    { name: "AgentAlert", sql: "agent_alert", category: "Quality" },

    // Cost Tracking
    { name: "CostEvent", sql: "cost_event", category: "Costs" },
    { name: "AgentCostDaily", sql: "agent_cost_daily", category: "Costs" },
    { name: "AgentModelCostDaily", sql: "agent_model_cost_daily", category: "Costs" },
    { name: "CostRecommendation", sql: "cost_recommendation", category: "Costs" },

    // Metrics & Analytics
    { name: "AgentStatsDaily", sql: "agent_stats_daily", category: "Metrics" },
    { name: "AgentMetricDaily", sql: "agent_metric_daily", category: "Metrics" },
    { name: "AgentToolMetricDaily", sql: "agent_tool_metric_daily", category: "Metrics" },
    { name: "AgentModelMetricDaily", sql: "agent_model_metric_daily", category: "Metrics" },
    { name: "AgentQualityMetricDaily", sql: "agent_quality_metric_daily", category: "Metrics" },
    { name: "AgentFeedbackAggregateDaily", sql: "agent_feedback_aggregate_daily", category: "Metrics" },
    { name: "AgentVersionStats", sql: "agent_version_stats", category: "Metrics" },
    { name: "EvaluationTheme", sql: "evaluation_theme", category: "Metrics" },
    { name: "Insight", sql: "insight", category: "Metrics" },
    { name: "WorkflowMetricDaily", sql: "workflow_metric_daily", category: "Metrics" },
    { name: "NetworkMetricDaily", sql: "network_metric_daily", category: "Metrics" },

    // Triggers & Events
    { name: "TriggerEvent", sql: "trigger_event", category: "Triggers" },

    // Learning System
    { name: "LearningSession", sql: "learning_session", category: "Learning" },
    { name: "LearningSignal", sql: "learning_signal", category: "Learning" },
    { name: "LearningDataset", sql: "learning_dataset", category: "Learning" },
    { name: "LearningProposal", sql: "learning_proposal", category: "Learning" },
    { name: "LearningExperiment", sql: "learning_experiment", category: "Learning" },
    { name: "LearningApproval", sql: "learning_approval", category: "Learning" },
    { name: "LearningPolicy", sql: "learning_policy", category: "Learning" },
    { name: "LearningMetricDaily", sql: "learning_metric_daily", category: "Learning" },
    { name: "SimulationSession", sql: "simulation_session", category: "Learning" },

    // Workflow/Network Config
    { name: "WorkflowVersion", sql: "workflow_version", category: "Workflow/Network Config" },
    { name: "NetworkPrimitive", sql: "network_primitive", category: "Workflow/Network Config" },
    { name: "NetworkVersion", sql: "network_version", category: "Workflow/Network Config" },

    // Integrations
    { name: "IntegrationProvider", sql: "integration_provider", category: "Integrations" },
    { name: "IntegrationConnection", sql: "integration_connection", category: "Integrations" },
    { name: "ToolCredential", sql: "tool_credential", category: "Integrations" },

    // Communication
    { name: "ChatMessage", sql: "chat_message", category: "Communication" },
    { name: "EmailThread", sql: "email_thread", category: "Communication" },
    { name: "EmailMessage", sql: "email_message", category: "Communication" },
    { name: "GmailIntegration", sql: "gmail_integration", category: "Communication" },
    { name: "AgentConversation", sql: "agent_conversation", category: "Communication" },

    // Voice
    { name: "ChannelSession", sql: "channel_session", category: "Voice" },
    { name: "ChannelCredentials", sql: "channel_credentials", category: "Voice" },
    { name: "VoiceCallLog", sql: "voice_call_log", category: "Voice" },
    { name: "VoiceAgentTrace", sql: "voice_agent_trace", category: "Voice" },

    // Meetings & Actions
    { name: "MeetingTranscript", sql: "meeting_transcript", category: "Meetings" },
    { name: "ActionItem", sql: "action_item", category: "Meetings" },
    { name: "ApprovalRequest", sql: "approval_request", category: "Meetings" },

    // CRM & Identity
    { name: "IdentityMapping", sql: "identity_mapping", category: "CRM" },
    { name: "CrmAuditLog", sql: "crm_audit_log", category: "CRM" },

    // BIM
    { name: "BimModel", sql: "bim_model", category: "BIM" },
    { name: "BimModelVersion", sql: "bim_model_version", category: "BIM" },
    { name: "BimElement", sql: "bim_element", category: "BIM" },
    { name: "BimElementProperty", sql: "bim_element_property", category: "BIM" },
    { name: "BimGeometrySummary", sql: "bim_geometry_summary", category: "BIM" },
    { name: "BimTakeoff", sql: "bim_takeoff", category: "BIM" },
    { name: "BimClash", sql: "bim_clash", category: "BIM" },
    { name: "BimDiffSummary", sql: "bim_diff_summary", category: "BIM" },

    // Org extras
    { name: "OrganizationInvite", sql: "organization_invite", category: "Org" },
    { name: "OrganizationDomain", sql: "organization_domain", category: "Org" },

    // Deployment & Audit
    { name: "Deployment", sql: "deployment", category: "Operations" },
    { name: "AuditLog", sql: "audit_log", category: "Operations" },
    { name: "StoredAgent", sql: "stored_agent", category: "Operations" },
]

// Mastra-managed tables (not in Prisma schema)
const mastraTables = ["mastra_message", "mastra_thread", "mastra_resource"]
const ragTable = "rag_documents"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
interface TableResult {
    name: string
    category: string
    count: number
    error?: string
    samples?: Record<string, unknown>[]
}

async function getCount(sql: string): Promise<number> {
    const result = (await prisma.$queryRawUnsafe(
        `SELECT count(*)::int as c FROM ${sql}`,
    )) as Array<{ c: number }>
    return result[0].c
}

async function getSamples(
    sql: string,
    limit: number,
): Promise<Record<string, unknown>[]> {
    if (limit <= 0) return []
    const rows = (await prisma.$queryRawUnsafe(
        `SELECT * FROM ${sql} LIMIT ${limit}`,
    )) as Record<string, unknown>[]
    return rows
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    const startTime = Date.now()
    const timestamp = new Date().toISOString()

    console.log("=== Mastra Database Dump ===")
    console.log(`Timestamp: ${timestamp}`)
    console.log(`Samples per table: ${SAMPLE_ROWS}`)
    console.log("")

    const results: TableResult[] = []
    let totalRows = 0

    // Process Prisma-managed tables
    for (const table of tables) {
        try {
            const count = await getCount(table.sql)
            const samples =
                SAMPLE_ROWS > 0 ? await getSamples(table.sql, SAMPLE_ROWS) : undefined
            results.push({
                name: table.name,
                category: table.category,
                count,
                samples,
            })
            totalRows += count
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            if (msg.includes("does not exist") || msg.includes("doesn't exist")) {
                results.push({
                    name: table.name,
                    category: table.category,
                    count: 0,
                    error: "table not found",
                })
            } else {
                results.push({
                    name: table.name,
                    category: table.category,
                    count: -1,
                    error: msg,
                })
            }
        }
    }

    // Process Mastra-managed tables
    for (const tbl of mastraTables) {
        try {
            const count = await getCount(`"${tbl}"`)
            results.push({ name: tbl, category: "Mastra Internal", count })
            totalRows += count
        } catch {
            results.push({
                name: tbl,
                category: "Mastra Internal",
                count: 0,
                error: "table not found",
            })
        }
    }

    // RAG table
    try {
        const count = await getCount(ragTable)
        results.push({ name: ragTable, category: "RAG", count })
        totalRows += count
    } catch {
        results.push({
            name: ragTable,
            category: "RAG",
            count: 0,
            error: "table not found",
        })
    }

    const elapsed = Date.now() - startTime

    // ---------------------------------------------------------------------------
    // Output
    // ---------------------------------------------------------------------------
    if (FORMAT === "json") {
        const report = {
            timestamp,
            elapsedMs: elapsed,
            totalRows,
            tableCount: results.length,
            tablesWithData: results.filter((r) => r.count > 0).length,
            tables: results,
        }
        const jsonStr = JSON.stringify(report, null, 2)
        console.log(jsonStr)

        if (OUTPUT_MODE === "file") {
            const dir = "scripts/dumps"
            const fs = await import("fs")
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
            const filename = `${dir}/db-dump-${timestamp.replace(/[:.]/g, "-")}.json`
            fs.writeFileSync(filename, jsonStr)
            console.error(`\nSaved to: ${filename}`)
        }
    } else {
        // Table format output
        const categories = [...new Set(results.map((r) => r.category))]
        for (const cat of categories) {
            const catResults = results.filter((r) => r.category === cat)
            const catTotal = catResults.reduce(
                (sum, r) => sum + Math.max(r.count, 0),
                0,
            )

            console.log(`\n── ${cat} (${catTotal} rows) ──`)
            for (const r of catResults) {
                const status =
                    r.error === "table not found"
                        ? "  (not found)"
                        : r.error
                          ? `  ERROR: ${r.error}`
                          : ""
                const countStr = r.count >= 0 ? String(r.count).padStart(6) : "   ERR"
                console.log(`  ${countStr}  ${r.name}${status}`)
            }
        }

        console.log(`\n${"─".repeat(50)}`)
        console.log(`  Total rows: ${totalRows}`)
        console.log(`  Tables with data: ${results.filter((r) => r.count > 0).length} / ${results.length}`)
        console.log(`  Elapsed: ${elapsed}ms`)
        console.log(`  Timestamp: ${timestamp}`)

        if (OUTPUT_MODE === "file") {
            const dir = "scripts/dumps"
            const fs = await import("fs")
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
            const report = {
                timestamp,
                elapsedMs: elapsed,
                totalRows,
                tableCount: results.length,
                tablesWithData: results.filter((r) => r.count > 0).length,
                tables: results.map(({ samples: _s, ...rest }) => rest),
            }
            const filename = `${dir}/db-dump-${timestamp.replace(/[:.]/g, "-")}.json`
            fs.writeFileSync(filename, JSON.stringify(report, null, 2))
            console.log(`\n  Saved JSON to: ${filename}`)
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error("Dump failed:", e)
        process.exit(1)
    })
