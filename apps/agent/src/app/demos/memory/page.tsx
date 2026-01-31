"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
    Badge
} from "@repo/ui";

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
            const res = await fetch("/api/demos/memory/working");
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

        try {
            const res = await fetch("/api/demos/memory/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMessage.content })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to get response");
            }
            setMessages((prev) => [...prev, { role: "assistant", content: data.text }]);
            if (data.threadId) {
                setThreadId(data.threadId);
            }

            // Refresh working memory after chat (may have been updated)
            setMemoryUpdated(true);
            setTimeout(() => setMemoryUpdated(false), 2000);
            await fetchWorkingMemory();
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Error: Failed to get response" }
            ]);
        }
        setChatLoading(false);
    };

    const handleSemanticSearch = async (query?: string) => {
        const searchText = query || searchQuery;
        if (!searchText.trim()) return;
        if (query) setSearchQuery(query);
        setSearchLoading(true);
        try {
            const res = await fetch("/api/demos/memory/semantic", {
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

    return (
        <div>
            <h1 className="mb-2 text-3xl font-bold">Memory Demo</h1>
            <p className="text-muted-foreground mb-8">
                Explore AI memory capabilities: conversation history, working memory, and semantic
                recall.
            </p>

            <Tabs defaultValue="chat">
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
        </div>
    );
}
