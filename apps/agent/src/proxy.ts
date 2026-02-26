import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { getUserMembership } from "@/lib/organization";
import { enforceCsrf } from "@/lib/security/http-security";

/**
 * Check if running in standalone mode (not behind reverse proxy)
 * When standalone, we skip auth for demo pages
 *
 * Standalone mode is determined by:
 * 1. STANDALONE_DEMO=true (explicit override)
 */
function isStandaloneDeployment(): boolean {
    return process.env.STANDALONE_DEMO === "true" && process.env.NODE_ENV !== "production";
}

const FEATURE_PATH_MAP: Record<string, string> = {
    "/workspace": "chat",
    "/agents": "agents",
    "/workflows": "workflows",
    "/networks": "networks",
    "/skills": "skills",
    "/knowledge": "knowledge",
    "/observe": "observe",
    "/schedule": "schedule",
    "/mcp": "integrations",
    "/settings": "settings",
    "/campaigns": "campaigns"
};

function pathToFeature(pathname: string): string | null {
    for (const [path, feature] of Object.entries(FEATURE_PATH_MAP)) {
        if (pathname === path || pathname.startsWith(path + "/")) {
            return feature;
        }
    }
    return null;
}

interface EmbedCookieConfig {
    features?: string[];
    mode?: string;
}

function parseEmbedCookie(request: NextRequest): EmbedCookieConfig | null {
    const raw = request.cookies.get("agentc2-embed")?.value;
    if (!raw) return null;
    try {
        return JSON.parse(decodeURIComponent(raw));
    } catch {
        return null;
    }
}

/**
 * Proxy for Better Auth with Next.js 16
 * Validates sessions and protects routes
 * Note: Next.js 16 renamed middleware to proxy
 */
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function proxy(request: NextRequest) {
    // Inject X-Request-ID for distributed tracing
    const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-request-id", requestId);

    // API routes: only apply CSRF enforcement, skip page-level auth
    if (request.nextUrl.pathname.startsWith("/api/")) {
        if (STATE_CHANGING_METHODS.has(request.method)) {
            const csrf = enforceCsrf(request);
            if (csrf.response) return csrf.response;
        }
        const response = NextResponse.next({
            request: { headers: requestHeaders }
        });
        response.headers.set("x-request-id", requestId);
        return response;
    }

    // Root page: redirect authenticated users to /workspace, otherwise show public landing
    if (request.nextUrl.pathname === "/") {
        try {
            const session = await auth.api.getSession({
                headers: await headers()
            });
            if (session) {
                const url = request.nextUrl.clone();
                url.pathname = "/workspace";
                return NextResponse.redirect(url);
            }
        } catch {
            // Auth check failed — fall through to public landing
        }
        return NextResponse.next();
    }

    // In standalone mode, allow public access only to demo and auth pages.
    if (isStandaloneDeployment()) {
        const publicStandalonePrefixes = ["/demos", "/embed", "/embed-v2", "/login", "/signup"];
        const isPublicStandalone = publicStandalonePrefixes.some((prefix) =>
            request.nextUrl.pathname.startsWith(prefix)
        );
        if (isPublicStandalone) {
            return NextResponse.next();
        }
    }

    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            // Embed sessions: don't redirect to login — show session-expired page
            const embedConfig = parseEmbedCookie(request);
            if (embedConfig) {
                const url = request.nextUrl.clone();
                url.pathname = "/embed/session-expired";
                return NextResponse.redirect(url);
            }

            // Normal users: redirect to login page
            const url = request.nextUrl.clone();
            url.pathname = "/login";
            url.searchParams.set("callbackUrl", request.nextUrl.pathname);
            return NextResponse.redirect(url);
        }

        const embedConfig = parseEmbedCookie(request);
        const pathname = request.nextUrl.pathname;

        // Embed sessions: enforce feature gating, skip onboarding check
        if (embedConfig) {
            const feature = pathToFeature(pathname);
            if (feature && embedConfig.features && !embedConfig.features.includes(feature)) {
                const url = request.nextUrl.clone();
                url.pathname = "/workspace";
                return NextResponse.redirect(url);
            }
            return NextResponse.next();
        }

        // Normal users: check onboarding completion
        const membership = await getUserMembership(session.user.id);
        const onboardingComplete = Boolean(membership?.onboardingCompletedAt);

        if (!onboardingComplete && !pathname.startsWith("/onboarding")) {
            const url = request.nextUrl.clone();
            url.pathname = "/onboarding";
            return NextResponse.redirect(url);
        }

        return NextResponse.next();
    } catch (error) {
        // Log error and redirect to login on auth failure
        console.error("Authentication error in proxy:", error);
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }
}

// Export as default proxy for Next.js 16
export default proxy;

/**
 * Route matcher configuration
 * Protects all routes except public paths
 */
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - embed (public embed pages, including /embed/workspace bootstrap)
         * - embed-v2 (legacy embed pages)
         * - connect (OAuth integration connection pages)
         * - login (public login page)
         * - signup (public signup page)
         * - terms (public Terms of Service)
         * - privacy (public Privacy Policy)
         * - security (public Security Policy)
         * - authorize (OAuth authorization endpoint for MCP server)
         * - token (OAuth token endpoint for MCP server)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - .*\.* (any file with an extension like .txt, .xml, .json, .png, etc.)
         *
         * API routes ARE matched for CSRF enforcement on state-changing methods.
         * API routes still handle their own auth checks independently.
         */
        "/((?!embed|embed-v2|connect|login|signup|waitlist|terms$|privacy$|security$|marketplace|authorize|token|_next/static|_next/image|favicon.ico|.*\\..*).*)"
    ]
};
