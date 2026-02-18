import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@repo/admin-auth";
import { ADMIN_SETTING_KEYS, deleteAdminSetting } from "@/lib/admin-settings";

export async function DELETE(request: NextRequest) {
    try {
        await requireAdmin(request, "platform_admin");
        await deleteAdminSetting(ADMIN_SETTING_KEYS.githubConnection);
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
