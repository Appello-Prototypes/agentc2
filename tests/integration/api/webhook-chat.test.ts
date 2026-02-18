import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockRequest, parseResponse } from "../../utils/api-helpers";

const getSessionMock = vi.fn();
const getUserOrganizationIdMock = vi.fn();
const agentResolverMock = { resolve: vi.fn() };
const startRunMock = vi.fn();

vi.mock("@repo/auth", () => ({
    auth: {
        api: {
            getSession: getSessionMock
        }
    }
}));

vi.mock("@/lib/organization", () => ({
    getUserOrganizationId: getUserOrganizationIdMock
}));

vi.mock("@repo/mastra/agents", () => ({
    agentResolver: agentResolverMock
}));

vi.mock("@/lib/run-recorder", () => ({
    startRun: startRunMock
}));

vi.mock("@/lib/cost-calculator", () => ({
    calculateCost: vi.fn().mockReturnValue(0)
}));

describe("Webhook chat API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
        getUserOrganizationIdMock.mockResolvedValue("org-1");
        startRunMock.mockResolvedValue({
            runId: "run-1",
            addToolCall: vi.fn(),
            complete: vi.fn(),
            fail: vi.fn()
        });
        agentResolverMock.resolve.mockResolvedValue({
            agent: {
                stream: vi.fn().mockResolvedValue({
                    textStream: (async function* () {
                        yield "ok";
                    })()
                })
            },
            record: {
                id: "agent-1",
                maxSteps: 5,
                modelName: "gpt-4o-mini",
                modelProvider: "openai"
            },
            source: "db"
        });
    });

    it("returns 401 when unauthorized", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/webhooks/chat/route");
        getSessionMock.mockResolvedValue(null);
        const response = await POST(
            createMockRequest("http://localhost/api/webhooks/chat", {
                method: "POST",
                body: { threadId: "t1", messages: [] }
            })
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(401);
    });

    it("returns 403 when organization is missing", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/webhooks/chat/route");
        getUserOrganizationIdMock.mockResolvedValue(null);
        const response = await POST(
            createMockRequest("http://localhost/api/webhooks/chat", {
                method: "POST",
                body: { threadId: "t1", messages: [] }
            })
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(403);
    });

    it("returns 400 when no user message is provided", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/webhooks/chat/route");
        const response = await POST(
            createMockRequest("http://localhost/api/webhooks/chat", {
                method: "POST",
                body: { threadId: "t1", messages: [] }
            })
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(400);
    });

    it("streams a response for valid requests", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/webhooks/chat/route");
        const response = await POST(
            createMockRequest("http://localhost/api/webhooks/chat", {
                method: "POST",
                body: {
                    threadId: "t1",
                    messages: [{ role: "user", content: "Create a webhook" }]
                }
            })
        );
        expect(response.status).toBe(200);
    });
});
