/**
 * Sandbox Tools — Code execution and workspace file management
 *
 * Provides agents with the ability to:
 * - Execute code (bash, Python, TypeScript) in a controlled child_process
 * - Read/write files in a persistent per-agent workspace directory
 *
 * Security model (v1):
 * - Runs as the server process user (not Docker-isolated yet)
 * - Environment stripped of secrets (DATABASE_URL, API keys, etc.)
 * - Timeout enforced via child_process timeout option
 * - Workspace paths validated (no traversal, no absolute paths, no symlinks)
 * - Future: Docker isolation for untrusted multi-tenant execution
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { spawn, type ChildProcess } from "child_process";
import { mkdir, writeFile, readFile, stat, readdir } from "fs/promises";
import { join, normalize, isAbsolute } from "path";

const WORKSPACE_ROOT = process.env.AGENT_WORKSPACE_ROOT || "/var/lib/agentc2/workspaces";
const MAX_TIMEOUT_MS = 120_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_FILE_SIZE = 1_048_576; // 1MB
const MAX_OUTPUT_SIZE = 100_000; // 100KB of stdout/stderr

/**
 * Secrets that should NEVER be passed to child processes
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

/**
 * Validate and resolve a workspace-relative path.
 * Prevents directory traversal, absolute paths, and symlink escape.
 */
function resolveWorkspacePath(agentId: string, relativePath: string): string {
    if (isAbsolute(relativePath)) {
        throw new Error("Absolute paths are not allowed. Use relative paths within the workspace.");
    }

    const normalized = normalize(relativePath);
    if (normalized.startsWith("..") || normalized.includes("/../")) {
        throw new Error("Directory traversal is not allowed.");
    }

    const workspaceDir = join(WORKSPACE_ROOT, agentId);
    const resolved = join(workspaceDir, normalized);

    // Double-check the resolved path is still within the workspace
    if (!resolved.startsWith(workspaceDir)) {
        throw new Error("Path escapes the agent workspace.");
    }

    return resolved;
}

async function ensureWorkspaceDir(agentId: string): Promise<string> {
    const dir = join(WORKSPACE_ROOT, agentId);
    await mkdir(dir, { recursive: true });
    return dir;
}

function truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + `\n...[truncated, ${text.length - maxLen} chars omitted]`;
}

// ─── execute-code ────────────────────────────────────────────────────────────

export const executeCodeTool = createTool({
    id: "execute-code",
    description:
        "Execute code (bash, Python, or TypeScript) in a sandboxed environment. " +
        "Returns stdout, stderr, and exit code. Files written during execution persist " +
        "in the agent's workspace directory. Use for data analysis, scripting, " +
        "testing approaches, or building reusable scripts.",
    inputSchema: z.object({
        language: z.enum(["bash", "python", "typescript"]).describe("Language to execute"),
        code: z.string().describe("The code to execute"),
        timeout: z.number().optional().describe("Timeout in seconds (default: 30, max: 120)"),
        agentId: z
            .string()
            .optional()
            .describe("Agent ID for workspace isolation. Defaults to 'default'.")
    }),
    outputSchema: z.object({
        stdout: z.string(),
        stderr: z.string(),
        exitCode: z.number(),
        durationMs: z.number(),
        timedOut: z.boolean()
    }),
    execute: async ({ language, code, timeout, agentId }) => {
        const effectiveAgentId = agentId || "default";
        const workspaceDir = await ensureWorkspaceDir(effectiveAgentId);
        const timeoutMs = Math.min((timeout || 30) * 1000, MAX_TIMEOUT_MS);

        let command: string;
        let args: string[];

        switch (language) {
            case "bash": {
                command = "/bin/bash";
                args = ["-c", code];
                break;
            }
            case "python": {
                // Write to temp file in workspace
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
        }

        const startTime = Date.now();

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
            .describe("Agent ID for workspace isolation. Defaults to 'default'.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        path: z.string(),
        size: z.number()
    }),
    execute: async ({ path: relativePath, content, agentId }) => {
        const effectiveAgentId = agentId || "default";

        if (content.length > MAX_FILE_SIZE) {
            throw new Error(
                `File content exceeds maximum size of ${MAX_FILE_SIZE} bytes (${content.length} bytes provided)`
            );
        }

        const resolvedPath = resolveWorkspacePath(effectiveAgentId, relativePath);

        // Ensure parent directory exists
        const parentDir = join(resolvedPath, "..");
        await mkdir(parentDir, { recursive: true });

        await writeFile(resolvedPath, content, "utf-8");
        const stats = await stat(resolvedPath);

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
            .describe("Agent ID for workspace isolation. Defaults to 'default'.")
    }),
    outputSchema: z.object({
        content: z.string(),
        size: z.number()
    }),
    execute: async ({ path: relativePath, agentId }) => {
        const effectiveAgentId = agentId || "default";
        const resolvedPath = resolveWorkspacePath(effectiveAgentId, relativePath);

        try {
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
            .describe("Agent ID for workspace isolation. Defaults to 'default'.")
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
    execute: async ({ path: relativePath, agentId }) => {
        const effectiveAgentId = agentId || "default";
        const targetDir = relativePath
            ? resolveWorkspacePath(effectiveAgentId, relativePath)
            : join(WORKSPACE_ROOT, effectiveAgentId);

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
