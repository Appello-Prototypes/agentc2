import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";

export async function GET(request: NextRequest) {
    try {
        await requireAdminAction(request, "playbook:list");

        const url = new URL(request.url);
        const status = url.searchParams.get("status") || "";
        const search = url.searchParams.get("search") || "";
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 100);
        const skip = (page - 1) * limit;

        const where: Prisma.PlaybookWhereInput = {};
        if (status) where.status = status as Prisma.EnumPlaybookStatusFilter;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } }
            ];
        }

        const [playbooks, total] = await Promise.all([
            prisma.playbook.findMany({
                where,
                orderBy: { updatedAt: "desc" },
                skip,
                take: limit,
                include: {
                    publisherOrg: {
                        select: { id: true, name: true, slug: true }
                    },
                    _count: {
                        select: { components: true, installations: true, reviews: true }
                    }
                }
            }),
            prisma.playbook.count({ where })
        ]);

        return NextResponse.json({
            playbooks,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
