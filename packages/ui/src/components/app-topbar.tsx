"use client";

import { useState } from "react";
import { Button } from "./button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./sheet";
import { UserMenu } from "./user-menu";
import { useIsMobile } from "../hooks/use-mobile";
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
    onSearchClick?: () => void;
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
    onSearchClick,
    isActive = () => false,
    renderNavLink
}: AppTopBarProps) {
    const isMobile = useIsMobile();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
            <div className="flex h-14 w-full items-center px-4">
                {/* Mobile hamburger */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="mr-2 size-9 md:hidden"
                    onClick={() => setMobileMenuOpen(true)}
                >
                    <HugeiconsIcon icon={icons.menu!} className="size-5" />
                    <span className="sr-only">Menu</span>
                </Button>

                {/* Logo */}
                <div className="mr-8 flex items-center gap-2">
                    {logo}
                    <span className="text-base font-semibold">{title}</span>
                </div>

                {/* Center Navigation Links -- hidden on mobile */}
                <nav className="hidden flex-1 items-center gap-6 md:flex">
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

                {/* Spacer on mobile to push right actions */}
                <div className="flex-1 md:hidden" />

                {/* Right Side Actions */}
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="size-9" onClick={onSearchClick}>
                        <HugeiconsIcon icon={icons.search!} className="size-5" />
                        <span className="sr-only">Search</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="hidden size-9 md:inline-flex">
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

            {/* Mobile Navigation Sheet */}
            {isMobile && (
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetContent side="left" className="w-72 p-0">
                        <SheetHeader className="border-b px-4 py-3">
                            <SheetTitle className="flex items-center gap-2 text-base">
                                {logo}
                                {title}
                            </SheetTitle>
                            <SheetDescription className="sr-only">
                                Main navigation menu
                            </SheetDescription>
                        </SheetHeader>
                        <nav className="flex flex-col gap-1 px-2 py-2">
                            {navItems.map((item) => {
                                const active = isActive(item.href);
                                return renderNavLink ? (
                                    <div key={item.href} onClick={() => setMobileMenuOpen(false)}>
                                        {renderNavLink(item, active)}
                                    </div>
                                ) : (
                                    <a
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                                            active
                                                ? "bg-accent text-foreground"
                                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                        }`}
                                    >
                                        {item.label}
                                    </a>
                                );
                            })}
                        </nav>
                    </SheetContent>
                </Sheet>
            )}
        </header>
    );
}
