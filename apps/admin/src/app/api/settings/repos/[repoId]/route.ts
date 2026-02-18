import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@repo/admin-auth";
import {
    ADMIN_SETTING_KEYS,
    getAdminSettingValue,
    upsertAdminSetting,
    type PipelineRepository
} from "@/lib/admin-settings";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ repoId: string }> }
) {
    try {
        const admin = await requireAdmin(request, "platform_admin");
        const { repoId } = await params;
        const body = await request.json();
        const markDefault = Boolean(body.isDefault);

        const repositories =
            (await getAdminSettingValue<PipelineRepository[]>(
                ADMIN_SETTING_KEYS.pipelineRepositories
            )) ?? [];
        const target = repositories.find((repo) => repo.id === repoId);
        if (!target) {
            return NextResponse.json({ error: "Repository not found" }, { status: 404 });
        }

        const updated = markDefault
            ? repositories.map((repo) => ({
                  ...repo,
                  isDefault: repo.id === repoId
              }))
            : repositories;

        await upsertAdminSetting(
            ADMIN_SETTING_KEYS.pipelineRepositories,
            updated,
            admin.adminUserId
        );

        return NextResponse.json({ repositories: updated });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ repoId: string }> }
) {
    try {
        const admin = await requireAdmin(request, "platform_admin");
        const { repoId } = await params;
        const repositories =
            (await getAdminSettingValue<PipelineRepository[]>(
                ADMIN_SETTING_KEYS.pipelineRepositories
            )) ?? [];
        const removed = repositories.find((repo) => repo.id === repoId);
        if (!removed) {
            return NextResponse.json({ error: "Repository not found" }, { status: 404 });
        }

        let updated = repositories.filter((repo) => repo.id !== repoId);
        if (updated.length > 0 && !updated.some((repo) => repo.isDefault)) {
            updated = updated.map((repo, index) => ({
                ...repo,
                isDefault: index === 0
            }));
        }

        await upsertAdminSetting(
            ADMIN_SETTING_KEYS.pipelineRepositories,
            updated,
            admin.adminUserId
        );

        return NextResponse.json({ repositories: updated });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
