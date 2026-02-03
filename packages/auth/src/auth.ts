import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@repo/database";
import { getAppUrl } from "./env";

const appUrl = getAppUrl("http://localhost:3000");
const isProduction = process.env.NODE_ENV === "production";

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
            enabled: true
        }
    }
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
