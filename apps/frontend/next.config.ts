import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";
import { createHeadersConfig, sharedEnv, devIndicators } from "@repo/next-config";

// Load environment variables from root .env file
config({ path: resolve(__dirname, "../../.env") });

const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
    env: sharedEnv,
    devIndicators,
    async headers() {
        const headersFn = createHeadersConfig();
        const baseHeaders = headersFn ? await headersFn() : [];

        // Add CORS headers for auth API in development to allow agent app access
        if (isDevelopment) {
            return [
                ...baseHeaders,
                {
                    source: "/api/auth/:path*",
                    headers: [
                        { key: "Access-Control-Allow-Origin", value: "http://localhost:3001" },
                        {
                            key: "Access-Control-Allow-Methods",
                            value: "GET, POST, PUT, DELETE, OPTIONS"
                        },
                        {
                            key: "Access-Control-Allow-Headers",
                            value: "Content-Type, Authorization, Cookie"
                        },
                        { key: "Access-Control-Allow-Credentials", value: "true" }
                    ]
                }
            ];
        }

        return baseHeaders;
    },
    async rewrites() {
        // Frontend app is deprecated - all traffic now routes to agent app via Caddy
        // These rewrites are kept for backward compatibility when running dev:local
        return [];
    }
};

export default nextConfig;
