import type { Meta, StoryObj } from "@storybook/react";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "./tool";

const meta: Meta<typeof Tool> = {
    title: "AI Elements/Tool",
    component: Tool,
    parameters: {
        layout: "padded"
    }
};

export default meta;
type Story = StoryObj<typeof Tool>;

export const Running: Story = {
    render: () => (
        <Tool defaultOpen>
            <ToolHeader type="tool-search" toolName="Web Search" state="input-available" />
            <ToolContent>
                <ToolInput input={{ query: "latest React 19 features", limit: 5 }} />
            </ToolContent>
        </Tool>
    )
};

export const Completed: Story = {
    render: () => (
        <Tool defaultOpen>
            <ToolHeader type="tool-calculator" toolName="Calculator" state="output-available" />
            <ToolContent>
                <ToolInput input={{ expression: "2 + 2 * 3" }} />
                <ToolOutput output="8" />
            </ToolContent>
        </Tool>
    )
};

export const WithError: Story = {
    render: () => (
        <Tool defaultOpen>
            <ToolHeader type="tool-api" toolName="API Call" state="output-error" />
            <ToolContent>
                <ToolInput input={{ endpoint: "/api/users", method: "GET" }} />
                <ToolOutput errorText="Connection timeout: Unable to reach the server" />
            </ToolContent>
        </Tool>
    )
};

export const Pending: Story = {
    render: () => (
        <Tool>
            <ToolHeader type="tool-database" toolName="Database Query" state="input-streaming" />
            <ToolContent>
                <ToolInput input={{ table: "users", filter: { active: true } }} />
            </ToolContent>
        </Tool>
    )
};

export const AwaitingApproval: Story = {
    render: () => (
        <Tool defaultOpen>
            <ToolHeader type="tool-delete" toolName="Delete Record" state="approval-requested" />
            <ToolContent>
                <ToolInput input={{ recordId: "user-123", confirm: true }} />
            </ToolContent>
        </Tool>
    )
};

export const MultipleTool: Story = {
    render: () => (
        <div className="space-y-3">
            <Tool>
                <ToolHeader type="tool-search" toolName="Web Search" state="output-available" />
                <ToolContent>
                    <ToolInput input={{ query: "TypeScript generics" }} />
                    <ToolOutput
                        output={JSON.stringify(
                            {
                                results: [
                                    { title: "TypeScript Handbook", url: "https://..." },
                                    { title: "Advanced Types", url: "https://..." }
                                ]
                            },
                            null,
                            2
                        )}
                    />
                </ToolContent>
            </Tool>
            <Tool>
                <ToolHeader type="tool-code" toolName="Code Execution" state="output-available" />
                <ToolContent>
                    <ToolInput input={{ language: "typescript", code: "console.log('Hello')" }} />
                    <ToolOutput output="Hello" />
                </ToolContent>
            </Tool>
        </div>
    )
};
