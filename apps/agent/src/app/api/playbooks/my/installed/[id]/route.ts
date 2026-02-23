import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";
import { uninstallPlaybook } from "@repo/agentc2";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/playbooks/my/installed/[id]
 * Uninstall a playbook
 */
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { id } = await params;

        const installation = await prisma.playbookInstallation.findUnique({
            where: { id }
        });

        if (!installation) {
            return NextResponse.json({ error: "Installation not found" }, { status: 404 });
        }
        if (installation.targetOrgId !== authResult.context.organizationId) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }
        if (installation.status === "UNINSTALLED") {
            return NextResponse.json({ error: "Already uninstalled" }, { status: 400 });
        }

        await uninstallPlaybook(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[playbooks] Uninstall error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
