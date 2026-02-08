import { NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireMonitoringWorkspace } from "@/lib/monitoring-auth";

/**
 * GET /api/live/triggers/[id]
 *
 * Fetch a single trigger event detail.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const requestedWorkspaceId = searchParams.get("workspaceId");

        const workspaceContext = await requireMonitoringWorkspace(requestedWorkspaceId);
        if (!workspaceContext.ok) {
            return NextResponse.json(
                { success: false, error: workspaceContext.error },
                { status: workspaceContext.status }
            );
        }

        const event = await prisma.triggerEvent.findFirst({
            where: { id, workspaceId: workspaceContext.workspaceId },
            include: {
                trigger: {
                    select: {
                        id: true,
                        name: true,
                        triggerType: true,
                        eventName: true,
                        webhookPath: true,
                        filterJson: true,
                        inputMapping: true
                    }
                },
                agent: {
                    select: {
                        id: true,
                        slug: true,
                        name: true
                    }
                },
                run: {
                    select: {
                        id: true,
                        status: true,
                        startedAt: true,
                        completedAt: true,
                        durationMs: true,
                        inputText: true,
                        outputText: true
                    }
                }
            }
        });

        if (!event) {
            return NextResponse.json(
                { success: false, error: "Trigger event not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            event: {
                id: event.id,
                status: event.status,
                sourceType: event.sourceType,
                triggerType: event.triggerType,
                integrationKey: event.integrationKey,
                integrationId: event.integrationId,
                eventName: event.eventName,
                webhookPath: event.webhookPath,
                errorMessage: event.errorMessage,
                payloadPreview: event.payloadPreview,
                payloadTruncated: event.payloadTruncated,
                payloadJson: event.payloadJson,
                metadata: event.metadata,
                createdAt: event.createdAt.toISOString(),
                updatedAt: event.updatedAt.toISOString(),
                trigger: event.trigger,
                agent: event.agent,
                run: event.run
                    ? {
                          id: event.run.id,
                          status: event.run.status,
                          startedAt: event.run.startedAt.toISOString(),
                          completedAt: event.run.completedAt
                              ? event.run.completedAt.toISOString()
                              : null,
                          durationMs: event.run.durationMs,
                          inputText: event.run.inputText,
                          outputText: event.run.outputText
                      }
                    : null
            }
        });
    } catch (error) {
        console.error("[Trigger Detail] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch trigger event" },
            { status: 500 }
        );
    }
}
