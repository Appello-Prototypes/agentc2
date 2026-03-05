import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const scope = searchParams.get("scope");
        const scopeId = searchParams.get("scopeId");
        const enabled = searchParams.get("enabled");

        const workspaces = await prisma.workspace.findMany({
            where: { organizationId: authContext.organizationId },
            select: { id: true }
        });
        const workspaceIds = workspaces.map((w) => w.id);

        const agents = await prisma.agent.findMany({
            where: { workspaceId: { in: workspaceIds } },
            select: { id: true }
        });
        const agentIds = agents.map((a) => a.id);

        const orgScopeFilter = [
            { scope: "organization", scopeId: authContext.organizationId },
            ...(workspaceIds.length > 0
                ? [{ scope: "workspace", scopeId: { in: workspaceIds } }]
                : []),
            ...(agentIds.length > 0 ? [{ scope: "agent", scopeId: { in: agentIds } }] : []),
            { scope: "user", scopeId: authContext.userId }
        ];

        const userFilters: Record<string, unknown> = {};
        if (scope) userFilters.scope = scope;
        if (scopeId) userFilters.scopeId = scopeId;
        if (enabled !== null) userFilters.enabled = enabled !== "false";

        const policies = await prisma.communicationPolicy.findMany({
            where: {
                AND: [{ OR: orgScopeFilter }, userFilters]
            },
            orderBy: [{ scope: "asc" }, { priority: "asc" }]
        });

        return NextResponse.json({ success: true, policies });
    } catch (error) {
        console.error("[CommPolicy List] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to list policies" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { scope, scopeId, name, description, rules, priority, enabled } = body;

        if (!scope || !scopeId || !rules) {
            return NextResponse.json(
                { success: false, error: "scope, scopeId, and rules are required" },
                { status: 400 }
            );
        }

        const validScopes = ["organization", "workspace", "network", "agent", "user"];
        if (!validScopes.includes(scope)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid scope. Must be one of: ${validScopes.join(", ")}`
                },
                { status: 400 }
            );
        }

        const policy = await prisma.communicationPolicy.create({
            data: {
                scope,
                scopeId,
                name: name || null,
                description: description || null,
                rules,
                priority: priority ?? 0,
                enabled: enabled ?? true,
                createdBy: authContext.userId
            }
        });

        return NextResponse.json({ success: true, policy }, { status: 201 });
    } catch (error) {
        console.error("[CommPolicy Create] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to create policy" },
            { status: 500 }
        );
    }
}
