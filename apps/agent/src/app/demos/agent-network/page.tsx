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

interface Message {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
}

interface NetworkEvent {
    type: string;
    payload: unknown;
    timestamp: number;
}

interface TripSummary {
    destination: string;
    dates?: string;
    totalCost?: number;
    breakdown?: {
        transport?: number;
        accommodation?: number;
        activities?: number;
    };
    bookingReference?: string;
}

// Example prompts for the demo
const examplePrompts = [
    {
        category: "Quick Lookups",
        prompts: [
            "What's the weather like in Paris in April?",
            "How much are flights from New York to Tokyo?",
            "Find hotels in Rome for next weekend"
        ]
    },
    {
        category: "Destination Research",
        prompts: [
            "Tell me about visiting Japan - best times, visa requirements, and highlights",
            "What are the must-see attractions in Barcelona?",
            "Compare Bali vs Thailand for a beach vacation"
        ]
    },
    {
        category: "Full Trip Planning",
        prompts: [
            "Plan a 5-day trip to Tokyo for 2 people with a $3000 budget",
            "Create a week-long Italy itinerary covering Rome, Florence, and Venice",
            "Help me plan a romantic anniversary trip to Paris"
        ]
    },
    {
        category: "Memory & Preferences",
        prompts: [
            "I prefer boutique hotels over chain hotels",
            "I'm vegetarian and love hiking",
            "Find me a hotel in London (use my preferences)"
        ]
    }
];

// Network agents for visualization
const networkAgents = [
    {
        id: "destinationAgent",
        name: "Destination Research",
        icon: "🌍",
        description: "Researches destinations, visa requirements, best times to visit"
    },
    {
        id: "transportAgent",
        name: "Transport",
        icon: "✈️",
        description: "Finds flights, trains, and transport options"
    },
    {
        id: "accommodationAgent",
        name: "Accommodation",
        icon: "🏨",
        description: "Searches hotels, rentals, and lodging"
    },
    {
        id: "activitiesAgent",
        name: "Activities",
        icon: "🎯",
        description: "Discovers attractions, restaurants, and tours"
    },
    {
        id: "budgetAgent",
        name: "Budget",
        icon: "💰",
        description: "Calculates costs and optimizes spending"
    },
    {
        id: "itineraryAgent",
        name: "Itinerary",
        icon: "📅",
        description: "Creates day-by-day trip schedules"
    }
];

const networkWorkflows = [
    {
        id: "parallelResearchWorkflow",
        name: "Parallel Research",
        description: "Research flights, hotels, and activities simultaneously"
    },
    {
        id: "itineraryAssemblyWorkflow",
        name: "Itinerary Assembly",
        description: "Create complete day-by-day itinerary"
    },
    {
        id: "budgetApprovalWorkflow",
        name: "Budget Approval",
        description: "Human-in-the-loop budget confirmation"
    }
];

const networkTools = [
    { id: "flightSearch", name: "Flight Search", icon: "✈️" },
    { id: "hotelSearch", name: "Hotel Search", icon: "🏨" },
    { id: "weatherLookup", name: "Weather", icon: "🌤️" },
    { id: "tripNotes", name: "Trip Notes", icon: "📝" }
];

export default function AgentNetworkPage() {
    // Chat state
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [threadId, setThreadId] = useState<string | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Network activity state
    const [networkEvents, setNetworkEvents] = useState<NetworkEvent[]>([]);
    const [activeAgents, setActiveAgents] = useState<string[]>([]);
    const [activeWorkflows, setActiveWorkflows] = useState<string[]>([]);
    const [activeTools, setActiveTools] = useState<string[]>([]);
    const [currentStatus, setCurrentStatus] = useState<string>("");

    // Trip summary state
    const [tripSummary, setTripSummary] = useState<TripSummary | null>(null);

    // Pending approval state
    const [pendingApproval, setPendingApproval] = useState<{
        runId: string;
        workflowId: string;
        stepId: string;
        data: unknown;
    } | null>(null);

    // Use network mode toggle
    const [useNetworkMode, setUseNetworkMode] = useState(true);

    // Auto-scroll chat to bottom
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Clear network activity when starting new message
    const clearNetworkActivity = useCallback(() => {
        setActiveAgents([]);
        setActiveWorkflows([]);
        setActiveTools([]);
        setCurrentStatus("");
    }, []);

    // Handle sending a message
    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            role: "user",
            content: input,
            timestamp: Date.now()
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);
        clearNetworkActivity();
        setNetworkEvents([]);

        try {
            const response = await fetch("/api/demos/agent-network/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: input,
                    threadId,
                    useNetwork: useNetworkMode
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Request failed with status ${response.status}`);
            }

            let assistantContent = "";

            await consumeSSEStream(response, (event, data: unknown) => {
                const typedData = data as Record<string, unknown>;

                switch (event) {
                    case "start":
                        if (typedData.threadId) {
                            setThreadId(typedData.threadId as string);
                        }
                        setCurrentStatus("Processing your request...");
                        break;

                    case "network-event":
                        setNetworkEvents((prev) => [
                            ...prev,
                            {
                                type: typedData.type as string,
                                payload: typedData.payload,
                                timestamp: Date.now()
                            }
                        ]);

                        // Track active components
                        const eventType = typedData.type as string;
                        if (eventType.includes("agent-execution-start")) {
                            const agentId = (typedData.payload as Record<string, unknown>)
                                ?.agentId as string;
                            if (agentId)
                                setActiveAgents((prev) => [...new Set([...prev, agentId])]);
                        }
                        if (eventType.includes("workflow-execution-start")) {
                            const workflowId = (typedData.payload as Record<string, unknown>)
                                ?.workflowId as string;
                            if (workflowId)
                                setActiveWorkflows((prev) => [...new Set([...prev, workflowId])]);
                        }
                        if (eventType.includes("tool-execution-start")) {
                            const toolId = (typedData.payload as Record<string, unknown>)
                                ?.toolId as string;
                            if (toolId) setActiveTools((prev) => [...new Set([...prev, toolId])]);
                        }
                        break;

                    case "status":
                        setCurrentStatus(typedData.message as string);
                        break;

                    case "text":
                        if (typedData.chunk) {
                            assistantContent += typedData.chunk as string;
                            setMessages((prev) => {
                                const newMessages = [...prev];
                                const lastMessage = newMessages[newMessages.length - 1];
                                if (lastMessage?.role === "assistant") {
                                    lastMessage.content = assistantContent;
                                } else {
                                    newMessages.push({
                                        role: "assistant",
                                        content: assistantContent,
                                        timestamp: Date.now()
                                    });
                                }
                                return newMessages;
                            });
                        }
                        break;

                    case "step":
                        // Handle tool calls and other steps
                        if (typedData.toolCalls) {
                            const toolCalls = typedData.toolCalls as Array<{ toolName: string }>;
                            toolCalls.forEach((tc) => {
                                setActiveTools((prev) => [...new Set([...prev, tc.toolName])]);
                            });
                        }
                        break;

                    case "done":
                        setCurrentStatus("Complete");
                        break;

                    case "error":
                        setCurrentStatus(`Error: ${typedData.message}`);
                        break;
                }
            });
        } catch (error) {
            console.error("Chat error:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: `Error: ${errorMessage}. Please make sure you're logged in and try again.`,
                    timestamp: Date.now()
                }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle budget approval
    const handleApproval = async (approved: boolean, feedback?: string) => {
        if (!pendingApproval) return;

        try {
            const response = await fetch("/api/demos/agent-network/workflow", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workflowId: pendingApproval.workflowId,
                    runId: pendingApproval.runId,
                    stepId: pendingApproval.stepId,
                    resumeData: { approved, feedback }
                })
            });

            const result = await response.json();

            if (result.status === "success") {
                if (approved && result.result?.confirmation) {
                    setTripSummary({
                        destination: result.result.confirmation.destination,
                        totalCost: result.result.confirmation.totalCost,
                        bookingReference: result.result.confirmation.bookingReference
                    });
                }

                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: result.result?.message || "Workflow completed.",
                        timestamp: Date.now()
                    }
                ]);
            }

            setPendingApproval(null);
        } catch (error) {
            console.error("Approval error:", error);
        }
    };

    // Clear conversation
    const handleClear = () => {
        setMessages([]);
        setNetworkEvents([]);
        setThreadId(null);
        setTripSummary(null);
        setPendingApproval(null);
        clearNetworkActivity();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h1 className="mb-2 text-3xl font-bold">Trip Planner Agent Network</h1>
                <p className="text-muted-foreground mx-auto max-w-2xl">
                    Experience multi-agent orchestration with a comprehensive trip planning
                    assistant. The routing agent coordinates specialized agents, workflows, and
                    tools to help you plan your perfect vacation.
                </p>
            </div>

            {/* Main Layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Conversation Panel - Takes 2/3 width on large screens */}
                <div className="lg:col-span-2">
                    <Card className="flex h-[700px] flex-col">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <span>Trip Planner Chat</span>
                                    <Badge variant={useNetworkMode ? "default" : "secondary"}>
                                        {useNetworkMode ? "Network Mode" : "Direct Mode"}
                                    </Badge>
                                </CardTitle>
                                <CardDescription>
                                    Ask about destinations, flights, hotels, activities, or request
                                    a complete trip plan
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setUseNetworkMode(!useNetworkMode)}
                                >
                                    {useNetworkMode ? "Use Direct" : "Use Network"}
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleClear}>
                                    Clear
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="flex flex-1 flex-col overflow-hidden">
                            {/* Messages */}
                            <div
                                ref={chatContainerRef}
                                className="flex-1 space-y-4 overflow-y-auto pr-2"
                            >
                                {messages.length === 0 ? (
                                    <div className="text-muted-foreground py-8 text-center">
                                        <p className="mb-4 text-lg">
                                            Welcome to the Trip Planner Agent Network!
                                        </p>
                                        <p className="mb-6 text-sm">
                                            Try asking about a destination or request a complete
                                            trip plan.
                                        </p>
                                        <div className="mx-auto max-w-xl space-y-4">
                                            {examplePrompts.map((category) => (
                                                <div key={category.category}>
                                                    <p className="mb-2 text-xs font-medium tracking-wide uppercase">
                                                        {category.category}
                                                    </p>
                                                    <div className="flex flex-wrap justify-center gap-2">
                                                        {category.prompts
                                                            .slice(0, 2)
                                                            .map((prompt) => (
                                                                <Button
                                                                    key={prompt}
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-auto py-2 text-xs whitespace-normal"
                                                                    onClick={() => setInput(prompt)}
                                                                >
                                                                    {prompt}
                                                                </Button>
                                                            ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    messages.map((msg, i) => (
                                        <div
                                            key={i}
                                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                        >
                                            <div
                                                className={`max-w-[85%] rounded-lg px-4 py-2 ${
                                                    msg.role === "user"
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-muted"
                                                }`}
                                            >
                                                <p className="text-sm whitespace-pre-wrap">
                                                    {msg.content}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}

                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-muted rounded-lg px-4 py-2">
                                            <div className="flex items-center gap-2">
                                                <div className="flex space-x-1">
                                                    <div className="bg-foreground/50 h-2 w-2 animate-bounce rounded-full [animation-delay:-0.3s]" />
                                                    <div className="bg-foreground/50 h-2 w-2 animate-bounce rounded-full [animation-delay:-0.15s]" />
                                                    <div className="bg-foreground/50 h-2 w-2 animate-bounce rounded-full" />
                                                </div>
                                                <span className="text-muted-foreground text-xs">
                                                    {currentStatus || "Thinking..."}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Pending Approval Card */}
                            {pendingApproval && (
                                <Card className="mb-4 border-yellow-500">
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-sm">
                                            Budget Approval Required
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-2">
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => handleApproval(true)}>
                                                Approve Budget
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    handleApproval(false, "Find cheaper options")
                                                }
                                            >
                                                Find Cheaper Options
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Input */}
                            <div className="mt-4 flex gap-2">
                                <Input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask about destinations, plan a trip..."
                                    onKeyDown={(e) =>
                                        e.key === "Enter" && !e.shiftKey && handleSend()
                                    }
                                    disabled={isLoading}
                                />
                                <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
                                    {isLoading ? "..." : "Send"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Network Activity Panel - Takes 1/3 width on large screens */}
                <div className="space-y-4">
                    {/* Network Status Card */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg">Network Activity</CardTitle>
                            <CardDescription>
                                See which agents, workflows, and tools are being used
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Active Status */}
                            {currentStatus && (
                                <div className="bg-primary/10 rounded-lg p-3">
                                    <p className="text-primary text-sm font-medium">
                                        {currentStatus}
                                    </p>
                                </div>
                            )}

                            {/* Agents */}
                            <div>
                                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                                    Agents
                                </p>
                                <div className="space-y-1">
                                    {networkAgents.map((agent) => (
                                        <div
                                            key={agent.id}
                                            className={`flex items-center gap-2 rounded p-2 text-sm ${
                                                activeAgents.includes(agent.id)
                                                    ? "bg-green-100 dark:bg-green-900/30"
                                                    : "bg-muted/50"
                                            }`}
                                        >
                                            <span>{agent.icon}</span>
                                            <span>{agent.name}</span>
                                            {activeAgents.includes(agent.id) && (
                                                <Badge
                                                    variant="default"
                                                    className="ml-auto bg-green-500 text-xs"
                                                >
                                                    Active
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Workflows */}
                            <div>
                                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                                    Workflows
                                </p>
                                <div className="space-y-1">
                                    {networkWorkflows.map((workflow) => (
                                        <div
                                            key={workflow.id}
                                            className={`rounded p-2 text-sm ${
                                                activeWorkflows.includes(workflow.id)
                                                    ? "bg-blue-100 dark:bg-blue-900/30"
                                                    : "bg-muted/50"
                                            }`}
                                        >
                                            <span>{workflow.name}</span>
                                            {activeWorkflows.includes(workflow.id) && (
                                                <Badge
                                                    variant="default"
                                                    className="ml-2 bg-blue-500 text-xs"
                                                >
                                                    Running
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Tools */}
                            <div>
                                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                                    Tools
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {networkTools.map((tool) => (
                                        <Badge
                                            key={tool.id}
                                            variant={
                                                activeTools.includes(tool.id) ||
                                                activeTools.includes(
                                                    tool.name.toLowerCase().replace(" ", "")
                                                )
                                                    ? "default"
                                                    : "secondary"
                                            }
                                            className="gap-1"
                                        >
                                            <span>{tool.icon}</span>
                                            <span>{tool.name}</span>
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Trip Summary Card */}
                    {tripSummary && (
                        <Card className="border-green-500">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <span>🎉</span> Trip Confirmed
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <p className="font-medium">{tripSummary.destination}</p>
                                    {tripSummary.dates && (
                                        <p className="text-muted-foreground text-sm">
                                            {tripSummary.dates}
                                        </p>
                                    )}
                                    {tripSummary.totalCost && (
                                        <p className="text-lg font-bold">
                                            ${tripSummary.totalCost.toLocaleString()}
                                        </p>
                                    )}
                                    {tripSummary.breakdown && (
                                        <div className="text-muted-foreground space-y-1 text-xs">
                                            {tripSummary.breakdown.transport && (
                                                <p>Transport: ${tripSummary.breakdown.transport}</p>
                                            )}
                                            {tripSummary.breakdown.accommodation && (
                                                <p>
                                                    Accommodation: $
                                                    {tripSummary.breakdown.accommodation}
                                                </p>
                                            )}
                                            {tripSummary.breakdown.activities && (
                                                <p>
                                                    Activities: ${tripSummary.breakdown.activities}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    {tripSummary.bookingReference && (
                                        <Badge variant="outline" className="mt-2">
                                            Ref: {tripSummary.bookingReference}
                                        </Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Event Log */}
                    <Collapsible>
                        <Card>
                            <CollapsibleTrigger className="w-full">
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex items-center justify-between text-lg">
                                        <span>Event Log</span>
                                        <Badge variant="secondary">{networkEvents.length}</Badge>
                                    </CardTitle>
                                </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <CardContent>
                                    <div className="max-h-48 space-y-1 overflow-y-auto">
                                        {networkEvents.length === 0 ? (
                                            <p className="text-muted-foreground text-sm">
                                                No events yet
                                            </p>
                                        ) : (
                                            networkEvents.slice(-20).map((event, i) => (
                                                <div
                                                    key={i}
                                                    className="bg-muted/50 rounded px-2 py-1 font-mono text-xs"
                                                >
                                                    {event.type}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </CollapsibleContent>
                        </Card>
                    </Collapsible>
                </div>
            </div>

            {/* Educational Content */}
            <Card>
                <CardHeader>
                    <CardTitle>How Agent Networks Work</CardTitle>
                    <CardDescription>
                        Understanding multi-agent orchestration in Mastra
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="overview">
                        <TabsList>
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="agents">Agents</TabsTrigger>
                            <TabsTrigger value="workflows">Workflows</TabsTrigger>
                            <TabsTrigger value="memory">Memory</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="mt-4 space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <h4 className="mb-2 font-medium">What is an Agent Network?</h4>
                                    <p className="text-muted-foreground text-sm">
                                        An Agent Network coordinates multiple specialized agents,
                                        workflows, and tools under a single routing agent. The
                                        router uses LLM reasoning to interpret requests and delegate
                                        to the right components.
                                    </p>
                                </div>
                                <div>
                                    <h4 className="mb-2 font-medium">Why Use Networks?</h4>
                                    <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                                        <li>Complex tasks requiring multiple specializations</li>
                                        <li>Dynamic routing based on user intent</li>
                                        <li>Parallel execution for efficiency</li>
                                        <li>Human-in-the-loop for important decisions</li>
                                    </ul>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="agents" className="mt-4">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {networkAgents.map((agent) => (
                                    <div key={agent.id} className="bg-muted/50 rounded-lg p-3">
                                        <div className="mb-1 flex items-center gap-2">
                                            <span className="text-xl">{agent.icon}</span>
                                            <span className="font-medium">{agent.name}</span>
                                        </div>
                                        <p className="text-muted-foreground text-xs">
                                            {agent.description}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>

                        <TabsContent value="workflows" className="mt-4 space-y-4">
                            {networkWorkflows.map((workflow) => (
                                <div key={workflow.id} className="bg-muted/50 rounded-lg p-4">
                                    <h4 className="mb-1 font-medium">{workflow.name}</h4>
                                    <p className="text-muted-foreground text-sm">
                                        {workflow.description}
                                    </p>
                                </div>
                            ))}
                        </TabsContent>

                        <TabsContent value="memory" className="mt-4 space-y-4">
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="bg-muted/50 rounded-lg p-4">
                                    <h4 className="mb-2 font-medium">Message History</h4>
                                    <p className="text-muted-foreground text-sm">
                                        Remembers the last 15 messages for conversation context
                                    </p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-4">
                                    <h4 className="mb-2 font-medium">Working Memory</h4>
                                    <p className="text-muted-foreground text-sm">
                                        Stores your travel preferences, dates, and budget
                                    </p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-4">
                                    <h4 className="mb-2 font-medium">Semantic Recall</h4>
                                    <p className="text-muted-foreground text-sm">
                                        Finds relevant past conversations by meaning
                                    </p>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
