/**
 * Pipeline Config Tools
 *
 * Loads PipelinePolicy and RepositoryConfig for the current org + repo
 * at workflow runtime. Used by the Dark Factory coding pipeline to
 * determine risk thresholds, build commands, and agent selection.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const RISK_LEVELS = ["trivial", "low", "medium", "high", "critical"] as const;

const policySchema = z.object({
    enabled: z.boolean(),
    autoApprovePlanBelow: z.string(),
    autoApprovePrBelow: z.string(),
    allowedRepos: z.array(z.string())
});

const repoConfigSchema = z.object({
    baseBranch: z.string(),
    installCommand: z.string(),
    buildCommand: z.string(),
    testCommand: z.string().nullable(),
    codingStandards: z.string().nullable(),
    codingAgentSlug: z.string().nullable()
});

export const lookupPipelineConfigTool = createTool({
    id: "lookup-pipeline-config",
    description:
        "Load the PipelinePolicy and RepositoryConfig for the current organization " +
        "and repository. Returns risk thresholds for auto-approval gates and " +
        "per-repo build commands, coding standards, and agent selection.",
    inputSchema: z.object({
        organizationId: z.string().describe("Organization ID"),
        repositoryUrl: z.string().describe("Repository URL")
    }),
    outputSchema: z.object({
        policy: policySchema,
        repoConfig: repoConfigSchema
    }),
    execute: async ({ organizationId, repositoryUrl }) => {
        const { prisma } = await import("@repo/database");

        const [policyRow, repoConfigRow] = await Promise.all([
            prisma.pipelinePolicy.findUnique({
                where: { organizationId }
            }),
            prisma.repositoryConfig.findFirst({
                where: { organizationId, repositoryUrl }
            })
        ]);

        const policy = policyRow
            ? {
                  enabled: policyRow.enabled,
                  autoApprovePlanBelow: policyRow.autoApprovePlanBelow,
                  autoApprovePrBelow: policyRow.autoApprovePrBelow,
                  allowedRepos: policyRow.allowedRepos
              }
            : {
                  enabled: false,
                  autoApprovePlanBelow: "medium",
                  autoApprovePrBelow: "low",
                  allowedRepos: []
              };

        const repoConfig = repoConfigRow
            ? {
                  baseBranch: repoConfigRow.baseBranch,
                  installCommand: repoConfigRow.installCommand,
                  buildCommand: repoConfigRow.buildCommand,
                  testCommand: repoConfigRow.testCommand,
                  codingStandards: repoConfigRow.codingStandards,
                  codingAgentSlug: repoConfigRow.codingAgentSlug
              }
            : {
                  baseBranch: "main",
                  installCommand: "bun install",
                  buildCommand: "bun run type-check && bun run lint && bun run build",
                  testCommand: null,
                  codingStandards: null,
                  codingAgentSlug: null
              };

        return { policy, repoConfig };
    }
});

/**
 * Check if a risk level is strictly below a threshold.
 * Used by workflow branch conditions.
 */
export function riskBelow(actual: string, threshold: string): boolean {
    const actualIdx = RISK_LEVELS.indexOf(actual as (typeof RISK_LEVELS)[number]);
    const thresholdIdx = RISK_LEVELS.indexOf(threshold as (typeof RISK_LEVELS)[number]);
    if (actualIdx === -1 || thresholdIdx === -1) return false;
    return actualIdx < thresholdIdx;
}
