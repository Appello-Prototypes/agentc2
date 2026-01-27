import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";
import { createHeadersConfig, sharedEnv, devIndicators } from "@repo/next-config";

// Load environment variables from root .env file
config({ path: resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
    env: sharedEnv,
    devIndicators,
    headers: createHeadersConfig(),
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
