import { prisma } from "@repo/database"

type DispatchConfig = {
    targetOrganizationId: string
    targetOrganizationName: string
    workflowId: string
    workflowSlug: string
    workflowName: string
    repository: string
    autoDispatch?: boolean
}

/**
 * Fire-and-forget: if auto-dispatch is enabled in admin settings,
 * triage the ticket and dispatch it to the configured coding pipeline.
 */
export function maybeAutoDispatch(ticket: {
    id: string
    title: string
    description: string
    type: string
}) {
    setImmediate(() => void runAutoDispatch(ticket))
}

async function runAutoDispatch(ticket: {
    id: string
    title: string
    description: string
    type: string
}) {
    try {
        const setting = await prisma.adminSetting.findUnique({
            where: { key: "dispatch_config" },
            select: { value: true },
        })
        if (!setting?.value) return

        const config = setting.value as unknown as DispatchConfig
        if (!config.autoDispatch) return
        if (!config.targetOrganizationId || !config.workflowSlug || !config.repository) return

        const org = await prisma.organization.findUnique({
            where: { id: config.targetOrganizationId },
            select: { slug: true },
        })
        if (!org) return

        await prisma.supportTicket.update({
            where: { id: ticket.id },
            data: { status: "IN_PROGRESS", triagedAt: new Date() },
        })

        const typeLabel =
            ticket.type === "BUG"
                ? "bug"
                : ticket.type === "FEATURE_REQUEST"
                  ? "feature"
                  : "task"

        const agentBaseUrl = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001"
        const apiKey = process.env.MCP_API_KEY
        if (!apiKey) {
            console.warn("[Auto-Dispatch] MCP_API_KEY not set, skipping dispatch")
            return
        }

        const workflowSlug = encodeURIComponent(config.workflowSlug)
        const res = await fetch(`${agentBaseUrl}/api/workflows/${workflowSlug}/execute`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey,
                "X-Organization-Slug": org.slug,
            },
            body: JSON.stringify({
                input: {
                    sourceType: "support_ticket",
                    sourceId: ticket.id,
                    title: ticket.title,
                    description: ticket.description,
                    labels: ["agentc2-sdlc", typeLabel],
                    repository: config.repository,
                },
                via: "inngest",
                source: "auto-dispatch",
                triggerType: "auto",
            }),
        })

        if (!res.ok) {
            const body = await res.text().catch(() => "")
            console.error(`[Auto-Dispatch] Workflow execute failed (${res.status}):`, body)
            return
        }

        const data = await res.json().catch(() => ({}))
        console.log(
            `[Auto-Dispatch] Ticket ${ticket.id} dispatched → run ${data.runId ?? "unknown"}`,
        )
    } catch (err) {
        console.error("[Auto-Dispatch] Error:", err)
    }
}
