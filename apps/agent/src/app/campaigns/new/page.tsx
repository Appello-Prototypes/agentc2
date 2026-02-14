"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Textarea,
    Switch
} from "@repo/ui";

export default function NewCampaignPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState("");
    const [intent, setIntent] = useState("");
    const [endState, setEndState] = useState("");
    const [description, setDescription] = useState("");
    const [constraintInput, setConstraintInput] = useState("");
    const [constraints, setConstraints] = useState<string[]>([]);
    const [restraintInput, setRestraintInput] = useState("");
    const [restraints, setRestraints] = useState<string[]>([]);
    const [requireApproval, setRequireApproval] = useState(false);
    const [maxCostUsd, setMaxCostUsd] = useState<string>("");
    const [timeoutMinutes, setTimeoutMinutes] = useState<string>("");

    const addConstraint = () => {
        const trimmed = constraintInput.trim();
        if (trimmed && !constraints.includes(trimmed)) {
            setConstraints([...constraints, trimmed]);
            setConstraintInput("");
        }
    };

    const removeConstraint = (idx: number) => {
        setConstraints(constraints.filter((_, i) => i !== idx));
    };

    const addRestraint = () => {
        const trimmed = restraintInput.trim();
        if (trimmed && !restraints.includes(trimmed)) {
            setRestraints([...restraints, trimmed]);
            setRestraintInput("");
        }
    };

    const removeRestraint = (idx: number) => {
        setRestraints(restraints.filter((_, i) => i !== idx));
    };

    const handleSubmit = async () => {
        if (!name || !intent || !endState) {
            setError("Name, intent, and end state are required.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${getApiBase()}/api/campaigns`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    intent,
                    endState,
                    description: description || undefined,
                    constraints,
                    restraints,
                    requireApproval,
                    maxCostUsd: maxCostUsd ? parseFloat(maxCostUsd) : undefined,
                    timeoutMinutes: timeoutMinutes ? parseInt(timeoutMinutes, 10) : undefined
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to create campaign");
            }

            const campaign = await res.json();
            router.push(`/campaigns/${campaign.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create campaign");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-2xl space-y-6 p-6">
            {/* Header */}
            <div>
                <button
                    onClick={() => router.push("/campaigns")}
                    className="text-muted-foreground hover:text-foreground mb-4 text-sm transition-colors"
                >
                    &larr; Back to Campaigns
                </button>
                <h1 className="text-2xl font-semibold tracking-tight">New Campaign</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Define what you want to achieve. The platform will figure out how.
                </p>
            </div>

            {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Campaign Name */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Campaign Name</CardTitle>
                </CardHeader>
                <CardContent>
                    <Input
                        placeholder='e.g. "Q1 Customer Outreach"'
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </CardContent>
            </Card>

            {/* Intent & End State */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Mission Command</CardTitle>
                    <CardDescription>
                        Tell the platform WHAT to achieve and WHY, not HOW.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Intent (the Why)</Label>
                        <Textarea
                            placeholder='e.g. "Re-engage churned customers to reduce Q1 churn by 20%"'
                            value={intent}
                            onChange={(e) => setIntent(e.target.value)}
                            rows={3}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>End State (desired outcome)</Label>
                        <Textarea
                            placeholder='e.g. "Every churned customer has received personalized outreach and their response is logged in HubSpot"'
                            value={endState}
                            onChange={(e) => setEndState(e.target.value)}
                            rows={3}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>
                            Description <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Textarea
                            placeholder="Additional context or details..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Constraints & Restraints */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Constraints & Restraints</CardTitle>
                    <CardDescription>
                        Constraints are things you MUST do. Restraints are things you MUST NOT do.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Constraints */}
                    <div className="space-y-2">
                        <Label>Constraints (must-do)</Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder='e.g. "Must use existing HubSpot data"'
                                value={constraintInput}
                                onChange={(e) => setConstraintInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addConstraint();
                                    }
                                }}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addConstraint}
                                type="button"
                            >
                                Add
                            </Button>
                        </div>
                        {constraints.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {constraints.map((c, i) => (
                                    <Badge
                                        key={i}
                                        variant="outline"
                                        className="cursor-pointer bg-blue-50 text-blue-700 hover:bg-red-50 hover:text-red-700"
                                        onClick={() => removeConstraint(i)}
                                    >
                                        {c} &times;
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Restraints */}
                    <div className="space-y-2">
                        <Label>Restraints (must-not-do)</Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder='e.g. "Do not contact opted-out customers"'
                                value={restraintInput}
                                onChange={(e) => setRestraintInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addRestraint();
                                    }
                                }}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addRestraint}
                                type="button"
                            >
                                Add
                            </Button>
                        </div>
                        {restraints.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {restraints.map((r, i) => (
                                    <Badge
                                        key={i}
                                        variant="outline"
                                        className="cursor-pointer bg-red-50 text-red-700 hover:bg-red-100"
                                        onClick={() => removeRestraint(i)}
                                    >
                                        {r} &times;
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Options */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Require Approval Before Execution</Label>
                            <p className="text-muted-foreground text-xs">
                                Pause after planning for human review
                            </p>
                        </div>
                        <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>
                                Budget Limit (USD){" "}
                                <span className="text-muted-foreground">optional</span>
                            </Label>
                            <Input
                                type="number"
                                placeholder="e.g. 50"
                                value={maxCostUsd}
                                onChange={(e) => setMaxCostUsd(e.target.value)}
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>
                                Timeout (minutes){" "}
                                <span className="text-muted-foreground">optional</span>
                            </Label>
                            <Input
                                type="number"
                                placeholder="e.g. 120"
                                value={timeoutMinutes}
                                onChange={(e) => setTimeoutMinutes(e.target.value)}
                                min="1"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={() => router.push("/campaigns")}>
                    Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={loading || !name || !intent || !endState}>
                    {loading ? "Launching..." : "Launch Campaign"}
                </Button>
            </div>
        </div>
    );
}
