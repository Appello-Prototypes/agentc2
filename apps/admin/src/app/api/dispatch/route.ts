import { NextRequest, NextResponse } from "next/server";
import { prisma, type Prisma } from "@repo/database";
import { requireAdmin, AdminAuthError } from "@repo/admin-auth";
import {
    ADMIN_SETTING_KEYS,
    getAdminSettingValue,
    type DispatchConfig
} from "@/lib/admin-settings";

/**
 * POST /admin/api/dispatch
 * Dispatches a ticket directly to the configured workflow on the agent app.
 * Uses Inngest for durable execution of long-running workflows.
 * Authenticates with the agent API via MCP_API_KEY + X-Organization-Slug.
 *
 * Supports redispatch: if the ticket already has a pipelineRunId, a new
 * dispatch replaces it and appends to the dispatch history in metadata.
 */
export async function POST(request: NextRequest) {
    try {
        const admin = await requireAdmin(request, "platform_admin");

        const body = await request.json();
        const { sourceType, sourceId, title, description, labels } = body;

        if (!sourceType || !sourceId) {
            return NextResponse.json(
                { error: "Missing required fields: sourceType, sourceId" },
                { status: 400 }
            );
        }

        const config = await getAdminSettingValue<DispatchConfig>(
            ADMIN_SETTING_KEYS.dispatchConfig
        );
        if (!config) {
            return NextResponse.json(
                {
                    error: "No dispatch configuration saved. Go to Settings > Dispatch to configure."
                },
                { status: 400 }
            );
        }

        const org = await prisma.organization.findUnique({
            where: { id: config.targetOrganizationId },
            select: { slug: true }
        });
        if (!org) {
            return NextResponse.json(
                { error: "Configured target organization no longer exists" },
                { status: 404 }
            );
        }

        const agentBaseUrl = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";
        const apiKey = process.env.MCP_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: "MCP_API_KEY not configured on admin server" },
                { status: 500 }
            );
        }

        // Idempotency: reuse existing GitHub issue from previous run on redispatch
        let existingIssueUrl: string | undefined;
        let existingIssueNumber: number | undefined;

        if (sourceType === "support_ticket") {
            try {
                const ticket = await prisma.supportTicket.findUnique({
                    where: { id: sourceId },
                    select: { pipelineRunId: true }
                });
                if (ticket?.pipelineRunId) {
                    const prevIntakeStep = await prisma.workflowRunStep.findFirst({
                        where: {
                            runId: ticket.pipelineRunId,
                            stepId: "intake",
                            status: "COMPLETED"
                        },
                        select: { outputJson: true }
                    });
                    if (prevIntakeStep?.outputJson) {
                        const output = prevIntakeStep.outputJson as {
                            issueUrl?: string;
                            issueNumber?: number;
                        };
                        existingIssueUrl = output.issueUrl;
                        existingIssueNumber = output.issueNumber;
                    }
                }
            } catch (e) {
                console.warn("[Admin Dispatch] Failed to look up existing issue:", e);
            }
        }

        const executePayload = {
            input: {
                sourceType,
                sourceId,
                title: title || "",
                description: description || "",
                labels: labels || ["agentc2-sdlc"],
                repository: config.repository,
                ...(existingIssueUrl ? { existingIssueUrl } : {}),
                ...(existingIssueNumber ? { existingIssueNumber } : {})
            },
            via: "inngest",
            source: "admin-dispatch",
            triggerType: "admin"
        };

        const workflowSlug = encodeURIComponent(config.workflowSlug);
        const res = await fetch(`${agentBaseUrl}/api/workflows/${workflowSlug}/execute`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey,
                "X-Organization-Slug": org.slug
            },
            body: JSON.stringify(executePayload)
        });

        const data = await res.json().catch(() => ({ error: "Invalid response from agent API" }));

        if (!res.ok) {
            return NextResponse.json(
                { error: data.error || "Agent API returned an error", details: data },
                { status: res.status }
            );
        }

        const runId = data.runId as string | undefined;

        if (sourceType === "support_ticket" && runId) {
            try {
                const ticket = await prisma.supportTicket.findUnique({
                    where: { id: sourceId },
                    select: { metadata: true, pipelineRunId: true }
                });

                const existingMeta = (ticket?.metadata as Record<string, unknown>) ?? {};
                const dispatches =
                    (existingMeta.dispatches as Array<Record<string, unknown>>) ?? [];

                if (ticket?.pipelineRunId) {
                    dispatches.push({
                        runId: ticket.pipelineRunId,
                        replacedAt: new Date().toISOString(),
                        replacedBy: admin.name || admin.email
                    });
                }

                await prisma.supportTicket.update({
                    where: { id: sourceId },
                    data: {
                        pipelineRunId: runId,
                        status: "IN_PROGRESS",
                        metadata: {
                            ...existingMeta,
                            dispatches,
                            lastDispatchedAt: new Date().toISOString(),
                            lastDispatchedBy: admin.name || admin.email,
                            workflowSlug: config.workflowSlug
                        } as Prisma.InputJsonValue
                    }
                });
            } catch (e) {
                console.warn("[Admin Dispatch] Failed to update ticket:", e);
            }
        }

        return NextResponse.json({
            success: true,
            runId,
            ...data,
            dispatchConfig: {
                organizationName: config.targetOrganizationName,
                workflowName: config.workflowName,
                workflowSlug: config.workflowSlug
            }
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Dispatch] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
