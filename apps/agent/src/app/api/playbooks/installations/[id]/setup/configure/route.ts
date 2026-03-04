import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";
import type { Prisma } from "@repo/database";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/playbooks/installations/[id]/setup/configure
 *
 * Handles custom config step completion. Accepts { stepId, data }.
 * Known step types (repo-select, webhook-create) have built-in handlers.
 */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { id } = await params;
        const { organizationId } = authResult.context;

        const body = await request.json();
        const { stepId, data } = body as {
            stepId: string;
            data: Record<string, unknown>;
        };

        if (!stepId) {
            return NextResponse.json({ error: "stepId is required" }, { status: 400 });
        }

        const installation = await prisma.playbookInstallation.findFirst({
            where: { id, targetOrgId: organizationId }
        });

        if (!installation) {
            return NextResponse.json({ error: "Installation not found" }, { status: 404 });
        }

        const customizations = (installation.customizations as Record<string, unknown>) ?? {};
        const setupConfig =
            (customizations.setupConfig as {
                steps?: { id: string; type: string }[];
            }) ?? null;

        const stepDef = setupConfig?.steps?.find((s) => s.id === stepId);
        if (!stepDef) {
            return NextResponse.json({ error: `Unknown step: ${stepId}` }, { status: 400 });
        }

        let stepResult: Record<string, unknown> = data ?? {};

        if (stepDef.type === "repo-select") {
            const repository = data?.repository as string;
            if (!repository) {
                return NextResponse.json(
                    { error: "repository is required for repo-select step" },
                    { status: 400 }
                );
            }
            stepResult = { repository, completedAt: new Date().toISOString() };
        }

        if (stepDef.type === "webhook-create") {
            const repository = data?.repository as string;
            const webhookPath = data?.webhookPath as string;

            if (!repository || !webhookPath) {
                return NextResponse.json(
                    {
                        error: "repository and webhookPath are required for webhook-create step"
                    },
                    { status: 400 }
                );
            }

            try {
                const { resolveGitHubToken, parseRepoOwnerName } =
                    await import("@repo/agentc2/tools/github-helpers");
                const token = await resolveGitHubToken(organizationId);
                const { owner, repo } = parseRepoOwnerName(repository);

                const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://agentc2.ai";

                const webhookUrl = `${baseUrl}/api/webhooks/${webhookPath}`;

                const response = await fetch(
                    `https://api.github.com/repos/${owner}/${repo}/hooks`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: "application/vnd.github+json",
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            name: "web",
                            active: true,
                            events: ["issues", "issue_comment"],
                            config: {
                                url: webhookUrl,
                                content_type: "json",
                                insecure_ssl: "0"
                            }
                        })
                    }
                );

                if (!response.ok) {
                    const errBody = await response.json().catch(() => ({}));
                    return NextResponse.json(
                        {
                            error: `GitHub webhook creation failed: ${response.status}`,
                            details: errBody
                        },
                        { status: 502 }
                    );
                }

                const hookData = (await response.json()) as {
                    id: number;
                    config: { url: string };
                };

                stepResult = {
                    repository,
                    webhookPath,
                    webhookUrl,
                    githubWebhookId: hookData.id,
                    completedAt: new Date().toISOString()
                };
            } catch (err) {
                return NextResponse.json(
                    {
                        error: err instanceof Error ? err.message : "Failed to create webhook"
                    },
                    { status: 500 }
                );
            }
        }

        if (!stepResult.completedAt) {
            stepResult.completedAt = new Date().toISOString();
        }

        const existingStepData = (customizations.stepData as Record<string, unknown>) ?? {};
        const updatedCustomizations = {
            ...customizations,
            stepData: {
                ...existingStepData,
                [stepId]: stepResult
            }
        };

        await prisma.playbookInstallation.update({
            where: { id },
            data: {
                customizations: updatedCustomizations as Prisma.InputJsonValue
            }
        });

        return NextResponse.json({ success: true, stepId, data: stepResult });
    } catch (error) {
        console.error("[setup/configure]", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Internal server error"
            },
            { status: 500 }
        );
    }
}
