import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";
import { createHeadersConfig, sharedEnv, devIndicators } from "@repo/next-config";

// Load environment variables from root .env file
config({ path: resolve(__dirname, "../../.env") });

// Agent app serves at root (primary app)
const nextConfig: NextConfig = {
    output: "standalone",
    env: sharedEnv,
    devIndicators,
    async headers() {
        const headersFn = createHeadersConfig();
        const baseHeaders = headersFn ? await headersFn() : [];

        return [
            ...baseHeaders,
            // Relax framing restrictions for /embed/* so pages can be iframed
            // by the landing page (same origin) and third-party sites.
            {
                source: "/embed/:path*",
                headers: [
                    // Clear X-Frame-Options to allow framing
                    { key: "X-Frame-Options", value: "" },
                    // Override CSP to permit framing from any origin
                    {
                        key: "Content-Security-Policy",
                        value: "frame-ancestors *"
                    }
                ]
            },
            // Workspace-served HTML files need a relaxed CSP so agent-generated
            // dashboards can load external CDN scripts (Chart.js, etc.)
            {
                source: "/api/workspace/:path*",
                headers: [
                    {
                        key: "Content-Security-Policy",
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com",
                            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://fonts.googleapis.com",
                            "font-src 'self' data: https://fonts.gstatic.com",
                            "img-src 'self' data: https:",
                            "connect-src 'self' https:",
                            "media-src 'self' data: blob:",
                            "frame-ancestors 'self'"
                        ].join("; ")
                    }
                ]
            }
        ];
    },
    turbopack: {},
    // Skip TypeScript checking in next build -- verified by CI/local type-check
    typescript: {
        ignoreBuildErrors: true
    },
    // Externalize heavy server-only packages so webpack skips them (loaded via require() at runtime).
    // This dramatically reduces build time by preventing webpack from parsing large dependency trees.
    serverExternalPackages: [
        // WhatsApp + image processing
        "@whiskeysockets/baileys",
        "jimp",
        "sharp",
        "pdf-parse",
        "pdfjs-dist",
        // BIM (web-ifc is ~2MB+ native parser)
        "web-ifc",
        // Google (very large API client surface)
        "googleapis",
        "google-auth-library",
        // MCP protocol
        "@modelcontextprotocol/sdk",
        // Channel SDKs
        "grammy",
        "twilio",
        // Background jobs
        "inngest",
        // Mastra framework packages (server-only, no need to bundle)
        "@mastra/core",
        "@mastra/mcp",
        "@mastra/rag",
        "@mastra/memory",
        "@mastra/pg",
        "@mastra/voice-elevenlabs",
        "@mastra/voice-openai",
        "@mastra/evals",
        "@mastra/observability",
        // Database
        "@prisma/client",
        // Crypto
        "bcryptjs",
        // AWS (pulled in by BIM storage)
        "@aws-sdk/client-s3"
    ],
    webpack: (config, { isServer }) => {
        if (isServer) {
            config.resolve.alias = {
                ...config.resolve.alias,
                "@img/sharp-libvips-dev/include": false,
                "@img/sharp-libvips-dev/cplusplus": false,
                "@img/sharp-wasm32/versions": false
            };
        }

        return config;
    }
};

export default nextConfig;
