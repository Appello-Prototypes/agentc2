/**
 * Remote Compute Tools
 *
 * Four tools for provisioning and managing ephemeral DigitalOcean Droplets
 * in the customer's own account. AgentC2 remains a pure SDLC orchestrator;
 * compute runs on customer-owned infrastructure.
 *
 * Tools:
 *   provision-compute  — Spin up a droplet with ephemeral SSH key
 *   remote-execute     — Run commands on a provisioned droplet via SSH
 *   remote-file-transfer — Push/pull files to/from a droplet
 *   teardown-compute   — Destroy droplet, SSH key, and wipe secrets
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma, Prisma } from "@repo/database";
import { encrypt, decrypt } from "../crypto/encryption";
import {
    resolveDoToken,
    doFetch,
    generateEphemeralSshKey,
    sshExec,
    sshConnectivityCheck,
    scpPush,
    scpPull,
    DEFAULT_SIZES,
    BOOTSTRAP_SCRIPT
} from "./remote-compute-helpers";

const MAX_TTL_MINUTES = 180;
const DEFAULT_TTL_MINUTES = 60;
const MAX_TIMEOUT_SECONDS = 1800;
const DEFAULT_TIMEOUT_SECONDS = 300;
const MAX_ACTIVE_RESOURCES_PER_ORG = 3;
const MAX_PROVISIONS_PER_HOUR = 10;

// ─── Shared helpers ─────────────────────────────────────────────────────────

async function lookupResource(resourceId: string, organizationId: string) {
    const resource = await prisma.provisionedResource.findUnique({
        where: { id: resourceId }
    });

    if (!resource) {
        throw new Error(`Resource ${resourceId} not found`);
    }

    if (resource.organizationId !== organizationId) {
        throw new Error("Access denied: resource belongs to a different organization");
    }

    if (resource.status !== "active") {
        throw new Error(`Resource is ${resource.status}, not active`);
    }

    const metadata = resource.metadata as Record<string, unknown> | null;
    if (!metadata) {
        throw new Error("Resource metadata is missing");
    }

    const expiresAt = metadata.expiresAt ? new Date(metadata.expiresAt as string) : null;
    if (expiresAt && expiresAt < new Date()) {
        throw new Error(
            `Resource has expired (TTL reached at ${expiresAt.toISOString()}). ` +
                `Run teardown-compute to clean up.`
        );
    }

    return { resource, metadata };
}

async function enforceProvisioningLimits(organizationId: string) {
    const [activeResources, recentProvisions] = await Promise.all([
        prisma.provisionedResource.count({
            where: { organizationId, status: "active" }
        }),
        prisma.provisionedResource.count({
            where: {
                organizationId,
                createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
            }
        })
    ]);

    if (activeResources >= MAX_ACTIVE_RESOURCES_PER_ORG) {
        throw new Error(
            `Provisioning limit reached (${activeResources}/${MAX_ACTIVE_RESOURCES_PER_ORG} active resources). Tear down an existing resource first.`
        );
    }
    if (recentProvisions >= MAX_PROVISIONS_PER_HOUR) {
        throw new Error(
            `Provisioning rate limit exceeded (${recentProvisions}/${MAX_PROVISIONS_PER_HOUR} in the last hour).`
        );
    }
}

function decryptPrivateKey(metadata: Record<string, unknown>): string {
    const encryptedKey = metadata.privateKey as Record<string, unknown> | undefined;
    if (!encryptedKey) {
        throw new Error("SSH private key not found in resource metadata");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decrypted = decrypt(encryptedKey as any);
    if (!decrypted) {
        throw new Error("Failed to decrypt SSH private key");
    }

    return decrypted;
}

// ─── provision-compute ──────────────────────────────────────────────────────

export const provisionComputeTool = createTool({
    id: "provision-compute",
    description:
        "Provision an ephemeral DigitalOcean Droplet in the customer's account. " +
        "Generates a one-time SSH key pair, creates the droplet with a bootstrap script " +
        "(Node 20, Bun, Git, Docker), and returns connection details. " +
        "The droplet auto-expires after the specified TTL.",
    inputSchema: z.object({
        region: z
            .string()
            .default("nyc3")
            .describe("DigitalOcean region slug (e.g., 'nyc3', 'sfo3', 'ams3')"),
        size: z
            .string()
            .default("medium")
            .describe(
                "Droplet size: 'small' (1vCPU/2GB), 'medium' (2vCPU/4GB), 'large' (4vCPU/8GB), " +
                    "or a raw DO slug like 's-2vcpu-4gb'"
            ),
        image: z.string().default("ubuntu-24-04-x64").describe("Droplet image slug"),
        ttlMinutes: z
            .number()
            .min(5)
            .max(MAX_TTL_MINUTES)
            .default(DEFAULT_TTL_MINUTES)
            .describe(`TTL in minutes (5-${MAX_TTL_MINUTES}). Droplet destroyed after expiry.`),
        pipelineRunId: z.string().optional().describe("Associated pipeline run ID for tracking"),
        organizationId: z.string().describe("Organization ID (tenant isolation)")
    }),
    outputSchema: z.object({
        dropletId: z.number(),
        ip: z.string(),
        resourceId: z.string(),
        region: z.string(),
        size: z.string(),
        expiresAt: z.string()
    }),
    execute: async ({ region, size, image, ttlMinutes, pipelineRunId, organizationId }) => {
        await enforceProvisioningLimits(organizationId);
        const token = await resolveDoToken(organizationId);
        const resolvedSize = size ?? "medium";
        const sizeSlug = DEFAULT_SIZES[resolvedSize] || resolvedSize;
        const ttl = ttlMinutes ?? DEFAULT_TTL_MINUTES;
        const expiresAt = new Date(Date.now() + ttl * 60 * 1000);
        const dropletName = `agentc2-build-${Date.now()}`;

        // Generate ephemeral SSH key pair
        const sshKey = generateEphemeralSshKey();

        // Register public key with DO
        const keyRes = await doFetch<{ ssh_key: { id: number } }>(token, "POST", "/account/keys", {
            name: dropletName,
            public_key: sshKey.publicKey
        });
        if (!keyRes.ok) {
            throw new Error(
                `Failed to register SSH key with DigitalOcean: ${JSON.stringify(keyRes.data)}`
            );
        }
        const sshKeyId = keyRes.data.ssh_key.id;

        // Create droplet
        const dropletRes = await doFetch<{ droplet: { id: number } }>(token, "POST", "/droplets", {
            name: dropletName,
            region,
            size: sizeSlug,
            image,
            ssh_keys: [sshKeyId],
            user_data: BOOTSTRAP_SCRIPT,
            tags: ["agentc2-ephemeral"]
        });
        if (!dropletRes.ok) {
            // Clean up SSH key on failure
            await doFetch(token, "DELETE", `/account/keys/${sshKeyId}`);
            throw new Error(`Failed to create droplet: ${JSON.stringify(dropletRes.data)}`);
        }
        const dropletId = dropletRes.data.droplet.id;

        // Poll until active with IP assigned (exponential backoff, max ~90s)
        let ip: string | null = null;
        const pollStart = Date.now();
        const maxPollMs = 90_000;
        let delay = 3000;

        while (Date.now() - pollStart < maxPollMs) {
            await new Promise((r) => setTimeout(r, delay));

            const statusRes = await doFetch<{
                droplet: {
                    status: string;
                    networks: {
                        v4: Array<{ ip_address: string; type: string }>;
                    };
                };
            }>(token, "GET", `/droplets/${dropletId}`);

            if (statusRes.ok && statusRes.data.droplet.status === "active") {
                const publicNet = statusRes.data.droplet.networks.v4.find(
                    (n) => n.type === "public"
                );
                if (publicNet) {
                    ip = publicNet.ip_address;
                    break;
                }
            }

            delay = Math.min(delay * 1.5, 10000);
        }

        if (!ip) {
            // Clean up on timeout
            await doFetch(token, "DELETE", `/droplets/${dropletId}`);
            await doFetch(token, "DELETE", `/account/keys/${sshKeyId}`);
            throw new Error("Droplet did not become active within 90 seconds");
        }

        // SSH connectivity check
        const sshReady = await sshConnectivityCheck(ip, sshKey.privateKey, 5, 5000);
        if (!sshReady) {
            await doFetch(token, "DELETE", `/droplets/${dropletId}`);
            await doFetch(token, "DELETE", `/account/keys/${sshKeyId}`);
            throw new Error("SSH connectivity check failed after droplet became active");
        }

        // Encrypt private key for storage
        const encryptedKey = encrypt(sshKey.privateKey);

        // Store in ProvisionedResource
        const resource = await prisma.provisionedResource.create({
            data: {
                organizationId,
                provider: "digitalocean",
                resourceType: "droplet",
                externalId: String(dropletId),
                name: dropletName,
                status: "active",
                metadata: {
                    ip,
                    sshKeyId,
                    privateKey: encryptedKey,
                    ttlMinutes: ttl,
                    expiresAt: expiresAt.toISOString(),
                    region,
                    size: sizeSlug,
                    pipelineRunId: pipelineRunId || null
                } as unknown as Prisma.InputJsonValue,
                monthlyCostUsd: null
            }
        });

        return {
            dropletId,
            ip,
            resourceId: resource.id,
            region,
            size: sizeSlug,
            expiresAt: expiresAt.toISOString()
        };
    }
});

// ─── remote-execute ─────────────────────────────────────────────────────────

export const remoteExecuteTool = createTool({
    id: "remote-execute",
    description:
        "Execute a command on a provisioned droplet via SSH. " +
        "Use for git clone, bun install, build, test, or any shell command. " +
        "Requires a valid, non-expired resource ID from provision-compute.",
    inputSchema: z.object({
        resourceId: z.string().describe("Resource ID from provision-compute"),
        command: z.string().describe("Shell command to execute on the droplet"),
        workingDir: z
            .string()
            .optional()
            .describe("Working directory on the droplet (default: /workspace)"),
        timeout: z
            .number()
            .min(5)
            .max(MAX_TIMEOUT_SECONDS)
            .default(DEFAULT_TIMEOUT_SECONDS)
            .describe(`Timeout in seconds (5-${MAX_TIMEOUT_SECONDS})`),
        organizationId: z.string().describe("Organization ID (tenant isolation)")
    }),
    outputSchema: z.object({
        exitCode: z.number(),
        stdout: z.string(),
        stderr: z.string(),
        durationMs: z.number()
    }),
    execute: async ({ resourceId, command, workingDir, timeout, organizationId }) => {
        const { metadata } = await lookupResource(resourceId, organizationId);
        const ip = metadata.ip as string;
        const privateKey = decryptPrivateKey(metadata);

        const resolvedTimeout = timeout ?? DEFAULT_TIMEOUT_SECONDS;
        const result = await sshExec(ip, privateKey, command, {
            timeout: resolvedTimeout * 1000,
            workingDir: workingDir || "/workspace"
        });

        return {
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            durationMs: result.durationMs
        };
    }
});

// ─── remote-file-transfer ───────────────────────────────────────────────────

export const remoteFileTransferTool = createTool({
    id: "remote-file-transfer",
    description:
        "Transfer files to or from a provisioned droplet. " +
        "Push config files, scripts, or pull build logs and test results. " +
        "Uses SSH-based file transfer (no SCP binary required).",
    inputSchema: z.object({
        resourceId: z.string().describe("Resource ID from provision-compute"),
        direction: z
            .enum(["push", "pull"])
            .describe("'push' to send content to droplet, 'pull' to retrieve from droplet"),
        content: z
            .string()
            .optional()
            .describe("File content to push (required when direction is 'push')"),
        remotePath: z.string().describe("Absolute path on the droplet"),
        organizationId: z.string().describe("Organization ID (tenant isolation)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        content: z.string().optional(),
        bytesTransferred: z.number()
    }),
    execute: async ({ resourceId, direction, content, remotePath, organizationId }) => {
        const { metadata } = await lookupResource(resourceId, organizationId);
        const ip = metadata.ip as string;
        const privateKey = decryptPrivateKey(metadata);

        if (direction === "push") {
            if (!content) {
                throw new Error("content is required when direction is 'push'");
            }
            await scpPush(ip, privateKey, content, remotePath);
            return {
                success: true,
                bytesTransferred: Buffer.byteLength(content, "utf8")
            };
        } else {
            const pulled = await scpPull(ip, privateKey, remotePath);
            return {
                success: true,
                content: pulled,
                bytesTransferred: Buffer.byteLength(pulled, "utf8")
            };
        }
    }
});

// ─── teardown-compute ───────────────────────────────────────────────────────

export const teardownComputeTool = createTool({
    id: "teardown-compute",
    description:
        "Destroy a provisioned droplet and its SSH key. " +
        "Cleans up the DigitalOcean resources and wipes the private key from storage. " +
        "Always call this when done, even on failure -- prevents orphaned infrastructure.",
    inputSchema: z.object({
        resourceId: z.string().describe("Resource ID from provision-compute"),
        organizationId: z.string().describe("Organization ID (tenant isolation)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        name: z.string(),
        durationMinutes: z.number()
    }),
    execute: async ({ resourceId, organizationId }) => {
        const resource = await prisma.provisionedResource.findUnique({
            where: { id: resourceId }
        });

        if (!resource) {
            throw new Error(`Resource ${resourceId} not found`);
        }

        if (resource.organizationId !== organizationId) {
            throw new Error("Access denied: resource belongs to a different organization");
        }

        if (resource.status === "destroyed") {
            return {
                success: true,
                name: resource.name,
                durationMinutes: 0
            };
        }

        const metadata = resource.metadata as Record<string, unknown> | null;
        const token = await resolveDoToken(organizationId);
        const dropletId = resource.externalId;

        // Destroy droplet
        try {
            await doFetch(token, "DELETE", `/droplets/${dropletId}`);
        } catch (err) {
            console.warn(`[RemoteCompute] Failed to delete droplet ${dropletId}:`, err);
        }

        // Destroy SSH key
        const sshKeyId = metadata?.sshKeyId as number | undefined;
        if (sshKeyId) {
            try {
                await doFetch(token, "DELETE", `/account/keys/${sshKeyId}`);
            } catch (err) {
                console.warn(`[RemoteCompute] Failed to delete SSH key ${sshKeyId}:`, err);
            }
        }

        // Wipe private key and mark as destroyed
        const cleanedMetadata = { ...(metadata || {}) };
        delete cleanedMetadata.privateKey;
        cleanedMetadata.destroyedBy = "teardown-compute";

        await prisma.provisionedResource.update({
            where: { id: resourceId },
            data: {
                status: "destroyed",
                destroyedAt: new Date(),
                metadata: cleanedMetadata as Prisma.InputJsonValue
            }
        });

        const durationMinutes = Math.round((Date.now() - resource.createdAt.getTime()) / 60_000);

        return {
            success: true,
            name: resource.name,
            durationMinutes
        };
    }
});
