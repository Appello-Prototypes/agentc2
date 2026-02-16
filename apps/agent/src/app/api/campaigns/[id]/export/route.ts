import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { getDemoSession } from "@/lib/standalone-auth";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/campaigns/[id]/export?format=markdown
 * Export campaign results as a downloadable markdown document
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;

        const campaign = await prisma.campaign.findUnique({
            where: { id },
            include: {
                missions: {
                    include: {
                        tasks: {
                            include: {
                                agentRun: {
                                    select: {
                                        id: true,
                                        status: true,
                                        outputText: true,
                                        costUsd: true,
                                        totalTokens: true,
                                        durationMs: true
                                    }
                                }
                            },
                            orderBy: { sequence: "asc" }
                        }
                    },
                    orderBy: { sequence: "asc" }
                }
            }
        });

        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        if (campaign.createdBy !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Build markdown document
        const lines: string[] = [];

        lines.push(`# ${campaign.name}`);
        lines.push("");
        lines.push(`**Status**: ${campaign.status}`);
        lines.push(
            `**Created**: ${new Date(campaign.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`
        );
        if (campaign.completedAt) {
            lines.push(
                `**Completed**: ${new Date(campaign.completedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`
            );
        }
        lines.push(
            `**Cost**: $${(campaign.totalCostUsd || 0).toFixed(2)} | **Tokens**: ${(campaign.totalTokens || 0).toLocaleString()}`
        );
        lines.push("");

        // Intent and End State
        lines.push("## Intent");
        lines.push("");
        lines.push(campaign.intent);
        lines.push("");

        lines.push("## End State");
        lines.push("");
        lines.push(campaign.endState);
        lines.push("");

        if (campaign.constraints.length > 0) {
            lines.push("## Constraints");
            lines.push("");
            for (const c of campaign.constraints) {
                lines.push(`- ${c}`);
            }
            lines.push("");
        }

        // Missions and Tasks
        lines.push("---");
        lines.push("");
        lines.push("## Missions");
        lines.push("");

        for (const mission of campaign.missions) {
            const completedTasks = mission.tasks.filter((t) => t.status === "COMPLETE").length;
            const totalTasks = mission.tasks.length;

            lines.push(`### Mission ${mission.sequence + 1}: ${mission.name}`);
            lines.push("");
            lines.push(
                `**Status**: ${mission.status} | **Tasks**: ${completedTasks}/${totalTasks} completed | **Cost**: $${(mission.totalCostUsd || 0).toFixed(2)}`
            );
            if (mission.missionStatement) {
                lines.push("");
                lines.push(`> ${mission.missionStatement}`);
            }
            lines.push("");

            for (const task of mission.tasks) {
                const statusIcon =
                    task.status === "COMPLETE"
                        ? "[OK]"
                        : task.status === "FAILED"
                          ? "[FAIL]"
                          : task.status === "SKIPPED"
                            ? "[SKIP]"
                            : `[${task.status}]`;

                lines.push(`#### ${statusIcon} ${task.name}`);
                lines.push("");

                const meta: string[] = [];
                meta.push(`Status: ${task.status}`);
                if (task.taskType) meta.push(`Type: ${task.taskType}`);
                if (task.costUsd) meta.push(`Cost: $${task.costUsd.toFixed(4)}`);
                if (task.tokens) meta.push(`Tokens: ${task.tokens.toLocaleString()}`);
                if (task.agentRun?.durationMs)
                    meta.push(`Duration: ${(task.agentRun.durationMs / 1000).toFixed(1)}s`);
                lines.push(`*${meta.join(" | ")}*`);
                lines.push("");

                if (task.error) {
                    lines.push(`**Error**: ${task.error}`);
                    lines.push("");
                }

                // Output the task result content
                const result = task.result as Record<string, unknown> | null;
                const output = (result?.output as string) || task.agentRun?.outputText || null;
                if (output) {
                    lines.push(output);
                    lines.push("");
                }
            }

            // Mission AAR
            const missionAar = mission.aarJson as Record<string, unknown> | null;
            if (missionAar?.summary) {
                lines.push("#### Mission Review");
                lines.push("");
                lines.push(String(missionAar.summary));
                lines.push("");
            }
        }

        // Campaign AAR
        const aar = campaign.aarJson as Record<string, unknown> | null;
        if (aar) {
            lines.push("---");
            lines.push("");
            lines.push("## After Action Review");
            lines.push("");

            if (aar.summary) {
                lines.push(String(aar.summary));
                lines.push("");
            }

            if (aar.intentAchieved !== undefined) {
                lines.push(`**Intent Achieved**: ${aar.intentAchieved ? "Yes" : "No"}`);
            }
            if (aar.overallScore !== undefined) {
                lines.push(`**Overall Score**: ${aar.overallScore}`);
            }
            lines.push("");

            const lessons = aar.lessonsLearned as string[] | undefined;
            if (lessons?.length) {
                lines.push("### Lessons Learned");
                lines.push("");
                for (const l of lessons) {
                    lines.push(`- ${l}`);
                }
                lines.push("");
            }

            const recommendations = aar.recommendations as string[] | undefined;
            if (recommendations?.length) {
                lines.push("### Recommendations");
                lines.push("");
                for (const r of recommendations) {
                    lines.push(`- ${r}`);
                }
                lines.push("");
            }
        }

        // Generated Resources
        const resources = campaign.generatedResources as Record<string, unknown[]> | null;
        if (resources && Object.keys(resources).length > 0) {
            lines.push("---");
            lines.push("");
            lines.push("## Generated Resources");
            lines.push("");
            for (const [category, items] of Object.entries(resources)) {
                lines.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)}`);
                lines.push("");
                for (const item of items) {
                    const r = item as Record<string, string>;
                    if (r.url) {
                        lines.push(
                            `- [${r.name || r.type}](${r.url}) (from task: ${r.taskName || "unknown"})`
                        );
                    } else {
                        lines.push(
                            `- ${r.name || r.slug || r.id} (from task: ${r.taskName || "unknown"})`
                        );
                    }
                }
                lines.push("");
            }
        }

        const markdown = lines.join("\n");

        // Return as downloadable markdown
        const filename = `${campaign.slug || campaign.id}.md`;
        return new NextResponse(markdown, {
            status: 200,
            headers: {
                "Content-Type": "text/markdown; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`
            }
        });
    } catch (error) {
        console.error("[Campaigns API] Failed to export campaign:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to export campaign"
            },
            { status: 500 }
        );
    }
}
