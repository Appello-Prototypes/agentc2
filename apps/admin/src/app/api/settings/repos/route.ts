import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@repo/admin-auth";
import {
    ADMIN_SETTING_KEYS,
    getAdminSettingValue,
    upsertAdminSetting,
    type PipelineRepository
} from "@/lib/admin-settings";

function isGitHubRepoUrl(url: string): boolean {
    return /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(url.trim());
}

function normalizeRepoUrl(url: string): string {
    return url.trim().replace(/\/$/, "");
}

export async function GET(request: NextRequest) {
    try {
        await requireAdmin(request, "platform_admin");
        const repos =
            (await getAdminSettingValue<PipelineRepository[]>(
                ADMIN_SETTING_KEYS.pipelineRepositories
            )) ?? [];
        const sorted = [...repos].sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return a.name.localeCompare(b.name);
        });
        return NextResponse.json({ repositories: sorted });
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
        const url = normalizeRepoUrl(String(body.url || ""));
        const name = String(body.name || "").trim();
        const owner = String(body.owner || "").trim();
        const isPrivate = Boolean(body.isPrivate);

        if (!url || !isGitHubRepoUrl(url)) {
            return NextResponse.json(
                { error: "A valid GitHub repository URL is required" },
                { status: 400 }
            );
        }

        const repositories =
            (await getAdminSettingValue<PipelineRepository[]>(
                ADMIN_SETTING_KEYS.pipelineRepositories
            )) ?? [];
        if (repositories.some((repo) => normalizeRepoUrl(repo.url) === url)) {
            return NextResponse.json(
                { error: "Repository is already configured" },
                { status: 409 }
            );
        }

        const inferred = url.replace("https://github.com/", "").split("/");
        const nextRepo: PipelineRepository = {
            id: crypto.randomUUID(),
            url,
            name: name || inferred[1] || url,
            owner: owner || inferred[0] || "",
            isDefault: repositories.length === 0,
            isPrivate
        };
        const updated = [...repositories, nextRepo];

        await upsertAdminSetting(
            ADMIN_SETTING_KEYS.pipelineRepositories,
            updated,
            admin.adminUserId
        );

        return NextResponse.json({ repository: nextRepo, repositories: updated }, { status: 201 });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
