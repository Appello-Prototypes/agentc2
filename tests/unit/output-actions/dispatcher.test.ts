import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    executeOutputAction,
    type OutputActionRecord,
    type RunOutput
} from "../../../apps/agent/src/lib/output-actions";

// Mock inngest
vi.mock("../../../apps/agent/src/lib/inngest", () => ({
    inngest: {
        send: vi.fn().mockResolvedValue({ ids: ["mock-id"] })
    }
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const baseRun: RunOutput = {
    outputText: "This is a test output with enough content to be meaningful.",
    inputText: "Test input",
    source: "api"
};

const baseContext = {
    agentId: "agent-123",
    runId: "run-456"
};

describe("Output Action Dispatcher", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockReset();
    });

    // Test 1: WEBHOOK POSTs to URL with correct payload
    it("WEBHOOK POSTs to URL with correct payload shape", async () => {
        mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: "OK" });

        const action: OutputActionRecord = {
            id: "action-1",
            type: "WEBHOOK",
            configJson: { url: "https://example.com/hook" },
            isActive: true
        };

        const result = await executeOutputAction(action, baseRun, baseContext);

        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        const [url, options] = mockFetch.mock.calls[0];
        expect(url).toBe("https://example.com/hook");
        expect(options.method).toBe("POST");

        const body = JSON.parse(options.body);
        expect(body.runId).toBe("run-456");
        expect(body.agentId).toBe("agent-123");
        expect(body.output).toBe(baseRun.outputText);
        expect(body.timestamp).toBeDefined();
    });

    // Test 2: WEBHOOK includes HMAC signature when secret configured
    it("WEBHOOK includes HMAC signature header when secret configured", async () => {
        mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: "OK" });

        const action: OutputActionRecord = {
            id: "action-2",
            type: "WEBHOOK",
            configJson: { url: "https://example.com/hook", secret: "my-secret" },
            isActive: true
        };

        await executeOutputAction(action, baseRun, baseContext);

        const [, options] = mockFetch.mock.calls[0];
        expect(options.headers["X-Signature-256"]).toBeDefined();
        expect(options.headers["X-Signature-256"]).toMatch(/^sha256=/);
    });

    // Test 3: WEBHOOK omits signature when no secret
    it("WEBHOOK omits signature header when no secret", async () => {
        mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: "OK" });

        const action: OutputActionRecord = {
            id: "action-3",
            type: "WEBHOOK",
            configJson: { url: "https://example.com/hook" },
            isActive: true
        };

        await executeOutputAction(action, baseRun, baseContext);

        const [, options] = mockFetch.mock.calls[0];
        expect(options.headers["X-Signature-256"]).toBeUndefined();
    });

    // Test 4: CHAIN_AGENT emits inngest event
    it("CHAIN_AGENT emits inngest event with correct agentSlug and output as input", async () => {
        const { inngest } = await import("../../../apps/agent/src/lib/inngest");

        const action: OutputActionRecord = {
            id: "action-4",
            type: "CHAIN_AGENT",
            configJson: { agentSlug: "ceo" },
            isActive: true
        };

        const result = await executeOutputAction(action, baseRun, baseContext);

        expect(result.success).toBe(true);
        expect(inngest.send).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "agent/invoke.async",
                data: expect.objectContaining({
                    agentSlug: "ceo",
                    input: baseRun.outputText
                })
            })
        );
    });

    // Test 5: CHAIN_AGENT applies inputTemplate
    it("CHAIN_AGENT applies inputTemplate with {output} substitution", async () => {
        const { inngest } = await import("../../../apps/agent/src/lib/inngest");

        const action: OutputActionRecord = {
            id: "action-5",
            type: "CHAIN_AGENT",
            configJson: {
                agentSlug: "ceo",
                inputTemplate: "Review this: {output}"
            },
            isActive: true
        };

        await executeOutputAction(action, baseRun, baseContext);

        expect(inngest.send).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    input: `Review this: ${baseRun.outputText}`
                })
            })
        );
    });

    // Test 6: Dispatcher skips when outputText is null
    it("Dispatcher returns failure when outputText is null", async () => {
        const action: OutputActionRecord = {
            id: "action-6",
            type: "WEBHOOK",
            configJson: { url: "https://example.com/hook" },
            isActive: true
        };

        const result = await executeOutputAction(
            action,
            { outputText: null, inputText: "test", source: "api" },
            baseContext
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("No output text");
        expect(mockFetch).not.toHaveBeenCalled();
    });

    // Test 7: Dispatcher returns failure for individual action errors
    it("Dispatcher returns error for failed webhook", async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            statusText: "Internal Server Error"
        });

        const action: OutputActionRecord = {
            id: "action-7",
            type: "WEBHOOK",
            configJson: { url: "https://example.com/hook" },
            isActive: true
        };

        const result = await executeOutputAction(action, baseRun, baseContext);

        expect(result.success).toBe(false);
        expect(result.error).toContain("500");
    });

    // Test 8: Unknown action type returns error
    it("Unknown action type returns error", async () => {
        const action: OutputActionRecord = {
            id: "action-8",
            type: "FUTURE_TYPE",
            configJson: {},
            isActive: true
        };

        const result = await executeOutputAction(action, baseRun, baseContext);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Unknown action type");
    });
});
