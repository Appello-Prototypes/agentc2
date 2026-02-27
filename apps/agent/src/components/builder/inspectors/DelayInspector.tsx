"use client";

import {
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@repo/ui";
import { useState } from "react";

interface DelayInspectorProps {
    config: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
}

const UNITS = [
    { value: "ms", label: "Milliseconds", multiplier: 1 },
    { value: "s", label: "Seconds", multiplier: 1000 },
    { value: "m", label: "Minutes", multiplier: 60000 },
    { value: "h", label: "Hours", multiplier: 3600000 }
];

export function DelayInspector({ config, onChange }: DelayInspectorProps) {
    const delayMs = (config.delayMs as number) || 0;
    const [unit, setUnit] = useState("ms");

    const currentUnit = UNITS.find((u) => u.value === unit) || UNITS[0];
    const displayValue = delayMs / currentUnit.multiplier;

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Duration</Label>
                <div className="flex gap-2">
                    <Input
                        type="number"
                        min={0}
                        value={displayValue}
                        onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            onChange({
                                ...config,
                                delayMs: Math.round(v * currentUnit.multiplier)
                            });
                        }}
                        className="flex-1"
                    />
                    <Select
                        value={unit}
                        onValueChange={(v) => {
                            if (v) setUnit(v);
                        }}
                    >
                        <SelectTrigger className="w-[120px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {UNITS.map((u) => (
                                <SelectItem key={u.value} value={u.value}>
                                    {u.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
