import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";
import { createHeadersConfig, sharedEnv, devIndicators } from "@repo/next-config";

// Load environment variables from root .env file
config({ path: resolve(__dirname, "../../.env") });

// Agent app serves at root (primary app)
const nextConfig: NextConfig = {
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
            }
        ];
    },
    turbopack: {},
    // Skip TypeScript checking in next build -- verified by CI/local type-check
    typescript: {
        ignoreBuildErrors: true
    },
    // Externalize server-only packages that have Node.js-specific dependencies
    // @whiskeysockets/baileys has optional deps (jimp, sharp) that shouldn't be bundled
    serverExternalPackages: ["@whiskeysockets/baileys", "jimp", "sharp", "pdf-parse", "pdfjs-dist"],
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
