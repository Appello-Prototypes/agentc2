import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";
import { createHeadersConfig, sharedEnv, devIndicators } from "@repo/next-config";

// Load environment variables from root .env file
config({ path: resolve(__dirname, "../../.env") });

// Agent app serves under /agent path in production
const nextConfig: NextConfig = {
    basePath: "/agent",
    env: sharedEnv,
    devIndicators,
    headers: createHeadersConfig(),
    // Externalize server-only packages that have Node.js-specific dependencies
    // @whiskeysockets/baileys has optional deps (jimp, sharp) that shouldn't be bundled
    serverExternalPackages: ["@whiskeysockets/baileys", "jimp", "sharp"]
};

export default nextConfig;
