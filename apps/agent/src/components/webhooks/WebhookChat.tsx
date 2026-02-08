import { useMemo, useState } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import {
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
    PromptInputTextarea
} from "@repo/ui";
import { CopyIcon, RefreshCwIcon, WebhookIcon } from "lucide-react";
import { getApiBase } from "@/lib/utils";

type WebhookChatProps = {
    webhooksCount: number;
    onRefresh: () => void | Promise<void>;
    showHeader?: boolean;
    headerTitle?: string;
    className?: string;
};

const pollForWebhookUpdate = async (
    startingCount: number,
    onRefresh: () => void | Promise<void>
) => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
            const response = await fetch(`${getApiBase()}/api/triggers?type=webhook`);
            const data = await response.json();
            if (data.success && Array.isArray(data.triggers)) {
                if (data.triggers.length > startingCount) {
                    await onRefresh();
                    return;
                }
            }
        } catch (error) {
            console.error("Failed to poll webhooks:", error);
        }
    }
    await onRefresh();
};

export default function WebhookChat({
    webhooksCount,
    onRefresh,
    showHeader = false,
    headerTitle = "Webhook Setup",
    className
}: WebhookChatProps) {
    const [input, setInput] = useState("");
    const [threadId, setThreadId] = useState(() => `webhook-wizard-${Date.now()}`);

    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: `${getApiBase()}/api/webhooks/chat`,
                body: { threadId }
            }),
        [threadId]
    );

    const { messages, setMessages, sendMessage, status, regenerate } = useChat({ transport });

    const handleSubmit = async () => {
        if (!input.trim()) return;
        const startingCount = webhooksCount;
        await sendMessage({ text: input });
        setInput("");
        void pollForWebhookUpdate(startingCount, onRefresh);
    };

    const handleNewConversation = () => {
        setMessages([]);
        setThreadId(`webhook-wizard-${Date.now()}`);
    };

    const handleCopyMessage = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const suggestions = [
        "Webhook from Zapier for new leads",
        "GitHub webhook for new issues",
        "Stripe webhook for payments",
        "HubSpot deal update webhook"
    ];

    const handleSuggestion = async (text: string) => {
        const startingCount = webhooksCount;
        setInput("");
        await sendMessage({ text });
        void pollForWebhookUpdate(startingCount, onRefresh);
    };

    return (
        <div className={`flex flex-col rounded-lg border ${className || ""}`}>
            {showHeader && (
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                    <span className="text-xs font-medium">{headerTitle}</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleNewConversation}
                        className="h-6 px-2 text-xs"
                    >
                        New
                    </Button>
                </div>
            )}

            <div className="min-h-0 flex-1">
                <Conversation className="h-full min-h-0 overflow-hidden">
                    <ConversationContent>
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center gap-4 px-3">
                                <ConversationEmptyState
                                    icon={<WebhookIcon className="size-7" />}
                                    title="Create a webhook"
                                    description="Describe what you need and I'll set it up."
                                />
                                <div className="grid w-full gap-1.5">
                                    {suggestions.map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => handleSuggestion(s)}
                                            disabled={status !== "ready"}
                                            className="border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground rounded-md border px-2.5 py-1.5 text-left text-[11px] transition-colors disabled:opacity-50"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            messages.map((message, messageIndex) => (
                                <div key={message.id} className="space-y-2">
                                    {message.parts?.map((part, i) => {
                                        if (part.type === "text") {
                                            const isLastAssistant =
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
                                                    {isLastAssistant && status === "ready" && (
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
                                        return null;
                                    })}
                                </div>
                            ))
                        )}

                        {(status === "submitted" || status === "streaming") && <Loader />}
                    </ConversationContent>
                    <ConversationScrollButton />
                </Conversation>
            </div>

            <PromptInput onSubmit={handleSubmit} className="shrink-0 border-t p-3">
                <PromptInputBody>
                    <PromptInputTextarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Describe the webhook you need..."
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
