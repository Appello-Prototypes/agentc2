"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
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
    scorers: string[];
    isActive: boolean;
    isPublic: boolean;
    type: "SYSTEM" | "USER";
    version: number;
}

// Mock agent data
const mockAgent: Agent = {
    id: "agent-001",
    slug: "research-assistant",
    name: "Research Assistant",
    description: "A helpful research assistant that can search the web and analyze data",
    instructions: `You are a helpful research assistant. Your primary tasks are:

1. Search the web for accurate information
2. Analyze and synthesize data
3. Provide clear, well-structured responses
4. Always cite your sources

Be concise but thorough. If you're unsure about something, say so.`,
    instructionsTemplate: null,
    modelProvider: "anthropic",
    modelName: "claude-sonnet-4-20250514",
    temperature: 0.7,
    maxTokens: 4096,
    maxSteps: 5,
    tools: ["web-search", "calculator", "calendar"],
    memoryEnabled: true,
    memoryConfig: {
        lastMessages: 10,
        semanticRecall: { topK: 5, messageRange: 100 },
        workingMemory: { enabled: true }
    },
    scorers: ["helpfulness", "relevancy"],
    isActive: true,
    isPublic: false,
    type: "USER",
    version: 4
};

const availableTools = [
    { id: "web-search", name: "Web Search", description: "Search the web for information" },
    { id: "calculator", name: "Calculator", description: "Perform mathematical calculations" },
    { id: "calendar", name: "Calendar", description: "Manage calendar events" },
    { id: "email", name: "Email", description: "Send and read emails" },
    { id: "database-query", name: "Database Query", description: "Query databases" },
    { id: "code-interpreter", name: "Code Interpreter", description: "Execute code" }
];

const availableScorers = [
    { id: "helpfulness", name: "Helpfulness", description: "Measures response helpfulness" },
    { id: "relevancy", name: "Relevancy", description: "Measures response relevancy" },
    { id: "toxicity", name: "Toxicity", description: "Detects toxic content" },
    { id: "completeness", name: "Completeness", description: "Measures response completeness" },
    { id: "tone", name: "Tone", description: "Evaluates response tone" }
];

export default function ConfigurePage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [agent, setAgent] = useState<Agent | null>(null);
    const [activeTab, setActiveTab] = useState("basic");

    // Form state
    const [formData, setFormData] = useState<Partial<Agent>>({});
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        setTimeout(() => {
            setAgent(mockAgent);
            setFormData(mockAgent);
            setLoading(false);
        }, 500);
    }, [agentSlug]);

    const handleChange = <K extends keyof Agent>(key: K, value: Agent[K]) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setSaving(true);
        // Simulate save
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setAgent(formData as Agent);
        setHasChanges(false);
        setSaving(false);
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
                    {hasChanges && (
                        <Badge variant="outline" className="text-yellow-600">
                            Unsaved Changes
                        </Badge>
                    )}
                    <Button variant="outline" onClick={() => setFormData(agent as Agent)}>
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
                                        onValueChange={(v) => v && handleChange("modelProvider", v)}
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
                                        onValueChange={(v) => v && handleChange("modelName", v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="claude-sonnet-4-20250514">
                                                Claude Sonnet 4
                                            </SelectItem>
                                            <SelectItem value="claude-opus-4-20250514">
                                                Claude Opus 4
                                            </SelectItem>
                                            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                                            <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
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
                                        max="1"
                                        step="0.1"
                                        value={formData.temperature || 0.7}
                                        onChange={(e) =>
                                            handleChange("temperature", parseFloat(e.target.value))
                                        }
                                        className="w-full"
                                    />
                                    <p className="text-muted-foreground text-xs">
                                        Lower = more focused, Higher = more creative
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Max Tokens</Label>
                                        <Input
                                            type="number"
                                            value={formData.maxTokens || ""}
                                            onChange={(e) =>
                                                handleChange(
                                                    "maxTokens",
                                                    parseInt(e.target.value) || null
                                                )
                                            }
                                        />
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
                                    </div>
                                </div>
                            </div>

                            {/* Extended Thinking (Anthropic only) */}
                            {formData.modelProvider === "anthropic" && (
                                <div className="bg-muted space-y-4 rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label>Extended Thinking</Label>
                                            <p className="text-muted-foreground text-xs">
                                                Enhanced reasoning for complex tasks (Claude 4 only)
                                            </p>
                                        </div>
                                        <Switch />
                                    </div>
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
                                        onClick={() =>
                                            handleChange(
                                                "tools",
                                                availableTools.map((t) => t.id)
                                            )
                                        }
                                    >
                                        Select All
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleChange("tools", [])}
                                    >
                                        Clear All
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {availableTools.map((tool) => (
                                    <label
                                        key={tool.id}
                                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                                            formData.tools?.includes(tool.id)
                                                ? "border-primary bg-primary/5"
                                                : "hover:bg-muted/50"
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={formData.tools?.includes(tool.id) || false}
                                            onChange={() => toggleTool(tool.id)}
                                            className="mt-1"
                                        />
                                        <div>
                                            <p className="font-medium">{tool.name}</p>
                                            <p className="text-muted-foreground text-sm">
                                                {tool.description}
                                            </p>
                                        </div>
                                    </label>
                                ))}
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
                            <CardDescription>Automated quality measurement</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                                            checked={formData.scorers?.includes(scorer.id) || false}
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
