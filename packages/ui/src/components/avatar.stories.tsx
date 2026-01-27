import type { Meta, StoryObj } from "@storybook/react";
import {
    Avatar,
    AvatarBadge,
    AvatarFallback,
    AvatarGroup,
    AvatarGroupCount,
    AvatarImage
} from "./avatar";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserIcon } from "@hugeicons/core-free-icons";

const meta = {
    title: "Components/Avatar",
    component: Avatar,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"]
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="User" />
            <AvatarFallback>CN</AvatarFallback>
        </Avatar>
    )
};

export const Fallback: Story = {
    render: () => (
        <Avatar>
            <AvatarImage src="" alt="User" />
            <AvatarFallback>JD</AvatarFallback>
        </Avatar>
    )
};

export const WithIcon: Story = {
    render: () => (
        <Avatar>
            <AvatarFallback>
                <HugeiconsIcon icon={UserIcon} />
            </AvatarFallback>
        </Avatar>
    )
};

export const Small: Story = {
    render: () => (
        <Avatar size="sm">
            <AvatarImage src="https://github.com/shadcn.png" alt="User" />
            <AvatarFallback>CN</AvatarFallback>
        </Avatar>
    )
};

export const Large: Story = {
    render: () => (
        <Avatar size="lg">
            <AvatarImage src="https://github.com/shadcn.png" alt="User" />
            <AvatarFallback>CN</AvatarFallback>
        </Avatar>
    )
};

export const Sizes: Story = {
    render: () => (
        <div className="flex items-center gap-4">
            <Avatar size="sm">
                <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                <AvatarFallback>SM</AvatarFallback>
            </Avatar>
            <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                <AvatarFallback>MD</AvatarFallback>
            </Avatar>
            <Avatar size="lg">
                <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                <AvatarFallback>LG</AvatarFallback>
            </Avatar>
        </div>
    )
};

export const WithBadge: Story = {
    render: () => (
        <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="User" />
            <AvatarFallback>CN</AvatarFallback>
            <AvatarBadge />
        </Avatar>
    )
};

export const Group: Story = {
    render: () => (
        <AvatarGroup>
            <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" alt="User 1" />
                <AvatarFallback>U1</AvatarFallback>
            </Avatar>
            <Avatar>
                <AvatarImage src="https://github.com/vercel.png" alt="User 2" />
                <AvatarFallback>U2</AvatarFallback>
            </Avatar>
            <Avatar>
                <AvatarImage src="https://github.com/nextjs.png" alt="User 3" />
                <AvatarFallback>U3</AvatarFallback>
            </Avatar>
        </AvatarGroup>
    )
};

export const GroupWithCount: Story = {
    render: () => (
        <AvatarGroup>
            <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" alt="User 1" />
                <AvatarFallback>U1</AvatarFallback>
            </Avatar>
            <Avatar>
                <AvatarImage src="https://github.com/vercel.png" alt="User 2" />
                <AvatarFallback>U2</AvatarFallback>
            </Avatar>
            <Avatar>
                <AvatarImage src="https://github.com/nextjs.png" alt="User 3" />
                <AvatarFallback>U3</AvatarFallback>
            </Avatar>
            <AvatarGroupCount>+5</AvatarGroupCount>
        </AvatarGroup>
    )
};

export const AllVariants: Story = {
    render: () => (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium">With Images</h4>
                <div className="flex items-center gap-2">
                    <Avatar size="sm">
                        <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                        <AvatarFallback>CN</AvatarFallback>
                    </Avatar>
                    <Avatar>
                        <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                        <AvatarFallback>CN</AvatarFallback>
                    </Avatar>
                    <Avatar size="lg">
                        <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                        <AvatarFallback>CN</AvatarFallback>
                    </Avatar>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium">With Fallback</h4>
                <div className="flex items-center gap-2">
                    <Avatar size="sm">
                        <AvatarFallback>SM</AvatarFallback>
                    </Avatar>
                    <Avatar>
                        <AvatarFallback>MD</AvatarFallback>
                    </Avatar>
                    <Avatar size="lg">
                        <AvatarFallback>LG</AvatarFallback>
                    </Avatar>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium">With Badge</h4>
                <div className="flex items-center gap-2">
                    <Avatar size="sm">
                        <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                        <AvatarFallback>CN</AvatarFallback>
                        <AvatarBadge />
                    </Avatar>
                    <Avatar>
                        <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                        <AvatarFallback>CN</AvatarFallback>
                        <AvatarBadge />
                    </Avatar>
                    <Avatar size="lg">
                        <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                        <AvatarFallback>CN</AvatarFallback>
                        <AvatarBadge />
                    </Avatar>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium">Avatar Group</h4>
                <AvatarGroup>
                    <Avatar>
                        <AvatarImage src="https://github.com/shadcn.png" alt="User 1" />
                        <AvatarFallback>U1</AvatarFallback>
                    </Avatar>
                    <Avatar>
                        <AvatarImage src="https://github.com/vercel.png" alt="User 2" />
                        <AvatarFallback>U2</AvatarFallback>
                    </Avatar>
                    <Avatar>
                        <AvatarImage src="https://github.com/nextjs.png" alt="User 3" />
                        <AvatarFallback>U3</AvatarFallback>
                    </Avatar>
                    <AvatarGroupCount>+5</AvatarGroupCount>
                </AvatarGroup>
            </div>
        </div>
    )
};
