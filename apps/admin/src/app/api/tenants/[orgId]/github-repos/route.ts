import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdmin, AdminAuthError } from "@repo/admin-auth";

type Params = { params: Promise<{ orgId: string }> };

/**
 * GET /admin/api/tenants/:orgId/github-repos
 * Lists GitHub repos accessible via the org's stored GitHub PAT.
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        await requireAdmin(request, "platform_admin");
        const { orgId } = await params;

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { id: true, name: true }
        });
        if (!org) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        const { resolveGitHubToken } = await import("@repo/agentc2/tools/github-helpers");

        let token: string;
        try {
            token = await resolveGitHubToken(orgId);
        } catch {
            return NextResponse.json(
                {
                    error: "No GitHub integration configured for this organization.",
                    repos: []
                },
                { status: 200 }
            );
        }

        const repos: Array<{
            id: number;
            fullName: string;
            name: string;
            owner: string;
            url: string;
            isPrivate: boolean;
        }> = [];

        let page = 1;
        const perPage = 100;
        let hasMore = true;

        while (hasMore && page <= 5) {
            const res = await fetch(
                `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=full_name&affiliation=owner,collaborator,organization_member`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28"
                    }
                }
            );

            if (!res.ok) {
                const errText = await res.text().catch(() => "");
                return NextResponse.json(
                    {
                        error: `GitHub API error (${res.status}): ${errText}`,
                        repos: []
                    },
                    { status: 200 }
                );
            }

            const data = (await res.json()) as Array<{
                id: number;
                full_name: string;
                name: string;
                owner: { login: string };
                html_url: string;
                private: boolean;
            }>;

            for (const r of data) {
                repos.push({
                    id: r.id,
                    fullName: r.full_name,
                    name: r.name,
                    owner: r.owner.login,
                    url: r.html_url,
                    isPrivate: r.private
                });
            }

            hasMore = data.length === perPage;
            page++;
        }

        return NextResponse.json({ repos, organization: org });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Tenants] GitHub repos error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
