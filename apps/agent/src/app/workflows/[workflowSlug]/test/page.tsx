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

interface WorkflowRunStep {
    id: string;
    stepId: string;
    stepType: string;
    stepName?: string | null;
    status: string;
    outputJson?: unknown;
    errorJson?: unknown;
}

interface WorkflowRunDetail {
    id: string;
    status: string;
    inputJson?: unknown;
    outputJson?: unknown;
    steps: WorkflowRunStep[];
}

export default function WorkflowTestPage() {
    const params = useParams();
    const router = useRouter();
    const workflowSlug = params.workflowSlug as string;
    const [inputText, setInputText] = useState('{\n  "query": "Hello workflow"\n}');
    const [output, setOutput] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [runId, setRunId] = useState<string | null>(null);
    const [runDetail, setRunDetail] = useState<WorkflowRunDetail | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [suspended, setSuspended] = useState<{
        stepId: string;
        data: Record<string, unknown>;
    } | null>(null);
    const [resumeText, setResumeText] = useState('{\n  "approved": true\n}');

    const loadRunDetail = useCallback(
        async (id: string) => {
            try {
                const res = await fetch(`${getApiBase()}/api/workflows/${workflowSlug}/runs/${id}`);
                const data = await res.json();
                setRunDetail(data.run || null);
            } catch (fetchError) {
                console.error("Failed to load workflow run detail:", fetchError);
                setRunDetail(null);
            }
        },
        [workflowSlug]
    );

    const executeWorkflow = async () => {
        try {
            setIsRunning(true);
            setError(null);
            setOutput(null);
            setSuspended(null);
            setRunId(null);
            setRunDetail(null);
            let parsedInput: unknown;
            try {
                parsedInput = JSON.parse(inputText);
            } catch {
                throw new Error("Input must be valid JSON.");
            }
            const res = await fetch(`${getApiBase()}/api/workflows/${workflowSlug}/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    input: parsedInput
                })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Execution failed");
            }
            if (data.runId) {
                setRunId(data.runId);
                loadRunDetail(data.runId);
            }
            if (data.status === "suspended") {
                setSuspended(data.suspended);
                return;
            }
            setOutput(JSON.stringify(data.output || data, null, 2));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Execution failed");
        } finally {
            setIsRunning(false);
        }
    };

    const resumeWorkflow = async () => {
        if (!runId || !suspended) return;
        try {
            setIsRunning(true);
            setError(null);
            setOutput(null);
            let parsedResume: unknown;
            try {
                parsedResume = JSON.parse(resumeText);
            } catch {
                throw new Error("Resume payload must be valid JSON.");
            }
            const res = await fetch(
                `${getApiBase()}/api/workflows/${workflowSlug}/runs/${runId}/resume`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        resumeData: parsedResume
                    })
                }
            );
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Resume failed");
            }
            if (data.status === "suspended") {
                setSuspended(data.suspended);
                return;
            }
            await loadRunDetail(runId);
            setOutput(JSON.stringify(data.output || data, null, 2));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Resume failed");
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
                    <CardTitle>Test workflow</CardTitle>
                    <CardDescription>Execute this workflow with JSON input.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Textarea
                        rows={8}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={executeWorkflow} disabled={isRunning}>
                            {isRunning ? "Running..." : "Run workflow"}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => router.push(`/workflows/${workflowSlug}/runs`)}
                        >
                            View runs
                        </Button>
                        {runId && (
                            <Button
                                variant="outline"
                                onClick={() =>
                                    router.push(`/workflows/${workflowSlug}/traces?runId=${runId}`)
                                }
                            >
                                View trace
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {suspended && (
                <Card>
                    <CardHeader>
                        <CardTitle>Workflow suspended</CardTitle>
                        <CardDescription>Step: {suspended.stepId}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea
                            rows={6}
                            value={resumeText}
                            onChange={(e) => setResumeText(e.target.value)}
                        />
                        <Button onClick={resumeWorkflow} disabled={isRunning}>
                            {isRunning ? "Resuming..." : "Resume workflow"}
                        </Button>
                    </CardContent>
                </Card>
            )}

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
                                    {JSON.stringify(runDetail.inputJson, null, 2)}
                                </pre>
                            </div>
                            <div className="rounded-md border p-3">
                                <div className="text-muted-foreground text-xs">Output</div>
                                <pre className="mt-2 max-h-56 overflow-auto text-xs whitespace-pre-wrap">
                                    {JSON.stringify(runDetail.outputJson, null, 2)}
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
                                                {step.stepId} · {step.stepType}
                                            </div>
                                            {step.stepName && (
                                                <div className="text-muted-foreground text-xs">
                                                    {step.stepName}
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
