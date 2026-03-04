/**
 * Tests for DebugInfoBar visibility logic.
 *
 * The DebugInfoBar should only be visible in:
 * 1. Development mode (NODE_ENV !== 'production')
 * 2. Production mode with ?debug=true query parameter
 *
 * Run: bun test apps/agent/src/app/workspace/__tests__/debug-visibility.test.ts
 */

import { describe, test, expect } from "vitest"

/**
 * Helper function that encapsulates the visibility logic for DebugInfoBar.
 * This is extracted for testing purposes and matches the logic in page.tsx.
 */
function shouldShowDebugInfoBar(nodeEnv: string | undefined, debugParam: string | null): boolean {
    return nodeEnv !== "production" || debugParam === "true"
}

describe("DebugInfoBar visibility logic", () => {
    describe("Development environment", () => {
        test("should show in development without debug param", () => {
            expect(shouldShowDebugInfoBar("development", null)).toBe(true)
        })

        test("should show in development with debug=true", () => {
            expect(shouldShowDebugInfoBar("development", "true")).toBe(true)
        })

        test("should show in development with debug=false", () => {
            expect(shouldShowDebugInfoBar("development", "false")).toBe(true)
        })

        test("should show when NODE_ENV is undefined", () => {
            expect(shouldShowDebugInfoBar(undefined, null)).toBe(true)
        })
    })

    describe("Production environment", () => {
        test("should hide in production without debug param", () => {
            expect(shouldShowDebugInfoBar("production", null)).toBe(false)
        })

        test("should hide in production with debug=false", () => {
            expect(shouldShowDebugInfoBar("production", "false")).toBe(false)
        })

        test("should hide in production with debug=other", () => {
            expect(shouldShowDebugInfoBar("production", "other")).toBe(false)
        })

        test("should show in production with debug=true", () => {
            expect(shouldShowDebugInfoBar("production", "true")).toBe(true)
        })

        test("should hide in production with empty debug param", () => {
            expect(shouldShowDebugInfoBar("production", "")).toBe(false)
        })
    })

    describe("Edge cases", () => {
        test("should show in test environment", () => {
            expect(shouldShowDebugInfoBar("test", null)).toBe(true)
        })

        test("should handle case sensitivity correctly", () => {
            // Query params are case-sensitive - only "true" (lowercase) should work
            expect(shouldShowDebugInfoBar("production", "True")).toBe(false)
            expect(shouldShowDebugInfoBar("production", "TRUE")).toBe(false)
            expect(shouldShowDebugInfoBar("production", "true")).toBe(true)
        })
    })
})
