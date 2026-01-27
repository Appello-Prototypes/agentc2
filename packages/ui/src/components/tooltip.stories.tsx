import type { Meta, StoryObj } from "@storybook/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { Button } from "./button";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon, Settings02Icon } from "@hugeicons/core-free-icons";

const meta = {
    title: "Components/Tooltip",
    component: Tooltip,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"]
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>Hover me</TooltipTrigger>
            <TooltipContent>
                <p>This is a tooltip</p>
            </TooltipContent>
        </Tooltip>
    )
};

export const Top: Story = {
    render: () => (
        <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>Top</TooltipTrigger>
            <TooltipContent side="top">
                <p>Tooltip on top</p>
            </TooltipContent>
        </Tooltip>
    )
};

export const Bottom: Story = {
    render: () => (
        <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>Bottom</TooltipTrigger>
            <TooltipContent side="bottom">
                <p>Tooltip on bottom</p>
            </TooltipContent>
        </Tooltip>
    )
};

export const Left: Story = {
    render: () => (
        <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>Left</TooltipTrigger>
            <TooltipContent side="left">
                <p>Tooltip on left</p>
            </TooltipContent>
        </Tooltip>
    )
};

export const Right: Story = {
    render: () => (
        <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>Right</TooltipTrigger>
            <TooltipContent side="right">
                <p>Tooltip on right</p>
            </TooltipContent>
        </Tooltip>
    )
};

export const WithIcon: Story = {
    render: () => (
        <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" />}>
                <HugeiconsIcon icon={InformationCircleIcon} />
            </TooltipTrigger>
            <TooltipContent>
                <p>Additional information about this feature</p>
            </TooltipContent>
        </Tooltip>
    )
};

export const LongContent: Story = {
    render: () => (
        <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>
                Hover for more info
            </TooltipTrigger>
            <TooltipContent>
                <p>
                    This is a longer tooltip with multiple lines of text to demonstrate how the
                    tooltip handles longer content.
                </p>
            </TooltipContent>
        </Tooltip>
    )
};

export const AllPositions: Story = {
    render: () => (
        <div className="flex flex-col items-center gap-8">
            <Tooltip>
                <TooltipTrigger render={<Button variant="outline" />}>Top</TooltipTrigger>
                <TooltipContent side="top">
                    <p>Tooltip on top</p>
                </TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-8">
                <Tooltip>
                    <TooltipTrigger render={<Button variant="outline" />}>Left</TooltipTrigger>
                    <TooltipContent side="left">
                        <p>Tooltip on left</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger render={<Button variant="outline" />}>Right</TooltipTrigger>
                    <TooltipContent side="right">
                        <p>Tooltip on right</p>
                    </TooltipContent>
                </Tooltip>
            </div>
            <Tooltip>
                <TooltipTrigger render={<Button variant="outline" />}>Bottom</TooltipTrigger>
                <TooltipContent side="bottom">
                    <p>Tooltip on bottom</p>
                </TooltipContent>
            </Tooltip>
        </div>
    )
};

export const IconButtons: Story = {
    render: () => (
        <div className="flex items-center gap-2">
            <Tooltip>
                <TooltipTrigger render={<Button variant="ghost" size="icon" />}>
                    <HugeiconsIcon icon={Settings02Icon} />
                </TooltipTrigger>
                <TooltipContent>
                    <p>Settings</p>
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger render={<Button variant="ghost" size="icon" />}>
                    <HugeiconsIcon icon={InformationCircleIcon} />
                </TooltipTrigger>
                <TooltipContent>
                    <p>Information</p>
                </TooltipContent>
            </Tooltip>
        </div>
    )
};

export const WithShortcut: Story = {
    render: () => (
        <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>Save</TooltipTrigger>
            <TooltipContent>
                <div className="flex items-center gap-2">
                    <span>Save document</span>
                    <kbd className="bg-background text-foreground rounded border px-1.5 py-0.5 text-[10px]">
                        ⌘S
                    </kbd>
                </div>
            </TooltipContent>
        </Tooltip>
    )
};
