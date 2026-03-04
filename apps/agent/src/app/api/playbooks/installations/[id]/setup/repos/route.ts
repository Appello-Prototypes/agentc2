import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/playbooks/installations/[id]/setup/repos
 *
 * Fetches the org's GitHub repositories using their connected token.
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { id } = await params;
        const { organizationId } = authResult.context;

        const installation = await prisma.playbookInstallation.findFirst({
            where: { id, targetOrgId: organizationId }
        });

        if (!installation) {
            return NextResponse.json({ error: "Installation not found" }, { status: 404 });
        }

        const { resolveGitHubToken } = await import("@repo/agentc2/tools/github-helpers");
        const token = await resolveGitHubToken(organizationId);

        const allRepos: { full_name: string; default_branch: string; private: boolean }[] = [];
        let page = 1;
        const perPage = 100;

        while (page <= 5) {
            const res = await fetch(
                `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=owner,organization_member`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/vnd.github+json"
                    }
                }
            );

            if (!res.ok) {
                return NextResponse.json(
                    { error: `GitHub API error: ${res.status}` },
                    { status: 502 }
                );
            }

            const data = (await res.json()) as {
                full_name: string;
                default_branch: string;
                private: boolean;
            }[];

            allRepos.push(
                ...data.map((r) => ({
                    full_name: r.full_name,
                    default_branch: r.default_branch,
                    private: r.private
                }))
            );

            if (data.length < perPage) break;
            page++;
        }

        return NextResponse.json({ repos: allRepos });
    } catch (error) {
        console.error("[setup/repos]", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Internal server error"
            },
            { status: 500 }
        );
    }
}
