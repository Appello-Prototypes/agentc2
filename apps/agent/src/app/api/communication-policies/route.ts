import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const scope = searchParams.get("scope");
        const scopeId = searchParams.get("scopeId");
        const enabled = searchParams.get("enabled");

        const policies = await prisma.communicationPolicy.findMany({
            where: {
                ...(scope ? { scope } : {}),
                ...(scopeId ? { scopeId } : {}),
                ...(enabled !== null ? { enabled: enabled !== "false" } : {})
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
        const body = await request.json();
        const { scope, scopeId, name, description, rules, priority, enabled, createdBy } = body;

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
                createdBy: createdBy || null
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
