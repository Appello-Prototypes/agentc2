/**
 * E2E test: Docker sandbox execution + infrastructure tracking
 *
 * Tests the full flow:
 * 1. execute-code with Docker detection and fallback
 * 2. execute-code with networkAccess and injectCredentials params
 * 3. track-resource records provisioned infrastructure
 * 4. list-resources shows active resources with cost totals
 * 5. destroy-resource marks resources as destroyed
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrismaModule, prismaMock, resetPrismaMock } from "../utils/db-mock";

mockPrismaModule();

vi.mock("child_process", () => {
    const EventEmitter = require("events");

    function createMockChild(exitCode: number, stdout: string, stderr: string) {
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();

        setTimeout(() => {
            child.stdout.emit("data", Buffer.from(stdout));
            if (stderr) child.stderr.emit("data", Buffer.from(stderr));
            child.emit("close", exitCode);
        }, 10);

        return child;
    }

    return {
        spawn: vi.fn(() => createMockChild(0, "hello world\n", "")),
        execSync: vi.fn(() => {
            throw new Error("Docker not available in test");
        })
    };
});

vi.mock("fs/promises", async () => {
    const actual = await vi.importActual<typeof import("fs/promises")>("fs/promises");
    return {
        ...actual,
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue("file content"),
        stat: vi.fn().mockResolvedValue({ size: 123, isFile: () => true }),
        readdir: vi.fn().mockResolvedValue([])
    };
});

describe("Sandbox Tools", () => {
    beforeEach(() => {
        resetPrismaMock();
        vi.clearAllMocks();
    });

    describe("execute-code", () => {
        it("falls back to child_process when Docker is unavailable", async () => {
            const { executeCodeTool } =
                await import("../../packages/mastra/src/tools/sandbox-tools");

            const result = await executeCodeTool.execute(
                {
                    language: "bash",
                    code: 'echo "hello world"',
                    agentId: "test-agent"
                },
                {} as never
            );

            expect(result.executionMode).toBe("child_process");
            expect(result.stdout).toContain("hello world");
            expect(result.exitCode).toBe(0);
            expect(result.timedOut).toBe(false);
        });

        it("accepts networkAccess and injectCredentials params", async () => {
            const { executeCodeTool } =
                await import("../../packages/mastra/src/tools/sandbox-tools");

            prismaMock.integrationConnection.findMany.mockResolvedValue([]);

            const result = await executeCodeTool.execute(
                {
                    language: "bash",
                    code: "doctl account get",
                    agentId: "test-agent",
                    networkAccess: true,
                    injectCredentials: ["digitalocean"]
                },
                {} as never
            );

            expect(result.executionMode).toBe("child_process");
            expect(result.exitCode).toBe(0);
        });

        it("has the new parameters in its input schema", async () => {
            const { executeCodeTool } =
                await import("../../packages/mastra/src/tools/sandbox-tools");

            const schema = executeCodeTool.inputSchema;
            const shape = schema.shape;
            expect(shape).toHaveProperty("networkAccess");
            expect(shape).toHaveProperty("injectCredentials");
        });
    });
});

describe("Infrastructure Tracking Tools", () => {
    beforeEach(() => {
        resetPrismaMock();
    });

    describe("track-resource", () => {
        it("creates a provisioned resource record", async () => {
            const { trackResourceTool } =
                await import("../../packages/mastra/src/tools/infra-tools");

            prismaMock.organization.findFirst.mockResolvedValue({
                id: "org-1"
            } as never);

            prismaMock.provisionedResource.create.mockResolvedValue({
                id: "res-1",
                organizationId: "org-1",
                provider: "digitalocean",
                resourceType: "droplet",
                externalId: "12345678",
                name: "my-app-server",
                status: "active",
                monthlyCostUsd: 12,
                metadata: { ip: "1.2.3.4", region: "nyc1" },
                createdAt: new Date(),
                updatedAt: new Date(),
                destroyedAt: null,
                agentId: "agent-1",
                runId: "run-1"
            } as never);

            const result = await trackResourceTool.execute(
                {
                    provider: "digitalocean",
                    resourceType: "droplet",
                    externalId: "12345678",
                    name: "my-app-server",
                    metadata: { ip: "1.2.3.4", region: "nyc1" },
                    monthlyCostUsd: 12,
                    agentId: "agent-1",
                    runId: "run-1"
                },
                {} as never
            );

            expect(result.success).toBe(true);
            expect(result.resourceId).toBe("res-1");
            expect(prismaMock.provisionedResource.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        provider: "digitalocean",
                        resourceType: "droplet",
                        externalId: "12345678",
                        name: "my-app-server",
                        status: "active"
                    })
                })
            );
        });
    });

    describe("list-resources", () => {
        it("lists active resources with cost totals", async () => {
            const { listResourcesTool } =
                await import("../../packages/mastra/src/tools/infra-tools");

            prismaMock.organization.findFirst.mockResolvedValue({
                id: "org-1"
            } as never);

            prismaMock.provisionedResource.findMany.mockResolvedValue([
                {
                    id: "res-1",
                    provider: "digitalocean",
                    resourceType: "droplet",
                    externalId: "12345678",
                    name: "server-1",
                    status: "active",
                    monthlyCostUsd: 12,
                    metadata: { ip: "1.2.3.4" },
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    destroyedAt: null
                },
                {
                    id: "res-2",
                    provider: "supabase",
                    resourceType: "database",
                    externalId: "proj-abc",
                    name: "my-db",
                    status: "active",
                    monthlyCostUsd: 25,
                    metadata: { region: "us-east-1" },
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    destroyedAt: null
                }
            ] as never);

            const result = await listResourcesTool.execute({}, {} as never);

            expect(result.count).toBe(2);
            expect(result.totalMonthlyCost).toBe(37);
            expect(result.resources[0].name).toBe("server-1");
            expect(result.resources[1].name).toBe("my-db");
        });
    });

    describe("destroy-resource", () => {
        it("marks a resource as destroyed", async () => {
            const { destroyResourceTool } =
                await import("../../packages/mastra/src/tools/infra-tools");

            prismaMock.provisionedResource.update.mockResolvedValue({
                id: "res-1",
                name: "my-server",
                provider: "digitalocean",
                status: "destroyed",
                destroyedAt: new Date()
            } as never);

            const result = await destroyResourceTool.execute({ resourceId: "res-1" }, {} as never);

            expect(result.success).toBe(true);
            expect(result.name).toBe("my-server");
            expect(result.provider).toBe("digitalocean");
            expect(prismaMock.provisionedResource.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "res-1" },
                    data: expect.objectContaining({
                        status: "destroyed"
                    })
                })
            );
        });
    });
});
