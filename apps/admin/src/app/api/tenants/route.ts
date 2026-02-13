import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";

export async function GET(request: NextRequest) {
    try {
        await requireAdminAction(request, "tenant:list");

        const url = new URL(request.url);
        const search = url.searchParams.get("search") || "";
        const status = url.searchParams.get("status") || "";
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 100);
        const skip = (page - 1) * limit;

        const where: Prisma.OrganizationWhereInput = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } }
            ];
        }
        if (status) {
            where.status = status;
        }

        const [tenants, total] = await Promise.all([
            prisma.organization.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                include: {
                    _count: {
                        select: {
                            workspaces: true,
                            memberships: true
                        }
                    }
                }
            }),
            prisma.organization.count({ where })
        ]);

        return NextResponse.json({
            tenants,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Tenants] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
