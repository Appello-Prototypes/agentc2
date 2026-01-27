import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";
import { CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const meta = {
    title: "Components/Badge",
    component: Badge,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"],
    argTypes: {
        variant: {
            control: "select",
            options: ["default", "secondary", "destructive", "outline", "ghost", "link"]
        }
    }
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        children: "Badge",
        variant: "default"
    }
};

export const Secondary: Story = {
    args: {
        children: "Secondary",
        variant: "secondary"
    }
};

export const Destructive: Story = {
    args: {
        children: "Destructive",
        variant: "destructive"
    }
};

export const Outline: Story = {
    args: {
        children: "Outline",
        variant: "outline"
    }
};

export const Ghost: Story = {
    args: {
        children: "Ghost",
        variant: "ghost"
    }
};

export const WithIcon: Story = {
    args: {
        children: (
            <>
                <HugeiconsIcon icon={CheckmarkCircle01Icon} data-icon="inline-start" />
                Verified
            </>
        ),
        variant: "default"
    }
};

export const AllVariants: Story = {
    render: () => (
        <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="ghost">Ghost</Badge>
            <Badge variant="link">Link</Badge>
        </div>
    )
};

export const StatusBadges: Story = {
    render: () => (
        <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} data-icon="inline-start" />
                Active
            </Badge>
            <Badge variant="secondary">Pending</Badge>
            <Badge variant="destructive">Error</Badge>
            <Badge variant="outline">Draft</Badge>
        </div>
    )
};
