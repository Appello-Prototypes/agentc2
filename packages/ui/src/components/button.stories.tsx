import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Settings02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const meta = {
    title: "Components/Button",
    component: Button,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"],
    argTypes: {
        variant: {
            control: "select",
            options: ["default", "outline", "secondary", "ghost", "destructive", "link"]
        },
        size: {
            control: "select",
            options: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"]
        },
        disabled: {
            control: "boolean"
        }
    }
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        children: "Button",
        variant: "default"
    }
};

export const Outline: Story = {
    args: {
        children: "Button",
        variant: "outline"
    }
};

export const Secondary: Story = {
    args: {
        children: "Button",
        variant: "secondary"
    }
};

export const Ghost: Story = {
    args: {
        children: "Button",
        variant: "ghost"
    }
};

export const Destructive: Story = {
    args: {
        children: "Delete",
        variant: "destructive"
    }
};

export const Link: Story = {
    args: {
        children: "Link Button",
        variant: "link"
    }
};

export const WithIcon: Story = {
    args: {
        children: (
            <>
                <HugeiconsIcon icon={Settings02Icon} data-icon="inline-start" />
                Settings
            </>
        ),
        variant: "default"
    }
};

export const IconOnly: Story = {
    args: {
        children: <HugeiconsIcon icon={Settings02Icon} />,
        size: "icon",
        variant: "outline"
    }
};

export const Sizes: Story = {
    render: () => (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <Button size="xs">Extra Small</Button>
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
            </div>
            <div className="flex items-center gap-2">
                <Button size="icon-xs" variant="outline">
                    <HugeiconsIcon icon={Settings02Icon} />
                </Button>
                <Button size="icon-sm" variant="outline">
                    <HugeiconsIcon icon={Settings02Icon} />
                </Button>
                <Button size="icon" variant="outline">
                    <HugeiconsIcon icon={Settings02Icon} />
                </Button>
                <Button size="icon-lg" variant="outline">
                    <HugeiconsIcon icon={Settings02Icon} />
                </Button>
            </div>
        </div>
    )
};

export const AllVariants: Story = {
    render: () => (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <Button variant="default">Default</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link</Button>
            </div>
        </div>
    )
};

export const Disabled: Story = {
    args: {
        children: "Disabled Button",
        disabled: true
    }
};
