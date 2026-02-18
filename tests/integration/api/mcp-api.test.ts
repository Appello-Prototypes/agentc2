import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { createMockRequest, parseResponse, assertSuccess } from "../../utils/api-helpers";

const prismaMock = mockDeep<PrismaClient>();
const getSessionMock = vi.fn();
const getUserOrganizationIdMock = vi.fn();
const getDefaultWorkspaceIdForUserMock = vi.fn();

vi.mock("@repo/database", () => ({
    prisma: prismaMock
}));

vi.mock("@repo/auth", () => ({
    auth: {
        api: {
            getSession: getSessionMock
        }
    }
}));

vi.mock("@/lib/organization", () => ({
    getUserOrganizationId: getUserOrganizationIdMock,
    getDefaultWorkspaceIdForUser: getDefaultWorkspaceIdForUserMock
}));

describe("MCP Gateway API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
        getUserOrganizationIdMock.mockResolvedValue("org-1");
        getDefaultWorkspaceIdForUserMock.mockResolvedValue("workspace-1");
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("should list active workflow and network tools", async () => {
        const { GET } = await import("../../../apps/agent/src/app/api/mcp/route");
        prismaMock.agent.findMany.mockResolvedValue([
            {
                id: "agent-1",
                slug: "assistant",
                name: "Assistant",
                description: null,
                modelProvider: "anthropic",
                modelName: "claude-sonnet-4-20250514",
                isActive: true,
                visibility: "PUBLIC",
                maxSteps: 5,
                requiresApproval: false,
                version: 1,
                workspace: null
            }
        ] as never);
        prismaMock.workflow.findMany.mockResolvedValue([
            {
                id: "wf-1",
                slug: "sample-workflow",
                name: "Sample Workflow",
                description: null,
                version: 2,
                isActive: true,
                isPublished: false,
                inputSchemaJson: {
                    type: "object",
                    properties: { foo: { type: "string" } },
                    required: ["foo"]
                },
                outputSchemaJson: {
                    type: "object",
                    properties: { result: { type: "string" } }
                },
                workspace: null
            }
        ] as never);
        prismaMock.network.findMany.mockResolvedValue([
            {
                id: "net-1",
                slug: "sample-network",
                name: "Sample Network",
                description: null,
                version: 1,
                isActive: true,
                isPublished: false,
                maxSteps: 10,
                workspace: null
            }
        ] as never);

        const request = createMockRequest("/api/mcp");
        const response = await GET(request);
        const parsed = await parseResponse<{ success: boolean; tools: Array<{ name: string }> }>(
            response
        );

        assertSuccess(parsed);
        const toolNames = parsed.data.tools.map((tool) => tool.name);
        expect(toolNames).toContain("agent.assistant");
        expect(toolNames).toContain("workflow-sample-workflow");
        expect(toolNames).toContain("network-sample-network");
    });

    it("should invoke workflow tools by slug", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/mcp/route");
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ success: true, status: "success", output: { ok: true } })
        });
        vi.stubGlobal("fetch", fetchMock);

        const request = createMockRequest("/api/mcp", {
            method: "POST",
            body: {
                method: "tools/call",
                tool: "workflow-sample-workflow",
                params: {
                    input: { foo: "bar" }
                }
            }
        });
        const response = await POST(request);
        const parsed = await parseResponse(response);

        expect(fetchMock).toHaveBeenCalled();
        const [workflowUrl] = fetchMock.mock.calls[0];
        expect(workflowUrl.toString()).toContain("/api/workflows/sample-workflow/execute");
        assertSuccess(parsed);
    });

    it("should invoke network tools by slug", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/mcp/route");
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ success: true, runId: "run-1", outputText: "ok" })
        });
        vi.stubGlobal("fetch", fetchMock);

        const request = createMockRequest("/api/mcp", {
            method: "POST",
            body: {
                method: "tools/call",
                tool: "network-sample-network",
                params: {
                    message: "route this"
                }
            }
        });
        const response = await POST(request);
        const parsed = await parseResponse(response);

        expect(fetchMock).toHaveBeenCalled();
        const calledUrls = fetchMock.mock.calls.map((call) => call[0].toString());
        expect(calledUrls.some((url) => url.includes("/api/networks/sample-network/execute"))).toBe(
            true
        );
        assertSuccess(parsed);
    });
});
