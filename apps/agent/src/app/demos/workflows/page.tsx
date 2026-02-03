"use client";

import { useState } from "react";
import { getApiBase } from "@/lib/utils";
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

// Combined workflow presets - Customer Service Command Center
const combinedPresets = {
    multiIssue: {
        customerName: "Alex Rivera",
        customerEmail: "alex.rivera@techcorp.io",
        accountTier: "enterprise" as const,
        subject: "Multiple urgent issues - billing error AND API outage",
        message:
            "We have TWO critical problems that need immediate attention:\n\n1. BILLING: We were charged $2,500 for last month but our contract is for $1,800/month. Please issue a refund for the $700 overcharge immediately.\n\n2. API OUTAGE: Our production system has been down since 3am due to your API returning 503 errors. This is causing us significant revenue loss - estimated $10,000/hour.\n\nWe need BOTH issues resolved today. Our CTO is escalating this to your VP of Engineering if not resolved within 2 hours."
    },
    simpleQuestion: {
        customerName: "Jordan Lee",
        customerEmail: "jordan@smallbiz.com",
        accountTier: "starter" as const,
        subject: "How do I export my data?",
        message:
            "Hi there! I'm trying to figure out how to export my dashboard data to Excel. I looked in the settings but couldn't find the option. Can you point me in the right direction? Also, is there a way to schedule automatic exports? Thanks!"
    },
    escalation: {
        customerName: "Morgan Chen",
        customerEmail: "m.chen@bigenterprise.com",
        accountTier: "enterprise" as const,
        subject: "Requesting immediate executive escalation",
        message:
            "This is the 4th time I'm reaching out about the same issue. Your support team keeps closing my tickets without resolution. Our SSO integration has been broken for 2 weeks, affecting 500+ employees. I've asked to speak to a manager 3 times with no response.\n\nI am formally requesting this be escalated to your VP of Customer Success. Our contract renewal is in 30 days and this experience is making us reconsider. Please have someone senior contact me within 24 hours."
    },
    praise: {
        customerName: "Taylor Brooks",
        customerEmail: "taylor@happycustomer.io",
        accountTier: "professional" as const,
        subject: "Amazing support experience!",
        message:
            "Just wanted to send a quick note to say how impressed I am with your team. Sarah from support helped me migrate our entire account to the new API version - she was patient, knowledgeable, and even stayed on the call past her shift to make sure we were fully set up.\n\nCould you pass along my thanks to her manager? This is exactly the kind of support that makes us loyal customers. Would love to leave a testimonial if you have a place for that."
    }
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
    const [approvalInput, setApprovalInput] = useState<{
        contentType: keyof typeof contentPresets;
        topic: string;
        tone: "professional" | "casual" | "inspirational";
    }>({
        contentType: "blogPost",
        topic: contentPresets.blogPost.topic,
        tone: contentPresets.blogPost.tone
    });
    const [approvalResult, setApprovalResult] = useState<WorkflowResult | null>(null);
    const [approvalLoading, setApprovalLoading] = useState(false);
    const [approvalSteps, setApprovalSteps] = useState<WorkflowStep[]>([]);

    // Combined workflow state
    const [combinedInput, setCombinedInput] = useState<{
        customerName: string;
        customerEmail: string;
        accountTier: "starter" | "professional" | "enterprise";
        subject: string;
        message: string;
    }>(combinedPresets.multiIssue);
    const [combinedResult, setCombinedResult] = useState<WorkflowResult | null>(null);
    const [combinedLoading, setCombinedLoading] = useState(false);
    const [combinedSteps, setCombinedSteps] = useState<WorkflowStep[]>([]);

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
            const res = await fetch(`${getApiBase()}/api/demos/workflows`, {
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
            const res = await fetch(`${getApiBase()}/api/demos/workflows`, {
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
            const res = await fetch(`${getApiBase()}/api/demos/workflows`, {
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
            const res = await fetch(`${getApiBase()}/api/demos/workflows`, {
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
            const res = await fetch(`${getApiBase()}/api/demos/workflows/resume`, {
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
            const res = await fetch(`${getApiBase()}/api/demos/workflows/resume`, {
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

    // Combined workflow - simulates a complex multi-pattern workflow
    const runCombinedWorkflow = async () => {
        setCombinedLoading(true);
        setCombinedResult(null);

        // Initial steps - shows the complex flow
        setCombinedSteps([
            { id: "intake", label: "Intake Request", status: "running" },
            { id: "parallel-analysis", label: "Parallel Analysis", status: "pending" },
            { id: "classify-route", label: "Classify & Route", status: "pending" },
            { id: "process-actions", label: "Process Actions", status: "pending" },
            { id: "approval-gate", label: "Approval Gate", status: "pending" },
            { id: "execute-finalize", label: "Execute & Finalize", status: "pending" }
        ]);

        // Simulate the combined workflow stages
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Step 1: Intake complete, parallel starts
        setCombinedSteps([
            { id: "intake", label: "Intake Request", status: "completed", timing: 100 },
            { id: "parallel-analysis", label: "Parallel Analysis", status: "running" },
            { id: "classify-route", label: "Classify & Route", status: "pending" },
            { id: "process-actions", label: "Process Actions", status: "pending" },
            { id: "approval-gate", label: "Approval Gate", status: "pending" },
            { id: "execute-finalize", label: "Execute & Finalize", status: "pending" }
        ]);

        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Step 2: Parallel complete, classify starts
        setCombinedSteps([
            { id: "intake", label: "Intake Request", status: "completed", timing: 100 },
            {
                id: "parallel-analysis",
                label: "Parallel Analysis",
                status: "completed",
                timing: 1200
            },
            { id: "classify-route", label: "Classify & Route", status: "running" },
            { id: "process-actions", label: "Process Actions", status: "pending" },
            { id: "approval-gate", label: "Approval Gate", status: "pending" },
            { id: "execute-finalize", label: "Execute & Finalize", status: "pending" }
        ]);

        await new Promise((resolve) => setTimeout(resolve, 800));

        // Step 3: Classification complete, foreach processing
        setCombinedSteps([
            { id: "intake", label: "Intake Request", status: "completed", timing: 100 },
            {
                id: "parallel-analysis",
                label: "Parallel Analysis",
                status: "completed",
                timing: 1200
            },
            { id: "classify-route", label: "Classify & Route", status: "completed", timing: 650 },
            { id: "process-actions", label: "Process Actions", status: "running" },
            { id: "approval-gate", label: "Approval Gate", status: "pending" },
            { id: "execute-finalize", label: "Execute & Finalize", status: "pending" }
        ]);

        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Check if this scenario needs approval
        const needsApproval =
            combinedInput.accountTier === "enterprise" ||
            combinedInput.message.toLowerCase().includes("refund") ||
            combinedInput.message.toLowerCase().includes("escalat");

        if (needsApproval) {
            // Step 4: Processing complete, suspended for approval
            setCombinedSteps([
                { id: "intake", label: "Intake Request", status: "completed", timing: 100 },
                {
                    id: "parallel-analysis",
                    label: "Parallel Analysis",
                    status: "completed",
                    timing: 1200
                },
                {
                    id: "classify-route",
                    label: "Classify & Route",
                    status: "completed",
                    timing: 650
                },
                {
                    id: "process-actions",
                    label: "Process Actions",
                    status: "completed",
                    timing: 1800
                },
                { id: "approval-gate", label: "Approval Gate", status: "suspended" },
                { id: "execute-finalize", label: "Execute & Finalize", status: "pending" }
            ]);

            // Simulate a suspended workflow response
            setCombinedResult({
                runId: `combined-${Date.now()}`,
                status: "suspended",
                suspended: [
                    {
                        step: "approval-gate",
                        data: {
                            customerName: combinedInput.customerName,
                            customerEmail: combinedInput.customerEmail,
                            accountTier: combinedInput.accountTier,
                            analysis: {
                                sentiment: combinedInput.message.includes("URGENT")
                                    ? "urgent"
                                    : combinedInput.message.includes("thank")
                                      ? "positive"
                                      : "negative",
                                issueCount: combinedInput.message.includes("TWO") ? 2 : 1,
                                requiresRefund: combinedInput.message
                                    .toLowerCase()
                                    .includes("refund"),
                                requiresEscalation: combinedInput.message
                                    .toLowerCase()
                                    .includes("escalat"),
                                estimatedValue:
                                    combinedInput.accountTier === "enterprise"
                                        ? "$2,500/mo"
                                        : "$50/mo"
                            },
                            proposedActions: [
                                ...(combinedInput.message.toLowerCase().includes("refund")
                                    ? ["Issue refund of $700"]
                                    : []),
                                ...(combinedInput.message.toLowerCase().includes("api")
                                    ? ["Create P1 incident ticket"]
                                    : []),
                                ...(combinedInput.message.toLowerCase().includes("escalat")
                                    ? ["Route to VP Customer Success"]
                                    : []),
                                "Send acknowledgment email",
                                "Schedule follow-up in 24 hours"
                            ],
                            reviewReason:
                                "High-value customer action requires manager approval before execution"
                        }
                    }
                ]
            });
        } else {
            // No approval needed - complete the workflow
            setCombinedSteps([
                { id: "intake", label: "Intake Request", status: "completed", timing: 100 },
                {
                    id: "parallel-analysis",
                    label: "Parallel Analysis",
                    status: "completed",
                    timing: 1200
                },
                {
                    id: "classify-route",
                    label: "Classify & Route",
                    status: "completed",
                    timing: 650
                },
                {
                    id: "process-actions",
                    label: "Process Actions",
                    status: "completed",
                    timing: 1800
                },
                { id: "approval-gate", label: "Approval Gate", status: "completed", timing: 50 },
                {
                    id: "execute-finalize",
                    label: "Execute & Finalize",
                    status: "completed",
                    timing: 200
                }
            ]);

            setCombinedResult({
                status: "success",
                result: {
                    ticketId: `CS-${Date.now().toString(36).toUpperCase()}`,
                    customerName: combinedInput.customerName,
                    resolution: {
                        status: "auto-resolved",
                        category: "general-inquiry",
                        actionsExecuted: [
                            "Generated FAQ response",
                            "Sent helpful documentation links",
                            "Created follow-up reminder"
                        ],
                        responseTime: "< 5 seconds"
                    },
                    summary:
                        "Request automatically processed and response sent. No approval required for this request type."
                }
            });
        }

        setCombinedLoading(false);
    };

    const handleCombinedApprove = async (
        runId: string,
        step: string,
        data: { approved: boolean; approvedBy?: string; notes?: string }
    ) => {
        setCombinedLoading(true);

        // Simulate processing
        await new Promise((resolve) => setTimeout(resolve, 1000));

        setCombinedSteps([
            { id: "intake", label: "Intake Request", status: "completed", timing: 100 },
            {
                id: "parallel-analysis",
                label: "Parallel Analysis",
                status: "completed",
                timing: 1200
            },
            { id: "classify-route", label: "Classify & Route", status: "completed", timing: 650 },
            { id: "process-actions", label: "Process Actions", status: "completed", timing: 1800 },
            { id: "approval-gate", label: "Approval Gate", status: "completed", timing: 1000 },
            {
                id: "execute-finalize",
                label: "Execute & Finalize",
                status: "completed",
                timing: 300
            }
        ]);

        setCombinedResult({
            status: "success",
            result: {
                ticketId: `CS-${Date.now().toString(36).toUpperCase()}`,
                customerName: combinedInput.customerName,
                approval: {
                    approved: true,
                    approvedBy: data.approvedBy || "Manager",
                    approvedAt: new Date().toISOString(),
                    notes: data.notes
                },
                actionsExecuted: (
                    combinedResult?.suspended?.[0]?.data?.proposedActions as string[]
                )?.map((action: string) => ({
                    action,
                    status: "completed"
                })),
                summary: `All actions approved and executed successfully. Customer ${combinedInput.customerName} has been notified.`
            }
        });

        setCombinedLoading(false);
    };

    const handleCombinedReject = async (
        runId: string,
        step: string,
        data: { approved: boolean; approvedBy?: string; rejectionReason?: string }
    ) => {
        setCombinedLoading(true);

        await new Promise((resolve) => setTimeout(resolve, 500));

        setCombinedSteps([
            { id: "intake", label: "Intake Request", status: "completed", timing: 100 },
            {
                id: "parallel-analysis",
                label: "Parallel Analysis",
                status: "completed",
                timing: 1200
            },
            { id: "classify-route", label: "Classify & Route", status: "completed", timing: 650 },
            { id: "process-actions", label: "Process Actions", status: "completed", timing: 1800 },
            { id: "approval-gate", label: "Approval Gate", status: "completed", timing: 500 },
            { id: "execute-finalize", label: "Execute & Finalize", status: "error" }
        ]);

        setCombinedResult({
            status: "success",
            result: {
                ticketId: `CS-${Date.now().toString(36).toUpperCase()}`,
                customerName: combinedInput.customerName,
                approval: {
                    approved: false,
                    approvedBy: data.approvedBy || "Manager",
                    rejectionReason: data.rejectionReason
                },
                actionsExecuted: [],
                summary: `Actions rejected by ${data.approvedBy || "Manager"}. Reason: ${data.rejectionReason || "Not specified"}. Ticket remains open for manual handling.`
            }
        });

        setCombinedLoading(false);
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
                    <TabsTrigger value="combined">Combined</TabsTrigger>
                </TabsList>

                {/* ================================================================ */}
                {/* PARALLEL WORKFLOW TAB */}
                {/* ================================================================ */}
                <TabsContent value="parallel">
                    {/* Educational Content */}
                    <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
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
                                        d="M13 10V3L4 14h7v7l9-11h-7z"
                                    />
                                </svg>
                                Understanding Parallel Workflows
                            </CardTitle>
                            <CardDescription>
                                Execute multiple independent operations simultaneously to reduce
                                total processing time
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div>
                                <h4 className="mb-2 font-semibold text-blue-700 dark:text-blue-300">
                                    What is a Parallel Workflow?
                                </h4>
                                <p className="text-muted-foreground">
                                    A parallel workflow executes multiple steps at the same time
                                    rather than sequentially. When you have independent operations
                                    that don&apos;t depend on each other&apos;s output, running them
                                    in parallel can dramatically reduce total execution time. If
                                    three API calls each take 2 seconds, sequential execution takes
                                    6 seconds, but parallel execution takes only 2 seconds.
                                </p>
                            </div>

                            <div>
                                <h4 className="mb-2 font-semibold text-blue-700 dark:text-blue-300">
                                    How It Works
                                </h4>
                                <ol className="text-muted-foreground list-decimal space-y-1 pl-5">
                                    <li>
                                        Define multiple steps that can run independently (same
                                        input, no dependencies)
                                    </li>
                                    <li>
                                        Use{" "}
                                        <code className="bg-muted rounded px-1">.parallel()</code>{" "}
                                        to execute them simultaneously
                                    </li>
                                    <li>
                                        Results from all parallel steps are collected into a single
                                        object
                                    </li>
                                    <li>
                                        A subsequent step can combine or process the parallel
                                        results
                                    </li>
                                </ol>
                            </div>

                            <div>
                                <h4 className="mb-2 font-semibold text-blue-700 dark:text-blue-300">
                                    When to Use Parallel Workflows
                                </h4>
                                <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                                    <li>
                                        <strong>Multi-aspect AI analysis:</strong> Analyze
                                        sentiment, priority, and generate responses simultaneously
                                    </li>
                                    <li>
                                        <strong>Data enrichment:</strong> Fetch data from multiple
                                        APIs or services at once
                                    </li>
                                    <li>
                                        <strong>Validation:</strong> Run multiple checks or
                                        validators in parallel
                                    </li>
                                    <li>
                                        <strong>Aggregation:</strong> Gather information from
                                        different sources before combining
                                    </li>
                                </ul>
                            </div>

                            <Collapsible>
                                <CollapsibleTrigger className="flex items-center gap-2 font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200">
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
                                            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                                        />
                                    </svg>
                                    View Mastra Code Example
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-3">
                                    <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-xs">
                                        {`// Define parallel workflow with Mastra
const parallelWorkflow = createWorkflow({
    id: "parallel-processing",
    inputSchema: ticketInputSchema,
    outputSchema: combinedOutputSchema
})
    // Execute all three steps simultaneously
    .parallel([sentimentStep, priorityStep, suggestionsStep])
    // Combine results from parallel execution
    .then(combineStep)
    .commit();

// Each parallel step receives the same input
const sentimentStep = createStep({
    id: "sentiment",
    inputSchema: ticketInputSchema,
    outputSchema: sentimentSchema,
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");
        // Analyze sentiment...
        return { emotion, confidence, indicators };
    }
});`}
                                    </pre>
                                </CollapsibleContent>
                            </Collapsible>

                            <div className="rounded-lg border border-blue-200 bg-blue-100/50 p-3 dark:border-blue-800 dark:bg-blue-900/30">
                                <h4 className="mb-1 font-semibold text-blue-700 dark:text-blue-300">
                                    Agentic System Integration
                                </h4>
                                <p className="text-muted-foreground text-xs">
                                    In agentic systems, use parallel workflows when an agent needs
                                    to gather multiple pieces of information before making a
                                    decision. For example, before responding to a user, an agent
                                    could simultaneously: check user permissions, fetch relevant
                                    context from RAG, analyze the query intent, and retrieve user
                                    history—then combine all results to generate an informed
                                    response.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

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
                    {/* Educational Content */}
                    <Card className="mb-6 border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
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
                                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                    />
                                </svg>
                                Understanding Branch Workflows
                            </CardTitle>
                            <CardDescription>
                                Route execution to different paths based on conditions or AI
                                classification
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div>
                                <h4 className="mb-2 font-semibold text-purple-700 dark:text-purple-300">
                                    What is a Branch Workflow?
                                </h4>
                                <p className="text-muted-foreground">
                                    A branch workflow evaluates conditions and routes execution to
                                    different paths accordingly. Think of it like a switch statement
                                    in code—based on the input or a classification step, the
                                    workflow chooses which specialized handler to run. Only one
                                    branch executes, making it efficient for mutually exclusive
                                    scenarios.
                                </p>
                            </div>

                            <div>
                                <h4 className="mb-2 font-semibold text-purple-700 dark:text-purple-300">
                                    How It Works
                                </h4>
                                <ol className="text-muted-foreground list-decimal space-y-1 pl-5">
                                    <li>
                                        A classification step analyzes the input and determines the
                                        category
                                    </li>
                                    <li>
                                        Branch conditions are evaluated in order (first match wins)
                                    </li>
                                    <li>
                                        The workflow executes only the matching branch&apos;s steps
                                    </li>
                                    <li>A finalize step can normalize outputs from any branch</li>
                                </ol>
                            </div>

                            <div>
                                <h4 className="mb-2 font-semibold text-purple-700 dark:text-purple-300">
                                    When to Use Branch Workflows
                                </h4>
                                <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                                    <li>
                                        <strong>Intelligent routing:</strong> Route requests to
                                        billing, support, product, or general teams
                                    </li>
                                    <li>
                                        <strong>Content processing:</strong> Handle images, videos,
                                        and text differently
                                    </li>
                                    <li>
                                        <strong>Tier-based logic:</strong> Different processing for
                                        free vs. premium users
                                    </li>
                                    <li>
                                        <strong>Error handling:</strong> Different recovery paths
                                        for different error types
                                    </li>
                                </ul>
                            </div>

                            <Collapsible>
                                <CollapsibleTrigger className="flex items-center gap-2 font-medium text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200">
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
                                            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                                        />
                                    </svg>
                                    View Mastra Code Example
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-3">
                                    <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-xs">
                                        {`// Define branch workflow with Mastra
const branchWorkflow = createWorkflow({
    id: "conditional-branch",
    inputSchema: requestInputSchema,
    outputSchema: routingOutputSchema
})
    // First, classify the request type
    .then(classifyStep)
    // Branch based on classification result
    .branch([
        [async ({ inputData }) => inputData.requestType === "refund", handleRefundStep],
        [async ({ inputData }) => inputData.requestType === "technical", handleTechnicalStep],
        [async ({ inputData }) => inputData.requestType === "feature", handleFeatureStep],
        [async ({ inputData }) => inputData.requestType === "general", handleGeneralStep]
    ])
    // Normalize the output from whichever branch ran
    .then(finalizeStep)
    .commit();

// Classification step uses AI to determine request type
const classifyStep = createStep({
    id: "classify",
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");
        // AI classifies into: refund, technical, feature, or general
        return { ...inputData, requestType, confidence };
    }
});`}
                                    </pre>
                                </CollapsibleContent>
                            </Collapsible>

                            <div className="rounded-lg border border-purple-200 bg-purple-100/50 p-3 dark:border-purple-800 dark:bg-purple-900/30">
                                <h4 className="mb-1 font-semibold text-purple-700 dark:text-purple-300">
                                    Agentic System Integration
                                </h4>
                                <p className="text-muted-foreground text-xs">
                                    Branch workflows enable intelligent agent orchestration. When
                                    building multi-agent systems, use branches to route tasks to
                                    specialized agents: a coding agent for technical questions, a
                                    research agent for data gathering, or a creative agent for
                                    content generation. The classification step acts as a
                                    &quot;router agent&quot; that understands the request and
                                    delegates to the right specialist.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

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
                    {/* Educational Content */}
                    <Card className="mb-6 border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
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
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                </svg>
                                Understanding ForEach Workflows
                            </CardTitle>
                            <CardDescription>
                                Process arrays of items with configurable concurrency for efficient
                                batch operations
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div>
                                <h4 className="mb-2 font-semibold text-green-700 dark:text-green-300">
                                    What is a ForEach Workflow?
                                </h4>
                                <p className="text-muted-foreground">
                                    A ForEach workflow iterates over an array of items and applies
                                    the same processing step to each one. Unlike a simple loop,
                                    Mastra&apos;s ForEach supports configurable concurrency—you can
                                    process 3, 5, or 10 items simultaneously while respecting API
                                    rate limits. Results are automatically collected into an array
                                    for aggregation.
                                </p>
                            </div>

                            <div>
                                <h4 className="mb-2 font-semibold text-green-700 dark:text-green-300">
                                    How It Works
                                </h4>
                                <ol className="text-muted-foreground list-decimal space-y-1 pl-5">
                                    <li>
                                        A prepare step transforms input into an array of items to
                                        process
                                    </li>
                                    <li>
                                        The ForEach step processes items with controlled concurrency
                                        (e.g., 3 at a time)
                                    </li>
                                    <li>
                                        Each item goes through the same processing step
                                        independently
                                    </li>
                                    <li>An aggregate step combines all results for final output</li>
                                </ol>
                            </div>

                            <div>
                                <h4 className="mb-2 font-semibold text-green-700 dark:text-green-300">
                                    When to Use ForEach Workflows
                                </h4>
                                <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                                    <li>
                                        <strong>Batch AI processing:</strong> Enrich, score, or
                                        analyze lists of records
                                    </li>
                                    <li>
                                        <strong>API orchestration:</strong> Call external APIs for
                                        each item with rate limiting
                                    </li>
                                    <li>
                                        <strong>Document processing:</strong> Analyze multiple
                                        documents or files
                                    </li>
                                    <li>
                                        <strong>Email campaigns:</strong> Generate personalized
                                        content for each recipient
                                    </li>
                                </ul>
                            </div>

                            <Collapsible>
                                <CollapsibleTrigger className="flex items-center gap-2 font-medium text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200">
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
                                            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                                        />
                                    </svg>
                                    View Mastra Code Example
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-3">
                                    <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-xs">
                                        {`// Define foreach workflow with Mastra
const foreachWorkflow = createWorkflow({
    id: "foreach-loop",
    inputSchema: z.object({ companies: z.array(z.string()) }),
    outputSchema: enrichedLeadsSchema
})
    // Transform input into processable array
    .then(prepareStep)
    // Process each item with concurrency limit
    .foreach(processLeadStep, { concurrency: 3 })
    // Aggregate all results
    .then(aggregateStep)
    .commit();

// Each iteration receives a single item
const processLeadStep = createStep({
    id: "process-lead",
    inputSchema: z.object({ companyName: z.string(), index: z.number() }),
    outputSchema: enrichedLeadSchema,
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");
        // AI enriches this single lead
        return { 
            companyName: inputData.companyName,
            industry, estimatedSize, leadScore, ...
        };
    }
});

// Aggregate step receives array of all processed results
const aggregateStep = createStep({
    inputSchema: z.array(enrichedLeadSchema),
    execute: async ({ inputData }) => {
        const sortedLeads = inputData.sort((a, b) => b.leadScore - a.leadScore);
        return { leads: sortedLeads, summary: { ... } };
    }
});`}
                                    </pre>
                                </CollapsibleContent>
                            </Collapsible>

                            <div className="rounded-lg border border-green-200 bg-green-100/50 p-3 dark:border-green-800 dark:bg-green-900/30">
                                <h4 className="mb-1 font-semibold text-green-700 dark:text-green-300">
                                    Agentic System Integration
                                </h4>
                                <p className="text-muted-foreground text-xs">
                                    ForEach workflows are essential for scaling agentic operations.
                                    Use them to process batches of user requests, enrich CRM records
                                    with AI insights, generate personalized outreach for sales
                                    leads, or analyze multiple data sources. The concurrency control
                                    ensures you respect API rate limits while maximizing throughput.
                                    Combine with memory to track which items have been processed.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

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
                    {/* Educational Content */}
                    <Card className="mb-6 border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
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
                                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                    />
                                </svg>
                                Understanding Human-in-the-Loop Workflows
                            </CardTitle>
                            <CardDescription>
                                Pause AI workflows at critical checkpoints for human review,
                                approval, or intervention
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div>
                                <h4 className="mb-2 font-semibold text-amber-700 dark:text-amber-300">
                                    What is a Human-in-the-Loop Workflow?
                                </h4>
                                <p className="text-muted-foreground">
                                    A Human-in-the-Loop (HITL) workflow suspends execution at
                                    designated checkpoints to wait for human input before
                                    continuing. The workflow state is persisted, allowing humans to
                                    review AI-generated content, make decisions, edit outputs, or
                                    approve actions—then resume the workflow from where it paused.
                                    This ensures human oversight for high-stakes operations.
                                </p>
                            </div>

                            <div>
                                <h4 className="mb-2 font-semibold text-amber-700 dark:text-amber-300">
                                    How It Works
                                </h4>
                                <ol className="text-muted-foreground list-decimal space-y-1 pl-5">
                                    <li>
                                        Workflow executes until it reaches a step with{" "}
                                        <code className="bg-muted rounded px-1">suspend()</code>
                                    </li>
                                    <li>
                                        State is persisted with a unique runId for later retrieval
                                    </li>
                                    <li>The UI/API notifies humans and presents data for review</li>
                                    <li>
                                        Human provides input (approve, reject, edit) via{" "}
                                        <code className="bg-muted rounded px-1">resumeData</code>
                                    </li>
                                    <li>
                                        Workflow resumes from the suspended step with human input
                                    </li>
                                </ol>
                            </div>

                            <div>
                                <h4 className="mb-2 font-semibold text-amber-700 dark:text-amber-300">
                                    When to Use Human-in-the-Loop
                                </h4>
                                <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                                    <li>
                                        <strong>Content moderation:</strong> Review AI-generated
                                        content before publishing
                                    </li>
                                    <li>
                                        <strong>Financial decisions:</strong> Approve transactions,
                                        refunds, or budget changes
                                    </li>
                                    <li>
                                        <strong>Legal/compliance:</strong> Verify AI outputs meet
                                        regulatory requirements
                                    </li>
                                    <li>
                                        <strong>Quality gates:</strong> Ensure AI work meets quality
                                        standards before proceeding
                                    </li>
                                </ul>
                            </div>

                            <Collapsible>
                                <CollapsibleTrigger className="flex items-center gap-2 font-medium text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200">
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
                                            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                                        />
                                    </svg>
                                    View Mastra Code Example
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-3">
                                    <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-xs">
                                        {`// Define human approval workflow with Mastra
const humanApprovalWorkflow = createWorkflow({
    id: "human-approval",
    inputSchema: contentInputSchema,
    outputSchema: publishResultSchema
})
    .then(generateDraftStep)    // AI generates content
    .then(prepareReviewStep)    // Format for human review
    .then(approvalStep)         // SUSPEND here for human input
    .then(publishStep)          // Execute based on approval
    .commit();

// The approval step suspends and resumes
const approvalStep = createStep({
    id: "human-approval",
    inputSchema: reviewDataSchema,
    outputSchema: approvalResultSchema,
    // Define what data humans can provide on resume
    resumeSchema: z.object({
        approved: z.boolean(),
        approvedBy: z.string().optional(),
        editedContent: z.string().optional(),
        rejectionReason: z.string().optional()
    }),
    // Define what data to show humans while suspended
    suspendSchema: z.object({
        reason: z.string(),
        content: z.string(),
        preview: z.string()
    }),
    execute: async ({ inputData, resumeData, suspend }) => {
        // If we have resume data, human has responded
        if (resumeData?.approved !== undefined) {
            return {
                approved: resumeData.approved,
                content: resumeData.editedContent || inputData.draft.content,
                approvedBy: resumeData.approvedBy
            };
        }
        // Otherwise, suspend and wait for human
        return await suspend({
            reason: "Human review required",
            content: inputData.draft.content,
            preview: inputData.preview
        });
    }
});

// Resume the workflow via API
const result = await workflow.resume(runId, stepId, {
    approved: true,
    approvedBy: "editor@company.com",
    editedContent: "Updated content here..."
});`}
                                    </pre>
                                </CollapsibleContent>
                            </Collapsible>

                            <div className="rounded-lg border border-amber-200 bg-amber-100/50 p-3 dark:border-amber-800 dark:bg-amber-900/30">
                                <h4 className="mb-1 font-semibold text-amber-700 dark:text-amber-300">
                                    Agentic System Integration
                                </h4>
                                <p className="text-muted-foreground text-xs">
                                    HITL workflows are critical for responsible AI deployment.
                                    Insert approval gates before: sending emails to customers,
                                    making database changes, publishing content, processing
                                    payments, or executing any irreversible action. Combine with
                                    notification systems (Slack, email) to alert reviewers. Use
                                    confidence thresholds—auto-approve high-confidence outputs while
                                    routing low-confidence cases for human review.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

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

                {/* ================================================================ */}
                {/* COMBINED WORKFLOW TAB */}
                {/* ================================================================ */}
                <TabsContent value="combined">
                    {/* Educational Content */}
                    <Card className="mb-6 border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:border-indigo-800 dark:from-indigo-950/20 dark:to-purple-950/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
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
                                        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                                    />
                                </svg>
                                Combined Workflow Patterns
                            </CardTitle>
                            <CardDescription>
                                Real-world workflows often combine multiple patterns to handle
                                complex business logic
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div>
                                <h4 className="mb-2 font-semibold text-indigo-700 dark:text-indigo-300">
                                    Why Combine Workflow Patterns?
                                </h4>
                                <p className="text-muted-foreground">
                                    Production agentic systems rarely use just one pattern. A
                                    customer service workflow might need to: gather context from
                                    multiple sources <strong>(Parallel)</strong>, route to the right
                                    team <strong>(Branch)</strong>, process multiple issues{" "}
                                    <strong>(ForEach)</strong>, and require manager approval for
                                    high-value actions <strong>(Human-in-the-Loop)</strong>.
                                    Combining patterns creates sophisticated, production-ready
                                    automation.
                                </p>
                            </div>

                            <div className="bg-muted/50 rounded-lg p-4">
                                <h4 className="mb-3 font-semibold text-indigo-700 dark:text-indigo-300">
                                    Customer Service Command Center Flow
                                </h4>
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                            P
                                        </span>
                                        <div>
                                            <p className="font-medium">1. Parallel Analysis</p>
                                            <p className="text-muted-foreground text-xs">
                                                Simultaneously: analyze sentiment, classify intent,
                                                fetch customer history, check account tier
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                            B
                                        </span>
                                        <div>
                                            <p className="font-medium">
                                                2. Branch: Route to Handler
                                            </p>
                                            <p className="text-muted-foreground text-xs">
                                                Based on classification: Billing, Technical Support,
                                                Product, or General Inquiry team
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700 dark:bg-green-900 dark:text-green-300">
                                            F
                                        </span>
                                        <div>
                                            <p className="font-medium">
                                                3. ForEach: Process Action Items
                                            </p>
                                            <p className="text-muted-foreground text-xs">
                                                If multiple issues detected, process each: refund
                                                request, technical escalation, feature request, etc.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                            H
                                        </span>
                                        <div>
                                            <p className="font-medium">4. Human Approval Gate</p>
                                            <p className="text-muted-foreground text-xs">
                                                For high-value customers or sensitive actions
                                                (refunds &gt; $100, account changes, escalations):
                                                suspend for manager review
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Collapsible>
                                <CollapsibleTrigger className="flex items-center gap-2 font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200">
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
                                            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                                        />
                                    </svg>
                                    View Combined Mastra Code Pattern
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-3">
                                    <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-xs">
                                        {`// Combined workflow example - Customer Service Command Center
const customerServiceWorkflow = createWorkflow({
    id: "customer-service-command-center",
    inputSchema: customerInquirySchema,
    outputSchema: resolutionSchema
})
    // Step 1: PARALLEL - Gather all context simultaneously
    .parallel([
        analyzeSentimentStep,      // Detect customer emotion
        classifyIntentStep,        // Categorize the request
        fetchCustomerHistoryStep,  // Get account & history
        checkAccountTierStep       // Verify SLA/priority level
    ])
    
    // Step 2: BRANCH - Route to appropriate handler
    .branch([
        [async ({ inputData }) => inputData.intent === "billing", handleBillingStep],
        [async ({ inputData }) => inputData.intent === "technical", handleTechnicalStep],
        [async ({ inputData }) => inputData.intent === "feature", handleFeatureStep],
        [async () => true, handleGeneralStep]  // Default fallback
    ])
    
    // Step 3: FOREACH - Process each action item identified
    .foreach(processActionItemStep, { concurrency: 2 })
    
    // Step 4: CONDITIONAL APPROVAL - Only for high-value actions
    .then(conditionalApprovalStep)  // Uses suspend() if needed
    
    // Step 5: Execute approved actions
    .then(executeActionsStep)
    .commit();

// Conditional approval step - suspends only when needed
const conditionalApprovalStep = createStep({
    id: "conditional-approval",
    execute: async ({ inputData, suspend }) => {
        const needsApproval = 
            inputData.accountTier === "enterprise" ||
            inputData.totalRefundAmount > 100 ||
            inputData.requiresEscalation;
            
        if (needsApproval) {
            return await suspend({
                reason: "Manager approval required",
                customer: inputData.customerName,
                proposedActions: inputData.actions,
                estimatedValue: inputData.accountValue
            });
        }
        
        // Auto-approve low-risk actions
        return { approved: true, autoApproved: true };
    }
});`}
                                    </pre>
                                </CollapsibleContent>
                            </Collapsible>

                            <div className="rounded-lg border border-indigo-200 bg-indigo-100/50 p-3 dark:border-indigo-800 dark:bg-indigo-900/30">
                                <h4 className="mb-1 font-semibold text-indigo-700 dark:text-indigo-300">
                                    Building Production Agentic Systems
                                </h4>
                                <p className="text-muted-foreground text-xs">
                                    Combined workflows are the foundation of production AI systems.
                                    Design with: (1) <strong>Parallel gathering</strong> for fast
                                    context retrieval, (2) <strong>Intelligent branching</strong>{" "}
                                    for specialized handling, (3) <strong>Batch processing</strong>{" "}
                                    for scalability, and (4) <strong>Human checkpoints</strong> for
                                    safety and compliance. Add observability, error handling, and
                                    retry logic for production readiness.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Customer Service Command Center</CardTitle>
                                    <CardDescription>
                                        A complex workflow combining parallel analysis, intelligent
                                        routing, batch processing, and human approval for enterprise
                                        customer service
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Preset buttons */}
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
                                            Scenario Presets
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setCombinedInput(combinedPresets.multiIssue)
                                                }
                                                className="border-red-200 bg-red-50 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:hover:bg-red-900"
                                            >
                                                Multi-Issue (Urgent)
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setCombinedInput(combinedPresets.escalation)
                                                }
                                                className="border-orange-200 bg-orange-50 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950 dark:hover:bg-orange-900"
                                            >
                                                Escalation Request
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setCombinedInput(combinedPresets.simpleQuestion)
                                                }
                                                className="border-blue-200 bg-blue-50 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:hover:bg-blue-900"
                                            >
                                                Simple Question
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setCombinedInput(combinedPresets.praise)
                                                }
                                                className="border-green-200 bg-green-50 hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:hover:bg-green-900"
                                            >
                                                Positive Feedback
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Input fields */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="mb-1 block text-sm font-medium">
                                                Customer Name
                                            </label>
                                            <Input
                                                value={combinedInput.customerName}
                                                onChange={(e) =>
                                                    setCombinedInput({
                                                        ...combinedInput,
                                                        customerName: e.target.value
                                                    })
                                                }
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm font-medium">
                                                Email
                                            </label>
                                            <Input
                                                value={combinedInput.customerEmail}
                                                onChange={(e) =>
                                                    setCombinedInput({
                                                        ...combinedInput,
                                                        customerEmail: e.target.value
                                                    })
                                                }
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm font-medium">
                                                Account Tier
                                            </label>
                                            <select
                                                value={combinedInput.accountTier}
                                                onChange={(e) =>
                                                    setCombinedInput({
                                                        ...combinedInput,
                                                        accountTier: e.target.value as
                                                            | "starter"
                                                            | "professional"
                                                            | "enterprise"
                                                    })
                                                }
                                                className="bg-background w-full rounded-md border p-2"
                                            >
                                                <option value="starter">Starter</option>
                                                <option value="professional">Professional</option>
                                                <option value="enterprise">Enterprise</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-medium">
                                            Subject
                                        </label>
                                        <Input
                                            value={combinedInput.subject}
                                            onChange={(e) =>
                                                setCombinedInput({
                                                    ...combinedInput,
                                                    subject: e.target.value
                                                })
                                            }
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-medium">
                                            Message
                                        </label>
                                        <Textarea
                                            value={combinedInput.message}
                                            onChange={(e) =>
                                                setCombinedInput({
                                                    ...combinedInput,
                                                    message: e.target.value
                                                })
                                            }
                                            rows={6}
                                        />
                                    </div>

                                    <Button
                                        onClick={runCombinedWorkflow}
                                        disabled={
                                            combinedLoading ||
                                            combinedResult?.status === "suspended"
                                        }
                                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                    >
                                        {combinedLoading
                                            ? "Processing..."
                                            : "Process Customer Request"}
                                    </Button>

                                    {/* Suspended state - Show approval panel */}
                                    {combinedResult?.status === "suspended" &&
                                        combinedResult.runId &&
                                        combinedResult.suspended?.[0] && (
                                            <div className="space-y-4">
                                                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
                                                    <div className="mb-3 flex items-center gap-2 text-amber-700 dark:text-amber-300">
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
                                                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                                            />
                                                        </svg>
                                                        <span className="font-semibold">
                                                            Manager Approval Required
                                                        </span>
                                                    </div>

                                                    <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <p className="text-muted-foreground text-xs">
                                                                Customer
                                                            </p>
                                                            <p className="font-medium">
                                                                {
                                                                    combinedResult.suspended[0].data
                                                                        .customerName as string
                                                                }
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground text-xs">
                                                                Account Tier
                                                            </p>
                                                            <p className="font-medium capitalize">
                                                                {
                                                                    combinedResult.suspended[0].data
                                                                        .accountTier as string
                                                                }
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground text-xs">
                                                                Account Value
                                                            </p>
                                                            <p className="font-medium">
                                                                {
                                                                    (
                                                                        combinedResult.suspended[0]
                                                                            .data
                                                                            .analysis as Record<
                                                                            string,
                                                                            unknown
                                                                        >
                                                                    )?.estimatedValue as string
                                                                }
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground text-xs">
                                                                Issues Detected
                                                            </p>
                                                            <p className="font-medium">
                                                                {
                                                                    (
                                                                        combinedResult.suspended[0]
                                                                            .data
                                                                            .analysis as Record<
                                                                            string,
                                                                            unknown
                                                                        >
                                                                    )?.issueCount as number
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="mb-4">
                                                        <p className="text-muted-foreground mb-2 text-xs">
                                                            Proposed Actions
                                                        </p>
                                                        <ul className="space-y-1">
                                                            {(
                                                                combinedResult.suspended[0].data
                                                                    .proposedActions as string[]
                                                            )?.map((action, i) => (
                                                                <li
                                                                    key={i}
                                                                    className="flex items-center gap-2 text-sm"
                                                                >
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                                    {action}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    <div className="bg-background/50 mb-4 rounded p-2 text-xs">
                                                        <p className="text-muted-foreground">
                                                            {
                                                                combinedResult.suspended[0].data
                                                                    .reviewReason as string
                                                            }
                                                        </p>
                                                    </div>

                                                    <div className="flex gap-3">
                                                        <Button
                                                            onClick={() =>
                                                                handleCombinedApprove(
                                                                    combinedResult.runId!,
                                                                    "approval-gate",
                                                                    {
                                                                        approved: true,
                                                                        approvedBy: "Manager"
                                                                    }
                                                                )
                                                            }
                                                            disabled={combinedLoading}
                                                            className="flex-1 bg-green-600 hover:bg-green-700"
                                                        >
                                                            Approve All Actions
                                                        </Button>
                                                        <Button
                                                            onClick={() =>
                                                                handleCombinedReject(
                                                                    combinedResult.runId!,
                                                                    "approval-gate",
                                                                    {
                                                                        approved: false,
                                                                        approvedBy: "Manager",
                                                                        rejectionReason:
                                                                            "Needs further review"
                                                                    }
                                                                )
                                                            }
                                                            disabled={combinedLoading}
                                                            variant="outline"
                                                            className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                                                        >
                                                            Reject
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                    {/* Success result */}
                                    {combinedResult?.status === "success" &&
                                        combinedResult.result && (
                                            <div className="space-y-4">
                                                <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950/30">
                                                    <div className="mb-3 flex items-center gap-2 text-green-700 dark:text-green-300">
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
                                                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                                            />
                                                        </svg>
                                                        <span className="font-semibold">
                                                            Workflow Completed
                                                        </span>
                                                    </div>

                                                    <div className="mb-3 grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <p className="text-muted-foreground text-xs">
                                                                Ticket ID
                                                            </p>
                                                            <code className="font-medium">
                                                                {
                                                                    combinedResult.result
                                                                        .ticketId as string
                                                                }
                                                            </code>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground text-xs">
                                                                Customer
                                                            </p>
                                                            <p className="font-medium">
                                                                {
                                                                    combinedResult.result
                                                                        .customerName as string
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {(
                                                        combinedResult.result.approval as Record<
                                                            string,
                                                            unknown
                                                        >
                                                    )?.approved !== undefined && (
                                                        <div className="mb-3 rounded border border-green-200 bg-green-100/50 p-2 text-sm dark:border-green-800 dark:bg-green-900/30">
                                                            <p className="text-muted-foreground text-xs">
                                                                Approval Status
                                                            </p>
                                                            <p className="font-medium">
                                                                {(
                                                                    combinedResult.result
                                                                        .approval as Record<
                                                                        string,
                                                                        unknown
                                                                    >
                                                                )?.approved
                                                                    ? "✓ Approved"
                                                                    : "✗ Rejected"}{" "}
                                                                by{" "}
                                                                {
                                                                    (
                                                                        combinedResult.result
                                                                            .approval as Record<
                                                                            string,
                                                                            unknown
                                                                        >
                                                                    )?.approvedBy as string
                                                                }
                                                            </p>
                                                        </div>
                                                    )}

                                                    {(
                                                        combinedResult.result
                                                            .actionsExecuted as Array<{
                                                            action: string;
                                                            status: string;
                                                        }>
                                                    )?.length > 0 && (
                                                        <div className="mb-3">
                                                            <p className="text-muted-foreground mb-1 text-xs">
                                                                Actions Executed
                                                            </p>
                                                            <ul className="space-y-1">
                                                                {(
                                                                    combinedResult.result
                                                                        .actionsExecuted as Array<{
                                                                        action: string;
                                                                        status: string;
                                                                    }>
                                                                ).map((item, i) => (
                                                                    <li
                                                                        key={i}
                                                                        className="flex items-center gap-2 text-sm"
                                                                    >
                                                                        <svg
                                                                            className="h-4 w-4 text-green-600"
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
                                                                        {item.action}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    <p className="text-sm">
                                                        {combinedResult.result.summary as string}
                                                    </p>
                                                </div>

                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setCombinedResult(null);
                                                        setCombinedSteps([]);
                                                    }}
                                                    className="w-full"
                                                >
                                                    Process Another Request
                                                </Button>
                                            </div>
                                        )}

                                    {/* Raw JSON toggle */}
                                    {combinedResult && (
                                        <Collapsible>
                                            <CollapsibleTrigger className="text-muted-foreground hover:text-foreground text-xs">
                                                View Raw JSON
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <pre className="bg-muted mt-2 max-h-64 overflow-auto rounded p-4 text-xs">
                                                    {JSON.stringify(combinedResult, null, 2)}
                                                </pre>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right sidebar */}
                        <div className="space-y-4">
                            {/* Combined workflow visualizer */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm">Combined Flow</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {combinedSteps.length === 0 ? (
                                            <div className="space-y-2">
                                                {[
                                                    {
                                                        id: "intake",
                                                        label: "Intake",
                                                        pattern: "Start"
                                                    },
                                                    {
                                                        id: "parallel",
                                                        label: "Parallel Analysis",
                                                        pattern: "P"
                                                    },
                                                    {
                                                        id: "branch",
                                                        label: "Route",
                                                        pattern: "B"
                                                    },
                                                    {
                                                        id: "foreach",
                                                        label: "Process Items",
                                                        pattern: "F"
                                                    },
                                                    {
                                                        id: "approval",
                                                        label: "Approval Gate",
                                                        pattern: "H"
                                                    },
                                                    {
                                                        id: "execute",
                                                        label: "Execute",
                                                        pattern: "End"
                                                    }
                                                ].map((step) => (
                                                    <div
                                                        key={step.id}
                                                        className="flex items-center gap-3"
                                                    >
                                                        <div
                                                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                                                                step.pattern === "P"
                                                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                                                    : step.pattern === "B"
                                                                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                                                                      : step.pattern === "F"
                                                                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                                                        : step.pattern === "H"
                                                                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                                                                          : "bg-muted text-muted-foreground"
                                                            }`}
                                                        >
                                                            {step.pattern}
                                                        </div>
                                                        <span className="text-muted-foreground text-sm">
                                                            {step.label}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            combinedSteps.map((step) => (
                                                <div
                                                    key={step.id}
                                                    className="flex items-center gap-3"
                                                >
                                                    <div
                                                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                                                            step.status === "completed"
                                                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                                                : step.status === "running"
                                                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                                                  : step.status === "suspended"
                                                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                                                                    : step.status === "error"
                                                                      ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                                                      : "bg-muted text-muted-foreground"
                                                        }`}
                                                    >
                                                        {step.status === "completed"
                                                            ? "✓"
                                                            : step.status === "running"
                                                              ? "..."
                                                              : step.status === "suspended"
                                                                ? "⏸"
                                                                : step.status === "error"
                                                                  ? "✗"
                                                                  : "○"}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p
                                                            className={`text-sm ${
                                                                step.status === "pending"
                                                                    ? "text-muted-foreground"
                                                                    : ""
                                                            }`}
                                                        >
                                                            {step.label}
                                                        </p>
                                                        {step.timing && (
                                                            <p className="text-muted-foreground text-xs">
                                                                {step.timing}ms
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Pattern legend */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm">Patterns Used</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-100 text-[10px] font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                                P
                                            </span>
                                            <span>Parallel</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-5 w-5 items-center justify-center rounded bg-purple-100 text-[10px] font-bold text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                                B
                                            </span>
                                            <span>Branch</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-5 w-5 items-center justify-center rounded bg-green-100 text-[10px] font-bold text-green-700 dark:bg-green-900 dark:text-green-300">
                                                F
                                            </span>
                                            <span>ForEach</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-100 text-[10px] font-bold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                                H
                                            </span>
                                            <span>Human</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
