import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";
import { createHeadersConfig, sharedEnv, devIndicators } from "@repo/next-config";

// Load environment variables from root .env file
config({ path: resolve(__dirname, "../../.env") });

// Use basePath only when running behind Caddy proxy (local dev with catalyst.localhost)
// For standalone Vercel deployment, no basePath is needed
const useBasePath = process.env.NEXT_PUBLIC_APP_URL?.includes("catalyst.localhost");

const nextConfig: NextConfig = {
    env: sharedEnv,
    devIndicators,
    headers: createHeadersConfig(),
    // BasePath is required so Next.js prefixes all asset URLs with /agent
    // This ensures assets load from https://catalyst.localhost/agent/_next/... instead of https://catalyst.localhost/_next/...
    ...(useBasePath && { basePath: "/agent" })
};

export default nextConfig;
