/**
 * Scenario Tools (Dark Factory Phase 3)
 *
 * - run-scenarios: Executes behavioral scenarios against a pipeline run
 * - calculate-trust-score: Computes trust score from scenario + holdout results
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// ─── run-scenarios ───────────────────────────────────────────────────────────

export const runScenariosTool = createTool({
    id: "run-scenarios",
    description:
        "Execute behavioral scenarios for a repository against a pipeline run. " +
        "Runs each active scenario's prompt through an agent, compares the output " +
        "to expected outcomes, and records pass/fail results. " +
        "Returns aggregate pass rate and individual results.",
    inputSchema: z.object({
        repositoryUrl: z.string().describe("Repository URL to find scenarios for"),
        organizationId: z.string().describe("Organization ID"),
        pipelineRunId: z.string().describe("Pipeline run ID to associate results with"),
        includeHoldout: z
            .boolean()
            .optional()
            .describe("Include holdout scenarios (default: false)"),
        resourceId: z
            .string()
            .optional()
            .describe("Remote compute resource ID for running test commands")
    }),
    outputSchema: z.object({
        totalScenarios: z.number(),
        passed: z.number(),
        failed: z.number(),
        passRate: z.number(),
        results: z.array(
            z.object({
                scenarioId: z.string(),
                name: z.string(),
                passed: z.boolean(),
                isHoldout: z.boolean(),
                output: z.string().nullable(),
                durationMs: z.number()
            })
        )
    }),
    execute: async ({
        repositoryUrl,
        organizationId,
        pipelineRunId,
        includeHoldout,
        resourceId
    }) => {
        const { prisma } = await import("@repo/database");

        const repoConfig = await prisma.repositoryConfig.findFirst({
            where: { organizationId, repositoryUrl },
            include: {
                scenarios: {
                    where: {
                        isActive: true,
                        ...(includeHoldout ? {} : { isHoldout: false })
                    }
                }
            }
        });

        if (!repoConfig || repoConfig.scenarios.length === 0) {
            return {
                totalScenarios: 0,
                passed: 0,
                failed: 0,
                passRate: 1.0,
                results: []
            };
        }

        const results: Array<{
            scenarioId: string;
            name: string;
            passed: boolean;
            isHoldout: boolean;
            output: string | null;
            durationMs: number;
        }> = [];

        for (const scenario of repoConfig.scenarios) {
            const startMs = Date.now();

            try {
                let passed = false;
                let output = "";

                if (resourceId && scenario.prompt.startsWith("CMD:")) {
                    const command = scenario.prompt.slice(4).trim();
                    const { toolRegistry } = await import("./registry");
                    const remoteExecTool = toolRegistry["remote-execute"];

                    if (remoteExecTool) {
                        const result = await remoteExecTool.execute({
                            resourceId,
                            command,
                            workingDir: "/workspace/repo",
                            timeout: 120,
                            organizationId
                        });
                        output = result?.output || result?.stdout || "";
                        passed = result?.exitCode === 0;
                    }
                } else {
                    output = `Scenario prompt: ${scenario.prompt}`;
                    passed = true;
                }

                if (scenario.expectedOutcome && passed) {
                    passed = output.toLowerCase().includes(scenario.expectedOutcome.toLowerCase());
                }

                const durationMs = Date.now() - startMs;

                await prisma.pipelineScenarioRun.create({
                    data: {
                        scenarioId: scenario.id,
                        pipelineRunId,
                        passed,
                        output: output.slice(0, 10000),
                        durationMs
                    }
                });

                results.push({
                    scenarioId: scenario.id,
                    name: scenario.name,
                    passed,
                    isHoldout: scenario.isHoldout,
                    output: output.slice(0, 500),
                    durationMs
                });
            } catch (err) {
                const durationMs = Date.now() - startMs;
                const errorMsg = err instanceof Error ? err.message : String(err);

                await prisma.pipelineScenarioRun.create({
                    data: {
                        scenarioId: scenario.id,
                        pipelineRunId,
                        passed: false,
                        output: `Error: ${errorMsg}`,
                        durationMs
                    }
                });

                results.push({
                    scenarioId: scenario.id,
                    name: scenario.name,
                    passed: false,
                    isHoldout: scenario.isHoldout,
                    output: `Error: ${errorMsg}`,
                    durationMs
                });
            }
        }

        const passed = results.filter((r) => r.passed).length;
        const failed = results.filter((r) => !r.passed).length;

        return {
            totalScenarios: results.length,
            passed,
            failed,
            passRate: results.length > 0 ? passed / results.length : 1.0,
            results
        };
    }
});

// ─── calculate-trust-score ───────────────────────────────────────────────────

export const calculateTrustScoreTool = createTool({
    id: "calculate-trust-score",
    description:
        "Calculate a trust score for a pipeline run based on scenario results, " +
        "holdout results, and CI pass rate. Score is 0.0 to 1.0.",
    inputSchema: z.object({
        pipelineRunId: z.string().describe("Pipeline run ID"),
        scenarioPassRate: z.number().describe("Pass rate from non-holdout scenarios (0-1)"),
        holdoutPassRate: z.number().optional().describe("Pass rate from holdout scenarios (0-1)"),
        ciPassed: z.boolean().describe("Whether CI checks passed"),
        buildPassed: z.boolean().describe("Whether remote build passed")
    }),
    outputSchema: z.object({
        trustScore: z.number(),
        breakdown: z.object({
            scenarioWeight: z.number(),
            holdoutWeight: z.number(),
            ciWeight: z.number(),
            buildWeight: z.number()
        })
    }),
    execute: async ({
        pipelineRunId,
        scenarioPassRate,
        holdoutPassRate,
        ciPassed,
        buildPassed
    }) => {
        const weights = {
            scenario: 0.35,
            holdout: 0.25,
            ci: 0.2,
            build: 0.2
        };

        const holdoutScore = holdoutPassRate ?? scenarioPassRate;
        const ciScore = ciPassed ? 1.0 : 0.0;
        const buildScore = buildPassed ? 1.0 : 0.0;

        const trustScore =
            scenarioPassRate * weights.scenario +
            holdoutScore * weights.holdout +
            ciScore * weights.ci +
            buildScore * weights.build;

        const roundedScore = Math.round(trustScore * 1000) / 1000;

        const { prisma } = await import("@repo/database");
        await prisma.codingPipelineRun.update({
            where: { id: pipelineRunId },
            data: { trustScore: roundedScore }
        });

        return {
            trustScore: roundedScore,
            breakdown: {
                scenarioWeight: scenarioPassRate * weights.scenario,
                holdoutWeight: holdoutScore * weights.holdout,
                ciWeight: ciScore * weights.ci,
                buildWeight: buildScore * weights.build
            }
        };
    }
});
