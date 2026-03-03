import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

type Params = { params: Promise<{ slug: string; versionNumber: string }> };

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { slug, versionNumber } = await params;
        const targetVersion = parseInt(versionNumber, 10);

        if (isNaN(targetVersion)) {
            return NextResponse.json({ error: "Invalid version number" }, { status: 400 });
        }

        const playbook = await prisma.playbook.findUnique({ where: { slug } });
        if (!playbook) {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }
        if (playbook.publisherOrgId !== authResult.context.organizationId) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        const sourceVersion = await prisma.playbookVersion.findFirst({
            where: { playbookId: playbook.id, version: targetVersion }
        });
        if (!sourceVersion) {
            return NextResponse.json({ error: "Version not found" }, { status: 404 });
        }

        const latestVersion = await prisma.playbookVersion.findFirst({
            where: { playbookId: playbook.id },
            orderBy: { version: "desc" }
        });
        const nextVersion = (latestVersion?.version ?? 0) + 1;

        await prisma.$transaction(async (tx) => {
            await tx.playbookVersion.create({
                data: {
                    playbookId: playbook.id,
                    version: nextVersion,
                    manifest: sourceVersion.manifest as Record<string, unknown>,
                    changelog: `Reverted to v${targetVersion}`,
                    createdBy: authResult.context.userId
                }
            });

            await tx.playbook.update({
                where: { id: playbook.id },
                data: { version: nextVersion }
            });
        });

        return NextResponse.json({
            success: true,
            version: nextVersion,
            revertedFrom: targetVersion
        });
    } catch (error) {
        console.error("[playbooks] Version revert error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
