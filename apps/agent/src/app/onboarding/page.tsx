"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiBase } from "@/lib/utils";

// Old flow components (kept for rollback via feature flag)
import { JoinOrgStep } from "@/components/onboarding/JoinOrgStep";
import { WelcomeStep } from "@/components/onboarding/WelcomeStep";
import { TemplateStep } from "@/components/onboarding/TemplateStep";
import { ConfigureStep } from "@/components/onboarding/ConfigureStep";
import { IntegrationsStep } from "@/components/onboarding/IntegrationsStep";
import { ToolStep } from "@/components/onboarding/ToolStep";
import { TestStep } from "@/components/onboarding/TestStep";
import { SuccessStep } from "@/components/onboarding/SuccessStep";

// New flow components
import { ConnectStep } from "@/components/onboarding/ConnectStep";
import { TeamWelcomeStep } from "@/components/onboarding/TeamWelcomeStep";

// ─── Shared Types ──────────────────────────────────────────────────────

export type OnboardingStep =
    | "join-org"
    | "welcome"
    | "template"
    | "configure"
    | "integrations"
    | "tools"
    | "test"
    | "success"
    // New flow steps
    | "connect"
    | "team-welcome";

interface SuggestedOrg {
    id: string;
    name: string;
    slug: string;
}

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

// ─── Templates (used by old flow) ──────────────────────────────────────

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
    {
        id: "memory-recall",
        name: "Memory Recall",
        description: "Remember past conversations"
    },
    { id: "json-parser", name: "JSON Parser", description: "Parse and validate JSON" },
    { id: "date-time", name: "Date & Time", description: "Current date and time info" },
    {
        id: "generate-id",
        name: "Generate ID",
        description: "Create unique identifiers"
    }
];

// ─── Local Storage Persistence ──────────────────────────────────────────

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

// ─── Feature flag check ──────────────────────────────────────────────

const isNewOnboarding = process.env.NEXT_PUBLIC_FEATURE_NEW_ONBOARDING === "true";

// ─── Page Component ──────────────────────────────────────────────────

export default function OnboardingPage() {
    const [initialized, setInitialized] = useState(false);
    const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
    const [suggestedOrg, setSuggestedOrg] = useState<SuggestedOrg | null>(null);
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
    const [mcpWarning, setMcpWarning] = useState<string | null>(null);

    // New flow state
    const [gmailConnected, setGmailConnected] = useState(false);
    const [gmailAddress, setGmailAddress] = useState<string | undefined>();
    const [gmailMissingScopes] = useState<string[] | undefined>();
    const [organizationId, setOrganizationId] = useState<string>("");
    const [userId, setUserId] = useState<string>("");
    const [onboardingPath, setOnboardingPath] = useState<string>("email_password");
    const [joinedOrgName, setJoinedOrgName] = useState<string>("");

    // ── Initialize ──────────────────────────────────────────────────────

    useEffect(() => {
        const init = async () => {
            const persisted = loadPersistedState();
            if (persisted) {
                setData(persisted.data);
            }

            // Helper: run Gmail sync + session info fetch (new flow only).
            // Must be called AFTER the user has an org membership.
            const initNewFlowIntegrations = async () => {
                if (!isNewOnboarding) return;

                // Ensure Gmail sync
                const gmailRes = await fetch(`${getApiBase()}/api/onboarding/ensure-gmail-sync`, {
                    method: "POST",
                    credentials: "include"
                });
                const gmailResult = await gmailRes.json();
                if (gmailResult.success && gmailResult.gmailConnected) {
                    setGmailConnected(true);
                    setGmailAddress(gmailResult.gmailAddress);
                    setOnboardingPath("google_oauth");
                }
                // Note: we intentionally do NOT surface gmailResult.missingScopes
                // during onboarding. If the user signed up with Google but
                // deselected some scopes on the consent screen, showing a
                // "missing permissions" warning here creates a confusing
                // half-connected state. The "Sign in with Google" card is
                // sufficient — they can re-authorize from Settings later.

                // Get session info for org/user IDs
                const sessionRes = await fetch(`${getApiBase()}/api/auth/session`, {
                    credentials: "include"
                });
                const sessionResult = await sessionRes.json();
                if (sessionResult?.user) {
                    setUserId(sessionResult.user.id);
                }

                // Get org ID from membership
                const membershipRes = await fetch(`${getApiBase()}/api/onboarding/status`, {
                    credentials: "include"
                });
                const membershipData = await membershipRes.json();
                if (membershipData.organizationId) {
                    setOrganizationId(membershipData.organizationId);
                }
            };

            try {
                // Check onboarding + membership status
                const statusRes = await fetch(`${getApiBase()}/api/onboarding/status`, {
                    credentials: "include"
                });
                const statusResult = await statusRes.json();

                if (statusResult.success && statusResult.onboardingComplete) {
                    // Already completed — redirect to dashboard
                    window.location.href = "/workspace";
                    return;
                }

                if (statusResult.success && statusResult.needsBootstrap) {
                    // No membership — always check for suggested org first.
                    // This is the primary org selection gate: domain match
                    // (OrganizationDomain table) or member-email fallback.
                    const suggestedRes = await fetch(`${getApiBase()}/api/auth/suggested-org`, {
                        credentials: "include"
                    });
                    const suggestedResult = await suggestedRes.json();

                    if (suggestedResult.success && suggestedResult.organization) {
                        // Org found — present the org selection step.
                        // User can join or create their own.
                        setSuggestedOrg(suggestedResult.organization);
                        setCurrentStep("join-org");
                        // Don't run Gmail sync yet — user has no membership.
                        // It will run after they choose an org (see handleJoinOrg / handleCreateOwnOrg).
                    } else {
                        // No suggested org — auto-create one for the user
                        const createRes = await fetch(`${getApiBase()}/api/auth/confirm-org`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            credentials: "include",
                            body: JSON.stringify({ action: "create_new" })
                        });
                        const createResult = await createRes.json();
                        if (createResult.success && createResult.organization) {
                            setOrganizationId(createResult.organization.id);
                        }

                        // Now that user has a membership, run integration setup
                        await initNewFlowIntegrations();

                        if (isNewOnboarding) {
                            setCurrentStep("connect");
                        } else {
                            setCurrentStep(persisted?.step ?? "welcome");
                        }
                    }
                } else {
                    // User already has a membership (from invite code or prior bootstrap)
                    if (statusResult.organizationId) {
                        setOrganizationId(statusResult.organizationId);
                    }

                    await initNewFlowIntegrations();

                    if (isNewOnboarding) {
                        setCurrentStep("connect");
                    } else {
                        setCurrentStep(persisted?.step ?? "welcome");
                    }
                }
            } catch (error) {
                console.error("Failed to check onboarding status:", error);
                if (isNewOnboarding) {
                    setCurrentStep("connect");
                } else {
                    setCurrentStep(persisted?.step ?? "welcome");
                }
            }

            setInitialized(true);
        };

        init();
    }, []);

    // Persist state on changes
    useEffect(() => {
        if (initialized && currentStep !== "join-org") {
            persistState(currentStep, data);
        }
    }, [currentStep, data, initialized]);

    // Fetch available tools (old flow)
    useEffect(() => {
        if (isNewOnboarding) return; // New flow doesn't need this upfront

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
            "workspace-",
            "gmail-",
            "ask-questions"
        ];

        const isAgentRelevantTool = (tool: ToolInfo) => {
            if (tool.source?.startsWith("mcp:")) return true;
            if (tool.source === "registry") {
                return !PLATFORM_TOOL_PREFIXES.some(
                    (prefix) => tool.id.startsWith(prefix) || tool.id === prefix
                );
            }
            return true;
        };

        const fetchTools = async () => {
            try {
                const response = await fetch(`${getApiBase()}/api/agents/tools`, {
                    credentials: "include"
                });
                const result = await response.json();
                if (result.success && Array.isArray(result.tools) && result.tools.length > 0) {
                    const filtered = (result.tools as ToolInfo[]).filter(isAgentRelevantTool);
                    if (filtered.length > 0) {
                        setAvailableTools(filtered);
                    }
                }
                if (result.mcpError) {
                    setMcpWarning(
                        "Some MCP integrations could not be reached. Their tools may not appear below."
                    );
                }
            } catch (error) {
                console.error("Failed to fetch tools:", error);
            }
        };

        fetchTools();
    }, []);

    // ── Helpers ──────────────────────────────────────────────────────────

    const updateData = useCallback((updates: Partial<OnboardingData>) => {
        setData((prev) => ({ ...prev, ...updates }));
    }, []);

    const completeOnboarding = async (extras?: {
        onboardingPath?: string;
        connectedDuringOnboarding?: string[];
    }): Promise<boolean> => {
        try {
            const response = await fetch(`${getApiBase()}/api/onboarding/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(extras || {})
            });
            const result = await response.json();
            if (response.ok && result.success) {
                localStorage.setItem("agentc2_onboarding_complete", "true");
                clearPersistedState();
                return true;
            }
            console.error("Failed to complete onboarding:", result.error);
            return false;
        } catch (error) {
            console.error("Failed to complete onboarding:", error);
            return false;
        }
    };

    // ── Old Flow Handlers ───────────────────────────────────────────────

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

    const handleFinish = async (navigateTo?: string) => {
        const success = await completeOnboarding();
        if (success) {
            window.location.href = navigateTo || "/workspace";
        } else {
            setCreateError("Failed to complete onboarding. Please try again.");
        }
    };

    // Helper: run Gmail sync + session info after user gets a membership
    const syncIntegrationsAfterOrgChoice = useCallback(async () => {
        if (!isNewOnboarding) return;

        try {
            const gmailRes = await fetch(`${getApiBase()}/api/onboarding/ensure-gmail-sync`, {
                method: "POST",
                credentials: "include"
            });
            const gmailResult = await gmailRes.json();
            if (gmailResult.success && gmailResult.gmailConnected) {
                setGmailConnected(true);
                setGmailAddress(gmailResult.gmailAddress);
                setOnboardingPath("google_oauth");
            }

            const sessionRes = await fetch(`${getApiBase()}/api/auth/session`, {
                credentials: "include"
            });
            const sessionResult = await sessionRes.json();
            if (sessionResult?.user) {
                setUserId(sessionResult.user.id);
            }
        } catch (error) {
            console.error("[Onboarding] Failed to sync integrations after org choice:", error);
        }
    }, []);

    const handleJoinOrg = useCallback(async () => {
        if (!suggestedOrg) return;
        const response = await fetch(`${getApiBase()}/api/auth/confirm-org`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                action: "join",
                organizationId: suggestedOrg.id
            })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || "Failed to join organization");
        }
        setOrganizationId(suggestedOrg.id);
        setJoinedOrgName(suggestedOrg.name);
        setOnboardingPath("domain_join");
        setSuggestedOrg(null);

        // Now that user has a membership, sync integrations (Gmail, etc.)
        await syncIntegrationsAfterOrgChoice();

        if (isNewOnboarding) {
            setCurrentStep("team-welcome");
        } else {
            setCurrentStep("welcome");
        }
    }, [suggestedOrg, syncIntegrationsAfterOrgChoice]);

    const handleCreateOwnOrg = useCallback(async () => {
        const response = await fetch(`${getApiBase()}/api/auth/confirm-org`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ action: "create_new" })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || "Failed to create organization");
        }
        if (result.organization) {
            setOrganizationId(result.organization.id);
        }
        setSuggestedOrg(null);

        // Now that user has a membership, sync integrations (Gmail, etc.)
        await syncIntegrationsAfterOrgChoice();

        if (isNewOnboarding) {
            setCurrentStep("connect");
        } else {
            setCurrentStep("welcome");
        }
    }, [syncIntegrationsAfterOrgChoice]);

    const handleSkipToDashboard = async () => {
        const success = await completeOnboarding({
            onboardingPath
        });
        if (success) {
            window.location.href = "/workspace";
        } else {
            localStorage.setItem("agentc2_onboarding_complete", "true");
            clearPersistedState();
            window.location.href = "/workspace";
        }
    };

    // ── New Flow Handlers ───────────────────────────────────────────────

    const handleConnectComplete = useCallback(
        async (connectedIntegrations: string[]) => {
            setIsCreating(true);
            setCreateError(null);

            try {
                // Bootstrap the starter agent with connected integrations
                const response = await fetch(`${getApiBase()}/api/onboarding/bootstrap-agent`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ connectedIntegrations })
                });
                const result = await response.json();

                if (!result.success) {
                    console.error("[Onboarding] Failed to bootstrap agent:", result.error);
                }

                // Complete onboarding
                await completeOnboarding({
                    onboardingPath,
                    connectedDuringOnboarding: connectedIntegrations
                });

                // Redirect to the CoWork chat with the new agent
                const agentSlug = result.agent?.slug;
                if (agentSlug) {
                    window.location.href = `/workspace/${agentSlug}?firstRun=true`;
                } else {
                    window.location.href = "/workspace";
                }
            } catch (error) {
                console.error("[Onboarding] Error:", error);
                setCreateError("Something went wrong. Redirecting to dashboard...");
                // Fallback: complete and redirect
                await completeOnboarding({ onboardingPath });
                window.location.href = "/workspace";
            } finally {
                setIsCreating(false);
            }
        },
        [onboardingPath]
    );

    const handleTeamWelcomeContinue = useCallback(async () => {
        // For team joins, complete onboarding and redirect to dashboard
        await completeOnboarding({
            onboardingPath,
            connectedDuringOnboarding: []
        });
        window.location.href = "/workspace";
    }, [onboardingPath]);

    // ── Render ──────────────────────────────────────────────────────────

    if (!initialized) {
        return null;
    }

    // Progress bar only for old flow non-terminal steps
    const showProgress =
        !isNewOnboarding &&
        currentStep !== "join-org" &&
        currentStep !== "welcome" &&
        currentStep !== "success" &&
        currentStep !== "test";

    return (
        <>
            {/* Progress bar (old flow only) */}
            {showProgress && (
                <div className="mb-8">
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                        <div
                            className="bg-primary h-full transition-all duration-500 ease-out"
                            style={{ width: `${getProgress()}%` }}
                        />
                    </div>
                    <div className="text-muted-foreground mt-2 text-center text-xs">
                        Step{" "}
                        {getStepOrder()
                            .filter((s) => s !== "welcome" && s !== "success")
                            .indexOf(currentStep) + 1}{" "}
                        of {getStepOrder().length - 2}
                    </div>
                </div>
            )}

            {/* ── Shared: Join Org Step ──────────────────────────────────── */}
            {currentStep === "join-org" && suggestedOrg && (
                <JoinOrgStep
                    organization={suggestedOrg}
                    onJoin={handleJoinOrg}
                    onCreateOwn={handleCreateOwnOrg}
                />
            )}

            {/* ── New Flow Steps ─────────────────────────────────────────── */}
            {isNewOnboarding && currentStep === "connect" && (
                <ConnectStep
                    gmailConnected={gmailConnected}
                    gmailAddress={gmailAddress}
                    gmailMissingScopes={gmailMissingScopes}
                    organizationId={organizationId}
                    userId={userId}
                    onContinue={handleConnectComplete}
                />
            )}

            {isNewOnboarding && currentStep === "team-welcome" && (
                <TeamWelcomeStep
                    orgName={joinedOrgName}
                    orgId={organizationId}
                    onContinue={handleTeamWelcomeContinue}
                />
            )}

            {/* ── Old Flow Steps ──────────────────────────────────────────── */}
            {!isNewOnboarding && currentStep === "welcome" && (
                <WelcomeStep
                    onContinue={() => setCurrentStep("template")}
                    onSkip={handleSkipToDashboard}
                />
            )}

            {!isNewOnboarding && currentStep === "template" && (
                <TemplateStep
                    templates={TEMPLATES}
                    onSelect={handleTemplateSelect}
                    onBack={goBack}
                />
            )}

            {!isNewOnboarding && currentStep === "configure" && (
                <ConfigureStep
                    data={data}
                    updateData={updateData}
                    onContinue={handleConfigureComplete}
                    onBack={goBack}
                />
            )}

            {!isNewOnboarding && currentStep === "integrations" && (
                <IntegrationsStep
                    onContinue={handleIntegrationsComplete}
                    onBack={goBack}
                    availableTools={availableTools}
                />
            )}

            {!isNewOnboarding && currentStep === "tools" && (
                <ToolStep
                    data={data}
                    updateData={updateData}
                    availableTools={availableTools}
                    onContinue={handleToolsComplete}
                    onBack={goBack}
                    isCreating={isCreating}
                    createError={createError}
                    mcpWarning={mcpWarning}
                />
            )}

            {!isNewOnboarding && currentStep === "test" && data.createdAgentSlug && (
                <TestStep
                    agentSlug={data.createdAgentSlug}
                    agentName={data.agentName}
                    modelName={data.modelName}
                    templateId={data.selectedTemplate?.id || null}
                    onContinue={handleTestComplete}
                />
            )}

            {!isNewOnboarding && currentStep === "success" && (
                <SuccessStep
                    agentName={data.agentName}
                    agentSlug={data.createdAgentSlug || ""}
                    modelProvider={data.modelProvider}
                    modelName={data.modelName}
                    toolCount={data.selectedTools.length}
                    onFinish={handleFinish}
                />
            )}

            {/* Error display */}
            {createError && (currentStep === "success" || currentStep === "connect") && (
                <div className="mx-auto mt-4 max-w-md rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                    {createError}
                </div>
            )}
        </>
    );
}
