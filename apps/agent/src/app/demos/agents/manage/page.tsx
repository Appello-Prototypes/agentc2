"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Skeleton,
    Textarea,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "@repo/ui";

// Types - Updated for new Agent model
interface AgentTool {
    id: string;
    agentId: string;
    toolId: string;
    config: unknown | null;
}

interface StoredAgent {
    id: string;
    slug?: string;
    name: string;
    description: string | null;
    instructions: string;
    instructionsTemplate?: string | null;
    modelProvider: string;
    modelName: string;
    temperature: number | null;
    maxTokens?: number | null;
    modelConfig?: Record<string, unknown> | null;
    // Support both old and new formats
    // tools is optional since list endpoint returns toolCount instead
    tools?: string[] | AgentTool[];
    // toolCount is returned by list endpoint for efficiency
    toolCount?: number;
    memory?: boolean;
    memoryEnabled?: boolean;
    memoryConfig?: {
        lastMessages?: number;
        semanticRecall?: { topK?: number; messageRange?: number } | false;
        workingMemory?: { enabled?: boolean; template?: string };
    } | null;
    maxSteps?: number | null;
    scorers?: string[];
    type?: "SYSTEM" | "USER" | "DEMO";
    ownerId?: string | null;
    visibility?: "PRIVATE" | "ORGANIZATION" | "PUBLIC";
    metadata: Record<string, unknown> | null;
    isActive: boolean;
    version?: number;
    createdAt: string;
    updatedAt: string;
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

interface ModelInfo {
    provider: string;
    name: string;
    displayName: string;
}

// Helper to get tool IDs from agent (when full tools array is available)
function getToolIds(agent: StoredAgent): string[] {
    if (!agent.tools || agent.tools.length === 0) return [];
    // Check if it's the new format (array of objects with toolId)
    if (typeof agent.tools[0] === "object" && "toolId" in agent.tools[0]) {
        return (agent.tools as AgentTool[]).map((t) => t.toolId);
    }
    // Old format (array of strings)
    return agent.tools as string[];
}

// Helper to get tool count (works with both list and detail responses)
function getToolCount(agent: StoredAgent): number {
    // List endpoint returns toolCount directly
    if (typeof agent.toolCount === "number") {
        return agent.toolCount;
    }
    // Detail endpoint returns tools array
    return getToolIds(agent).length;
}

// Helper to check if agent is deletable (SYSTEM agents cannot be deleted)
function isAgentDeletable(agent: StoredAgent): boolean {
    return agent.type !== "SYSTEM";
}

type ViewMode = "list" | "create" | "edit";

function AgentManagePageContent() {
    // URL params for deep linking
    const searchParams = useSearchParams();
    const agentParam = searchParams.get("agent");

    // Data state
    const [storedAgents, setStoredAgents] = useState<StoredAgent[]>([]);
    const [availableTools, setAvailableTools] = useState<ToolInfo[]>([]);
    const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
    const [toolCategoryOrder, setToolCategoryOrder] = useState<string[]>([]);
    const [collapsedToolGroups, setCollapsedToolGroups] = useState<Set<string>>(new Set());

    // UI state
    const [selectedAgent, setSelectedAgent] = useState<StoredAgent | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("list");
    const [loading, setLoading] = useState({ list: true, tools: true, action: false, test: false });
    const [activeTab, setActiveTab] = useState("overview");

    // Form state for create/edit (enhanced with new fields)
    const [formData, setFormData] = useState({
        name: "",
        slug: "",
        description: "",
        instructions: "",
        instructionsTemplate: "",
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        temperature: 0.7,
        maxSteps: 5,
        tools: [] as string[],
        memoryEnabled: false,
        memoryConfig: {
            lastMessages: 10,
            semanticRecall: false as { topK?: number; messageRange?: number } | false,
            workingMemory: { enabled: false }
        },
        isActive: true,
        visibility: "PRIVATE" as "PRIVATE" | "ORGANIZATION" | "PUBLIC",
        extendedThinking: false,
        thinkingBudget: 10000
    });

    // Test panel state
    const [testInput, setTestInput] = useState("");
    const [testOutput, setTestOutput] = useState<string | null>(null);

    // Fetch stored agents
    const fetchStoredAgents = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/agents`);
            const data = await res.json();
            if (data.success) {
                setStoredAgents(data.agents);
            }
        } catch (error) {
            console.error("Failed to fetch stored agents:", error);
        } finally {
            setLoading((prev) => ({ ...prev, list: false }));
        }
    }, []);

    // Fetch available tools, models, and scorers
    const fetchToolsAndModels = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/agents/tools`, {
                credentials: "include"
            });
            const data = await res.json();
            if (data.success) {
                setAvailableTools(data.tools);
                setAvailableModels(data.models);
                setToolCategoryOrder(data.toolCategoryOrder || []);
            }
        } catch (error) {
            console.error("Failed to fetch tools:", error);
        } finally {
            setLoading((prev) => ({ ...prev, tools: false }));
        }
    }, []);

    // Create agent
    const createAgent = async () => {
        setLoading((prev) => ({ ...prev, action: true }));
        try {
            const res = await fetch(`${getApiBase()}/api/agents`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                await fetchStoredAgents();
                setSelectedAgent(data.agent);
                setViewMode("list");
                resetForm();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error("Failed to create agent:", error);
            alert("Failed to create agent");
        } finally {
            setLoading((prev) => ({ ...prev, action: false }));
        }
    };

    // Update agent
    const updateAgent = async () => {
        if (!selectedAgent) return;
        setLoading((prev) => ({ ...prev, action: true }));
        try {
            const res = await fetch(`${getApiBase()}/api/agents/${selectedAgent.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                await fetchStoredAgents();
                setSelectedAgent(data.agent);
                setViewMode("list");
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error("Failed to update agent:", error);
            alert("Failed to update agent");
        } finally {
            setLoading((prev) => ({ ...prev, action: false }));
        }
    };

    // Delete agent
    const deleteAgent = async (id: string) => {
        setLoading((prev) => ({ ...prev, action: true }));
        try {
            const res = await fetch(`${getApiBase()}/api/agents/${id}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (data.success) {
                await fetchStoredAgents();
                if (selectedAgent?.id === id) {
                    setSelectedAgent(null);
                }
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error("Failed to delete agent:", error);
            alert("Failed to delete agent");
        } finally {
            setLoading((prev) => ({ ...prev, action: false }));
        }
    };

    // Fetch full agent details (list endpoint returns partial data)
    const fetchAgentDetails = useCallback(async (agentId: string) => {
        try {
            const res = await fetch(`${getApiBase()}/api/agents/${agentId}`);
            const data = await res.json();
            if (data.success && data.agent) {
                setSelectedAgent(data.agent);
                setActiveTab("overview");
                setTestOutput(null);
            } else {
                console.error("Failed to fetch agent details:", data.error);
            }
        } catch (error) {
            console.error("Failed to fetch agent details:", error);
        }
    }, []);

    // Test agent
    const testAgent = async () => {
        if (!selectedAgent || !testInput.trim()) return;

        setLoading((prev) => ({ ...prev, test: true }));
        setTestOutput(null);

        try {
            const res = await fetch(`${getApiBase()}/api/agents/${selectedAgent.id}/test`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: testInput })
            });
            const data = await res.json();
            if (data.success) {
                setTestOutput(
                    `${data.response.text}\n\n---\nModel: ${data.response.model}\nDuration: ${data.response.durationMs}ms\nTool calls: ${data.response.toolCalls}`
                );
            } else {
                setTestOutput(`Error: ${data.error}`);
            }
        } catch (error) {
            setTestOutput(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setLoading((prev) => ({ ...prev, test: false }));
        }
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            name: "",
            slug: "",
            description: "",
            instructions: "",
            instructionsTemplate: "",
            modelProvider: "anthropic",
            modelName: "claude-sonnet-4-20250514",
            temperature: 0.7,
            maxSteps: 5,
            tools: [],
            memoryEnabled: false,
            memoryConfig: {
                lastMessages: 10,
                semanticRecall: false,
                workingMemory: { enabled: false }
            },
            isActive: true,
            visibility: "PRIVATE" as "PRIVATE" | "ORGANIZATION" | "PUBLIC",
            extendedThinking: false,
            thinkingBudget: 10000
        });
    };

    // Load agent into form for editing
    const loadAgentForEdit = async (agent: StoredAgent) => {
        // Fetch full agent data since the list endpoint doesn't include all fields
        try {
            const res = await fetch(`${getApiBase()}/api/agents/${agent.id}`);
            const data = await res.json();
            if (!data.success || !data.agent) {
                alert("Failed to load agent details");
                return;
            }
            const fullAgent = data.agent as StoredAgent;

            // Extract extended thinking settings from modelConfig
            const modelConfig = fullAgent.modelConfig as {
                thinking?: { type: string; budget_tokens?: number };
            } | null;
            const extendedThinking = modelConfig?.thinking?.type === "enabled";
            const thinkingBudget = modelConfig?.thinking?.budget_tokens ?? 10000;

            setFormData({
                name: fullAgent.name,
                slug: fullAgent.slug || "",
                description: fullAgent.description || "",
                instructions: fullAgent.instructions,
                instructionsTemplate: fullAgent.instructionsTemplate || "",
                modelProvider: fullAgent.modelProvider,
                modelName: fullAgent.modelName,
                temperature: fullAgent.temperature ?? 0.7,
                maxSteps: fullAgent.maxSteps ?? 5,
                tools: getToolIds(fullAgent),
                memoryEnabled: fullAgent.memoryEnabled ?? fullAgent.memory ?? false,
                memoryConfig: {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    lastMessages: (fullAgent.memoryConfig as any)?.lastMessages ?? 10,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    semanticRecall: (fullAgent.memoryConfig as any)?.semanticRecall ?? false,
                    workingMemory: {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        enabled: (fullAgent.memoryConfig as any)?.workingMemory?.enabled ?? false
                    }
                },
                isActive: fullAgent.isActive,
                visibility: (fullAgent.visibility ?? "PRIVATE") as
                    | "PRIVATE"
                    | "ORGANIZATION"
                    | "PUBLIC",
                extendedThinking,
                thinkingBudget
            });
            setSelectedAgent(fullAgent);
            setViewMode("edit");
        } catch (error) {
            console.error("Failed to load agent for editing:", error);
            alert("Failed to load agent details");
        }
    };

    // Toggle tool selection
    const toggleTool = (toolId: string) => {
        setFormData((prev) => ({
            ...prev,
            tools: prev.tools.includes(toolId)
                ? prev.tools.filter((t) => t !== toolId)
                : [...prev.tools, toolId]
        }));
    };

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

    // Select all tools
    const selectAllTools = () => {
        setFormData((prev) => ({
            ...prev,
            tools: availableTools.map((t) => t.id)
        }));
    };

    // Deselect all tools
    const deselectAllTools = () => {
        setFormData((prev) => ({
            ...prev,
            tools: []
        }));
    };

    // Select all tools in a group
    const selectAllToolsForGroup = (group: ToolGroup) => {
        const groupToolIds = group.tools.map((t) => t.id);
        setFormData((prev) => ({
            ...prev,
            tools: [...new Set([...prev.tools, ...groupToolIds])]
        }));
    };

    // Deselect all tools in a group
    const deselectAllToolsForGroup = (group: ToolGroup) => {
        const groupToolIds = new Set(group.tools.map((t) => t.id));
        setFormData((prev) => ({
            ...prev,
            tools: prev.tools.filter((t) => !groupToolIds.has(t))
        }));
    };

    // Check if all tools in a group are selected
    const areAllToolsSelectedForGroup = (group: ToolGroup) => {
        return group.tools.length > 0 && group.tools.every((t) => formData.tools.includes(t.id));
    };

    // Initial fetch
    useEffect(() => {
        fetchStoredAgents();
        fetchToolsAndModels();
    }, [fetchStoredAgents, fetchToolsAndModels]);

    // Handle ?agent= query parameter for deep linking
    useEffect(() => {
        if (agentParam && storedAgents.length > 0 && !selectedAgent) {
            // Find agent by slug or id
            const agent = storedAgents.find((a) => a.slug === agentParam || a.id === agentParam);
            if (agent) {
                fetchAgentDetails(agent.id);
            }
        }
    }, [agentParam, storedAgents, selectedAgent, fetchAgentDetails]);

    // Render form (used for both create and edit)
    const renderForm = () => (
        <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                        placeholder="My Assistant"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="slug">Slug (URL-safe identifier)</Label>
                    <Input
                        id="slug"
                        value={formData.slug}
                        onChange={(e) =>
                            setFormData((p) => ({
                                ...p,
                                slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")
                            }))
                        }
                        placeholder="my-assistant"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                    placeholder="A helpful assistant..."
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="instructions">System Instructions *</Label>
                <Textarea
                    id="instructions"
                    value={formData.instructions}
                    onChange={(e) => setFormData((p) => ({ ...p, instructions: e.target.value }))}
                    placeholder="You are a helpful assistant..."
                    rows={6}
                />
            </div>

            {/* Model Configuration */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                    <Label>Model Provider *</Label>
                    <Select
                        value={formData.modelProvider}
                        onValueChange={(v) => v && setFormData((p) => ({ ...p, modelProvider: v }))}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="openai">OpenAI</SelectItem>
                            <SelectItem value="anthropic">Anthropic</SelectItem>
                            <SelectItem value="google">Google</SelectItem>
                            <SelectItem value="groq">Groq</SelectItem>
                            <SelectItem value="deepseek">DeepSeek</SelectItem>
                            <SelectItem value="mistral">Mistral</SelectItem>
                            <SelectItem value="xai">xAI (Grok)</SelectItem>
                            <SelectItem value="togetherai">Together AI</SelectItem>
                            <SelectItem value="fireworks">Fireworks AI</SelectItem>
                            <SelectItem value="openrouter">OpenRouter</SelectItem>
                            <SelectItem value="kimi">Kimi (Moonshot)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Model *</Label>
                    <Select
                        value={formData.modelName}
                        onValueChange={(v) => v && setFormData((p) => ({ ...p, modelName: v }))}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {availableModels
                                .filter((m) => m.provider === formData.modelProvider)
                                .map((m) => (
                                    <SelectItem key={m.name} value={m.name}>
                                        {m.displayName}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Max Steps: {formData.maxSteps}</Label>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={formData.maxSteps}
                        onChange={(e) =>
                            setFormData((p) => ({ ...p, maxSteps: parseInt(e.target.value) }))
                        }
                        className="w-full"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Temperature: {formData.temperature}</Label>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) =>
                        setFormData((p) => ({ ...p, temperature: parseFloat(e.target.value) }))
                    }
                    className="w-full"
                />
            </div>

            {/* Extended Thinking (Anthropic Claude 4+ only) */}
            {formData.modelProvider === "anthropic" &&
                (formData.modelName.includes("opus-4") ||
                    formData.modelName.includes("sonnet-4")) && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={formData.extendedThinking}
                                onCheckedChange={(c) =>
                                    setFormData((p) => ({ ...p, extendedThinking: c }))
                                }
                            />
                            <Label>Extended Thinking</Label>
                            <span className="text-muted-foreground text-xs">
                                (Enhanced reasoning for complex tasks)
                            </span>
                        </div>

                        {formData.extendedThinking && (
                            <div className="bg-muted space-y-2 rounded-lg p-4">
                                <Label>
                                    Thinking Budget: {formData.thinkingBudget.toLocaleString()}{" "}
                                    tokens
                                </Label>
                                <input
                                    type="range"
                                    min="1024"
                                    max="32000"
                                    step="1024"
                                    value={formData.thinkingBudget}
                                    onChange={(e) =>
                                        setFormData((p) => ({
                                            ...p,
                                            thinkingBudget: parseInt(e.target.value)
                                        }))
                                    }
                                    className="w-full"
                                />
                                <p className="text-muted-foreground text-xs">
                                    Higher budgets enable more thorough reasoning but increase
                                    latency and cost.
                                </p>
                            </div>
                        )}
                    </div>
                )}

            {/* Tools */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label>
                        Tools ({formData.tools.length} of {availableTools.length} selected)
                    </Label>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={selectAllTools}
                            disabled={formData.tools.length === availableTools.length}
                        >
                            Select All
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={deselectAllTools}
                            disabled={formData.tools.length === 0}
                        >
                            Deselect All
                        </Button>
                    </div>
                </div>
                <div className="max-h-96 space-y-4 overflow-auto rounded-lg border p-4">
                    {(() => {
                        const groups = groupTools(availableTools);
                        const builtInCount = availableTools.filter(
                            (t) => t.source === "registry"
                        ).length;
                        const builtInSelected = availableTools.filter(
                            (t) => t.source === "registry" && formData.tools.includes(t.id)
                        ).length;
                        return (
                            <>
                                {builtInCount > 0 && (
                                    <div className="flex items-center gap-2 border-b pb-2">
                                        <h3 className="text-sm font-semibold tracking-wide uppercase">
                                            Built-in Tools
                                        </h3>
                                        <Badge variant="outline" className="text-xs">
                                            {builtInSelected}/{builtInCount}
                                        </Badge>
                                    </div>
                                )}
                                {groups.map((group) => {
                                    const selectedCount = group.tools.filter((t) =>
                                        formData.tools.includes(t.id)
                                    ).length;
                                    const allSelected = areAllToolsSelectedForGroup(group);
                                    const isCollapsed = collapsedToolGroups.has(group.key);
                                    const isFirstMcp =
                                        group.isMcp &&
                                        groups.findIndex((g) => g.isMcp) === groups.indexOf(group);
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
                                                            toggleToolGroupCollapse(group.key)
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
                                                            {selectedCount}/{group.tools.length}
                                                        </Badge>
                                                    </button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            allSelected
                                                                ? deselectAllToolsForGroup(group)
                                                                : selectAllToolsForGroup(group)
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
                                                                className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.tools.includes(
                                                                        tool.id
                                                                    )}
                                                                    onChange={() =>
                                                                        toggleTool(tool.id)
                                                                    }
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
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* Memory Configuration */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Switch
                        checked={formData.memoryEnabled}
                        onCheckedChange={(c) => setFormData((p) => ({ ...p, memoryEnabled: c }))}
                    />
                    <Label>Enable Memory</Label>
                </div>

                {formData.memoryEnabled && (
                    <div className="bg-muted space-y-4 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Last Messages: {formData.memoryConfig.lastMessages}</Label>
                                <input
                                    type="range"
                                    min="1"
                                    max="50"
                                    value={formData.memoryConfig.lastMessages}
                                    onChange={(e) =>
                                        setFormData((p) => ({
                                            ...p,
                                            memoryConfig: {
                                                ...p.memoryConfig,
                                                lastMessages: parseInt(e.target.value)
                                            }
                                        }))
                                    }
                                    className="w-full"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={
                                            formData.memoryConfig.workingMemory?.enabled ?? false
                                        }
                                        onCheckedChange={(c) =>
                                            setFormData((p) => ({
                                                ...p,
                                                memoryConfig: {
                                                    ...p.memoryConfig,
                                                    workingMemory: {
                                                        ...p.memoryConfig.workingMemory,
                                                        enabled: c
                                                    }
                                                }
                                            }))
                                        }
                                    />
                                    <Label>Working Memory</Label>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Status Toggles */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <Switch
                        checked={formData.isActive}
                        onCheckedChange={(c) => setFormData((p) => ({ ...p, isActive: c }))}
                    />
                    <Label>Active</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Label>Visibility</Label>
                    <Select
                        value={formData.visibility}
                        onValueChange={(v) =>
                            setFormData((p) => ({
                                ...p,
                                visibility: v as "PRIVATE" | "ORGANIZATION" | "PUBLIC"
                            }))
                        }
                    >
                        <SelectTrigger className="w-[160px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="PRIVATE">Private</SelectItem>
                            <SelectItem value="ORGANIZATION">Organization</SelectItem>
                            <SelectItem value="PUBLIC">Public</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <Button
                    onClick={viewMode === "create" ? createAgent : updateAgent}
                    disabled={loading.action || !formData.name || !formData.instructions}
                >
                    {loading.action
                        ? "Saving..."
                        : viewMode === "create"
                          ? "Create Agent"
                          : "Save Changes"}
                </Button>
                <Button
                    variant="outline"
                    onClick={() => {
                        setViewMode("list");
                        resetForm();
                    }}
                >
                    Cancel
                </Button>
            </div>
        </div>
    );

    return (
        <div className="container mx-auto space-y-6 py-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Agent Management</h1>
                    <p className="text-muted-foreground">
                        Create, edit, and test your database-backed agents
                    </p>
                </div>
                {viewMode === "list" && (
                    <Button
                        onClick={() => {
                            resetForm();
                            setViewMode("create");
                        }}
                    >
                        Create Agent
                    </Button>
                )}
            </div>

            {/* Create/Edit Form */}
            {(viewMode === "create" || viewMode === "edit") && (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {viewMode === "create"
                                ? "Create New Agent"
                                : `Edit: ${selectedAgent?.name}`}
                        </CardTitle>
                        <CardDescription>
                            {viewMode === "create"
                                ? "Configure a new stored agent"
                                : "Modify agent configuration"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>{renderForm()}</CardContent>
                </Card>
            )}

            {/* List View */}
            {viewMode === "list" && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Left Column: Agent List */}
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Stored Agents</CardTitle>
                                <CardDescription>
                                    {storedAgents.length} agents in database
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading.list ? (
                                    <div className="space-y-2">
                                        {[1, 2, 3].map((i) => (
                                            <Skeleton key={i} className="h-16 w-full" />
                                        ))}
                                    </div>
                                ) : storedAgents.length === 0 ? (
                                    <div className="text-muted-foreground py-8 text-center">
                                        <p>No agents yet</p>
                                        <p className="mt-2 text-sm">
                                            Click &quot;Create Agent&quot; to add one
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {storedAgents.map((agent) => (
                                            <div
                                                key={agent.id}
                                                className={`hover:bg-muted/50 cursor-pointer rounded-lg border p-3 transition-colors ${
                                                    selectedAgent?.id === agent.id
                                                        ? "border-primary bg-primary/5"
                                                        : ""
                                                }`}
                                                onClick={() => {
                                                    // Fetch full agent details (list response is partial)
                                                    fetchAgentDetails(agent.id);
                                                }}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="font-medium">{agent.name}</p>
                                                        <p className="text-muted-foreground font-mono text-xs">
                                                            {agent.slug || agent.modelProvider}/
                                                            {agent.modelName}
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {agent.type === "SYSTEM" && (
                                                            <Badge
                                                                variant="default"
                                                                className="text-xs"
                                                            >
                                                                SYSTEM
                                                            </Badge>
                                                        )}
                                                        {(agent.memoryEnabled || agent.memory) && (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-xs"
                                                            >
                                                                Memory
                                                            </Badge>
                                                        )}
                                                        {!agent.isActive && (
                                                            <Badge
                                                                variant="secondary"
                                                                className="text-xs"
                                                            >
                                                                Inactive
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="mt-2 flex gap-2">
                                                    <Badge variant="outline" className="text-xs">
                                                        {getToolCount(agent)} tools
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Agent Detail */}
                    <div className="lg:col-span-2">
                        {selectedAgent ? (
                            <Card>
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle>{selectedAgent.name}</CardTitle>
                                            <CardDescription>
                                                {selectedAgent.description || "No description"}
                                            </CardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => loadAgentForEdit(selectedAgent)}
                                            >
                                                Edit
                                            </Button>
                                            {isAgentDeletable(selectedAgent) ? (
                                                <AlertDialog>
                                                    <AlertDialogTrigger>
                                                        <Button variant="destructive" size="sm">
                                                            Delete
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>
                                                                Delete Agent?
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently delete &quot;
                                                                {selectedAgent.name}&quot;. This
                                                                action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>
                                                                Cancel
                                                            </AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() =>
                                                                    deleteAgent(selectedAgent.id)
                                                                }
                                                            >
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            ) : (
                                                <Badge variant="secondary">Protected</Badge>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <Tabs
                                        defaultValue="overview"
                                        value={activeTab}
                                        onValueChange={(v) => v && setActiveTab(v)}
                                    >
                                        <TabsList className="mb-4">
                                            <TabsTrigger value="overview">Overview</TabsTrigger>
                                            <TabsTrigger value="instructions">
                                                Instructions
                                            </TabsTrigger>
                                            <TabsTrigger value="tools">
                                                Tools ({getToolIds(selectedAgent).length})
                                            </TabsTrigger>
                                            <TabsTrigger value="test">Test</TabsTrigger>
                                        </TabsList>

                                        {/* Overview Tab */}
                                        <TabsContent value="overview" className="space-y-4">
                                            {/* Type Badge */}
                                            {selectedAgent.type && (
                                                <div className="flex gap-2">
                                                    <Badge
                                                        variant={
                                                            selectedAgent.type === "SYSTEM"
                                                                ? "default"
                                                                : "outline"
                                                        }
                                                    >
                                                        {selectedAgent.type}
                                                    </Badge>
                                                    {selectedAgent.slug && (
                                                        <Badge
                                                            variant="outline"
                                                            className="font-mono"
                                                        >
                                                            {selectedAgent.slug}
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}

                                            <div className="bg-muted rounded-lg p-4">
                                                <h3 className="mb-2 font-medium">
                                                    Model Configuration
                                                </h3>
                                                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                                    <div>
                                                        <p className="text-muted-foreground text-sm">
                                                            Provider
                                                        </p>
                                                        <p className="font-mono">
                                                            {selectedAgent.modelProvider}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground text-sm">
                                                            Model
                                                        </p>
                                                        <p className="font-mono">
                                                            {selectedAgent.modelName}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground text-sm">
                                                            Temperature
                                                        </p>
                                                        <p className="font-mono">
                                                            {selectedAgent.temperature ?? 0.7}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground text-sm">
                                                            Max Steps
                                                        </p>
                                                        <p className="font-mono">
                                                            {selectedAgent.maxSteps ?? 5}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                                <div className="bg-muted rounded-lg p-4">
                                                    <h3 className="mb-2 font-medium">Memory</h3>
                                                    <Badge
                                                        variant={
                                                            selectedAgent.memoryEnabled ||
                                                            selectedAgent.memory
                                                                ? "default"
                                                                : "outline"
                                                        }
                                                    >
                                                        {selectedAgent.memoryEnabled ||
                                                        selectedAgent.memory
                                                            ? "Enabled"
                                                            : "Disabled"}
                                                    </Badge>
                                                    {selectedAgent.memoryConfig && (
                                                        <p className="text-muted-foreground mt-2 text-xs">
                                                            Last{" "}
                                                            {selectedAgent.memoryConfig
                                                                .lastMessages || 10}{" "}
                                                            messages
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="bg-muted rounded-lg p-4">
                                                    <h3 className="mb-2 font-medium">Status</h3>
                                                    <div className="flex gap-2">
                                                        <Badge
                                                            variant={
                                                                selectedAgent.isActive
                                                                    ? "default"
                                                                    : "secondary"
                                                            }
                                                        >
                                                            {selectedAgent.isActive
                                                                ? "Active"
                                                                : "Inactive"}
                                                        </Badge>
                                                        {selectedAgent.visibility &&
                                                            selectedAgent.visibility !==
                                                                "PRIVATE" && (
                                                                <Badge variant="outline">
                                                                    {selectedAgent.visibility ===
                                                                    "ORGANIZATION"
                                                                        ? "Org"
                                                                        : "Public"}
                                                                </Badge>
                                                            )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-muted rounded-lg p-4">
                                                <h3 className="mb-2 font-medium">Timestamps</h3>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <span className="text-muted-foreground">
                                                            Created:
                                                        </span>{" "}
                                                        {new Date(
                                                            selectedAgent.createdAt
                                                        ).toLocaleString()}
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">
                                                            Updated:
                                                        </span>{" "}
                                                        {new Date(
                                                            selectedAgent.updatedAt
                                                        ).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        {/* Instructions Tab */}
                                        <TabsContent value="instructions">
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-medium">
                                                        System Instructions
                                                    </h3>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(
                                                                selectedAgent.instructions
                                                            );
                                                        }}
                                                    >
                                                        Copy
                                                    </Button>
                                                </div>
                                                <pre className="bg-muted max-h-96 overflow-auto rounded-lg p-4 text-sm whitespace-pre-wrap">
                                                    {selectedAgent.instructions}
                                                </pre>
                                            </div>
                                        </TabsContent>

                                        {/* Tools Tab */}
                                        <TabsContent value="tools">
                                            <div className="space-y-4">
                                                <p className="text-muted-foreground text-sm">
                                                    {getToolIds(selectedAgent).length} tools
                                                    attached
                                                </p>
                                                {getToolIds(selectedAgent).length === 0 ? (
                                                    <div className="text-muted-foreground bg-muted rounded-lg p-4 text-center">
                                                        No tools configured
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {getToolIds(selectedAgent).map((toolId) => {
                                                            const tool = availableTools.find(
                                                                (t) => t.id === toolId
                                                            );
                                                            return (
                                                                <div
                                                                    key={toolId}
                                                                    className="bg-muted rounded-lg p-3"
                                                                >
                                                                    <p className="text-primary font-mono text-sm">
                                                                        {toolId}
                                                                    </p>
                                                                    {tool?.description && (
                                                                        <p className="text-muted-foreground mt-1 text-xs">
                                                                            {tool.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>

                                        {/* Test Tab */}
                                        <TabsContent value="test">
                                            <div className="space-y-4">
                                                <div>
                                                    <h3 className="mb-2 font-medium">Test Agent</h3>
                                                    <p className="text-muted-foreground mb-4 text-sm">
                                                        Send a message to test this agent
                                                    </p>
                                                </div>

                                                <div className="space-y-2">
                                                    <Textarea
                                                        placeholder="Enter your test message..."
                                                        value={testInput}
                                                        onChange={(e) =>
                                                            setTestInput(e.target.value)
                                                        }
                                                        rows={3}
                                                    />
                                                    <Button
                                                        onClick={testAgent}
                                                        disabled={loading.test || !testInput.trim()}
                                                        className="w-full"
                                                    >
                                                        {loading.test
                                                            ? "Testing..."
                                                            : "Send Test Message"}
                                                    </Button>
                                                </div>

                                                {testOutput && (
                                                    <div className="space-y-2">
                                                        <h4 className="font-medium">Response</h4>
                                                        <div className="bg-muted max-h-60 overflow-auto rounded-lg p-4">
                                                            <p className="text-sm whitespace-pre-wrap">
                                                                {testOutput}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardContent className="text-muted-foreground py-12 text-center">
                                    <p className="text-lg">Select an agent to view details</p>
                                    <p className="mt-2 text-sm">
                                        Or click &quot;Create Agent&quot; to add a new one
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AgentManagePage() {
    return (
        <Suspense
            fallback={<div className="flex h-full items-center justify-center">Loading...</div>}
        >
            <AgentManagePageContent />
        </Suspense>
    );
}
