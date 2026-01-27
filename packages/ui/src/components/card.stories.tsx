import type { Meta, StoryObj } from "@storybook/react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
    CardAction
} from "./card";
import { Button } from "./button";
import { Badge } from "./badge";

const meta = {
    title: "Components/Card",
    component: Card,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"]
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <Card className="w-[350px]">
            <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>Card description goes here</CardDescription>
            </CardHeader>
            <CardContent>
                <p>This is the card content area where you can place any content.</p>
            </CardContent>
            <CardFooter>
                <Button>Action</Button>
            </CardFooter>
        </Card>
    )
};

export const WithAction: Story = {
    render: () => (
        <Card className="w-[350px]">
            <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>You have 3 unread messages</CardDescription>
                <CardAction>
                    <Badge variant="secondary">New</Badge>
                </CardAction>
            </CardHeader>
            <CardContent>
                <p>Your notification content goes here.</p>
            </CardContent>
        </Card>
    )
};

export const Small: Story = {
    render: () => (
        <Card size="sm" className="w-[350px]">
            <CardHeader>
                <CardTitle>Small Card</CardTitle>
                <CardDescription>This card uses the small size variant</CardDescription>
            </CardHeader>
            <CardContent>
                <p>Small card content with reduced spacing.</p>
            </CardContent>
        </Card>
    )
};

export const WithFooter: Story = {
    render: () => (
        <Card className="w-[350px]">
            <CardHeader>
                <CardTitle>Create Project</CardTitle>
                <CardDescription>Deploy your new project in one-click.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="space-y-1">
                    <label className="text-sm font-medium">Name</label>
                    <input
                        className="border-border bg-background flex h-7 w-full rounded-md border px-2 text-xs"
                        placeholder="Project name"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium">Framework</label>
                    <select className="border-border bg-background flex h-7 w-full rounded-md border px-2 text-xs">
                        <option>Next.js</option>
                        <option>React</option>
                        <option>Vue</option>
                    </select>
                </div>
            </CardContent>
            <CardFooter className="gap-2 border-t">
                <Button variant="outline" className="flex-1">
                    Cancel
                </Button>
                <Button className="flex-1">Deploy</Button>
            </CardFooter>
        </Card>
    )
};

export const SimpleContent: Story = {
    render: () => (
        <Card className="w-[350px]">
            <CardContent>
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Quick Info</h3>
                    <p className="text-muted-foreground text-xs">
                        This is a card with just content, no header or footer.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
};
