import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock
}));

describe("MCP cache invalidation", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        mockReset(prismaMock);
    });

    it("invalidates MCP client cache for an org", async () => {
        (global as { mcpClient?: unknown }).mcpClient = undefined;

        prismaMock.integrationConnection.findMany.mockResolvedValue([] as never);
        prismaMock.toolCredential.findMany.mockResolvedValue([] as never);

        const { getMcpTools, invalidateMcpCacheForOrg } =
            await import("../../packages/mastra/src/mcp/client");
        const { MCPClient } = await import("@mastra/mcp");
        MCPClient.reset();
        const baselineCalls = MCPClient.calls.length;

        await getMcpTools("org-1");
        await getMcpTools("org-1");
        expect(MCPClient.calls).toHaveLength(baselineCalls + 1);

        invalidateMcpCacheForOrg("org-1");
        await getMcpTools("org-1");
        expect(MCPClient.calls).toHaveLength(baselineCalls + 2);
    });

    it("invalidates MCP tools registry cache for an org", async () => {
        const getMcpToolsMock = vi
            .fn()
            .mockResolvedValue({ tools: { toolA: {} }, serverErrors: {} });
        vi.doMock("../../packages/mastra/src/mcp/client", () => ({
            getMcpTools: getMcpToolsMock
        }));

        const { getAllMcpTools, invalidateMcpToolsCacheForOrg } =
            await import("../../packages/mastra/src/tools/registry");

        await getAllMcpTools("org-1");
        await getAllMcpTools("org-1");
        expect(getMcpToolsMock).toHaveBeenCalledTimes(1);

        invalidateMcpToolsCacheForOrg("org-1");
        await getAllMcpTools("org-1");
        expect(getMcpToolsMock).toHaveBeenCalledTimes(2);
    });
});
