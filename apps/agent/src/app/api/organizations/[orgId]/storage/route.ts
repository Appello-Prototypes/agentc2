import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/organizations/[orgId]/storage
 *
 * Returns workspace file storage usage for the organization,
 * broken down by agent with org-level totals and quota info.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const apiAuth = await authenticateRequest(_request);
        let userId = apiAuth?.userId;

        if (!userId) {
            const session = await auth.api.getSession({
                headers: await headers()
            });
            userId = session?.user?.id;
        }

        if (!userId) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;

        const organization = await prisma.organization.findFirst({
            where: {
                OR: [{ id: orgId }, { slug: orgId }]
            },
            select: {
                id: true,
                name: true,
                maxStorageBytes: true
            }
        });

        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        // Verify the user belongs to this org
        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId: organization.id
                }
            }
        });

        if (!membership) {
            return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
        }
        if (membership.role !== "owner" && membership.role !== "admin") {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        const agentUsage = await prisma.workspaceStorageUsage.findMany({
            where: { organizationId: organization.id },
            include: {
                agent: {
                    select: { slug: true, name: true }
                }
            },
            orderBy: { totalBytes: "desc" }
        });

        const totalBytes = agentUsage.reduce((sum, u) => sum + Number(u.totalBytes), 0);
        const totalFiles = agentUsage.reduce((sum, u) => sum + u.fileCount, 0);

        const quotaBytes = organization.maxStorageBytes
            ? Number(organization.maxStorageBytes)
            : null;

        return NextResponse.json({
            success: true,
            storage: {
                totalBytes,
                totalFiles,
                quotaBytes,
                usagePercent: quotaBytes ? Math.round((totalBytes / quotaBytes) * 100) : null,
                agents: agentUsage.map((u) => ({
                    agentId: u.agentId,
                    agentSlug: u.agent.slug,
                    agentName: u.agent.name,
                    totalBytes: Number(u.totalBytes),
                    fileCount: u.fileCount,
                    lastWriteAt: u.lastWriteAt
                }))
            }
        });
    } catch (error) {
        console.error("Storage usage error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch storage usage"
            },
            { status: 500 }
        );
    }
}
