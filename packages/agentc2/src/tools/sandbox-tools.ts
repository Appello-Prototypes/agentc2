/**
 * Sandbox Tools — Docker-isolated code execution and workspace file management
 *
 * Provides agents with the ability to:
 * - Execute code (bash, Python, TypeScript) in Docker containers
 * - Read/write files in a persistent per-agent workspace directory
 * - Optionally inject cloud provider credentials for infrastructure provisioning
 *
 * Security model (v2 — Docker):
 * - Each execution runs in an ephemeral Docker container (agentc2-sandbox image)
 * - Memory and CPU limits enforced via Docker
 * - Network isolated by default (--network none), opt-in via networkAccess
 * - Credentials injected per-execution from encrypted IntegrationConnection records
 * - Workspace mounted as volume for persistence between runs
 *
 * Fallback: If Docker is unavailable, falls back to child_process with env stripping
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { spawn, execSync, type ChildProcess } from "child_process";
import { mkdir, writeFile, readFile, stat, readdir, realpath, lstat } from "fs/promises";
import { join, normalize, isAbsolute, extname, resolve } from "path";

const WORKSPACE_ROOT = process.env.AGENT_WORKSPACE_ROOT || "/var/lib/agentc2/workspaces";
const SANDBOX_IMAGE = process.env.SANDBOX_DOCKER_IMAGE || "agentc2-sandbox";
const MAX_TIMEOUT_MS = 120_000;
const MAX_FILE_SIZE = 1_048_576; // 1MB
const MAX_OUTPUT_SIZE = 100_000; // 100KB of stdout/stderr

const DOCKER_MEMORY_LIMIT = process.env.SANDBOX_MEMORY_LIMIT || "512m";
const DOCKER_CPU_LIMIT = process.env.SANDBOX_CPU_LIMIT || "1.0";
const ALLOW_UNSANDBOXED_FALLBACK =
    process.env.SANDBOX_ALLOW_UNSANDBOXED_FALLBACK === "true" &&
    process.env.NODE_ENV !== "production";

const ALLOWED_WRITE_EXTENSIONS = new Set([
    ".html",
    ".htm",
    ".css",
    ".json",
    ".csv",
    ".txt",
    ".md",
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".py",
    ".ts",
    ".js",
    ".sh",
    ".sql",
    ".xml",
    ".yaml",
    ".yml",
    ".pdf",
    ".log",
    ".toml",
    ".ini",
    ".cfg",
    ".env",
    ".r",
    ".rb"
]);

/**
 * Secrets that should NEVER be passed to child processes (fallback mode only)
 */
const SECRET_PATTERNS = [
    /^DATABASE_URL$/i,
    /API_KEY$/i,
    /API_SECRET$/i,
    /ACCESS_TOKEN$/i,
    /AUTH_TOKEN$/i,
    /SIGNING_KEY$/i,
    /ENCRYPTION_KEY$/i,
    /^BETTER_AUTH/i,
    /^CREDENTIAL_/i,
    /^SLACK_BOT_TOKEN$/i,
    /^SLACK_CLIENT_SECRET$/i,
    /^SLACK_SIGNING_SECRET$/i,
    /^NGROK_AUTHTOKEN$/i,
    /^INNGEST_/i,
    /PASSWORD/i,
    /SECRET/i
];

let _dockerAvailable: boolean | null = null;

function isDockerAvailable(): boolean {
    if (_dockerAvailable !== null) return _dockerAvailable;
    try {
        execSync("docker info", { stdio: "ignore", timeout: 5000 });
        _dockerAvailable = true;
    } catch {
        _dockerAvailable = false;
    }
    return _dockerAvailable;
}

function buildSafeEnv(): Record<string, string> {
    const safe: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (!value) continue;
        const isSecret = SECRET_PATTERNS.some((p) => p.test(key));
        if (!isSecret) {
            safe[key] = value;
        }
    }
    const basePath = process.env.PATH || "/usr/local/bin:/usr/bin:/bin";
    const extraPaths = ["/root/.bun/bin", "/home/bun/.bun/bin", "/usr/local/bun/bin"];
    const existing = new Set(basePath.split(":"));
    const additions = extraPaths.filter((p) => !existing.has(p));
    safe.PATH = additions.length ? `${additions.join(":")}:${basePath}` : basePath;
    return safe;
}

function resolveWorkspacePath(
    agentId: string,
    relativePath: string,
    organizationId?: string
): string {
    const decoded = decodeURIComponent(relativePath);
    if (isAbsolute(decoded)) {
        throw new Error("Absolute paths are not allowed. Use relative paths within the workspace.");
    }

    const normalized = normalize(decoded);
    if (
        normalized.startsWith("..") ||
        normalized.includes("/../") ||
        normalized.includes("\\..\\") ||
        normalized.includes("/..\\") ||
        normalized.includes("\\../")
    ) {
        throw new Error("Directory traversal is not allowed.");
    }

    const workspaceDir = organizationId
        ? join(WORKSPACE_ROOT, organizationId, agentId)
        : join(WORKSPACE_ROOT, agentId);
    const resolvedPath = resolve(workspaceDir, normalized);
    const workspacePrefix = workspaceDir.endsWith("/") ? workspaceDir : `${workspaceDir}/`;
    if (resolvedPath !== workspaceDir && !resolvedPath.startsWith(workspacePrefix)) {
        throw new Error("Path escapes the agent workspace.");
    }

    return resolvedPath;
}

async function assertNotSymlink(filePath: string): Promise<void> {
    try {
        const stats = await lstat(filePath);
        if (stats.isSymbolicLink()) {
            throw new Error("Symbolic links are not allowed in agent workspaces");
        }
    } catch (err) {
        if (err instanceof Error && err.message.includes("Symbolic links")) throw err;
        // File doesn't exist yet (write operation) — that's fine
    }
}

async function ensureWorkspaceDir(agentId: string, organizationId?: string): Promise<string> {
    const dir = organizationId
        ? join(WORKSPACE_ROOT, organizationId, agentId)
        : join(WORKSPACE_ROOT, agentId);
    await mkdir(dir, { recursive: true });
    return realpath(dir);
}

function truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + `\n...[truncated, ${text.length - maxLen} chars omitted]`;
}

/**
 * Fetch credentials for specified providers from IntegrationConnection table.
 * Returns env var mappings to inject into the container.
 */
async function resolveCredentials(
    providers: string[],
    organizationId?: string
): Promise<Record<string, string>> {
    if (!providers.length) return {};

    const envVars: Record<string, string> = {};

    try {
        const { prisma } = await import("@repo/database");
        const { decryptJson } = await import("../crypto/encryption");

        const connections = await prisma.integrationConnection.findMany({
            where: {
                isActive: true,
                provider: { key: { in: providers } },
                ...(organizationId ? { organizationId } : {})
            },
            include: { provider: true },
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
        });

        const PROVIDER_ENV_MAP: Record<string, Record<string, string>> = {
            digitalocean: { DIGITALOCEAN_ACCESS_TOKEN: "DIGITALOCEAN_ACCESS_TOKEN" },
            supabase: { SUPABASE_ACCESS_TOKEN: "SUPABASE_ACCESS_TOKEN" }
        };

        for (const conn of connections) {
            const providerKey = conn.provider.key;
            const mapping = PROVIDER_ENV_MAP[providerKey];
            if (!mapping) continue;

            const decrypted = decryptJson(conn.credentials);
            if (!decrypted) continue;

            for (const [credKey, envKey] of Object.entries(mapping)) {
                const value = decrypted[credKey] as string | undefined;
                if (value && !envVars[envKey]) {
                    envVars[envKey] = value;
                }
            }
        }
    } catch (err) {
        console.warn("[Sandbox] Failed to resolve credentials:", err);
    }

    return envVars;
}

/**
 * Execute code inside a Docker container.
 */
async function executeInDocker(opts: {
    language: string;
    code: string;
    workspaceDir: string;
    timeoutMs: number;
    networkAccess: boolean;
    credentials: Record<string, string>;
}): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    durationMs: number;
    timedOut: boolean;
}> {
    const { language, code, workspaceDir, timeoutMs, networkAccess, credentials } = opts;
    const startTime = Date.now();

    let shellCommand: string;
    switch (language) {
        case "bash":
            shellCommand = code;
            break;
        case "python": {
            const escaped = code.replace(/'/g, "'\\''");
            shellCommand = `python3 -c '${escaped}'`;
            break;
        }
        case "typescript": {
            const scriptName = `.tmp_exec_${Date.now()}.ts`;
            await writeFile(join(workspaceDir, scriptName), code, "utf-8");
            shellCommand = `bun run ${scriptName}`;
            break;
        }
        default:
            throw new Error(`Unsupported language: ${language}`);
    }

    const dockerArgs = [
        "run",
        "--rm",
        `--memory=${DOCKER_MEMORY_LIMIT}`,
        `--cpus=${DOCKER_CPU_LIMIT}`,
        `--network=${networkAccess ? "bridge" : "none"}`,
        `-v`,
        `${workspaceDir}:/workspace`,
        `--workdir`,
        `/workspace`
    ];

    for (const [key, value] of Object.entries(credentials)) {
        dockerArgs.push("-e", `${key}=${value}`);
    }

    dockerArgs.push(SANDBOX_IMAGE, shellCommand);

    return new Promise((resolve) => {
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        let settled = false;

        const child: ChildProcess = spawn("docker", dockerArgs, {
            timeout: timeoutMs,
            stdio: ["ignore", "pipe", "pipe"]
        });

        child.stdout?.on("data", (data: Buffer) => {
            stdout += data.toString();
            if (stdout.length > MAX_OUTPUT_SIZE * 2) {
                stdout = stdout.slice(0, MAX_OUTPUT_SIZE * 2);
            }
        });

        child.stderr?.on("data", (data: Buffer) => {
            stderr += data.toString();
            if (stderr.length > MAX_OUTPUT_SIZE * 2) {
                stderr = stderr.slice(0, MAX_OUTPUT_SIZE * 2);
            }
        });

        child.on("error", (err: Error) => {
            if (settled) return;
            settled = true;
            if (err.message.includes("ETIMEDOUT") || err.message.includes("killed")) {
                timedOut = true;
            }
            resolve({
                stdout: truncate(stdout, MAX_OUTPUT_SIZE),
                stderr: truncate(
                    stderr +
                        (timedOut
                            ? `\nProcess timed out after ${timeoutMs}ms`
                            : `\nProcess error: ${err.message}`),
                    MAX_OUTPUT_SIZE
                ),
                exitCode: timedOut ? 124 : 1,
                durationMs: Date.now() - startTime,
                timedOut
            });
        });

        child.on("close", (exitCode: number | null) => {
            if (settled) return;
            settled = true;
            resolve({
                stdout: truncate(stdout, MAX_OUTPUT_SIZE),
                stderr: truncate(stderr, MAX_OUTPUT_SIZE),
                exitCode: exitCode ?? 1,
                durationMs: Date.now() - startTime,
                timedOut
            });
        });
    });
}

/**
 * Fallback: execute code via child_process (no Docker).
 */
async function executeWithChildProcess(opts: {
    language: string;
    code: string;
    workspaceDir: string;
    timeoutMs: number;
}): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    durationMs: number;
    timedOut: boolean;
}> {
    const { language, code, workspaceDir, timeoutMs } = opts;
    const startTime = Date.now();

    let command: string;
    let args: string[];

    switch (language) {
        case "bash": {
            command = "/bin/bash";
            args = ["-c", code];
            break;
        }
        case "python": {
            const scriptPath = join(workspaceDir, `.tmp_exec_${Date.now()}.py`);
            await writeFile(scriptPath, code, "utf-8");
            command = "python3";
            args = [scriptPath];
            break;
        }
        case "typescript": {
            const scriptPath = join(workspaceDir, `.tmp_exec_${Date.now()}.ts`);
            await writeFile(scriptPath, code, "utf-8");
            command = "bun";
            args = ["run", scriptPath];
            break;
        }
        default:
            throw new Error(`Unsupported language: ${language}`);
    }

    return new Promise((resolve) => {
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        let settled = false;

        const child: ChildProcess = spawn(command, args, {
            cwd: workspaceDir,
            env: buildSafeEnv() as NodeJS.ProcessEnv,
            timeout: timeoutMs,
            stdio: ["ignore", "pipe", "pipe"]
        });

        child.stdout?.on("data", (data: Buffer) => {
            stdout += data.toString();
            if (stdout.length > MAX_OUTPUT_SIZE * 2) {
                stdout = stdout.slice(0, MAX_OUTPUT_SIZE * 2);
            }
        });

        child.stderr?.on("data", (data: Buffer) => {
            stderr += data.toString();
            if (stderr.length > MAX_OUTPUT_SIZE * 2) {
                stderr = stderr.slice(0, MAX_OUTPUT_SIZE * 2);
            }
        });

        child.on("error", (err: Error) => {
            if (settled) return;
            settled = true;
            if (err.message.includes("ETIMEDOUT") || err.message.includes("killed")) {
                timedOut = true;
            }
            resolve({
                stdout: truncate(stdout, MAX_OUTPUT_SIZE),
                stderr: truncate(
                    stderr +
                        (timedOut
                            ? `\nProcess timed out after ${timeoutMs}ms`
                            : `\nProcess error: ${err.message}`),
                    MAX_OUTPUT_SIZE
                ),
                exitCode: timedOut ? 124 : 1,
                durationMs: Date.now() - startTime,
                timedOut
            });
        });

        child.on("close", (exitCode: number | null) => {
            if (settled) return;
            settled = true;
            resolve({
                stdout: truncate(stdout, MAX_OUTPUT_SIZE),
                stderr: truncate(stderr, MAX_OUTPUT_SIZE),
                exitCode: exitCode ?? 1,
                durationMs: Date.now() - startTime,
                timedOut
            });
        });
    });
}

// ─── execute-code ────────────────────────────────────────────────────────────

export const executeCodeTool = createTool({
    id: "execute-code",
    description:
        "Execute code (bash, Python, or TypeScript) in a Docker-isolated sandbox. " +
        "Returns stdout, stderr, and exit code. Files written during execution persist " +
        "in the agent's workspace directory. Use for data analysis, scripting, " +
        "infrastructure provisioning, or building apps. " +
        "Set networkAccess=true when you need to call external APIs or deploy. " +
        "Set injectCredentials to inject cloud provider tokens (e.g., ['digitalocean', 'supabase']).",
    inputSchema: z.object({
        language: z.enum(["bash", "python", "typescript"]).describe("Language to execute"),
        code: z.string().describe("The code to execute"),
        timeout: z.number().optional().describe("Timeout in seconds (default: 30, max: 120)"),
        agentId: z
            .string()
            .optional()
            .describe("Agent ID for workspace isolation. Defaults to 'default'."),
        organizationId: z
            .string()
            .optional()
            .describe("Organization ID for multi-tenant workspace isolation. Injected at runtime."),
        networkAccess: z
            .boolean()
            .optional()
            .describe(
                "Enable outbound network access. Default false (isolated). " +
                    "Set true when calling APIs, deploying, installing packages, etc."
            ),
        injectCredentials: z
            .array(z.string())
            .optional()
            .describe(
                "Cloud provider keys whose credentials should be injected as env vars. " +
                    "E.g., ['digitalocean', 'supabase']. Credentials are fetched from " +
                    "IntegrationConnection and decrypted at runtime."
            )
    }),
    outputSchema: z.object({
        stdout: z.string(),
        stderr: z.string(),
        exitCode: z.number(),
        durationMs: z.number(),
        timedOut: z.boolean(),
        executionMode: z.string()
    }),
    execute: async ({
        language,
        code,
        timeout,
        agentId,
        organizationId,
        networkAccess,
        injectCredentials
    }) => {
        const effectiveAgentId = agentId || "default";
        const workspaceDir = await ensureWorkspaceDir(effectiveAgentId, organizationId);
        const timeoutMs = Math.min((timeout || 30) * 1000, MAX_TIMEOUT_MS);
        const useNetwork = networkAccess ?? false;
        const providerKeys = injectCredentials ?? [];

        const credentials = providerKeys.length ? await resolveCredentials(providerKeys) : {};

        if (isDockerAvailable()) {
            const result = await executeInDocker({
                language,
                code,
                workspaceDir,
                timeoutMs,
                networkAccess: useNetwork,
                credentials
            });
            return { ...result, executionMode: "docker" };
        }

        if (!ALLOW_UNSANDBOXED_FALLBACK) {
            throw new Error(
                "Docker sandbox is unavailable and unsandboxed fallback is disabled. Enable Docker or explicitly set SANDBOX_ALLOW_UNSANDBOXED_FALLBACK=true in non-production environments."
            );
        }

        if (providerKeys.length && Object.keys(credentials).length) {
            const env = buildSafeEnv();
            Object.assign(env, credentials);
        }

        const result = await executeWithChildProcess({
            language,
            code,
            workspaceDir,
            timeoutMs
        });
        return { ...result, executionMode: "child_process" };
    }
});

// ─── write-workspace-file ────────────────────────────────────────────────────

export const writeWorkspaceFileTool = createTool({
    id: "write-workspace-file",
    description:
        "Write a file to the agent's persistent workspace. Files survive between " +
        "runs. Use for saving scripts, data files, configurations, or any content " +
        "the agent needs to persist. Path is relative to the workspace root. " +
        "HTML files can be previewed in the browser at /api/workspace/{agentId}/{path}.",
    inputSchema: z.object({
        path: z
            .string()
            .describe("Relative path within the workspace (e.g., 'scripts/analyze.py')"),
        content: z.string().describe("File content to write"),
        agentId: z
            .string()
            .optional()
            .describe("Agent ID for workspace isolation. Defaults to 'default'."),
        organizationId: z
            .string()
            .optional()
            .describe("Organization ID for multi-tenant workspace isolation. Injected at runtime.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        path: z.string(),
        size: z.number()
    }),
    execute: async ({ path: relativePath, content, agentId, organizationId }) => {
        const effectiveAgentId = agentId || "default";

        const ext = extname(relativePath).toLowerCase();
        if (!ext || !ALLOWED_WRITE_EXTENSIONS.has(ext)) {
            throw new Error(
                `File extension "${ext}" is not allowed. Permitted extensions: ${[...ALLOWED_WRITE_EXTENSIONS].join(", ")}`
            );
        }

        if (content.length > MAX_FILE_SIZE) {
            throw new Error(
                `File content exceeds maximum size of ${MAX_FILE_SIZE} bytes (${content.length} bytes provided)`
            );
        }

        // Enforce org storage quota if organizationId is available
        if (organizationId) {
            await enforceStorageQuota(organizationId, content.length);
        }

        const resolvedPath = resolveWorkspacePath(effectiveAgentId, relativePath, organizationId);
        await assertNotSymlink(resolvedPath);

        // Check if file already exists (for delta tracking)
        let previousSize = 0;
        try {
            const existing = await stat(resolvedPath);
            previousSize = existing.size;
        } catch {
            // File doesn't exist yet
        }

        const parentDir = join(resolvedPath, "..");
        await mkdir(parentDir, { recursive: true });

        await writeFile(resolvedPath, content, "utf-8");
        const stats = await stat(resolvedPath);

        // Update storage usage tracking
        if (organizationId) {
            await updateStorageUsage(
                organizationId,
                effectiveAgentId,
                stats.size - previousSize,
                previousSize === 0 ? 1 : 0
            );
        }

        return {
            success: true,
            path: relativePath,
            size: stats.size
        };
    }
});

// ─── read-workspace-file ─────────────────────────────────────────────────────

export const readWorkspaceFileTool = createTool({
    id: "read-workspace-file",
    description:
        "Read a file from the agent's persistent workspace. Use to retrieve " +
        "previously saved scripts, data, or configurations.",
    inputSchema: z.object({
        path: z
            .string()
            .describe("Relative path within the workspace (e.g., 'scripts/analyze.py')"),
        agentId: z
            .string()
            .optional()
            .describe("Agent ID for workspace isolation. Defaults to 'default'."),
        organizationId: z
            .string()
            .optional()
            .describe("Organization ID for multi-tenant workspace isolation. Injected at runtime.")
    }),
    outputSchema: z.object({
        content: z.string(),
        size: z.number()
    }),
    execute: async ({ path: relativePath, agentId, organizationId }) => {
        const effectiveAgentId = agentId || "default";
        const resolvedPath = resolveWorkspacePath(effectiveAgentId, relativePath, organizationId);

        try {
            await assertNotSymlink(resolvedPath);
            const content = await readFile(resolvedPath, "utf-8");
            return {
                content: truncate(content, MAX_OUTPUT_SIZE),
                size: content.length
            };
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                throw new Error(`File not found: ${relativePath}`);
            }
            throw err;
        }
    }
});

// ─── list-workspace-files ────────────────────────────────────────────────────

export const listWorkspaceFilesTool = createTool({
    id: "list-workspace-files",
    description:
        "List files in the agent's persistent workspace directory. " +
        "Use to see what files have been saved previously.",
    inputSchema: z.object({
        path: z.string().optional().describe("Relative directory path (default: workspace root)"),
        agentId: z
            .string()
            .optional()
            .describe("Agent ID for workspace isolation. Defaults to 'default'."),
        organizationId: z
            .string()
            .optional()
            .describe("Organization ID for multi-tenant workspace isolation. Injected at runtime.")
    }),
    outputSchema: z.object({
        files: z.array(
            z.object({
                name: z.string(),
                type: z.enum(["file", "directory"]),
                size: z.number().optional()
            })
        )
    }),
    execute: async ({ path: relativePath, agentId, organizationId }) => {
        const effectiveAgentId = agentId || "default";
        const baseDir = organizationId
            ? join(WORKSPACE_ROOT, organizationId, effectiveAgentId)
            : join(WORKSPACE_ROOT, effectiveAgentId);
        const targetDir = relativePath
            ? resolveWorkspacePath(effectiveAgentId, relativePath, organizationId)
            : baseDir;

        try {
            await mkdir(targetDir, { recursive: true });
            const entries = await readdir(targetDir, { withFileTypes: true });

            const files = await Promise.all(
                entries
                    .filter((e) => !e.name.startsWith(".tmp_exec_"))
                    .map(async (entry) => {
                        const entryPath = join(targetDir, entry.name);
                        if (entry.isFile()) {
                            const stats = await stat(entryPath);
                            return {
                                name: entry.name,
                                type: "file" as const,
                                size: stats.size
                            };
                        }
                        return {
                            name: entry.name,
                            type: "directory" as const,
                            size: undefined
                        };
                    })
            );

            return { files };
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                return { files: [] };
            }
            throw err;
        }
    }
});

// ─── Storage quota enforcement ───────────────────────────────────────────────

async function enforceStorageQuota(organizationId: string, newContentSize: number): Promise<void> {
    try {
        const { prisma } = await import("@repo/database");

        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { maxStorageBytes: true }
        });

        if (!org?.maxStorageBytes) return;

        const usage = await prisma.workspaceStorageUsage.aggregate({
            where: { organizationId },
            _sum: { totalBytes: true }
        });

        const currentBytes = Number(usage._sum.totalBytes ?? 0);
        const limitBytes = Number(org.maxStorageBytes);

        if (currentBytes + newContentSize > limitBytes) {
            const usedMB = (currentBytes / 1_048_576).toFixed(1);
            const limitMB = (limitBytes / 1_048_576).toFixed(1);
            throw new Error(
                `Workspace storage quota exceeded (${usedMB} MB / ${limitMB} MB). ` +
                    `Delete old files or request a quota increase.`
            );
        }
    } catch (err) {
        if (err instanceof Error && err.message.includes("quota exceeded")) throw err;
        console.warn("[Sandbox] Storage quota check failed (non-blocking):", err);
    }
}

async function updateStorageUsage(
    organizationId: string,
    agentId: string,
    bytesDelta: number,
    fileCountDelta: number
): Promise<void> {
    try {
        const { prisma } = await import("@repo/database");

        // Resolve agent DB id from slug
        const agent = await prisma.agent.findFirst({
            where: { slug: agentId },
            select: { id: true }
        });

        if (!agent) return;

        await prisma.workspaceStorageUsage.upsert({
            where: {
                organizationId_agentId: {
                    organizationId,
                    agentId: agent.id
                }
            },
            create: {
                organizationId,
                agentId: agent.id,
                totalBytes: BigInt(Math.max(0, bytesDelta)),
                fileCount: Math.max(0, fileCountDelta),
                lastWriteAt: new Date()
            },
            update: {
                totalBytes: { increment: BigInt(bytesDelta) },
                fileCount: { increment: fileCountDelta },
                lastWriteAt: new Date()
            }
        });
    } catch (err) {
        console.warn("[Sandbox] Storage usage update failed (non-blocking):", err);
    }
}

// ─── Workspace tool binding ──────────────────────────────────────────────────

const WORKSPACE_TOOL_IDS = new Set([
    "execute-code",
    "write-workspace-file",
    "read-workspace-file",
    "list-workspace-files"
]);

const ORG_SCOPED_TOOL_IDS = new Set([
    "rag-query",
    "rag-ingest",
    "document-create",
    "document-read",
    "document-update",
    "document-delete",
    "document-list",
    "document-search",
    "memory-recall"
]);

/**
 * Wraps a sandbox tool with pre-bound organizationId and agentId so the LLM
 * doesn't need to provide them. Called by the agent resolver at hydration time.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bindWorkspaceContext(
    tool: any,
    context: { organizationId: string; agentId: string }
) {
    if (!tool?.id) return tool;

    if (WORKSPACE_TOOL_IDS.has(tool.id)) {
        const originalExecute = tool.execute;
        return {
            ...tool,
            execute: (input: Record<string, unknown>) => {
                return originalExecute({
                    ...input,
                    organizationId: input.organizationId || context.organizationId,
                    agentId: input.agentId || context.agentId
                });
            }
        };
    }

    if (ORG_SCOPED_TOOL_IDS.has(tool.id)) {
        const originalExecute = tool.execute;
        return {
            ...tool,
            execute: (input: Record<string, unknown>) => {
                return originalExecute({
                    ...input,
                    organizationId: input.organizationId || context.organizationId
                });
            }
        };
    }

    return tool;
}
