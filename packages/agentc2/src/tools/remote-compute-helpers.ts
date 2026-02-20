/**
 * Remote Compute Helpers
 *
 * Shared utilities for the remote compute tools:
 * - DigitalOcean API client (thin fetch wrapper)
 * - Ephemeral SSH key generation (ed25519)
 * - SSH command execution via ssh2
 * - Cloud-init bootstrap script for Ubuntu droplets
 * - Preset droplet sizes
 */

import { generateKeyPairSync, randomBytes } from "crypto";
import { Client as SshClient } from "ssh2";

// ─── DigitalOcean API ────────────────────────────────────────────────────────

const DO_API_BASE = "https://api.digitalocean.com/v2";

export interface DoApiResponse<T = unknown> {
    ok: boolean;
    status: number;
    data: T;
}

export async function doFetch<T = unknown>(
    token: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: Record<string, unknown>
): Promise<DoApiResponse<T>> {
    const url = `${DO_API_BASE}${path}`;
    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
    };

    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    let data: T;
    if (res.status === 204) {
        data = {} as T;
    } else {
        data = (await res.json()) as T;
    }

    return { ok: res.ok, status: res.status, data };
}

// ─── Credential Resolution ──────────────────────────────────────────────────

export async function resolveDoToken(organizationId: string): Promise<string> {
    const { prisma } = await import("@repo/database");
    const { decryptJson } = await import("../crypto/encryption");

    const connection = await prisma.integrationConnection.findFirst({
        where: {
            isActive: true,
            organizationId,
            provider: { key: "digitalocean" }
        },
        include: { provider: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
    });

    if (!connection) {
        throw new Error(
            `No active DigitalOcean integration found for organization ${organizationId}. ` +
                `Connect a DigitalOcean account in Settings → Integrations.`
        );
    }

    const decrypted = decryptJson(connection.credentials);
    if (!decrypted) {
        throw new Error("Failed to decrypt DigitalOcean credentials");
    }

    const token = decrypted.DIGITALOCEAN_ACCESS_TOKEN as string | undefined;
    if (!token) {
        throw new Error("DigitalOcean credentials missing DIGITALOCEAN_ACCESS_TOKEN");
    }

    return token;
}

// ─── SSH Key Generation ─────────────────────────────────────────────────────

export interface EphemeralSshKey {
    publicKey: string;
    privateKey: string;
}

export function generateEphemeralSshKey(): EphemeralSshKey {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });

    const sshPublicKey = pemToSshPublicKey(publicKey);

    return {
        publicKey: sshPublicKey,
        privateKey
    };
}

function pemToSshPublicKey(pem: string): string {
    const lines = pem.split("\n").filter((l) => !l.startsWith("-----") && l.trim());
    const derB64 = lines.join("");
    const der = Buffer.from(derB64, "base64");

    // ed25519 DER SPKI has a fixed 12-byte header; raw key is the remaining 32 bytes
    const rawKey = der.subarray(12);

    const keyType = "ssh-ed25519";
    const keyTypeLen = Buffer.alloc(4);
    keyTypeLen.writeUInt32BE(keyType.length);
    const keyDataLen = Buffer.alloc(4);
    keyDataLen.writeUInt32BE(rawKey.length);

    const blob = Buffer.concat([keyTypeLen, Buffer.from(keyType), keyDataLen, rawKey]);
    const label = `agentc2-ephemeral-${randomBytes(4).toString("hex")}`;

    return `ssh-ed25519 ${blob.toString("base64")} ${label}`;
}

// ─── SSH Execution ──────────────────────────────────────────────────────────

export interface SshExecResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
}

const MAX_SSH_OUTPUT = 1_048_576; // 1MB

function shellEscape(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

export async function sshExec(
    ip: string,
    privateKey: string,
    command: string,
    opts: { timeout?: number; workingDir?: string } = {}
): Promise<SshExecResult> {
    const timeout = opts.timeout ?? 300_000;
    const fullCommand = opts.workingDir
        ? `cd -- ${shellEscape(opts.workingDir)} && ${command}`
        : command;
    const startTime = Date.now();

    return new Promise<SshExecResult>((resolve, reject) => {
        const conn = new SshClient();
        let timer: ReturnType<typeof setTimeout> | null = null;

        const cleanup = () => {
            if (timer) clearTimeout(timer);
            try {
                conn.end();
            } catch {
                // ignore
            }
        };

        timer = setTimeout(() => {
            cleanup();
            resolve({
                exitCode: 124,
                stdout: "",
                stderr: `Command timed out after ${timeout}ms`,
                durationMs: Date.now() - startTime
            });
        }, timeout);

        conn.on("ready", () => {
            conn.exec(fullCommand, (err, stream) => {
                if (err) {
                    cleanup();
                    return reject(err);
                }

                let stdout = "";
                let stderr = "";

                stream.on("data", (data: Buffer) => {
                    if (stdout.length < MAX_SSH_OUTPUT) {
                        stdout += data.toString();
                    }
                });

                stream.stderr.on("data", (data: Buffer) => {
                    if (stderr.length < MAX_SSH_OUTPUT) {
                        stderr += data.toString();
                    }
                });

                stream.on("close", (code: number) => {
                    cleanup();
                    resolve({
                        exitCode: code ?? 0,
                        stdout: stdout.slice(0, MAX_SSH_OUTPUT),
                        stderr: stderr.slice(0, MAX_SSH_OUTPUT),
                        durationMs: Date.now() - startTime
                    });
                });
            });
        });

        conn.on("error", (err) => {
            cleanup();
            reject(err);
        });

        conn.connect({
            host: ip,
            port: 22,
            username: "root",
            privateKey,
            readyTimeout: 15_000,
            keepaliveInterval: 10_000
        });
    });
}

/**
 * Attempt SSH connection with retries (for newly provisioned droplets).
 */
export async function sshConnectivityCheck(
    ip: string,
    privateKey: string,
    maxRetries = 5,
    delayMs = 5000
): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await sshExec(ip, privateKey, "echo ok", { timeout: 10_000 });
            if (result.exitCode === 0 && result.stdout.includes("ok")) {
                return true;
            }
        } catch {
            // Connection not ready yet
        }

        if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    return false;
}

// ─── SCP File Transfer ──────────────────────────────────────────────────────

export async function scpPush(
    ip: string,
    privateKey: string,
    localContent: string,
    remotePath: string
): Promise<void> {
    // Use SSH exec to write file content via stdin
    const escaped = localContent.replace(/'/g, "'\\''");
    const cmd = `cat > ${shellEscape(remotePath)} << 'AGENTC2_EOF'\n${escaped}\nAGENTC2_EOF`;
    const result = await sshExec(ip, privateKey, cmd, { timeout: 30_000 });
    if (result.exitCode !== 0) {
        throw new Error(`SCP push failed: ${result.stderr}`);
    }
}

export async function scpPull(ip: string, privateKey: string, remotePath: string): Promise<string> {
    const result = await sshExec(ip, privateKey, `cat ${shellEscape(remotePath)}`, {
        timeout: 30_000
    });
    if (result.exitCode !== 0) {
        throw new Error(`SCP pull failed: ${result.stderr}`);
    }
    return result.stdout;
}

// ─── Droplet Sizes ──────────────────────────────────────────────────────────

export const DEFAULT_SIZES: Record<string, string> = {
    small: "s-1vcpu-2gb",
    medium: "s-2vcpu-4gb",
    large: "s-4vcpu-8gb"
};

// ─── Bootstrap Script ───────────────────────────────────────────────────────

export const BOOTSTRAP_SCRIPT = `#!/bin/bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

# Swap (2GB) for memory-intensive builds
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# System packages
apt-get update -qq
apt-get install -y -qq curl git jq rsync build-essential ca-certificates gnupg lsb-release

# Node.js 20 (NodeSource)
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi

# Bun
if ! command -v bun &>/dev/null; then
    curl -fsSL https://bun.sh/install | bash
    echo 'export BUN_INSTALL="/root/.bun"' >> /root/.bashrc
    echo 'export PATH="/root/.bun/bin:$PATH"' >> /root/.bashrc
fi

# Docker CE
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Workspace directory
mkdir -p /workspace
chmod 755 /workspace

# Signal readiness
touch /var/lib/cloud/instance/agentc2-ready
echo "AgentC2 bootstrap complete at $(date -u +%Y-%m-%dT%H:%M:%SZ)" > /var/log/agentc2-bootstrap.log
`;
