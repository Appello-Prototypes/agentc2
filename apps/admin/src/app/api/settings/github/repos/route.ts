import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@repo/admin-auth";
import {
    ADMIN_SETTING_KEYS,
    getAdminSettingValue,
    type GitHubConnectionSetting,
    type PipelineRepository
} from "@/lib/admin-settings";
import { decryptCredentials } from "@/lib/credential-crypto";
import { fetchGitHubRepos } from "@/lib/github-oauth";

export async function GET(request: NextRequest) {
    try {
        await requireAdmin(request, "platform_admin");
        const connection = await getAdminSettingValue<GitHubConnectionSetting>(
            ADMIN_SETTING_KEYS.githubConnection
        );
        if (!connection?.accessToken) {
            return NextResponse.json({ error: "GitHub is not connected" }, { status: 400 });
        }

        const decrypted = decryptCredentials(connection.accessToken) as { token?: string } | null;
        const token = decrypted?.token;
        if (!token) {
            return NextResponse.json({ error: "Stored GitHub token is invalid" }, { status: 400 });
        }

        const configuredRepos =
            (await getAdminSettingValue<PipelineRepository[]>(
                ADMIN_SETTING_KEYS.pipelineRepositories
            )) ?? [];
        const configuredUrls = new Set(configuredRepos.map((repo) => repo.url));

        const repos = await fetchGitHubRepos(token);
        const normalized = repos.map((repo) => ({
            id: String(repo.id),
            name: repo.name,
            fullName: repo.full_name,
            owner: repo.owner?.login ?? "",
            url: repo.html_url,
            isPrivate: repo.private,
            configured: configuredUrls.has(repo.html_url)
        }));

        return NextResponse.json({ repos: normalized });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Internal server error"
            },
            { status: 500 }
        );
    }
}
