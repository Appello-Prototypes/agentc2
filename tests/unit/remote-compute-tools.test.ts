import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock database
const mockPrismaProvisionedResource = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
};

vi.mock("@repo/database", () => ({
    prisma: {
        provisionedResource: mockPrismaProvisionedResource,
        integrationConnection: {
            findFirst: vi.fn()
        },
        organization: {
            findFirst: vi.fn()
        }
    },
    Prisma: {
        InputJsonValue: {}
    }
}));

// Mock encryption
vi.mock("../../packages/mastra/src/crypto/encryption", () => ({
    encrypt: vi.fn((val: string) => ({
        __enc: "v1",
        iv: "mock-iv",
        tag: "mock-tag",
        data: Buffer.from(val).toString("base64")
    })),
    decrypt: vi.fn((payload: { data: string }) => {
        return Buffer.from(payload.data, "base64").toString();
    }),
    encryptJson: vi.fn(),
    decryptJson: vi.fn()
}));

// Mock remote-compute-helpers
const mockDoFetch = vi.fn();
const mockResolveDoToken = vi.fn();
const mockGenerateEphemeralSshKey = vi.fn();
const mockSshExec = vi.fn();
const mockSshConnectivityCheck = vi.fn();
const mockScpPush = vi.fn();
const mockScpPull = vi.fn();

vi.mock("../../packages/mastra/src/tools/remote-compute-helpers", () => ({
    resolveDoToken: (...args: unknown[]) => mockResolveDoToken(...args),
    doFetch: (...args: unknown[]) => mockDoFetch(...args),
    generateEphemeralSshKey: () => mockGenerateEphemeralSshKey(),
    sshExec: (...args: unknown[]) => mockSshExec(...args),
    sshConnectivityCheck: (...args: unknown[]) => mockSshConnectivityCheck(...args),
    scpPush: (...args: unknown[]) => mockScpPush(...args),
    scpPull: (...args: unknown[]) => mockScpPull(...args),
    DEFAULT_SIZES: {
        small: "s-1vcpu-2gb",
        medium: "s-2vcpu-4gb",
        large: "s-4vcpu-8gb"
    },
    BOOTSTRAP_SCRIPT: "#!/bin/bash\necho 'bootstrap'"
}));

beforeEach(() => {
    vi.clearAllMocks();
    mockResolveDoToken.mockResolvedValue("do-test-token-123");
    mockGenerateEphemeralSshKey.mockReturnValue({
        publicKey: "ssh-ed25519 AAAA mock-key",
        privateKey: "-----BEGIN PRIVATE KEY-----\nmock-private-key\n-----END PRIVATE KEY-----"
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("Remote Compute Tools", () => {
    describe("provision-compute", () => {
        it("provisions a droplet and returns connection details", async () => {
            const { provisionComputeTool } =
                await import("../../packages/mastra/src/tools/remote-compute-tools");

            // Mock SSH key registration
            mockDoFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                data: { ssh_key: { id: 12345 } }
            });

            // Mock droplet creation
            mockDoFetch.mockResolvedValueOnce({
                ok: true,
                status: 201,
                data: { droplet: { id: 67890 } }
            });

            // Mock droplet status poll (active with IP)
            mockDoFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                data: {
                    droplet: {
                        status: "active",
                        networks: {
                            v4: [{ ip_address: "10.0.0.1", type: "public" }]
                        }
                    }
                }
            });

            // Mock SSH connectivity check
            mockSshConnectivityCheck.mockResolvedValueOnce(true);

            // Mock ProvisionedResource.create
            mockPrismaProvisionedResource.create.mockResolvedValueOnce({
                id: "resource-abc"
            });

            const result = await provisionComputeTool.execute({
                region: "nyc3",
                size: "medium",
                image: "ubuntu-24-04-x64",
                ttlMinutes: 60,
                organizationId: "org-123"
            });

            expect(result.dropletId).toBe(67890);
            expect(result.ip).toBe("10.0.0.1");
            expect(result.resourceId).toBe("resource-abc");
            expect(result.region).toBe("nyc3");
            expect(result.size).toBe("s-2vcpu-4gb");
            expect(result.expiresAt).toBeTruthy();

            expect(mockResolveDoToken).toHaveBeenCalledWith("org-123");
            expect(mockDoFetch).toHaveBeenCalledTimes(3);

            // Verify SSH key registration
            expect(mockDoFetch).toHaveBeenNthCalledWith(
                1,
                "do-test-token-123",
                "POST",
                "/account/keys",
                expect.objectContaining({
                    public_key: "ssh-ed25519 AAAA mock-key"
                })
            );

            // Verify droplet creation
            expect(mockDoFetch).toHaveBeenNthCalledWith(
                2,
                "do-test-token-123",
                "POST",
                "/droplets",
                expect.objectContaining({
                    region: "nyc3",
                    size: "s-2vcpu-4gb",
                    ssh_keys: [12345],
                    tags: ["agentc2-ephemeral"]
                })
            );

            // Verify resource was tracked
            expect(mockPrismaProvisionedResource.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        organizationId: "org-123",
                        provider: "digitalocean",
                        resourceType: "droplet",
                        externalId: "67890",
                        status: "active"
                    })
                })
            );
        });

        it("uses preset size names correctly", async () => {
            const { provisionComputeTool } =
                await import("../../packages/mastra/src/tools/remote-compute-tools");

            mockDoFetch
                .mockResolvedValueOnce({
                    ok: true,
                    data: { ssh_key: { id: 1 } }
                })
                .mockResolvedValueOnce({
                    ok: true,
                    data: { droplet: { id: 1 } }
                })
                .mockResolvedValueOnce({
                    ok: true,
                    data: {
                        droplet: {
                            status: "active",
                            networks: { v4: [{ ip_address: "1.2.3.4", type: "public" }] }
                        }
                    }
                });
            mockSshConnectivityCheck.mockResolvedValueOnce(true);
            mockPrismaProvisionedResource.create.mockResolvedValueOnce({ id: "r1" });

            const result = await provisionComputeTool.execute({
                region: "sfo3",
                size: "large",
                image: "ubuntu-24-04-x64",
                ttlMinutes: 30,
                organizationId: "org-123"
            });

            expect(result.size).toBe("s-4vcpu-8gb");
        });

        it("cleans up SSH key on droplet creation failure", async () => {
            const { provisionComputeTool } =
                await import("../../packages/mastra/src/tools/remote-compute-tools");

            mockDoFetch
                .mockResolvedValueOnce({
                    ok: true,
                    data: { ssh_key: { id: 999 } }
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 422,
                    data: { message: "Quota exceeded" }
                })
                .mockResolvedValueOnce({ ok: true, data: {} }); // cleanup key

            await expect(
                provisionComputeTool.execute({
                    region: "nyc3",
                    size: "medium",
                    image: "ubuntu-24-04-x64",
                    ttlMinutes: 60,
                    organizationId: "org-123"
                })
            ).rejects.toThrow("Failed to create droplet");

            // Verify SSH key cleanup was attempted
            expect(mockDoFetch).toHaveBeenNthCalledWith(
                3,
                "do-test-token-123",
                "DELETE",
                "/account/keys/999"
            );
        });
    });

    describe("remote-execute", () => {
        it("executes a command on a provisioned droplet", async () => {
            const { remoteExecuteTool } =
                await import("../../packages/mastra/src/tools/remote-compute-tools");

            const futureExpiry = new Date(Date.now() + 3600_000).toISOString();

            mockPrismaProvisionedResource.findUnique.mockResolvedValueOnce({
                id: "resource-abc",
                organizationId: "org-123",
                status: "active",
                metadata: {
                    ip: "10.0.0.1",
                    privateKey: {
                        __enc: "v1",
                        iv: "mock-iv",
                        tag: "mock-tag",
                        data: Buffer.from("mock-private-key").toString("base64")
                    },
                    expiresAt: futureExpiry
                }
            });

            mockSshExec.mockResolvedValueOnce({
                exitCode: 0,
                stdout: "Build successful\n",
                stderr: "",
                durationMs: 5000
            });

            const result = await remoteExecuteTool.execute({
                resourceId: "resource-abc",
                command: "bun run build",
                timeout: 300,
                organizationId: "org-123"
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toBe("Build successful\n");
            expect(result.durationMs).toBe(5000);

            expect(mockSshExec).toHaveBeenCalledWith(
                "10.0.0.1",
                "mock-private-key",
                "bun run build",
                { timeout: 300000, workingDir: "/workspace" }
            );
        });

        it("rejects access from wrong organization", async () => {
            const { remoteExecuteTool } =
                await import("../../packages/mastra/src/tools/remote-compute-tools");

            mockPrismaProvisionedResource.findUnique.mockResolvedValueOnce({
                id: "resource-abc",
                organizationId: "org-DIFFERENT",
                status: "active",
                metadata: { ip: "10.0.0.1" }
            });

            await expect(
                remoteExecuteTool.execute({
                    resourceId: "resource-abc",
                    command: "ls",
                    timeout: 60,
                    organizationId: "org-123"
                })
            ).rejects.toThrow("Access denied: resource belongs to a different organization");
        });

        it("rejects execution on expired resource", async () => {
            const { remoteExecuteTool } =
                await import("../../packages/mastra/src/tools/remote-compute-tools");

            const pastExpiry = new Date(Date.now() - 3600_000).toISOString();

            mockPrismaProvisionedResource.findUnique.mockResolvedValueOnce({
                id: "resource-abc",
                organizationId: "org-123",
                status: "active",
                metadata: {
                    ip: "10.0.0.1",
                    privateKey: { __enc: "v1", iv: "a", tag: "b", data: "c" },
                    expiresAt: pastExpiry
                }
            });

            await expect(
                remoteExecuteTool.execute({
                    resourceId: "resource-abc",
                    command: "ls",
                    timeout: 60,
                    organizationId: "org-123"
                })
            ).rejects.toThrow("Resource has expired");
        });

        it("rejects execution on non-active resource", async () => {
            const { remoteExecuteTool } =
                await import("../../packages/mastra/src/tools/remote-compute-tools");

            mockPrismaProvisionedResource.findUnique.mockResolvedValueOnce({
                id: "resource-abc",
                organizationId: "org-123",
                status: "destroyed",
                metadata: { ip: "10.0.0.1" }
            });

            await expect(
                remoteExecuteTool.execute({
                    resourceId: "resource-abc",
                    command: "ls",
                    timeout: 60,
                    organizationId: "org-123"
                })
            ).rejects.toThrow("Resource is destroyed, not active");
        });
    });

    describe("remote-file-transfer", () => {
        it("pushes file content to a droplet", async () => {
            const { remoteFileTransferTool } =
                await import("../../packages/mastra/src/tools/remote-compute-tools");

            const futureExpiry = new Date(Date.now() + 3600_000).toISOString();

            mockPrismaProvisionedResource.findUnique.mockResolvedValueOnce({
                id: "resource-abc",
                organizationId: "org-123",
                status: "active",
                metadata: {
                    ip: "10.0.0.1",
                    privateKey: {
                        __enc: "v1",
                        iv: "a",
                        tag: "b",
                        data: Buffer.from("key").toString("base64")
                    },
                    expiresAt: futureExpiry
                }
            });

            mockScpPush.mockResolvedValueOnce(undefined);

            const result = await remoteFileTransferTool.execute({
                resourceId: "resource-abc",
                direction: "push" as const,
                content: "Hello World",
                remotePath: "/workspace/test.txt",
                organizationId: "org-123"
            });

            expect(result.success).toBe(true);
            expect(result.bytesTransferred).toBe(11);
            expect(mockScpPush).toHaveBeenCalledWith(
                "10.0.0.1",
                "key",
                "Hello World",
                "/workspace/test.txt"
            );
        });

        it("pulls file content from a droplet", async () => {
            const { remoteFileTransferTool } =
                await import("../../packages/mastra/src/tools/remote-compute-tools");

            const futureExpiry = new Date(Date.now() + 3600_000).toISOString();

            mockPrismaProvisionedResource.findUnique.mockResolvedValueOnce({
                id: "resource-abc",
                organizationId: "org-123",
                status: "active",
                metadata: {
                    ip: "10.0.0.1",
                    privateKey: {
                        __enc: "v1",
                        iv: "a",
                        tag: "b",
                        data: Buffer.from("key").toString("base64")
                    },
                    expiresAt: futureExpiry
                }
            });

            mockScpPull.mockResolvedValueOnce("file contents here");

            const result = await remoteFileTransferTool.execute({
                resourceId: "resource-abc",
                direction: "pull" as const,
                remotePath: "/workspace/output.log",
                organizationId: "org-123"
            });

            expect(result.success).toBe(true);
            expect(result.content).toBe("file contents here");
            expect(mockScpPull).toHaveBeenCalledWith("10.0.0.1", "key", "/workspace/output.log");
        });

        it("rejects push without content", async () => {
            const { remoteFileTransferTool } =
                await import("../../packages/mastra/src/tools/remote-compute-tools");

            const futureExpiry = new Date(Date.now() + 3600_000).toISOString();

            mockPrismaProvisionedResource.findUnique.mockResolvedValueOnce({
                id: "resource-abc",
                organizationId: "org-123",
                status: "active",
                metadata: {
                    ip: "10.0.0.1",
                    privateKey: {
                        __enc: "v1",
                        iv: "a",
                        tag: "b",
                        data: Buffer.from("key").toString("base64")
                    },
                    expiresAt: futureExpiry
                }
            });

            await expect(
                remoteFileTransferTool.execute({
                    resourceId: "resource-abc",
                    direction: "push" as const,
                    remotePath: "/workspace/test.txt",
                    organizationId: "org-123"
                })
            ).rejects.toThrow("content is required when direction is 'push'");
        });
    });

    describe("teardown-compute", () => {
        it("destroys a droplet and cleans up SSH key", async () => {
            const { teardownComputeTool } =
                await import("../../packages/mastra/src/tools/remote-compute-tools");

            mockPrismaProvisionedResource.findUnique.mockResolvedValueOnce({
                id: "resource-abc",
                organizationId: "org-123",
                status: "active",
                externalId: "67890",
                name: "agentc2-build-test",
                createdAt: new Date(Date.now() - 30 * 60_000),
                metadata: {
                    ip: "10.0.0.1",
                    sshKeyId: 12345,
                    privateKey: { __enc: "v1", iv: "a", tag: "b", data: "c" }
                }
            });

            mockDoFetch.mockResolvedValue({ ok: true, data: {} });

            mockPrismaProvisionedResource.update.mockResolvedValueOnce({
                id: "resource-abc",
                status: "destroyed"
            });

            const result = await teardownComputeTool.execute({
                resourceId: "resource-abc",
                organizationId: "org-123"
            });

            expect(result.success).toBe(true);
            expect(result.name).toBe("agentc2-build-test");
            expect(result.durationMinutes).toBeGreaterThanOrEqual(29);

            // Verify droplet deletion
            expect(mockDoFetch).toHaveBeenCalledWith(
                "do-test-token-123",
                "DELETE",
                "/droplets/67890"
            );

            // Verify SSH key deletion
            expect(mockDoFetch).toHaveBeenCalledWith(
                "do-test-token-123",
                "DELETE",
                "/account/keys/12345"
            );

            // Verify private key was wiped from metadata
            expect(mockPrismaProvisionedResource.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: "destroyed",
                        metadata: expect.not.objectContaining({
                            privateKey: expect.anything()
                        })
                    })
                })
            );
        });

        it("rejects teardown from wrong organization", async () => {
            const { teardownComputeTool } =
                await import("../../packages/mastra/src/tools/remote-compute-tools");

            mockPrismaProvisionedResource.findUnique.mockResolvedValueOnce({
                id: "resource-abc",
                organizationId: "org-DIFFERENT",
                status: "active",
                metadata: {}
            });

            await expect(
                teardownComputeTool.execute({
                    resourceId: "resource-abc",
                    organizationId: "org-123"
                })
            ).rejects.toThrow("Access denied: resource belongs to a different organization");
        });

        it("is idempotent for already-destroyed resources", async () => {
            const { teardownComputeTool } =
                await import("../../packages/mastra/src/tools/remote-compute-tools");

            mockPrismaProvisionedResource.findUnique.mockResolvedValueOnce({
                id: "resource-abc",
                organizationId: "org-123",
                status: "destroyed",
                name: "agentc2-build-old",
                metadata: {}
            });

            const result = await teardownComputeTool.execute({
                resourceId: "resource-abc",
                organizationId: "org-123"
            });

            expect(result.success).toBe(true);
            expect(result.name).toBe("agentc2-build-old");
            expect(mockDoFetch).not.toHaveBeenCalled();
        });
    });

    describe("helpers", () => {
        it("generateEphemeralSshKey produces valid key pair", async () => {
            // Use the real implementation for this test
            vi.doUnmock("../../packages/mastra/src/tools/remote-compute-helpers");
            const { generateEphemeralSshKey } =
                await import("../../packages/mastra/src/tools/remote-compute-helpers");

            const key = generateEphemeralSshKey();

            expect(key.publicKey).toMatch(/^ssh-ed25519 /);
            expect(key.privateKey).toContain("BEGIN PRIVATE KEY");
            expect(key.privateKey).toContain("END PRIVATE KEY");
        });

        it("DEFAULT_SIZES maps named sizes to DO slugs", async () => {
            vi.doUnmock("../../packages/mastra/src/tools/remote-compute-helpers");
            const { DEFAULT_SIZES } =
                await import("../../packages/mastra/src/tools/remote-compute-helpers");

            expect(DEFAULT_SIZES.small).toBe("s-1vcpu-2gb");
            expect(DEFAULT_SIZES.medium).toBe("s-2vcpu-4gb");
            expect(DEFAULT_SIZES.large).toBe("s-4vcpu-8gb");
        });

        it("BOOTSTRAP_SCRIPT installs required tools", async () => {
            vi.doUnmock("../../packages/mastra/src/tools/remote-compute-helpers");
            const { BOOTSTRAP_SCRIPT } =
                await import("../../packages/mastra/src/tools/remote-compute-helpers");

            expect(BOOTSTRAP_SCRIPT).toContain("bun");
            expect(BOOTSTRAP_SCRIPT).toContain("docker");
            expect(BOOTSTRAP_SCRIPT).toContain("git");
            expect(BOOTSTRAP_SCRIPT).toContain("/workspace");
            expect(BOOTSTRAP_SCRIPT).toContain("agentc2-ready");
        });
    });
});
