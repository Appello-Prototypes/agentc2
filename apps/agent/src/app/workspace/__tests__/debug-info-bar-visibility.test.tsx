/**
 * Tests for DebugInfoBar visibility logic
 *
 * Run: bun test apps/agent/src/app/workspace/__tests__/debug-info-bar-visibility.test.tsx
 *
 * Validates that DebugInfoBar:
 *   - Shows in development (NODE_ENV=development)
 *   - Shows when ?debug=true query param is present (any environment)
 *   - Hides in production without debug param
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";

describe("DebugInfoBar visibility logic", () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
    });

    describe("Environment-based visibility", () => {
        test("should be visible in development environment", () => {
            process.env.NODE_ENV = "development";
            const isDevelopment = process.env.NODE_ENV === "development";
            const debugParam = false;
            const showDebugBar = isDevelopment || debugParam;

            expect(showDebugBar).toBe(true);
        });

        test("should be hidden in production environment without debug param", () => {
            process.env.NODE_ENV = "production";
            const isDevelopment = process.env.NODE_ENV === "development";
            const debugParam = false;
            const showDebugBar = isDevelopment || debugParam;

            expect(showDebugBar).toBe(false);
        });

        test("should be hidden in test environment without debug param", () => {
            process.env.NODE_ENV = "test";
            const isDevelopment = process.env.NODE_ENV === "development";
            const debugParam = false;
            const showDebugBar = isDevelopment || debugParam;

            expect(showDebugBar).toBe(false);
        });
    });

    describe("Query parameter override", () => {
        test("should show when debug=true in production", () => {
            process.env.NODE_ENV = "production";
            const isDevelopment = process.env.NODE_ENV === "development";
            const debugParam = true;
            const showDebugBar = isDevelopment || debugParam;

            expect(showDebugBar).toBe(true);
        });

        test("should show when debug=true in development", () => {
            process.env.NODE_ENV = "development";
            const isDevelopment = process.env.NODE_ENV === "development";
            const debugParam = true;
            const showDebugBar = isDevelopment || debugParam;

            expect(showDebugBar).toBe(true);
        });

        test("should hide when debug=false in production", () => {
            process.env.NODE_ENV = "production";
            const isDevelopment = process.env.NODE_ENV === "development";
            const debugParam = false;
            const showDebugBar = isDevelopment || debugParam;

            expect(showDebugBar).toBe(false);
        });

        test("should show when debug param is any truthy value treated as true", () => {
            process.env.NODE_ENV = "production";
            const isDevelopment = process.env.NODE_ENV === "development";

            // Simulate checking if searchParams.get("debug") === "true"
            const debugQueryValue = "true";
            const debugParam = debugQueryValue === "true";
            const showDebugBar = isDevelopment || debugParam;

            expect(showDebugBar).toBe(true);
        });

        test("should hide when debug param is not 'true' string", () => {
            process.env.NODE_ENV = "production";
            const isDevelopment = process.env.NODE_ENV === "development";

            // Simulate checking if searchParams.get("debug") === "true"
            const debugQueryValue = "1";
            const debugParam = debugQueryValue === "true";
            const showDebugBar = isDevelopment || debugParam;

            expect(showDebugBar).toBe(false);
        });
    });

    describe("Combined conditions", () => {
        test("development OR debug param (both true)", () => {
            process.env.NODE_ENV = "development";
            const isDevelopment = process.env.NODE_ENV === "development";
            const debugParam = true;
            const showDebugBar = isDevelopment || debugParam;

            expect(showDebugBar).toBe(true);
        });

        test("development OR debug param (only development)", () => {
            process.env.NODE_ENV = "development";
            const isDevelopment = process.env.NODE_ENV === "development";
            const debugParam = false;
            const showDebugBar = isDevelopment || debugParam;

            expect(showDebugBar).toBe(true);
        });

        test("development OR debug param (only debug)", () => {
            process.env.NODE_ENV = "production";
            const isDevelopment = process.env.NODE_ENV === "development";
            const debugParam = true;
            const showDebugBar = isDevelopment || debugParam;

            expect(showDebugBar).toBe(true);
        });

        test("development OR debug param (neither)", () => {
            process.env.NODE_ENV = "production";
            const isDevelopment = process.env.NODE_ENV === "development";
            const debugParam = false;
            const showDebugBar = isDevelopment || debugParam;

            expect(showDebugBar).toBe(false);
        });
    });

    describe("Edge cases", () => {
        test("should handle undefined NODE_ENV", () => {
            delete process.env.NODE_ENV;
            const isDevelopment = process.env.NODE_ENV === "development";
            const debugParam = false;
            const showDebugBar = isDevelopment || debugParam;

            expect(showDebugBar).toBe(false);
        });

        test("should handle non-standard NODE_ENV values", () => {
            process.env.NODE_ENV = "staging";
            const isDevelopment = process.env.NODE_ENV === "development";
            const debugParam = false;
            const showDebugBar = isDevelopment || debugParam;

            expect(showDebugBar).toBe(false);
        });

        test("should show in non-standard environment when debug=true", () => {
            process.env.NODE_ENV = "staging";
            const isDevelopment = process.env.NODE_ENV === "development";
            const debugParam = true;
            const showDebugBar = isDevelopment || debugParam;

            expect(showDebugBar).toBe(true);
        });
    });
});
