/**
 * Phase Runner
 *
 * Breaks long agent tasks into smaller, focused phases that run independently.
 * Each phase gets its own context window and step budget, preventing the
 * fragility and cost explosion of monolithic 100+ step runs.
 *
 * Supports two execution modes:
 *   - "sequential" (default): phases run one after another
 *   - "parallel": phases run concurrently based on a dependency DAG
 *
 * Usage:
 *   const result = await runPhases({
 *     agent,
 *     phases: [
 *       { id: "discover", name: "Discovery", instructions: "...", maxSteps: 10 },
 *       { id: "api", name: "API Test", instructions: "...", maxSteps: 30, dependsOn: ["discover"] },
 *       { id: "oauth", name: "OAuth Test", instructions: "...", maxSteps: 30, dependsOn: ["discover"] },
 *       { id: "report", name: "Report", instructions: "...", maxSteps: 5, dependsOn: ["api", "oauth"] },
 *     ],
 *     input: "Verify all integrations",
 *     executionMode: "parallel",
 *   });
 */

import type { Agent } from "@mastra/core/agent";
import {
    managedGenerate,
    type ManagedGenerateOptions,
    type ManagedGenerateResult
} from "./managed-generate";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Phase {
    name: string;
    id: string;
    instructions: string;
    maxSteps: number;
    inputFromPrevious?: boolean;
    dependsOn?: string[];
    tools?: string[];
}

export interface PhaseResult {
    phaseName: string;
    phaseId: string;
    text: string;
    totalSteps: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    finishReason: string;
    abortReason?: string;
    durationMs: number;
    startedAt: number;
    completedAt: number;
    parallelGroup?: number;
}

export interface PhaseRunnerOptions {
    agent: Agent;
    phases: Phase[];
    input: string;
    executionMode?: "sequential" | "parallel";
    contextConfig?: {
        maxContextTokens?: number;
        windowSize?: number;
        anchorInstructions?: boolean;
        anchorInterval?: number;
    };
    maxTokens?: number;
    memory?: { thread: string; resource: string };
    managedGenerateOverrides?: Partial<ManagedGenerateOptions>;
    onPhaseStart?: (phase: Phase, index: number) => void;
    onPhaseComplete?: (phase: Phase, result: PhaseResult, index: number) => void;
}

export interface PhaseRunResult {
    phases: PhaseResult[];
    finalText: string;
    totalSteps: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalDurationMs: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function summarizePhaseOutput(text: string, maxLen: number = 1000): string {
    if (!text) return "(no output)";
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + `\n...[truncated, ${text.length - maxLen} chars omitted]`;
}

function buildPhaseInput(
    phase: Phase,
    phaseIndex: number,
    totalPhases: number,
    originalInput: string,
    completedPhases: Map<string, PhaseResult>
): string {
    const parts: string[] = [];

    if (phase.dependsOn && phase.dependsOn.length > 0) {
        // Gather outputs from all dependency phases
        const predecessorOutputs = phase.dependsOn
            .map((depId) => {
                const dep = completedPhases.get(depId);
                if (!dep) return null;
                return `Results from "${dep.phaseName}":\n${summarizePhaseOutput(dep.text, 500)}`;
            })
            .filter(Boolean);

        if (predecessorOutputs.length > 0) {
            parts.push(predecessorOutputs.join("\n\n"));
        }
        parts.push(originalInput);
    } else if (phase.inputFromPrevious) {
        // Legacy sequential mode: use the most recently completed phase
        const allCompleted = Array.from(completedPhases.values());
        const last = allCompleted[allCompleted.length - 1];
        if (last) {
            parts.push(
                `Results from previous phase "${last.phaseName}":\n${summarizePhaseOutput(last.text)}`
            );
        }
        parts.push(originalInput);
    } else {
        parts.push(originalInput);
    }

    parts.push(
        `\n\n--- Phase ${phaseIndex + 1}/${totalPhases}: ${phase.name} ---\n${phase.instructions}`
    );

    return parts.join("\n\n");
}

async function executePhase(
    agent: Agent,
    phase: Phase,
    phaseIndex: number,
    totalPhases: number,
    originalInput: string,
    completedPhases: Map<string, PhaseResult>,
    options: PhaseRunnerOptions,
    parallelGroup?: number
): Promise<PhaseResult> {
    const phaseStart = Date.now();

    if (options.onPhaseStart) {
        options.onPhaseStart(phase, phaseIndex);
    }

    const phaseInput = buildPhaseInput(
        phase,
        phaseIndex,
        totalPhases,
        originalInput,
        completedPhases
    );

    const generateOptions: ManagedGenerateOptions = {
        maxSteps: phase.maxSteps,
        maxContextTokens: options.contextConfig?.maxContextTokens ?? 50_000,
        windowSize: options.contextConfig?.windowSize ?? 5,
        anchorInstructions: options.contextConfig?.anchorInstructions ?? true,
        anchorInterval: options.contextConfig?.anchorInterval ?? 10,
        maxTokens: options.maxTokens,
        memory: options.memory,
        ...options.managedGenerateOverrides
    };

    let managedResult: ManagedGenerateResult;
    try {
        managedResult = await managedGenerate(agent, phaseInput, generateOptions);
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[PhaseRunner] Phase "${phase.name}" failed: ${errMsg}`);
        managedResult = {
            text: `Phase failed: ${errMsg}`,
            steps: [],
            totalSteps: 0,
            totalPromptTokens: 0,
            totalCompletionTokens: 0,
            finishReason: "error",
            abortReason: errMsg
        };
    }

    const phaseEnd = Date.now();

    const phaseResult: PhaseResult = {
        phaseName: phase.name,
        phaseId: phase.id,
        text: managedResult.text,
        totalSteps: managedResult.totalSteps,
        totalPromptTokens: managedResult.totalPromptTokens,
        totalCompletionTokens: managedResult.totalCompletionTokens,
        finishReason: managedResult.finishReason,
        abortReason: managedResult.abortReason,
        durationMs: phaseEnd - phaseStart,
        startedAt: phaseStart,
        completedAt: phaseEnd,
        parallelGroup
    };

    if (options.onPhaseComplete) {
        options.onPhaseComplete(phase, phaseResult, phaseIndex);
    }

    console.log(
        `[PhaseRunner] Phase "${phase.name}" completed: ${managedResult.totalSteps} steps, ` +
            `${managedResult.totalPromptTokens + managedResult.totalCompletionTokens} tokens, ${phaseResult.durationMs}ms`
    );

    return phaseResult;
}

// ── Sequential Execution ────────────────────────────────────────────────────

async function runSequential(options: PhaseRunnerOptions): Promise<PhaseRunResult> {
    const { agent, phases, input } = options;
    const completedPhases = new Map<string, PhaseResult>();
    const phaseResults: PhaseResult[] = [];
    let totalSteps = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalDurationMs = 0;

    for (let i = 0; i < phases.length; i++) {
        const phase = phases[i]!;

        const result = await executePhase(
            agent,
            phase,
            i,
            phases.length,
            input,
            completedPhases,
            options
        );

        completedPhases.set(phase.id, result);
        phaseResults.push(result);
        totalSteps += result.totalSteps;
        totalPromptTokens += result.totalPromptTokens;
        totalCompletionTokens += result.totalCompletionTokens;
        totalDurationMs += result.durationMs;
    }

    const lastResult = phaseResults[phaseResults.length - 1];

    return {
        phases: phaseResults,
        finalText: lastResult?.text || "",
        totalSteps,
        totalPromptTokens,
        totalCompletionTokens,
        totalDurationMs
    };
}

// ── Parallel (DAG) Execution ─────────────────────────────────────────────────

async function runParallel(options: PhaseRunnerOptions): Promise<PhaseRunResult> {
    const { agent, phases, input } = options;
    const completedPhases = new Map<string, PhaseResult>();
    const phaseResults: PhaseResult[] = [];
    const phaseById = new Map<string, Phase>();
    const phaseIndexById = new Map<string, number>();
    const remaining = new Set<string>();

    for (let i = 0; i < phases.length; i++) {
        const phase = phases[i]!;
        phaseById.set(phase.id, phase);
        phaseIndexById.set(phase.id, i);
        remaining.add(phase.id);
    }

    // Validate DAG: check all dependsOn references exist
    for (const phase of phases) {
        if (phase.dependsOn) {
            for (const dep of phase.dependsOn) {
                if (!phaseById.has(dep)) {
                    throw new Error(`Phase "${phase.name}" depends on unknown phase ID "${dep}"`);
                }
            }
        }
    }

    let parallelGroup = 0;
    const startTime = Date.now();

    while (remaining.size > 0) {
        // Find phases whose dependencies are all met
        const ready: Phase[] = [];
        for (const id of remaining) {
            const phase = phaseById.get(id)!;
            const deps = phase.dependsOn || [];
            if (deps.every((depId) => completedPhases.has(depId))) {
                ready.push(phase);
            }
        }

        if (ready.length === 0) {
            const remainingIds = Array.from(remaining).join(", ");
            throw new Error(`Circular dependency detected. Remaining phases: ${remainingIds}`);
        }

        parallelGroup++;
        console.log(
            `[PhaseRunner] Parallel group ${parallelGroup}: running ${ready.map((p) => p.name).join(", ")}`
        );

        // Execute all ready phases concurrently
        const groupResults = await Promise.all(
            ready.map((phase) =>
                executePhase(
                    agent,
                    phase,
                    phaseIndexById.get(phase.id)!,
                    phases.length,
                    input,
                    completedPhases,
                    options,
                    parallelGroup
                )
            )
        );

        // Record results and remove from remaining
        for (let i = 0; i < ready.length; i++) {
            const phase = ready[i]!;
            const result = groupResults[i]!;
            completedPhases.set(phase.id, result);
            phaseResults.push(result);
            remaining.delete(phase.id);
        }
    }

    const totalDurationMs = Date.now() - startTime;
    let totalSteps = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for (const r of phaseResults) {
        totalSteps += r.totalSteps;
        totalPromptTokens += r.totalPromptTokens;
        totalCompletionTokens += r.totalCompletionTokens;
    }

    // Final text comes from the last phase in the original order that completed
    const lastPhaseId = phases[phases.length - 1]?.id;
    const finalResult = lastPhaseId ? completedPhases.get(lastPhaseId) : undefined;

    return {
        phases: phaseResults,
        finalText: finalResult?.text || phaseResults[phaseResults.length - 1]?.text || "",
        totalSteps,
        totalPromptTokens,
        totalCompletionTokens,
        totalDurationMs
    };
}

// ── Main Function ────────────────────────────────────────────────────────────

export async function runPhases(options: PhaseRunnerOptions): Promise<PhaseRunResult> {
    const mode = options.executionMode ?? "sequential";

    if (mode === "parallel") {
        return runParallel(options);
    }
    return runSequential(options);
}
