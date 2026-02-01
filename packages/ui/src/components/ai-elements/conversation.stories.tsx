import type { Meta, StoryObj } from "@storybook/react";
import {
    Conversation,
    ConversationContent,
    ConversationEmptyState,
    ConversationScrollButton
} from "./conversation";
import { Message, MessageContent, MessageResponse } from "./message";

const meta: Meta<typeof Conversation> = {
    title: "AI Elements/Conversation",
    component: Conversation,
    parameters: {
        layout: "fullscreen"
    },
    decorators: [
        (Story) => (
            <div style={{ height: "500px", display: "flex", flexDirection: "column" }}>
                <Story />
            </div>
        )
    ]
};

export default meta;
type Story = StoryObj<typeof Conversation>;

export const Default: Story = {
    render: () => (
        <Conversation>
            <ConversationContent>
                <Message from="user">
                    <MessageContent>
                        <p>Hello, how can you help me today?</p>
                    </MessageContent>
                </Message>
                <Message from="assistant">
                    <MessageContent>
                        <MessageResponse>
                            I&apos;m here to help! I can assist you with questions, tasks, and
                            information. What would you like to know?
                        </MessageResponse>
                    </MessageContent>
                </Message>
                <Message from="user">
                    <MessageContent>
                        <p>Can you explain what TypeScript is?</p>
                    </MessageContent>
                </Message>
                <Message from="assistant">
                    <MessageContent>
                        <MessageResponse>
                            **TypeScript** is a statically typed superset of JavaScript developed by
                            Microsoft. It adds optional type annotations and other features to help
                            catch errors during development. Key benefits include: - **Type
                            Safety**: Catch errors before runtime - **Better IDE Support**: Improved
                            autocomplete and refactoring - **Scalability**: Easier to maintain large
                            codebases
                        </MessageResponse>
                    </MessageContent>
                </Message>
            </ConversationContent>
            <ConversationScrollButton />
        </Conversation>
    )
};

export const EmptyState: Story = {
    render: () => (
        <Conversation>
            <ConversationContent>
                <ConversationEmptyState
                    title="Start a conversation"
                    description="Ask me anything and I'll do my best to help!"
                />
            </ConversationContent>
        </Conversation>
    )
};

export const WithCustomEmptyState: Story = {
    render: () => (
        <Conversation>
            <ConversationContent>
                <ConversationEmptyState>
                    <div className="space-y-4 text-center">
                        <div className="text-4xl">🤖</div>
                        <h3 className="text-lg font-semibold">Welcome to AI Assistant</h3>
                        <p className="text-muted-foreground text-sm">
                            I can help you with coding, writing, analysis, and more.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            <button className="bg-secondary rounded-full px-3 py-1 text-sm">
                                Write code
                            </button>
                            <button className="bg-secondary rounded-full px-3 py-1 text-sm">
                                Explain concepts
                            </button>
                            <button className="bg-secondary rounded-full px-3 py-1 text-sm">
                                Debug issues
                            </button>
                        </div>
                    </div>
                </ConversationEmptyState>
            </ConversationContent>
        </Conversation>
    )
};
