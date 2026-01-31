"use client";

import { useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@repo/ui";

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

export default function MemoryDemoPage() {
    const [chatInput, setChatInput] = useState("");
    const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
    const [chatLoading, setChatLoading] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);

    const [workingMemory, setWorkingMemory] = useState<WorkingMemoryResult | null>(null);
    const [workingLoading, setWorkingLoading] = useState(false);

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
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Error: Failed to get response" }
            ]);
        }
        setChatLoading(false);
    };

    const handleSemanticSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearchLoading(true);
        try {
            const res = await fetch("/api/demos/memory/semantic", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: searchQuery })
            });
            const data = await res.json();
            setSearchResults(data);
        } catch {
            setSearchResults({ error: "Failed to search" });
        }
        setSearchLoading(false);
    };

    const handleGetWorkingMemory = async () => {
        setWorkingLoading(true);
        try {
            const res = await fetch("/api/demos/memory/working");
            const data = await res.json();
            setWorkingMemory(data);
        } catch {
            setWorkingMemory({ error: "Failed to get working memory" });
        }
        setWorkingLoading(false);
    };

    return (
        <div>
            <h1 className="mb-2 text-3xl font-bold">Memory Demo</h1>
            <p className="text-muted-foreground mb-8">
                Test message history, working memory, and semantic recall.
            </p>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Chat with Memory</CardTitle>
                        <CardDescription>
                            Messages are stored and can be recalled semantically.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-muted/50 mb-4 h-64 overflow-y-auto rounded-md border p-4">
                            {messages.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                    Start a conversation to test memory...
                                </p>
                            ) : (
                                messages.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={`mb-2 ${msg.role === "user" ? "text-right" : ""}`}
                                    >
                                        <span
                                            className={`inline-block rounded-lg px-3 py-1 ${
                                                msg.role === "user"
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted"
                                            }`}
                                        >
                                            {msg.content}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Type a message..."
                                onKeyDown={(e) => e.key === "Enter" && handleChat()}
                            />
                            <Button onClick={handleChat} disabled={chatLoading}>
                                {chatLoading ? "..." : "Send"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Semantic Recall</CardTitle>
                            <CardDescription>
                                Search conversation history using semantic similarity.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="What's my name?"
                                />
                                <Button onClick={handleSemanticSearch} disabled={searchLoading}>
                                    {searchLoading ? "..." : "Search"}
                                </Button>
                            </div>
                            {searchResults && (
                                <pre className="bg-muted max-h-48 overflow-auto rounded-md p-4 text-sm">
                                    {JSON.stringify(searchResults, null, 2)}
                                </pre>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Working Memory</CardTitle>
                            <CardDescription>
                                Persistent structured data about the user.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button onClick={handleGetWorkingMemory} disabled={workingLoading}>
                                {workingLoading ? "Loading..." : "Get Working Memory"}
                            </Button>
                            {workingMemory && (
                                <pre className="bg-muted max-h-48 overflow-auto rounded-md p-4 text-sm">
                                    {JSON.stringify(workingMemory, null, 2)}
                                </pre>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
