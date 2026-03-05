import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/reviews/[id]/diff
 *
 * Fetch PR diff from GitHub for a review that has a linked PR.
 * Uses the GitHub API with the configured PAT.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const approval = await prisma.approvalRequest.findFirst({
            where: { id, organizationId: authContext.organizationId },
            select: {
                reviewContext: true,
                githubRepo: true,
                githubIssueNumber: true
            }
        });

        if (!approval) {
            return NextResponse.json(
                { success: false, error: "Review not found" },
                { status: 404 }
            );
        }

        const context = approval.reviewContext as Record<string, unknown> | null;
        const prNumber = (context?.prNumber as number | undefined) ?? approval.githubIssueNumber;
        const repo = (context?.repository as string | undefined) ?? approval.githubRepo;

        if (!repo || !prNumber) {
            return NextResponse.json(
                { success: false, error: "No PR linked to this review" },
                { status: 404 }
            );
        }

        const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
        if (!githubToken) {
            return NextResponse.json(
                { success: false, error: "GitHub token not configured" },
                { status: 500 }
            );
        }

        const apiUrl = `https://api.github.com/repos/${repo}/pulls/${prNumber}`;

        const [prResponse, diffResponse] = await Promise.all([
            fetch(apiUrl, {
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                    Accept: "application/vnd.github.v3+json"
                }
            }),
            fetch(apiUrl, {
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                    Accept: "application/vnd.github.v3.diff"
                }
            })
        ]);

        if (!prResponse.ok) {
            return NextResponse.json(
                {
                    success: false,
                    error: `GitHub API error: ${prResponse.status} ${prResponse.statusText}`
                },
                { status: prResponse.status }
            );
        }

        const prData = await prResponse.json();
        const diffText = diffResponse.ok ? await diffResponse.text() : null;

        return NextResponse.json({
            success: true,
            pr: {
                number: prData.number,
                title: prData.title,
                state: prData.state,
                htmlUrl: prData.html_url,
                additions: prData.additions,
                deletions: prData.deletions,
                changedFiles: prData.changed_files,
                mergeable: prData.mergeable,
                mergeableState: prData.mergeable_state,
                headRef: prData.head?.ref,
                baseRef: prData.base?.ref
            },
            diff: diffText
        });
    } catch (error) {
        console.error("[Reviews Diff] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        );
    }
}
