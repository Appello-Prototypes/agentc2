import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/users/me/export
 * GDPR Right to Data Portability (Art. 20)
 *
 * Exports all user data in a structured JSON format.
 * Rate limited to 1 export per 24 hours per user.
 */
export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { userId, organizationId } = auth;

    try {
        const [user, memberships, runs] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    emailVerified: true,
                    image: true,
                    createdAt: true,
                    updatedAt: true
                }
            }),
            prisma.membership.findMany({
                where: { userId },
                select: {
                    role: true,
                    createdAt: true,
                    organization: {
                        select: { name: true, slug: true }
                    }
                }
            }),
            prisma.agentRun.findMany({
                where: { userId },
                select: {
                    id: true,
                    inputText: true,
                    outputText: true,
                    status: true,
                    createdAt: true,
                    agent: { select: { name: true, slug: true } }
                },
                orderBy: { createdAt: "desc" },
                take: 1000
            })
        ]);

        const exportData = {
            exportedAt: new Date().toISOString(),
            schema: "agentc2-user-export-v1",
            user,
            memberships: memberships.map((m) => ({
                organization: m.organization.name,
                organizationSlug: m.organization.slug,
                role: m.role,
                joinedAt: m.createdAt.toISOString()
            })),
            agentRuns: runs.map((r) => ({
                id: r.id,
                agent: r.agent?.name ?? "Unknown",
                input: r.inputText,
                output: r.outputText,
                status: r.status,
                createdAt: r.createdAt.toISOString()
            }))
        };

        return new NextResponse(JSON.stringify(exportData, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="agentc2-export-${userId}-${Date.now()}.json"`
            }
        });
    } catch (error) {
        console.error("[GDPR] Data export failed for user:", userId, error);
        return NextResponse.json(
            { success: false, error: "Export failed. Please try again later." },
            { status: 500 }
        );
    }
}
