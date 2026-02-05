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
        value: "camera=(self), microphone=(self), geolocation=()"
    },
    {
        key: "Content-Security-Policy",
        value: [
            "default-src 'self'",
            // Allow unsafe-inline for Next.js hydration scripts and inline styles
            // unsafe-eval only needed in development for hot reload
            isDevelopment
                ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
                : "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            // Allow audio/video playback from data URIs and blob URLs (for voice features)
            "media-src 'self' data: blob:",
            // In development, allow connections to other local services (frontend auth, etc.)
            // Also allow ElevenLabs API for voice features and production domain for cross-app auth
            isDevelopment
                ? "connect-src 'self' http://localhost:3000 http://localhost:3001 ws://localhost:3000 ws://localhost:3001 https://api.elevenlabs.io wss://api.elevenlabs.io https://mastra.useappello.app"
                : "connect-src 'self' https://api.elevenlabs.io wss://api.elevenlabs.io https://mastra.useappello.app",
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
