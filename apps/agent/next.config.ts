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
    // BasePath is required so Next.js prefixes all asset URLs with /agent
    // This ensures assets load from https://catalyst.localhost/agent/_next/... instead of https://catalyst.localhost/_next/...
    basePath: "/agent"
};

export default nextConfig;
