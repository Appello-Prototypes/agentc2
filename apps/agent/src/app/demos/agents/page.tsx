"use client";

import { useState } from "react";
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
    Input
} from "@repo/ui";

export default function AgentsDemoPage() {
    const [structuredInput, setStructuredInput] = useState("Break down the task: Build a website");
    const [structuredSchema, setStructuredSchema] = useState("taskBreakdown");
    const [structuredResult, setStructuredResult] = useState<Record<string, unknown> | null>(null);
    const [structuredLoading, setStructuredLoading] = useState(false);

    const [visionUrl, setVisionUrl] = useState("https://placebear.com/cache/395-205.jpg");
    const [visionResult, setVisionResult] = useState<Record<string, unknown> | null>(null);
    const [visionLoading, setVisionLoading] = useState(false);

    const [researchQuery, setResearchQuery] = useState("What are the benefits of TypeScript?");
    const [researchResult, setResearchResult] = useState<Record<string, unknown> | null>(null);
    const [researchLoading, setResearchLoading] = useState(false);

    const handleStructured = async () => {
        setStructuredLoading(true);
        try {
            const res = await fetch("/agent/api/demos/agents/structured", {
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
            const res = await fetch("/agent/api/demos/agents/vision", {
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

    const handleResearch = async () => {
        setResearchLoading(true);
        try {
            const res = await fetch("/agent/api/demos/agents/research", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: researchQuery, maxSteps: 5 })
            });
            const data = await res.json();
            setResearchResult(data);
        } catch {
            setResearchResult({ error: "Failed to perform research" });
        }
        setResearchLoading(false);
    };

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
                                {structuredLoading ? "Generating..." : "Generate"}
                            </Button>
                            {structuredResult && (
                                <pre className="bg-muted mt-4 overflow-auto rounded-md p-4 text-sm">
                                    {JSON.stringify(structuredResult, null, 2)}
                                </pre>
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
                                {visionLoading ? "Analyzing..." : "Analyze Image"}
                            </Button>
                            {visionResult && (
                                <pre className="bg-muted mt-4 overflow-auto rounded-md p-4 text-sm">
                                    {JSON.stringify(visionResult, null, 2)}
                                </pre>
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
                                {researchLoading ? "Researching..." : "Start Research"}
                            </Button>
                            {researchResult && (
                                <pre className="bg-muted mt-4 overflow-auto rounded-md p-4 text-sm">
                                    {JSON.stringify(researchResult, null, 2)}
                                </pre>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
