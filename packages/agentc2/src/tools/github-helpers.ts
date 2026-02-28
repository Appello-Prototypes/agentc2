/**
 * Shared GitHub REST API helpers.
 *
 * Used by ticket-to-github-issue, merge-deploy-tools, github-issue-comment,
 * and github-create-pr tools.
 */

const GITHUB_API = "https://api.github.com";

const GITHUB_HEADERS = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
} as const;

/**
 * Resolve a GitHub PAT from the org's IntegrationConnection,
 * falling back to the GITHUB_PERSONAL_ACCESS_TOKEN env var.
 */
export async function resolveGitHubToken(organizationId?: string): Promise<string> {
    if (organizationId) {
        try {
            const { prisma } = await import("@repo/database");
            const { decryptJson } = await import("../crypto/encryption");

            const connection = await prisma.integrationConnection.findFirst({
                where: {
                    isActive: true,
                    provider: { key: "github" },
                    organizationId
                },
                include: { provider: true },
                orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
            });

            if (connection?.credentials) {
                const decrypted = decryptJson(connection.credentials);
                const token =
                    (decrypted?.GITHUB_PERSONAL_ACCESS_TOKEN as string) ||
                    (decrypted?.GITHUB_TOKEN as string) ||
                    (decrypted?.token as string);
                if (token) return token;
            }
        } catch (err) {
            console.warn("[github-helpers] Failed to resolve org credentials:", err);
        }
    }

    const envToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (envToken) return envToken;

    throw new Error(
        "No GitHub token found. Configure a GitHub integration or set GITHUB_PERSONAL_ACCESS_TOKEN."
    );
}

/**
 * Parse "owner/repo" from either a bare slug or a full GitHub URL.
 */
export function parseRepoOwnerName(repository: string): { owner: string; repo: string } {
    const cleaned = repository
        .replace(/^https?:\/\/github\.com\//, "")
        .replace(/\.git$/, "")
        .replace(/\/$/, "");

    const parts = cleaned.split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) {
        throw new Error(
            `Invalid repository format: "${repository}". Expected "owner/repo" or full GitHub URL.`
        );
    }
    return { owner: parts[0], repo: parts[1] };
}

/**
 * Thin wrapper around fetch that adds auth + standard GitHub headers.
 */
export async function githubFetch(
    path: string,
    token: string,
    options: RequestInit = {}
): Promise<Response> {
    return fetch(`${GITHUB_API}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...GITHUB_HEADERS,
            ...options.headers
        }
    });
}
