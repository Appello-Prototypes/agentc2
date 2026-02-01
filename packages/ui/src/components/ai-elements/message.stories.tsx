import type { Meta, StoryObj } from "@storybook/react";
import {
    Message,
    MessageContent,
    MessageResponse,
    MessageActions,
    MessageAction,
    MessageToolbar
} from "./message";
import { CopyIcon, RefreshCwIcon, ThumbsUpIcon, ThumbsDownIcon } from "lucide-react";

const meta: Meta<typeof Message> = {
    title: "AI Elements/Message",
    component: Message,
    parameters: {
        layout: "padded"
    }
};

export default meta;
type Story = StoryObj<typeof Message>;

export const UserMessage: Story = {
    render: () => (
        <Message from="user">
            <MessageContent>
                <p>Hello! Can you help me understand React hooks?</p>
            </MessageContent>
        </Message>
    )
};

export const AssistantMessage: Story = {
    render: () => (
        <Message from="assistant">
            <MessageContent>
                <MessageResponse>
                    {`React Hooks are functions that let you use state and other React features in functional components.

The most common hooks are:
- **useState**: For managing local state
- **useEffect**: For side effects like data fetching
- **useContext**: For consuming context values
- **useRef**: For mutable values that persist across renders`}
                </MessageResponse>
            </MessageContent>
        </Message>
    )
};

export const WithActions: Story = {
    render: () => (
        <Message from="assistant">
            <MessageContent>
                <MessageResponse>
                    Here is a simple example of a React component using hooks.
                </MessageResponse>
            </MessageContent>
            <MessageActions>
                <MessageAction tooltip="Copy" onClick={() => console.log("Copy clicked")}>
                    <CopyIcon className="size-3" />
                </MessageAction>
                <MessageAction
                    tooltip="Regenerate"
                    onClick={() => console.log("Regenerate clicked")}
                >
                    <RefreshCwIcon className="size-3" />
                </MessageAction>
            </MessageActions>
        </Message>
    )
};

export const WithToolbar: Story = {
    render: () => (
        <Message from="assistant">
            <MessageContent>
                <MessageResponse>
                    This is a helpful response that the user can rate using the toolbar below.
                </MessageResponse>
            </MessageContent>
            <MessageToolbar>
                <MessageActions>
                    <MessageAction tooltip="Copy">
                        <CopyIcon className="size-3" />
                    </MessageAction>
                    <MessageAction tooltip="Regenerate">
                        <RefreshCwIcon className="size-3" />
                    </MessageAction>
                </MessageActions>
                <MessageActions>
                    <MessageAction tooltip="Helpful">
                        <ThumbsUpIcon className="size-3" />
                    </MessageAction>
                    <MessageAction tooltip="Not helpful">
                        <ThumbsDownIcon className="size-3" />
                    </MessageAction>
                </MessageActions>
            </MessageToolbar>
        </Message>
    )
};

export const Conversation: Story = {
    render: () => (
        <div className="space-y-4">
            <Message from="user">
                <MessageContent>
                    <p>What is the best way to handle errors in async functions?</p>
                </MessageContent>
            </Message>
            <Message from="assistant">
                <MessageContent>
                    <MessageResponse>
                        {`There are several approaches to handle errors in async functions:

1. **try/catch blocks**: Wrap your async code in try/catch
2. **Promise .catch()**: Chain a catch handler
3. **Error boundaries**: For React components`}
                    </MessageResponse>
                </MessageContent>
            </Message>
        </div>
    )
};
