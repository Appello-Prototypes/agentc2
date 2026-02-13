"use client";

import { useState } from "react";
import {
    Button,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    Skeleton,
    useIsMobile,
    icons,
    HugeiconsIcon
} from "@repo/ui";

interface DetailPageShellProps {
    /** Content rendered inside the sidebar (header, nav, footer) */
    sidebar: React.ReactNode;
    /** Main content area */
    children: React.ReactNode;
    /** Whether data is still loading */
    loading?: boolean;
    /** Number of skeleton nav items to show while loading */
    loadingNavCount?: number;
    /** Optional title for mobile Sheet accessibility */
    sidebarTitle?: string;
    /** Optional class for the main content wrapper */
    mainClassName?: string;
}

/**
 * Shared shell for detail pages (agents, networks, workflows, skills, settings).
 *
 * - Desktop: fixed w-64 sidebar + scrollable content area.
 * - Mobile: sidebar collapses into a Sheet drawer triggered by a toggle button.
 */
export function DetailPageShell({
    sidebar,
    children,
    loading = false,
    loadingNavCount = 5,
    sidebarTitle = "Navigation",
    mainClassName
}: DetailPageShellProps) {
    const isMobile = useIsMobile();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    if (loading) {
        return (
            <div className="flex h-full">
                <div className="hidden w-64 border-r p-4 md:block">
                    <Skeleton className="mb-4 h-8 w-full" />
                    <Skeleton className="mb-8 h-6 w-3/4" />
                    {Array.from({ length: loadingNavCount }, (_, i) => (
                        <Skeleton key={i} className="mb-2 h-10 w-full" />
                    ))}
                </div>
                <div className="flex-1 p-4 md:p-6">
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }

    // Sidebar content is reused in both modes
    const sidebarContent = <div className="flex h-full flex-col">{sidebar}</div>;

    return (
        <div className="flex h-full overflow-hidden">
            {/* Desktop sidebar */}
            {!isMobile && (
                <aside className="bg-muted/30 flex w-64 flex-col border-r">{sidebarContent}</aside>
            )}

            {/* Mobile Sheet sidebar */}
            {isMobile && (
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                    <SheetContent side="left" className="w-72 p-0">
                        <SheetHeader className="sr-only">
                            <SheetTitle>{sidebarTitle}</SheetTitle>
                            <SheetDescription>Detail page navigation</SheetDescription>
                        </SheetHeader>
                        <div className="bg-muted/30 flex h-full flex-col">{sidebarContent}</div>
                    </SheetContent>
                </Sheet>
            )}

            {/* Main content area */}
            <main className="flex-1 overflow-y-auto">
                {/* Mobile toggle bar */}
                {isMobile && (
                    <div className="border-b px-3 py-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <HugeiconsIcon icon={icons.menu!} className="size-4" />
                            <span className="text-sm">{sidebarTitle}</span>
                        </Button>
                    </div>
                )}
                <div className={mainClassName ?? "p-4 md:p-6"}>{children}</div>
            </main>
        </div>
    );
}

/**
 * Wrapper to close the mobile Sheet when a nav link is clicked.
 * Use around <Link> elements inside the sidebar.
 */
export function DetailPageShellNavLink({
    children,
    onNavigate
}: {
    children: React.ReactNode;
    onNavigate?: () => void;
}) {
    return <div onClick={onNavigate}>{children}</div>;
}
