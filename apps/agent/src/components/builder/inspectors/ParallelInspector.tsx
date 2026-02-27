"use client";

import { Button, Input, Label } from "@repo/ui";

interface ParallelBranch {
    id?: string;
    name?: string;
    steps: unknown[];
}

interface ParallelInspectorProps {
    config: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
}

export function ParallelInspector({ config, onChange }: ParallelInspectorProps) {
    const branches = (config.branches as ParallelBranch[]) || [];

    const updateBranch = (index: number, updates: Partial<ParallelBranch>) => {
        const next = [...branches];
        next[index] = { ...next[index], ...updates };
        onChange({ ...config, branches: next });
    };

    const addBranch = () => {
        onChange({
            ...config,
            branches: [...branches, { id: `branch-${branches.length}`, steps: [] }]
        });
    };

    const removeBranch = (index: number) => {
        onChange({ ...config, branches: branches.filter((_, i) => i !== index) });
    };

    return (
        <div className="space-y-4">
            <Label>Parallel Branches</Label>
            {branches.map((branch, i) => (
                <div key={i} className="flex items-center gap-2 rounded border p-2">
                    <Input
                        value={branch.name || branch.id || `Branch ${i + 1}`}
                        onChange={(e) => updateBranch(i, { name: e.target.value })}
                        className="h-8 flex-1 text-xs"
                    />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBranch(i)}
                        className="h-7 text-xs"
                    >
                        Remove
                    </Button>
                </div>
            ))}
            <Button variant="outline" size="sm" onClick={addBranch}>
                Add Branch
            </Button>
        </div>
    );
}
