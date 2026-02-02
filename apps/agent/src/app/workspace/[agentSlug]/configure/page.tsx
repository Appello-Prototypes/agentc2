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
    TabsTrigger
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface ModelConfig {
    thinking?: {
        type: "enabled" | "disabled";
        budget_tokens?: number;
    };
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
    type: "SYSTEM" | "USER";
    version: number;
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

    // Extended thinking state (for form)
    const [extendedThinking, setExtendedThinking] = useState(false);
    const [thinkingBudget, setThinkingBudget] = useState(10000);

    // Form state
    const [formData, setFormData] = useState<Partial<Agent>>({});
    const [hasChanges, setHasChanges] = useState(false);

    // Fetch available tools, models, and scorers
    const fetchToolsAndScorers = useCallback(async () => {
        try {
            setToolsLoading(true);
            const res = await fetch(`${getApiBase()}/api/agents/tools`);
            const data = await res.json();
            if (data.success) {
                setAvailableTools(data.tools || []);
                setAvailableModels(data.models || []);
                setAvailableScorers(data.scorers || []);
            }
        } catch (err) {
            console.error("Failed to fetch tools:", err);
        } finally {
            setToolsLoading(false);
        }
    }, []);

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
                memoryEnabled: agentData.memoryEnabled ?? false,
                memoryConfig: agentData.memoryConfig,
                modelConfig: agentData.modelConfig,
                scorers: agentData.scorers || [],
                isActive: agentData.isActive ?? true,
                isPublic: agentData.isPublic ?? false,
                type: agentData.type || "USER",
                version: agentData.version ?? 1
            };

            // Extract extended thinking settings from modelConfig
            const modelConfig = agentData.modelConfig as ModelConfig | null;
            const hasExtendedThinking = modelConfig?.thinking?.type === "enabled";
            const budget = modelConfig?.thinking?.budget_tokens ?? 10000;
            setExtendedThinking(hasExtendedThinking);
            setThinkingBudget(budget);

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
    }, [fetchAgent, fetchToolsAndScorers]);

    // Group tools by source for display
    const groupToolsBySource = (tools: ToolInfo[]) => {
        const groups: Record<string, ToolInfo[]> = {};
        tools.forEach((tool) => {
            const source = tool.source || "registry";
            if (!groups[source]) {
                groups[source] = [];
            }
            groups[source].push(tool);
        });
        // Sort groups: registry first, then MCP servers alphabetically
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            if (a === "registry") return -1;
            if (b === "registry") return 1;
            return a.localeCompare(b);
        });
        return sortedKeys.map((key) => ({
            source: key,
            displayName: key === "registry" ? "Built-in Tools" : key.replace("mcp:", ""),
            tools: groups[key]
        }));
    };

    // Select all tools for a specific source
    const selectAllToolsForSource = (source: string) => {
        const sourceToolIds = availableTools.filter((t) => t.source === source).map((t) => t.id);
        const currentTools = formData.tools || [];
        handleChange("tools", [...new Set([...currentTools, ...sourceToolIds])]);
    };

    // Deselect all tools for a specific source
    const deselectAllToolsForSource = (source: string) => {
        const sourceToolIds = availableTools.filter((t) => t.source === source).map((t) => t.id);
        const currentTools = formData.tools || [];
        handleChange(
            "tools",
            currentTools.filter((t) => !sourceToolIds.includes(t))
        );
    };

    // Check if all tools for a source are selected
    const areAllToolsSelectedForSource = (source: string) => {
        const sourceToolIds = availableTools.filter((t) => t.source === source).map((t) => t.id);
        const currentTools = formData.tools || [];
        return sourceToolIds.length > 0 && sourceToolIds.every((id) => currentTools.includes(id));
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
                thinkingBudget
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
                                        ⚠️ This is a SYSTEM agent. Some configuration options may be
                                        restricted.
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
                                <div className="max-h-[500px] space-y-6 overflow-auto">
                                    {groupToolsBySource(availableTools).map((group) => {
                                        const selectedCount = group.tools.filter((t) =>
                                            formData.tools?.includes(t.id)
                                        ).length;
                                        const allSelected = areAllToolsSelectedForSource(
                                            group.source
                                        );
                                        return (
                                            <div key={group.source} className="space-y-3">
                                                <div className="flex items-center justify-between border-b pb-2">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-medium">
                                                            {group.displayName}
                                                        </h4>
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            {selectedCount}/{group.tools.length}
                                                        </Badge>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            allSelected
                                                                ? deselectAllToolsForSource(
                                                                      group.source
                                                                  )
                                                                : selectAllToolsForSource(
                                                                      group.source
                                                                  )
                                                        }
                                                    >
                                                        {allSelected
                                                            ? "Deselect All"
                                                            : "Select All"}
                                                    </Button>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                                    {group.tools.map((tool) => (
                                                        <label
                                                            key={tool.id}
                                                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                                                                formData.tools?.includes(tool.id)
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
                                                                onChange={() => toggleTool(tool.id)}
                                                                className="mt-0.5"
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-medium">
                                                                    {tool.name}
                                                                </p>
                                                                {tool.description && (
                                                                    <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                                                                        {tool.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {availableTools.length === 0 && !toolsLoading && (
                                        <div className="text-muted-foreground py-8 text-center">
                                            <p>No tools available</p>
                                            <p className="mt-1 text-sm">
                                                Check MCP server connections
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
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
