/**
 * Output Action Dispatcher
 *
 * Executes output actions configured on agents after run completion.
 * Handles plumbing only (WEBHOOK, CHAIN_AGENT). Agents own their own
 * communication via MCP tools during execution.
 */

import { inngest } from "./inngest"
import { createHmac } from "crypto"

export interface OutputActionRecord {
    id: string
    type: string // "WEBHOOK" | "CHAIN_AGENT"
    configJson: unknown
    isActive: boolean
}

export interface RunOutput {
    outputText: string | null
    inputText: string
    source: string | null
}

interface ActionContext {
    agentId: string
    runId: string
}

interface WebhookConfig {
    url: string
    headers?: Record<string, string>
    secret?: string
}

interface ChainAgentConfig {
    agentSlug: string
    inputTemplate?: string
}

/**
 * Execute a single output action against a run's output.
 * Never throws -- logs errors and returns success/failure.
 */
export async function executeOutputAction(
    action: OutputActionRecord,
    run: RunOutput,
    context: ActionContext
): Promise<{ success: boolean; error?: string }> {
    if (!run.outputText) {
        return { success: false, error: "No output text" }
    }

    switch (action.type) {
        case "WEBHOOK":
            return executeWebhook(action, run, context)
        case "CHAIN_AGENT":
            return executeChainAgent(action, run, context)
        default:
            console.error(
                `[OutputAction] Unknown type "${action.type}" for action ${action.id}`
            )
            return { success: false, error: `Unknown action type: ${action.type}` }
    }
}

async function executeWebhook(
    action: OutputActionRecord,
    run: RunOutput,
    context: ActionContext
): Promise<{ success: boolean; error?: string }> {
    const config = action.configJson as WebhookConfig

    if (!config?.url) {
        return { success: false, error: "Webhook config missing url" }
    }

    const payload = JSON.stringify({
        runId: context.runId,
        agentId: context.agentId,
        output: run.outputText,
        input: run.inputText,
        source: run.source,
        timestamp: new Date().toISOString(),
    })

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...config.headers,
    }

    if (config.secret) {
        const signature = createHmac("sha256", config.secret)
            .update(payload)
            .digest("hex")
        headers["X-Signature-256"] = `sha256=${signature}`
    }

    try {
        const response = await fetch(config.url, {
            method: "POST",
            headers,
            body: payload,
            signal: AbortSignal.timeout(30000),
        })

        if (!response.ok) {
            return {
                success: false,
                error: `Webhook returned ${response.status}: ${response.statusText}`,
            }
        }

        console.log(
            `[OutputAction] WEBHOOK delivered to ${config.url} (${response.status})`
        )
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, error: `Webhook failed: ${message}` }
    }
}

async function executeChainAgent(
    action: OutputActionRecord,
    run: RunOutput,
    context: ActionContext
): Promise<{ success: boolean; error?: string }> {
    const config = action.configJson as ChainAgentConfig

    if (!config?.agentSlug) {
        return { success: false, error: "Chain config missing agentSlug" }
    }

    const input = config.inputTemplate
        ? config.inputTemplate.replace("{output}", run.outputText || "")
        : run.outputText || ""

    try {
        await inngest.send({
            name: "agent/invoke.async",
            data: {
                runId: `chain-${context.runId}`,
                agentId: context.agentId,
                agentSlug: config.agentSlug,
                input,
            },
        })

        console.log(
            `[OutputAction] CHAIN_AGENT dispatched to "${config.agentSlug}"`
        )
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, error: `Chain failed: ${message}` }
    }
}
