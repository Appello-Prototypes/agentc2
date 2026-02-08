import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@repo/database": path.resolve(__dirname, "packages/database/src/index.ts"),
            "@repo/auth": path.resolve(__dirname, "packages/auth/src/index.ts"),
            "@repo/mastra": path.resolve(__dirname, "packages/mastra/src/index.ts"),
            "@": path.resolve(__dirname, "apps/agent/src"),
            "@mastra/mcp": path.resolve(__dirname, "tests/mocks/mastra-mcp.ts"),
            "next/headers": path.resolve(__dirname, "tests/mocks/next-headers.ts")
        }
    },
    test: {
        globals: true,
        environment: "node",
        include: ["tests/**/*.test.ts"],
        exclude: ["**/node_modules/**", "**/dist/**"],
        deps: {
            inline: ["@mastra/mcp"]
        },
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            include: [
                "apps/agent/src/app/api/**/*.ts",
                "apps/agent/src/lib/inngest-functions.ts",
                "packages/mastra/src/agents/resolver.ts"
            ]
        },
        setupFiles: ["./tests/setup.ts"],
        testTimeout: 30000,
        hookTimeout: 30000
    }
});
