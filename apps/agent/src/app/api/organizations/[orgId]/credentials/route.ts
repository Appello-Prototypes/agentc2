import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";

/**
 * GET /api/organizations/[orgId]/credentials
 *
 * List tool credentials for an organization (without exposing secrets)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const { orgId } = await params;

        // Find organization
        const organization = await prisma.organization.findFirst({
            where: {
                OR: [{ id: orgId }, { slug: orgId }]
            }
        });

        if (!organization) {
            return NextResponse.json(
                { success: false, error: `Organization '${orgId}' not found` },
                { status: 404 }
            );
        }

        // Get credentials (without exposing actual credentials)
        const credentials = await prisma.toolCredential.findMany({
            where: { organizationId: organization.id },
            orderBy: { name: "asc" }
        });

        return NextResponse.json({
            success: true,
            credentials: credentials.map((cred) => ({
                id: cred.id,
                toolId: cred.toolId,
                name: cred.name,
                isActive: cred.isActive,
                lastUsedAt: cred.lastUsedAt,
                createdAt: cred.createdAt,
                updatedAt: cred.updatedAt,
                // Don't expose actual credentials
                hasCredentials: !!cred.credentials
            })),
            total: credentials.length
        });
    } catch (error) {
        console.error("[Credentials] Error listing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list credentials"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/organizations/[orgId]/credentials
 *
 * Create or update tool credentials for an organization
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const { orgId } = await params;
        const body = await request.json();
        const { toolId, name, credentials, isActive } = body;

        if (!toolId || !name || !credentials) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required fields: toolId, name, credentials"
                },
                { status: 400 }
            );
        }

        // Find organization
        const organization = await prisma.organization.findFirst({
            where: {
                OR: [{ id: orgId }, { slug: orgId }]
            }
        });

        if (!organization) {
            return NextResponse.json(
                { success: false, error: `Organization '${orgId}' not found` },
                { status: 404 }
            );
        }

        // Upsert credential
        const credential = await prisma.toolCredential.upsert({
            where: {
                organizationId_toolId: {
                    organizationId: organization.id,
                    toolId
                }
            },
            create: {
                organizationId: organization.id,
                toolId,
                name,
                credentials,
                isActive: isActive !== false
            },
            update: {
                name,
                credentials,
                isActive: isActive !== false,
                updatedAt: new Date()
            }
        });

        // Audit log
        await auditLog.create({
            action: "CREDENTIAL_CREATE",
            entityType: "ToolCredential",
            entityId: credential.id,
            metadata: { organizationId: organization.id, toolId, name }
        });

        return NextResponse.json({
            success: true,
            credential: {
                id: credential.id,
                toolId: credential.toolId,
                name: credential.name,
                isActive: credential.isActive,
                createdAt: credential.createdAt,
                updatedAt: credential.updatedAt
            }
        });
    } catch (error) {
        console.error("[Credentials] Error creating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create credentials"
            },
            { status: 500 }
        );
    }
}
