import { NextRequest, NextResponse } from "next/server";
import { prisma, RunStatus } from "@repo/database";
import { inngest } from "@/lib/inngest";
import { startRun } from "@/lib/run-recorder";
import { matchesTriggerFilter, resolveTriggerInput } from "@/lib/trigger-utils";
import {
    extractScheduleDefaults,
    extractTriggerConfig,
    extractTriggerInputMapping,
    parseUnifiedTriggerId,
    resolveRunSource,
    resolveRunTriggerType,
    type TriggerInputDefaults
} from "@/lib/unified-triggers";

/**
 * POST /api/agents/[id]/execution-triggers/[triggerId]/execute
 *
 * Execute an agent via a unified trigger with optional overrides.
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
            select: {
                id: true,
                slug: true,
                isActive: true
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        if (!agent.isActive) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' is not active` },
                { status: 403 }
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

            if (!schedule.isActive) {
                return NextResponse.json(
                    { success: false, error: "Schedule is disabled" },
                    { status: 403 }
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

            const runHandle = await startRun({
                agentId: agent.id,
                agentSlug: agent.slug,
                input,
                source: resolveRunSource("scheduled"),
                triggerType: resolveRunTriggerType("scheduled"),
                triggerId: schedule.id,
                initialStatus: RunStatus.QUEUED
            });

            await prisma.agentSchedule.update({
                where: { id: schedule.id },
                data: {
                    lastRunAt: new Date(),
                    runCount: { increment: 1 }
                }
            });

            await inngest.send({
                name: "agent/invoke.async",
                data: {
                    runId: runHandle.runId,
                    agentId: agent.id,
                    agentSlug: agent.slug,
                    input,
                    context: mergedContext,
                    maxSteps
                }
            });

            return NextResponse.json({
                success: true,
                run_id: runHandle.runId
            });
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: parsed.id, agentId: agent.id },
            include: {
                agent: { select: { id: true, slug: true, isActive: true } }
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

        if (!trigger.agent.isActive) {
            return NextResponse.json(
                { success: false, error: "Agent is disabled" },
                { status: 403 }
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

        if (
            !matchesTriggerFilter(
                payloadObj as Record<string, unknown>,
                trigger.filterJson as Record<string, unknown> | null
            )
        ) {
            return NextResponse.json(
                { success: false, error: "Trigger filter did not match payload" },
                { status: 400 }
            );
        }

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

        const runHandle = await startRun({
            agentId: trigger.agent.id,
            agentSlug: trigger.agent.slug,
            input,
            source: resolveRunSource(trigger.triggerType),
            triggerType: resolveRunTriggerType(trigger.triggerType),
            triggerId: trigger.id,
            initialStatus: RunStatus.QUEUED
        });

        await prisma.agentTrigger.update({
            where: { id: trigger.id },
            data: {
                lastTriggeredAt: new Date(),
                triggerCount: { increment: 1 }
            }
        });

        await inngest.send({
            name: "agent/invoke.async",
            data: {
                runId: runHandle.runId,
                agentId: trigger.agent.id,
                agentSlug: trigger.agent.slug,
                input,
                context: mergedContext,
                maxSteps
            }
        });

        return NextResponse.json({
            success: true,
            run_id: runHandle.runId
        });
    } catch (error) {
        console.error("[Execution Triggers] Error executing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to execute trigger"
            },
            { status: 500 }
        );
    }
}
