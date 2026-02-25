"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AgentC2Logo } from "@repo/ui";
import { LoaderIcon } from "lucide-react";

interface WorkflowEmbedConfig {
    theme: "dark" | "light";
    showToolActivity: boolean;
    poweredByBadge: boolean;
}

interface WorkflowEmbedData {
    slug: string;
    name: string;
    description: string | null;
    inputSchema: Record<string, unknown> | null;
    outputSchema: Record<string, unknown> | null;
    config: WorkflowEmbedConfig;
}

function WorkflowEmbedInner() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const slug = typeof window !== "undefined" ? window.location.pathname.split("/").pop() : "";

    const [embedData, setEmbedData] = useState<WorkflowEmbedData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [inputValues, setInputValues] = useState<Record<string, string>>({});
    const [running, setRunning] = useState(false);
    const [output, setOutput] = useState<unknown>(null);
    const [runError, setRunError] = useState<string | null>(null);

    useEffect(() => {
        if (!token || !slug) return;

        fetch(`/api/workflows/${slug}/embed?token=${token}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.slug) {
                    setEmbedData(data);
                    // Initialize input fields from schema
                    if (data.inputSchema?.properties) {
                        const initial: Record<string, string> = {};
                        for (const key of Object.keys(
                            data.inputSchema.properties as Record<string, unknown>
                        )) {
                            initial[key] = "";
                        }
                        setInputValues(initial);
                    }
                } else {
                    setError(data.error || "Failed to load workflow");
                }
            })
            .catch(() => setError("Failed to load workflow"))
            .finally(() => setLoading(false));
    }, [token, slug]);

    const handleRun = async () => {
        if (!embedData || !token) return;
        setRunning(true);
        setOutput(null);
        setRunError(null);

        try {
            const input =
                Object.keys(inputValues).length > 0
                    ? inputValues
                    : { input: inputValues[""] || "" };
            const res = await fetch(`/api/workflows/${embedData.slug}/execute/public`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ input })
            });
            const data = await res.json();
            if (data.success) {
                setOutput(data.output);
            } else {
                setRunError(data.error || "Execution failed");
            }
        } catch {
            setRunError("Failed to execute workflow");
        } finally {
            setRunning(false);
        }
    };

    if (!token) {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
                <p className="text-zinc-400">Missing token parameter</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
                <LoaderIcon className="size-5 animate-spin text-zinc-500" />
            </div>
        );
    }

    if (error || !embedData) {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
                <p className="text-zinc-400">{error || "Workflow not found"}</p>
            </div>
        );
    }

    const inputSchema = embedData.inputSchema as {
        properties?: Record<string, { type?: string; description?: string }>;
        required?: string[];
    } | null;

    const fields = inputSchema?.properties ? Object.entries(inputSchema.properties) : [];
    const hasFields = fields.length > 0;

    return (
        <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <div>
                    <h1 className="text-sm font-semibold">{embedData.name}</h1>
                    {embedData.description && (
                        <p className="text-xs text-zinc-400">{embedData.description}</p>
                    )}
                </div>
                {embedData.config.poweredByBadge && (
                    <a
                        href="https://agentc2.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-zinc-500 transition-colors hover:text-zinc-300"
                    >
                        <span className="text-[10px]">Powered by</span>
                        <AgentC2Logo className="h-3.5" />
                    </a>
                )}
            </div>

            {/* Main Content */}
            <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
                {/* Input Fields */}
                {hasFields ? (
                    <div className="space-y-3">
                        {fields.map(([key, schema]) => (
                            <div key={key} className="space-y-1">
                                <label className="text-xs font-medium text-zinc-300">
                                    {key}
                                    {inputSchema?.required?.includes(key) && (
                                        <span className="ml-0.5 text-red-400">*</span>
                                    )}
                                </label>
                                {schema.description && (
                                    <p className="text-[11px] text-zinc-500">
                                        {schema.description}
                                    </p>
                                )}
                                {schema.type === "string" &&
                                (schema.description?.toLowerCase().includes("text") ||
                                    key.toLowerCase().includes("content") ||
                                    key.toLowerCase().includes("message")) ? (
                                    <textarea
                                        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                                        rows={3}
                                        placeholder={`Enter ${key}...`}
                                        value={inputValues[key] || ""}
                                        onChange={(e) =>
                                            setInputValues((prev) => ({
                                                ...prev,
                                                [key]: e.target.value
                                            }))
                                        }
                                    />
                                ) : (
                                    <input
                                        type={
                                            schema.type === "number" || schema.type === "integer"
                                                ? "number"
                                                : "text"
                                        }
                                        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                                        placeholder={`Enter ${key}...`}
                                        value={inputValues[key] || ""}
                                        onChange={(e) =>
                                            setInputValues((prev) => ({
                                                ...prev,
                                                [key]: e.target.value
                                            }))
                                        }
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-300">Input</label>
                        <textarea
                            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                            rows={3}
                            placeholder="Enter input..."
                            value={inputValues[""] || ""}
                            onChange={(e) =>
                                setInputValues((prev) => ({
                                    ...prev,
                                    "": e.target.value
                                }))
                            }
                        />
                    </div>
                )}

                {/* Run Button */}
                <button
                    onClick={handleRun}
                    disabled={running}
                    className="flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
                >
                    {running && <LoaderIcon className="size-4 animate-spin" />}
                    {running ? "Running..." : "Run Workflow"}
                </button>

                {/* Error */}
                {runError && (
                    <div className="rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">
                        {runError}
                    </div>
                )}

                {/* Output */}
                {output !== null && (
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-300">Output</label>
                        <pre className="max-h-80 overflow-auto rounded-md border border-zinc-700 bg-zinc-900 p-3 font-mono text-xs text-zinc-200">
                            {typeof output === "string" ? output : JSON.stringify(output, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function WorkflowEmbedPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
                    <LoaderIcon className="size-5 animate-spin text-zinc-500" />
                </div>
            }
        >
            <WorkflowEmbedInner />
        </Suspense>
    );
}
