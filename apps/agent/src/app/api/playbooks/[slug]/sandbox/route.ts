import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/playbooks/[slug]/sandbox
 *
 * Returns sandbox chat info for a playbook's entry-point agent.
 * The agent must be PUBLIC with a publicToken set in the publisher's workspace.
 * No auth required — this is a public preview endpoint.
 */
export async function GET(_request: NextRequest, { params }: Params) {
    try {
        const { slug } = await params;

        const playbook = await prisma.playbook.findUnique({
            where: { slug },
            select: {
                id: true,
                publisherOrgId: true,
                status: true,
                versions: {
                    orderBy: { version: "desc" },
                    take: 1,
                    select: { manifest: true }
                }
            }
        });

        if (!playbook || playbook.status !== "PUBLISHED") {
            return NextResponse.json(
                { available: false, reason: "Playbook not found" },
                { status: 404 }
            );
        }

        const manifest = playbook.versions[0]?.manifest as {
            entryPoint?: { type: string; slug: string };
        } | null;

        if (!manifest?.entryPoint || manifest.entryPoint.type !== "agent") {
            return NextResponse.json({
                available: false,
                reason: "No agent entry point configured"
            });
        }

        const entrySlug = manifest.entryPoint.slug;

        const publisherWorkspace = await prisma.workspace.findFirst({
            where: { organizationId: playbook.publisherOrgId, isDefault: true },
            select: { id: true }
        });

        if (!publisherWorkspace) {
            return NextResponse.json({
                available: false,
                reason: "Publisher workspace not found"
            });
        }

        const agent = await prisma.agent.findFirst({
            where: {
                slug: entrySlug,
                workspaceId: publisherWorkspace.id,
                visibility: "PUBLIC",
                isActive: true,
                publicToken: { not: null }
            },
            select: {
                slug: true,
                name: true,
                publicToken: true
            }
        });

        if (!agent || !agent.publicToken) {
            return NextResponse.json({
                available: false,
                reason: "Sandbox not available for this playbook"
            });
        }

        return NextResponse.json({
            available: true,
            agentSlug: agent.slug,
            agentName: agent.name,
            token: agent.publicToken
        });
    } catch (error) {
        console.error("[playbook sandbox] Error:", error);
        return NextResponse.json({ available: false, reason: "Internal error" }, { status: 500 });
    }
}
