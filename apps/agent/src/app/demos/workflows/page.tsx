"use client";

import { useState } from "react";
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Input
} from "@repo/ui";

type WorkflowResult = Record<string, unknown> | null;

export default function WorkflowsDemoPage() {
    const [parallelInput, setParallelInput] = useState("Hello World");
    const [parallelResult, setParallelResult] = useState<WorkflowResult>(null);
    const [parallelLoading, setParallelLoading] = useState(false);

    const [branchInput, setBranchInput] = useState("How do I do this?");
    const [branchResult, setBranchResult] = useState<WorkflowResult>(null);
    const [branchLoading, setBranchLoading] = useState(false);

    const [foreachInput, setForeachInput] = useState("apple, banana, cherry");
    const [foreachResult, setForeachResult] = useState<WorkflowResult>(null);
    const [foreachLoading, setForeachLoading] = useState(false);

    const [approvalAction, setApprovalAction] = useState("email");
    const [approvalRecipient, setApprovalRecipient] = useState("user@example.com");
    const [approvalMessage, setApprovalMessage] = useState("Hello!");
    const [approvalResult, setApprovalResult] = useState<WorkflowResult>(null);
    const [approvalLoading, setApprovalLoading] = useState(false);

    const runWorkflow = async (
        workflowType: string,
        input: Record<string, unknown>,
        setResult: (r: WorkflowResult) => void,
        setLoading: (l: boolean) => void
    ) => {
        setLoading(true);
        try {
            const res = await fetch("/api/demos/workflows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workflowType, input })
            });
            const data = await res.json();
            setResult(data);
        } catch {
            setResult({ error: "Failed to run workflow" });
        }
        setLoading(false);
    };

    return (
        <div>
            <h1 className="mb-2 text-3xl font-bold">Workflows Demo</h1>
            <p className="text-muted-foreground mb-8">
                Explore workflow patterns: parallel, branching, loops, and human-in-the-loop.
            </p>

            <Tabs defaultValue="parallel">
                <TabsList className="mb-6">
                    <TabsTrigger value="parallel">Parallel</TabsTrigger>
                    <TabsTrigger value="branch">Branch</TabsTrigger>
                    <TabsTrigger value="foreach">Foreach</TabsTrigger>
                    <TabsTrigger value="approval">Human Approval</TabsTrigger>
                </TabsList>

                <TabsContent value="parallel">
                    <Card>
                        <CardHeader>
                            <CardTitle>Parallel Processing Workflow</CardTitle>
                            <CardDescription>
                                Process text with parallel operations: format, analyze, and detect
                                language.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium">Text Input</label>
                                <Input
                                    value={parallelInput}
                                    onChange={(e) => setParallelInput(e.target.value)}
                                    placeholder="Enter text to process..."
                                />
                            </div>
                            <Button
                                onClick={() =>
                                    runWorkflow(
                                        "parallel-processing",
                                        { text: parallelInput },
                                        setParallelResult,
                                        setParallelLoading
                                    )
                                }
                                disabled={parallelLoading}
                            >
                                {parallelLoading ? "Processing..." : "Run Parallel"}
                            </Button>
                            {parallelResult && (
                                <pre className="bg-muted mt-4 overflow-auto rounded-md p-4 text-sm">
                                    {JSON.stringify(parallelResult, null, 2)}
                                </pre>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="branch">
                    <Card>
                        <CardHeader>
                            <CardTitle>Conditional Branch Workflow</CardTitle>
                            <CardDescription>
                                Route requests to different handlers based on type (question,
                                command, statement).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium">Request</label>
                                <Input
                                    value={branchInput}
                                    onChange={(e) => setBranchInput(e.target.value)}
                                    placeholder="Enter a question, command, or statement..."
                                />
                            </div>
                            <Button
                                onClick={() =>
                                    runWorkflow(
                                        "conditional-branch",
                                        { request: branchInput },
                                        setBranchResult,
                                        setBranchLoading
                                    )
                                }
                                disabled={branchLoading}
                            >
                                {branchLoading ? "Classifying..." : "Run Branch"}
                            </Button>
                            {branchResult && (
                                <pre className="bg-muted mt-4 overflow-auto rounded-md p-4 text-sm">
                                    {JSON.stringify(branchResult, null, 2)}
                                </pre>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="foreach">
                    <Card>
                        <CardHeader>
                            <CardTitle>Foreach Loop Workflow</CardTitle>
                            <CardDescription>
                                Process each item in an array with parallel execution.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Items (comma-separated)
                                </label>
                                <Input
                                    value={foreachInput}
                                    onChange={(e) => setForeachInput(e.target.value)}
                                    placeholder="item1, item2, item3..."
                                />
                            </div>
                            <Button
                                onClick={() =>
                                    runWorkflow(
                                        "foreach-loop",
                                        { items: foreachInput.split(",").map((s) => s.trim()) },
                                        setForeachResult,
                                        setForeachLoading
                                    )
                                }
                                disabled={foreachLoading}
                            >
                                {foreachLoading ? "Processing..." : "Run Foreach"}
                            </Button>
                            {foreachResult && (
                                <pre className="bg-muted mt-4 overflow-auto rounded-md p-4 text-sm">
                                    {JSON.stringify(foreachResult, null, 2)}
                                </pre>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="approval">
                    <Card>
                        <CardHeader>
                            <CardTitle>Human Approval Workflow</CardTitle>
                            <CardDescription>
                                Send a message after getting human approval (suspend/resume).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium">Action</label>
                                    <select
                                        value={approvalAction}
                                        onChange={(e) => setApprovalAction(e.target.value)}
                                        className="bg-background w-full rounded-md border p-2"
                                    >
                                        <option value="email">Email</option>
                                        <option value="slack">Slack</option>
                                        <option value="sms">SMS</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Recipient
                                    </label>
                                    <Input
                                        value={approvalRecipient}
                                        onChange={(e) => setApprovalRecipient(e.target.value)}
                                        placeholder="user@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Message
                                    </label>
                                    <Input
                                        value={approvalMessage}
                                        onChange={(e) => setApprovalMessage(e.target.value)}
                                        placeholder="Hello!"
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={() =>
                                    runWorkflow(
                                        "human-approval",
                                        {
                                            action: approvalAction,
                                            recipient: approvalRecipient,
                                            message: approvalMessage
                                        },
                                        setApprovalResult,
                                        setApprovalLoading
                                    )
                                }
                                disabled={approvalLoading}
                            >
                                {approvalLoading ? "Starting..." : "Start Approval Flow"}
                            </Button>
                            {approvalResult && (
                                <div className="mt-4 space-y-4">
                                    <pre className="bg-muted overflow-auto rounded-md p-4 text-sm">
                                        {JSON.stringify(approvalResult, null, 2)}
                                    </pre>
                                    {approvalResult.status === "suspended" && (
                                        <div className="flex gap-2">
                                            <Button variant="default">Approve</Button>
                                            <Button variant="destructive">Reject</Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
