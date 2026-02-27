import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { matchesTriggerFilter } from "@/lib/trigger-utils";
import {
    extractTriggerConfig,
    extractTriggerInputMapping,
    parseUnifiedTriggerId
} from "@/lib/unified-triggers";

/**
 * POST /api/workflows/[slug]/execution-triggers/[triggerId]/test
 *
 * Dry-run a workflow trigger without creating a run.
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
            select: { id: true, slug: true }
        });

        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
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

        const payloadObj = (
            payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}
        ) as Record<string, unknown>;

        const matches = matchesTriggerFilter(
            payloadObj,
            trigger.filterJson as Record<string, unknown> | null
        );

        const inputMapping = extractTriggerInputMapping(trigger.inputMapping);
        const triggerConfig = extractTriggerConfig(inputMapping);
        const workflowRouting = triggerConfig?.workflowRouting as
            | Record<string, string>
            | undefined;
        const fieldMapping = triggerConfig?.fieldMapping as Record<string, string> | undefined;

        // Resolve routing
        let resolvedWorkflowSlug = workflow.slug;
        if (workflowRouting) {
            const labels = (payloadObj?.issue as Record<string, unknown>)?.labels as
                | Array<{ name?: string }>
                | undefined;
            const labelNames = labels?.map((l) => l.name?.toLowerCase()).filter(Boolean) ?? [];

            for (const [key, wfSlug] of Object.entries(workflowRouting)) {
                if (key === "default") continue;
                if (labelNames.includes(key.toLowerCase())) {
                    resolvedWorkflowSlug = wfSlug;
                    break;
                }
            }
            if (resolvedWorkflowSlug === workflow.slug && workflowRouting.default) {
                resolvedWorkflowSlug = workflowRouting.default;
            }
        }

        // Resolve field mapping
        const mappedInput: Record<string, unknown> = {};
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

        return NextResponse.json({
            success: true,
            matched: matches,
            resolved: {
                workflowSlug: resolvedWorkflowSlug,
                mappedInput,
                workflowRouting: workflowRouting ?? null
            }
        });
    } catch (error) {
        console.error("[Workflow Triggers] Error testing:", error);
        return NextResponse.json(
            { success: false, error: "Failed to test workflow trigger" },
            { status: 500 }
        );
    }
}
