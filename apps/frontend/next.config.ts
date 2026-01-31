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
        const baseHeaders = await createHeadersConfig()();
        
        // Add CORS headers for auth API in development to allow agent app access
        if (isDevelopment) {
            return [
                ...baseHeaders,
                {
                    source: "/api/auth/:path*",
                    headers: [
                        { key: "Access-Control-Allow-Origin", value: "http://localhost:3001" },
                        { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
                        { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, Cookie" },
                        { key: "Access-Control-Allow-Credentials", value: "true" },
                    ],
                },
            ];
        }
        
        return baseHeaders;
    },
    async rewrites() {
        // These rewrites are used when accessing frontend directly (bun run dev:local)
        // When using Caddy (bun run dev), Caddy handles the routing instead
        return [
            {
                source: "/agent",
                destination: "http://localhost:3001/agent"
            },
            {
                source: "/agent/:path*",
                destination: "http://localhost:3001/agent/:path*"
            }
        ];
    }
};

export default nextConfig;
