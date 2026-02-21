import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { checkRateLimit } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit-log";

const EXPORT_RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 1 };

/**
 * GET /api/user/data-export
 *
 * Export all user data as a JSON bundle (GDPR / PIPEDA Data Subject Access Request).
 * Rate-limited to 1 request per hour.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;

        const rl = await checkRateLimit(`data-export:${userId}`, EXPORT_RATE_LIMIT);
        if (!rl.allowed) {
            return NextResponse.json(
                { success: false, error: "Rate limit exceeded. One export per hour." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000))
                    }
                }
            );
        }

        const [
            user,
            memberships,
            integrations,
            documents,
            auditLogs,
            agentRuns,
            feedback,
            costEvents,
            supportTickets,
            guardrailEvents,
            consentRecords,
            dsrs
        ] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    emailVerified: true,
                    image: true,
                    timezone: true,
                    termsAcceptedAt: true,
                    privacyConsentAt: true,
                    marketingConsent: true,
                    createdAt: true,
                    updatedAt: true
                }
            }),
            prisma.membership.findMany({
                where: { userId },
                select: {
                    organizationId: true,
                    role: true,
                    createdAt: true
                }
            }),
            prisma.integrationConnection.findMany({
                where: { userId },
                select: {
                    id: true,
                    providerId: true,
                    name: true,
                    scope: true,
                    isActive: true,
                    createdAt: true,
                    lastUsedAt: true
                }
            }),
            prisma.document.findMany({
                where: { createdBy: userId },
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    category: true,
                    tags: true,
                    createdAt: true,
                    updatedAt: true
                },
                take: 500
            }),
            prisma.auditLog.findMany({
                where: { actorId: userId },
                select: {
                    id: true,
                    action: true,
                    entityType: true,
                    entityId: true,
                    createdAt: true
                },
                orderBy: { createdAt: "desc" },
                take: 1000
            }),
            prisma.agentRun.findMany({
                where: { userId },
                select: {
                    id: true,
                    agentId: true,
                    status: true,
                    inputText: true,
                    outputText: true,
                    costUsd: true,
                    totalTokens: true,
                    durationMs: true,
                    createdAt: true
                },
                orderBy: { createdAt: "desc" },
                take: 500
            }),
            prisma.agentRun.findMany({
                where: { userId },
                select: {
                    id: true,
                    feedbacks: {
                        select: {
                            id: true,
                            thumbs: true,
                            rating: true,
                            comment: true,
                            source: true,
                            createdAt: true
                        }
                    }
                },
                orderBy: { createdAt: "desc" },
                take: 500
            }),
            prisma.costEvent.findMany({
                where: { userId },
                select: {
                    id: true,
                    agentId: true,
                    provider: true,
                    modelName: true,
                    totalTokens: true,
                    costUsd: true,
                    createdAt: true
                },
                orderBy: { createdAt: "desc" },
                take: 1000
            }),
            prisma.supportTicket.findMany({
                where: { submittedById: userId },
                select: {
                    id: true,
                    ticketNumber: true,
                    type: true,
                    status: true,
                    priority: true,
                    title: true,
                    description: true,
                    createdAt: true,
                    updatedAt: true
                },
                orderBy: { createdAt: "desc" },
                take: 100
            }),
            prisma.guardrailEvent.findMany({
                where: {
                    run: { userId }
                },
                select: {
                    id: true,
                    agentId: true,
                    type: true,
                    guardrailKey: true,
                    reason: true,
                    createdAt: true
                },
                orderBy: { createdAt: "desc" },
                take: 500
            }),
            prisma.consentRecord.findMany({
                where: { userId },
                select: {
                    id: true,
                    consentType: true,
                    version: true,
                    granted: true,
                    createdAt: true,
                    revokedAt: true
                },
                orderBy: { createdAt: "desc" }
            }),
            prisma.dataSubjectRequest.findMany({
                where: { requestorUserId: userId },
                select: {
                    id: true,
                    type: true,
                    status: true,
                    jurisdiction: true,
                    createdAt: true,
                    completedAt: true
                },
                orderBy: { createdAt: "desc" }
            })
        ]);

        const flatFeedback = feedback.flatMap((run) =>
            run.feedbacks.map((fb) => ({ ...fb, runId: run.id }))
        );

        await auditLog.create({
            action: "USER_DATA_EXPORT",
            entityType: "User",
            entityId: userId,
            userId,
            metadata: { type: "data-export" }
        });

        const exportData = {
            exportedAt: new Date().toISOString(),
            dataCategories: [
                "user",
                "memberships",
                "integrations",
                "documents",
                "auditLogs",
                "agentRuns",
                "feedback",
                "costEvents",
                "supportTickets",
                "guardrailEvents",
                "consentRecords",
                "dataSubjectRequests"
            ],
            user,
            memberships,
            integrations,
            documents,
            auditLogs,
            agentRuns,
            feedback: flatFeedback,
            costEvents,
            supportTickets,
            guardrailEvents,
            consentRecords,
            dataSubjectRequests: dsrs
        };

        return NextResponse.json({ success: true, data: exportData });
    } catch (error) {
        console.error("[Data Export] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to export data"
            },
            { status: 500 }
        );
    }
}
