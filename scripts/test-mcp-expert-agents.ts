#!/usr/bin/env bun
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type ParsedArgs = {
    baseUrl: string;
    concurrency: number;
    outputDir: string;
    maxSteps: number;
    includeInactive: boolean;
};

type McpTool = {
    name: string;
    description?: string;
    metadata?: Record<string, unknown>;
};

type McpListResponse = {
    success: boolean;
    tools: McpTool[];
    total: number;
};

type McpInvokeResponse = {
    success: boolean;
    result?: {
        run_id: string;
        output: string;
        usage: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
        } | null;
        cost_usd: number | null;
        duration_ms: number | null;
        model: string;
    };
    error?: string;
    run_id?: string;
};

type RunResponse = {
    success: boolean;
    run?: {
        id: string;
        status: string;
        durationMs: number | null;
        outputText: string | null;
        promptTokens: number | null;
        completionTokens: number | null;
        totalTokens: number | null;
        costUsd: number | null;
        _count?: { toolCalls: number };
    };
};

type TraceResponse = {
    success: boolean;
    trace?: {
        status: string;
        durationMs: number | null;
        toolCalls: Array<{
            toolKey: string;
            success: boolean;
            error?: string | null;
            durationMs?: number | null;
        }>;
    };
};

type ToolCallSummary = {
    toolKey: string;
    success: boolean;
    error?: string;
    durationMs?: number | null;
};

type TestResult = {
    agentSlug: string;
    serverId: string;
    prompt: string;
    runId?: string;
    runStatus?: string;
    durationMs?: number | null;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    costUsd?: number | null;
    toolCalls: ToolCallSummary[];
    errors: string[];
};

const REQUIRE_TOOL_CALLS = true;

const usage = `Usage:
  bun run scripts/test-mcp-expert-agents.ts [options]

Options:
  --base-url <url>        MCP gateway base URL (default: http://localhost:3001)
  --concurrency <number>  Parallel tests (default: 2, max: 6)
  --output-dir <path>     Output directory (default: reports)
  --max-steps <number>    Max steps per agent invocation (default: 5)
  --include-inactive      Include inactive agents from /api/mcp
`;

const EXPECTED_SERVER_IDS = [
    "playwright",
    "firecrawl",
    "hubspot",
    "jira",
    "justcall",
    "atlas",
    "fathom",
    "slack",
    "gdrive",
    "github"
];

const PROMPTS_BY_SERVER: Record<string, string[]> = {
    playwright: ["Open https://example.com and return the page title."],
    firecrawl: ["Fetch https://example.com and summarize the main headings."],
    hubspot: ["List up to 5 recent contacts with name and email."],
    jira: ["List available Jira projects and include their keys."],
    justcall: ["List the 5 most recent calls with timestamps."],
    atlas: ["List available automation tools or workflows you can run."],
    fathom: ["List the 5 most recent meetings and their titles."],
    slack: ["List 5 public channels in this workspace."],
    gdrive: ["List the 5 most recent files in Drive with names."],
    github: ["List up to 5 repositories you have access to."]
};

function parseArgs(): ParsedArgs {
    const args = process.argv.slice(2);
    const values = new Map<string, string | boolean>();

    for (let i = 0; i < args.length; i += 1) {
        const raw = args[i];
        if (!raw.startsWith("--")) continue;

        const [key, inlineValue] = raw.slice(2).split("=");
        if (inlineValue !== undefined) {
            values.set(key, inlineValue);
            continue;
        }

        const next = args[i + 1];
        if (next && !next.startsWith("--")) {
            values.set(key, next);
            i += 1;
        } else {
            values.set(key, true);
        }
    }

    if (values.has("help")) {
        console.log(usage);
        process.exit(0);
    }

    const baseUrl = String(values.get("base-url") || "http://localhost:3001").replace(/\/$/, "");
    const concurrency = Math.max(1, Math.min(6, Number(values.get("concurrency") || 2)));
    const outputDir = String(values.get("output-dir") || "reports");
    const maxSteps = Math.max(1, Number(values.get("max-steps") || 5));
    const includeInactive = Boolean(values.get("include-inactive"));

    return { baseUrl, concurrency, outputDir, maxSteps, includeInactive };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`Request failed ${response.status} ${response.statusText}: ${text}`);
    }
    if (!text) {
        return {} as T;
    }
    return JSON.parse(text) as T;
}

function getServerIdFromSlug(slug: string): string | null {
    if (!slug.startsWith("mcp-") || !slug.endsWith("-expert")) return null;
    return slug.slice(4, -7);
}

function percentile(values: number[], p: number): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

async function runWithConcurrency<T>(
    tasks: Array<() => Promise<T>>,
    concurrency: number
): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let index = 0;

    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
        while (index < tasks.length) {
            const current = index;
            index += 1;
            results[current] = await tasks[current]();
        }
    });

    await Promise.all(workers);
    return results;
}

async function main() {
    const { baseUrl, concurrency, outputDir, maxSteps, includeInactive } = parseArgs();

    console.log("MCP expert performance testing");
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Concurrency: ${concurrency}`);
    console.log(`Output directory: ${outputDir}`);
    console.log(`Max steps: ${maxSteps}\n`);

    const listUrl = new URL("/api/mcp", baseUrl);
    if (includeInactive) {
        listUrl.searchParams.set("includeInactive", "true");
    }

    const listResponse = await fetchJson<McpListResponse>(listUrl.toString());
    if (!listResponse.success) {
        throw new Error("Failed to list MCP tools from gateway");
    }

    const expertTools = listResponse.tools.filter(
        (tool) => tool.name.startsWith("agent.mcp-") && tool.name.endsWith("-expert")
    );

    const expertAgents = expertTools
        .map((tool) => {
            const slug = tool.name.replace("agent.", "");
            const serverId = getServerIdFromSlug(slug);
            return serverId
                ? { toolName: tool.name, agentSlug: slug, serverId, description: tool.description }
                : null;
        })
        .filter((entry): entry is { toolName: string; agentSlug: string; serverId: string } =>
            Boolean(entry)
        )
        .sort((a, b) => a.serverId.localeCompare(b.serverId));

    if (expertAgents.length === 0) {
        throw new Error("No MCP expert agents found via /api/mcp");
    }

    const foundServerIds = new Set(expertAgents.map((agent) => agent.serverId));
    const missingServers = EXPECTED_SERVER_IDS.filter((id) => !foundServerIds.has(id));
    const extraServers = Array.from(foundServerIds).filter(
        (id) => !EXPECTED_SERVER_IDS.includes(id)
    );

    if (missingServers.length > 0) {
        console.log(`Warning: Missing MCP expert agents for: ${missingServers.join(", ")}`);
    }
    if (extraServers.length > 0) {
        console.log(`Warning: Extra MCP expert agents found for: ${extraServers.join(", ")}`);
    }

    const tests = expertAgents.flatMap((agent) => {
        const prompts = PROMPTS_BY_SERVER[agent.serverId] || [
            "Describe the tools you can use and provide a safe read-only example."
        ];
        return prompts.map((prompt, index) => ({
            id: `${agent.agentSlug}-${index + 1}`,
            agentSlug: agent.agentSlug,
            toolName: agent.toolName,
            serverId: agent.serverId,
            prompt
        }));
    });

    console.log(`\nRunning ${tests.length} tests across ${expertAgents.length} agents...\n`);

    const tasks = tests.map((test) => async () => {
        const errors: string[] = [];
        const invokeUrl = new URL("/api/mcp", baseUrl).toString();

        let invokeResponse: McpInvokeResponse | null = null;
        try {
            invokeResponse = await fetchJson<McpInvokeResponse>(invokeUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    method: "invoke",
                    tool: test.toolName,
                    params: {
                        input: test.prompt,
                        maxSteps
                    }
                })
            });
        } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
        }

        if (!invokeResponse || !invokeResponse.success || !invokeResponse.result) {
            return {
                agentSlug: test.agentSlug,
                serverId: test.serverId,
                prompt: test.prompt,
                toolCalls: [],
                errors: errors.length ? errors : [invokeResponse?.error || "Invocation failed"]
            } satisfies TestResult;
        }

        const runId = invokeResponse.result.run_id;
        const usage = invokeResponse.result.usage;
        const costUsd = invokeResponse.result.cost_usd ?? null;
        const invokeDuration = invokeResponse.result.duration_ms ?? null;

        let runStatus: string | undefined;
        let runDuration: number | null | undefined;
        let outputText: string | null | undefined;
        let toolCalls: ToolCallSummary[] = [];

        try {
            const runUrl = new URL(`/api/agents/${test.agentSlug}/runs/${runId}`, baseUrl);
            const runResponse = await fetchJson<RunResponse>(runUrl.toString());
            runStatus = runResponse.run?.status;
            runDuration = runResponse.run?.durationMs ?? null;
            outputText = runResponse.run?.outputText ?? null;
        } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
        }

        try {
            const traceUrl = new URL(`/api/agents/${test.agentSlug}/runs/${runId}/trace`, baseUrl);
            const traceResponse = await fetchJson<TraceResponse>(traceUrl.toString());
            toolCalls =
                traceResponse.trace?.toolCalls?.map((call) => ({
                    toolKey: call.toolKey,
                    success: call.success,
                    error: call.error ?? undefined,
                    durationMs: call.durationMs ?? null
                })) || [];
        } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
        }

        if (REQUIRE_TOOL_CALLS && toolCalls.length === 0) {
            errors.push("No tool calls recorded");
            if (runStatus === "COMPLETED") {
                runStatus = "FAILED";
            }
        }

        if (runStatus === "FAILED" && outputText) {
            errors.push(outputText);
        }

        toolCalls.forEach((call) => {
            if (call.error) errors.push(call.error);
        });

        return {
            agentSlug: test.agentSlug,
            serverId: test.serverId,
            prompt: test.prompt,
            runId,
            runStatus,
            durationMs: runDuration ?? invokeDuration,
            usage: usage
                ? {
                      promptTokens: usage.prompt_tokens,
                      completionTokens: usage.completion_tokens,
                      totalTokens: usage.total_tokens
                  }
                : undefined,
            costUsd,
            toolCalls,
            errors
        } satisfies TestResult;
    });

    const results = await runWithConcurrency(tasks, concurrency);

    const reportsByAgent = new Map<string, TestResult[]>();
    for (const result of results) {
        if (!reportsByAgent.has(result.agentSlug)) {
            reportsByAgent.set(result.agentSlug, []);
        }
        reportsByAgent.get(result.agentSlug)!.push(result);
    }

    const agentReports = Array.from(reportsByAgent.entries()).map(([agentSlug, runs]) => {
        const serverId = runs[0]?.serverId || "unknown";
        const totalRuns = runs.length;
        const completed = runs.filter((run) => run.runStatus === "COMPLETED");
        const successRate = totalRuns > 0 ? completed.length / totalRuns : 0;

        const durations = runs
            .map((run) => run.durationMs)
            .filter((value): value is number => typeof value === "number");

        const avgDuration =
            durations.length > 0
                ? durations.reduce((sum, value) => sum + value, 0) / durations.length
                : null;

        const p95Duration = percentile(durations, 95);

        const usageTotals = runs.reduce(
            (acc, run) => {
                acc.prompt += run.usage?.promptTokens || 0;
                acc.completion += run.usage?.completionTokens || 0;
                acc.total += run.usage?.totalTokens || 0;
                return acc;
            },
            { prompt: 0, completion: 0, total: 0 }
        );

        const avgUsage =
            totalRuns > 0
                ? {
                      prompt: usageTotals.prompt / totalRuns,
                      completion: usageTotals.completion / totalRuns,
                      total: usageTotals.total / totalRuns
                  }
                : null;

        const costTotals = runs.reduce((sum, run) => sum + (run.costUsd || 0), 0);
        const avgCost = totalRuns > 0 ? costTotals / totalRuns : null;

        const toolCalls = runs.flatMap((run) => run.toolCalls);
        const toolSuccessCount = toolCalls.filter((call) => call.success).length;
        const toolSuccessRate = toolCalls.length > 0 ? toolSuccessCount / toolCalls.length : null;

        const toolUsageCounts = toolCalls.reduce<Record<string, number>>((acc, call) => {
            acc[call.toolKey] = (acc[call.toolKey] || 0) + 1;
            return acc;
        }, {});

        const topTools = Object.entries(toolUsageCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([tool, count]) => ({ tool, count }));

        const errorCounts = runs
            .flatMap((run) => run.errors)
            .reduce<Record<string, number>>((acc, error) => {
                const key = error.trim();
                if (!key) return acc;
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});

        const topErrors = Object.entries(errorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([message, count]) => ({ message, count }));

        return {
            agentSlug,
            serverId,
            totalRuns,
            successRate,
            avgDurationMs: avgDuration,
            p95DurationMs: p95Duration,
            usageTotals,
            avgUsage,
            costTotalsUsd: costTotals,
            avgCostUsd: avgCost,
            toolCallCount: toolCalls.length,
            toolSuccessRate,
            topTools,
            topErrors,
            runs
        };
    });

    const reportPayload = {
        generatedAt: new Date().toISOString(),
        baseUrl,
        totalAgents: agentReports.length,
        totalTests: results.length,
        agents: agentReports
    };

    await mkdir(outputDir, { recursive: true });
    const jsonPath = resolve(outputDir, "mcp-expert-performance.json");
    await writeFile(jsonPath, JSON.stringify(reportPayload, null, 2), "utf-8");

    const markdownLines = [
        "# MCP Expert Performance Report",
        "",
        `Generated at: ${reportPayload.generatedAt}`,
        `Base URL: ${baseUrl}`,
        "",
        `Total agents: ${reportPayload.totalAgents}`,
        `Total tests: ${reportPayload.totalTests}`,
        ""
    ];

    for (const agent of agentReports) {
        markdownLines.push(`## ${agent.agentSlug}`);
        markdownLines.push("");
        markdownLines.push(`Server: ${agent.serverId}`);
        markdownLines.push(`Total runs: ${agent.totalRuns}`);
        markdownLines.push(
            `Success rate: ${(agent.successRate * 100).toFixed(1)}% (${Math.round(
                agent.successRate * agent.totalRuns
            )}/${agent.totalRuns})`
        );
        markdownLines.push(
            `Duration avg/p95 (ms): ${agent.avgDurationMs?.toFixed(0) || "n/a"} / ${
                agent.p95DurationMs ?? "n/a"
            }`
        );
        markdownLines.push(
            `Tokens avg (prompt/completion/total): ${
                agent.avgUsage
                    ? `${agent.avgUsage.prompt.toFixed(0)} / ${agent.avgUsage.completion.toFixed(
                          0
                      )} / ${agent.avgUsage.total.toFixed(0)}`
                    : "n/a"
            }`
        );
        markdownLines.push(
            `Cost total/avg (USD): ${agent.costTotalsUsd.toFixed(4)} / ${
                agent.avgCostUsd?.toFixed(4) ?? "n/a"
            }`
        );
        markdownLines.push(
            `Tool calls: ${agent.toolCallCount} (success rate ${
                agent.toolSuccessRate !== null
                    ? `${(agent.toolSuccessRate * 100).toFixed(1)}%`
                    : "n/a"
            })`
        );

        if (agent.topTools.length > 0) {
            markdownLines.push(
                `Top tools: ${agent.topTools.map((tool) => `${tool.tool} (${tool.count})`).join(", ")}`
            );
        } else {
            markdownLines.push("Top tools: n/a");
        }

        if (agent.topErrors.length > 0) {
            markdownLines.push(
                `Top errors: ${agent.topErrors
                    .map((error) => `${error.message} (${error.count})`)
                    .join("; ")}`
            );
        } else {
            markdownLines.push("Top errors: none");
        }

        markdownLines.push("");
        markdownLines.push(
            "| Prompt | Run status | Duration (ms) | Cost (USD) | Tool calls | Errors |"
        );
        markdownLines.push("| --- | --- | --- | --- | --- | --- |");
        for (const run of agent.runs) {
            markdownLines.push(
                `| ${run.prompt.replace(/\|/g, "\\|")} | ${run.runStatus || "unknown"} | ${
                    run.durationMs ?? "n/a"
                } | ${run.costUsd ?? "n/a"} | ${run.toolCalls.length} | ${
                    run.errors.length > 0 ? run.errors[0].replace(/\|/g, "\\|") : ""
                } |`
            );
        }
        markdownLines.push("");
    }

    const markdownPath = resolve(outputDir, "mcp-expert-performance.md");
    await writeFile(markdownPath, markdownLines.join("\n"), "utf-8");

    console.log(`Report saved to ${jsonPath}`);
    console.log(`Report saved to ${markdownPath}`);
}

main().catch((error) => {
    console.error("MCP expert performance testing failed:", error);
    process.exit(1);
});
