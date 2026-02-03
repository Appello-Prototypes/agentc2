"use client";

import { useState, useCallback } from "react";
import { getApiBase } from "@/lib/utils";
import Image from "next/image";
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
    CodeBlock,
    CodeBlockHeader,
    CodeBlockTitle,
    CodeBlockFilename,
    CodeBlockActions,
    CodeBlockCopyButton,
    Loader
} from "@repo/ui";
import { FileJsonIcon } from "lucide-react";

interface StructuredResultType {
    result?: unknown;
    error?: string;
}

interface VisionResultType {
    analysis?: {
        description?: string;
        objects?: string[];
        colors?: string[];
        mood?: string;
    };
    error?: string;
}

interface ResearchStep {
    type: string;
    content: unknown;
}

interface ResearchResultType {
    text?: string;
    steps?: ResearchStep[];
    toolCalls?: unknown[];
    error?: string;
}

// SSE stream consumer helper
async function consumeSSEStream(
    response: Response,
    onEvent: (event: string, data: unknown) => void
): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
            if (line.startsWith("event: ")) {
                currentEvent = line.slice(7);
            } else if (line.startsWith("data: ") && currentEvent) {
                try {
                    const data = JSON.parse(line.slice(6));
                    onEvent(currentEvent, data);
                } catch {
                    // Ignore parse errors
                }
                currentEvent = "";
            }
        }
    }
}

export default function AgentsDemoPage() {
    const [structuredInput, setStructuredInput] = useState("Break down the task: Build a website");
    const [structuredSchema, setStructuredSchema] = useState("taskBreakdown");
    const [structuredResult, setStructuredResult] = useState<StructuredResultType | null>(null);
    const [structuredLoading, setStructuredLoading] = useState(false);

    const [visionUrl, setVisionUrl] = useState("https://placebear.com/cache/395-205.jpg");
    const [visionResult, setVisionResult] = useState<VisionResultType | null>(null);
    const [visionLoading, setVisionLoading] = useState(false);

    const [researchQuery, setResearchQuery] = useState("What are the benefits of TypeScript?");
    const [researchResult, setResearchResult] = useState<ResearchResultType | null>(null);
    const [researchLoading, setResearchLoading] = useState(false);

    const handleStructured = async () => {
        setStructuredLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/api/demos/agents/structured`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: structuredInput, schema: structuredSchema })
            });
            const data = await res.json();
            setStructuredResult(data);
        } catch {
            setStructuredResult({ error: "Failed to generate structured output" });
        }
        setStructuredLoading(false);
    };

    const handleVision = async () => {
        setVisionLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/api/demos/agents/vision`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageUrl: visionUrl })
            });
            const data = await res.json();
            setVisionResult(data);
        } catch {
            setVisionResult({ error: "Failed to analyze image" });
        }
        setVisionLoading(false);
    };

    const handleResearch = useCallback(async () => {
        setResearchLoading(true);
        setResearchResult(null);

        try {
            const res = await fetch(`${getApiBase()}/api/demos/agents/research`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: researchQuery, maxSteps: 5 })
            });

            if (!res.ok) {
                const data = await res.json();
                setResearchResult({ error: data.error || "Failed to perform research" });
                setResearchLoading(false);
                return;
            }

            const steps: ResearchStep[] = [];
            let currentText = "";

            await consumeSSEStream(res, (event, data) => {
                const d = data as {
                    chunk?: string;
                    full?: string;
                    type?: string;
                    content?: unknown;
                    text?: string;
                    steps?: ResearchStep[];
                    message?: string;
                };

                if (event === "text") {
                    currentText = d.full || "";
                    setResearchResult({ text: currentText, steps });
                } else if (event === "step") {
                    steps.push({ type: d.type || "unknown", content: d.content });
                    setResearchResult({ text: currentText, steps: [...steps] });
                } else if (event === "done") {
                    setResearchResult({ text: d.text || currentText, steps: d.steps || steps });
                } else if (event === "error") {
                    setResearchResult({ error: d.message || "Research failed" });
                }
            });
        } catch {
            setResearchResult({ error: "Failed to perform research" });
        }
        setResearchLoading(false);
    }, [researchQuery]);

    return (
        <div>
            <h1 className="mb-2 text-3xl font-bold">Agents Demo</h1>
            <p className="text-muted-foreground mb-8">
                Explore different agent types: structured output, vision analysis, and multi-step
                research.
            </p>

            <Tabs defaultValue="structured">
                <TabsList className="mb-6">
                    <TabsTrigger value="structured">Structured Output</TabsTrigger>
                    <TabsTrigger value="vision">Vision</TabsTrigger>
                    <TabsTrigger value="research">Research</TabsTrigger>
                </TabsList>

                <TabsContent value="structured">
                    <Card>
                        <CardHeader>
                            <CardTitle>Structured Output Agent</CardTitle>
                            <CardDescription>
                                Returns typed JSON objects instead of plain text.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium">Prompt</label>
                                <Textarea
                                    value={structuredInput}
                                    onChange={(e) => setStructuredInput(e.target.value)}
                                    placeholder="Enter your prompt..."
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium">Schema</label>
                                <select
                                    value={structuredSchema}
                                    onChange={(e) => setStructuredSchema(e.target.value)}
                                    className="bg-background w-full rounded-md border p-2"
                                >
                                    <option value="taskBreakdown">Task Breakdown</option>
                                    <option value="entityExtraction">Entity Extraction</option>
                                    <option value="sentimentAnalysis">Sentiment Analysis</option>
                                </select>
                            </div>
                            <Button onClick={handleStructured} disabled={structuredLoading}>
                                {structuredLoading ? (
                                    <>
                                        <Loader size={16} /> Generating...
                                    </>
                                ) : (
                                    "Generate"
                                )}
                            </Button>
                            {structuredResult && (
                                <CodeBlock
                                    code={JSON.stringify(structuredResult, null, 2)}
                                    language="json"
                                    className="mt-4"
                                >
                                    <CodeBlockHeader>
                                        <CodeBlockTitle>
                                            <FileJsonIcon className="size-4" />
                                            <CodeBlockFilename>result.json</CodeBlockFilename>
                                        </CodeBlockTitle>
                                        <CodeBlockActions>
                                            <CodeBlockCopyButton />
                                        </CodeBlockActions>
                                    </CodeBlockHeader>
                                </CodeBlock>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="vision">
                    <Card>
                        <CardHeader>
                            <CardTitle>Vision Agent</CardTitle>
                            <CardDescription>
                                Analyzes images and extracts information.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium">Image URL</label>
                                <Input
                                    value={visionUrl}
                                    onChange={(e) => setVisionUrl(e.target.value)}
                                    placeholder="https://example.com/image.jpg"
                                />
                            </div>
                            {visionUrl && (
                                <Image
                                    src={visionUrl}
                                    alt="Preview"
                                    width={400}
                                    height={300}
                                    className="max-w-md rounded-md"
                                    unoptimized
                                />
                            )}
                            <Button onClick={handleVision} disabled={visionLoading}>
                                {visionLoading ? (
                                    <>
                                        <Loader size={16} /> Analyzing...
                                    </>
                                ) : (
                                    "Analyze Image"
                                )}
                            </Button>
                            {visionResult && (
                                <CodeBlock
                                    code={JSON.stringify(visionResult, null, 2)}
                                    language="json"
                                    className="mt-4"
                                >
                                    <CodeBlockHeader>
                                        <CodeBlockTitle>
                                            <FileJsonIcon className="size-4" />
                                            <CodeBlockFilename>analysis.json</CodeBlockFilename>
                                        </CodeBlockTitle>
                                        <CodeBlockActions>
                                            <CodeBlockCopyButton />
                                        </CodeBlockActions>
                                    </CodeBlockHeader>
                                </CodeBlock>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="research">
                    <Card>
                        <CardHeader>
                            <CardTitle>Research Agent</CardTitle>
                            <CardDescription>
                                Multi-step research with tool usage and note-taking.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Research Query
                                </label>
                                <Textarea
                                    value={researchQuery}
                                    onChange={(e) => setResearchQuery(e.target.value)}
                                    placeholder="What would you like to research?"
                                    rows={2}
                                />
                            </div>
                            <Button onClick={handleResearch} disabled={researchLoading}>
                                {researchLoading ? (
                                    <>
                                        <Loader size={16} /> Researching...
                                    </>
                                ) : (
                                    "Start Research"
                                )}
                            </Button>
                            {researchResult && (
                                <CodeBlock
                                    code={JSON.stringify(researchResult, null, 2)}
                                    language="json"
                                    className="mt-4"
                                >
                                    <CodeBlockHeader>
                                        <CodeBlockTitle>
                                            <FileJsonIcon className="size-4" />
                                            <CodeBlockFilename>research.json</CodeBlockFilename>
                                        </CodeBlockTitle>
                                        <CodeBlockActions>
                                            <CodeBlockCopyButton />
                                        </CodeBlockActions>
                                    </CodeBlockHeader>
                                </CodeBlock>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
