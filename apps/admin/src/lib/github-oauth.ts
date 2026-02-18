import crypto from "crypto";

const GITHUB_AUTH_ENDPOINT = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const GITHUB_API_BASE = "https://api.github.com";

type GitHubOAuthConfig = {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
};

export type GitHubUser = {
    login: string;
    avatar_url: string | null;
};

export type GitHubRepository = {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    private: boolean;
    owner: {
        login: string;
    };
};

export function isGitHubOAuthConfigured(): boolean {
    return !!(process.env.ADMIN_GITHUB_CLIENT_ID && process.env.ADMIN_GITHUB_CLIENT_SECRET);
}

function getConfig(): GitHubOAuthConfig {
    const clientId = process.env.ADMIN_GITHUB_CLIENT_ID;
    const clientSecret = process.env.ADMIN_GITHUB_CLIENT_SECRET;
    const adminUrl = process.env.ADMIN_URL || "https://agentc2.ai/admin";

    if (!clientId || !clientSecret) {
        throw new Error(
            "ADMIN_GITHUB_CLIENT_ID and ADMIN_GITHUB_CLIENT_SECRET are required for GitHub OAuth"
        );
    }

    return {
        clientId,
        clientSecret,
        redirectUri: `${adminUrl}/api/settings/github/callback`
    };
}

export function generateGitHubState(): string {
    return crypto.randomBytes(32).toString("hex");
}

export function getGitHubAuthUrl(state: string): string {
    const config = getConfig();
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: "repo read:user",
        state
    });
    return `${GITHUB_AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeGitHubCode(code: string): Promise<string> {
    const config = getConfig();
    const response = await fetch(GITHUB_TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: config.redirectUri
        })
    });

    const data = (await response.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
    };

    if (!response.ok || !data.access_token) {
        throw new Error(data.error_description || data.error || "Failed to exchange GitHub code");
    }

    return data.access_token;
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
    });

    if (!response.ok) {
        throw new Error("Failed to fetch GitHub user profile");
    }

    return (await response.json()) as GitHubUser;
}

export async function fetchGitHubRepos(accessToken: string): Promise<GitHubRepository[]> {
    const repos: GitHubRepository[] = [];
    let page = 1;

    while (page <= 5) {
        const response = await fetch(
            `${GITHUB_API_BASE}/user/repos?sort=updated&per_page=100&page=${page}&affiliation=owner,collaborator,organization_member`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28"
                }
            }
        );

        if (!response.ok) {
            throw new Error("Failed to fetch GitHub repositories");
        }

        const pageRepos = (await response.json()) as GitHubRepository[];
        repos.push(...pageRepos);
        if (pageRepos.length < 100) break;
        page += 1;
    }

    return repos;
}
