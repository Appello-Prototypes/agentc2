import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Shared security headers for all Next.js applications
 *
 * These headers provide production-grade security including:
 * - HSTS (Force HTTPS)
 * - Clickjacking protection
 * - MIME type sniffing prevention
 * - XSS protection
 * - Content Security Policy
 * - Permissions Policy
 */
export const securityHeaders = [
    {
        key: "X-DNS-Prefetch-Control",
        value: "on"
    },
    {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload"
    },
    {
        key: "X-Frame-Options",
        value: "SAMEORIGIN"
    },
    {
        key: "X-Content-Type-Options",
        value: "nosniff"
    },
    {
        key: "X-XSS-Protection",
        value: "1; mode=block"
    },
    {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin"
    },
    {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()"
    },
    {
        key: "Content-Security-Policy",
        value: [
            "default-src 'self'",
            isDevelopment ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'" : "script-src 'self'",
            isDevelopment ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "frame-ancestors 'none'"
        ].join("; ")
    }
];

/**
 * Creates the headers configuration for Next.js
 *
 * @returns Next.js headers configuration with security headers applied to all routes
 */
export function createHeadersConfig(): NextConfig["headers"] {
    return async () => [
        {
            source: "/:path*",
            headers: securityHeaders
        }
    ];
}

/**
 * Shared environment variables configuration
 *
 * Exposes common environment variables to both server and client
 */
export const sharedEnv = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
};

/**
 * Shared dev indicators configuration
 */
export const devIndicators = {
    position: "bottom-right" as const
};
