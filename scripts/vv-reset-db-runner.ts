#!/usr/bin/env bun
/**
 * V&V Database Reset Runner
 * Executes raw SQL to reset the database.
 * Uses Prisma client from the built packages.
 *
 * Usage: bun run packages/database/src/vv-reset.ts
 */
// @ts-ignore - Prisma client resolved by Bun at runtime
const { PrismaClient } = await import("@prisma/client")

const prisma = new PrismaClient()

const tables = [
    // Level 1
    "agent_trace_step", "agent_tool_call", "workflow_run_step",
    "network_run_step", "email_message", "bim_element_property", "bim_geometry_summary",
    // Level 2
    "agent_trace", "email_thread", "bim_element",
    // Level 2b
    "agent_run", "workflow_run", "network_run",
    // Level 3
    "agent_tool", "agent_version", "agent_schedule", "agent_trigger",
    "agent_alert", "agent_evaluation", "agent_feedback", "agent_test_case",
    "agent_test_run", "agent_conversation", "budget_policy", "cost_event",
    "agent_cost_daily", "agent_model_cost_daily", "cost_recommendation",
    "guardrail_policy", "guardrail_event", "agent_stats_daily",
    "agent_metric_daily", "agent_tool_metric_daily", "agent_model_metric_daily",
    "agent_quality_metric_daily", "agent_feedback_aggregate_daily",
    "agent_version_stats", "evaluation_theme", "insight",
    "trigger_event", "gmail_integration",
    // Level 3b
    "learning_approval", "learning_experiment", "learning_proposal",
    "learning_signal", "learning_dataset", "learning_session",
    "learning_policy", "learning_metric_daily", "simulation_session",
    // Level 3c
    "workflow_version", "workflow_metric_daily",
    "network_primitive", "network_version", "network_metric_daily",
    "deployment", "bim_takeoff", "bim_clash", "bim_diff_summary", "bim_model_version",
    // Level 4
    "agent", "workflow", "network", "bim_model",
    // Level 5
    "chat_message", "meeting_transcript", "action_item", "approval_request",
    "identity_mapping", "crm_audit_log", "integration_connection", "tool_credential",
    "organization_invite", "organization_domain",
    // Level 5b
    "integration_provider",
    // Level 6
    "channel_session", "channel_credentials", "voice_call_log",
    "voice_agent_trace", "audit_log", "stored_agent",
]

async function main() {
    console.log("=== V&V Database Reset ===\n")

    for (const table of tables) {
        try {
            const result = await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`)
            if (result > 0) console.log(`  ${table}: ${result} deleted`)
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            if (!msg.includes("does not exist")) {
                console.error(`  ${table}: ERROR - ${msg}`)
            }
        }
    }

    // Mastra tables
    for (const t of ["mastra_message", "mastra_thread", "mastra_resource"]) {
        try {
            await prisma.$executeRawUnsafe(`DELETE FROM "${t}"`)
            console.log(`  ${t}: cleared`)
        } catch { /* may not exist */ }
    }

    // RAG
    try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS rag_documents`)
        console.log("  rag_documents: dropped")
    } catch { /* ignore */ }

    console.log("\n=== Verification ===")
    const checks = [
        { name: "Agents", q: `SELECT count(*) as c FROM agent` },
        { name: "Providers", q: `SELECT count(*) as c FROM integration_provider` },
        { name: "Connections", q: `SELECT count(*) as c FROM integration_connection` },
        { name: "Runs", q: `SELECT count(*) as c FROM agent_run` },
        { name: "Orgs (kept)", q: `SELECT count(*) as c FROM organization` },
        { name: "Users (kept)", q: `SELECT count(*) as c FROM "user"` },
        { name: "Memberships (kept)", q: `SELECT count(*) as c FROM membership` },
    ]
    for (const check of checks) {
        try {
            const result = await prisma.$queryRawUnsafe(check.q) as Array<{ c: bigint }>
            console.log(`  ${check.name}: ${result[0].c}`)
        } catch { /* ignore */ }
    }

    console.log("\n=== Reset Complete ===")
}

main()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1) })
