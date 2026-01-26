import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@repo/database";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "mysql"
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
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    trustedOrigins: [
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        // Keep localhost URLs for dev:local fallback
        "http://localhost:3000",
        "http://localhost:3001",
        // Add HTTPS localhost if needed for testing
        "https://catalyst.local"
    ],
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
