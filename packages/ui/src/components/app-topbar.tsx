"use client";

import { Button } from "./button";
import { UserMenu } from "./user-menu";
import { icons, HugeiconsIcon } from "../icons";

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
    logo?: React.ReactNode;
    session: Session | null;
    navItems?: NavItem[];
    onSignOut: () => void;
    onSettings?: () => void;
    isActive?: (href: string) => boolean;
    renderNavLink?: (item: NavItem, isActive: boolean) => React.ReactNode;
};

export function AppTopBar({
    title,
    logo,
    session,
    navItems = [],
    onSignOut,
    onSettings,
    isActive = () => false,
    renderNavLink
}: AppTopBarProps) {
    return (
        <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
            <div className="flex h-14 w-full items-center px-4">
                {/* Logo */}
                <div className="mr-8 flex items-center gap-2">
                    {logo}
                    <span className="text-base font-semibold">{title}</span>
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
                        <HugeiconsIcon icon={icons.search!} className="size-5" />
                        <span className="sr-only">Search</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="size-9">
                        <HugeiconsIcon icon={icons.messages!} className="size-5" />
                        <span className="sr-only">Messages</span>
                    </Button>

                    {/* User Avatar Dropdown */}
                    {session?.user && (
                        <UserMenu
                            align="end"
                            onSignOut={onSignOut}
                            onSettings={onSettings}
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
