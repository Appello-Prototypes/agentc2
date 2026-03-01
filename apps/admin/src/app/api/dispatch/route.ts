import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdmin, AdminAuthError } from "@repo/admin-auth";
import {
    ADMIN_SETTING_KEYS,
    getAdminSettingValue,
    type DispatchConfig
} from "@/lib/admin-settings";

/**
 * POST /admin/api/dispatch
 * Server-side proxy that dispatches a ticket to the agent app's coding pipeline.
 * Uses the saved dispatch config (targetOrgId + workflowId) and authenticates
 * with the agent API via MCP_API_KEY.
 */
export async function POST(request: NextRequest) {
    try {
        await requireAdmin(request, "platform_admin");

        const body = await request.json();
        const { sourceType, sourceId, title, description, labels } = body;

        if (!sourceType || !sourceId) {
            return NextResponse.json(
                { error: "Missing required fields: sourceType, sourceId" },
                { status: 400 }
            );
        }

        const config = await getAdminSettingValue<DispatchConfig>(
            ADMIN_SETTING_KEYS.dispatchConfig
        );
        if (!config) {
            return NextResponse.json(
                {
                    error: "No dispatch configuration saved. Go to Settings > Dispatch to configure."
                },
                { status: 400 }
            );
        }

        const org = await prisma.organization.findUnique({
            where: { id: config.targetOrganizationId },
            select: { slug: true }
        });
        if (!org) {
            return NextResponse.json(
                { error: "Configured target organization no longer exists" },
                { status: 404 }
            );
        }

        const agentBaseUrl = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";
        const agentPath = agentBaseUrl.includes("localhost") ? "" : "/agent";
        const apiKey = process.env.MCP_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: "MCP_API_KEY not configured on admin server" },
                { status: 500 }
            );
        }

        const dispatchPayload = {
            sourceType,
            sourceId,
            repository: config.repository,
            variant: "standard",
            via: "github",
            title: title || "",
            description: description || "",
            labels: labels || ["agentc2-sdlc"],
            targetOrganizationId: config.targetOrganizationId,
            workflowId: config.workflowId
        };

        const res = await fetch(`${agentBaseUrl}${agentPath}/api/coding-pipeline/dispatch`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey,
                "X-Organization-Slug": org.slug
            },
            body: JSON.stringify(dispatchPayload)
        });

        const data = await res.json().catch(() => ({ error: "Invalid response from agent API" }));

        if (!res.ok) {
            return NextResponse.json(
                { error: data.error || "Agent API returned an error", details: data },
                { status: res.status }
            );
        }

        return NextResponse.json({
            success: true,
            ...data,
            dispatchConfig: {
                organizationName: config.targetOrganizationName,
                workflowName: config.workflowName,
                workflowSlug: config.workflowSlug
            }
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Dispatch] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
