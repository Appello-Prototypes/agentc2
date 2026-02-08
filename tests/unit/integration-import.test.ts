import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock
}));

vi.mock("../../packages/mastra/src/mcp/client", () => ({
    getIntegrationProviders: vi.fn(),
    getMcpTools: vi.fn()
}));

describe("integration-import tools (unit)", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    it("parses MCP JSON and matches provider hints", async () => {
        const { integrationImportMcpJsonTool } =
            await import("../../packages/mastra/src/tools/integration-import-tools");
        const { getIntegrationProviders } = await import("../../packages/mastra/src/mcp/client");

        vi.mocked(getIntegrationProviders).mockResolvedValue(undefined);
        prismaMock.membership.findFirst.mockResolvedValue({
            organizationId: "org-1"
        } as never);
        prismaMock.integrationProvider.findMany.mockResolvedValue([
            {
                id: "provider-1",
                key: "hubspot",
                name: "HubSpot",
                providerType: "mcp",
                authType: "apiKey",
                configJson: {
                    requiredFields: ["HUBSPOT_ACCESS_TOKEN"],
                    importHints: {
                        matchArgs: ["@hubspot/mcp-server"],
                        envAliases: {
                            PRIVATE_APP_ACCESS_TOKEN: "HUBSPOT_ACCESS_TOKEN"
                        }
                    }
                }
            }
        ] as never);
        prismaMock.integrationConnection.findFirst.mockResolvedValue(null as never);

        const rawText = JSON.stringify({
            mcpServers: {
                HubSpot: {
                    command: "npx",
                    args: ["-y", "@hubspot/mcp-server"],
                    env: {
                        PRIVATE_APP_ACCESS_TOKEN: "pat-na1-123"
                    }
                }
            }
        });

        const result = await integrationImportMcpJsonTool.execute({
            rawText,
            userId: "user-1",
            dryRun: true
        });

        expect(result.success).toBe(true);
        expect(result.items[0]?.providerKey).toBe("hubspot");
        expect(result.items[0]?.missingFields.length).toBe(0);
    });

    it("creates a custom provider plan when no match exists", async () => {
        const { integrationImportMcpJsonTool } =
            await import("../../packages/mastra/src/tools/integration-import-tools");
        const { getIntegrationProviders } = await import("../../packages/mastra/src/mcp/client");

        vi.mocked(getIntegrationProviders).mockResolvedValue(undefined);
        prismaMock.membership.findFirst.mockResolvedValue({
            organizationId: "org-1"
        } as never);
        prismaMock.integrationProvider.findMany.mockResolvedValue([] as never);

        const rawText = JSON.stringify({
            mcpServers: {
                "Custom CRM": {
                    url: "https://mcp.example.com",
                    headers: {
                        Authorization: "Bearer token-123"
                    }
                }
            }
        });

        const result = await integrationImportMcpJsonTool.execute({
            rawText,
            userId: "user-1",
            dryRun: true
        });

        expect(result.success).toBe(true);
        expect(result.items[0]?.providerKey.startsWith("custom-")).toBe(true);
        expect(result.items[0]?.missingFields.length).toBe(0);
    });
});
