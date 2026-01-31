"use client";

import { useState } from "react";
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Textarea
} from "@repo/ui";

export default function EvalsDemoPage() {
    const [input, setInput] = useState("How do I create a React component?");
    const [output, setOutput] = useState(`Here's how to create a React component:

## Functional Component

\`\`\`tsx
function MyComponent() {
  return <div>Hello World</div>;
}
\`\`\`

1. Create a function that returns JSX
2. Export the component
3. Import and use it in your app

For example, you can use it like this:
\`\`\`tsx
<MyComponent />
\`\`\``);

    const [scores, setScores] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);

    const handleEvaluate = async () => {
        setLoading(true);
        try {
            const res = await fetch("/agent/api/demos/evals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ input, output })
            });
            const data = await res.json();
            setScores(data);
        } catch {
            setScores({ error: "Failed to evaluate" });
        }
        setLoading(false);
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const res = await fetch("/agent/api/demos/evals/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ input })
            });
            const data = await res.json();
            if (data.output) {
                setOutput(data.output);
            }
            if (data.scores) {
                setScores(data.scores);
            }
        } catch {
            setScores({ error: "Failed to generate" });
        }
        setGenerating(false);
    };

    return (
        <div>
            <h1 className="mb-2 text-3xl font-bold">Evaluations Demo</h1>
            <p className="text-muted-foreground mb-8">
                Score agent responses for relevancy, toxicity, and helpfulness.
            </p>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Input Query</CardTitle>
                            <CardDescription>The user&apos;s question or prompt.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                rows={3}
                                placeholder="Enter the input query..."
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Output Response</CardTitle>
                            <CardDescription>
                                The agent&apos;s response to evaluate.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                value={output}
                                onChange={(e) => setOutput(e.target.value)}
                                rows={10}
                                placeholder="Enter or generate the response..."
                            />
                            <div className="flex gap-2">
                                <Button onClick={handleGenerate} disabled={generating}>
                                    {generating ? "Generating..." : "Generate Response"}
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={handleEvaluate}
                                    disabled={loading}
                                >
                                    {loading ? "Evaluating..." : "Evaluate Only"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Evaluation Scores</CardTitle>
                        <CardDescription>Scores from various evaluation metrics.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {scores ? (
                            <div className="space-y-4">
                                {scores.helpfulness && (
                                    <div className="bg-muted rounded-md p-4">
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="font-medium">Helpfulness</span>
                                            <span className="text-lg font-bold">
                                                {Math.round(scores.helpfulness.score * 100)}%
                                            </span>
                                        </div>
                                        <div className="bg-background h-2 w-full rounded-full">
                                            <div
                                                className="bg-primary h-2 rounded-full"
                                                style={{
                                                    width: `${scores.helpfulness.score * 100}%`
                                                }}
                                            />
                                        </div>
                                        {scores.helpfulness.reasoning && (
                                            <p className="text-muted-foreground mt-2 text-sm">
                                                {scores.helpfulness.reasoning}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {scores.codeQuality && (
                                    <div className="bg-muted rounded-md p-4">
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="font-medium">Code Quality</span>
                                            <span className="text-lg font-bold">
                                                {Math.round(scores.codeQuality.score * 100)}%
                                            </span>
                                        </div>
                                        <div className="bg-background h-2 w-full rounded-full">
                                            <div
                                                className="bg-primary h-2 rounded-full"
                                                style={{
                                                    width: `${scores.codeQuality.score * 100}%`
                                                }}
                                            />
                                        </div>
                                        <p className="text-muted-foreground mt-2 text-sm">
                                            Code blocks: {scores.codeQuality.codeBlocks}, Has
                                            comments:{" "}
                                            {scores.codeQuality.hasComments ? "Yes" : "No"}
                                        </p>
                                    </div>
                                )}
                                <pre className="bg-muted max-h-64 overflow-auto rounded-md p-4 text-sm">
                                    {JSON.stringify(scores, null, 2)}
                                </pre>
                            </div>
                        ) : (
                            <p className="text-muted-foreground">
                                Generate or evaluate a response to see scores.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
