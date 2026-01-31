# Phase 9: Create Demo UI Pages

**Status**: Pending  
**Dependencies**: All previous phases (1-8)  
**Estimated Complexity**: High

## Objective

Create dedicated demo pages in the agent app to showcase all Mastra primitives:
1. `/demos` - Landing page with links to all demos
2. `/demos/agents` - Agent capabilities (structured output, vision, research)
3. `/demos/workflows` - Workflow patterns (parallel, branch, loop, HITL)
4. `/demos/memory` - Memory features (message history, working memory, semantic recall)
5. `/demos/rag` - RAG pipeline (ingest, query, generate)
6. `/demos/evals` - Evaluation and scoring
7. `/demos/mcp` - MCP server integration

## Implementation Steps

### Step 1: Create Demos Layout

Create `apps/agent/src/app/demos/layout.tsx`:

```tsx
import { AgentHeader } from "@/components/AgentHeader";

export default function DemosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AgentHeader />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {children}
      </main>
    </div>
  );
}
```

### Step 2: Create Demos Landing Page

Create `apps/agent/src/app/demos/page.tsx`:

```tsx
import Link from "next/link";

const demos = [
  {
    title: "Agents",
    description: "Explore structured output, vision analysis, and multi-step research agents",
    href: "/demos/agents",
    icon: "🤖",
    features: ["Structured Output", "Image Analysis", "Multi-step Reasoning"],
  },
  {
    title: "Workflows",
    description: "See parallel processing, conditional branching, loops, and human-in-the-loop",
    href: "/demos/workflows",
    icon: "🔄",
    features: ["Parallel", "Branch", "Foreach", "Suspend/Resume"],
  },
  {
    title: "Memory",
    description: "Test message history, working memory, and semantic recall",
    href: "/demos/memory",
    icon: "🧠",
    features: ["Message History", "Working Memory", "Semantic Recall"],
  },
  {
    title: "RAG",
    description: "Ingest documents, search vectors, and generate context-aware responses",
    href: "/demos/rag",
    icon: "📚",
    features: ["Document Ingestion", "Vector Search", "Context Generation"],
  },
  {
    title: "Evaluations",
    description: "Score agent responses for relevancy, toxicity, and helpfulness",
    href: "/demos/evals",
    icon: "📊",
    features: ["Relevancy", "Toxicity", "Custom Scorers"],
  },
  {
    title: "MCP",
    description: "Use external tools via Model Context Protocol servers",
    href: "/demos/mcp",
    icon: "🔌",
    features: ["Wikipedia", "Sequential Thinking", "External APIs"],
  },
];

export default function DemosPage() {
  return (
    <div>
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Mastra Primitives Demo
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Explore all the capabilities of the Mastra AI framework through
          interactive demonstrations of each primitive.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {demos.map((demo) => (
          <Link
            key={demo.href}
            href={demo.href}
            className="block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
          >
            <div className="text-4xl mb-4">{demo.icon}</div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {demo.title}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {demo.description}
            </p>
            <div className="flex flex-wrap gap-2">
              {demo.features.map((feature) => (
                <span
                  key={feature}
                  className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                >
                  {feature}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

### Step 3: Create Agents Demo Page

Create `apps/agent/src/app/demos/agents/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";

type AgentType = "structured" | "vision" | "research";

export default function AgentsDemoPage() {
  const [agentType, setAgentType] = useState<AgentType>("structured");
  const [structuredInput, setStructuredInput] = useState("");
  const [structuredOutput, setStructuredOutput] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleStructuredSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/demos/agents/structured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: structuredInput,
          schemaType: "taskBreakdown",
        }),
      });
      const data = await response.json();
      setStructuredOutput(data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Agents Demo</h1>

      {/* Agent Type Selector */}
      <div className="flex gap-4 mb-8">
        {(["structured", "vision", "research"] as AgentType[]).map((type) => (
          <button
            key={type}
            onClick={() => setAgentType(type)}
            className={`px-4 py-2 rounded-lg capitalize ${
              agentType === type
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Structured Output Demo */}
      {agentType === "structured" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Structured Output Agent</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Returns typed JSON objects instead of plain text. Try asking it to
            break down a task.
          </p>

          <div className="space-y-4">
            <textarea
              value={structuredInput}
              onChange={(e) => setStructuredInput(e.target.value)}
              placeholder="E.g., Break down the task: Build a website"
              className="w-full p-3 border rounded-lg dark:bg-gray-700"
              rows={3}
            />

            <button
              onClick={handleStructuredSubmit}
              disabled={loading || !structuredInput}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? "Processing..." : "Generate Structured Output"}
            </button>

            {structuredOutput && (
              <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
                <h3 className="font-semibold mb-2">Result:</h3>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(structuredOutput, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vision Demo */}
      {agentType === "vision" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Vision Agent</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Analyzes images and extracts information.
          </p>
          {/* Vision agent implementation */}
          <p className="text-gray-500 italic">
            Paste an image URL and ask questions about it.
          </p>
        </div>
      )}

      {/* Research Demo */}
      {agentType === "research" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Research Agent</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Multi-step reasoning with tools. Watch the agent think step by step.
          </p>
          {/* Research agent implementation */}
          <p className="text-gray-500 italic">
            Ask a research question and see the agent use multiple tools.
          </p>
        </div>
      )}
    </div>
  );
}
```

### Step 4: Create Workflows Demo Page

Create `apps/agent/src/app/demos/workflows/page.tsx`:

```tsx
"use client";

import { useState } from "react";

type WorkflowType = "parallel" | "branch" | "foreach" | "approval";

export default function WorkflowsDemoPage() {
  const [workflowType, setWorkflowType] = useState<WorkflowType>("parallel");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [suspended, setSuspended] = useState(false);

  const runWorkflow = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/demos/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowType, input }),
      });
      const data = await response.json();
      setResult(data);
      setSuspended(data.status === "suspended");
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const resumeWorkflow = async (approved: boolean) => {
    setLoading(true);
    try {
      const response = await fetch("/api/demos/workflows/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: result.runId,
          step: "human-approval",
          resumeData: { approved, approvedBy: "Demo User" },
        }),
      });
      const data = await response.json();
      setResult(data);
      setSuspended(false);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Workflows Demo</h1>

      {/* Workflow Type Selector */}
      <div className="flex flex-wrap gap-4 mb-8">
        {(["parallel", "branch", "foreach", "approval"] as WorkflowType[]).map(
          (type) => (
            <button
              key={type}
              onClick={() => {
                setWorkflowType(type);
                setResult(null);
                setSuspended(false);
              }}
              className={`px-4 py-2 rounded-lg capitalize ${
                workflowType === type
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              {type === "approval" ? "Human-in-the-Loop" : type}
            </button>
          )
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
        {/* Parallel Workflow */}
        {workflowType === "parallel" && (
          <>
            <h2 className="text-xl font-semibold mb-4">Parallel Processing</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Runs multiple operations simultaneously: format, analyze, and
              detect language.
            </p>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter text to process in parallel"
              className="w-full p-3 border rounded-lg dark:bg-gray-700 mb-4"
            />
          </>
        )}

        {/* Branch Workflow */}
        {workflowType === "branch" && (
          <>
            <h2 className="text-xl font-semibold mb-4">Conditional Branching</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Routes to different handlers based on input classification
              (question, command, statement).
            </p>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter a question, command, or statement"
              className="w-full p-3 border rounded-lg dark:bg-gray-700 mb-4"
            />
          </>
        )}

        {/* Foreach Workflow */}
        {workflowType === "foreach" && (
          <>
            <h2 className="text-xl font-semibold mb-4">Foreach Loop</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Processes each item in an array with concurrent execution.
            </p>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter comma-separated items: apple, banana, cherry"
              className="w-full p-3 border rounded-lg dark:bg-gray-700 mb-4"
            />
          </>
        )}

        {/* Human Approval Workflow */}
        {workflowType === "approval" && (
          <>
            <h2 className="text-xl font-semibold mb-4">Human-in-the-Loop</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Workflow pauses for human approval before executing an action.
            </p>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter a message to send (requires approval)"
              className="w-full p-3 border rounded-lg dark:bg-gray-700 mb-4"
            />
          </>
        )}

        <button
          onClick={runWorkflow}
          disabled={loading || !input}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          {loading ? "Running..." : "Run Workflow"}
        </button>

        {/* Suspended State UI */}
        {suspended && result?.suspendPayload && (
          <div className="mt-6 p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
            <h3 className="font-semibold mb-2">Workflow Suspended</h3>
            <p className="mb-4">{result.suspendPayload.reason}</p>
            <div className="flex gap-4">
              <button
                onClick={() => resumeWorkflow(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg"
              >
                Approve
              </button>
              <button
                onClick={() => resumeWorkflow(false)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {/* Result Display */}
        {result && !suspended && (
          <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
            <h3 className="font-semibold mb-2">Result:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 5: Create Memory Demo Page

Create `apps/agent/src/app/demos/memory/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";

export default function MemoryDemoPage() {
  const [threadId] = useState(`demo-thread-${Date.now()}`);
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    body: {
      threadId,
    },
  });

  const [workingMemory, setWorkingMemory] = useState<string | null>(null);
  const [semanticResults, setSemanticResults] = useState<any[]>([]);

  const fetchWorkingMemory = async () => {
    const response = await fetch(`/api/demos/memory/working?threadId=${threadId}`);
    const data = await response.json();
    setWorkingMemory(data.workingMemory);
  };

  const testSemanticRecall = async (query: string) => {
    const response = await fetch("/api/demos/memory/semantic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, threadId }),
    });
    const data = await response.json();
    setSemanticResults(data.results || []);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Memory Demo</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chat with Memory */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Chat with Memory</h2>
          <p className="text-sm text-gray-500 mb-4">
            Thread ID: {threadId}
          </p>

          <div className="h-64 overflow-y-auto border rounded-lg p-4 mb-4 dark:bg-gray-900">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`mb-2 ${m.role === "user" ? "text-blue-600" : ""}`}
              >
                <span className="font-semibold capitalize">{m.role}:</span>{" "}
                {m.content}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Chat to build memory..."
              className="flex-1 p-2 border rounded dark:bg-gray-700"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Send
            </button>
          </form>
        </div>

        {/* Working Memory */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Working Memory</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Persistent structured data stored about the user.
          </p>

          <button
            onClick={fetchWorkingMemory}
            className="px-4 py-2 bg-green-600 text-white rounded mb-4"
          >
            Fetch Working Memory
          </button>

          {workingMemory && (
            <pre className="p-4 bg-gray-100 dark:bg-gray-900 rounded text-sm overflow-auto">
              {workingMemory}
            </pre>
          )}
        </div>

        {/* Semantic Recall */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Semantic Recall</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Search past conversations by meaning, not exact keywords.
          </p>

          <div className="flex gap-2 mb-4">
            <input
              placeholder="Search for a concept..."
              className="flex-1 p-2 border rounded dark:bg-gray-700"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  testSemanticRecall((e.target as HTMLInputElement).value);
                }
              }}
            />
            <button
              onClick={(e) => {
                const input = (e.target as HTMLElement)
                  .previousSibling as HTMLInputElement;
                testSemanticRecall(input.value);
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded"
            >
              Search
            </button>
          </div>

          {semanticResults.length > 0 && (
            <div className="space-y-2">
              {semanticResults.map((result, i) => (
                <div
                  key={i}
                  className="p-3 bg-gray-100 dark:bg-gray-900 rounded"
                >
                  <div className="text-sm text-gray-500">
                    Score: {result.score?.toFixed(3)}
                  </div>
                  <div>{result.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Step 6: Create RAG Demo Page

Create `apps/agent/src/app/demos/rag/page.tsx`:

```tsx
"use client";

import { useState } from "react";

export default function RagDemoPage() {
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState("text");
  const [ingestResult, setIngestResult] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleIngest = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/rag/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          type: contentType,
          sourceName: `Demo Document ${Date.now()}`,
        }),
      });
      const data = await response.json();
      setIngestResult(data);
    } catch (error) {
      console.error("Ingest error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = async (generateResponse = false) => {
    setLoading(true);
    try {
      const response = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, generateResponse }),
      });
      const data = await response.json();
      setQueryResult(data);
    } catch (error) {
      console.error("Query error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">RAG Demo</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ingest Document */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">1. Ingest Document</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Add content to the vector database for retrieval.
          </p>

          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
            className="w-full p-2 border rounded mb-4 dark:bg-gray-700"
          >
            <option value="text">Plain Text</option>
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
            <option value="json">JSON</option>
          </select>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your document content here..."
            className="w-full p-3 border rounded-lg dark:bg-gray-700 mb-4"
            rows={8}
          />

          <button
            onClick={handleIngest}
            disabled={loading || !content}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? "Ingesting..." : "Ingest Document"}
          </button>

          {ingestResult && (
            <div className="mt-4 p-4 bg-green-100 dark:bg-green-900 rounded">
              <p>Ingested {ingestResult.chunksIngested} chunks</p>
              <p className="text-sm text-gray-600">ID: {ingestResult.documentId}</p>
            </div>
          )}
        </div>

        {/* Query RAG */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">2. Query Documents</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Search ingested documents by meaning.
          </p>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about your documents..."
            className="w-full p-3 border rounded-lg dark:bg-gray-700 mb-4"
          />

          <div className="flex gap-4">
            <button
              onClick={() => handleQuery(false)}
              disabled={loading || !query}
              className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
            >
              Search Only
            </button>
            <button
              onClick={() => handleQuery(true)}
              disabled={loading || !query}
              className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
            >
              Search & Generate
            </button>
          </div>

          {queryResult && (
            <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-900 rounded">
              {queryResult.response && (
                <div className="mb-4">
                  <h4 className="font-semibold">Generated Response:</h4>
                  <p>{queryResult.response}</p>
                </div>
              )}

              {(queryResult.results || queryResult.sources) && (
                <div>
                  <h4 className="font-semibold mb-2">Sources:</h4>
                  {(queryResult.results || queryResult.sources).map(
                    (r: any, i: number) => (
                      <div
                        key={i}
                        className="p-2 bg-white dark:bg-gray-800 rounded mb-2"
                      >
                        <div className="text-sm text-gray-500">
                          Score: {r.score?.toFixed(3)}
                        </div>
                        <div className="text-sm">{r.text}</div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Step 7: Create Evals Demo Page

Create `apps/agent/src/app/demos/evals/page.tsx`:

```tsx
"use client";

import { useState } from "react";

export default function EvalsDemoPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [scores, setScores] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runEvaluation = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/demos/evals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, output }),
      });
      const data = await response.json();
      setScores(data.scores);
    } catch (error) {
      console.error("Eval error:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateAndEvaluate = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/demos/evals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await response.json();
      setOutput(data.output);
      setScores(data.scores);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Evaluations Demo</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Input (Query)</h2>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter a question or prompt..."
            className="w-full p-3 border rounded-lg dark:bg-gray-700"
            rows={4}
          />
        </div>

        {/* Output */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Output (Response)</h2>
          <textarea
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            placeholder="Enter a response to evaluate (or generate one)..."
            className="w-full p-3 border rounded-lg dark:bg-gray-700"
            rows={4}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 my-6">
        <button
          onClick={generateAndEvaluate}
          disabled={loading || !input}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          {loading ? "Processing..." : "Generate & Evaluate"}
        </button>
        <button
          onClick={runEvaluation}
          disabled={loading || !input || !output}
          className="px-6 py-3 bg-green-600 text-white rounded-lg disabled:opacity-50"
        >
          Evaluate Only
        </button>
      </div>

      {/* Scores */}
      {scores && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Evaluation Scores</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(scores).map(([name, score]: [string, any]) => (
              <div
                key={name}
                className="p-4 bg-gray-100 dark:bg-gray-900 rounded-lg text-center"
              >
                <div className="text-2xl font-bold">
                  {typeof score === "number"
                    ? (score * 100).toFixed(0) + "%"
                    : score.score
                    ? (score.score * 100).toFixed(0) + "%"
                    : "N/A"}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {name}
                </div>
                {score.reasoning && (
                  <div className="text-xs text-gray-500 mt-2">
                    {score.reasoning}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 8: Create MCP Demo Page

Create `apps/agent/src/app/demos/mcp/page.tsx`:

```tsx
"use client";

import { useState } from "react";

export default function McpDemoPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runMcpQuery = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query }),
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("MCP error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">MCP Demo</h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">External Tools via MCP</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          This agent has access to external tools via the Model Context Protocol:
        </p>
        <ul className="list-disc list-inside mb-4 text-gray-600 dark:text-gray-300">
          <li><strong>Wikipedia</strong> - Search and retrieve encyclopedia articles</li>
          <li><strong>Sequential Thinking</strong> - Break down complex reasoning</li>
        </ul>

        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask something that requires external knowledge, e.g., 'What is the history of artificial intelligence?'"
          className="w-full p-3 border rounded-lg dark:bg-gray-700 mb-4"
          rows={3}
        />

        <button
          onClick={runMcpQuery}
          disabled={loading || !query}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {loading ? "Searching..." : "Query with MCP Tools"}
        </button>
      </div>

      {result && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
          <h3 className="font-semibold mb-4">Response:</h3>
          <div className="prose dark:prose-invert max-w-none">
            <p>{result.text}</p>
          </div>

          {result.toolCalls && result.toolCalls.length > 0 && (
            <div className="mt-4 pt-4 border-t dark:border-gray-700">
              <h4 className="font-semibold mb-2">Tools Used:</h4>
              <div className="space-y-2">
                {result.toolCalls.map((tool: any, i: number) => (
                  <div
                    key={i}
                    className="p-2 bg-gray-100 dark:bg-gray-900 rounded"
                  >
                    <span className="font-mono text-sm">{tool.toolName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Step 9: Update Navigation

Update `apps/agent/src/components/AgentHeader.tsx` to include demos link:

```tsx
// Add to navItems array
{ href: "/demos", label: "Demos" }
```

## API Routes Required

Create the following API routes to support the demo pages:

| Route | Purpose |
|-------|---------|
| `/api/demos/agents/structured` | Structured output agent |
| `/api/demos/agents/vision` | Vision agent |
| `/api/demos/agents/research` | Research agent |
| `/api/demos/workflows` | Run workflows |
| `/api/demos/workflows/resume` | Resume suspended workflows |
| `/api/demos/memory/working` | Get working memory |
| `/api/demos/memory/semantic` | Semantic recall search |
| `/api/demos/evals` | Run evaluations |
| `/api/demos/evals/generate` | Generate and evaluate |

## Verification Checklist

- [ ] Demos layout created
- [ ] Landing page with all demo links
- [ ] Agents demo page with all 3 agent types
- [ ] Workflows demo with all 4 workflow types
- [ ] Memory demo with message history, working memory, semantic recall
- [ ] RAG demo with ingest and query
- [ ] Evals demo with scoring display
- [ ] MCP demo with external tool usage
- [ ] Navigation updated
- [ ] All API routes created and working

## Files Changed

| File | Action |
|------|--------|
| `apps/agent/src/app/demos/layout.tsx` | Create |
| `apps/agent/src/app/demos/page.tsx` | Create |
| `apps/agent/src/app/demos/agents/page.tsx` | Create |
| `apps/agent/src/app/demos/workflows/page.tsx` | Create |
| `apps/agent/src/app/demos/memory/page.tsx` | Create |
| `apps/agent/src/app/demos/rag/page.tsx` | Create |
| `apps/agent/src/app/demos/evals/page.tsx` | Create |
| `apps/agent/src/app/demos/mcp/page.tsx` | Create |
| `apps/agent/src/components/AgentHeader.tsx` | Update |
| Multiple API routes in `/api/demos/` | Create |
