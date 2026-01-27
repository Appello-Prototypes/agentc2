import type { Meta, StoryObj } from "@storybook/react";
import { Textarea } from "./textarea";

const meta = {
    title: "Components/Textarea",
    component: Textarea,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"],
    argTypes: {
        disabled: {
            control: "boolean"
        },
        placeholder: {
            control: "text"
        }
    }
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        placeholder: "Enter text..."
    }
};

export const WithValue: Story = {
    args: {
        defaultValue:
            "This is a multi-line text area.\nIt can contain multiple lines of text.\nLike this!"
    }
};

export const Disabled: Story = {
    args: {
        placeholder: "Disabled textarea",
        disabled: true
    }
};

export const Invalid: Story = {
    args: {
        defaultValue: "This content is invalid",
        "aria-invalid": true
    }
};

export const WithCustomHeight: Story = {
    args: {
        placeholder: "Custom height textarea",
        className: "min-h-32"
    }
};

export const States: Story = {
    render: () => (
        <div className="flex w-[350px] flex-col gap-4">
            <Textarea placeholder="Default state" />
            <Textarea placeholder="Disabled state" disabled />
            <Textarea placeholder="Invalid state" aria-invalid />
            <Textarea defaultValue="With value and custom height" className="min-h-24" />
        </div>
    )
};
