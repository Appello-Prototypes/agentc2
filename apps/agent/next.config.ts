import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from root .env file
config({ path: resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
    env: {
        DATABASE_URL: process.env.DATABASE_URL,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
    },
    devIndicators: {
        position: "bottom-right"
    },
    // BasePath is required so Next.js prefixes all asset URLs with /agent
    // This ensures assets load from https://catalyst.localhost/agent/_next/... instead of https://catalyst.localhost/_next/...
    basePath: "/agent"
};

export default nextConfig;
