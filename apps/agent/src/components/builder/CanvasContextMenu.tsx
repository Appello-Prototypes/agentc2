"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import { cn } from "@repo/ui";

interface MenuItem {
    label: string;
    shortcut?: string;
    onClick: () => void;
    disabled?: boolean;
    destructive?: boolean;
    separator?: boolean;
}

interface CanvasContextMenuProps {
    items: MenuItem[];
    position: { x: number; y: number } | null;
    onClose: () => void;
}

export function CanvasContextMenu({ items, position, onClose }: CanvasContextMenuProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!position) return;

        function handleClick(e: Event) {
            if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
                onClose();
            }
        }
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }

        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [position, onClose]);

    if (!position) return null;

    return (
        <div
            ref={ref}
            className="bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 fixed z-50 min-w-[180px] overflow-hidden rounded-md border p-1 shadow-md"
            style={{ top: position.y, left: position.x }}
        >
            {items.map((item, i) => {
                if (item.separator) {
                    return <div key={i} className="bg-border -mx-1 my-1 h-px" />;
                }
                return (
                    <button
                        key={i}
                        className={cn(
                            "flex w-full cursor-default items-center justify-between rounded-sm px-2 py-1.5 text-sm transition-colors outline-none select-none",
                            item.disabled
                                ? "pointer-events-none opacity-50"
                                : "hover:bg-accent hover:text-accent-foreground",
                            item.destructive && "text-destructive hover:text-destructive"
                        )}
                        onClick={() => {
                            if (!item.disabled) {
                                item.onClick();
                                onClose();
                            }
                        }}
                        disabled={item.disabled}
                    >
                        <span>{item.label}</span>
                        {item.shortcut && (
                            <span className="text-muted-foreground ml-4 text-xs tracking-widest">
                                {item.shortcut}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
