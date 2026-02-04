"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { WelcomeStep } from "@/components/onboarding/WelcomeStep";
import { TemplateStep } from "@/components/onboarding/TemplateStep";
import { ConfigureStep } from "@/components/onboarding/ConfigureStep";
import { ToolStep } from "@/components/onboarding/ToolStep";
import { TestStep } from "@/components/onboarding/TestStep";
import { SuccessStep } from "@/components/onboarding/SuccessStep";

export type OnboardingStep = "welcome" | "template" | "configure" | "tools" | "test" | "success";

export interface AgentTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    modelProvider: string;
    modelName: string;
    tools: string[];
    instructions: string;
}

interface ToolInfo {
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

const TEMPLATES: AgentTemplate[] = [
    {
        id: "customer-support",
        name: "Customer Support",
        description: "Friendly assistant for customer inquiries and support tickets",
        icon: "💬",
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
        icon: "🔍",
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
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
        icon: "📊",
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
        description: "Build a custom agent with full control",
        icon: "✨",
        modelProvider: "openai",
        modelName: "gpt-4o",
        tools: [],
        instructions:
            "You are a helpful AI assistant. Respond clearly and helpfully to user requests."
    }
];

const AVAILABLE_TOOLS = [
    { id: "calculator", name: "Calculator", description: "Math and calculations" },
    { id: "web-fetch", name: "Web Fetch", description: "Fetch data from URLs" },
    { id: "memory-recall", name: "Memory Recall", description: "Remember past conversations" },
    { id: "json-parser", name: "JSON Parser", description: "Parse and validate JSON" },
    { id: "date-time", name: "Date & Time", description: "Current date and time info" },
    { id: "generate-id", name: "Generate ID", description: "Create unique identifiers" }
];

export default function OnboardingPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
    const [availableTools, setAvailableTools] = useState<ToolInfo[]>(AVAILABLE_TOOLS);
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

    useEffect(() => {
        const fetchTools = async () => {
            try {
                const response = await fetch(`${getApiBase()}/api/agents/tools`);
                const result = await response.json();
                if (result.success && Array.isArray(result.tools) && result.tools.length > 0) {
                    setAvailableTools(result.tools);
                }
            } catch (error) {
                console.error("Failed to fetch tools:", error);
            }
        };

        fetchTools();
    }, []);

    const updateData = (updates: Partial<OnboardingData>) => {
        setData((prev) => ({ ...prev, ...updates }));
    };

    const handleTemplateSelect = (template: AgentTemplate) => {
        updateData({
            selectedTemplate: template,
            modelProvider: template.modelProvider,
            modelName: template.modelName,
            selectedTools: template.tools,
            instructions: template.instructions,
            agentName: template.id === "blank" ? "" : template.name
        });
        setCurrentStep("configure");
    };

    const handleConfigureComplete = () => {
        // If blank template, go to tools; otherwise skip to test
        if (data.selectedTemplate?.id === "blank") {
            setCurrentStep("tools");
        } else {
            handleCreateAgent();
        }
    };

    const handleToolsComplete = () => {
        handleCreateAgent();
    };

    const handleCreateAgent = async () => {
        setIsCreating(true);
        try {
            // Ensure instructions are not empty
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
                // Show error to user
                console.error("Failed to create agent:", result);
                alert(`Failed to create agent: ${result.error || "Unknown error"}`);
            }
        } catch (error) {
            console.error("Failed to create agent:", error);
            alert("Network error. Please check your connection and try again.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleTestComplete = () => {
        setCurrentStep("success");
    };

    const handleFinish = () => {
        // Mark onboarding as complete
        localStorage.setItem("agentc2_onboarding_complete", "true");
        router.push("/workspace");
    };

    const goBack = () => {
        const stepOrder: OnboardingStep[] = [
            "welcome",
            "template",
            "configure",
            "tools",
            "test",
            "success"
        ];
        const currentIndex = stepOrder.indexOf(currentStep);
        if (currentIndex > 0) {
            setCurrentStep(stepOrder[currentIndex - 1]);
        }
    };

    // Progress indicator
    const getProgress = () => {
        const steps: OnboardingStep[] = ["welcome", "template", "configure", "test", "success"];
        const currentIndex = steps.indexOf(currentStep);
        return Math.round((currentIndex / (steps.length - 1)) * 100);
    };

    return (
        <div className="mx-auto max-w-2xl">
            {/* Progress bar */}
            {currentStep !== "welcome" && currentStep !== "success" && (
                <div className="mb-8">
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                        <div
                            className="bg-primary h-full transition-all duration-300"
                            style={{ width: `${getProgress()}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Steps */}
            {currentStep === "welcome" && (
                <WelcomeStep onContinue={() => setCurrentStep("template")} />
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
                    isCreating={isCreating}
                />
            )}

            {currentStep === "tools" && (
                <ToolStep
                    data={data}
                    updateData={updateData}
                    availableTools={availableTools}
                    onContinue={handleToolsComplete}
                    onBack={goBack}
                    isCreating={isCreating}
                />
            )}

            {currentStep === "test" && data.createdAgentSlug && (
                <TestStep
                    agentSlug={data.createdAgentSlug}
                    agentName={data.agentName}
                    onContinue={handleTestComplete}
                />
            )}

            {currentStep === "success" && (
                <SuccessStep
                    agentName={data.agentName}
                    agentSlug={data.createdAgentSlug || ""}
                    onFinish={handleFinish}
                />
            )}
        </div>
    );
}
