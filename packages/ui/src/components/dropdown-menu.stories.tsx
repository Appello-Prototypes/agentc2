import type { Meta, StoryObj } from "@storybook/react";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger
} from "./dropdown-menu";
import { Button } from "./button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    UserIcon,
    Settings02Icon,
    Logout03Icon,
    CreditCardIcon,
    MailIcon,
    MessageMultiple01Icon,
    CloudIcon
} from "@hugeicons/core-free-icons";
import { useState } from "react";

const meta = {
    title: "Components/DropdownMenu",
    component: DropdownMenu,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"]
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
                Open Menu
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Logout</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
};

export const WithIcons: Story = {
    render: () => (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
                Account Menu
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem>
                    <HugeiconsIcon icon={UserIcon} />
                    Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                    <HugeiconsIcon icon={CreditCardIcon} />
                    Billing
                </DropdownMenuItem>
                <DropdownMenuItem>
                    <HugeiconsIcon icon={Settings02Icon} />
                    Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                    <HugeiconsIcon icon={Logout03Icon} />
                    Logout
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
};

export const WithShortcuts: Story = {
    render: () => (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
                Edit Menu
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem>
                    New Tab
                    <DropdownMenuShortcut>⌘T</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                    New Window
                    <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                    Save
                    <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                    Print
                    <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
};

export const WithGroups: Story = {
    render: () => (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>Options</DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Personal</DropdownMenuLabel>
                    <DropdownMenuItem>
                        <HugeiconsIcon icon={UserIcon} />
                        Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <HugeiconsIcon icon={MailIcon} />
                        Messages
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                    <DropdownMenuItem>
                        <HugeiconsIcon icon={CloudIcon} />
                        Cloud Storage
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <HugeiconsIcon icon={Settings02Icon} />
                        Settings
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
};

export const WithCheckboxes: Story = {
    render: function Render() {
        const [showPanel, setShowPanel] = useState(true);
        const [showSidebar, setShowSidebar] = useState(false);
        const [showToolbar, setShowToolbar] = useState(true);

        return (
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" />}>
                    View
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Panels</DropdownMenuLabel>
                        <DropdownMenuCheckboxItem
                            checked={showPanel}
                            onCheckedChange={setShowPanel}
                        >
                            Side Panel
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={showSidebar}
                            onCheckedChange={setShowSidebar}
                        >
                            Sidebar
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={showToolbar}
                            onCheckedChange={setShowToolbar}
                        >
                            Toolbar
                        </DropdownMenuCheckboxItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }
};

export const WithRadioGroup: Story = {
    render: function Render() {
        const [theme, setTheme] = useState("light");

        return (
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" />}>
                    Theme
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }
};

export const WithSubmenu: Story = {
    render: () => (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>File</DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem>
                    New File
                    <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Open Recent</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        <DropdownMenuItem>Document 1.txt</DropdownMenuItem>
                        <DropdownMenuItem>Document 2.txt</DropdownMenuItem>
                        <DropdownMenuItem>Document 3.txt</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Clear History</DropdownMenuItem>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                    Save
                    <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                    Save As...
                    <DropdownMenuShortcut>⇧⌘S</DropdownMenuShortcut>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
};

export const ComplexMenu: Story = {
    render: function Render() {
        const [notifications, setNotifications] = useState(true);
        const [emails, setEmails] = useState(false);
        const [language, setLanguage] = useState("en");

        return (
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" />}>
                    <HugeiconsIcon icon={Settings02Icon} />
                    Settings
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                        <DropdownMenuCheckboxItem
                            checked={notifications}
                            onCheckedChange={setNotifications}
                        >
                            <HugeiconsIcon icon={MessageMultiple01Icon} />
                            Push Notifications
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={emails} onCheckedChange={setEmails}>
                            <HugeiconsIcon icon={MailIcon} />
                            Email Updates
                        </DropdownMenuCheckboxItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Language</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
                            <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="es">Español</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="fr">Français</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <HugeiconsIcon icon={UserIcon} />
                            Account
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Profile</DropdownMenuItem>
                            <DropdownMenuItem>Billing</DropdownMenuItem>
                            <DropdownMenuItem>Security</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">
                        <HugeiconsIcon icon={Logout03Icon} />
                        Sign Out
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }
};
