import { headers } from "next/headers";
import { auth } from "@repo/auth";

/**
 * Check if running in standalone mode (not behind Caddy proxy)
 * When standalone, we allow demo access without authentication.
 * This is determined by checking the request host.
 */
export function isStandaloneDeployment(): boolean {
    // On Vercel or other deployments not using catalyst.localhost, skip auth for demos
    // We can't check headers in this context, so use environment variable
    return process.env.VERCEL === "1" || process.env.STANDALONE_DEMO === "true";
}

/**
 * Demo user returned when running in standalone mode without authentication
 */
export const DEMO_USER = {
    id: "demo-user",
    email: "demo@example.com",
    name: "Demo User"
};

export interface DemoUser {
    id: string;
    email: string;
    name: string;
}

export interface DemoSession {
    user: DemoUser;
}

/**
 * Get session for demo routes.
 * In standalone mode (Vercel), returns a demo user.
 * In authenticated mode, requires a valid session.
 *
 * @returns Session with user, or null if unauthorized
 */
export async function getDemoSession(): Promise<DemoSession | null> {
    // In standalone mode, return demo user without auth check
    if (isStandaloneDeployment()) {
        return { user: DEMO_USER };
    }

    // In authenticated mode, verify session
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return null;
        }
        return {
            user: {
                id: session.user.id,
                email: session.user.email,
                name: session.user.name
            }
        };
    } catch (error) {
        console.error("Auth error in demo route:", error);
        return null;
    }
}
