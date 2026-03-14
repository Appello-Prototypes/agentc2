import { prisma } from "@repo/database";

interface HealthPolicyResult {
    triggered: boolean;
    failureRate: number;
    threshold: number;
    window: number;
    action: string | null;
    scheduleId: string;
}

/**
 * Evaluate a schedule's health policy against recent run outcomes.
 *
 * Looks at the last `healthWindow` runs for the schedule's agent
 * that were trigger-type SCHEDULED, and checks if the failure rate
 * exceeds `healthThreshold`. If so, performs the configured action
 * (pause the schedule, create an alert, or both).
 */
export async function evaluateHealthPolicy(scheduleId: string): Promise<HealthPolicyResult | null> {
    const schedule = await prisma.agentSchedule.findUnique({
        where: { id: scheduleId },
        select: {
            id: true,
            agentId: true,
            name: true,
            healthPolicyEnabled: true,
            healthThreshold: true,
            healthWindow: true,
            healthAction: true,
            workspaceId: true
        }
    });

    if (!schedule || !schedule.healthPolicyEnabled) return null;

    const threshold = schedule.healthThreshold ?? 0.5;
    const window = schedule.healthWindow ?? 10;
    const action = schedule.healthAction ?? "pause_and_alert";

    if (!schedule.agentId) return null;

    const recentRuns = await prisma.agentRun.findMany({
        where: {
            agentId: schedule.agentId,
            triggerType: "SCHEDULED",
            triggerId: schedule.id,
            status: { in: ["COMPLETED", "FAILED"] }
        },
        orderBy: { createdAt: "desc" },
        take: window,
        select: { status: true }
    });

    if (recentRuns.length < Math.min(3, window)) {
        return null;
    }

    const failures = recentRuns.filter((r) => r.status === "FAILED").length;
    const failureRate = failures / recentRuns.length;

    if (failureRate < threshold) {
        return {
            triggered: false,
            failureRate,
            threshold,
            window,
            action,
            scheduleId
        };
    }

    // Threshold exceeded
    const shouldPause = action === "pause" || action === "pause_and_alert";
    const shouldAlert = action === "alert" || action === "pause_and_alert";

    if (shouldPause) {
        await prisma.agentSchedule.update({
            where: { id: scheduleId },
            data: {
                isActive: false,
                healthTriggeredAt: new Date()
            }
        });
    } else {
        await prisma.agentSchedule.update({
            where: { id: scheduleId },
            data: { healthTriggeredAt: new Date() }
        });
    }

    if (shouldAlert) {
        await prisma.agentAlert.create({
            data: {
                agentId: schedule.agentId!,
                severity: "CRITICAL",
                message: `Health policy triggered: ${Math.round(failureRate * 100)}% failure rate over last ${recentRuns.length} scheduled runs (threshold: ${Math.round(threshold * 100)}%).${shouldPause ? " Schedule paused." : ""}`,
                source: "HEALTH"
            }
        });
    }

    console.log(
        `[HealthPolicy] Schedule ${schedule.name} (${scheduleId}): ` +
            `${Math.round(failureRate * 100)}% failure rate, action=${action}`
    );

    return {
        triggered: true,
        failureRate,
        threshold,
        window,
        action,
        scheduleId
    };
}
