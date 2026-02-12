"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Input,
    Label,
    Textarea,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    Skeleton,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Sheet,
    SheetContent
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import { SkillBuilderPanel } from "@/components/skills/SkillBuilderPanel";
import { SkillDetailSheet } from "@/components/skills/SkillDetailSheet";

interface ModelConfig {
    thinking?: {
        type: "enabled" | "disabled";
        budget_tokens?: number;
    };
    parallelToolCalls?: boolean;
    reasoningEffort?: "low" | "medium" | "high";
    cacheControl?: { type: "ephemeral" };
    toolChoice?: "auto" | "required" | "none" | { type: "tool"; toolName: string };
}

interface Agent {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    instructions: string;
    instructionsTemplate: string | null;
    modelProvider: string;
    modelName: string;
    temperature: number;
    maxTokens: number | null;
    maxSteps: number;
    tools: string[];
    subAgents: string[];
    workflows: string[];
    memoryEnabled: boolean;
    memoryConfig: {
        lastMessages: number;
        semanticRecall: { topK: number; messageRange: number } | false;
        workingMemory: { enabled: boolean };
    } | null;
    modelConfig?: ModelConfig | null;
    scorers: string[];
    isActive: boolean;
    isPublic: boolean;
    type: "SYSTEM" | "USER" | "DEMO";
    version: number;
}

interface AttachedSkill {
    id: string;
    skillId: string;
    pinned: boolean;
    skill: {
        id: string;
        slug: string;
        name: string;
        description: string | null;
        category: string | null;
        version: number;
        _count: { tools: number; documents: number };
    };
}

interface AvailableSkill {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    version: number;
    tools: Array<{ toolId: string }>;
    documents: Array<{ documentId: string }>;
    agents: Array<{ agentId: string }>;
}

interface ModelInfo {
    provider: string;
    name: string;
    displayName: string;
}

interface ToolInfo {
    id: string;
    name: string;
    description: string;
    source: string; // "registry" or "mcp:serverName"
    category?: string;
}

interface ToolGroup {
    key: string;
    displayName: string;
    tools: ToolInfo[];
    isMcp: boolean;
}

interface ScorerInfo {
    id: string;
    name: string;
    description: string;
}

export default function ConfigurePage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [agent, setAgent] = useState<Agent | null>(null);
    const [activeTab, setActiveTab] = useState("basic");

    // Available tools, models, and scorers from API
    const [availableTools, setAvailableTools] = useState<ToolInfo[]>([]);
    const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
    const [availableScorers, setAvailableScorers] = useState<ScorerInfo[]>([]);
    const [toolsLoading, setToolsLoading] = useState(true);
    const [toolCategoryOrder, setToolCategoryOrder] = useState<string[]>([]);
    const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
    const [collapsedToolGroups, setCollapsedToolGroups] = useState<Set<string>>(new Set());

    // Extended thinking state (for form)
    const [extendedThinking, setExtendedThinking] = useState(false);
    const [thinkingBudget, setThinkingBudget] = useState(10000);
    const [parallelToolCalls, setParallelToolCalls] = useState(false);
    const [reasoningEffort, setReasoningEffort] = useState<string>("");
    const [cacheControlEnabled, setCacheControlEnabled] = useState(false);
    const [toolChoice, setToolChoice] = useState<string>("auto");

    const [availableAgents, setAvailableAgents] = useState<
        Array<{ id: string; slug: string; name: string }>
    >([]);
    const [availableWorkflows, setAvailableWorkflows] = useState<
        Array<{ id: string; slug: string; name: string }>
    >([]);

    // Skills state
    const [attachedSkills, setAttachedSkills] = useState<AttachedSkill[]>([]);
    const [availableSkills, setAvailableSkills] = useState<AvailableSkill[]>([]);
    const [skillsLoading, setSkillsLoading] = useState(false);
    const [skillActionLoading, setSkillActionLoading] = useState(false);
    const [skillBuilderOpen, setSkillBuilderOpen] = useState(false);
    const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

    // AI provider API key status
    const [aiProviderStatus, setAiProviderStatus] = useState<
        Record<string, { hasOrgKey: boolean; hasEnvKey: boolean; connected: boolean }>
    >({});
    const [aiProviderStatusLoading, setAiProviderStatusLoading] = useState(true);

    // Form state
    const [formData, setFormData] = useState<Partial<Agent>>({});
    const [hasChanges, setHasChanges] = useState(false);

    // Fetch AI provider API key status
    const fetchAiProviderStatus = useCallback(async () => {
        try {
            setAiProviderStatusLoading(true);
            const res = await fetch(`${getApiBase()}/api/integrations/ai-providers/status`, {
                credentials: "include"
            });
            const data = await res.json();
            if (data.success) {
                setAiProviderStatus(data.providers || {});
            }
        } catch (err) {
            console.error("Failed to fetch AI provider status:", err);
        } finally {
            setAiProviderStatusLoading(false);
        }
    }, []);

    // Fetch available tools, models, and scorers
    const fetchToolsAndScorers = useCallback(async () => {
        try {
            setToolsLoading(true);
            const res = await fetch(`${getApiBase()}/api/agents/tools`, {
                credentials: "include"
            });
            const data = await res.json();
            if (data.success) {
                setAvailableTools(data.tools || []);
                setAvailableModels(data.models || []);
                setAvailableScorers(data.scorers || []);
                setToolCategoryOrder(data.toolCategoryOrder || []);
                setServerErrors(data.serverErrors ?? {});
            }
        } catch (err) {
            console.error("Failed to fetch tools:", err);
        } finally {
            setToolsLoading(false);
        }
    }, []);

    const fetchAgentsAndWorkflows = useCallback(async () => {
        try {
            const [agentsRes, workflowsRes] = await Promise.all([
                fetch(`${getApiBase()}/api/agents`),
                fetch(`${getApiBase()}/api/workflows`)
            ]);
            const agentsData = await agentsRes.json();
            const workflowsData = await workflowsRes.json();
            setAvailableAgents(agentsData.agents || []);
            setAvailableWorkflows(workflowsData.workflows || []);
        } catch (err) {
            console.error("Failed to fetch agents/workflows:", err);
        }
    }, []);

    const fetchSkills = useCallback(async () => {
        try {
            setSkillsLoading(true);
            const res = await fetch(`${getApiBase()}/api/skills`);
            const data = await res.json();
            if (data.skills) {
                setAvailableSkills(data.skills);
            }
        } catch (err) {
            console.error("Failed to fetch skills:", err);
        } finally {
            setSkillsLoading(false);
        }
    }, []);

    const handleAttachSkill = useCallback(
        async (skillId: string) => {
            if (!agent || skillActionLoading) return;
            setSkillActionLoading(true);
            try {
                const res = await fetch(`${getApiBase()}/api/agents/${agent.id}/skills`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ skillId })
                });
                if (res.ok) {
                    // Refresh agent data to get updated skills and version
                    await fetchAgent();
                    await fetchSkills();
                }
            } catch (err) {
                console.error("Failed to attach skill:", err);
            } finally {
                setSkillActionLoading(false);
            }
        },
        [agent, skillActionLoading] // eslint-disable-line react-hooks/exhaustive-deps
    );

    const handleDetachSkill = useCallback(
        async (skillId: string) => {
            if (!agent || skillActionLoading) return;
            if (!confirm("Detach this skill? This will create a new agent version.")) return;
            setSkillActionLoading(true);
            try {
                const res = await fetch(`${getApiBase()}/api/agents/${agent.id}/skills`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ skillId })
                });
                if (res.ok) {
                    await fetchAgent();
                    await fetchSkills();
                }
            } catch (err) {
                console.error("Failed to detach skill:", err);
            } finally {
                setSkillActionLoading(false);
            }
        },
        [agent, skillActionLoading] // eslint-disable-line react-hooks/exhaustive-deps
    );

    const fetchAgent = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${getApiBase()}/api/agents/${agentSlug}`);
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Failed to fetch agent");
            }

            // Transform API response to match our interface
            const agentData = result.agent;
            const transformedAgent: Agent = {
                id: agentData.id,
                slug: agentData.slug,
                name: agentData.name,
                description: agentData.description,
                instructions: agentData.instructions,
                instructionsTemplate: agentData.instructionsTemplate,
                modelProvider: agentData.modelProvider,
                modelName: agentData.modelName,
                temperature: agentData.temperature ?? 0.7,
                maxTokens: agentData.maxTokens,
                maxSteps: agentData.maxSteps ?? 5,
                tools: (agentData.tools || []).map((t: { toolId: string }) => t.toolId),
                subAgents: agentData.subAgents || [],
                workflows: agentData.workflows || [],
                memoryEnabled: agentData.memoryEnabled ?? false,
                memoryConfig: agentData.memoryConfig,
                modelConfig: agentData.modelConfig,
                scorers: agentData.scorers || [],
                isActive: agentData.isActive ?? true,
                isPublic: agentData.isPublic ?? false,
                type: agentData.type || "USER",
                version: agentData.version ?? 1
            };

            // Extract attached skills from API response
            if (agentData.skills) {
                setAttachedSkills(agentData.skills);
            }

            // Extract extended thinking settings from modelConfig
            const modelConfig = agentData.modelConfig as ModelConfig | null;
            const hasExtendedThinking = modelConfig?.thinking?.type === "enabled";
            const budget = modelConfig?.thinking?.budget_tokens ?? 10000;
            setExtendedThinking(hasExtendedThinking);
            setThinkingBudget(budget);
            setParallelToolCalls(modelConfig?.parallelToolCalls ?? false);
            setReasoningEffort(modelConfig?.reasoningEffort || "");
            setCacheControlEnabled(modelConfig?.cacheControl?.type === "ephemeral");
            setToolChoice(
                typeof modelConfig?.toolChoice === "string" ? modelConfig.toolChoice : "auto"
            );

            setAgent(transformedAgent);
            setFormData(transformedAgent);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load agent");
        } finally {
            setLoading(false);
        }
    }, [agentSlug]);

    useEffect(() => {
        fetchAgent();
        fetchToolsAndScorers();
        fetchAgentsAndWorkflows();
        fetchSkills();
        fetchAiProviderStatus();
    }, [
        fetchAgent,
        fetchToolsAndScorers,
        fetchAgentsAndWorkflows,
        fetchSkills,
        fetchAiProviderStatus
    ]);

    // Group tools: built-in by category, MCP by server
    const groupTools = (tools: ToolInfo[]): ToolGroup[] => {
        const builtInByCategory: Record<string, ToolInfo[]> = {};
        const mcpByServer: Record<string, ToolInfo[]> = {};

        tools.forEach((tool) => {
            if (tool.source === "registry") {
                const cat = tool.category || "Other";
                if (!builtInByCategory[cat]) builtInByCategory[cat] = [];
                builtInByCategory[cat]!.push(tool);
            } else {
                const server = tool.source;
                if (!mcpByServer[server]) mcpByServer[server] = [];
                mcpByServer[server]!.push(tool);
            }
        });

        const orderedCategories = [
            ...toolCategoryOrder.filter((cat) => builtInByCategory[cat]),
            ...Object.keys(builtInByCategory)
                .filter((cat) => !toolCategoryOrder.includes(cat))
                .sort()
        ];

        const groups: ToolGroup[] = orderedCategories.map((cat) => ({
            key: `builtin:${cat}`,
            displayName: cat,
            tools: builtInByCategory[cat]!,
            isMcp: false
        }));

        const sortedServers = Object.keys(mcpByServer).sort();
        for (const server of sortedServers) {
            groups.push({
                key: server,
                displayName: server.replace("mcp:", ""),
                tools: mcpByServer[server]!,
                isMcp: true
            });
        }

        return groups;
    };

    // Toggle collapse for a tool group
    const toggleToolGroupCollapse = (key: string) => {
        setCollapsedToolGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    // Select all tools in a group
    const selectAllToolsForGroup = (group: ToolGroup) => {
        const groupToolIds = group.tools.map((t) => t.id);
        const currentTools = formData.tools || [];
        handleChange("tools", [...new Set([...currentTools, ...groupToolIds])]);
    };

    // Deselect all tools in a group
    const deselectAllToolsForGroup = (group: ToolGroup) => {
        const groupToolIds = new Set(group.tools.map((t) => t.id));
        const currentTools = formData.tools || [];
        handleChange(
            "tools",
            currentTools.filter((t) => !groupToolIds.has(t))
        );
    };

    // Check if all tools in a group are selected
    const areAllToolsSelectedForGroup = (group: ToolGroup) => {
        const currentTools = formData.tools || [];
        return group.tools.length > 0 && group.tools.every((t) => currentTools.includes(t.id));
    };

    // Collapse / expand all tool groups
    const toggleCollapseAllToolGroups = () => {
        const groups = groupTools(availableTools);
        const allKeys = groups.map((g) => g.key);
        const allCollapsed = allKeys.length > 0 && allKeys.every((k) => collapsedToolGroups.has(k));
        if (allCollapsed) {
            setCollapsedToolGroups(new Set());
        } else {
            setCollapsedToolGroups(new Set(allKeys));
        }
    };

    // Select all tools
    const selectAllTools = () => {
        handleChange(
            "tools",
            availableTools.map((t) => t.id)
        );
    };

    // Deselect all tools
    const deselectAllTools = () => {
        handleChange("tools", []);
    };

    const handleChange = <K extends keyof Agent>(key: K, value: Agent[K]) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);

            // Include extended thinking settings in the request
            const requestBody = {
                ...formData,
                extendedThinking,
                thinkingBudget,
                parallelToolCalls,
                reasoningEffort: reasoningEffort || null,
                cacheControl: cacheControlEnabled,
                toolChoice: toolChoice || null
            };

            const response = await fetch(`${getApiBase()}/api/agents/${agentSlug}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Failed to save agent");
            }

            // Update agent with new data
            const agentData = result.agent;
            const updatedAgent: Agent = {
                id: agentData.id,
                slug: agentData.slug,
                name: agentData.name,
                description: agentData.description,
                instructions: agentData.instructions,
                instructionsTemplate: agentData.instructionsTemplate,
                modelProvider: agentData.modelProvider,
                modelName: agentData.modelName,
                temperature: agentData.temperature ?? 0.7,
                maxTokens: agentData.maxTokens,
                maxSteps: agentData.maxSteps ?? 5,
                tools: (agentData.tools || []).map((t: { toolId: string }) => t.toolId),
                subAgents: agentData.subAgents || [],
                workflows: agentData.workflows || [],
                memoryEnabled: agentData.memoryEnabled ?? false,
                memoryConfig: agentData.memoryConfig,
                modelConfig: agentData.modelConfig,
                scorers: agentData.scorers || [],
                isActive: agentData.isActive ?? true,
                isPublic: agentData.isPublic ?? false,
                type: agentData.type || "USER",
                version: agentData.version ?? 1
            };

            // Update extended thinking state from response
            const modelConfig = agentData.modelConfig as ModelConfig | null;
            const hasExtendedThinking = modelConfig?.thinking?.type === "enabled";
            const budget = modelConfig?.thinking?.budget_tokens ?? 10000;
            setExtendedThinking(hasExtendedThinking);
            setThinkingBudget(budget);
            setParallelToolCalls(modelConfig?.parallelToolCalls ?? false);
            setReasoningEffort(modelConfig?.reasoningEffort || "");
            setCacheControlEnabled(modelConfig?.cacheControl?.type === "ephemeral");
            setToolChoice(
                typeof modelConfig?.toolChoice === "string" ? modelConfig.toolChoice : "auto"
            );

            setAgent(updatedAgent);
            setFormData(updatedAgent);
            setHasChanges(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save agent");
        } finally {
            setSaving(false);
        }
    };

    const toggleTool = (toolId: string) => {
        const tools = formData.tools || [];
        const newTools = tools.includes(toolId)
            ? tools.filter((t) => t !== toolId)
            : [...tools, toolId];
        handleChange("tools", newTools);
    };

    const toggleSubAgent = (slug: string) => {
        const subAgents = formData.subAgents || [];
        const newSubAgents = subAgents.includes(slug)
            ? subAgents.filter((s) => s !== slug)
            : [...subAgents, slug];
        handleChange("subAgents", newSubAgents);
    };

    const toggleWorkflow = (workflowId: string) => {
        const workflows = formData.workflows || [];
        const newWorkflows = workflows.includes(workflowId)
            ? workflows.filter((w) => w !== workflowId)
            : [...workflows, workflowId];
        handleChange("workflows", newWorkflows);
    };

    const toggleScorer = (scorerId: string) => {
        const scorers = formData.scorers || [];
        const newScorers = scorers.includes(scorerId)
            ? scorers.filter((s) => s !== scorerId)
            : [...scorers, scorerId];
        handleChange("scorers", newScorers);
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (error && !agent) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Configuration</h1>
                    <p className="text-muted-foreground">Full agent configuration</p>
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-destructive mb-4">{error}</p>
                        <Button onClick={fetchAgent}>Retry</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Configuration</h1>
                    <p className="text-muted-foreground">
                        Full agent configuration - v{agent?.version}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {error && (
                        <Badge variant="destructive" className="mr-2">
                            {error}
                        </Badge>
                    )}
                    {hasChanges && (
                        <Badge variant="outline" className="text-yellow-600">
                            Unsaved Changes
                        </Badge>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (agent) {
                                setFormData(agent);
                                // Reset extended thinking state from agent's modelConfig
                                const modelConfig = agent.modelConfig as ModelConfig | null;
                                const hasExtendedThinking =
                                    modelConfig?.thinking?.type === "enabled";
                                const budget = modelConfig?.thinking?.budget_tokens ?? 10000;
                                setExtendedThinking(hasExtendedThinking);
                                setThinkingBudget(budget);
                                setHasChanges(false);
                                setError(null);
                            }
                        }}
                    >
                        Discard
                    </Button>
                    <Button onClick={handleSave} disabled={!hasChanges || saving}>
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>

            {/* Configuration Tabs */}
            <Tabs
                defaultValue="general"
                value={activeTab}
                onValueChange={(v) => v && setActiveTab(v)}
            >
                <TabsList className="mb-4">
                    <TabsTrigger value="basic">Basic</TabsTrigger>
                    <TabsTrigger value="model">Model</TabsTrigger>
                    <TabsTrigger value="instructions">Instructions</TabsTrigger>
                    <TabsTrigger value="tools">Tools</TabsTrigger>
                    <TabsTrigger value="skills">Skills ({attachedSkills.length})</TabsTrigger>
                    <TabsTrigger value="orchestration">Orchestration</TabsTrigger>
                    <TabsTrigger value="memory">Memory</TabsTrigger>
                    <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
                </TabsList>

                {/* Basic Tab */}
                <TabsContent value="basic">
                    <Card>
                        <CardHeader>
                            <CardTitle>Basic Information</CardTitle>
                            <CardDescription>Agent identity and status</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        value={formData.name || ""}
                                        onChange={(e) => handleChange("name", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="slug">Slug</Label>
                                    <Input
                                        id="slug"
                                        value={formData.slug || ""}
                                        onChange={(e) =>
                                            handleChange(
                                                "slug",
                                                e.target.value
                                                    .toLowerCase()
                                                    .replace(/[^a-z0-9-]/g, "-")
                                            )
                                        }
                                        className="font-mono"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description || ""}
                                    onChange={(e) => handleChange("description", e.target.value)}
                                    rows={2}
                                />
                            </div>

                            <div className="flex items-center gap-8">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={formData.isActive}
                                        onCheckedChange={(checked) =>
                                            handleChange("isActive", checked)
                                        }
                                    />
                                    <Label>Active</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={formData.isPublic}
                                        onCheckedChange={(checked) =>
                                            handleChange("isPublic", checked)
                                        }
                                    />
                                    <Label>Public</Label>
                                </div>
                            </div>

                            {agent?.type === "SYSTEM" && (
                                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
                                    <p className="text-sm text-yellow-600">
                                        This is a system agent. Some configuration options may be
                                        restricted.
                                    </p>
                                </div>
                            )}
                            {agent?.type === "DEMO" && (
                                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
                                    <p className="text-sm text-blue-600">
                                        This is a demo agent. Changes may be overwritten when the
                                        platform is re-seeded.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Model Tab */}
                <TabsContent value="model">
                    <Card>
                        <CardHeader>
                            <CardTitle>Model Configuration</CardTitle>
                            <CardDescription>LLM provider and parameters</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Provider</Label>
                                    <Select
                                        value={formData.modelProvider}
                                        onValueChange={(v) => {
                                            if (v) {
                                                handleChange("modelProvider", v);
                                                // Auto-select first model for new provider
                                                const providerModels = availableModels.filter(
                                                    (m) => m.provider === v
                                                );
                                                if (providerModels.length > 0) {
                                                    handleChange(
                                                        "modelName",
                                                        providerModels[0].name
                                                    );
                                                }
                                                // Reset extended thinking if switching away from Anthropic
                                                if (v !== "anthropic") {
                                                    setExtendedThinking(false);
                                                    setCacheControlEnabled(false);
                                                    setHasChanges(true);
                                                }
                                                if (v !== "openai") {
                                                    setParallelToolCalls(false);
                                                    setReasoningEffort("");
                                                    setHasChanges(true);
                                                }
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="anthropic">Anthropic</SelectItem>
                                            <SelectItem value="openai">OpenAI</SelectItem>
                                            <SelectItem value="google">Google</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Model</Label>
                                    <Select
                                        value={formData.modelName}
                                        onValueChange={(v) => {
                                            if (v) {
                                                handleChange("modelName", v);
                                                // Reset extended thinking if switching to non-Claude 4 model
                                                if (
                                                    !v.includes("opus-4") &&
                                                    !v.includes("sonnet-4")
                                                ) {
                                                    setExtendedThinking(false);
                                                    setHasChanges(true);
                                                }
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableModels
                                                .filter(
                                                    (m) => m.provider === formData.modelProvider
                                                )
                                                .map((m) => (
                                                    <SelectItem key={m.name} value={m.name}>
                                                        {m.name}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* AI Provider API Key Status */}
                            {!aiProviderStatusLoading &&
                                formData.modelProvider &&
                                (() => {
                                    const status = aiProviderStatus[formData.modelProvider];
                                    if (!status) return null;
                                    if (status.connected) {
                                        return (
                                            <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-2.5">
                                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                                <p className="text-sm text-green-700 dark:text-green-400">
                                                    {status.hasOrgKey
                                                        ? "API key configured via Integrations"
                                                        : "Using platform API key (environment)"}
                                                </p>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-amber-500" />
                                                <p className="text-sm text-amber-700 dark:text-amber-400">
                                                    No API key configured for{" "}
                                                    <span className="font-medium capitalize">
                                                        {formData.modelProvider}
                                                    </span>
                                                    . Agents using this provider will fail.
                                                </p>
                                            </div>
                                            <a
                                                href={`${getApiBase().replace(/\/agent$/, "")}/agent/mcp`}
                                                className="text-primary text-sm font-medium whitespace-nowrap hover:underline"
                                            >
                                                Configure in Integrations
                                            </a>
                                        </div>
                                    );
                                })()}

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Temperature: {formData.temperature}</Label>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="2"
                                        step="0.1"
                                        value={formData.temperature || 0.7}
                                        onChange={(e) =>
                                            handleChange("temperature", parseFloat(e.target.value))
                                        }
                                        className="w-full"
                                    />
                                    <p className="text-muted-foreground text-xs">
                                        Lower = more focused, Higher = more creative (0-2)
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Max Tokens (Output)</Label>
                                        <Input
                                            type="number"
                                            placeholder="Default (provider limit)"
                                            value={formData.maxTokens || ""}
                                            onChange={(e) =>
                                                handleChange(
                                                    "maxTokens",
                                                    e.target.value ? parseInt(e.target.value) : null
                                                )
                                            }
                                        />
                                        <p className="text-muted-foreground text-xs">
                                            Maximum tokens in response. Leave empty for default.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Max Steps: {formData.maxSteps}</Label>
                                        <input
                                            type="range"
                                            min="1"
                                            max="20"
                                            value={formData.maxSteps || 5}
                                            onChange={(e) =>
                                                handleChange("maxSteps", parseInt(e.target.value))
                                            }
                                            className="w-full"
                                        />
                                        <p className="text-muted-foreground text-xs">
                                            Maximum tool call iterations per request.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Extended Thinking (Anthropic Claude 4+ only) */}
                            {formData.modelProvider === "anthropic" &&
                                (formData.modelName?.includes("opus-4") ||
                                    formData.modelName?.includes("sonnet-4")) && (
                                    <div className="border-primary/20 bg-primary/5 space-y-4 rounded-lg border p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <Label className="text-base font-medium">
                                                    Extended Thinking
                                                </Label>
                                                <p className="text-muted-foreground text-xs">
                                                    Enhanced reasoning for complex tasks (Claude 4
                                                    only)
                                                </p>
                                            </div>
                                            <Switch
                                                checked={extendedThinking}
                                                onCheckedChange={(checked) => {
                                                    setExtendedThinking(checked);
                                                    setHasChanges(true);
                                                }}
                                            />
                                        </div>

                                        {extendedThinking && (
                                            <div className="space-y-2 pt-2">
                                                <Label>
                                                    Thinking Budget:{" "}
                                                    {thinkingBudget.toLocaleString()} tokens
                                                </Label>
                                                <input
                                                    type="range"
                                                    min="1024"
                                                    max="32000"
                                                    step="1024"
                                                    value={thinkingBudget}
                                                    onChange={(e) => {
                                                        setThinkingBudget(parseInt(e.target.value));
                                                        setHasChanges(true);
                                                    }}
                                                    className="w-full"
                                                />
                                                <p className="text-muted-foreground text-xs">
                                                    Higher budgets enable more thorough reasoning
                                                    but increase latency and cost.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                            {formData.modelProvider === "openai" && (
                                <div className="space-y-4 rounded-lg border p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="text-base font-medium">
                                                Parallel tool calls
                                            </Label>
                                            <p className="text-muted-foreground text-xs">
                                                Allow OpenAI to call tools in parallel where
                                                supported.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={parallelToolCalls}
                                            onCheckedChange={(checked) => {
                                                setParallelToolCalls(checked);
                                                setHasChanges(true);
                                            }}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Reasoning effort</Label>
                                        <Select
                                            value={reasoningEffort || "default"}
                                            onValueChange={(value) => {
                                                const nextValue = value ?? "default";
                                                setReasoningEffort(
                                                    nextValue === "default" ? "" : nextValue
                                                );
                                                setHasChanges(true);
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="default">Default</SelectItem>
                                                <SelectItem value="low">Low</SelectItem>
                                                <SelectItem value="medium">Medium</SelectItem>
                                                <SelectItem value="high">High</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-muted-foreground text-xs">
                                            Higher effort improves reasoning but can increase
                                            latency and cost.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {formData.modelProvider === "anthropic" && (
                                <div className="space-y-4 rounded-lg border p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="text-base font-medium">
                                                Prompt caching
                                            </Label>
                                            <p className="text-muted-foreground text-xs">
                                                Use ephemeral cache control for repeated prompts.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={cacheControlEnabled}
                                            onCheckedChange={(checked) => {
                                                setCacheControlEnabled(checked);
                                                setHasChanges(true);
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Tool choice</Label>
                                <Select
                                    value={toolChoice || "auto"}
                                    onValueChange={(value) => {
                                        setToolChoice(value ?? "auto");
                                        setHasChanges(true);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">Auto</SelectItem>
                                        <SelectItem value="required">Required</SelectItem>
                                        <SelectItem value="none">None</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-muted-foreground text-xs">
                                    Control whether tools must be used in generation.
                                </p>
                            </div>

                            {/* Provider-specific options hint */}
                            {formData.modelProvider === "openai" && (
                                <div className="bg-muted rounded-lg p-4">
                                    <p className="text-muted-foreground text-sm">
                                        💡 OpenAI models support function calling and JSON mode.
                                        Configure tools in the Tools tab.
                                    </p>
                                </div>
                            )}

                            {formData.modelProvider === "google" && (
                                <div className="bg-muted rounded-lg p-4">
                                    <p className="text-muted-foreground text-sm">
                                        💡 Google Gemini models support multimodal inputs and
                                        function calling.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Instructions Tab */}
                <TabsContent value="instructions">
                    <Card>
                        <CardHeader>
                            <CardTitle>System Instructions</CardTitle>
                            <CardDescription>Define how the agent behaves</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Instructions</Label>
                                    <Button variant="ghost" size="sm">
                                        ✨ AI Improve
                                    </Button>
                                </div>
                                <Textarea
                                    value={formData.instructions || ""}
                                    onChange={(e) => handleChange("instructions", e.target.value)}
                                    rows={15}
                                    className="font-mono text-sm"
                                />
                            </div>

                            <div className="bg-muted rounded-lg p-4">
                                <p className="mb-2 text-sm font-medium">
                                    Available Template Variables
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        "{{userId}}",
                                        "{{userName}}",
                                        "{{userEmail}}",
                                        "{{currentDate}}",
                                        "{{companyName}}"
                                    ].map((v) => (
                                        <Badge
                                            key={v}
                                            variant="outline"
                                            className="cursor-pointer font-mono"
                                        >
                                            {v}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tools Tab */}
                <TabsContent value="tools">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Tools</CardTitle>
                                    <CardDescription>
                                        {formData.tools?.length || 0} of {availableTools.length}{" "}
                                        tools selected
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    {availableTools.length > 0 && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={toggleCollapseAllToolGroups}
                                        >
                                            {(() => {
                                                const groups = groupTools(availableTools);
                                                const allKeys = groups.map((g) => g.key);
                                                const allCollapsed =
                                                    allKeys.length > 0 &&
                                                    allKeys.every((k) =>
                                                        collapsedToolGroups.has(k)
                                                    );
                                                return allCollapsed ? "Expand All" : "Collapse All";
                                            })()}
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={selectAllTools}
                                        disabled={formData.tools?.length === availableTools.length}
                                    >
                                        Select All
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={deselectAllTools}
                                        disabled={(formData.tools?.length || 0) === 0}
                                    >
                                        Deselect All
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {toolsLoading ? (
                                <div className="space-y-4">
                                    <Skeleton className="h-8 w-48" />
                                    <Skeleton className="h-32 w-full" />
                                    <Skeleton className="h-8 w-48" />
                                    <Skeleton className="h-32 w-full" />
                                </div>
                            ) : (
                                <div className="max-h-[500px] space-y-4 overflow-auto">
                                    {(() => {
                                        const groups = groupTools(availableTools);
                                        const builtInCount = availableTools.filter(
                                            (t) => t.source === "registry"
                                        ).length;
                                        const builtInSelected = availableTools.filter(
                                            (t) =>
                                                t.source === "registry" &&
                                                formData.tools?.includes(t.id)
                                        ).length;
                                        return (
                                            <>
                                                {builtInCount > 0 && (
                                                    <div className="flex items-center gap-2 border-b pb-2">
                                                        <h3 className="text-sm font-semibold tracking-wide uppercase">
                                                            Built-in Tools
                                                        </h3>
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            {builtInSelected}/{builtInCount}
                                                        </Badge>
                                                    </div>
                                                )}
                                                {groups.map((group) => {
                                                    const selectedCount = group.tools.filter((t) =>
                                                        formData.tools?.includes(t.id)
                                                    ).length;
                                                    const allSelected =
                                                        areAllToolsSelectedForGroup(group);
                                                    const isCollapsed = collapsedToolGroups.has(
                                                        group.key
                                                    );
                                                    const isFirstMcp =
                                                        group.isMcp &&
                                                        groups.findIndex((g) => g.isMcp) ===
                                                            groups.indexOf(group);
                                                    return (
                                                        <div key={group.key}>
                                                            {isFirstMcp && (
                                                                <div className="mt-6 flex items-center gap-2 border-b pb-2">
                                                                    <h3 className="text-sm font-semibold tracking-wide uppercase">
                                                                        MCP Tools
                                                                    </h3>
                                                                </div>
                                                            )}
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <button
                                                                        type="button"
                                                                        className="flex items-center gap-2 text-left"
                                                                        onClick={() =>
                                                                            toggleToolGroupCollapse(
                                                                                group.key
                                                                            )
                                                                        }
                                                                    >
                                                                        <svg
                                                                            className={`h-3.5 w-3.5 shrink-0 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                                                                            fill="none"
                                                                            viewBox="0 0 24 24"
                                                                            stroke="currentColor"
                                                                            strokeWidth={2}
                                                                        >
                                                                            <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                d="M9 5l7 7-7 7"
                                                                            />
                                                                        </svg>
                                                                        <h4 className="text-sm font-medium">
                                                                            {group.displayName}
                                                                        </h4>
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="text-xs"
                                                                        >
                                                                            {selectedCount}/
                                                                            {group.tools.length}
                                                                        </Badge>
                                                                    </button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() =>
                                                                            allSelected
                                                                                ? deselectAllToolsForGroup(
                                                                                      group
                                                                                  )
                                                                                : selectAllToolsForGroup(
                                                                                      group
                                                                                  )
                                                                        }
                                                                    >
                                                                        {allSelected
                                                                            ? "Deselect All"
                                                                            : "Select All"}
                                                                    </Button>
                                                                </div>
                                                                {!isCollapsed && (
                                                                    <div className="grid grid-cols-1 gap-2 pl-5 md:grid-cols-2">
                                                                        {group.tools.map((tool) => (
                                                                            <label
                                                                                key={tool.id}
                                                                                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                                                                                    formData.tools?.includes(
                                                                                        tool.id
                                                                                    )
                                                                                        ? "border-primary bg-primary/5"
                                                                                        : "hover:bg-muted/50"
                                                                                }`}
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={
                                                                                        formData.tools?.includes(
                                                                                            tool.id
                                                                                        ) || false
                                                                                    }
                                                                                    onChange={() =>
                                                                                        toggleTool(
                                                                                            tool.id
                                                                                        )
                                                                                    }
                                                                                    className="mt-0.5"
                                                                                />
                                                                                <div className="min-w-0 flex-1">
                                                                                    <p className="text-sm font-medium">
                                                                                        {tool.name}
                                                                                    </p>
                                                                                    {tool.description && (
                                                                                        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                                                                                            {
                                                                                                tool.description
                                                                                            }
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </>
                                        );
                                    })()}
                                    {availableTools.length === 0 && !toolsLoading && (
                                        <div className="text-muted-foreground py-8 text-center">
                                            <p>No tools available</p>
                                            <p className="mt-1 text-sm">
                                                Check MCP server connections
                                            </p>
                                        </div>
                                    )}
                                    {Object.keys(serverErrors).length > 0 && (
                                        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                                            <p className="font-medium">
                                                {Object.keys(serverErrors).length} MCP server(s)
                                                failed to load
                                            </p>
                                            <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                                                {Object.entries(serverErrors).map(
                                                    ([server, err]) => (
                                                        <li key={server}>
                                                            <span className="font-medium">
                                                                {server}
                                                            </span>
                                                            :{" "}
                                                            {err.length > 120
                                                                ? err.slice(0, 120) + "..."
                                                                : err}
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                            <p className="mt-1 text-xs opacity-90">
                                                Other servers loaded successfully. Check
                                                Integrations (MCP) for details.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Skills Tab */}
                <TabsContent value="skills">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Skills</CardTitle>
                                    <CardDescription>
                                        Composable competency bundles that provide this agent with
                                        domain knowledge, procedures, and tool bindings. Attaching
                                        or detaching a skill creates a new agent version.
                                    </CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSkillBuilderOpen(true)}
                                >
                                    Create Skill
                                </Button>
                            </div>
                        </CardHeader>

                        {/* Skill Builder Sheet */}
                        {agent && (
                            <Sheet open={skillBuilderOpen} onOpenChange={setSkillBuilderOpen}>
                                <SheetContent
                                    side="right"
                                    showCloseButton
                                    className="w-[480px] p-0 sm:max-w-[480px]"
                                >
                                    <SkillBuilderPanel
                                        agentId={agent.id}
                                        agentSlug={agent.slug}
                                        onSkillCreated={() => {
                                            fetchAgent();
                                            fetchSkills();
                                        }}
                                    />
                                </SheetContent>
                            </Sheet>
                        )}

                        {/* Skill Detail Sheet */}
                        <SkillDetailSheet
                            skillId={selectedSkillId}
                            open={!!selectedSkillId}
                            onOpenChange={(open) => {
                                if (!open) setSelectedSkillId(null);
                            }}
                            agentId={agent?.id}
                            onDetach={(skillId) => {
                                setSelectedSkillId(null);
                                handleDetachSkill(skillId);
                            }}
                        />

                        <CardContent className="space-y-6">
                            {/* Attached Skills */}
                            {attachedSkills.length > 0 ? (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium">Attached Skills</h4>
                                    {attachedSkills.map((as) => (
                                        <div
                                            key={as.id}
                                            className="flex items-center justify-between rounded-lg border p-3"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        className="text-primary text-sm font-medium hover:underline"
                                                        onClick={() =>
                                                            setSelectedSkillId(as.skillId)
                                                        }
                                                    >
                                                        {as.skill.name}
                                                    </button>
                                                    <Badge variant="outline" className="text-xs">
                                                        v{as.skill.version}
                                                    </Badge>
                                                    <Badge
                                                        variant={
                                                            as.pinned ? "default" : "secondary"
                                                        }
                                                        className="cursor-pointer text-xs"
                                                        onClick={async () => {
                                                            if (skillActionLoading) return;
                                                            setSkillActionLoading(true);
                                                            try {
                                                                const res = await fetch(
                                                                    `${getApiBase()}/api/agents/${agent!.id}/skills`,
                                                                    {
                                                                        method: "PATCH",
                                                                        headers: {
                                                                            "Content-Type":
                                                                                "application/json"
                                                                        },
                                                                        body: JSON.stringify({
                                                                            skillId: as.skillId,
                                                                            pinned: !as.pinned
                                                                        })
                                                                    }
                                                                );
                                                                if (res.ok) {
                                                                    fetchAgent();
                                                                }
                                                            } catch (err) {
                                                                console.error(
                                                                    "Toggle pinned failed:",
                                                                    err
                                                                );
                                                            } finally {
                                                                setSkillActionLoading(false);
                                                            }
                                                        }}
                                                    >
                                                        {as.pinned ? "Pinned" : "Discoverable"}
                                                    </Badge>
                                                </div>
                                                <p className="text-muted-foreground font-mono text-xs">
                                                    {as.skill.slug}
                                                    {as.skill.category && (
                                                        <span className="ml-2 opacity-60">
                                                            [{as.skill.category}]
                                                        </span>
                                                    )}
                                                </p>
                                                {as.skill.description && (
                                                    <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
                                                        {as.skill.description}
                                                    </p>
                                                )}
                                                <div className="text-muted-foreground mt-1 flex gap-3 text-[11px]">
                                                    <span>{as.skill._count?.tools ?? 0} tools</span>
                                                    <span>
                                                        {as.skill._count?.documents ?? 0} docs
                                                    </span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDetachSkill(as.skillId)}
                                                disabled={skillActionLoading}
                                            >
                                                Detach
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-muted-foreground rounded-lg border border-dashed py-8 text-center text-sm">
                                    No skills attached. Attach a skill below to give this agent
                                    domain knowledge and procedures.
                                </div>
                            )}

                            {/* Available Skills to Attach */}
                            {(() => {
                                const attachedIds = new Set(attachedSkills.map((as) => as.skillId));
                                const unattached = availableSkills.filter(
                                    (s) => !attachedIds.has(s.id)
                                );
                                if (skillsLoading) {
                                    return <Skeleton className="h-24 w-full" />;
                                }
                                if (unattached.length === 0) return null;
                                return (
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-medium">Available Skills</h4>
                                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                            {unattached.map((skill) => (
                                                <div
                                                    key={skill.id}
                                                    className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3 transition-colors"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-medium">
                                                                {skill.name}
                                                            </p>
                                                            <Badge
                                                                variant="outline"
                                                                className="text-xs"
                                                            >
                                                                v{skill.version}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                                                            {skill.description || skill.slug}
                                                        </p>
                                                        <div className="text-muted-foreground mt-1 flex gap-3 text-[11px]">
                                                            <span>
                                                                {skill.tools?.length ?? 0} tools
                                                            </span>
                                                            <span>
                                                                {skill.documents?.length ?? 0} docs
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleAttachSkill(skill.id)}
                                                        disabled={skillActionLoading}
                                                    >
                                                        Attach
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Orchestration Tab */}
                <TabsContent value="orchestration">
                    <Card>
                        <CardHeader>
                            <CardTitle>Orchestration</CardTitle>
                            <CardDescription>
                                Configure sub-agents and workflows for network routing.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Sub-agents</Label>
                                    <span className="text-muted-foreground text-xs">
                                        {formData.subAgents?.length || 0} selected
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                    {availableAgents
                                        .filter((agentInfo) => agentInfo.slug !== agent?.slug)
                                        .map((agentInfo) => (
                                            <label
                                                key={agentInfo.id}
                                                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                                                    formData.subAgents?.includes(agentInfo.slug)
                                                        ? "border-primary bg-primary/5"
                                                        : "hover:bg-muted/50"
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        formData.subAgents?.includes(
                                                            agentInfo.slug
                                                        ) || false
                                                    }
                                                    onChange={() => toggleSubAgent(agentInfo.slug)}
                                                    className="mt-0.5"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium">
                                                        {agentInfo.name}
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">
                                                        {agentInfo.slug}
                                                    </p>
                                                </div>
                                            </label>
                                        ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Workflows</Label>
                                    <span className="text-muted-foreground text-xs">
                                        {formData.workflows?.length || 0} selected
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                    {availableWorkflows.map((workflow) => (
                                        <label
                                            key={workflow.id}
                                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                                                formData.workflows?.includes(workflow.id)
                                                    ? "border-primary bg-primary/5"
                                                    : "hover:bg-muted/50"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={
                                                    formData.workflows?.includes(workflow.id) ||
                                                    false
                                                }
                                                onChange={() => toggleWorkflow(workflow.id)}
                                                className="mt-0.5"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium">
                                                    {workflow.name}
                                                </p>
                                                <p className="text-muted-foreground text-xs">
                                                    {workflow.slug}
                                                </p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Memory Tab */}
                <TabsContent value="memory">
                    <Card>
                        <CardHeader>
                            <CardTitle>Memory Configuration</CardTitle>
                            <CardDescription>How the agent remembers context</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center gap-4">
                                <Switch
                                    checked={formData.memoryEnabled}
                                    onCheckedChange={(checked) =>
                                        handleChange("memoryEnabled", checked)
                                    }
                                />
                                <Label>Enable Memory</Label>
                            </div>

                            {formData.memoryEnabled && (
                                <div className="bg-muted space-y-6 rounded-lg p-4">
                                    <div className="space-y-2">
                                        <Label>
                                            Last Messages:{" "}
                                            {formData.memoryConfig?.lastMessages || 10}
                                        </Label>
                                        <input
                                            type="range"
                                            min="1"
                                            max="50"
                                            value={formData.memoryConfig?.lastMessages || 10}
                                            onChange={(e) =>
                                                handleChange("memoryConfig", {
                                                    ...formData.memoryConfig,
                                                    lastMessages: parseInt(e.target.value)
                                                } as Agent["memoryConfig"])
                                            }
                                            className="w-full"
                                        />
                                        <p className="text-muted-foreground text-xs">
                                            Number of recent messages to include in context
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={
                                                        formData.memoryConfig?.semanticRecall !==
                                                        false
                                                    }
                                                    onCheckedChange={(checked) =>
                                                        handleChange("memoryConfig", {
                                                            ...formData.memoryConfig,
                                                            semanticRecall: checked
                                                                ? { topK: 5, messageRange: 100 }
                                                                : false
                                                        } as Agent["memoryConfig"])
                                                    }
                                                />
                                                <Label>Semantic Recall</Label>
                                            </div>
                                            <p className="text-muted-foreground text-xs">
                                                Retrieve relevant past messages using embeddings
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={
                                                        formData.memoryConfig?.workingMemory
                                                            ?.enabled
                                                    }
                                                    onCheckedChange={(checked) =>
                                                        handleChange("memoryConfig", {
                                                            ...formData.memoryConfig,
                                                            workingMemory: { enabled: checked }
                                                        } as Agent["memoryConfig"])
                                                    }
                                                />
                                                <Label>Working Memory</Label>
                                            </div>
                                            <p className="text-muted-foreground text-xs">
                                                Maintain structured notes across conversations
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Evaluation Tab */}
                <TabsContent value="evaluation">
                    <Card>
                        <CardHeader>
                            <CardTitle>Evaluation & Scorers</CardTitle>
                            <CardDescription>
                                Automated quality measurement ({formData.scorers?.length || 0}{" "}
                                selected)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {toolsLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-16 w-full" />
                                    <Skeleton className="h-16 w-full" />
                                </div>
                            ) : availableScorers.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {availableScorers.map((scorer) => (
                                        <label
                                            key={scorer.id}
                                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                                                formData.scorers?.includes(scorer.id)
                                                    ? "border-primary bg-primary/5"
                                                    : "hover:bg-muted/50"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={
                                                    formData.scorers?.includes(scorer.id) || false
                                                }
                                                onChange={() => toggleScorer(scorer.id)}
                                                className="mt-1"
                                            />
                                            <div>
                                                <p className="font-medium">{scorer.name}</p>
                                                <p className="text-muted-foreground text-sm">
                                                    {scorer.description}
                                                </p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-muted-foreground py-4 text-center text-sm">
                                    No scorers available
                                </div>
                            )}

                            <div className="bg-muted rounded-lg p-4">
                                <p className="mb-2 text-sm font-medium">Sampling Rate</p>
                                <p className="text-muted-foreground mb-2 text-xs">
                                    Percentage of runs to evaluate (higher = more accurate but
                                    higher cost)
                                </p>
                                <input
                                    type="range"
                                    min="10"
                                    max="100"
                                    defaultValue="100"
                                    className="w-full"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
