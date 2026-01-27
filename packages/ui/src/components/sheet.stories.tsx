import type { Meta, StoryObj } from "@storybook/react";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger
} from "./sheet";
import { Button } from "./button";
import { Label } from "./label";
import { Input } from "./input";

const meta = {
    title: "Components/Sheet",
    component: Sheet,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"]
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Right: Story = {
    render: () => (
        <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>Open Sheet</SheetTrigger>
            <SheetContent side="right">
                <SheetHeader>
                    <SheetTitle>Sheet Title</SheetTitle>
                    <SheetDescription>Sheet description goes here.</SheetDescription>
                </SheetHeader>
                <div className="flex-1 p-4">
                    <p className="text-sm">Sheet content goes here.</p>
                </div>
            </SheetContent>
        </Sheet>
    )
};

export const Left: Story = {
    render: () => (
        <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>Open Left</SheetTrigger>
            <SheetContent side="left">
                <SheetHeader>
                    <SheetTitle>Left Sheet</SheetTitle>
                    <SheetDescription>This sheet opens from the left side.</SheetDescription>
                </SheetHeader>
                <div className="flex-1 p-4">
                    <p className="text-sm">Content here.</p>
                </div>
            </SheetContent>
        </Sheet>
    )
};

export const Top: Story = {
    render: () => (
        <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>Open Top</SheetTrigger>
            <SheetContent side="top">
                <SheetHeader>
                    <SheetTitle>Top Sheet</SheetTitle>
                    <SheetDescription>This sheet opens from the top.</SheetDescription>
                </SheetHeader>
                <div className="p-4">
                    <p className="text-sm">Content here.</p>
                </div>
            </SheetContent>
        </Sheet>
    )
};

export const Bottom: Story = {
    render: () => (
        <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>Open Bottom</SheetTrigger>
            <SheetContent side="bottom">
                <SheetHeader>
                    <SheetTitle>Bottom Sheet</SheetTitle>
                    <SheetDescription>This sheet opens from the bottom.</SheetDescription>
                </SheetHeader>
                <div className="p-4">
                    <p className="text-sm">Content here.</p>
                </div>
            </SheetContent>
        </Sheet>
    )
};

export const WithFooter: Story = {
    render: () => (
        <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>Open with Footer</SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Confirm Action</SheetTitle>
                    <SheetDescription>Are you sure you want to proceed?</SheetDescription>
                </SheetHeader>
                <div className="flex-1 p-4">
                    <p className="text-sm">Additional information about the action.</p>
                </div>
                <SheetFooter>
                    <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
                    <Button>Confirm</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
};

export const WithForm: Story = {
    render: () => (
        <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>Edit Profile</SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Edit Profile</SheetTitle>
                    <SheetDescription>
                        Make changes to your profile here. Click save when you're done.
                    </SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col gap-4 p-4">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" defaultValue="John Doe" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="username">Username</Label>
                        <Input id="username" defaultValue="@johndoe" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" defaultValue="john@example.com" />
                    </div>
                </div>
                <SheetFooter>
                    <Button>Save Changes</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
};

export const NoCloseButton: Story = {
    render: () => (
        <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>Open</SheetTrigger>
            <SheetContent showCloseButton={false}>
                <SheetHeader>
                    <SheetTitle>No Close Button</SheetTitle>
                    <SheetDescription>
                        This sheet has no close button in the corner.
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-1 p-4">
                    <p className="text-sm">Close using the footer button or by clicking outside.</p>
                </div>
                <SheetFooter>
                    <SheetClose render={<Button />}>Close</SheetClose>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
};

export const AllSides: Story = {
    render: () => (
        <div className="flex gap-2">
            <Sheet>
                <SheetTrigger render={<Button variant="outline" />}>Left</SheetTrigger>
                <SheetContent side="left">
                    <SheetHeader>
                        <SheetTitle>Left Side</SheetTitle>
                    </SheetHeader>
                </SheetContent>
            </Sheet>
            <Sheet>
                <SheetTrigger render={<Button variant="outline" />}>Right</SheetTrigger>
                <SheetContent side="right">
                    <SheetHeader>
                        <SheetTitle>Right Side</SheetTitle>
                    </SheetHeader>
                </SheetContent>
            </Sheet>
            <Sheet>
                <SheetTrigger render={<Button variant="outline" />}>Top</SheetTrigger>
                <SheetContent side="top">
                    <SheetHeader>
                        <SheetTitle>Top Side</SheetTitle>
                    </SheetHeader>
                </SheetContent>
            </Sheet>
            <Sheet>
                <SheetTrigger render={<Button variant="outline" />}>Bottom</SheetTrigger>
                <SheetContent side="bottom">
                    <SheetHeader>
                        <SheetTitle>Bottom Side</SheetTitle>
                    </SheetHeader>
                </SheetContent>
            </Sheet>
        </div>
    )
};

export const LongContent: Story = {
    render: () => (
        <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>
                Open with Long Content
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Terms and Conditions</SheetTitle>
                    <SheetDescription>Please review the following terms.</SheetDescription>
                </SheetHeader>
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <p key={i} className="text-sm">
                            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
                            tempor incididunt ut labore et dolore magna aliqua.
                        </p>
                    ))}
                </div>
                <SheetFooter>
                    <SheetClose render={<Button variant="outline" />}>Decline</SheetClose>
                    <Button>Accept</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
};
