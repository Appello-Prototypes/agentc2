import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "./label";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const meta = {
    title: "Components/Label",
    component: Label,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"]
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        children: "Label Text"
    }
};

export const WithInput: Story = {
    render: () => (
        <div className="flex w-[350px] flex-col gap-2">
            <Label htmlFor="email">Email Address</Label>
            <Input type="email" id="email" placeholder="Enter your email" />
        </div>
    )
};

export const WithTextarea: Story = {
    render: () => (
        <div className="flex w-[350px] flex-col gap-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" placeholder="Enter your message" />
        </div>
    )
};

export const WithIcon: Story = {
    render: () => (
        <div className="flex w-[350px] flex-col gap-2">
            <Label htmlFor="verified">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
                Verified Email
            </Label>
            <Input type="email" id="verified" placeholder="verified@example.com" />
        </div>
    )
};

export const Required: Story = {
    render: () => (
        <div className="flex w-[350px] flex-col gap-2">
            <Label htmlFor="required">
                Username
                <span className="text-destructive">*</span>
            </Label>
            <Input type="text" id="required" placeholder="Enter username" required />
        </div>
    )
};

export const Disabled: Story = {
    render: () => (
        <div className="group flex w-[350px] flex-col gap-2" data-disabled="true">
            <Label htmlFor="disabled">Disabled Field</Label>
            <Input type="text" id="disabled" placeholder="Disabled" disabled />
        </div>
    )
};

export const FormExample: Story = {
    render: () => (
        <div className="flex w-[350px] flex-col gap-4">
            <div className="flex flex-col gap-2">
                <Label htmlFor="name">
                    Full Name
                    <span className="text-destructive">*</span>
                </Label>
                <Input type="text" id="name" placeholder="John Doe" />
            </div>
            <div className="flex flex-col gap-2">
                <Label htmlFor="email-form">Email Address</Label>
                <Input type="email" id="email-form" placeholder="john@example.com" />
            </div>
            <div className="flex flex-col gap-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" placeholder="Tell us about yourself..." />
            </div>
        </div>
    )
};
