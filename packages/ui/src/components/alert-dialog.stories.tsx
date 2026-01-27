import type { Meta, StoryObj } from "@storybook/react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
    AlertDialogTrigger
} from "./alert-dialog";
import { Button } from "./button";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertDiamondIcon, Delete02Icon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";

const meta = {
    title: "Components/AlertDialog",
    component: AlertDialog,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"]
} satisfies Meta<typeof AlertDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" />}>
                Delete Account
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your account and
                        remove your data from our servers.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
};

export const WithMedia: Story = {
    render: () => (
        <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" />}>
                Delete File
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogMedia>
                        <HugeiconsIcon icon={Delete02Icon} className="text-destructive" />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Delete this file?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This file will be permanently deleted. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
};

export const Warning: Story = {
    render: () => (
        <AlertDialog>
            <AlertDialogTrigger render={<Button />}>Proceed with Action</AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogMedia>
                        <HugeiconsIcon icon={AlertDiamondIcon} className="text-orange-500" />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Warning</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action may have unintended consequences. Please review before
                        proceeding.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction>Continue</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
};

export const Success: Story = {
    render: () => (
        <AlertDialog>
            <AlertDialogTrigger render={<Button />}>Complete Setup</AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogMedia className="bg-green-500/20">
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="text-green-600" />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Setup Complete!</AlertDialogTitle>
                    <AlertDialogDescription>
                        Your account has been successfully configured. You can now start using the
                        application.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction>Get Started</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
};

export const SmallSize: Story = {
    render: () => (
        <AlertDialog>
            <AlertDialogTrigger render={<Button />}>Confirm</AlertDialogTrigger>
            <AlertDialogContent size="sm">
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Action</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to continue?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>No</AlertDialogCancel>
                    <AlertDialogAction>Yes</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
};

export const LongDescription: Story = {
    render: () => (
        <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" />}>
                Remove User
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remove user from workspace?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will remove the user's access to this workspace immediately. The user
                        will no longer be able to view or edit any content. Any pending invitations
                        will be cancelled. This action can be reversed by inviting the user again.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive">Remove User</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
};
