import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton } from "./skeleton";

const meta = {
    title: "Components/Skeleton",
    component: Skeleton,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"]
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => <Skeleton className="h-12 w-[250px]" />
};

export const Circle: Story = {
    render: () => <Skeleton className="size-12 rounded-full" />
};

export const Text: Story = {
    render: () => (
        <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
        </div>
    )
};

export const Card: Story = {
    render: () => (
        <div className="flex w-[350px] flex-col gap-3">
            <Skeleton className="h-[125px] w-full rounded-xl" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
            </div>
        </div>
    )
};

export const Avatar: Story = {
    render: () => (
        <div className="flex items-center gap-4">
            <Skeleton className="size-12 rounded-full" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
            </div>
        </div>
    )
};

export const List: Story = {
    render: () => (
        <div className="w-[350px] space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                    </div>
                </div>
            ))}
        </div>
    )
};

export const Table: Story = {
    render: () => (
        <div className="w-[600px] space-y-2">
            <Skeleton className="h-8 w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
            ))}
        </div>
    )
};

export const ProfileCard: Story = {
    render: () => (
        <div className="flex w-[350px] flex-col gap-4 rounded-lg border p-4">
            <div className="flex items-center gap-4">
                <Skeleton className="size-16 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                </div>
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="flex gap-2">
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="h-9 flex-1" />
            </div>
        </div>
    )
};

export const DashboardCards: Story = {
    render: () => (
        <div className="grid w-[600px] grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                    <Skeleton className="h-20 w-full rounded-lg" />
                    <Skeleton className="h-4 w-2/3" />
                </div>
            ))}
        </div>
    )
};
