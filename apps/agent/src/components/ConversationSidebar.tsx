"use client";

import { useState, useEffect, useCallback } from "react";
import {
    PlusIcon,
    SearchIcon,
    MoreHorizontalIcon,
    TrashIcon,
    PencilIcon,
    PanelLeftCloseIcon,
    PanelLeftIcon
} from "lucide-react";
import {
    Button,
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Input
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
}

export function ConversationSidebar({
    activeId,
    onSelect,
    onNewConversation
}: ConversationSidebarProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [conversations, setConversations] = useState<ConversationMeta[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    // Refresh conversations from localStorage
    const refreshConversations = useCallback(() => {
        setConversations(listConversations());
    }, []);

    // Re-read from localStorage when activeId changes (conversation saved)
    useEffect(() => {
        const id = requestAnimationFrame(() => {
            setConversations(listConversations());
        });
        return () => cancelAnimationFrame(id);
    }, [activeId]);

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

    // Collapsed state: just a thin bar with expand button
    if (collapsed) {
        return (
            <div className="flex h-full w-12 shrink-0 flex-col items-center border-r py-2">
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

    // Expanded state: full sidebar
    return (
        <div className="flex h-full w-[220px] shrink-0 flex-col border-r">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onNewConversation}
                    className="h-7 gap-1.5 px-2 text-xs"
                >
                    <PlusIcon className="size-3.5" />
                    New task
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setCollapsed(true)}
                >
                    <PanelLeftCloseIcon className="size-3.5" />
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
                                        onClick={() => onSelect(conv.id)}
                                        className="flex-1 truncate text-left text-xs"
                                    >
                                        {conv.title}
                                    </button>
                                )}
                                <DropdownMenu>
                                    <DropdownMenuTrigger className="hover:bg-accent flex size-5 shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100">
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
        </div>
    );
}
