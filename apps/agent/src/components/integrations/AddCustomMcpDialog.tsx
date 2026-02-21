"use client";

import { useState, useCallback } from "react";
import { getApiBase } from "@/lib/utils";
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Input,
    Label,
    Badge
} from "@repo/ui";
import {
    PlusIcon,
    TrashIcon,
    Loader2Icon,
    CheckCircleIcon,
    XCircleIcon,
    ServerIcon
} from "lucide-react";

interface EnvVar {
    key: string;
    value: string;
}

interface TestResult {
    success: boolean;
    phases?: Array<{ name: string; status: string; detail?: string }>;
    error?: string;
}

interface ImpactResult {
    agents?: Array<{ slug: string; name: string; newTools: number }>;
    totalNewTools?: number;
}

export function AddCustomMcpDialog({ onSuccess }: { onSuccess?: () => void }) {
    const [open, setOpen] = useState(false);
    const [serverName, setServerName] = useState("");
    const [transportType, setTransportType] = useState<"stdio" | "sse">("sse");
    const [sseUrl, setSseUrl] = useState("");
    const [command, setCommand] = useState("");
    const [args, setArgs] = useState<string[]>([""]);
    const [envVars, setEnvVars] = useState<EnvVar[]>([{ key: "", value: "" }]);

    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [saving, setSaving] = useState(false);
    const [impact, setImpact] = useState<ImpactResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const resetForm = useCallback(() => {
        setServerName("");
        setTransportType("sse");
        setSseUrl("");
        setCommand("");
        setArgs([""]);
        setEnvVars([{ key: "", value: "" }]);
        setTestResult(null);
        setImpact(null);
        setError(null);
    }, []);

    const buildConfig = useCallback(() => {
        const key = serverName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        if (transportType === "sse") {
            return {
                mcpServers: {
                    [key]: { url: sseUrl }
                }
            };
        }

        const env: Record<string, string> = {};
        for (const v of envVars) {
            if (v.key.trim() && v.value.trim()) {
                env[v.key.trim()] = v.value.trim();
            }
        }

        return {
            mcpServers: {
                [key]: {
                    command,
                    args: args.filter((a) => a.trim()),
                    ...(Object.keys(env).length > 0 ? { env } : {})
                }
            }
        };
    }, [serverName, transportType, sseUrl, command, args, envVars]);

    const handleTest = useCallback(async () => {
        setTesting(true);
        setTestResult(null);
        setError(null);
        try {
            const config = buildConfig();
            const serverKey = Object.keys(config.mcpServers)[0];

            const res = await fetch(`${getApiBase()}/api/integrations/mcp-config/test`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    serverKey,
                    serverConfig: config.mcpServers[serverKey]
                })
            });
            const data = await res.json();
            setTestResult(data);
        } catch (e) {
            setTestResult({
                success: false,
                error: e instanceof Error ? e.message : "Test failed"
            });
        } finally {
            setTesting(false);
        }
    }, [buildConfig]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        setError(null);
        try {
            const config = buildConfig();

            // Check impact first
            const impactRes = await fetch(`${getApiBase()}/api/integrations/mcp-config/impact`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(config)
            });
            const impactData = await impactRes.json();
            if (impactData.success) {
                setImpact(impactData);
            }

            // Import the config
            const res = await fetch(`${getApiBase()}/api/integrations/mcp-config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(config)
            });
            const data = await res.json();

            if (!data.success) {
                setError(data.error || "Failed to save MCP server");
                return;
            }

            onSuccess?.();
            setOpen(false);
            resetForm();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
        }
    }, [buildConfig, onSuccess, resetForm]);

    const isValid = serverName.trim() && (transportType === "sse" ? sseUrl.trim() : command.trim());

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                setOpen(v);
                if (!v) resetForm();
            }}
        >
            <DialogTrigger>
                <Button variant="outline" size="sm" className="gap-1.5">
                    <PlusIcon className="size-3.5" />
                    Add Custom Server
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ServerIcon className="size-4" />
                        Add Custom MCP Server
                    </DialogTitle>
                    <DialogDescription>
                        Connect a custom MCP server using SSE or stdio transport.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Server Name</Label>
                        <Input
                            placeholder="e.g. My Custom Server"
                            value={serverName}
                            onChange={(e) => setServerName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Transport Type</Label>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant={transportType === "sse" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setTransportType("sse")}
                            >
                                SSE (URL)
                            </Button>
                            <Button
                                type="button"
                                variant={transportType === "stdio" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setTransportType("stdio")}
                            >
                                stdio (Command)
                            </Button>
                        </div>
                    </div>

                    {transportType === "sse" ? (
                        <div className="space-y-2">
                            <Label>Server URL</Label>
                            <Input
                                placeholder="https://example.com/mcp/sse"
                                value={sseUrl}
                                onChange={(e) => setSseUrl(e.target.value)}
                            />
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label>Command</Label>
                                <Input
                                    placeholder="npx"
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Arguments</Label>
                                {args.map((arg, i) => (
                                    <div key={i} className="flex gap-2">
                                        <Input
                                            placeholder={`arg ${i + 1}`}
                                            value={arg}
                                            onChange={(e) => {
                                                const next = [...args];
                                                next[i] = e.target.value;
                                                setArgs(next);
                                            }}
                                        />
                                        {args.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-9 shrink-0"
                                                onClick={() =>
                                                    setArgs(args.filter((_, j) => j !== i))
                                                }
                                            >
                                                <TrashIcon className="size-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1"
                                    onClick={() => setArgs([...args, ""])}
                                >
                                    <PlusIcon className="size-3" />
                                    Add Argument
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label>Environment Variables</Label>
                                {envVars.map((ev, i) => (
                                    <div key={i} className="flex gap-2">
                                        <Input
                                            placeholder="KEY"
                                            className="font-mono"
                                            value={ev.key}
                                            onChange={(e) => {
                                                const next = [...envVars];
                                                next[i] = { ...next[i], key: e.target.value };
                                                setEnvVars(next);
                                            }}
                                        />
                                        <Input
                                            placeholder="value"
                                            type="password"
                                            value={ev.value}
                                            onChange={(e) => {
                                                const next = [...envVars];
                                                next[i] = { ...next[i], value: e.target.value };
                                                setEnvVars(next);
                                            }}
                                        />
                                        {envVars.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-9 shrink-0"
                                                onClick={() =>
                                                    setEnvVars(envVars.filter((_, j) => j !== i))
                                                }
                                            >
                                                <TrashIcon className="size-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1"
                                    onClick={() => setEnvVars([...envVars, { key: "", value: "" }])}
                                >
                                    <PlusIcon className="size-3" />
                                    Add Variable
                                </Button>
                            </div>
                        </>
                    )}

                    {testResult && (
                        <div
                            className={`rounded-md border p-3 text-sm ${testResult.success ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}
                        >
                            <div className="flex items-center gap-2 font-medium">
                                {testResult.success ? (
                                    <>
                                        <CheckCircleIcon className="size-4 text-green-600" />
                                        Connection Successful
                                    </>
                                ) : (
                                    <>
                                        <XCircleIcon className="size-4 text-red-500" />
                                        Connection Failed
                                    </>
                                )}
                            </div>
                            {testResult.error && (
                                <p className="text-muted-foreground mt-1 text-xs">
                                    {testResult.error}
                                </p>
                            )}
                            {testResult.phases && (
                                <div className="mt-2 space-y-1">
                                    {testResult.phases.map((p, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                            <Badge
                                                variant={
                                                    p.status === "pass" ? "default" : "destructive"
                                                }
                                                className="text-[10px]"
                                            >
                                                {p.status}
                                            </Badge>
                                            <span>{p.name}</span>
                                            {p.detail && (
                                                <span className="text-muted-foreground">
                                                    — {p.detail}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {impact && impact.totalNewTools !== undefined && (
                        <div className="border-border rounded-md border p-3 text-sm">
                            <p className="font-medium">
                                {impact.totalNewTools} new tool(s) will be available
                            </p>
                            {impact.agents && impact.agents.length > 0 && (
                                <p className="text-muted-foreground mt-1 text-xs">
                                    Agents affected: {impact.agents.map((a) => a.name).join(", ")}
                                </p>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleTest} disabled={!isValid || testing}>
                        {testing ? (
                            <>
                                <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                                Testing...
                            </>
                        ) : (
                            "Test Connection"
                        )}
                    </Button>
                    <Button onClick={handleSave} disabled={!isValid || saving}>
                        {saving ? (
                            <>
                                <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Save Server"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
