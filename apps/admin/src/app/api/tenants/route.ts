import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { createTenant } from "@/lib/tenant-actions";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

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

export async function POST(request: NextRequest) {
    try {
        const admin = await requireAdminAction(request, "tenant:create");
        const body = await request.json();

        if (!body.name?.trim()) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }
        if (!body.slug?.trim()) {
            return NextResponse.json({ error: "Slug is required" }, { status: 400 });
        }

        const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
        if (!slugRegex.test(body.slug)) {
            return NextResponse.json(
                { error: "Slug must be lowercase alphanumeric with optional hyphens" },
                { status: 400 }
            );
        }

        const org = await createTenant(
            {
                name: body.name.trim(),
                slug: body.slug.trim().toLowerCase(),
                description: body.description?.trim() || undefined,
                status: body.status || "active",
                maxAgents: body.maxAgents != null ? parseInt(body.maxAgents) : undefined,
                maxWorkspaces:
                    body.maxWorkspaces != null ? parseInt(body.maxWorkspaces) : undefined,
                maxRunsPerMonth:
                    body.maxRunsPerMonth != null ? parseInt(body.maxRunsPerMonth) : undefined,
                maxSeats: body.maxSeats != null ? parseInt(body.maxSeats) : undefined,
                timezone: body.timezone?.trim() || undefined
            },
            admin.adminUserId
        );

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "TENANT_CREATE",
            entityType: "Organization",
            entityId: org.id,
            afterJson: { name: org.name, slug: org.slug, status: org.status },
            ipAddress,
            userAgent
        });

        return NextResponse.json({ tenant: org }, { status: 201 });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        const msg = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}
