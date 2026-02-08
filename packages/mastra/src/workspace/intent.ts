export type TriggerTiming = "event" | "schedule" | "on-demand";

export type OutcomeType = "review" | "categorize" | "analyze" | "action" | "notify" | "chain";

export type WorkspaceIntent = {
    trigger?: TriggerTiming;
    outcomes?: OutcomeType[];
    steps?: number;
    needsRouting?: boolean;
    needsParallel?: boolean;
};

export type RecommendedSystem = "agent" | "workflow" | "network";

export type WorkspaceRecommendation = {
    system: RecommendedSystem;
    reason: string;
    normalized: {
        trigger: TriggerTiming | null;
        outcomes: OutcomeType[];
        steps: number;
        needsRouting: boolean;
        needsParallel: boolean;
    };
};

const DEFAULT_STEPS = 1;

export function recommendWorkspaceSystem(intent: WorkspaceIntent): WorkspaceRecommendation {
    const outcomes = Array.isArray(intent.outcomes) ? intent.outcomes : [];
    const steps =
        typeof intent.steps === "number" && intent.steps > 0 ? intent.steps : DEFAULT_STEPS;
    const needsRouting = Boolean(intent.needsRouting);
    const needsParallel = Boolean(intent.needsParallel);
    const hasMultipleOutcomes = outcomes.length > 1;
    const hasChain = outcomes.includes("chain") || steps > 1;

    if (needsRouting || needsParallel) {
        return {
            system: "network",
            reason: "Routing or parallel paths requested",
            normalized: {
                trigger: intent.trigger ?? null,
                outcomes,
                steps,
                needsRouting,
                needsParallel
            }
        };
    }

    if (hasChain || hasMultipleOutcomes) {
        return {
            system: "workflow",
            reason: "Multiple steps or outcomes requested",
            normalized: {
                trigger: intent.trigger ?? null,
                outcomes,
                steps,
                needsRouting,
                needsParallel
            }
        };
    }

    return {
        system: "agent",
        reason: "Single outcome and minimal steps",
        normalized: {
            trigger: intent.trigger ?? null,
            outcomes,
            steps,
            needsRouting,
            needsParallel
        }
    };
}
