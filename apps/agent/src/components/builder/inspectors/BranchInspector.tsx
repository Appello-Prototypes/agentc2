"use client";

import { Button, Input, Label, Textarea } from "@repo/ui";

interface BranchConfig {
    condition: string;
    steps: unknown[];
    id?: string;
}

interface BranchInspectorProps {
    config: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
}

export function BranchInspector({ config, onChange }: BranchInspectorProps) {
    const branches = (config.branches as BranchConfig[]) || [];

    const updateBranch = (index: number, updates: Partial<BranchConfig>) => {
        const next = [...branches];
        next[index] = { ...next[index], ...updates };
        onChange({ ...config, branches: next });
    };

    const addBranch = () => {
        onChange({
            ...config,
            branches: [...branches, { condition: "", steps: [], id: `branch-${branches.length}` }]
        });
    };

    const removeBranch = (index: number) => {
        onChange({ ...config, branches: branches.filter((_, i) => i !== index) });
    };

    return (
        <div className="space-y-4">
            <Label>Branches</Label>
            {branches.map((branch, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                        <div className="text-xs font-medium">Condition {i + 1}</div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBranch(i)}
                            className="h-6 text-xs"
                        >
                            Remove
                        </Button>
                    </div>
                    <Input
                        value={branch.id || ""}
                        onChange={(e) => updateBranch(i, { id: e.target.value })}
                        placeholder="Branch ID"
                    />
                    <Textarea
                        rows={2}
                        value={branch.condition}
                        onChange={(e) => updateBranch(i, { condition: e.target.value })}
                        placeholder="e.g., risk === 'high'"
                    />
                </div>
            ))}
            <Button variant="outline" size="sm" onClick={addBranch}>
                Add Branch
            </Button>
        </div>
    );
}
