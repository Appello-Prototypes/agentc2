import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["tests/**/*.test.ts"],
        exclude: ["**/node_modules/**", "**/dist/**"],
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
