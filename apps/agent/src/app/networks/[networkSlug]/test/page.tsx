"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Textarea
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface NetworkRunStep {
    id: string;
    stepNumber: number;
    stepType: string;
    primitiveType?: string | null;
    status: string;
}

interface NetworkRunDetail {
    id: string;
    status: string;
    inputText: string;
    outputText?: string | null;
    outputJson?: unknown;
    steps: NetworkRunStep[];
}

export default function NetworkTestPage() {
    const params = useParams();
    const router = useRouter();
    const networkSlug = params.networkSlug as string;
    const [message, setMessage] = useState("Plan a 3-day trip to Tokyo.");
    const [output, setOutput] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [runId, setRunId] = useState<string | null>(null);
    const [runDetail, setRunDetail] = useState<NetworkRunDetail | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    const loadRunDetail = useCallback(
        async (id: string) => {
            try {
                const res = await fetch(`${getApiBase()}/api/networks/${networkSlug}/runs/${id}`);
                const data = await res.json();
                setRunDetail(data.run || null);
            } catch (fetchError) {
                console.error("Failed to load network run detail:", fetchError);
                setRunDetail(null);
            }
        },
        [networkSlug]
    );

    const executeNetwork = async () => {
        try {
            setIsRunning(true);
            setError(null);
            setOutput(null);
            setRunDetail(null);
            setRunId(null);
            const res = await fetch(`${getApiBase()}/api/networks/${networkSlug}/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Network execution failed");
            }
            if (data.runId) {
                setRunId(data.runId);
                loadRunDetail(data.runId);
            }
            setOutput(JSON.stringify(data.outputJson || { text: data.outputText }, null, 2));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Execution failed");
        } finally {
            setIsRunning(false);
        }
    };

    useEffect(() => {
        if (runId) {
            loadRunDetail(runId);
        }
    }, [runId, loadRunDetail]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Test network</CardTitle>
                    <CardDescription>Execute the routing agent with a message.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Textarea
                        rows={6}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={executeNetwork} disabled={isRunning}>
                            {isRunning ? "Running..." : "Run network"}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => router.push(`/networks/${networkSlug}/runs`)}
                        >
                            View runs
                        </Button>
                        {runId && (
                            <Button
                                variant="outline"
                                onClick={() =>
                                    router.push(`/networks/${networkSlug}/traces?runId=${runId}`)
                                }
                            >
                                View trace
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {error && (
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error</CardTitle>
                        <CardDescription>{error}</CardDescription>
                    </CardHeader>
                </Card>
            )}

            {runDetail && (
                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <CardTitle>Latest run</CardTitle>
                                <CardDescription>Run ID {runDetail.id}</CardDescription>
                            </div>
                            <Badge
                                variant={runDetail.status === "COMPLETED" ? "default" : "secondary"}
                            >
                                {runDetail.status.toLowerCase()}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-md border p-3">
                                <div className="text-muted-foreground text-xs">Input</div>
                                <pre className="mt-2 max-h-56 overflow-auto text-xs whitespace-pre-wrap">
                                    {runDetail.inputText}
                                </pre>
                            </div>
                            <div className="rounded-md border p-3">
                                <div className="text-muted-foreground text-xs">Output</div>
                                <pre className="mt-2 max-h-56 overflow-auto text-xs whitespace-pre-wrap">
                                    {runDetail.outputText ||
                                        JSON.stringify(runDetail.outputJson, null, 2)}
                                </pre>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="text-muted-foreground text-xs">Steps</div>
                            {runDetail.steps.length === 0 ? (
                                <div className="text-muted-foreground text-sm">No steps yet.</div>
                            ) : (
                                runDetail.steps.map((step) => (
                                    <div
                                        key={step.id}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                                    >
                                        <div>
                                            <div className="font-medium">
                                                Step {step.stepNumber} · {step.stepType}
                                            </div>
                                            {step.primitiveType && (
                                                <div className="text-muted-foreground text-xs">
                                                    {step.primitiveType}
                                                </div>
                                            )}
                                        </div>
                                        <Badge
                                            variant={
                                                step.status === "COMPLETED"
                                                    ? "default"
                                                    : "secondary"
                                            }
                                        >
                                            {step.status.toLowerCase()}
                                        </Badge>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {output && (
                <Card>
                    <CardHeader>
                        <CardTitle>Output</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="text-xs whitespace-pre-wrap">{output}</pre>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
