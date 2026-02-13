import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@repo/database";
import { getAppUrl } from "./env";
import { bootstrapUserOrganization } from "./bootstrap";

const isProduction = process.env.NODE_ENV === "production";
const appUrl = isProduction ? getAppUrl("http://localhost:3000") : "http://localhost:3001";
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleScopes = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file"
];

// Build trusted origins based on environment
const trustedOrigins = [appUrl];
if (!isProduction) {
    // Only include localhost URLs in development
    trustedOrigins.push(
        "http://localhost:3000",
        "http://localhost:3001",
        "https://catalyst.localhost"
    );
}

// ── Post-bootstrap hook registry ──────────────────────────────────────
// Allows consuming apps (e.g., agent app) to register callbacks that run
// after a new user's organization is bootstrapped during social sign-up.
// This pattern avoids circular dependencies between the auth package and
// app-specific code (e.g., Gmail sync which depends on agent-app modules).

type PostBootstrapCallback = (userId: string, organizationId: string) => Promise<void>;
const postBootstrapCallbacks: PostBootstrapCallback[] = [];

/**
 * Register a callback to run after a new user's organization is bootstrapped.
 * Called from the consuming app (e.g., agent app's instrumentation.ts).
 *
 * @param cb - Async callback receiving (userId, organizationId)
 */
export function onPostBootstrap(cb: PostBootstrapCallback): void {
    postBootstrapCallbacks.push(cb);
}

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql"
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false
    },
    socialProviders:
        googleClientId && googleClientSecret
            ? {
                  google: {
                      clientId: googleClientId,
                      clientSecret: googleClientSecret,
                      accessType: "offline",
                      prompt: "consent",
                      scope: googleScopes,
                      disableImplicitSignUp: true
                  }
              }
            : undefined,
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // Update every 24 hours
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5 // 5 minutes
        }
    },
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: appUrl,
    trustedOrigins,
    // Explicitly set advanced cookie options for cross-path sharing
    advanced: {
        cookiePrefix: "better-auth",
        crossSubDomainCookies: {
            enabled: isProduction
        }
    },
    // Auto-bootstrap organization for new social sign-up users
    hooks: {
        after: createAuthMiddleware(async (ctx) => {
            if (ctx.path === "/callback/:id") {
                const newSession = ctx.context.newSession;
                if (newSession) {
                    // Check if the new user already has an org membership
                    const existing = await prisma.membership.findFirst({
                        where: { userId: newSession.user.id }
                    });
                    if (!existing) {
                        try {
                            const result = await bootstrapUserOrganization(
                                newSession.user.id,
                                newSession.user.name,
                                newSession.user.email
                            );

                            // Run post-bootstrap hooks (e.g., Gmail sync)
                            if (result.success && result.organization) {
                                for (const cb of postBootstrapCallbacks) {
                                    try {
                                        await cb(newSession.user.id, result.organization.id);
                                    } catch (hookError) {
                                        console.error(
                                            "[Auth Hook] Post-bootstrap callback failed:",
                                            hookError
                                        );
                                    }
                                }
                            }
                        } catch (error) {
                            console.error(
                                "[Auth Hook] Bootstrap failed for social sign-up:",
                                error
                            );
                        }
                    }
                }
            }
        })
    }
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
