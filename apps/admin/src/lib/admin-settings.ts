import { prisma } from "@repo/database";

export const ADMIN_SETTING_KEYS = {
    githubConnection: "github_connection",
    pipelineRepositories: "pipeline_repositories",
    dispatchConfig: "dispatch_config"
} as const;

export type DispatchConfig = {
    targetOrganizationId: string;
    targetOrganizationName: string;
    workflowId: string;
    workflowSlug: string;
    workflowName: string;
    repository: string;
};

export type PipelineRepository = {
    id: string;
    url: string;
    name: string;
    owner: string;
    isDefault: boolean;
    isPrivate?: boolean;
};

export type GitHubConnectionSetting = {
    username: string;
    avatarUrl: string | null;
    connectedAt: string;
    accessToken: Record<string, unknown>;
};

export async function getAdminSettingValue<T>(key: string): Promise<T | null> {
    const setting = await prisma.adminSetting.findUnique({
        where: { key },
        select: { value: true }
    });
    if (!setting?.value) return null;
    return setting.value as T;
}

export async function upsertAdminSetting(
    key: string,
    value: unknown,
    updatedBy?: string
): Promise<void> {
    await prisma.adminSetting.upsert({
        where: { key },
        update: {
            value: value as object,
            updatedBy: updatedBy ?? null
        },
        create: {
            key,
            value: value as object,
            updatedBy: updatedBy ?? null
        }
    });
}

export async function deleteAdminSetting(key: string): Promise<void> {
    await prisma.adminSetting.delete({ where: { key } }).catch(() => {});
}
