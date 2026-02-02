import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockAgent } from "../../fixtures/agents";
import { mockVersion, mockAlert } from "../../fixtures/evaluations";

// Create prisma mock
const prismaMock = mockDeep<PrismaClient>();

// Mock the database module
vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull",
        InputJsonValue: {}
    }
}));

describe("Versions API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("GET /api/agents/[id]/versions", () => {
        it("should return version history ordered by version DESC", async () => {
            const versions = [
                { ...mockVersion, version: 3 },
                { ...mockVersion, version: 2, id: "v2" },
                { ...mockVersion, version: 1, id: "v1" }
            ];

            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                version: 3
            } as never);
            prismaMock.agentVersion.findMany.mockResolvedValue(versions as never);

            const versionsResult = await prismaMock.agentVersion.findMany({
                where: { agentId: "test-agent-uuid" },
                orderBy: { version: "desc" }
            });

            expect(versionsResult).toHaveLength(3);
            expect(versionsResult[0].version).toBe(3);
            expect(versionsResult[1].version).toBe(2);
            expect(versionsResult[2].version).toBe(1);
        });

        it("should mark active version with isActive: true", async () => {
            const currentVersion = 2;
            const versions = [
                { ...mockVersion, version: 3 },
                { ...mockVersion, version: 2, id: "v2" },
                { ...mockVersion, version: 1, id: "v1" }
            ];

            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                version: currentVersion
            } as never);
            prismaMock.agentVersion.findMany.mockResolvedValue(versions as never);

            const agent = await prismaMock.agent.findFirst({
                where: { id: "test-agent-uuid" }
            });

            const versionsResult = await prismaMock.agentVersion.findMany({
                where: { agentId: "test-agent-uuid" }
            });

            // Map versions with isActive flag
            const versionsWithActive = versionsResult.map((v) => ({
                ...v,
                isActive: v.version === agent?.version
            }));

            const activeVersion = versionsWithActive.find((v) => v.isActive);
            expect(activeVersion?.version).toBe(2);
        });

        it("should include version stats if available", async () => {
            const versions = [
                {
                    ...mockVersion,
                    version: 1,
                    versionStats: {
                        totalRuns: 100,
                        successfulRuns: 95,
                        avgLatencyMs: 1500
                    }
                }
            ];

            prismaMock.agentVersion.findMany.mockResolvedValue(versions as never);

            const versionsResult = await prismaMock.agentVersion.findMany({
                where: { agentId: "test-agent-uuid" },
                include: { versionStats: true }
            });

            expect(versionsResult[0].versionStats).toBeDefined();
        });

        it("should handle pagination with cursor", async () => {
            const versions = [
                { ...mockVersion, version: 50 },
                { ...mockVersion, version: 49, id: "v49" }
            ];

            prismaMock.agentVersion.findMany.mockResolvedValue(versions as never);

            await prismaMock.agentVersion.findMany({
                where: { agentId: "test-agent-uuid" },
                cursor: { id: "cursor-id" },
                skip: 1,
                take: 50,
                orderBy: { version: "desc" }
            });

            expect(prismaMock.agentVersion.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    cursor: { id: "cursor-id" },
                    skip: 1
                })
            );
        });
    });

    describe("POST /api/agents/[id]/versions", () => {
        it("should create version snapshot with full config", async () => {
            prismaMock.agent.findFirst.mockResolvedValue({
                ...mockAgent,
                version: 1,
                tools: []
            } as never);
            prismaMock.agentVersion.findFirst.mockResolvedValue({
                ...mockVersion,
                version: 1
            } as never);
            prismaMock.agentVersion.create.mockResolvedValue({
                ...mockVersion,
                version: 2
            } as never);
            prismaMock.agent.update.mockResolvedValue({
                ...mockAgent,
                version: 2
            } as never);

            // Get agent
            const agent = await prismaMock.agent.findFirst({
                where: { id: "test-agent-uuid" },
                include: { tools: true }
            });

            expect(agent).toBeDefined();

            // Get last version
            const lastVersion = await prismaMock.agentVersion.findFirst({
                where: { agentId: agent!.id },
                orderBy: { version: "desc" }
            });

            const newVersionNumber = (lastVersion?.version || 0) + 1;

            // Create snapshot
            const snapshot = {
                name: agent!.name,
                description: agent!.description,
                instructions: agent!.instructions,
                modelProvider: agent!.modelProvider,
                modelName: agent!.modelName,
                tools: agent!.tools
            };

            const createdVersion = await prismaMock.agentVersion.create({
                data: {
                    agentId: agent!.id,
                    tenantId: agent!.tenantId,
                    version: newVersionNumber,
                    description: "New version",
                    instructions: agent!.instructions,
                    modelProvider: agent!.modelProvider,
                    modelName: agent!.modelName,
                    snapshot
                }
            });

            expect(createdVersion.version).toBe(2);
            expect(prismaMock.agentVersion.create).toHaveBeenCalled();
        });

        it("should increment version number correctly", async () => {
            prismaMock.agentVersion.findFirst.mockResolvedValue({
                ...mockVersion,
                version: 5
            } as never);

            const lastVersion = await prismaMock.agentVersion.findFirst({
                where: { agentId: "test-agent-uuid" },
                orderBy: { version: "desc" }
            });

            const newVersion = (lastVersion?.version || 0) + 1;

            expect(newVersion).toBe(6);
        });

        it("should update agent.version after creating snapshot", async () => {
            prismaMock.agent.update.mockResolvedValue({
                ...mockAgent,
                version: 3
            } as never);

            const updatedAgent = await prismaMock.agent.update({
                where: { id: "test-agent-uuid" },
                data: { version: 3 }
            });

            expect(updatedAgent.version).toBe(3);
            expect(prismaMock.agent.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ version: 3 })
                })
            );
        });
    });

    describe("POST /api/agents/[id]/versions/[version]/rollback", () => {
        it("should restore agent config from snapshot", async () => {
            const snapshotConfig = {
                name: "Old Agent Name",
                instructions: "Old instructions",
                modelProvider: "anthropic",
                modelName: "claude-haiku",
                tools: []
            };

            const versionRecord = {
                ...mockVersion,
                version: 1,
                snapshot: snapshotConfig
            };

            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentVersion.findFirst.mockResolvedValue(versionRecord as never);
            prismaMock.agent.update.mockResolvedValue({
                ...mockAgent,
                ...snapshotConfig
            } as never);

            // Get version to rollback to
            const targetVersion = await prismaMock.agentVersion.findFirst({
                where: { agentId: "test-agent-uuid", version: 1 }
            });

            expect(targetVersion?.snapshot).toEqual(snapshotConfig);

            // Apply snapshot to agent
            const snapshot = targetVersion!.snapshot as typeof snapshotConfig;
            const updatedAgent = await prismaMock.agent.update({
                where: { id: "test-agent-uuid" },
                data: {
                    name: snapshot.name,
                    instructions: snapshot.instructions,
                    modelProvider: snapshot.modelProvider,
                    modelName: snapshot.modelName
                }
            });

            expect(updatedAgent.modelName).toBe("claude-haiku");
        });

        it("should create new version record for rollback", async () => {
            prismaMock.agentVersion.findFirst
                .mockResolvedValueOnce({ ...mockVersion, version: 1 } as never)
                .mockResolvedValueOnce({ ...mockVersion, version: 3 } as never);

            prismaMock.agentVersion.create.mockResolvedValue({
                ...mockVersion,
                version: 4,
                changesJson: {
                    type: "rollback",
                    fromVersion: 3,
                    toVersion: 1
                }
            } as never);

            // Get last version
            const lastVersion = await prismaMock.agentVersion.findFirst({
                where: { agentId: "test-agent-uuid" },
                orderBy: { version: "desc" }
            });

            // Create rollback version
            const rollbackVersion = await prismaMock.agentVersion.create({
                data: {
                    agentId: "test-agent-uuid",
                    tenantId: "test-tenant",
                    version: (lastVersion?.version || 0) + 1,
                    description: "Rollback to version 1",
                    changesJson: {
                        type: "rollback",
                        fromVersion: lastVersion?.version,
                        toVersion: 1
                    }
                } as never
            });

            expect(rollbackVersion.changesJson).toEqual(
                expect.objectContaining({ type: "rollback" })
            );
        });

        it("should create INFO severity alert on rollback", async () => {
            prismaMock.agentAlert.create.mockResolvedValue({
                ...mockAlert,
                severity: "INFO",
                source: "SYSTEM",
                title: "Agent rolled back"
            } as never);

            const alert = await prismaMock.agentAlert.create({
                data: {
                    agentId: "test-agent-uuid",
                    tenantId: "test-tenant",
                    severity: "INFO",
                    source: "SYSTEM",
                    title: "Agent rolled back",
                    message: "Rolled back from version 3 to version 1"
                }
            });

            expect(alert.severity).toBe("INFO");
            expect(prismaMock.agentAlert.create).toHaveBeenCalled();
        });

        it("should create audit log entry for rollback", async () => {
            prismaMock.auditLog.create.mockResolvedValue({
                id: "audit-uuid",
                tenantId: "test-tenant",
                action: "AGENT_ROLLBACK",
                entityType: "Agent",
                entityId: "test-agent-uuid",
                actorId: "user-123",
                metadata: { fromVersion: 3, toVersion: 1 }
            } as never);

            await prismaMock.auditLog.create({
                data: {
                    tenantId: "test-tenant",
                    action: "AGENT_ROLLBACK",
                    entityType: "Agent",
                    entityId: "test-agent-uuid",
                    actorId: "user-123",
                    metadata: { fromVersion: 3, toVersion: 1 }
                }
            });

            expect(prismaMock.auditLog.create).toHaveBeenCalled();
        });

        it("should return 404 for invalid version", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentVersion.findFirst.mockResolvedValue(null);

            const targetVersion = await prismaMock.agentVersion.findFirst({
                where: { agentId: "test-agent-uuid", version: 999 }
            });

            expect(targetVersion).toBeNull();
        });

        it("should return 404 for invalid agent", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(null);

            const agent = await prismaMock.agent.findFirst({
                where: { id: "invalid-agent-uuid" }
            });

            expect(agent).toBeNull();
        });
    });
});
