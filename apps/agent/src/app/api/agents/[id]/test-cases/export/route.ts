import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireAgentAccess } from "@/lib/authz/require-agent-access";

/**
 * GET /api/agents/[id]/test-cases/export?format=jsonl|csv&suiteId=...
 *
 * Export test cases in JSONL or CSV format for offline analysis,
 * sharing with SMEs, or importing into other evaluation tools.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { context, response: authResponse } = await requireAuth(request);
        if (authResponse) return authResponse;
        const { agentId, response: accessResponse } = await requireAgentAccess(
            context.organizationId,
            id
        );
        if (accessResponse) return accessResponse;

        const { searchParams } = new URL(request.url);
        const format = searchParams.get("format") || "jsonl";
        const suiteId = searchParams.get("suiteId");

        if (format !== "jsonl" && format !== "csv") {
            return NextResponse.json(
                { success: false, error: "Invalid format. Use 'jsonl' or 'csv'." },
                { status: 400 }
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { agentId };
        if (suiteId) where.suiteId = suiteId;

        const testCases = await prisma.agentTestCase.findMany({
            where,
            orderBy: { createdAt: "asc" },
            include: {
                testRuns: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: {
                        passed: true,
                        score: true,
                        createdAt: true
                    }
                }
            }
        });

        if (format === "jsonl") {
            const lines = testCases.map((tc) =>
                JSON.stringify({
                    id: tc.id,
                    name: tc.name,
                    input: tc.inputText,
                    expected_output: tc.expectedOutput,
                    tags: tc.tags,
                    grade: tc.grade,
                    source_run_id: tc.sourceRunId,
                    source_score: tc.sourceScore,
                    failure_modes: tc.failureModes,
                    metadata: tc.metadata,
                    last_run_passed: tc.testRuns[0]?.passed ?? null,
                    last_run_score: tc.testRuns[0]?.score ?? null,
                    created_at: tc.createdAt.toISOString()
                })
            );

            return new NextResponse(lines.join("\n") + "\n", {
                status: 200,
                headers: {
                    "Content-Type": "application/jsonl",
                    "Content-Disposition": `attachment; filename="test-cases-${agentId}.jsonl"`
                }
            });
        }

        // CSV format
        const headers = [
            "id",
            "name",
            "input",
            "expected_output",
            "tags",
            "grade",
            "source_run_id",
            "source_score",
            "failure_modes_count",
            "has_metadata",
            "last_run_passed",
            "last_run_score",
            "created_at"
        ];

        const csvRows = [headers.join(",")];
        for (const tc of testCases) {
            const fmCount = Array.isArray(tc.failureModes)
                ? (tc.failureModes as unknown[]).length
                : 0;

            csvRows.push(
                [
                    csvEscape(tc.id),
                    csvEscape(tc.name),
                    csvEscape(tc.inputText),
                    csvEscape(tc.expectedOutput || ""),
                    csvEscape(tc.tags.join(";")),
                    csvEscape(tc.grade || ""),
                    csvEscape(tc.sourceRunId || ""),
                    tc.sourceScore?.toString() || "",
                    fmCount.toString(),
                    tc.metadata ? "true" : "false",
                    tc.testRuns[0]?.passed?.toString() || "",
                    tc.testRuns[0]?.score?.toString() || "",
                    tc.createdAt.toISOString()
                ].join(",")
            );
        }

        return new NextResponse(csvRows.join("\n") + "\n", {
            status: 200,
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="test-cases-${agentId}.csv"`
            }
        });
    } catch (error) {
        console.error("[Test Case Export] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to export test cases"
            },
            { status: 500 }
        );
    }
}

function csvEscape(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
