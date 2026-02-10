"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { WelcomeStep } from "@/components/onboarding/WelcomeStep";
import { TemplateStep } from "@/components/onboarding/TemplateStep";
import { ConfigureStep } from "@/components/onboarding/ConfigureStep";
import { IntegrationsStep } from "@/components/onboarding/IntegrationsStep";
import { ToolStep } from "@/components/onboarding/ToolStep";
import { TestStep } from "@/components/onboarding/TestStep";
import { SuccessStep } from "@/components/onboarding/SuccessStep";

export type OnboardingStep =
    | "welcome"
    | "template"
    | "configure"
    | "integrations"
    | "tools"
    | "test"
    | "success";

export interface AgentTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    modelProvider: string;
    modelName: string;
    tools: string[];
    instructions: string;
    popular?: boolean;
}

export interface ToolInfo {
    id: string;
    name: string;
    description: string;
    source?: string;
}

export interface OnboardingData {
    selectedTemplate: AgentTemplate | null;
    agentName: string;
    agentDescription: string;
    modelProvider: string;
    modelName: string;
    instructions: string;
    selectedTools: string[];
    createdAgentId: string | null;
    createdAgentSlug: string | null;
}

export const TEMPLATES: AgentTemplate[] = [
    {
        id: "general-assistant",
        name: "General Assistant",
        description: "Versatile assistant for everyday tasks, questions, and conversations",
        icon: "\u2728",
        color: "bg-violet-100 text-violet-700",
        modelProvider: "openai",
        modelName: "gpt-4o",
        tools: ["calculator", "web-fetch", "date-time"],
        instructions: `You are a versatile AI assistant. Your role is to:

1. Answer questions clearly and accurately
2. Help with a wide range of tasks from writing to analysis
3. Use your tools when they can provide better answers
4. Be conversational but precise
5. Ask clarifying questions when the request is ambiguous

Be helpful, honest, and concise. If you're unsure about something, say so.`,
        popular: true
    },
    {
        id: "customer-support",
        name: "Customer Support",
        description: "Friendly assistant for customer inquiries and support tickets",
        icon: "\uD83C\uDFA7",
        color: "bg-blue-100 text-blue-700",
        modelProvider: "openai",
        modelName: "gpt-4o",
        tools: ["memory-recall", "web-fetch"],
        instructions: `You are a friendly and helpful customer support agent. Your role is to:

1. Listen carefully to customer questions and concerns
2. Provide clear, accurate, and helpful responses
3. Escalate complex issues when needed
4. Maintain a positive and professional tone
5. Follow up to ensure customer satisfaction

Always be empathetic and patient. If you don't know something, say so honestly rather than guessing.`
    },
    {
        id: "research-assistant",
        name: "Research Assistant",
        description: "Thorough researcher that finds and synthesizes information",
        icon: "\uD83D\uDD0D",
        color: "bg-emerald-100 text-emerald-700",
        modelProvider: "openai",
        modelName: "gpt-4o",
        tools: ["web-fetch", "json-parser"],
        instructions: `You are a thorough research assistant. Your role is to:

1. Understand research questions deeply before investigating
2. Find relevant, high-quality sources
3. Synthesize information from multiple sources
4. Cite your sources clearly
5. Provide balanced, well-reasoned conclusions

Always prioritize accuracy over speed. When presenting findings, structure them clearly with key takeaways.`
    },
    {
        id: "data-analyst",
        name: "Data Analyst",
        description: "Precise analyst for calculations and data interpretation",
        icon: "\uD83D\uDCCA",
        color: "bg-amber-100 text-amber-700",
        modelProvider: "openai",
        modelName: "gpt-4o",
        tools: ["calculator", "json-parser"],
        instructions: `You are a precise data analyst. Your role is to:

1. Analyze data accurately and thoroughly
2. Perform calculations step-by-step
3. Explain your reasoning clearly
4. Identify patterns and insights
5. Present findings in a clear, visual format when possible

Always show your work. Double-check calculations and be explicit about assumptions.`
    },
    {
        id: "blank",
        name: "Start from Scratch",
        description: "Build a custom agent with full control over every setting",
        icon: "\uD83D\uDEE0\uFE0F",
        color: "bg-zinc-100 text-zinc-700",
        modelProvider: "openai",
        modelName: "gpt-4o",
        tools: [],
        instructions:
            "You are a helpful AI assistant. Respond clearly and helpfully to user requests."
    }
];

const FALLBACK_TOOLS: ToolInfo[] = [
    { id: "calculator", name: "Calculator", description: "Math and calculations" },
    { id: "web-fetch", name: "Web Fetch", description: "Fetch data from URLs" },
    { id: "memory-recall", name: "Memory Recall", description: "Remember past conversations" },
    { id: "json-parser", name: "JSON Parser", description: "Parse and validate JSON" },
    { id: "date-time", name: "Date & Time", description: "Current date and time info" },
    { id: "generate-id", name: "Generate ID", description: "Create unique identifiers" }
];

// Persist onboarding state to localStorage to survive refreshes
const STORAGE_KEY = "agentc2_onboarding_state";

function loadPersistedState(): { step: OnboardingStep; data: OnboardingData } | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function persistState(step: OnboardingStep, data: OnboardingData) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data }));
    } catch {
        // Silently fail
    }
}

function clearPersistedState() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Silently fail
    }
}

export default function OnboardingPage() {
    const router = useRouter();

    // Restore state from localStorage if available
    const [initialized, setInitialized] = useState(false);
    const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
    const [availableTools, setAvailableTools] = useState<ToolInfo[]>(FALLBACK_TOOLS);
    const [data, setData] = useState<OnboardingData>({
        selectedTemplate: null,
        agentName: "",
        agentDescription: "",
        modelProvider: "openai",
        modelName: "gpt-4o",
        instructions: "",
        selectedTools: [],
        createdAgentId: null,
        createdAgentSlug: null
    });
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Initialize from persisted state
    useEffect(() => {
        const persisted = loadPersistedState();
        if (persisted) {
            setCurrentStep(persisted.step);
            setData(persisted.data);
        }
        setInitialized(true);
    }, []);

    // Persist state on changes
    useEffect(() => {
        if (initialized) {
            persistState(currentStep, data);
        }
    }, [currentStep, data, initialized]);

    // Fetch available tools from the registry
    // Filter out platform management tools that aren't relevant for agent configuration
    useEffect(() => {
        const PLATFORM_TOOL_PREFIXES = [
            "agent-",
            "workflow-",
            "network-",
            "live-",
            "audit-",
            "org-",
            "goal-",
            "rag-",
            "document-",
            "skill-",
            "trigger-",
            "integration-",
            "metrics-",
            "bim-",
            "webhook-",
            "canvas-",
            "workspace-",
            "gmail-",
            "ask-questions"
        ];

        const isAgentRelevantTool = (tool: ToolInfo) => {
            // MCP tools are always relevant
            if (tool.source?.startsWith("mcp:")) return true;
            // Filter out platform management tools from registry
            if (tool.source === "registry") {
                return !PLATFORM_TOOL_PREFIXES.some(
                    (prefix) => tool.id.startsWith(prefix) || tool.id === prefix
                );
            }
            return true;
        };

        const fetchTools = async () => {
            try {
                const response = await fetch(`${getApiBase()}/api/agents/tools`);
                const result = await response.json();
                if (result.success && Array.isArray(result.tools) && result.tools.length > 0) {
                    const filtered = (result.tools as ToolInfo[]).filter(isAgentRelevantTool);
                    if (filtered.length > 0) {
                        setAvailableTools(filtered);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch tools:", error);
            }
        };

        fetchTools();
    }, []);

    const updateData = useCallback((updates: Partial<OnboardingData>) => {
        setData((prev) => ({ ...prev, ...updates }));
    }, []);

    // ── Step flow ──────────────────────────────────────────────────────────

    /**
     * Dynamic step order based on the selected template.
     * Blank templates always go through tools; template-based agents
     * also go through tools now (pre-selected) so users can customize.
     */
    const getStepOrder = useCallback((): OnboardingStep[] => {
        return ["welcome", "template", "configure", "integrations", "tools", "test", "success"];
    }, []);

    const goBack = useCallback(() => {
        const steps = getStepOrder();
        const idx = steps.indexOf(currentStep);
        if (idx > 0) {
            setCurrentStep(steps[idx - 1]!);
        }
    }, [currentStep, getStepOrder]);

    const getProgress = useCallback(() => {
        const steps = getStepOrder().filter(
            (s) => s !== "welcome" && s !== "success"
        ) as OnboardingStep[];
        const idx = steps.indexOf(currentStep);
        if (idx < 0) return 0;
        return Math.round((idx / (steps.length - 1)) * 100);
    }, [currentStep, getStepOrder]);

    // ── Handlers ───────────────────────────────────────────────────────────

    const handleTemplateSelect = useCallback(
        (template: AgentTemplate) => {
            updateData({
                selectedTemplate: template,
                modelProvider: template.modelProvider,
                modelName: template.modelName,
                selectedTools: template.tools,
                instructions: template.instructions,
                agentName: template.id === "blank" ? "" : template.name
            });
            setCurrentStep("configure");
        },
        [updateData]
    );

    const handleConfigureComplete = useCallback(() => {
        setCurrentStep("integrations");
    }, []);

    const handleIntegrationsComplete = useCallback(() => {
        setCurrentStep("tools");
    }, []);

    const handleToolsComplete = () => {
        handleCreateAgent();
    };

    const handleCreateAgent = async () => {
        setIsCreating(true);
        setCreateError(null);
        try {
            const instructions =
                data.instructions.trim() ||
                "You are a helpful AI assistant. Respond clearly and helpfully to user requests.";

            const response = await fetch(`${getApiBase()}/api/agents`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: data.agentName,
                    description: data.agentDescription,
                    modelProvider: data.modelProvider,
                    modelName: data.modelName,
                    instructions,
                    tools: data.selectedTools,
                    memoryEnabled: data.selectedTools.includes("memory-recall"),
                    memoryConfig: data.selectedTools.includes("memory-recall")
                        ? { lastMessages: 10, semanticRecall: false }
                        : null
                })
            });

            const result = await response.json();

            if (response.ok) {
                updateData({
                    createdAgentId: result.agent.id,
                    createdAgentSlug: result.agent.slug
                });
                setCurrentStep("test");
            } else {
                setCreateError(result.error || "Failed to create agent. Please try again.");
            }
        } catch {
            setCreateError("Network error. Please check your connection and try again.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleTestComplete = useCallback(() => {
        setCurrentStep("success");
    }, []);

    const handleFinish = async () => {
        try {
            await fetch(`${getApiBase()}/api/onboarding/complete`, { method: "POST" });
        } catch (error) {
            console.error("Failed to complete onboarding:", error);
        }

        localStorage.setItem("agentc2_onboarding_complete", "true");
        clearPersistedState();

        // Navigate to home workspace
        router.push("/");
    };

    const handleSkipToDashboard = async () => {
        try {
            await fetch(`${getApiBase()}/api/onboarding/complete`, { method: "POST" });
        } catch {
            // Best-effort
        }
        localStorage.setItem("agentc2_onboarding_complete", "true");
        clearPersistedState();
        router.push("/");
    };

    // Don't render until we've checked localStorage for persisted state
    if (!initialized) {
        return null;
    }

    const showProgress =
        currentStep !== "welcome" && currentStep !== "success" && currentStep !== "test";

    return (
        <>
            {/* Progress bar */}
            {showProgress && (
                <div className="mb-8">
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                        <div
                            className="bg-primary h-full transition-all duration-500 ease-out"
                            style={{ width: `${getProgress()}%` }}
                        />
                    </div>
                    <div className="text-muted-foreground mt-2 text-center text-xs">
                        Step {getStepOrder().indexOf(currentStep)} of {getStepOrder().length - 2}
                    </div>
                </div>
            )}

            {/* Steps */}
            {currentStep === "welcome" && (
                <WelcomeStep
                    onContinue={() => setCurrentStep("template")}
                    onSkip={handleSkipToDashboard}
                />
            )}

            {currentStep === "template" && (
                <TemplateStep
                    templates={TEMPLATES}
                    onSelect={handleTemplateSelect}
                    onBack={goBack}
                />
            )}

            {currentStep === "configure" && (
                <ConfigureStep
                    data={data}
                    updateData={updateData}
                    onContinue={handleConfigureComplete}
                    onBack={goBack}
                />
            )}

            {currentStep === "integrations" && (
                <IntegrationsStep onContinue={handleIntegrationsComplete} onBack={goBack} />
            )}

            {currentStep === "tools" && (
                <ToolStep
                    data={data}
                    updateData={updateData}
                    availableTools={availableTools}
                    onContinue={handleToolsComplete}
                    onBack={goBack}
                    isCreating={isCreating}
                    createError={createError}
                />
            )}

            {currentStep === "test" && data.createdAgentSlug && (
                <TestStep
                    agentSlug={data.createdAgentSlug}
                    agentName={data.agentName}
                    modelName={data.modelName}
                    templateId={data.selectedTemplate?.id || null}
                    onContinue={handleTestComplete}
                />
            )}

            {currentStep === "success" && (
                <SuccessStep
                    agentName={data.agentName}
                    agentSlug={data.createdAgentSlug || ""}
                    modelProvider={data.modelProvider}
                    modelName={data.modelName}
                    toolCount={data.selectedTools.length}
                    onFinish={handleFinish}
                />
            )}
        </>
    );
}
