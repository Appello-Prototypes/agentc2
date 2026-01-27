import type { Meta, StoryObj } from "@storybook/react";
import { Separator } from "./separator";

const meta = {
    title: "Components/Separator",
    component: Separator,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"],
    argTypes: {
        orientation: {
            control: "select",
            options: ["horizontal", "vertical"]
        }
    }
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
    render: () => (
        <div className="w-[350px]">
            <div className="space-y-1">
                <h4 className="text-sm font-medium">Section Title</h4>
                <p className="text-muted-foreground text-xs">Section description text goes here.</p>
            </div>
            <Separator className="my-4" />
            <div className="space-y-1">
                <h4 className="text-sm font-medium">Another Section</h4>
                <p className="text-muted-foreground text-xs">
                    More description text below the separator.
                </p>
            </div>
        </div>
    )
};

export const Vertical: Story = {
    render: () => (
        <div className="flex h-20 items-center gap-4">
            <div className="text-sm">Item 1</div>
            <Separator orientation="vertical" />
            <div className="text-sm">Item 2</div>
            <Separator orientation="vertical" />
            <div className="text-sm">Item 3</div>
        </div>
    )
};

export const InCard: Story = {
    render: () => (
        <div className="w-[350px] rounded-lg border p-4">
            <h3 className="font-medium">Card Title</h3>
            <p className="text-muted-foreground mt-2 text-sm">
                Card description or subtitle goes here.
            </p>
            <Separator className="my-4" />
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Label</span>
                    <span>Value</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Another Label</span>
                    <span>Another Value</span>
                </div>
            </div>
        </div>
    )
};

export const InList: Story = {
    render: () => (
        <div className="w-[350px] space-y-2">
            <div className="text-sm">List Item 1</div>
            <Separator />
            <div className="text-sm">List Item 2</div>
            <Separator />
            <div className="text-sm">List Item 3</div>
            <Separator />
            <div className="text-sm">List Item 4</div>
        </div>
    )
};

export const WithCustomSpacing: Story = {
    render: () => (
        <div className="w-[350px]">
            <div className="text-sm">Content above</div>
            <Separator className="my-8" />
            <div className="text-sm">Content below with more spacing</div>
        </div>
    )
};

export const HorizontalAndVertical: Story = {
    render: () => (
        <div className="w-[350px] space-y-4">
            <div className="space-y-2">
                <h4 className="font-medium">Horizontal Separators</h4>
                <div>Item 1</div>
                <Separator />
                <div>Item 2</div>
                <Separator />
                <div>Item 3</div>
            </div>
            <Separator className="my-6" />
            <div className="space-y-2">
                <h4 className="font-medium">Vertical Separators</h4>
                <div className="flex items-center gap-4">
                    <span>Col 1</span>
                    <Separator orientation="vertical" className="h-12" />
                    <span>Col 2</span>
                    <Separator orientation="vertical" className="h-12" />
                    <span>Col 3</span>
                </div>
            </div>
        </div>
    )
};
