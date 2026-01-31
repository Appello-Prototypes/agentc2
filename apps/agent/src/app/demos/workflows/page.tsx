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
    Textarea,
    Input,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@repo/ui";
import {
    WorkflowVisualizer,
    StepProgress,
    TimingComparison,
    ApprovalPanel
} from "@/components/workflows";

// ============================================================================
// Types
// ============================================================================

interface WorkflowStep {
    id: string;
    label: string;
    status: "pending" | "running" | "completed" | "error" | "suspended";
    timing?: number;
    description?: string;
}

interface WorkflowResult {
    runId?: string;
    status?: string;
    result?: Record<string, unknown>;
    suspended?: Array<{ step: string; data: Record<string, unknown> }>;
    error?: string;
}

// ============================================================================
// Preset Scenarios
// ============================================================================

const ticketPresets = {
    angry: {
        customerName: "John Smith",
        subject: "THIS IS UNACCEPTABLE - BROKEN FOR 3 DAYS",
        content:
            "I have been trying to access my account for THREE DAYS now and your system keeps showing errors. I have a critical deadline and this is costing me money. If this isn't fixed TODAY I want a full refund and I'm switching to your competitor. This is the worst customer service I've ever experienced!"
    },
    happy: {
        customerName: "Sarah Chen",
        subject: "Thank you for the quick help!",
        content:
            "Just wanted to say thank you! Your support team resolved my issue within an hour yesterday. The new feature is working perfectly now. Really appreciate the excellent service - will definitely recommend to colleagues."
    },
    neutral: {
        customerName: "Michael Johnson",
        subject: "Question about billing cycle",
        content:
            "Hi, I noticed my billing date changed from the 15th to the 1st of the month. Was this intentional? Also, can you confirm when my next payment will be processed? Thanks."
    }
};

const requestPresets = {
    refund: {
        customerEmail: "jane.doe@company.com",
        message:
            "I need to request a refund for my annual subscription. I was charged $299 on Jan 15th but we decided to go with a different solution. Order ID is #12345. Please process this as soon as possible."
    },
    technical: {
        customerEmail: "dev@startup.io",
        message:
            "The API is returning 500 errors since this morning. We're getting 'Internal Server Error' on the /api/v2/users endpoint. This is blocking our production deployment. Error ID: ERR-7829. Please investigate urgently."
    },
    feature: {
        customerEmail: "product.manager@enterprise.com",
        message:
            "It would be great if you could add a bulk export feature. Currently we have to export data one item at a time which is very time-consuming when dealing with 1000+ records. Many other tools have this capability."
    },
    general: {
        customerEmail: "curious@gmail.com",
        message:
            "What's the difference between the Pro and Enterprise plans? Specifically, does the Pro plan include SSO and advanced analytics? We're a team of 50 and trying to decide which plan fits best."
    }
};

const leadPresets = {
    tech: ["Stripe", "Notion", "Figma", "Vercel", "Linear"],
    enterprise: ["Microsoft", "Salesforce", "Oracle", "SAP", "IBM"],
    local: ["Joe's Coffee Shop", "Main Street Dental", "Downtown Fitness", "City Auto Repair"]
};

const contentPresets = {
    blogPost: { topic: "The future of AI in customer service", tone: "professional" as const },
    tweet: { topic: "Announcing our new product launch", tone: "casual" as const },
    linkedinPost: { topic: "5 lessons from scaling a startup", tone: "inspirational" as const },
    newsletter: { topic: "Monthly product updates and tips", tone: "professional" as const }
};

// ============================================================================
// Main Component
// ============================================================================

export default function WorkflowsDemoPage() {
    // Parallel workflow state
    const [parallelInput, setParallelInput] = useState(ticketPresets.angry);
    const [parallelResult, setParallelResult] = useState<WorkflowResult | null>(null);
    const [parallelLoading, setParallelLoading] = useState(false);
    const [parallelSteps, setParallelSteps] = useState<WorkflowStep[]>([]);

    // Branch workflow state
    const [branchInput, setBranchInput] = useState(requestPresets.refund);
    const [branchResult, setBranchResult] = useState<WorkflowResult | null>(null);
    const [branchLoading, setBranchLoading] = useState(false);
    const [branchSteps, setBranchSteps] = useState<WorkflowStep[]>([]);

    // Foreach workflow state
    const [foreachInput, setForeachInput] = useState(leadPresets.tech.join(", "));
    const [foreachResult, setForeachResult] = useState<WorkflowResult | null>(null);
    const [foreachLoading, setForeachLoading] = useState(false);
    const [foreachSteps, setForeachSteps] = useState<WorkflowStep[]>([]);

    // Approval workflow state
    const [approvalInput, setApprovalInput] = useState({
        contentType: "blogPost" as const,
        topic: contentPresets.blogPost.topic,
        tone: contentPresets.blogPost.tone
    });
    const [approvalResult, setApprovalResult] = useState<WorkflowResult | null>(null);
    const [approvalLoading, setApprovalLoading] = useState(false);
    const [approvalSteps, setApprovalSteps] = useState<WorkflowStep[]>([]);

    // ========================================================================
    // Workflow Execution
    // ========================================================================

    const runParallelWorkflow = async () => {
        setParallelLoading(true);
        setParallelResult(null);
        setParallelSteps([
            { id: "input", label: "Input Ticket", status: "completed" },
            { id: "sentiment", label: "Sentiment Analysis", status: "running" },
            { id: "priority", label: "Priority Classification", status: "running" },
            { id: "suggestions", label: "Response Suggestions", status: "running" },
            { id: "combine", label: "Combine Results", status: "pending" }
        ]);

        try {
            const res = await fetch("/api/demos/workflows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workflowType: "parallel-processing",
                    input: parallelInput
                })
            });
            const data = await res.json();
            setParallelResult(data);
            setParallelSteps([
                { id: "input", label: "Input Ticket", status: "completed" },
                { id: "sentiment", label: "Sentiment Analysis", status: "completed", timing: 1200 },
                {
                    id: "priority",
                    label: "Priority Classification",
                    status: "completed",
                    timing: 800
                },
                {
                    id: "suggestions",
                    label: "Response Suggestions",
                    status: "completed",
                    timing: 2100
                },
                { id: "combine", label: "Combine Results", status: "completed", timing: 50 }
            ]);
        } catch {
            setParallelResult({ error: "Failed to run workflow" });
        }
        setParallelLoading(false);
    };

    const runBranchWorkflow = async () => {
        setBranchLoading(true);
        setBranchResult(null);
        setBranchSteps([
            { id: "classify", label: "Classify Request", status: "running" },
            { id: "handle-refund", label: "Billing", status: "pending" },
            { id: "handle-technical", label: "Support", status: "pending" },
            { id: "handle-feature", label: "Product", status: "pending" },
            { id: "handle-general", label: "Help Desk", status: "pending" },
            { id: "finalize", label: "Finalize", status: "pending" }
        ]);

        try {
            const res = await fetch("/api/demos/workflows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workflowType: "conditional-branch",
                    input: branchInput
                })
            });
            const data = await res.json();
            setBranchResult(data);

            // Update steps based on which branch was taken
            const branch = data.result?.branch || "general";
            setBranchSteps([
                { id: "classify", label: "Classify Request", status: "completed", timing: 1500 },
                {
                    id: "handle-refund",
                    label: "Billing",
                    status: branch === "refund" ? "completed" : "pending"
                },
                {
                    id: "handle-technical",
                    label: "Support",
                    status: branch === "technical" ? "completed" : "pending"
                },
                {
                    id: "handle-feature",
                    label: "Product",
                    status: branch === "feature" ? "completed" : "pending"
                },
                {
                    id: "handle-general",
                    label: "Help Desk",
                    status: branch === "general" ? "completed" : "pending"
                },
                { id: "finalize", label: "Finalize", status: "completed", timing: 100 }
            ]);
        } catch {
            setBranchResult({ error: "Failed to run workflow" });
        }
        setBranchLoading(false);
    };

    const runForeachWorkflow = async () => {
        setForeachLoading(true);
        setForeachResult(null);
        setForeachSteps([
            { id: "prepare", label: "Prepare Leads", status: "running" },
            { id: "process-lead", label: "Process Leads", status: "pending" },
            { id: "aggregate", label: "Aggregate Results", status: "pending" }
        ]);

        try {
            const companies = foreachInput
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s);
            const res = await fetch("/api/demos/workflows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workflowType: "foreach-loop",
                    input: { companies }
                })
            });
            const data = await res.json();
            setForeachResult(data);
            setForeachSteps([
                { id: "prepare", label: "Prepare Leads", status: "completed", timing: 50 },
                { id: "process-lead", label: "Process Leads", status: "completed", timing: 3500 },
                { id: "aggregate", label: "Aggregate Results", status: "completed", timing: 100 }
            ]);
        } catch {
            setForeachResult({ error: "Failed to run workflow" });
        }
        setForeachLoading(false);
    };

    const runApprovalWorkflow = async () => {
        setApprovalLoading(true);
        setApprovalResult(null);
        setApprovalSteps([
            { id: "generate-draft", label: "Generate Draft", status: "running" },
            { id: "prepare-review", label: "Prepare Review", status: "pending" },
            { id: "human-approval", label: "Human Review", status: "pending" },
            { id: "publish", label: "Publish", status: "pending" }
        ]);

        try {
            const res = await fetch("/api/demos/workflows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workflowType: "human-approval",
                    input: approvalInput
                })
            });
            const data = await res.json();
            setApprovalResult(data);

            if (data.status === "suspended") {
                setApprovalSteps([
                    {
                        id: "generate-draft",
                        label: "Generate Draft",
                        status: "completed",
                        timing: 2500
                    },
                    {
                        id: "prepare-review",
                        label: "Prepare Review",
                        status: "completed",
                        timing: 50
                    },
                    { id: "human-approval", label: "Human Review", status: "suspended" },
                    { id: "publish", label: "Publish", status: "pending" }
                ]);
            }
        } catch {
            setApprovalResult({ error: "Failed to run workflow" });
        }
        setApprovalLoading(false);
    };

    const handleApprove = async (
        runId: string,
        step: string,
        data: { approved: boolean; approvedBy?: string; editedContent?: string }
    ) => {
        setApprovalLoading(true);
        try {
            const res = await fetch("/api/demos/workflows/resume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workflowType: "human-approval",
                    runId,
                    step,
                    resumeData: data
                })
            });
            const result = await res.json();
            setApprovalResult(result);
            setApprovalSteps([
                {
                    id: "generate-draft",
                    label: "Generate Draft",
                    status: "completed",
                    timing: 2500
                },
                { id: "prepare-review", label: "Prepare Review", status: "completed", timing: 50 },
                { id: "human-approval", label: "Human Review", status: "completed", timing: 1000 },
                { id: "publish", label: "Publish", status: "completed", timing: 100 }
            ]);
        } catch {
            setApprovalResult({ error: "Failed to resume workflow" });
        }
        setApprovalLoading(false);
    };

    const handleReject = async (
        runId: string,
        step: string,
        data: { approved: boolean; approvedBy?: string; rejectionReason?: string }
    ) => {
        setApprovalLoading(true);
        try {
            const res = await fetch("/api/demos/workflows/resume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workflowType: "human-approval",
                    runId,
                    step,
                    resumeData: data
                })
            });
            const result = await res.json();
            setApprovalResult(result);
            setApprovalSteps([
                {
                    id: "generate-draft",
                    label: "Generate Draft",
                    status: "completed",
                    timing: 2500
                },
                { id: "prepare-review", label: "Prepare Review", status: "completed", timing: 50 },
                { id: "human-approval", label: "Human Review", status: "completed", timing: 1000 },
                { id: "publish", label: "Publish", status: "error" }
            ]);
        } catch {
            setApprovalResult({ error: "Failed to resume workflow" });
        }
        setApprovalLoading(false);
    };

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div className="max-w-6xl">
            <h1 className="mb-2 text-3xl font-bold">Workflow Demos</h1>
            <p className="text-muted-foreground mb-8">
                Explore realistic AI workflow patterns with step-by-step visualization. Each demo
                showcases a different control flow pattern.
            </p>

            <Tabs defaultValue="parallel">
                <TabsList className="mb-6">
                    <TabsTrigger value="parallel">Parallel</TabsTrigger>
                    <TabsTrigger value="branch">Branch</TabsTrigger>
                    <TabsTrigger value="foreach">Foreach</TabsTrigger>
                    <TabsTrigger value="approval">Human Approval</TabsTrigger>
                </TabsList>

                {/* ================================================================ */}
                {/* PARALLEL WORKFLOW TAB */}
                {/* ================================================================ */}
                <TabsContent value="parallel">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Ticket Analysis Pipeline</CardTitle>
                                    <CardDescription>
                                        Analyze customer support tickets with 3 AI operations
                                        running simultaneously
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* About section */}
                                    <Collapsible>
                                        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm">
                                            <svg
                                                className="h-4 w-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                            </svg>
                                            About Parallel Workflows
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="bg-muted/50 mt-2 rounded-md p-4 text-sm">
                                            <p className="mb-2">
                                                <strong>Parallel execution</strong> runs multiple
                                                independent operations simultaneously, reducing
                                                total execution time.
                                            </p>
                                            <p className="mb-2">
                                                <strong>When to use:</strong>
                                            </p>
                                            <ul className="list-disc space-y-1 pl-5">
                                                <li>
                                                    Multiple independent AI analyses on the same
                                                    input
                                                </li>
                                                <li>
                                                    Fetching data from multiple sources concurrently
                                                </li>
                                                <li>
                                                    Processing that doesn&apos;t depend on other
                                                    steps&apos; outputs
                                                </li>
                                            </ul>
                                        </CollapsibleContent>
                                    </Collapsible>

                                    {/* Preset buttons */}
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
                                            Quick Scenarios
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setParallelInput(ticketPresets.angry)
                                                }
                                            >
                                                Angry Customer
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setParallelInput(ticketPresets.happy)
                                                }
                                            >
                                                Happy Customer
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setParallelInput(ticketPresets.neutral)
                                                }
                                            >
                                                Neutral Inquiry
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Input fields */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="mb-1 block text-sm font-medium">
                                                Customer Name
                                            </label>
                                            <Input
                                                value={parallelInput.customerName}
                                                onChange={(e) =>
                                                    setParallelInput({
                                                        ...parallelInput,
                                                        customerName: e.target.value
                                                    })
                                                }
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm font-medium">
                                                Subject
                                            </label>
                                            <Input
                                                value={parallelInput.subject}
                                                onChange={(e) =>
                                                    setParallelInput({
                                                        ...parallelInput,
                                                        subject: e.target.value
                                                    })
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">
                                            Ticket Content
                                        </label>
                                        <Textarea
                                            value={parallelInput.content}
                                            onChange={(e) =>
                                                setParallelInput({
                                                    ...parallelInput,
                                                    content: e.target.value
                                                })
                                            }
                                            rows={4}
                                        />
                                    </div>

                                    <Button
                                        onClick={runParallelWorkflow}
                                        disabled={parallelLoading}
                                        className="w-full"
                                    >
                                        {parallelLoading ? "Analyzing..." : "Analyze Ticket"}
                                    </Button>

                                    {/* Results */}
                                    {parallelResult?.result && (
                                        <div className="space-y-4">
                                            <h4 className="font-medium">Analysis Results</h4>

                                            {/* Summary cards */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-card rounded-lg border p-4">
                                                    <p className="text-muted-foreground text-xs">
                                                        Sentiment
                                                    </p>
                                                    <p className="text-lg font-semibold capitalize">
                                                        {
                                                            (
                                                                parallelResult.result
                                                                    .sentiment as Record<
                                                                    string,
                                                                    unknown
                                                                >
                                                            )?.emotion as string
                                                        }
                                                    </p>
                                                </div>
                                                <div className="bg-card rounded-lg border p-4">
                                                    <p className="text-muted-foreground text-xs">
                                                        Priority
                                                    </p>
                                                    <p className="text-lg font-semibold capitalize">
                                                        {
                                                            (
                                                                parallelResult.result
                                                                    .priority as Record<
                                                                    string,
                                                                    unknown
                                                                >
                                                            )?.level as string
                                                        }
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Suggested responses */}
                                            {(
                                                (
                                                    parallelResult.result.suggestions as Record<
                                                        string,
                                                        unknown
                                                    >
                                                )?.responses as Array<{
                                                    tone: string;
                                                    message: string;
                                                }>
                                            )?.length > 0 && (
                                                <div>
                                                    <p className="mb-2 text-sm font-medium">
                                                        Suggested Responses
                                                    </p>
                                                    <div className="space-y-2">
                                                        {(
                                                            (
                                                                parallelResult.result
                                                                    .suggestions as Record<
                                                                    string,
                                                                    unknown
                                                                >
                                                            )?.responses as Array<{
                                                                tone: string;
                                                                message: string;
                                                            }>
                                                        )
                                                            ?.slice(0, 2)
                                                            .map(
                                                                (
                                                                    resp: {
                                                                        tone: string;
                                                                        message: string;
                                                                    },
                                                                    i: number
                                                                ) => (
                                                                    <div
                                                                        key={i}
                                                                        className="rounded border p-3 text-sm"
                                                                    >
                                                                        <span className="text-muted-foreground text-xs">
                                                                            {resp.tone}
                                                                        </span>
                                                                        <p className="mt-1">
                                                                            {resp.message}
                                                                        </p>
                                                                    </div>
                                                                )
                                                            )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Raw JSON toggle */}
                                            <Collapsible>
                                                <CollapsibleTrigger className="text-muted-foreground hover:text-foreground text-xs">
                                                    View Raw JSON
                                                </CollapsibleTrigger>
                                                <CollapsibleContent>
                                                    <pre className="bg-muted mt-2 max-h-64 overflow-auto rounded p-4 text-xs">
                                                        {JSON.stringify(parallelResult, null, 2)}
                                                    </pre>
                                                </CollapsibleContent>
                                            </Collapsible>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right sidebar */}
                        <div className="space-y-4">
                            <WorkflowVisualizer type="parallel" steps={parallelSteps} />
                            {parallelSteps.length > 0 && <StepProgress steps={parallelSteps} />}
                            {parallelResult?.result && (
                                <TimingComparison parallelTime={2150} sequentialTime={4150} />
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* ================================================================ */}
                {/* BRANCH WORKFLOW TAB */}
                {/* ================================================================ */}
                <TabsContent value="branch">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Smart Request Router</CardTitle>
                                    <CardDescription>
                                        AI classifies incoming requests and routes them to the
                                        appropriate department
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* About section */}
                                    <Collapsible>
                                        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm">
                                            <svg
                                                className="h-4 w-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                            </svg>
                                            About Conditional Branching
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="bg-muted/50 mt-2 rounded-md p-4 text-sm">
                                            <p className="mb-2">
                                                <strong>Conditional branching</strong> routes
                                                workflow execution to different paths based on data
                                                or conditions.
                                            </p>
                                            <p className="mb-2">
                                                <strong>When to use:</strong>
                                            </p>
                                            <ul className="list-disc space-y-1 pl-5">
                                                <li>Request classification and routing</li>
                                                <li>Different processing based on input type</li>
                                                <li>A/B testing or feature flags</li>
                                            </ul>
                                        </CollapsibleContent>
                                    </Collapsible>

                                    {/* Preset buttons */}
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
                                            Quick Scenarios
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setBranchInput(requestPresets.refund)
                                                }
                                            >
                                                Refund Request
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setBranchInput(requestPresets.technical)
                                                }
                                            >
                                                Technical Issue
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setBranchInput(requestPresets.feature)
                                                }
                                            >
                                                Feature Request
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setBranchInput(requestPresets.general)
                                                }
                                            >
                                                General Question
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Input fields */}
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">
                                            Customer Email
                                        </label>
                                        <Input
                                            value={branchInput.customerEmail}
                                            onChange={(e) =>
                                                setBranchInput({
                                                    ...branchInput,
                                                    customerEmail: e.target.value
                                                })
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">
                                            Request Message
                                        </label>
                                        <Textarea
                                            value={branchInput.message}
                                            onChange={(e) =>
                                                setBranchInput({
                                                    ...branchInput,
                                                    message: e.target.value
                                                })
                                            }
                                            rows={4}
                                        />
                                    </div>

                                    <Button
                                        onClick={runBranchWorkflow}
                                        disabled={branchLoading}
                                        className="w-full"
                                    >
                                        {branchLoading ? "Routing..." : "Route Request"}
                                    </Button>

                                    {/* Results */}
                                    {branchResult?.result && (
                                        <div className="space-y-4">
                                            <h4 className="font-medium">Routing Results</h4>

                                            <div className="bg-card rounded-lg border p-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-muted-foreground text-xs">
                                                            Routed To
                                                        </p>
                                                        <p className="text-lg font-semibold">
                                                            {branchResult.result.routedTo as string}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground text-xs">
                                                            Priority
                                                        </p>
                                                        <p className="text-lg font-semibold capitalize">
                                                            {branchResult.result.priority as string}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="mt-4">
                                                    <p className="text-muted-foreground text-xs">
                                                        Ticket ID
                                                    </p>
                                                    <code className="text-sm">
                                                        {branchResult.result.ticketId as string}
                                                    </code>
                                                </div>
                                            </div>

                                            <div>
                                                <p className="mb-2 text-sm font-medium">
                                                    Auto Response
                                                </p>
                                                <div className="rounded border p-3 text-sm">
                                                    {branchResult.result.autoResponse as string}
                                                </div>
                                            </div>

                                            {/* Raw JSON toggle */}
                                            <Collapsible>
                                                <CollapsibleTrigger className="text-muted-foreground hover:text-foreground text-xs">
                                                    View Raw JSON
                                                </CollapsibleTrigger>
                                                <CollapsibleContent>
                                                    <pre className="bg-muted mt-2 max-h-64 overflow-auto rounded p-4 text-xs">
                                                        {JSON.stringify(branchResult, null, 2)}
                                                    </pre>
                                                </CollapsibleContent>
                                            </Collapsible>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right sidebar */}
                        <div className="space-y-4">
                            <WorkflowVisualizer
                                type="branch"
                                steps={branchSteps}
                                currentBranch={branchResult?.result?.branch as string}
                            />
                            {branchSteps.length > 0 && (
                                <StepProgress
                                    steps={branchSteps.filter(
                                        (s) => s.status !== "pending" || s.id === "finalize"
                                    )}
                                />
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* ================================================================ */}
                {/* FOREACH WORKFLOW TAB */}
                {/* ================================================================ */}
                <TabsContent value="foreach">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Batch Lead Enrichment</CardTitle>
                                    <CardDescription>
                                        Process multiple sales leads with AI-powered enrichment and
                                        scoring
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* About section */}
                                    <Collapsible>
                                        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm">
                                            <svg
                                                className="h-4 w-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                            </svg>
                                            About Foreach Loops
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="bg-muted/50 mt-2 rounded-md p-4 text-sm">
                                            <p className="mb-2">
                                                <strong>Foreach loops</strong> process each item in
                                                an array with configurable concurrency for efficient
                                                batch operations.
                                            </p>
                                            <p className="mb-2">
                                                <strong>When to use:</strong>
                                            </p>
                                            <ul className="list-disc space-y-1 pl-5">
                                                <li>Batch processing of records</li>
                                                <li>Parallel API calls with rate limiting</li>
                                                <li>Data enrichment pipelines</li>
                                            </ul>
                                        </CollapsibleContent>
                                    </Collapsible>

                                    {/* Preset buttons */}
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
                                            Quick Scenarios
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setForeachInput(leadPresets.tech.join(", "))
                                                }
                                            >
                                                Tech Startups
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setForeachInput(
                                                        leadPresets.enterprise.join(", ")
                                                    )
                                                }
                                            >
                                                Enterprise
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setForeachInput(leadPresets.local.join(", "))
                                                }
                                            >
                                                Local Businesses
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Input */}
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">
                                            Company Names (comma-separated)
                                        </label>
                                        <Textarea
                                            value={foreachInput}
                                            onChange={(e) => setForeachInput(e.target.value)}
                                            rows={2}
                                            placeholder="Stripe, Notion, Figma..."
                                        />
                                    </div>

                                    <Button
                                        onClick={runForeachWorkflow}
                                        disabled={foreachLoading}
                                        className="w-full"
                                    >
                                        {foreachLoading ? "Enriching Leads..." : "Enrich Leads"}
                                    </Button>

                                    {/* Results */}
                                    {foreachResult?.result && (
                                        <div className="space-y-4">
                                            <h4 className="font-medium">Enrichment Results</h4>

                                            {/* Summary */}
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="bg-card rounded-lg border p-3 text-center">
                                                    <p className="text-2xl font-bold">
                                                        {
                                                            (
                                                                foreachResult.result
                                                                    .summary as Record<
                                                                    string,
                                                                    unknown
                                                                >
                                                            )?.totalLeads as number
                                                        }
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">
                                                        Leads Processed
                                                    </p>
                                                </div>
                                                <div className="bg-card rounded-lg border p-3 text-center">
                                                    <p className="text-2xl font-bold">
                                                        {
                                                            (
                                                                foreachResult.result
                                                                    .summary as Record<
                                                                    string,
                                                                    unknown
                                                                >
                                                            )?.averageScore as number
                                                        }
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">
                                                        Avg Score
                                                    </p>
                                                </div>
                                                <div className="bg-card rounded-lg border p-3 text-center">
                                                    <p className="text-2xl font-bold">
                                                        {(
                                                            (
                                                                foreachResult.result
                                                                    .summary as Record<
                                                                    string,
                                                                    unknown
                                                                >
                                                            )?.topLeads as string[]
                                                        )?.length || 0}
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">
                                                        Hot Leads
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Top leads */}
                                            {(
                                                (
                                                    foreachResult.result.summary as Record<
                                                        string,
                                                        unknown
                                                    >
                                                )?.recommendedPriority as Array<{
                                                    companyName: string;
                                                    score: number;
                                                    reason: string;
                                                }>
                                            )?.length > 0 && (
                                                <div>
                                                    <p className="mb-2 text-sm font-medium">
                                                        Top Recommendations
                                                    </p>
                                                    <div className="space-y-2">
                                                        {(
                                                            (
                                                                foreachResult.result
                                                                    .summary as Record<
                                                                    string,
                                                                    unknown
                                                                >
                                                            )?.recommendedPriority as Array<{
                                                                companyName: string;
                                                                score: number;
                                                                reason: string;
                                                            }>
                                                        )?.map((lead, i) => (
                                                            <div
                                                                key={i}
                                                                className="flex items-center justify-between rounded border p-3"
                                                            >
                                                                <div>
                                                                    <p className="font-medium">
                                                                        {lead.companyName}
                                                                    </p>
                                                                    <p className="text-muted-foreground text-xs">
                                                                        {lead.reason}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-lg font-bold text-green-600">
                                                                        {lead.score}
                                                                    </span>
                                                                    <p className="text-muted-foreground text-xs">
                                                                        score
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Raw JSON toggle */}
                                            <Collapsible>
                                                <CollapsibleTrigger className="text-muted-foreground hover:text-foreground text-xs">
                                                    View Raw JSON
                                                </CollapsibleTrigger>
                                                <CollapsibleContent>
                                                    <pre className="bg-muted mt-2 max-h-64 overflow-auto rounded p-4 text-xs">
                                                        {JSON.stringify(foreachResult, null, 2)}
                                                    </pre>
                                                </CollapsibleContent>
                                            </Collapsible>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right sidebar */}
                        <div className="space-y-4">
                            <WorkflowVisualizer type="foreach" steps={foreachSteps} />
                            {foreachSteps.length > 0 && <StepProgress steps={foreachSteps} />}
                        </div>
                    </div>
                </TabsContent>

                {/* ================================================================ */}
                {/* APPROVAL WORKFLOW TAB */}
                {/* ================================================================ */}
                <TabsContent value="approval">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Content Publishing Workflow</CardTitle>
                                    <CardDescription>
                                        AI generates content that requires human review before
                                        publishing
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* About section */}
                                    <Collapsible>
                                        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm">
                                            <svg
                                                className="h-4 w-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                            </svg>
                                            About Human-in-the-Loop
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="bg-muted/50 mt-2 rounded-md p-4 text-sm">
                                            <p className="mb-2">
                                                <strong>Human-in-the-loop</strong> workflows suspend
                                                execution at critical points to require human
                                                approval before continuing.
                                            </p>
                                            <p className="mb-2">
                                                <strong>When to use:</strong>
                                            </p>
                                            <ul className="list-disc space-y-1 pl-5">
                                                <li>Content moderation and approval</li>
                                                <li>High-stakes decisions (financial, legal)</li>
                                                <li>Quality assurance checkpoints</li>
                                            </ul>
                                        </CollapsibleContent>
                                    </Collapsible>

                                    {/* Preset buttons */}
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
                                            Quick Scenarios
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(contentPresets).map(
                                                ([type, preset]) => (
                                                    <Button
                                                        key={type}
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            setApprovalInput({
                                                                contentType:
                                                                    type as typeof approvalInput.contentType,
                                                                topic: preset.topic,
                                                                tone: preset.tone
                                                            })
                                                        }
                                                    >
                                                        {type === "blogPost"
                                                            ? "Blog Post"
                                                            : type === "tweet"
                                                              ? "Tweet"
                                                              : type === "linkedinPost"
                                                                ? "LinkedIn"
                                                                : "Newsletter"}
                                                    </Button>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    {/* Input fields */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="mb-1 block text-sm font-medium">
                                                Content Type
                                            </label>
                                            <select
                                                value={approvalInput.contentType}
                                                onChange={(e) =>
                                                    setApprovalInput({
                                                        ...approvalInput,
                                                        contentType: e.target
                                                            .value as typeof approvalInput.contentType
                                                    })
                                                }
                                                className="bg-background w-full rounded-md border p-2"
                                            >
                                                <option value="blogPost">Blog Post</option>
                                                <option value="tweet">Tweet</option>
                                                <option value="linkedinPost">LinkedIn Post</option>
                                                <option value="newsletter">Newsletter</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm font-medium">
                                                Tone
                                            </label>
                                            <select
                                                value={approvalInput.tone}
                                                onChange={(e) =>
                                                    setApprovalInput({
                                                        ...approvalInput,
                                                        tone: e.target
                                                            .value as typeof approvalInput.tone
                                                    })
                                                }
                                                className="bg-background w-full rounded-md border p-2"
                                            >
                                                <option value="professional">Professional</option>
                                                <option value="casual">Casual</option>
                                                <option value="humorous">Humorous</option>
                                                <option value="inspirational">Inspirational</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">
                                            Topic
                                        </label>
                                        <Input
                                            value={approvalInput.topic}
                                            onChange={(e) =>
                                                setApprovalInput({
                                                    ...approvalInput,
                                                    topic: e.target.value
                                                })
                                            }
                                            placeholder="What should the content be about?"
                                        />
                                    </div>

                                    <Button
                                        onClick={runApprovalWorkflow}
                                        disabled={
                                            approvalLoading ||
                                            approvalResult?.status === "suspended"
                                        }
                                        className="w-full"
                                    >
                                        {approvalLoading ? "Generating..." : "Generate Content"}
                                    </Button>

                                    {/* Suspended state - Approval Panel */}
                                    {approvalResult?.status === "suspended" &&
                                        approvalResult.runId &&
                                        approvalResult.suspended?.[0] && (
                                            <ApprovalPanel
                                                runId={approvalResult.runId}
                                                step={approvalResult.suspended[0].step}
                                                workflowType="human-approval"
                                                suspendedData={approvalResult.suspended[0].data}
                                                onApprove={handleApprove}
                                                onReject={handleReject}
                                                isLoading={approvalLoading}
                                            />
                                        )}

                                    {/* Published result */}
                                    {approvalResult?.result?.status === "published" && (
                                        <div className="rounded-lg border border-green-500 bg-green-50 p-4 dark:bg-green-950/30">
                                            <div className="mb-2 flex items-center gap-2 text-green-700 dark:text-green-300">
                                                <svg
                                                    className="h-5 w-5"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M5 13l4 4L19 7"
                                                    />
                                                </svg>
                                                <span className="font-medium">
                                                    Content Published Successfully!
                                                </span>
                                            </div>
                                            <p className="text-sm text-green-800 dark:text-green-200">
                                                {approvalResult.result.summary as string}
                                            </p>
                                        </div>
                                    )}

                                    {/* Rejected result */}
                                    {approvalResult?.result?.status === "rejected" && (
                                        <div className="rounded-lg border border-red-500 bg-red-50 p-4 dark:bg-red-950/30">
                                            <div className="mb-2 flex items-center gap-2 text-red-700 dark:text-red-300">
                                                <svg
                                                    className="h-5 w-5"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M6 18L18 6M6 6l12 12"
                                                    />
                                                </svg>
                                                <span className="font-medium">
                                                    Content Rejected
                                                </span>
                                            </div>
                                            <p className="text-sm text-red-800 dark:text-red-200">
                                                {approvalResult.result.summary as string}
                                            </p>
                                        </div>
                                    )}

                                    {/* Raw JSON toggle */}
                                    {approvalResult && (
                                        <Collapsible>
                                            <CollapsibleTrigger className="text-muted-foreground hover:text-foreground text-xs">
                                                View Raw JSON
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <pre className="bg-muted mt-2 max-h-64 overflow-auto rounded p-4 text-xs">
                                                    {JSON.stringify(approvalResult, null, 2)}
                                                </pre>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right sidebar */}
                        <div className="space-y-4">
                            <WorkflowVisualizer type="approval" steps={approvalSteps} />
                            {approvalSteps.length > 0 && <StepProgress steps={approvalSteps} />}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
