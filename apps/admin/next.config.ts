import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from root .env file
config({ path: resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
    basePath: "/admin",
    devIndicators: false,
    turbopack: {},
    typescript: {
        ignoreBuildErrors: true
    }
};

export default nextConfig;
