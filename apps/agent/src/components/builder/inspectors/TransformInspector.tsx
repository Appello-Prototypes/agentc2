"use client";

import { Textarea } from "@repo/ui";

interface TransformInspectorProps {
    config: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
}

export function TransformInspector({ config, onChange }: TransformInspectorProps) {
    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                Transform step is currently pass-through. Data flows through unchanged. Future
                versions will support expression-based field mapping.
            </div>

            <div className="space-y-2">
                <div className="text-xs font-medium">Raw Config (JSON)</div>
                <Textarea
                    rows={6}
                    value={JSON.stringify(config, null, 2)}
                    onChange={(e) => {
                        try {
                            onChange(JSON.parse(e.target.value));
                        } catch {
                            /* keep draft */
                        }
                    }}
                    placeholder="{}"
                />
            </div>
        </div>
    );
}
