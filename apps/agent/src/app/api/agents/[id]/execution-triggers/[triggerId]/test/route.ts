import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { matchesTriggerFilter, resolveTriggerInput } from "@/lib/trigger-utils";
import {
    extractScheduleDefaults,
    extractTriggerConfig,
    extractTriggerInputMapping,
    parseUnifiedTriggerId,
    type TriggerInputDefaults
} from "@/lib/unified-triggers";

/**
 * POST /api/agents/[id]/execution-triggers/[triggerId]/test
 *
 * Dry-run a unified trigger without creating a run.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; triggerId: string }> }
) {
    try {
        const { id, triggerId } = await params;
        const parsed = parseUnifiedTriggerId(triggerId);
        if (!parsed) {
            return NextResponse.json(
                { success: false, error: "Invalid triggerId format" },
                { status: 400 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const {
            payload,
            input: inputOverride,
            context: contextOverride,
            maxSteps: maxStepsOverride,
            environment: environmentOverride
        } = body as {
            payload?: unknown;
            input?: string;
            context?: Record<string, unknown>;
            maxSteps?: number;
            environment?: string;
        };

        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id }]
            },
            select: { id: true }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        if (parsed.source === "schedule") {
            const schedule = await prisma.agentSchedule.findFirst({
                where: { id: parsed.id, agentId: agent.id }
            });

            if (!schedule) {
                return NextResponse.json(
                    { success: false, error: `Schedule '${parsed.id}' not found` },
                    { status: 404 }
                );
            }

            const defaults = extractScheduleDefaults(schedule.inputJson);
            const inputValue =
                inputOverride ?? defaults?.input ?? `Scheduled run: ${schedule.name}`;
            const input =
                typeof inputValue === "string" ? inputValue : JSON.stringify(inputValue ?? {});
            const maxSteps =
                typeof maxStepsOverride === "number"
                    ? maxStepsOverride
                    : typeof defaults?.maxSteps === "number"
                      ? defaults.maxSteps
                      : undefined;
            const environment = environmentOverride ?? defaults?.environment;
            const mergedContext = {
                ...(defaults?.context || {}),
                ...(contextOverride || {}),
                scheduleId: schedule.id,
                scheduleName: schedule.name,
                ...(environment ? { environment } : {})
            };

            return NextResponse.json({
                success: true,
                resolved: {
                    input,
                    context: mergedContext,
                    maxSteps,
                    environment
                }
            });
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: parsed.id, agentId: agent.id }
        });

        if (!trigger) {
            return NextResponse.json(
                { success: false, error: `Trigger '${parsed.id}' not found` },
                { status: 404 }
            );
        }

        const payloadObj =
            payload && typeof payload === "object" && !Array.isArray(payload)
                ? (payload as Record<string, unknown>)
                : inputOverride
                  ? { input: inputOverride }
                  : payload !== undefined
                    ? { value: payload }
                    : {};

        const matches = matchesTriggerFilter(
            payloadObj as Record<string, unknown>,
            trigger.filterJson as Record<string, unknown> | null
        );

        const inputMapping = extractTriggerInputMapping(trigger.inputMapping);
        const mappingConfig = extractTriggerConfig(inputMapping);
        const defaults = mappingConfig?.defaults ?? ({} as TriggerInputDefaults);
        const resolvedInput =
            inputOverride ??
            resolveTriggerInput(payloadObj as Record<string, unknown>, inputMapping, trigger.name);
        const input =
            typeof resolvedInput === "string" ? resolvedInput : JSON.stringify(resolvedInput ?? {});
        const maxSteps =
            typeof maxStepsOverride === "number"
                ? maxStepsOverride
                : typeof defaults?.maxSteps === "number"
                  ? defaults.maxSteps
                  : undefined;
        const environment =
            environmentOverride ?? mappingConfig?.environment ?? defaults?.environment;
        const mergedContext = {
            ...(defaults?.context || {}),
            ...(contextOverride || {}),
            triggerId: trigger.id,
            triggerName: trigger.name,
            triggerType: trigger.triggerType,
            eventName: trigger.eventName,
            payload: payloadObj,
            ...(environment ? { environment } : {})
        };

        return NextResponse.json({
            success: true,
            matched: matches,
            resolved: {
                input,
                context: mergedContext,
                maxSteps,
                environment
            }
        });
    } catch (error) {
        console.error("[Execution Triggers] Error testing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to test trigger"
            },
            { status: 500 }
        );
    }
}
