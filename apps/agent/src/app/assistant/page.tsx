"use client";

import { useEffect, useMemo, useState } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useSession } from "@repo/auth/client";
import type { ToolUIPart } from "ai";
import {
    Badge,
    Button,
    Conversation,
    ConversationContent,
    ConversationEmptyState,
    ConversationScrollButton,
    Loader,
    Message,
    MessageAction,
    MessageActions,
    MessageContent,
    MessageResponse,
    PromptInput,
    PromptInputBody,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTextarea,
    Tool,
    ToolContent,
    ToolHeader,
    ToolInput,
    ToolOutput
} from "@repo/ui";
import { CopyIcon, MessageSquareIcon, RefreshCwIcon } from "lucide-react";
import { getApiBase } from "@/lib/utils";

const completionToolIds = new Set([
    "agent-create",
    "workflow-create",
    "network-create",
    "trigger-unified-create"
]);

export default function WorkspaceAssistantPage() {
    const { data: session } = useSession();
    const userId = session?.user?.id;

    const [threadId, setThreadId] = useState<string>(() => `assistant-${Date.now()}`);
    const [input, setInput] = useState("");
    const [onboardingCompleted, setOnboardingCompleted] = useState(false);

    useEffect(() => {
        if (userId) {
            const timeoutId = setTimeout(() => {
                setThreadId(`assistant-${userId}-${Date.now()}`);
            }, 0);
            return () => clearTimeout(timeoutId);
        }
        return;
    }, [userId]);

    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: `${getApiBase()}/api/agents/workspace-concierge/chat`,
                body: {
                    threadId,
                    requestContext: {
                        userId,
                        mode: "workspace"
                    }
                }
            }),
        [threadId, userId]
    );

    const { messages, setMessages, sendMessage, status, regenerate } = useChat({
        transport
    });

    useEffect(() => {
        if (onboardingCompleted) return;

        const hasCompletion = messages.some((message) =>
            message.parts?.some((part) => {
                if (!part.type?.startsWith("tool-")) {
                    return false;
                }
                const toolPart = part as unknown as ToolUIPart;
                const toolName = toolPart.type?.replace("tool-", "") || "";
                if (!completionToolIds.has(toolName)) {
                    return false;
                }
                return Boolean(
                    toolPart.output && (toolPart.output as { success?: boolean }).success
                );
            })
        );

        if (hasCompletion) {
            const timeoutId = setTimeout(() => {
                setOnboardingCompleted(true);
                void fetch(`${getApiBase()}/api/onboarding/complete`, { method: "POST" });
            }, 0);
            return () => clearTimeout(timeoutId);
        }
        return;
    }, [messages, onboardingCompleted]);

    const handleSubmit = async () => {
        if (!input.trim()) return;
        await sendMessage({ text: input });
        setInput("");
    };

    const handleNewConversation = () => {
        setMessages([]);
        setThreadId(`assistant-${userId || "anonymous"}-${Date.now()}`);
    };

    const handleCopyMessage = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="container mx-auto flex h-[calc(100vh-4rem)] flex-col gap-4 py-6">
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h1 className="text-lg font-semibold">Workspace AI</h1>
                    <p className="text-muted-foreground text-sm">
                        Describe what should happen and when. I will build the system for you.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {onboardingCompleted && <Badge variant="outline">Onboarding complete</Badge>}
                    <Button variant="outline" size="sm" onClick={handleNewConversation}>
                        New conversation
                    </Button>
                </div>
            </div>

            <div className="min-h-0 flex-1">
                <Conversation className="h-full min-h-0 overflow-hidden">
                    <ConversationContent>
                        {messages.length === 0 ? (
                            <ConversationEmptyState
                                icon={<MessageSquareIcon className="size-10" />}
                                title="Start with when and what"
                                description="Tell me when it should happen and what outcome you want."
                            />
                        ) : (
                            messages.map((message, messageIndex) => (
                                <div key={message.id} className="space-y-2">
                                    {message.parts?.map((part, i) => {
                                        if (part.type === "text") {
                                            const isLastAssistantMessage =
                                                message.role === "assistant" &&
                                                messageIndex === messages.length - 1;

                                            return (
                                                <Message
                                                    key={`${message.id}-${i}`}
                                                    from={message.role}
                                                >
                                                    <MessageContent>
                                                        <MessageResponse>
                                                            {part.text}
                                                        </MessageResponse>
                                                    </MessageContent>
                                                    {isLastAssistantMessage &&
                                                        status === "ready" && (
                                                            <MessageActions>
                                                                <MessageAction
                                                                    tooltip="Copy"
                                                                    onClick={() =>
                                                                        handleCopyMessage(part.text)
                                                                    }
                                                                >
                                                                    <CopyIcon className="size-3" />
                                                                </MessageAction>
                                                                <MessageAction
                                                                    tooltip="Regenerate"
                                                                    onClick={() => regenerate()}
                                                                >
                                                                    <RefreshCwIcon className="size-3" />
                                                                </MessageAction>
                                                            </MessageActions>
                                                        )}
                                                </Message>
                                            );
                                        }

                                        if (part.type?.startsWith("tool-")) {
                                            const toolPart = part as unknown as ToolUIPart;
                                            const toolName =
                                                toolPart.type?.replace("tool-", "") || "";

                                            return (
                                                <Tool
                                                    key={`${message.id}-${i}`}
                                                    defaultOpen={toolPart.state === "output-error"}
                                                >
                                                    <ToolHeader
                                                        type={`tool-${toolName}`}
                                                        state={toolPart.state || "output-available"}
                                                    />
                                                    <ToolContent>
                                                        <ToolInput input={toolPart.input} />
                                                        <ToolOutput
                                                            output={
                                                                toolPart.output
                                                                    ? JSON.stringify(
                                                                          toolPart.output,
                                                                          null,
                                                                          2
                                                                      )
                                                                    : undefined
                                                            }
                                                            errorText={toolPart.errorText}
                                                        />
                                                    </ToolContent>
                                                </Tool>
                                            );
                                        }

                                        return null;
                                    })}
                                </div>
                            ))
                        )}

                        {status === "submitted" && <Loader />}
                    </ConversationContent>
                    <ConversationScrollButton />
                </Conversation>
            </div>

            <PromptInput onSubmit={handleSubmit} className="shrink-0 border-t pt-4">
                <PromptInputBody>
                    <PromptInputTextarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Describe what happens and what outcome you want..."
                        disabled={status !== "ready"}
                    />
                </PromptInputBody>
                <PromptInputFooter>
                    <PromptInputSubmit status={status} disabled={!input.trim()} />
                </PromptInputFooter>
            </PromptInput>
        </div>
    );
}
