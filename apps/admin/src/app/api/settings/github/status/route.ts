import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@repo/admin-auth";
import {
    ADMIN_SETTING_KEYS,
    getAdminSettingValue,
    type GitHubConnectionSetting
} from "@/lib/admin-settings";

export async function GET(request: NextRequest) {
    try {
        await requireAdmin(request, "platform_admin");
        const connection = await getAdminSettingValue<GitHubConnectionSetting>(
            ADMIN_SETTING_KEYS.githubConnection
        );

        if (!connection?.username) {
            return NextResponse.json({ connected: false, profile: null });
        }

        return NextResponse.json({
            connected: true,
            profile: {
                username: connection.username,
                avatarUrl: connection.avatarUrl ?? null,
                connectedAt: connection.connectedAt
            }
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
