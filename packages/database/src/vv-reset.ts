#!/usr/bin/env bun
/**
 * V&V Database Reset
 * Run from repo root: dotenv -e .env -- bun run packages/database/src/vv-reset.ts
 * Or: set -a && source .env && set +a && bun run packages/database/src/vv-reset.ts
 */
import { prisma } from "./index"

const tables = [
    "agent_trace_step", "agent_tool_call", "workflow_run_step",
    "network_run_step", "email_message", "bim_element_property", "bim_geometry_summary",
    "agent_trace", "email_thread", "bim_element",
    "agent_run", "workflow_run", "network_run",
    "agent_tool", "agent_version", "agent_schedule", "agent_trigger",
    "agent_alert", "agent_evaluation", "agent_feedback", "agent_test_case",
    "agent_test_run", "agent_conversation", "budget_policy", "cost_event",
    "agent_cost_daily", "agent_model_cost_daily", "cost_recommendation",
    "guardrail_policy", "guardrail_event", "agent_stats_daily",
    "agent_metric_daily", "agent_tool_metric_daily", "agent_model_metric_daily",
    "agent_quality_metric_daily", "agent_feedback_aggregate_daily",
    "agent_version_stats", "evaluation_theme", "insight",
    "trigger_event", "gmail_integration",
    "learning_approval", "learning_experiment", "learning_proposal",
    "learning_signal", "learning_dataset", "learning_session",
    "learning_policy", "learning_metric_daily", "simulation_session",
    "workflow_version", "workflow_metric_daily",
    "network_primitive", "network_version", "network_metric_daily",
    "deployment", "bim_takeoff", "bim_clash", "bim_diff_summary", "bim_model_version",
    "agent", "workflow", "network", "bim_model",
    "chat_message", "meeting_transcript", "action_item", "approval_request",
    "identity_mapping", "crm_audit_log", "integration_connection", "tool_credential",
    "organization_invite", "organization_domain",
    "integration_provider",
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
            if (!msg.includes("does not exist") && !msg.includes("doesn't exist")) {
                console.error(`  ${table}: ERROR - ${msg}`)
            }
        }
    }

    for (const t of ["mastra_message", "mastra_thread", "mastra_resource"]) {
        try {
            const r = await prisma.$executeRawUnsafe(`DELETE FROM "${t}"`)
            if (r > 0) console.log(`  ${t}: ${r} cleared`)
        } catch { /* may not exist */ }
    }

    try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS rag_documents`)
        console.log("  rag_documents: dropped")
    } catch { /* ignore */ }

    console.log("\n=== Verification ===")
    const checks = [
        ["Agents", "agent"], ["Providers", "integration_provider"],
        ["Connections", "integration_connection"], ["Runs", "agent_run"],
        ["Orgs (kept)", "organization"], ["Users (kept)", `"user"`],
        ["Memberships (kept)", "membership"],
    ]
    for (const [name, tbl] of checks) {
        try {
            const r = await prisma.$queryRawUnsafe(`SELECT count(*)::int as c FROM ${tbl}`) as Array<{ c: number }>
            console.log(`  ${name}: ${r[0].c}`)
        } catch { /* ignore */ }
    }

    console.log("\n=== Done ===")
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
