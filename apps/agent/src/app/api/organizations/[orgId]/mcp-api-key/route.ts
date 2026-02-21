import { NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "crypto";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";
import { buildHashedCredential, getKeyPrefix } from "@/lib/api-key-hash";

const TOOL_ID = "mastra-mcp-api";
const TOOL_NAME = "AgentC2 MCP API Key";
const ADMIN_ROLES = new Set(["owner", "admin"]);

async function getOrgAndMembership(userId: string, orgId: string) {
    const organization = await prisma.organization.findFirst({
        where: {
            OR: [{ id: orgId }, { slug: orgId }]
        }
    });

    if (!organization) {
        return { organization: null, membership: null };
    }

    const membership = await prisma.membership.findUnique({
        where: {
            userId_organizationId: {
                userId,
                organizationId: organization.id
            }
        }
    });

    return { organization, membership };
}

function maskPrefix(prefix: string | null): string | null {
    if (!prefix) return null;
    return `${prefix}••••••••••••`;
}

export async function GET(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;
        const { organization, membership } = await getOrgAndMembership(session.user.id, orgId);

        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        if (!membership || !ADMIN_ROLES.has(membership.role)) {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        const credential = await prisma.toolCredential.findUnique({
            where: {
                organizationId_toolId: {
                    organizationId: organization.id,
                    toolId: TOOL_ID
                }
            }
        });

        const credentialPayload = credential?.credentials;
        const prefix =
            credential?.isActive && credentialPayload ? getKeyPrefix(credentialPayload) : null;

        await auditLog.create({
            action: "CREDENTIAL_ACCESS",
            entityType: "ToolCredential",
            entityId: credential?.id || `${organization.id}:${TOOL_ID}`,
            userId: session.user.id,
            metadata: { organizationId: organization.id, toolId: TOOL_ID }
        });

        return NextResponse.json({
            success: true,
            apiKeyMasked: maskPrefix(prefix),
            hasApiKey: !!prefix,
            isActive: credential?.isActive ?? false,
            createdAt: credential?.createdAt ?? null,
            updatedAt: credential?.updatedAt ?? null
        });
    } catch (error) {
        console.error("[MCP API Key] Error fetching:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch MCP API key"
            },
            { status: 500 }
        );
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;
        const { organization, membership } = await getOrgAndMembership(session.user.id, orgId);

        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        if (!membership || !ADMIN_ROLES.has(membership.role)) {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        const apiKey = crypto.randomBytes(32).toString("hex");
        const hashedCredential = buildHashedCredential(apiKey);
        const credential = await prisma.toolCredential.upsert({
            where: {
                organizationId_toolId: {
                    organizationId: organization.id,
                    toolId: TOOL_ID
                }
            },
            create: {
                organizationId: organization.id,
                toolId: TOOL_ID,
                name: TOOL_NAME,
                credentials: hashedCredential,
                isActive: true,
                createdBy: session.user.id
            },
            update: {
                name: TOOL_NAME,
                credentials: hashedCredential,
                isActive: true,
                updatedAt: new Date()
            }
        });

        await auditLog.create({
            action: "CREDENTIAL_UPDATE",
            entityType: "ToolCredential",
            entityId: credential.id,
            userId: session.user.id,
            metadata: { organizationId: organization.id, toolId: TOOL_ID }
        });

        return NextResponse.json({
            success: true,
            apiKey,
            credential: {
                id: credential.id,
                isActive: credential.isActive,
                updatedAt: credential.updatedAt
            }
        });
    } catch (error) {
        console.error("[MCP API Key] Error generating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to generate MCP API key"
            },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;
        const { organization, membership } = await getOrgAndMembership(session.user.id, orgId);

        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        if (!membership || !ADMIN_ROLES.has(membership.role)) {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        const existing = await prisma.toolCredential.findUnique({
            where: {
                organizationId_toolId: {
                    organizationId: organization.id,
                    toolId: TOOL_ID
                }
            }
        });

        if (!existing) {
            return NextResponse.json(
                { success: false, error: "MCP API key not found" },
                { status: 404 }
            );
        }

        const credential = await prisma.toolCredential.update({
            where: { id: existing.id },
            data: {
                isActive: false,
                credentials: {},
                updatedAt: new Date()
            }
        });

        await auditLog.create({
            action: "CREDENTIAL_DELETE",
            entityType: "ToolCredential",
            entityId: credential.id,
            userId: session.user.id,
            metadata: { organizationId: organization.id, toolId: TOOL_ID }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[MCP API Key] Error revoking:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to revoke MCP API key"
            },
            { status: 500 }
        );
    }
}
