"use client";

import { Label, Switch } from "@repo/ui";

interface ThinkingToggleProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    visible: boolean;
}

export function ThinkingToggle({ enabled, onChange, visible }: ThinkingToggleProps) {
    if (!visible) return null;

    return (
        <div className="flex items-center gap-2">
            <Switch id="thinking-toggle" checked={enabled} onCheckedChange={onChange} />
            <Label
                htmlFor="thinking-toggle"
                className="text-muted-foreground cursor-pointer text-sm"
            >
                Think deeper
            </Label>
        </div>
    );
}
