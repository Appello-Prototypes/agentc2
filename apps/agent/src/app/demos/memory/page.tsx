"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getApiBase } from "@/lib/utils";
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
    Input,
    Badge,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@repo/ui";

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

interface SemanticMessage {
    role: string;
    content: string;
    similarity?: number;
}

interface SearchResults {
    query?: string;
    messages?: SemanticMessage[];
    error?: string;
}

interface WorkingMemoryResult {
    workingMemory?: string | null;
    resourceId?: string;
    error?: string;
}

interface ParsedWorkingMemory {
    firstName?: string;
    lastName?: string;
    location?: string;
    occupation?: string;
    interests?: string;
    goals?: string;
    events?: string;
    facts?: string;
    projects?: string;
}

// Parse the markdown working memory template into structured data
function parseWorkingMemory(markdown: string | null | undefined): ParsedWorkingMemory {
    if (!markdown) return {};

    const parsed: ParsedWorkingMemory = {};
    const lines = markdown.split("\n");

    for (const line of lines) {
        const match = line.match(/^\s*-\s*\*\*(.+?)\*\*:\s*(.*)$/);
        if (match) {
            const [, key, value] = match;
            const normalizedKey = key.toLowerCase().replace(/\s+/g, "");
            const trimmedValue = value.trim();

            switch (normalizedKey) {
                case "firstname":
                    parsed.firstName = trimmedValue || undefined;
                    break;
                case "lastname":
                    parsed.lastName = trimmedValue || undefined;
                    break;
                case "location":
                    parsed.location = trimmedValue || undefined;
                    break;
                case "occupation":
                    parsed.occupation = trimmedValue || undefined;
                    break;
                case "interests":
                    parsed.interests = trimmedValue || undefined;
                    break;
                case "goals":
                    parsed.goals = trimmedValue || undefined;
                    break;
                case "events":
                    parsed.events = trimmedValue || undefined;
                    break;
                case "facts":
                    parsed.facts = trimmedValue || undefined;
                    break;
                case "projects":
                    parsed.projects = trimmedValue || undefined;
                    break;
            }
        }
    }

    return parsed;
}

// Suggested queries for semantic recall testing
const suggestedQueries = [
    "What's my name?",
    "Where do I work?",
    "What are my interests?",
    "What did we discuss earlier?",
    "What projects am I working on?"
];

// Example prompts to demonstrate memory features
const examplePrompts = [
    "Hi, my name is Alex and I work at Acme Corp as a software engineer",
    "I live in San Francisco and love hiking on weekends",
    "I'm currently learning Rust and working on a side project",
    "My goal this year is to contribute to open source",
    "I prefer TypeScript over JavaScript for large projects"
];

// Educational content for each memory type
const memoryEducation = {
    chat: {
        title: "Chat with Memory",
        subtitle: "Conversation History + Automatic Learning",
        whatItIs: `This tab demonstrates **Message History** - the foundation of conversational AI memory. 
            Every message you send is stored and retrieved to maintain conversation context. 
            Behind the scenes, the agent also automatically updates **Working Memory** 
            as it learns facts about you.`,
        whatToExpect: [
            "The agent remembers what you said earlier in the conversation",
            "Share personal details and watch the 'Working Memory' tab update",
            "Ask follow-up questions that reference earlier context",
            "The agent maintains a coherent conversation across multiple exchanges"
        ],
        howItWorks: [
            "Messages are stored in PostgreSQL via Mastra's storage layer",
            "Each conversation is tracked by a unique thread ID tied to your user",
            "The last 10 messages are automatically included in context",
            "The agent's system prompt instructs it to update working memory with new facts"
        ],
        agenticUseCase: `**Customer Support Agent**: Remembers the customer's issue across messages, 
            tracks their account details, and references previous conversations. 
            "I see you contacted us last week about your billing issue - has that been resolved?"`
    },
    semantic: {
        title: "Semantic Recall",
        subtitle: "Find Information by Meaning, Not Keywords",
        whatItIs: `Semantic recall uses **vector embeddings** to find relevant past conversations 
            based on meaning, not exact word matches. Ask "What did we discuss about my career?" 
            and it will find messages about your job, goals, and projects - even if they never 
            used the word "career".`,
        whatToExpect: [
            "Search for topics you've discussed using natural language",
            "Results show similarity scores (how closely each message matches)",
            "Find messages even when your query uses different words",
            "Context messages before/after matches provide fuller picture"
        ],
        howItWorks: [
            "Messages are converted to 1536-dimensional vectors using OpenAI embeddings",
            "Vectors are stored in PostgreSQL with pgvector extension",
            "Your query is embedded and compared using cosine similarity",
            "Top 3 matches + 2 surrounding messages are returned for context"
        ],
        agenticUseCase: `**Research Assistant**: "Find all our discussions about machine learning papers" 
            retrieves relevant context even from conversations that mentioned "neural networks", 
            "deep learning", or "AI research" without using "machine learning" explicitly.`
    },
    working: {
        title: "Working Memory",
        subtitle: "Persistent, Structured User Profile",
        whatItIs: `Working memory is a **structured template** that the agent automatically maintains 
            as it learns about you. Unlike chat history (raw messages) or semantic recall 
            (search-based), working memory is a distilled, always-available summary that fits 
            in every prompt.`,
        whatToExpect: [
            "See a structured profile populated from your conversations",
            "Data persists across sessions - come back tomorrow and it remembers",
            "The agent automatically extracts and organizes key facts",
            "Fixed size means it never overflows the context window"
        ],
        howItWorks: [
            "A markdown template defines the schema (name, location, interests, etc.)",
            "The agent's system prompt instructs it to update this template",
            "Updates happen automatically during normal conversation",
            "The template is always prepended to the agent's context"
        ],
        agenticUseCase: `**Personal Assistant**: Always knows your preferences, timezone, and communication 
            style. "Schedule a meeting at a time that works for you" → uses stored timezone and 
            calendar preferences without asking again.`
    }
};

// Workflow integration examples
const workflowExamples = [
    {
        title: "Multi-Step Research Workflow",
        description: "Agent researches a topic across sessions, building on previous findings",
        steps: [
            "User asks about a complex topic",
            "Agent stores research progress in working memory",
            "Semantic recall finds relevant past research",
            "Next session continues from where it left off"
        ],
        code: `// Workflow step that leverages memory
const researchStep = createStep({
  id: "research",
  execute: async ({ context, mastra }) => {
    const agent = mastra.getAgent("researcher");
    
    // Memory automatically recalls past research
    const result = await agent.generate(
      \`Continue researching: \${context.topic}\`,
      { memory: { thread: context.threadId, resource: context.userId } }
    );
    
    return { findings: result.text };
  }
});`
    },
    {
        title: "Customer Onboarding Agent",
        description: "Guides new users through setup, remembering progress across sessions",
        steps: [
            "User starts onboarding conversation",
            "Working memory tracks completed steps",
            "User leaves and returns later",
            "Agent resumes exactly where they left off"
        ],
        code: `// Working memory template for onboarding
workingMemory: {
  enabled: true,
  template: \`# Onboarding Progress
- **Current Step**: 
- **Completed Steps**: 
- **User Preferences**: 
- **Blockers**: \`
}`
    },
    {
        title: "Context-Aware Code Assistant",
        description: "Remembers codebase context and user's coding preferences",
        steps: [
            "User discusses their project architecture",
            "Agent stores tech stack and patterns in working memory",
            "Semantic recall finds relevant past code discussions",
            "Future suggestions match established patterns"
        ],
        code: `// Semantic recall for code context
const codeContext = await memory.recall({
  threadId: projectThread,
  vectorSearchString: "authentication implementation",
  resourceId: userId
});

// Use recalled context in generation
const suggestion = await agent.generate(
  "How should I implement login?",
  { context: codeContext.messages }
);`
    }
];

export default function MemoryDemoPage() {
    // Chat State
    const [chatInput, setChatInput] = useState("");
    const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [threadId, setThreadId] = useState<string | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Semantic Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);

    // Working Memory State
    const [workingMemory, setWorkingMemory] = useState<WorkingMemoryResult | null>(null);
    const [parsedMemory, setParsedMemory] = useState<ParsedWorkingMemory>({});
    const [workingLoading, setWorkingLoading] = useState(false);
    const [memoryUpdated, setMemoryUpdated] = useState(false);

    // Auto-scroll chat to bottom
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Fetch working memory on mount and after chat
    const fetchWorkingMemory = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/demos/memory/working`);
            const data = await res.json();
            setWorkingMemory(data);
            if (data.workingMemory) {
                setParsedMemory(parseWorkingMemory(data.workingMemory));
            }
        } catch {
            // Silent fail on background refresh
        }
    }, []);

    useEffect(() => {
        fetchWorkingMemory();
    }, [fetchWorkingMemory]);

    const handleChat = async () => {
        if (!chatInput.trim()) return;

        const userMessage = { role: "user", content: chatInput };
        setMessages((prev) => [...prev, userMessage]);
        setChatInput("");
        setChatLoading(true);

        // Add a placeholder for streaming response
        const assistantMessageIndex = messages.length + 1;
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        try {
            const res = await fetch(`${getApiBase()}/api/demos/memory/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMessage.content })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to get response");
            }

            let currentText = "";
            let receivedThreadId: string | null = null;

            await consumeSSEStream(res, (event, data) => {
                const d = data as {
                    chunk?: string;
                    full?: string;
                    text?: string;
                    threadId?: string;
                    message?: string;
                };

                if (event === "text") {
                    currentText = d.full || "";
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[assistantMessageIndex] = {
                            role: "assistant",
                            content: currentText
                        };
                        return updated;
                    });
                } else if (event === "done") {
                    receivedThreadId = d.threadId || null;
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[assistantMessageIndex] = {
                            role: "assistant",
                            content: d.text || currentText
                        };
                        return updated;
                    });
                } else if (event === "error") {
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[assistantMessageIndex] = {
                            role: "assistant",
                            content: `Error: ${d.message}`
                        };
                        return updated;
                    });
                }
            });

            if (receivedThreadId) {
                setThreadId(receivedThreadId);
            }

            // Refresh working memory after chat (may have been updated)
            setMemoryUpdated(true);
            setTimeout(() => setMemoryUpdated(false), 2000);
            await fetchWorkingMemory();
        } catch {
            setMessages((prev) => {
                const updated = [...prev];
                updated[assistantMessageIndex] = {
                    role: "assistant",
                    content: "Error: Failed to get response"
                };
                return updated;
            });
        }
        setChatLoading(false);
    };

    const handleSemanticSearch = async (query?: string) => {
        const searchText = query || searchQuery;
        if (!searchText.trim()) return;
        if (query) setSearchQuery(query);
        setSearchLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/api/demos/memory/semantic`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: searchText, threadId })
            });
            const data = await res.json();
            setSearchResults(data);
        } catch {
            setSearchResults({ error: "Failed to search" });
        }
        setSearchLoading(false);
    };

    const handleRefreshWorkingMemory = async () => {
        setWorkingLoading(true);
        await fetchWorkingMemory();
        setWorkingLoading(false);
    };

    const handleClearChat = () => {
        setMessages([]);
        setSearchResults(null);
    };

    const handleUseExample = (example: string) => {
        setChatInput(example);
    };

    // Count how many memory fields are populated
    const memoryFieldCount = Object.values(parsedMemory).filter(Boolean).length;

    const [activeTab, setActiveTab] = useState("chat");

    // Get education content for active tab
    const getEducation = () => {
        switch (activeTab) {
            case "recall":
                return memoryEducation.semantic;
            case "working":
                return memoryEducation.working;
            default:
                return memoryEducation.chat;
        }
    };

    const education = getEducation();

    return (
        <div>
            <h1 className="mb-2 text-3xl font-bold">Memory Demo</h1>
            <p className="text-muted-foreground mb-6">
                Explore AI memory capabilities: conversation history, working memory, and semantic
                recall.
            </p>

            {/* Overview Card */}
            <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg text-blue-700 dark:text-blue-400">
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        Understanding AI Memory
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        Mastra provides three complementary memory systems that work together:{" "}
                        <strong>Message History</strong> (recent conversation context),{" "}
                        <strong>Semantic Recall</strong> (vector search across all past
                        conversations), and <strong>Working Memory</strong> (persistent structured
                        user data). Each tab below demonstrates one aspect - try them in order for
                        the best experience.
                    </p>
                </CardContent>
            </Card>

            <Tabs defaultValue="chat" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-6">
                    <TabsTrigger value="chat">Chat with Memory</TabsTrigger>
                    <TabsTrigger value="recall">Semantic Recall</TabsTrigger>
                    <TabsTrigger value="working">
                        Working Memory
                        {memoryFieldCount > 0 && (
                            <Badge variant="secondary" className="ml-2">
                                {memoryFieldCount}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* Educational Panel - Shows context for active tab */}
                <Collapsible defaultOpen className="mb-6">
                    <Card className="border-dashed">
                        <CollapsibleTrigger className="w-full">
                            <CardHeader className="hover:bg-muted/50 flex cursor-pointer flex-row items-center justify-between py-4">
                                <div className="text-left">
                                    <CardTitle className="text-base">{education.title}</CardTitle>
                                    <CardDescription>{education.subtitle}</CardDescription>
                                </div>
                                <Badge variant="outline" className="shrink-0">
                                    Click to expand/collapse
                                </Badge>
                            </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <CardContent className="grid gap-6 border-t pt-6 md:grid-cols-2">
                                {/* What It Is */}
                                <div>
                                    <h4 className="mb-2 flex items-center gap-2 font-semibold">
                                        <span className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-full text-xs">
                                            ?
                                        </span>
                                        What Is This?
                                    </h4>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        {education.whatItIs}
                                    </p>
                                </div>

                                {/* What to Expect */}
                                <div>
                                    <h4 className="mb-2 flex items-center gap-2 font-semibold">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                            ✓
                                        </span>
                                        What You Should Experience
                                    </h4>
                                    <ul className="text-muted-foreground space-y-1 text-sm">
                                        {education.whatToExpect.map((item, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="text-muted-foreground/50 mt-1">
                                                    •
                                                </span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* How It Works */}
                                <div>
                                    <h4 className="mb-2 flex items-center gap-2 font-semibold">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                            ⚙
                                        </span>
                                        How It Works Technically
                                    </h4>
                                    <ul className="text-muted-foreground space-y-1 text-sm">
                                        {education.howItWorks.map((item, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="font-mono text-xs text-purple-600 dark:text-purple-400">
                                                    {i + 1}.
                                                </span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Agentic Use Case */}
                                <div>
                                    <h4 className="mb-2 flex items-center gap-2 font-semibold">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                            🤖
                                        </span>
                                        Real-World Agentic Use Case
                                    </h4>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        {education.agenticUseCase}
                                    </p>
                                </div>
                            </CardContent>
                        </CollapsibleContent>
                    </Card>
                </Collapsible>

                {/* Chat Tab */}
                <TabsContent value="chat">
                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Chat Panel */}
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle>Conversation</CardTitle>
                                        <CardDescription>
                                            Chat naturally - the agent remembers your conversation
                                            and learns about you.
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {memoryUpdated && (
                                            <Badge
                                                variant="outline"
                                                className="animate-pulse border-green-500 text-green-600"
                                            >
                                                Memory Updated
                                            </Badge>
                                        )}
                                        {messages.length > 0 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleClearChat}
                                            >
                                                Clear Chat
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {/* Messages */}
                                <div
                                    ref={chatContainerRef}
                                    className="bg-muted/30 mb-4 h-80 overflow-y-auto rounded-lg border p-4"
                                >
                                    {messages.length === 0 ? (
                                        <div className="flex h-full flex-col items-center justify-center text-center">
                                            <div className="text-muted-foreground mb-4">
                                                <svg
                                                    className="mx-auto mb-2 h-12 w-12 opacity-50"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={1.5}
                                                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                                    />
                                                </svg>
                                                <p className="font-medium">Start a conversation</p>
                                                <p className="mt-1 text-sm">
                                                    Share information about yourself and watch the
                                                    agent remember it.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {messages.map((msg, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                                >
                                                    <div
                                                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                                            msg.role === "user"
                                                                ? "bg-primary text-primary-foreground rounded-br-md"
                                                                : "bg-muted rounded-bl-md"
                                                        }`}
                                                    >
                                                        <p className="text-sm">{msg.content}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            {chatLoading && (
                                                <div className="flex justify-start">
                                                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2">
                                                        <div className="flex gap-1">
                                                            <span className="bg-foreground/30 h-2 w-2 animate-bounce rounded-full" />
                                                            <span
                                                                className="bg-foreground/30 h-2 w-2 animate-bounce rounded-full"
                                                                style={{ animationDelay: "0.1s" }}
                                                            />
                                                            <span
                                                                className="bg-foreground/30 h-2 w-2 animate-bounce rounded-full"
                                                                style={{ animationDelay: "0.2s" }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Input */}
                                <div className="flex gap-2">
                                    <Input
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="Type a message..."
                                        onKeyDown={(e) =>
                                            e.key === "Enter" && !e.shiftKey && handleChat()
                                        }
                                        disabled={chatLoading}
                                        className="flex-1"
                                    />
                                    <Button
                                        onClick={handleChat}
                                        disabled={chatLoading || !chatInput.trim()}
                                    >
                                        Send
                                    </Button>
                                </div>

                                {threadId && (
                                    <p className="text-muted-foreground mt-2 text-xs">
                                        Thread: {threadId}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Example Prompts */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Try These Examples</CardTitle>
                                <CardDescription>
                                    Click to use as input - these demonstrate memory features.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {examplePrompts.map((example, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleUseExample(example)}
                                        className="bg-muted hover:bg-muted/80 w-full rounded-lg p-3 text-left text-sm transition-colors"
                                    >
                                        <span className="text-muted-foreground">{i + 1}.</span>{" "}
                                        {example}
                                    </button>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Semantic Recall Tab */}
                <TabsContent value="recall">
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Semantic Search</CardTitle>
                                <CardDescription>
                                    Search your conversation history using natural language. Unlike
                                    keyword search, this finds semantically similar messages.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Ask about past conversations..."
                                        onKeyDown={(e) =>
                                            e.key === "Enter" && handleSemanticSearch()
                                        }
                                    />
                                    <Button
                                        onClick={() => handleSemanticSearch()}
                                        disabled={searchLoading || !searchQuery.trim()}
                                    >
                                        {searchLoading ? "Searching..." : "Search"}
                                    </Button>
                                </div>

                                {/* Suggested Queries */}
                                <div>
                                    <p className="text-muted-foreground mb-2 text-sm font-medium">
                                        Suggested queries:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {suggestedQueries.map((query, i) => (
                                            <Button
                                                key={i}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSemanticSearch(query)}
                                                disabled={searchLoading}
                                            >
                                                {query}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Results */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Search Results</CardTitle>
                                <CardDescription>
                                    Messages ranked by semantic similarity to your query.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {!searchResults ? (
                                    <div className="text-muted-foreground py-8 text-center">
                                        <svg
                                            className="mx-auto mb-2 h-12 w-12 opacity-50"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={1.5}
                                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                            />
                                        </svg>
                                        <p className="text-sm">Search results will appear here</p>
                                    </div>
                                ) : searchResults.error ? (
                                    <div className="rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                        {searchResults.error}
                                    </div>
                                ) : !searchResults.messages ||
                                  searchResults.messages.length === 0 ? (
                                    <div className="text-muted-foreground py-8 text-center">
                                        <p className="text-sm">
                                            No matching messages found. Try chatting first to build
                                            up conversation history.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {searchResults.messages.map((msg, i) => (
                                            <div key={i} className="rounded-lg border p-3">
                                                <div className="mb-2 flex items-center justify-between">
                                                    <Badge
                                                        variant={
                                                            msg.role === "user"
                                                                ? "default"
                                                                : "secondary"
                                                        }
                                                    >
                                                        {msg.role}
                                                    </Badge>
                                                    {msg.similarity !== undefined && (
                                                        <div className="flex items-center gap-2">
                                                            <div className="bg-muted h-2 w-20 overflow-hidden rounded-full">
                                                                <div
                                                                    className="h-full bg-green-500 transition-all"
                                                                    style={{
                                                                        width: `${Math.round(msg.similarity * 100)}%`
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="text-muted-foreground text-xs">
                                                                {Math.round(msg.similarity * 100)}%
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-sm">{msg.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* How It Works */}
                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle className="text-lg">How Semantic Recall Works</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-6 md:grid-cols-3">
                                <div className="text-center">
                                    <div className="bg-primary/10 text-primary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold">
                                        1
                                    </div>
                                    <h4 className="mb-1 font-medium">Embedding</h4>
                                    <p className="text-muted-foreground text-sm">
                                        Messages are converted to vectors using OpenAI embeddings
                                    </p>
                                </div>
                                <div className="text-center">
                                    <div className="bg-primary/10 text-primary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold">
                                        2
                                    </div>
                                    <h4 className="mb-1 font-medium">Vector Search</h4>
                                    <p className="text-muted-foreground text-sm">
                                        Your query is embedded and compared using pgvector
                                        similarity
                                    </p>
                                </div>
                                <div className="text-center">
                                    <div className="bg-primary/10 text-primary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold">
                                        3
                                    </div>
                                    <h4 className="mb-1 font-medium">Context Recall</h4>
                                    <p className="text-muted-foreground text-sm">
                                        Top matches + surrounding messages provide rich context
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Working Memory Tab */}
                <TabsContent value="working">
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Visual Memory Card */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle>User Profile</CardTitle>
                                        <CardDescription>
                                            Information the agent has learned about you from
                                            conversations.
                                        </CardDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleRefreshWorkingMemory}
                                        disabled={workingLoading}
                                    >
                                        {workingLoading ? "Refreshing..." : "Refresh"}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {workingMemory?.error ? (
                                    <div className="rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                        {workingMemory.error}
                                    </div>
                                ) : memoryFieldCount === 0 ? (
                                    <div className="text-muted-foreground py-8 text-center">
                                        <svg
                                            className="mx-auto mb-2 h-12 w-12 opacity-50"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={1.5}
                                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                            />
                                        </svg>
                                        <p className="font-medium">No profile data yet</p>
                                        <p className="mt-1 text-sm">
                                            Share information about yourself in chat to populate
                                            this.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Identity Section */}
                                        {(parsedMemory.firstName || parsedMemory.lastName) && (
                                            <div>
                                                <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                                                    Identity
                                                </h4>
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold">
                                                        {(parsedMemory.firstName?.[0] || "") +
                                                            (parsedMemory.lastName?.[0] || "")}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">
                                                            {[
                                                                parsedMemory.firstName,
                                                                parsedMemory.lastName
                                                            ]
                                                                .filter(Boolean)
                                                                .join(" ") || "Unknown"}
                                                        </p>
                                                        {parsedMemory.occupation && (
                                                            <p className="text-muted-foreground text-sm">
                                                                {parsedMemory.occupation}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Details Grid */}
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {parsedMemory.location && (
                                                <div className="bg-muted/50 rounded-lg p-3">
                                                    <p className="text-muted-foreground text-xs font-medium">
                                                        Location
                                                    </p>
                                                    <p className="text-sm">
                                                        {parsedMemory.location}
                                                    </p>
                                                </div>
                                            )}
                                            {parsedMemory.interests && (
                                                <div className="bg-muted/50 rounded-lg p-3">
                                                    <p className="text-muted-foreground text-xs font-medium">
                                                        Interests
                                                    </p>
                                                    <p className="text-sm">
                                                        {parsedMemory.interests}
                                                    </p>
                                                </div>
                                            )}
                                            {parsedMemory.goals && (
                                                <div className="bg-muted/50 rounded-lg p-3">
                                                    <p className="text-muted-foreground text-xs font-medium">
                                                        Goals
                                                    </p>
                                                    <p className="text-sm">{parsedMemory.goals}</p>
                                                </div>
                                            )}
                                            {parsedMemory.projects && (
                                                <div className="bg-muted/50 rounded-lg p-3">
                                                    <p className="text-muted-foreground text-xs font-medium">
                                                        Projects
                                                    </p>
                                                    <p className="text-sm">
                                                        {parsedMemory.projects}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Additional Info */}
                                        {(parsedMemory.events || parsedMemory.facts) && (
                                            <div className="space-y-3">
                                                {parsedMemory.events && (
                                                    <div className="bg-muted/50 rounded-lg p-3">
                                                        <p className="text-muted-foreground text-xs font-medium">
                                                            Events
                                                        </p>
                                                        <p className="text-sm">
                                                            {parsedMemory.events}
                                                        </p>
                                                    </div>
                                                )}
                                                {parsedMemory.facts && (
                                                    <div className="bg-muted/50 rounded-lg p-3">
                                                        <p className="text-muted-foreground text-xs font-medium">
                                                            Facts
                                                        </p>
                                                        <p className="text-sm">
                                                            {parsedMemory.facts}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Raw Memory Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Raw Working Memory</CardTitle>
                                <CardDescription>
                                    The markdown template the agent uses to track user information.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {workingMemory?.workingMemory ? (
                                    <pre className="bg-muted max-h-96 overflow-auto rounded-lg p-4 font-mono text-sm">
                                        {workingMemory.workingMemory}
                                    </pre>
                                ) : (
                                    <div className="bg-muted rounded-lg p-4">
                                        <pre className="text-muted-foreground font-mono text-sm">
                                            {`# User Information
- **First Name**:
- **Last Name**:
- **Location**:
- **Occupation**:
- **Interests**:
- **Goals**:
- **Events**:
- **Facts**:
- **Projects**:`}
                                        </pre>
                                        <p className="text-muted-foreground mt-4 text-xs">
                                            This template gets populated as you chat with the agent.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Explanation Card */}
                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle className="text-lg">
                                How Working Memory Differs from Chat History
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="rounded-lg border p-4">
                                    <h4 className="mb-2 font-semibold">Chat History</h4>
                                    <ul className="text-muted-foreground space-y-1 text-sm">
                                        <li>• Stores raw conversation messages</li>
                                        <li>• Limited by context window size</li>
                                        <li>• Searched via semantic similarity</li>
                                        <li>• Grows with each conversation</li>
                                    </ul>
                                </div>
                                <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
                                    <h4 className="mb-2 font-semibold text-green-700 dark:text-green-400">
                                        Working Memory
                                    </h4>
                                    <ul className="space-y-1 text-sm text-green-700 dark:text-green-400">
                                        <li>• Structured, distilled user profile</li>
                                        <li>• Fixed size, always fits in context</li>
                                        <li>• Updated by the agent as it learns</li>
                                        <li>• Persists across all conversations</li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Workflow Integration Section */}
            <div className="mt-12">
                <div className="mb-6">
                    <h2 className="mb-2 text-2xl font-bold">
                        Integrating Memory into Agentic Workflows
                    </h2>
                    <p className="text-muted-foreground">
                        Memory transforms stateless AI into persistent, context-aware agents. Here
                        are patterns for incorporating memory into Mastra workflows.
                    </p>
                </div>

                {/* Memory Architecture Diagram */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-lg">Memory Architecture Overview</CardTitle>
                        <CardDescription>
                            How the three memory systems work together in an agentic application
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
                                <div className="mb-2 flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-300">
                                        <svg
                                            className="h-4 w-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                            />
                                        </svg>
                                    </div>
                                    <h4 className="font-semibold text-blue-700 dark:text-blue-300">
                                        Message History
                                    </h4>
                                </div>
                                <p className="mb-2 text-sm text-blue-600 dark:text-blue-400">
                                    Recent conversation context
                                </p>
                                <div className="text-muted-foreground space-y-1 text-xs">
                                    <p>
                                        <strong>Scope:</strong> Last N messages
                                    </p>
                                    <p>
                                        <strong>Best for:</strong> Immediate context
                                    </p>
                                    <p>
                                        <strong>Latency:</strong> Instant (in-context)
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-950/30">
                                <div className="mb-2 flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-200 text-purple-700 dark:bg-purple-800 dark:text-purple-300">
                                        <svg
                                            className="h-4 w-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                            />
                                        </svg>
                                    </div>
                                    <h4 className="font-semibold text-purple-700 dark:text-purple-300">
                                        Semantic Recall
                                    </h4>
                                </div>
                                <p className="mb-2 text-sm text-purple-600 dark:text-purple-400">
                                    Vector search across all history
                                </p>
                                <div className="text-muted-foreground space-y-1 text-xs">
                                    <p>
                                        <strong>Scope:</strong> All past conversations
                                    </p>
                                    <p>
                                        <strong>Best for:</strong> Finding relevant context
                                    </p>
                                    <p>
                                        <strong>Latency:</strong> ~100ms (vector query)
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
                                <div className="mb-2 flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-300">
                                        <svg
                                            className="h-4 w-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                            />
                                        </svg>
                                    </div>
                                    <h4 className="font-semibold text-green-700 dark:text-green-300">
                                        Working Memory
                                    </h4>
                                </div>
                                <p className="mb-2 text-sm text-green-600 dark:text-green-400">
                                    Structured user profile
                                </p>
                                <div className="text-muted-foreground space-y-1 text-xs">
                                    <p>
                                        <strong>Scope:</strong> Distilled facts
                                    </p>
                                    <p>
                                        <strong>Best for:</strong> Persistent preferences
                                    </p>
                                    <p>
                                        <strong>Latency:</strong> Instant (in-context)
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-muted/30 mt-4 rounded-lg border p-4">
                            <p className="text-muted-foreground text-center text-sm">
                                <strong>Data Flow:</strong> User message → Agent generates response
                                → Message stored in history → Embeddings created for semantic search
                                → Working memory updated with new facts → All three inform next
                                response
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Workflow Examples */}
                <div className="grid gap-6 lg:grid-cols-3">
                    {workflowExamples.map((example, i) => (
                        <Card key={i}>
                            <CardHeader>
                                <CardTitle className="text-lg">{example.title}</CardTitle>
                                <CardDescription>{example.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-4">
                                    <h5 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                                        Workflow Steps
                                    </h5>
                                    <ol className="text-muted-foreground space-y-1 text-sm">
                                        {example.steps.map((step, j) => (
                                            <li key={j} className="flex items-start gap-2">
                                                <span className="bg-primary/10 text-primary flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs">
                                                    {j + 1}
                                                </span>
                                                <span>{step}</span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                                <Collapsible>
                                    <CollapsibleTrigger>
                                        <Button variant="outline" size="sm" className="w-full">
                                            View Code Example
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <pre className="bg-muted mt-3 max-h-48 overflow-auto rounded-lg p-3 font-mono text-xs">
                                            {example.code}
                                        </pre>
                                    </CollapsibleContent>
                                </Collapsible>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Best Practices */}
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle className="text-lg">Memory Best Practices</CardTitle>
                        <CardDescription>
                            Guidelines for effective memory implementation in production agents
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                        ✓
                                    </div>
                                    <div>
                                        <h5 className="font-medium">
                                            Use Resource IDs for Multi-Tenancy
                                        </h5>
                                        <p className="text-muted-foreground text-sm">
                                            Scope memory by user/organization to prevent data
                                            leakage between tenants.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                        ✓
                                    </div>
                                    <div>
                                        <h5 className="font-medium">
                                            Design Working Memory Templates Carefully
                                        </h5>
                                        <p className="text-muted-foreground text-sm">
                                            Keep templates focused and structured. Too many fields
                                            dilutes what the agent tracks.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                        ✓
                                    </div>
                                    <div>
                                        <h5 className="font-medium">
                                            Tune Semantic Recall Parameters
                                        </h5>
                                        <p className="text-muted-foreground text-sm">
                                            Adjust topK and messageRange based on your use case.
                                            More context isn&apos;t always better.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                        ✗
                                    </div>
                                    <div>
                                        <h5 className="font-medium">
                                            Don&apos;t Store Sensitive Data in Working Memory
                                        </h5>
                                        <p className="text-muted-foreground text-sm">
                                            Working memory is prepended to every prompt. Avoid PII,
                                            credentials, or secrets.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                        ✗
                                    </div>
                                    <div>
                                        <h5 className="font-medium">
                                            Don&apos;t Rely Solely on Semantic Recall
                                        </h5>
                                        <p className="text-muted-foreground text-sm">
                                            Vector search can miss exact matches. Combine with
                                            keyword search for critical lookups.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                        ✗
                                    </div>
                                    <div>
                                        <h5 className="font-medium">
                                            Don&apos;t Ignore Thread Boundaries
                                        </h5>
                                        <p className="text-muted-foreground text-sm">
                                            Use separate threads for distinct conversations. Mixing
                                            contexts confuses the agent.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
