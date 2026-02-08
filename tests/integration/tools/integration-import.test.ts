import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock
}));

vi.mock("../../../packages/mastra/src/mcp/client", () => ({
    getIntegrationProviders: vi.fn(),
    getMcpTools: vi.fn()
}));

describe("integration-import tools (integration)", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    it("creates and tests MCP connections", async () => {
        const { integrationImportMcpJsonTool } =
            await import("../../../packages/mastra/src/tools/integration-import-tools");
        const { getIntegrationProviders, getMcpTools } =
            await import("../../../packages/mastra/src/mcp/client");

        vi.mocked(getIntegrationProviders).mockResolvedValue(undefined);
        vi.mocked(getMcpTools).mockResolvedValue({
            slack_list_channels: {}
        } as never);

        prismaMock.membership.findFirst.mockResolvedValue({
            organizationId: "org-1"
        } as never);
        prismaMock.integrationProvider.findMany.mockResolvedValue([
            {
                id: "provider-1",
                key: "slack",
                name: "Slack",
                providerType: "mcp",
                authType: "apiKey",
                configJson: {
                    requiredFields: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"],
                    importHints: {
                        matchArgs: ["@modelcontextprotocol/server-slack"],
                        envAliases: {
                            SLACK_BOT_TOKEN: "SLACK_BOT_TOKEN",
                            SLACK_TEAM_ID: "SLACK_TEAM_ID"
                        }
                    }
                }
            }
        ] as never);
        prismaMock.integrationConnection.findFirst.mockResolvedValue(null as never);
        prismaMock.integrationConnection.create.mockResolvedValue({
            id: "conn-1",
            providerId: "provider-1",
            organizationId: "org-1",
            isDefault: true,
            provider: {
                key: "slack",
                providerType: "mcp",
                authType: "apiKey",
                configJson: {
                    requiredFields: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"]
                }
            }
        } as never);
        prismaMock.integrationConnection.findUnique.mockResolvedValue({
            id: "conn-1",
            providerId: "provider-1",
            organizationId: "org-1",
            isDefault: true,
            credentials: {
                SLACK_BOT_TOKEN: "xoxb-123",
                SLACK_TEAM_ID: "T123"
            },
            provider: {
                key: "slack",
                providerType: "mcp",
                authType: "apiKey",
                configJson: {
                    requiredFields: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"]
                }
            }
        } as never);
        prismaMock.integrationConnection.update.mockResolvedValue({} as never);

        const rawText = JSON.stringify({
            mcpServers: {
                Slack: {
                    command: "npx",
                    args: ["-y", "@modelcontextprotocol/server-slack"],
                    env: {
                        SLACK_BOT_TOKEN: "xoxb-123",
                        SLACK_TEAM_ID: "T123"
                    }
                }
            }
        });

        const result = await integrationImportMcpJsonTool.execute({
            rawText,
            userId: "user-1",
            dryRun: false
        });

        expect(result.success).toBe(true);
        expect(result.summary.connectionsCreated).toBe(1);
        expect(result.items[0]?.testResult?.success).toBe(true);
    });
});
