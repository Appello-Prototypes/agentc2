import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";

const demos = [
    {
        title: "Agent Network",
        description:
            "Multi-agent trip planner with routing, parallel workflows, memory, and human approval",
        href: "/demos/agent-network",
        features: ["Multi-Agent", "Parallel Workflows", "Memory", "Human Approval"],
        status: "ready" as const
    },
    {
        title: "Mission Control",
        description: "Submit goals and let AI agents work autonomously in the background",
        href: "/demos/mission-control",
        features: ["Background Execution", "Goal Tracking", "Auto-Scoring"],
        status: "ready" as const
    },
    {
        title: "Chat",
        description: "Conversational AI assistant with tool use and memory",
        href: "/chat",
        features: ["Conversation", "Tool Use", "Memory"],
        status: "ready" as const
    },
    {
        title: "Agents",
        description: "Explore structured output, vision analysis, and multi-step research agents",
        href: "/demos/agents",
        features: ["Structured Output", "Image Analysis", "Multi-step Reasoning"],
        status: "ready" as const
    },
    {
        title: "Workflows",
        description: "See parallel processing, conditional branching, loops, and human-in-the-loop",
        href: "/demos/workflows",
        features: ["Parallel", "Branch", "Foreach", "Suspend/Resume"],
        status: "ready" as const
    },
    {
        title: "Memory",
        description: "Test message history, working memory, and semantic recall",
        href: "/demos/memory",
        features: ["Message History", "Working Memory", "Semantic Recall"],
        status: "ready" as const
    },
    {
        title: "RAG",
        description: "Ingest documents, search vectors, and generate context-aware responses",
        href: "/demos/rag",
        features: ["Document Ingestion", "Vector Search", "Context Generation"],
        status: "ready" as const
    },
    {
        title: "Evaluations",
        description: "Score agent responses for relevancy, toxicity, and helpfulness",
        href: "/demos/evals",
        features: ["Relevancy", "Toxicity", "Custom Scorers"],
        status: "ready" as const
    },
    {
        title: "MCP",
        description: "Use external tools via Model Context Protocol servers",
        href: "/demos/mcp",
        features: ["Wikipedia", "Sequential Thinking", "External APIs"],
        status: "ready" as const
    },
    {
        title: "Voice",
        description: "Text-to-Speech, Speech-to-Text, and voice conversations",
        href: "/demos/voice",
        features: ["TTS", "STT", "Voice Chat", "Multi-Provider"],
        status: "ready" as const
    },
    {
        title: "Live Agent (MCP)",
        description:
            "Real-time voice agent with access to MCP tools for CRM, projects, and web browsing",
        href: "/demos/live-agent-mcp",
        features: ["Real-time Voice", "MCP Tools", "ElevenLabs"],
        status: "ready" as const
    },
    {
        title: "Observability",
        description: "Full tracing dashboard for model, tools, reasoning, and execution steps",
        href: "/demos/observability",
        features: ["Traces", "Tool Calls", "Eval Scores", "Debugging"],
        status: "ready" as const
    }
];

export default function DemosPage() {
    return (
        <div>
            <div className="mb-12 text-center">
                <h1 className="mb-4 text-4xl font-bold">Mastra Playground</h1>
                <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                    Explore all the capabilities of the Mastra AI framework through interactive
                    demonstrations of each primitive.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {demos.map((demo) => (
                    <Link key={demo.href} href={demo.href}>
                        <Card className="h-full cursor-pointer transition-shadow hover:shadow-lg">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>{demo.title}</CardTitle>
                                    <span
                                        className={`rounded px-2 py-1 text-xs ${
                                            demo.status === "ready"
                                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                                        }`}
                                    >
                                        {demo.status}
                                    </span>
                                </div>
                                <CardDescription>{demo.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {demo.features.map((feature) => (
                                        <span
                                            key={feature}
                                            className="bg-primary/10 text-primary rounded px-2 py-1 text-xs"
                                        >
                                            {feature}
                                        </span>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
