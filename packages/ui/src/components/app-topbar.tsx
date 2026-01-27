"use client";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "./dropdown-menu";
import { Button } from "./button";
import { UserMenu } from "./user-menu";
import { navigationItems } from "../config/navigation";
import { ChevronDown, Search01Icon, MessageMultiple01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

type Session = {
    user: {
        name: string;
        email: string;
        image?: string | null;
    };
};

type NavItem = {
    label: string;
    href: string;
};

type AppTopBarProps = {
    title: string;
    session: Session | null;
    navItems?: NavItem[];
    onSignOut: () => void;
    isActive?: (href: string) => boolean;
    renderNavLink?: (item: NavItem, isActive: boolean) => React.ReactNode;
};

export function AppTopBar({
    title,
    session,
    navItems = [],
    onSignOut,
    isActive = () => false,
    renderNavLink
}: AppTopBarProps) {
    return (
        <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
            <div className="flex h-14 w-full items-center px-4">
                {/* Logo with Dropdown */}
                <div className="mr-8 flex items-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger className="hover:bg-accent data-popup-open:bg-accent flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors outline-none">
                            <span className="text-base font-semibold">{title}</span>
                            <HugeiconsIcon icon={ChevronDown} className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                            <div className="px-2 py-1.5 text-sm font-semibold">Navigation</div>
                            <DropdownMenuSeparator />
                            {navigationItems.map((item) =>
                                item.children ? (
                                    <div key={item.label}>
                                        <div className="text-muted-foreground flex items-center gap-2 px-2 py-1.5 text-xs font-semibold">
                                            <HugeiconsIcon icon={item.icon} className="size-4" />
                                            {item.label}
                                        </div>
                                        {item.children.map((child) => (
                                            <DropdownMenuItem
                                                key={child.href}
                                                onClick={() => (window.location.href = child.href)}
                                                className="ml-6"
                                            >
                                                {child.label}
                                            </DropdownMenuItem>
                                        ))}
                                    </div>
                                ) : (
                                    <DropdownMenuItem
                                        key={item.href}
                                        onClick={() => (window.location.href = item.href)}
                                    >
                                        <HugeiconsIcon icon={item.icon} className="size-4" />
                                        {item.label}
                                    </DropdownMenuItem>
                                )
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Center Navigation Links */}
                <nav className="flex flex-1 items-center gap-6">
                    {navItems.map((item) =>
                        renderNavLink ? (
                            <div key={item.href}>{renderNavLink(item, isActive(item.href))}</div>
                        ) : (
                            <a
                                key={item.href}
                                href={item.href}
                                className={`hover:text-primary text-sm font-medium transition-colors ${
                                    isActive(item.href)
                                        ? "text-foreground"
                                        : "text-muted-foreground"
                                }`}
                            >
                                {item.label}
                            </a>
                        )
                    )}
                </nav>

                {/* Right Side Actions */}
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="size-9">
                        <HugeiconsIcon icon={Search01Icon} className="size-5" />
                        <span className="sr-only">Search</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="size-9">
                        <HugeiconsIcon icon={MessageMultiple01Icon} className="size-5" />
                        <span className="sr-only">Messages</span>
                    </Button>

                    {/* User Avatar Dropdown */}
                    {session?.user && (
                        <UserMenu
                            align="end"
                            onSignOut={onSignOut}
                            trigger={
                                <div className="hover:bg-accent data-popup-open:bg-accent relative flex size-9 items-center justify-center rounded-full transition-colors outline-none">
                                    <div className="bg-muted flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
                                        {session.user.image ? (
                                            <img
                                                src={session.user.image ?? ""}
                                                alt={session.user.name}
                                                width={32}
                                                height={32}
                                                className="size-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-xs font-medium">
                                                {session.user.name.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            }
                        />
                    )}
                </div>
            </div>
        </header>
    );
}
