import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

export async function GET(request: NextRequest) {
    try {
        await requireAdminAction(request, "flag:list");

        const flags = await prisma.featureFlag.findMany({
            orderBy: { key: "asc" },
            include: { _count: { select: { overrides: true } } }
        });

        return NextResponse.json({ flags });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const admin = await requireAdminAction(request, "flag:create");
        const body = await request.json();

        if (!body.key || !body.name) {
            return NextResponse.json({ error: "key and name are required" }, { status: 400 });
        }

        const flag = await prisma.featureFlag.create({
            data: {
                key: body.key,
                name: body.name,
                description: body.description,
                flagType: body.flagType || "boolean",
                defaultValue: body.defaultValue || "false",
                isActive: body.isActive ?? true
            }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "FLAG_CREATE",
            entityType: "FeatureFlag",
            entityId: flag.id,
            afterJson: flag,
            ipAddress,
            userAgent
        });

        return NextResponse.json({ flag }, { status: 201 });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
