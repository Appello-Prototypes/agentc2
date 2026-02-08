import { beforeAll, afterAll, afterEach, vi } from "vitest";

vi.mock("next/headers", () => ({
    headers: () => new Headers()
}));

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.BETTER_AUTH_SECRET = "test-secret-for-testing-only";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.FEATURE_DB_AGENTS = "true";

// Mock console.error to reduce noise in tests
const originalError = console.error;

beforeAll(() => {
    // Suppress expected console errors during tests
    console.error = (...args: unknown[]) => {
        const message = args[0];
        if (
            typeof message === "string" &&
            (message.includes("Expected test error") || message.includes("[TEST]"))
        ) {
            return;
        }
        originalError.apply(console, args);
    };
});

afterAll(() => {
    console.error = originalError;
});

afterEach(() => {
    vi.clearAllMocks();
});

// Global test timeout
vi.setConfig({ testTimeout: 30000 });
