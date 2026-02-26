import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@repo/database";
import { resolveDeployment, buildSessionConfig } from "@/lib/embed-deployment";
import { verifyEmbedIdentity } from "@/lib/embed-identity";

/**
 * POST /api/partner/session
 *
 * Session bridging endpoint for embedded workspaces (Modes 2 & 3).
 * Validates the deployment token and identity token, creates a Better Auth
 * session for the JIT-provisioned user, and sets the session + embed config cookies.
 */
export async function POST(request: NextRequest) {
    let body: { deploymentToken?: string; identityToken?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { deploymentToken, identityToken } = body;

    if (!deploymentToken || !identityToken) {
        return NextResponse.json(
            { error: "Missing deploymentToken or identityToken" },
            { status: 400 }
        );
    }

    // 1. Resolve deployment
    const deployment = await resolveDeployment(deploymentToken);
    if (!deployment) {
        return NextResponse.json({ error: "Invalid or inactive deployment" }, { status: 403 });
    }

    // 2. Verify identity using the partner's signing secret
    const identity = await verifyEmbedIdentity(
        identityToken,
        deployment.organizationId,
        deployment.partnerId
    );
    if (!identity) {
        return NextResponse.json({ error: "Identity verification failed" }, { status: 403 });
    }

    if (!identity.mappedUserId) {
        return NextResponse.json(
            { error: "User provisioning failed — no email in identity token" },
            { status: 422 }
        );
    }

    // 3. Create a Better Auth session directly in the database
    const sessionToken = randomBytes(32).toString("base64url");
    const EMBED_SESSION_TTL = 8 * 60 * 60; // 8 hours (one workday)
    const expiresAt = new Date(Date.now() + EMBED_SESSION_TTL * 1000);

    await prisma.session.create({
        data: {
            token: sessionToken,
            userId: identity.mappedUserId,
            expiresAt,
            ipAddress:
                request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                request.headers.get("x-real-ip") ||
                "embed",
            userAgent: request.headers.get("user-agent") || "embed-workspace"
        }
    });

    // 4. Build the embed session config cookie
    const sessionConfig = buildSessionConfig(deployment);
    const configJson = JSON.stringify(sessionConfig);

    // 5. Set cookies and return success
    const isProduction = process.env.NODE_ENV === "production";
    const response = NextResponse.json({
        success: true,
        redirectTo:
            deployment.mode === "agent" && deployment.agentSlug ? "/workspace" : "/workspace"
    });

    // Better Auth session cookie — name must match what Better Auth reads.
    // In production (HTTPS), Better Auth auto-prefixes with "__Secure-".
    const sessionCookieName = isProduction
        ? "__Secure-better-auth.session_token"
        : "better-auth.session_token";
    response.cookies.set(sessionCookieName, sessionToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "none",
        path: "/",
        maxAge: EMBED_SESSION_TTL
    });

    // Embed config cookie (readable by client JS for shell switching)
    response.cookies.set("agentc2-embed", configJson, {
        httpOnly: false,
        secure: isProduction,
        sameSite: "none",
        path: "/",
        maxAge: EMBED_SESSION_TTL
    });

    return response;
}
