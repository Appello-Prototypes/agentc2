"use client";

import { useEffect } from "react";

interface ShortcutAction {
    key: string;
    meta?: boolean;
    shift?: boolean;
    handler: () => void;
    guard?: "notInInput" | "always";
}

function isInputFocused() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if ((el as HTMLElement).isContentEditable) return true;
    return false;
}

export function useKeyboardShortcuts(shortcuts: ShortcutAction[]) {
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            for (const shortcut of shortcuts) {
                const metaMatch = shortcut.meta ? e.metaKey || e.ctrlKey : !e.metaKey && !e.ctrlKey;
                const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
                const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

                if (metaMatch && shiftMatch && keyMatch) {
                    const guard = shortcut.guard ?? "notInInput";
                    if (guard === "notInInput" && isInputFocused()) continue;

                    e.preventDefault();
                    e.stopPropagation();
                    shortcut.handler();
                    return;
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [shortcuts]);
}
