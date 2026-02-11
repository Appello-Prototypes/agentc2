import { NextRequest, NextResponse } from "next/server"
import { prisma, TriggerEventStatus } from "@repo/database"
import { inngest } from "@/lib/inngest"
import { getChangesSinceCursor } from "@/lib/dropbox"
import { buildTriggerPayloadSnapshot, createTriggerEventRecord } from "@/lib/trigger-events"

/**
 * GET /api/dropbox/webhook
 *
 * Dropbox webhook verification. Echoes back the challenge parameter.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const challenge = searchParams.get("challenge")

    if (!challenge) {
        return new NextResponse("Missing challenge parameter", { status: 400 })
    }

    return new NextResponse(challenge, {
        status: 200,
        headers: {
            "Content-Type": "text/plain",
            "X-Content-Type-Options": "nosniff",
        },
    })
}

/**
 * POST /api/dropbox/webhook
 *
 * Dropbox change notification. Body contains account IDs with changes.
 * This is an app-level webhook: all connected accounts send notifications here.
 * We fan out to each matching connection and process delta changes.
 */
export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as {
            list_folder?: { accounts?: string[] }
            delta?: { users?: number[] }
        }

        const accountIds = body.list_folder?.accounts || []

        if (accountIds.length === 0) {
            return NextResponse.json({ success: true, processed: 0 })
        }

        // Look up all active Dropbox connections matching these account IDs
        const provider = await prisma.integrationProvider.findUnique({
            where: { key: "dropbox" },
        })

        if (!provider) {
            return NextResponse.json({ success: true, processed: 0 })
        }

        // Find connections with matching accountId in metadata
        const allConnections = await prisma.integrationConnection.findMany({
            where: {
                providerId: provider.id,
                isActive: true,
            },
            include: {
                webhookSubscriptions: {
                    where: {
                        providerKey: "dropbox",
                        isActive: true,
                    },
                },
            },
        })

        // Filter to connections matching the notified account IDs
        const matchedConnections = allConnections.filter((conn) => {
            const meta =
                conn.metadata && typeof conn.metadata === "object"
                    ? (conn.metadata as Record<string, unknown>)
                    : {}
            return accountIds.includes(meta.accountId as string)
        })

        let totalProcessed = 0

        for (const connection of matchedConnections) {
            try {
                const processed = await processDropboxChanges(connection)
                totalProcessed += processed
            } catch (error) {
                console.error(
                    `[Dropbox Webhook] Error processing connection ${connection.id}:`,
                    error
                )
            }
        }

        return NextResponse.json({ success: true, processed: totalProcessed })
    } catch (error) {
        console.error("[Dropbox Webhook] Error:", error)
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to process Dropbox webhook",
            },
            { status: 500 }
        )
    }
}

// ── Change Processing ──────────────────────────────────────────────

async function processDropboxChanges(
    connection: {
        id: string
        organizationId: string
        webhookSubscriptions: Array<{
            id: string
            cursor: string | null
        }>
    }
): Promise<number> {
    const sub = connection.webhookSubscriptions[0]
    if (!sub?.cursor) return 0

    const { entries, newCursor } = await getChangesSinceCursor(
        connection.id,
        sub.cursor
    )

    // Update cursor
    await prisma.webhookSubscription.update({
        where: { id: sub.id },
        data: { cursor: newCursor, updatedAt: new Date() },
    })

    if (entries.length === 0) return 0

    // Find the trigger for Dropbox file changes
    const trigger = await prisma.agentTrigger.findFirst({
        where: {
            triggerType: "event",
            eventName: "dropbox.file.changed",
            isActive: true,
            agent: {
                isActive: true,
                workspace: { organizationId: connection.organizationId },
            },
        },
        include: {
            agent: { select: { id: true, slug: true } },
        },
    })

    if (!trigger) return 0

    // Send one trigger event per batch of changes (not per file)
    const payload = {
        integrationConnectionId: connection.id,
        changeCount: entries.length,
        changes: entries.slice(0, 50).map((entry) => ({
            tag: entry[".tag"],
            name: entry.name,
            path: entry.path_display || entry.path_lower,
            size: entry.size,
            serverModified: entry.server_modified,
        })),
        truncated: entries.length > 50,
    }

    const { normalizedPayload } = buildTriggerPayloadSnapshot(payload)

    const triggerEvent = await createTriggerEventRecord({
        triggerId: trigger.id,
        agentId: trigger.agent.id,
        workspaceId: trigger.workspaceId,
        status: TriggerEventStatus.RECEIVED,
        sourceType: "integration",
        triggerType: "event",
        entityType: "agent",
        integrationKey: "dropbox",
        integrationId: connection.id,
        eventName: "dropbox.file.changed",
        payload: normalizedPayload,
    })

    await inngest.send({
        name: "agent/trigger.fire",
        data: {
            triggerId: trigger.id,
            agentId: trigger.agent.id,
            triggerEventId: triggerEvent?.id,
            payload,
        },
    })

    return entries.length
}
