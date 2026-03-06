import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { computeIntegrityHash } from "@/lib/audit-log";

export async function POST(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const membership = await prisma.membership.findFirst({
            where: { userId: authContext.userId, organizationId: authContext.organizationId }
        });
        if (!membership || !["owner", "admin"].includes(membership.role)) {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { startDate, endDate, limit } = body as {
            startDate?: string;
            endDate?: string;
            limit?: number;
        };

        const where: Record<string, unknown> = {
            tenantId: authContext.organizationId
        };
        if (startDate || endDate) {
            const createdAt: Record<string, Date> = {};
            if (startDate) createdAt.gte = new Date(startDate);
            if (endDate) createdAt.lte = new Date(endDate);
            where.createdAt = createdAt;
        }

        const logs = await prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: "asc" },
            take: limit || 1000
        });

        let chainIntact = true;
        let firstBreak: { id: string; createdAt: Date } | null = null;
        let previousHash: string | null = null;

        if (logs.length > 0) {
            const firstLog = logs[0]!;
            const preceding = await prisma.auditLog.findFirst({
                where: {
                    tenantId: authContext.organizationId,
                    createdAt: { lt: firstLog.createdAt }
                },
                orderBy: { createdAt: "desc" },
                select: { integrityHash: true }
            });
            previousHash = preceding?.integrityHash || null;
        }

        for (const log of logs) {
            const expectedHash = await computeIntegrityHash(
                {
                    action: log.action,
                    entityType: log.entityType,
                    entityId: log.entityId,
                    actorId: log.actorId,
                    tenantId: log.tenantId
                },
                previousHash
            );

            if (log.integrityHash && log.integrityHash !== expectedHash) {
                chainIntact = false;
                if (!firstBreak) {
                    firstBreak = { id: log.id, createdAt: log.createdAt };
                }
            }

            previousHash = log.integrityHash || expectedHash;
        }

        return NextResponse.json({
            success: true,
            verified: chainIntact,
            totalChecked: logs.length,
            firstBreak,
            chainIntact
        });
    } catch (error) {
        console.error("[Audit Logs Verify] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to verify audit logs"
            },
            { status: 500 }
        );
    }
}
