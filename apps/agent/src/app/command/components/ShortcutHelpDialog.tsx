"use client";

import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@repo/ui";

const SHORTCUTS = [
    { keys: "j / k", action: "Navigate between cards" },
    { keys: "Enter", action: "Expand / collapse card details" },
    { keys: "a", action: "Approve focused card" },
    { keys: "r", action: "Reject focused card" },
    { keys: "f", action: "Open feedback on focused card" },
    { keys: "x", action: "Toggle select on focused card" },
    { keys: "Shift + a", action: "Approve all selected" },
    { keys: "Escape", action: "Clear selection / cancel" },
    { keys: "?", action: "Show this help" }
];

export function ShortcutHelpDialog({
    open,
    onOpenChange
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Keyboard Shortcuts</DialogTitle>
                    <DialogDescription>
                        Navigate and act on decisions without touching the mouse.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    {SHORTCUTS.map((s) => (
                        <div key={s.keys} className="flex items-center justify-between py-1">
                            <span className="text-muted-foreground text-sm">{s.action}</span>
                            <kbd className="bg-muted rounded px-2 py-0.5 font-mono text-xs">
                                {s.keys}
                            </kbd>
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
