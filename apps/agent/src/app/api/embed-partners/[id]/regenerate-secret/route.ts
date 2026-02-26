import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireOrgRole } from "@/lib/authz/require-org-role";
import { generateSigningSecret } from "@/lib/embed-identity";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;
    const { userId, organizationId } = authResult.context;

    const roleResult = await requireOrgRole(userId, organizationId, ["owner"]);
    if (roleResult.response) return roleResult.response;

    const { id } = await params;

    try {
        const existing = await prisma.embedPartner.findUnique({
            where: { id },
            select: { organizationId: true }
        });
        if (!existing || existing.organizationId !== organizationId) {
            return NextResponse.json(
                { success: false, error: "Partner not found" },
                { status: 404 }
            );
        }

        const newSecret = generateSigningSecret();

        await prisma.embedPartner.update({
            where: { id },
            data: { signingSecret: newSecret }
        });

        return NextResponse.json({
            success: true,
            signingSecret: newSecret
        });
    } catch (error) {
        console.error("[EmbedPartners API] Regenerate secret error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to regenerate secret"
            },
            { status: 500 }
        );
    }
}
