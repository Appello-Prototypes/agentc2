/**
 * Conditional Approval Checker
 *
 * Inngest function that evaluates outstanding conditional approvals.
 * When a reviewer marks an approval as "conditional", the workflow stays
 * suspended and this function periodically checks whether the conditions
 * (e.g. CI checks passing) have been met. Once met, it auto-approves
 * and resumes the workflow.
 */

import { inngest } from "./inngest";
import { prisma } from "@repo/database";
import { resolveEngagement, type EngagementContext } from "@repo/agentc2/workflows";
import { recordActivity } from "@repo/agentc2/activity/service";

interface ConditionalMeta {
    conditionType: "ci-checks";
    repository?: string;
    ref?: string;
}

interface CheckResult {
    allPassed: boolean;
    allComplete: boolean;
    failed: boolean;
    summary: string;
}

async function checkGitHubCiStatus(
    repository: string,
    ref: string,
    organizationId: string
): Promise<CheckResult> {
    try {
        const { resolveGitHubToken, parseRepoOwnerName, githubFetch } =
            await import("@repo/agentc2/tools/github-helpers");
        const token = await resolveGitHubToken(organizationId);
        const { owner, repo } = parseRepoOwnerName(repository);

        const res = await githubFetch(`/repos/${owner}/${repo}/commits/${ref}/check-runs`, token);
        const data = await res.json();
        const checkRuns: Array<{
            name: string;
            status: string;
            conclusion: string | null;
        }> = (data.check_runs || []).map(
            (cr: { name?: string; status?: string; conclusion?: string }) => ({
                name: cr.name || "unknown",
                status: cr.status || "queued",
                conclusion: cr.conclusion || null
            })
        );

        if (checkRuns.length === 0) {
            return {
                allPassed: false,
                allComplete: false,
                failed: false,
                summary: "No check runs found yet"
            };
        }

        const allComplete = checkRuns.every((cr) => cr.status === "completed");
        const anyFailed = checkRuns.some(
            (cr) =>
                cr.status === "completed" &&
                cr.conclusion !== "success" &&
                cr.conclusion !== "neutral" &&
                cr.conclusion !== "skipped"
        );
        const allPassed =
            allComplete &&
            checkRuns.every(
                (cr) =>
                    cr.conclusion === "success" ||
                    cr.conclusion === "neutral" ||
                    cr.conclusion === "skipped"
            );

        const passCount = checkRuns.filter(
            (cr) =>
                cr.conclusion === "success" ||
                cr.conclusion === "neutral" ||
                cr.conclusion === "skipped"
        ).length;

        return {
            allPassed,
            allComplete,
            failed: anyFailed,
            summary: `${passCount}/${checkRuns.length} checks passed${anyFailed ? " (failures detected)" : ""}`
        };
    } catch (err) {
        console.error("[ConditionalApproval] CI check failed:", err);
        return {
            allPassed: false,
            allComplete: false,
            failed: false,
            summary: `Error checking CI: ${err instanceof Error ? err.message : "unknown"}`
        };
    }
}

export const conditionalApprovalCheckerFunction = inngest.createFunction(
    {
        id: "conditional-approval-checker",
        retries: 1
    },
    [{ event: "command/check-conditions" }, { cron: "*/5 * * * *" }],
    async ({ step }) => {
        const conditionalApprovals = await step.run("fetch-conditional-approvals", async () => {
            const approvals = await prisma.approvalRequest.findMany({
                where: { status: "conditional" },
                select: {
                    id: true,
                    organizationId: true,
                    metadata: true,
                    reviewContext: true,
                    createdAt: true
                },
                take: 50
            });
            return approvals.map((a) => ({
                ...a,
                createdAt: a.createdAt.toISOString()
            }));
        });

        if (conditionalApprovals.length === 0) {
            return { checked: 0, resolved: 0 };
        }

        let resolved = 0;

        for (const approval of conditionalApprovals) {
            const meta = approval.metadata as Record<string, unknown> | null;
            const conditional = meta?.conditional as ConditionalMeta | undefined;
            const reviewCtx = approval.reviewContext as EngagementContext | null;

            if (!conditional) continue;

            const result = await step.run(`check-conditions-${approval.id}`, async () => {
                if (conditional.conditionType === "ci-checks") {
                    const repository = conditional.repository || reviewCtx?.repository;
                    const ref =
                        conditional.ref || reviewCtx?.prUrl?.match(/\/tree\/(.+)/)?.[1] || "main";

                    if (!repository) {
                        return {
                            action: "skip" as const,
                            reason: "No repository configured"
                        };
                    }

                    const check = await checkGitHubCiStatus(
                        repository,
                        ref,
                        approval.organizationId
                    );

                    if (check.allPassed) {
                        return { action: "approve" as const, reason: check.summary };
                    }

                    if (check.failed) {
                        return { action: "reject" as const, reason: check.summary };
                    }

                    const ageMs = Date.now() - new Date(approval.createdAt).getTime();
                    const maxAgeMs = 24 * 60 * 60 * 1000;
                    if (ageMs > maxAgeMs) {
                        return {
                            action: "reject" as const,
                            reason: `Timed out after 24h. Last status: ${check.summary}`
                        };
                    }

                    return { action: "wait" as const, reason: check.summary };
                }

                return { action: "skip" as const, reason: "Unknown condition type" };
            });

            if (result.action === "approve") {
                await step.run(`auto-approve-${approval.id}`, async () => {
                    const engResult = await resolveEngagement({
                        approvalRequestId: approval.id,
                        decision: "approved",
                        message: `Auto-approved: ${result.reason}`,
                        decidedBy: "conditional-approval-checker",
                        channel: "system"
                    });

                    if (engResult.resumed) {
                        await recordActivity({
                            type: "SYSTEM_EVENT",
                            summary: `Conditional approval auto-resolved: ${result.reason}`,
                            status: "success",
                            source: "conditional-approval",
                            metadata: {
                                approvalRequestId: approval.id,
                                conditionType: conditional.conditionType,
                                reason: result.reason
                            }
                        });
                    }

                    return engResult;
                });
                resolved++;
            } else if (result.action === "reject") {
                await step.run(`auto-reject-${approval.id}`, async () => {
                    await prisma.approvalRequest.update({
                        where: { id: approval.id },
                        data: {
                            status: "rejected",
                            decidedBy: "conditional-approval-checker",
                            decidedAt: new Date(),
                            decisionReason: `Conditions failed: ${result.reason}`
                        }
                    });

                    await recordActivity({
                        type: "SYSTEM_EVENT",
                        summary: `Conditional approval rejected: ${result.reason}`,
                        status: "failure",
                        source: "conditional-approval",
                        metadata: {
                            approvalRequestId: approval.id,
                            conditionType: conditional.conditionType,
                            reason: result.reason
                        }
                    });
                });
                resolved++;
            }
        }

        return { checked: conditionalApprovals.length, resolved };
    }
);
