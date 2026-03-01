import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@repo/admin-auth";
import {
    ADMIN_SETTING_KEYS,
    getAdminSettingValue,
    upsertAdminSetting,
    type DispatchConfig
} from "@/lib/admin-settings";

export async function GET(request: NextRequest) {
    try {
        await requireAdmin(request, "platform_admin");
        const config = await getAdminSettingValue<DispatchConfig>(
            ADMIN_SETTING_KEYS.dispatchConfig
        );
        return NextResponse.json({ config });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const admin = await requireAdmin(request, "platform_admin");
        const body = await request.json();

        const {
            targetOrganizationId,
            targetOrganizationName,
            workflowId,
            workflowSlug,
            workflowName,
            repository
        } = body;

        if (!targetOrganizationId || !workflowId || !workflowSlug || !repository) {
            return NextResponse.json(
                {
                    error: "targetOrganizationId, workflowId, workflowSlug, and repository are required"
                },
                { status: 400 }
            );
        }

        const config: DispatchConfig = {
            targetOrganizationId,
            targetOrganizationName: targetOrganizationName || "",
            workflowId,
            workflowSlug,
            workflowName: workflowName || "",
            repository
        };

        await upsertAdminSetting(ADMIN_SETTING_KEYS.dispatchConfig, config, admin.adminUserId);

        return NextResponse.json({ config });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
