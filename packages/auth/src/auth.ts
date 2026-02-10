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
    "https://www.googleapis.com/auth/gmail.send"
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
                            await bootstrapUserOrganization(
                                newSession.user.id,
                                newSession.user.name,
                                newSession.user.email
                            );
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
