import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from root .env file
config({ path: resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
    env: {
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
    },
    devIndicators: {
        position: "bottom-right"
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
