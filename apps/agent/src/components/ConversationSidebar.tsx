"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    PlusIcon,
    SearchIcon,
    MoreHorizontalIcon,
    TrashIcon,
    PencilIcon,
    PanelLeftCloseIcon,
    PanelLeftIcon,
    LoaderIcon,
    CheckIcon
} from "lucide-react";
import {
    Button,
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Input,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    useIsMobile
} from "@repo/ui";
import {
    listConversations,
    deleteConversation,
    updateConversationTitle,
    groupConversationsByTime,
    type ConversationMeta
} from "@/lib/conversation-store";

interface ConversationSidebarProps {
    activeId: string | null;
    onSelect: (id: string) => void;
    onNewConversation: () => void;
    /** Increment to force a re-read of conversations from localStorage (e.g. after async title update) */
    refreshKey?: number;
}

export function ConversationSidebar({
    activeId,
    onSelect,
    onNewConversation,
    refreshKey
}: ConversationSidebarProps) {
    const isMobile = useIsMobile();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(220);
    const [conversations, setConversations] = useState<ConversationMeta[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const isResizing = useRef(false);

    const MIN_WIDTH = 180;
    const MAX_WIDTH = 400;

    const handleResizeStart = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            isResizing.current = true;
            const startX = e.clientX;
            const startWidth = sidebarWidth;

            const onMouseMove = (ev: MouseEvent) => {
                if (!isResizing.current) return;
                const newWidth = Math.min(
                    MAX_WIDTH,
                    Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX))
                );
                setSidebarWidth(newWidth);
            };

            const onMouseUp = () => {
                isResizing.current = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
            };

            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        },
        [sidebarWidth]
    );

    // Refresh conversations from localStorage
    const refreshConversations = useCallback(() => {
        setConversations(listConversations());
    }, []);

    // Re-read from localStorage when activeId or refreshKey changes (conversation saved / title updated)
    useEffect(() => {
        const id = requestAnimationFrame(() => {
            setConversations(listConversations());
        });
        return () => cancelAnimationFrame(id);
    }, [activeId, refreshKey]);

    const filtered = searchQuery
        ? conversations.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
        : conversations;

    const groups = groupConversationsByTime(filtered);

    const handleDelete = useCallback(
        (id: string) => {
            deleteConversation(id);
            refreshConversations();
            if (id === activeId) {
                onNewConversation();
            }
        },
        [activeId, onNewConversation, refreshConversations]
    );

    const handleRename = useCallback(
        (id: string) => {
            if (editValue.trim()) {
                updateConversationTitle(id, editValue.trim());
                refreshConversations();
            }
            setEditingId(null);
        },
        [editValue, refreshConversations]
    );

    const handleSelect = useCallback(
        (id: string) => {
            onSelect(id);
            // Auto-close Sheet on mobile after selecting
            if (isMobile) {
                setMobileOpen(false);
            }
        },
        [onSelect, isMobile]
    );

    const handleNewConversation = useCallback(() => {
        onNewConversation();
        if (isMobile) {
            setMobileOpen(false);
        }
    }, [onNewConversation, isMobile]);

    // Shared sidebar content used by both desktop and mobile
    const sidebarContent = (
        <>
            {/* Header */}
            <div className="px-3 pt-3 pb-2.5">
                <div className="mb-2.5 px-0.5">
                    <h2 className="text-foreground text-sm font-semibold tracking-tight">
                        Workspace
                    </h2>
                    <p className="text-muted-foreground text-[11px]">Your place to get work done</p>
                </div>
                <Button
                    variant="default"
                    size="sm"
                    onClick={handleNewConversation}
                    className="h-8 w-full gap-1.5 text-xs font-medium shadow-sm"
                >
                    <PlusIcon className="size-3.5" />
                    New Task
                </Button>
            </div>

            {/* Search */}
            <div className="px-3 pb-2">
                <div className="relative">
                    <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3 -translate-y-1/2" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search"
                        className="h-7 pl-7 text-xs"
                    />
                </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto px-2">
                {groups.length === 0 && (
                    <div className="text-muted-foreground px-2 py-6 text-center text-xs">
                        No conversations yet
                    </div>
                )}

                {groups.map((group) => (
                    <div key={group.label} className="mb-1.5">
                        <div className="text-muted-foreground px-2 py-1 text-[10px] font-medium tracking-wider uppercase">
                            {group.label}
                        </div>
                        {group.conversations.map((conv) => (
                            <div
                                key={conv.id}
                                className={cn(
                                    "group flex items-center gap-1 rounded-md px-2 py-1.5",
                                    conv.id === activeId ? "bg-accent" : "hover:bg-accent/50"
                                )}
                            >
                                {editingId === conv.id ? (
                                    <input
                                        type="text"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onBlur={() => handleRename(conv.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleRename(conv.id);
                                            if (e.key === "Escape") setEditingId(null);
                                        }}
                                        className="flex-1 bg-transparent text-xs outline-none"
                                        autoFocus
                                    />
                                ) : (
                                    <button
                                        onClick={() => handleSelect(conv.id)}
                                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs"
                                    >
                                        {conv.status === "running" && (
                                            <LoaderIcon className="text-primary size-3 shrink-0 animate-spin" />
                                        )}
                                        {conv.status === "completed" && (
                                            <CheckIcon className="size-3 shrink-0 text-emerald-500" />
                                        )}
                                        <span className="truncate">{conv.title}</span>
                                    </button>
                                )}
                                <DropdownMenu>
                                    <DropdownMenuTrigger
                                        className={cn(
                                            "hover:bg-accent flex size-6 shrink-0 items-center justify-center rounded",
                                            isMobile
                                                ? "opacity-100"
                                                : "opacity-0 group-hover:opacity-100"
                                        )}
                                    >
                                        <MoreHorizontalIcon className="size-3" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-32">
                                        <DropdownMenuItem
                                            onClick={() => {
                                                setEditingId(conv.id);
                                                setEditValue(conv.title);
                                            }}
                                        >
                                            <PencilIcon className="mr-2 size-3" />
                                            Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => handleDelete(conv.id)}
                                            className="text-destructive"
                                        >
                                            <TrashIcon className="mr-2 size-3" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="text-muted-foreground/60 px-3 py-2 text-[10px]">Stored locally</div>
        </>
    );

    // ── Mobile: Sheet-based sidebar ──
    if (isMobile) {
        return (
            <>
                {/* Toggle button rendered as a thin strip */}
                <div className="flex h-full w-10 shrink-0 flex-col items-center border-r pt-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        onClick={() => setMobileOpen(true)}
                    >
                        <PanelLeftIcon className="size-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="mt-1 size-9"
                        onClick={handleNewConversation}
                    >
                        <PlusIcon className="size-4" />
                    </Button>
                </div>
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetContent side="left" className="w-72 p-0">
                        <SheetHeader className="sr-only">
                            <SheetTitle>Conversations</SheetTitle>
                            <SheetDescription>Workspace conversations</SheetDescription>
                        </SheetHeader>
                        <div className="flex h-full flex-col">{sidebarContent}</div>
                    </SheetContent>
                </Sheet>
            </>
        );
    }

    // ── Desktop: collapsed thin strip ──
    if (collapsed) {
        return (
            <div className="relative flex h-full w-10 shrink-0 flex-col items-center border-r pt-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setCollapsed(false)}
                >
                    <PanelLeftIcon className="size-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="mt-1 size-8"
                    onClick={onNewConversation}
                >
                    <PlusIcon className="size-4" />
                </Button>
            </div>
        );
    }

    // ── Desktop: expanded sidebar ──
    return (
        <div
            className="relative flex h-full shrink-0 flex-col border-r"
            style={{ width: sidebarWidth }}
        >
            {/* Resize handle -- desktop only */}
            <div
                onMouseDown={handleResizeStart}
                className="hover:bg-primary/20 active:bg-primary/30 absolute top-0 right-0 z-20 hidden h-full w-1 cursor-col-resize md:block"
            />

            {/* Collapse toggle */}
            <Button
                variant="ghost"
                size="icon"
                className="bg-background absolute top-2.5 right-0 z-10 size-7 translate-x-1/2 rounded-full border shadow-sm"
                onClick={() => setCollapsed(true)}
            >
                <PanelLeftCloseIcon className="size-3.5" />
            </Button>

            {sidebarContent}
        </div>
    );
}
