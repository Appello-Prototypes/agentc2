import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: [
            {
                find: /^@repo\/mastra\/(.+)$/,
                replacement: path.resolve(__dirname, "packages/mastra/src/$1")
            },
            {
                find: /^@repo\/auth\/(.+)$/,
                replacement: path.resolve(__dirname, "packages/auth/src/$1")
            },
            {
                find: "@repo/database",
                replacement: path.resolve(__dirname, "packages/database/src/index.ts")
            },
            {
                find: "@repo/auth",
                replacement: path.resolve(__dirname, "packages/auth/src/index.ts")
            },
            {
                find: "@repo/mastra",
                replacement: path.resolve(__dirname, "packages/mastra/src/index.ts")
            },
            {
                find: "@",
                replacement: path.resolve(__dirname, "apps/agent/src")
            },
            {
                find: "@mastra/mcp",
                replacement: path.resolve(__dirname, "tests/mocks/mastra-mcp.ts")
            },
            {
                find: "next/headers",
                replacement: path.resolve(__dirname, "tests/mocks/next-headers.ts")
            }
        ]
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
