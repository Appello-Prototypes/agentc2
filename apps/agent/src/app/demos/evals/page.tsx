"use client";

import { useState } from "react";
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Textarea,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@repo/ui";

interface HelpfulnessScore {
    score: number;
    reasoning?: string;
}

interface CodeQualityScore {
    score: number;
    codeBlocks: number;
    hasComments: boolean;
    hasErrorHandling: boolean;
}

interface EvaluationScores {
    helpfulness?: HelpfulnessScore;
    codeQuality?: CodeQualityScore;
    error?: string;
}

// Predefined scenarios to demonstrate different evaluation outcomes
const SCENARIOS = {
    goodResponse: {
        name: "High-Quality Response",
        description: "A well-structured response with examples and actionable guidance",
        input: "How do I create a React component?",
        output: `Here's how to create a React component:

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
\`\`\``
    },
    poorResponse: {
        name: "Minimal Response",
        description: "A short, vague response without structure or examples",
        input: "What is TypeScript?",
        output: "It's a language."
    },
    noCode: {
        name: "Text-Only Response",
        description: "Helpful explanation but no code examples",
        input: "Explain the benefits of using React",
        output: `React offers several key benefits for modern web development:

1. Component-based architecture makes code reusable and maintainable
2. Virtual DOM provides efficient updates and rendering
3. Large ecosystem with extensive libraries and community support
4. Declarative syntax makes the code easier to understand
5. Strong developer tools for debugging and profiling

You can use React to build everything from simple widgets to complex single-page applications.`
    },
    codeWithComments: {
        name: "Documented Code",
        description: "Code with comments and error handling",
        input: "Show me how to fetch data in React",
        output: `Here's a complete example of data fetching with proper error handling:

\`\`\`tsx
// Custom hook for data fetching
function useFetchData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Attempt to fetch the data
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(\`HTTP error: \${response.status}\`);
        }
        
        const json = await response.json();
        setData(json);
      } catch (err) {
        // Handle any errors that occur
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [url]);

  return { data, loading, error };
}
\`\`\`

Key features of this implementation:
- Type-safe with generics
- Proper error handling with try/catch
- Loading state management
- Cleanup handled by React's useEffect`
    }
};

type ScenarioKey = keyof typeof SCENARIOS;

function getScoreColor(score: number): string {
    if (score >= 0.8) return "bg-green-500";
    if (score >= 0.6) return "bg-yellow-500";
    if (score >= 0.4) return "bg-orange-500";
    return "bg-red-500";
}

function getScoreLabel(score: number): string {
    if (score >= 0.8) return "Excellent";
    if (score >= 0.6) return "Good";
    if (score >= 0.4) return "Fair";
    return "Needs Improvement";
}

export default function EvalsDemoPage() {
    const [input, setInput] = useState(SCENARIOS.goodResponse.input);
    const [output, setOutput] = useState(SCENARIOS.goodResponse.output);
    const [scores, setScores] = useState<EvaluationScores | null>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);

    const handleEvaluate = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/demos/evals", {
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
            const res = await fetch("/api/demos/evals/generate", {
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

    const loadScenario = (scenarioKey: ScenarioKey) => {
        const scenario = SCENARIOS[scenarioKey];
        setInput(scenario.input);
        setOutput(scenario.output);
        setScores(null);
    };

    return (
        <div className="space-y-8">
            {/* Header with explanation */}
            <div>
                <h1 className="mb-2 text-3xl font-bold">Evaluations & Scorers</h1>
                <p className="text-muted-foreground mb-4 max-w-3xl">
                    Evaluations (evals) are automated quality checks that score AI responses. They
                    help you measure and improve agent performance by providing objective metrics on
                    helpfulness, code quality, relevancy, and more.
                </p>
            </div>

            {/* Why Evals Matter */}
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <CardTitle className="text-lg">
                        Why Evaluations Matter for Building Better Agents
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <h4 className="font-semibold">Measure Quality</h4>
                            <p className="text-muted-foreground text-sm">
                                Objectively score responses to identify which prompts, models, or
                                configurations produce the best results.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-semibold">Catch Regressions</h4>
                            <p className="text-muted-foreground text-sm">
                                Run evals in CI/CD to ensure prompt changes or model updates
                                don&apos;t degrade response quality.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-semibold">Iterate Faster</h4>
                            <p className="text-muted-foreground text-sm">
                                Compare different approaches with data instead of manual review.
                                Scale testing across hundreds of examples.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="playground" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="playground">Interactive Playground</TabsTrigger>
                    <TabsTrigger value="scenarios">Test Scenarios</TabsTrigger>
                    <TabsTrigger value="how-it-works">How It Works</TabsTrigger>
                </TabsList>

                {/* Interactive Playground */}
                <TabsContent value="playground" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Input Query</CardTitle>
                                    <CardDescription>
                                        The user&apos;s question or prompt that the agent responded
                                        to.
                                    </CardDescription>
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
                                        The agent&apos;s response to evaluate. Try editing it to see
                                        how scores change.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <Textarea
                                        value={output}
                                        onChange={(e) => setOutput(e.target.value)}
                                        rows={12}
                                        placeholder="Enter or generate the response..."
                                        className="font-mono text-sm"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        <Button onClick={handleGenerate} disabled={generating}>
                                            {generating ? "Generating..." : "Generate with AI"}
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            onClick={handleEvaluate}
                                            disabled={loading}
                                        >
                                            {loading ? "Evaluating..." : "Evaluate Response"}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Evaluation Results</CardTitle>
                                    <CardDescription>
                                        Scores from the helpfulness and code quality scorers.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {scores ? (
                                        <div className="space-y-6">
                                            {scores.error && (
                                                <div className="bg-destructive/10 text-destructive rounded-md p-4">
                                                    {scores.error}
                                                </div>
                                            )}

                                            {scores.helpfulness && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <span className="font-medium">
                                                                Helpfulness
                                                            </span>
                                                            <span
                                                                className={`ml-2 rounded px-2 py-0.5 text-xs text-white ${getScoreColor(scores.helpfulness.score)}`}
                                                            >
                                                                {getScoreLabel(
                                                                    scores.helpfulness.score
                                                                )}
                                                            </span>
                                                        </div>
                                                        <span className="text-2xl font-bold">
                                                            {Math.round(
                                                                scores.helpfulness.score * 100
                                                            )}
                                                            %
                                                        </span>
                                                    </div>
                                                    <div className="bg-muted h-3 w-full overflow-hidden rounded-full">
                                                        <div
                                                            className={`h-3 rounded-full transition-all duration-500 ${getScoreColor(scores.helpfulness.score)}`}
                                                            style={{
                                                                width: `${scores.helpfulness.score * 100}%`
                                                            }}
                                                        />
                                                    </div>
                                                    {scores.helpfulness.reasoning && (
                                                        <p className="text-muted-foreground text-sm">
                                                            {scores.helpfulness.reasoning}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {scores.codeQuality && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <span className="font-medium">
                                                                Code Quality
                                                            </span>
                                                            <span
                                                                className={`ml-2 rounded px-2 py-0.5 text-xs text-white ${getScoreColor(scores.codeQuality.score)}`}
                                                            >
                                                                {getScoreLabel(
                                                                    scores.codeQuality.score
                                                                )}
                                                            </span>
                                                        </div>
                                                        <span className="text-2xl font-bold">
                                                            {Math.round(
                                                                scores.codeQuality.score * 100
                                                            )}
                                                            %
                                                        </span>
                                                    </div>
                                                    <div className="bg-muted h-3 w-full overflow-hidden rounded-full">
                                                        <div
                                                            className={`h-3 rounded-full transition-all duration-500 ${getScoreColor(scores.codeQuality.score)}`}
                                                            style={{
                                                                width: `${scores.codeQuality.score * 100}%`
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="text-muted-foreground grid grid-cols-2 gap-2 text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className={
                                                                    scores.codeQuality.codeBlocks >
                                                                    0
                                                                        ? "text-green-500"
                                                                        : "text-muted-foreground"
                                                                }
                                                            >
                                                                {scores.codeQuality.codeBlocks > 0
                                                                    ? "✓"
                                                                    : "○"}
                                                            </span>
                                                            Code blocks:{" "}
                                                            {scores.codeQuality.codeBlocks}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className={
                                                                    scores.codeQuality.hasComments
                                                                        ? "text-green-500"
                                                                        : "text-muted-foreground"
                                                                }
                                                            >
                                                                {scores.codeQuality.hasComments
                                                                    ? "✓"
                                                                    : "○"}
                                                            </span>
                                                            Has comments
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className={
                                                                    scores.codeQuality
                                                                        .hasErrorHandling
                                                                        ? "text-green-500"
                                                                        : "text-muted-foreground"
                                                                }
                                                            >
                                                                {scores.codeQuality.hasErrorHandling
                                                                    ? "✓"
                                                                    : "○"}
                                                            </span>
                                                            Error handling
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground py-8 text-center">
                                            <p className="mb-2">No evaluation results yet</p>
                                            <p className="text-sm">
                                                Click &quot;Evaluate Response&quot; to score the
                                                current output, or &quot;Generate with AI&quot; to
                                                create and evaluate a new response.
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {scores && !scores.error && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Raw Score Data</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <pre className="bg-muted max-h-48 overflow-auto rounded-md p-4 text-xs">
                                            {JSON.stringify(scores, null, 2)}
                                        </pre>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* Test Scenarios */}
                <TabsContent value="scenarios" className="space-y-6">
                    <p className="text-muted-foreground">
                        Try these predefined scenarios to see how different response styles affect
                        evaluation scores. Click a scenario to load it, then evaluate.
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                        {(
                            Object.entries(SCENARIOS) as [
                                ScenarioKey,
                                (typeof SCENARIOS)[ScenarioKey]
                            ][]
                        ).map(([key, scenario]) => (
                            <Card
                                key={key}
                                className="hover:border-primary cursor-pointer transition-colors"
                                onClick={() => loadScenario(key)}
                            >
                                <CardHeader>
                                    <CardTitle className="text-base">{scenario.name}</CardTitle>
                                    <CardDescription>{scenario.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <div>
                                            <span className="text-muted-foreground text-xs font-medium uppercase">
                                                Query:
                                            </span>
                                            <p className="text-sm">{scenario.input}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground text-xs font-medium uppercase">
                                                Response Preview:
                                            </span>
                                            <p className="text-muted-foreground line-clamp-2 text-sm">
                                                {scenario.output.slice(0, 100)}...
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-4"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            loadScenario(key);
                                        }}
                                    >
                                        Load Scenario
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card className="border-dashed">
                        <CardContent className="py-6">
                            <p className="text-muted-foreground text-center text-sm">
                                After loading a scenario, switch to the &quot;Interactive
                                Playground&quot; tab and click &quot;Evaluate Response&quot; to see
                                the scores.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* How It Works */}
                <TabsContent value="how-it-works" className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Active Scorers</CardTitle>
                                <CardDescription>
                                    These scorers analyze the response and return metrics.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="border-l-4 border-blue-500 pl-4">
                                    <h4 className="font-semibold">Helpfulness Scorer</h4>
                                    <p className="text-muted-foreground text-sm">
                                        Evaluates how helpful and actionable the response is. Checks
                                        for action words, examples, structure, and detail.
                                    </p>
                                    <div className="text-muted-foreground mt-2 text-xs">
                                        <strong>Scoring criteria:</strong>
                                        <ul className="mt-1 list-inside list-disc">
                                            <li>+20% for actionable guidance</li>
                                            <li>+15% for examples or code</li>
                                            <li>+10% for structured formatting</li>
                                            <li>+5% for sufficient detail (200+ chars)</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="border-l-4 border-purple-500 pl-4">
                                    <h4 className="font-semibold">Code Quality Scorer</h4>
                                    <p className="text-muted-foreground text-sm">
                                        Analyzes code blocks in responses for quality signals. Only
                                        scores if code is present.
                                    </p>
                                    <div className="text-muted-foreground mt-2 text-xs">
                                        <strong>Scoring criteria:</strong>
                                        <ul className="mt-1 list-inside list-disc">
                                            <li>Base 50% if code is present</li>
                                            <li>+20% for comments</li>
                                            <li>+20% for error handling</li>
                                            <li>+10% for multiple code blocks</li>
                                        </ul>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Using Evals to Improve Agents</CardTitle>
                                <CardDescription>
                                    Practical strategies for leveraging evaluations.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">1. Prompt Engineering</h4>
                                    <p className="text-muted-foreground text-sm">
                                        Compare eval scores across different system prompts.
                                        &quot;Always include examples&quot; in the prompt? Check if
                                        helpfulness scores actually improve.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">2. Model Selection</h4>
                                    <p className="text-muted-foreground text-sm">
                                        Run the same test set against different models (GPT-4,
                                        Claude, etc.) and compare aggregate scores to pick the best
                                        fit.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">3. Regression Testing</h4>
                                    <p className="text-muted-foreground text-sm">
                                        Create a test suite of input/output pairs with expected
                                        minimum scores. Run in CI to catch quality regressions.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">
                                        4. Production Monitoring
                                    </h4>
                                    <p className="text-muted-foreground text-sm">
                                        Sample and score real production responses. Track score
                                        distributions over time to detect drift.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle>Available Scorer Types</CardTitle>
                                <CardDescription>
                                    Mastra supports both built-in and custom scorers for different
                                    use cases.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h5 className="mb-1 font-medium">Answer Relevancy</h5>
                                        <p className="text-muted-foreground text-xs">
                                            How well the response addresses the input query
                                        </p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h5 className="mb-1 font-medium">Toxicity</h5>
                                        <p className="text-muted-foreground text-xs">
                                            Detects harmful, offensive, or inappropriate content
                                        </p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h5 className="mb-1 font-medium">Completeness</h5>
                                        <p className="text-muted-foreground text-xs">
                                            Checks if all necessary information is included
                                        </p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h5 className="mb-1 font-medium">Faithfulness</h5>
                                        <p className="text-muted-foreground text-xs">
                                            Accuracy to provided context (for RAG systems)
                                        </p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h5 className="mb-1 font-medium">Hallucination</h5>
                                        <p className="text-muted-foreground text-xs">
                                            Detects unsupported or fabricated claims
                                        </p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h5 className="mb-1 font-medium">Tone Consistency</h5>
                                        <p className="text-muted-foreground text-xs">
                                            Measures consistency in formality and style
                                        </p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h5 className="mb-1 font-medium">Content Similarity</h5>
                                        <p className="text-muted-foreground text-xs">
                                            Compares output to a reference response
                                        </p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h5 className="mb-1 font-medium">Custom Scorers</h5>
                                        <p className="text-muted-foreground text-xs">
                                            Build domain-specific metrics for your use case
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
