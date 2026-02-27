import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { inngest } from "@/lib/inngest";
import { matchesTriggerFilter } from "@/lib/trigger-utils";
import {
    extractTriggerConfig,
    extractTriggerInputMapping,
    parseUnifiedTriggerId
} from "@/lib/unified-triggers";
import { createTriggerEventRecord } from "@/lib/trigger-events";

/**
 * POST /api/workflows/[slug]/execution-triggers/[triggerId]/execute
 *
 * Execute a workflow via a trigger with optional payload.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; triggerId: string }> }
) {
    try {
        const { slug, triggerId } = await params;
        const parsed = parseUnifiedTriggerId(triggerId);
        if (!parsed) {
            return NextResponse.json(
                { success: false, error: "Invalid triggerId format" },
                { status: 400 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const { payload } = body as { payload?: Record<string, unknown> };

        const workflow = await prisma.workflow.findFirst({
            where: { OR: [{ slug }, { id: slug }] },
            select: { id: true, slug: true, isActive: true, workspaceId: true }
        });

        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        if (!workflow.isActive) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' is not active` },
                { status: 403 }
            );
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: {
                id: parsed.id,
                workflowId: workflow.id,
                entityType: "workflow"
            }
        });

        if (!trigger) {
            return NextResponse.json(
                { success: false, error: `Trigger '${parsed.id}' not found` },
                { status: 404 }
            );
        }

        if (!trigger.isActive) {
            return NextResponse.json(
                { success: false, error: "Trigger is disabled" },
                { status: 403 }
            );
        }

        const payloadObj = (
            payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}
        ) as Record<string, unknown>;

        if (
            !matchesTriggerFilter(payloadObj, trigger.filterJson as Record<string, unknown> | null)
        ) {
            return NextResponse.json(
                { success: false, error: "Trigger filter did not match payload" },
                { status: 400 }
            );
        }

        const inputMapping = extractTriggerInputMapping(trigger.inputMapping);
        const triggerConfig = extractTriggerConfig(inputMapping);

        // Build mapped input from fieldMapping
        const fieldMapping = triggerConfig?.fieldMapping as Record<string, string> | undefined;
        const mappedInput: Record<string, unknown> = { ...payloadObj };
        if (fieldMapping) {
            for (const [outputKey, payloadPath] of Object.entries(fieldMapping)) {
                const parts = (payloadPath as string).split(".");
                let value: unknown = payloadObj;
                for (const part of parts) {
                    if (value && typeof value === "object") {
                        value = (value as Record<string, unknown>)[part];
                    } else {
                        value = undefined;
                        break;
                    }
                }
                if (value !== undefined) {
                    mappedInput[outputKey] = value;
                }
            }
        }

        const workflowRun = await prisma.workflowRun.create({
            data: {
                workflowId: workflow.id,
                status: "QUEUED",
                inputJson: {
                    ...mappedInput,
                    _trigger: {
                        triggerId: trigger.id,
                        triggerName: trigger.name,
                        triggerType: trigger.triggerType,
                        manual: true
                    }
                }
            }
        });

        await prisma.agentTrigger.update({
            where: { id: trigger.id },
            data: {
                lastTriggeredAt: new Date(),
                triggerCount: { increment: 1 }
            }
        });

        try {
            await createTriggerEventRecord({
                triggerId: trigger.id,
                workflowId: workflow.id,
                workspaceId: trigger.workspaceId || workflow.workspaceId || null,
                sourceType: trigger.triggerType,
                triggerType: trigger.triggerType,
                entityType: "workflow",
                eventName: trigger.eventName || undefined,
                payload: payloadObj,
                metadata: {
                    triggerName: trigger.name,
                    workflowRunId: workflowRun.id
                }
            });
        } catch (e) {
            console.warn("[Workflow Triggers] Failed to record trigger event:", e);
        }

        await inngest.send({
            name: "workflow/execute.async",
            data: {
                workflowRunId: workflowRun.id,
                workflowId: workflow.id,
                workflowSlug: workflow.slug,
                input: mappedInput
            }
        });

        return NextResponse.json({
            success: true,
            run_id: workflowRun.id
        });
    } catch (error) {
        console.error("[Workflow Triggers] Error executing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to execute workflow trigger"
            },
            { status: 500 }
        );
    }
}
