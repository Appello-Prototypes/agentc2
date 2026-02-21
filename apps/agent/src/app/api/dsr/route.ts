import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { checkRateLimit } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit-log";

const DSR_TYPES = [
    "ACCESS",
    "RECTIFICATION",
    "ERASURE",
    "PORTABILITY",
    "RESTRICTION",
    "OBJECTION"
] as const;

const DSR_RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 5 };

/**
 * POST /api/dsr
 *
 * Create a new Data Subject Request.
 * Accessible by any authenticated user for their own data.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;

        const rl = await checkRateLimit(`dsr-create:${userId}`, DSR_RATE_LIMIT);
        if (!rl.allowed) {
            return NextResponse.json(
                { success: false, error: "Rate limit exceeded. Max 5 DSRs per hour." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000))
                    }
                }
            );
        }

        const body = await request.json();
        const { type, jurisdiction, notes } = body as {
            type?: string;
            jurisdiction?: string;
            notes?: string;
        };

        if (!type || !DSR_TYPES.includes(type as (typeof DSR_TYPES)[number])) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid type. Must be one of: ${DSR_TYPES.join(", ")}`
                },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true }
        });

        const dsr = await prisma.dataSubjectRequest.create({
            data: {
                type,
                jurisdiction: jurisdiction || null,
                requestorEmail: user?.email || "",
                requestorUserId: userId,
                notes: notes || null
            }
        });

        await auditLog.create({
            action: "DSR_CREATE",
            entityType: "DataSubjectRequest",
            entityId: dsr.id,
            userId,
            metadata: { type, jurisdiction }
        });

        return NextResponse.json({ success: true, dsr }, { status: 201 });
    } catch (error) {
        console.error("[DSR Create] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create DSR"
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/dsr
 *
 * List DSRs. Users see their own; admins (org owners) see all for their org.
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;

        const dsrs = await prisma.dataSubjectRequest.findMany({
            where: { requestorUserId: userId },
            orderBy: { createdAt: "desc" },
            take: 100
        });

        return NextResponse.json({ success: true, dsrs });
    } catch (error) {
        console.error("[DSR List] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list DSRs"
            },
            { status: 500 }
        );
    }
}
