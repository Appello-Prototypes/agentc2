import type { Meta, StoryObj } from "@storybook/react";
import { Loader, LoaderIcon } from "./loader";

const meta: Meta<typeof Loader> = {
    title: "AI Elements/Loader",
    component: Loader,
    parameters: {
        layout: "centered"
    }
};

export default meta;
type Story = StoryObj<typeof Loader>;

export const Default: Story = {
    render: () => <Loader />
};

export const Small: Story = {
    render: () => <Loader size={16} />
};

export const Large: Story = {
    render: () => <Loader size={48} />
};

export const IconOnly: Story = {
    render: () => <LoaderIcon size={32} />
};

export const InButton: Story = {
    render: () => (
        <button className="bg-primary text-primary-foreground flex items-center gap-2 rounded-md px-4 py-2">
            <Loader size={16} />
            <span>Processing...</span>
        </button>
    )
};

export const InCard: Story = {
    render: () => (
        <div className="bg-card rounded-lg border p-8">
            <div className="flex flex-col items-center gap-3">
                <Loader size={32} />
                <p className="text-muted-foreground text-sm">Loading your data...</p>
            </div>
        </div>
    )
};
