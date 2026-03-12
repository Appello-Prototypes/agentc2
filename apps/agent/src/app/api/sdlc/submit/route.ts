/**
 * POST /api/sdlc/submit
 *
 * Unified SDLC ticket submission endpoint. Creates a SupportTicket and
 * dispatches it to the SDLC pipeline. Callable from any channel (Slack,
 * Telegram, WhatsApp, web UI) via internal API call.
 *
 * Requires session or API key authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { inngest } from "@/lib/inngest";

export async function POST(request: NextRequest) {
    try {
        const authResult = await authenticateRequest(request);
        if (!authResult) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { title, description, type, channel, channelUserId } = body;

        if (!title || typeof title !== "string" || !title.trim()) {
            return NextResponse.json(
                { success: false, error: "title is required" },
                { status: 400 }
            );
        }
        if (!description || typeof description !== "string" || !description.trim()) {
            return NextResponse.json(
                { success: false, error: "description is required" },
                { status: 400 }
            );
        }

        const orgId = authResult.organizationId;

        // Resolve default workspace for the org
        const workspace = await prisma.workspace.findFirst({
            where: { organizationId: orgId, isDefault: true },
            select: { id: true }
        });

        // Resolve the SDLC triage workflow
        const sdlcWorkflow = await prisma.workflow.findFirst({
            where: {
                slug: { in: ["sdlc-triage", "coding-pipeline"] },
                isActive: true,
                workspace: { organizationId: orgId }
            },
            select: { id: true, slug: true }
        });

        if (!sdlcWorkflow) {
            return NextResponse.json(
                { success: false, error: "No active SDLC workflow found for this organization" },
                { status: 404 }
            );
        }

        // Resolve repository from admin dispatch config (if available)
        let repository: string | undefined;
        try {
            const dispatchSetting = await prisma.adminSetting.findUnique({
                where: { key: "dispatch_config" }
            });
            if (dispatchSetting?.value && typeof dispatchSetting.value === "object") {
                const config = dispatchSetting.value as Record<string, unknown>;
                repository = config.repository as string | undefined;
            }
        } catch {
            // Dispatch config is optional
        }

        // Classify type from keywords
        const ticketType =
            type ||
            (title.toLowerCase().includes("bug") || title.toLowerCase().includes("fix")
                ? "BUG"
                : title.toLowerCase().includes("feature") ||
                    title.toLowerCase().includes("add") ||
                    title.toLowerCase().includes("new")
                  ? "FEATURE_REQUEST"
                  : "IMPROVEMENT");

        // Resolve submittedById: prefer auth user, fall back to org owner
        let submittedById = authResult.userId;
        const userExists = await prisma.user.findUnique({
            where: { id: submittedById },
            select: { id: true }
        });
        if (!userExists) {
            const ownerMembership = await prisma.membership.findFirst({
                where: { organizationId: orgId, role: "owner" },
                select: { userId: true }
            });
            submittedById = ownerMembership?.userId || submittedById;
        }

        // Create the support ticket
        const ticket = await prisma.supportTicket.create({
            data: {
                title: title.trim(),
                description: description.trim(),
                type: ticketType,
                priority: "MEDIUM",
                status: "IN_PROGRESS",
                organizationId: orgId,
                submittedById,
                tags: ["sdlc", channel || "api"].filter(Boolean),
                metadata: {
                    source: channel || "api",
                    channelUserId: channelUserId || null,
                    submittedVia: "sdlc-submit-api"
                }
            }
        });

        // Create workflow run
        const typeLabel =
            ticketType === "BUG"
                ? "bug"
                : ticketType === "FEATURE_REQUEST"
                  ? "feature"
                  : "improvement";

        const input: Record<string, unknown> = {
            title: ticket.title,
            description: ticket.description,
            labels: ["agentc2-sdlc", typeLabel],
            sourceType: "support_ticket",
            sourceId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            ...(repository ? { repository } : {})
        };

        const workflowRun = await prisma.workflowRun.create({
            data: {
                workflowId: sdlcWorkflow.id,
                status: "QUEUED",
                inputJson: input,
                source: `channel-${channel || "api"}`,
                triggerType: "API"
            }
        });

        await prisma.supportTicket.update({
            where: { id: ticket.id },
            data: { pipelineRunId: workflowRun.id }
        });

        // Dispatch via Inngest
        await inngest.send({
            name: "workflow/execute.async",
            data: {
                workflowRunId: workflowRun.id,
                workflowId: sdlcWorkflow.id,
                workflowSlug: sdlcWorkflow.slug,
                input,
                organizationId: orgId
            }
        });

        console.log(
            `[SDLC Submit] Ticket #${ticket.ticketNumber} created and dispatched ` +
                `via ${channel || "api"} (run ${workflowRun.id.slice(0, 8)})`
        );

        return NextResponse.json({
            success: true,
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            workflowRunId: workflowRun.id,
            workflowSlug: sdlcWorkflow.slug,
            message: `Ticket #${ticket.ticketNumber} created and dispatched to SDLC pipeline.`
        });
    } catch (error) {
        console.error("[SDLC Submit] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Internal server error"
            },
            { status: 500 }
        );
    }
}
