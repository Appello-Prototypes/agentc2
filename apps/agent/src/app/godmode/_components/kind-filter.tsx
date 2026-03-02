"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";

export type KindFilterValue =
    | "all"
    | "agents"
    | "workflows"
    | "networks"
    | "campaigns"
    | "triggers";

const KIND_OPTIONS: { value: KindFilterValue; label: string; typeFilter: string }[] = [
    { value: "all", label: "All Kinds", typeFilter: "all" },
    {
        value: "agents",
        label: "Agents",
        typeFilter: "RUN_STARTED,RUN_COMPLETED,RUN_FAILED"
    },
    {
        value: "workflows",
        label: "Workflows",
        typeFilter: "WORKFLOW_STARTED,WORKFLOW_COMPLETED,WORKFLOW_FAILED,WORKFLOW_SUSPENDED"
    },
    {
        value: "networks",
        label: "Networks",
        typeFilter: "NETWORK_ROUTED,NETWORK_COMPLETED"
    },
    {
        value: "campaigns",
        label: "Campaigns",
        typeFilter: "CAMPAIGN_STARTED,CAMPAIGN_COMPLETED,CAMPAIGN_FAILED,MISSION_COMPLETED"
    },
    {
        value: "triggers",
        label: "Triggers",
        typeFilter: "TRIGGER_FIRED,SCHEDULE_EXECUTED"
    }
];

export function KindFilter({
    value,
    onChange
}: {
    value: KindFilterValue;
    onChange: (kind: KindFilterValue, typeFilter: string) => void;
}) {
    return (
        <Select
            value={value}
            onValueChange={(val) => {
                const opt = KIND_OPTIONS.find((o) => o.value === val);
                if (opt) onChange(opt.value, opt.typeFilter);
            }}
        >
            <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="All Kinds" />
            </SelectTrigger>
            <SelectContent>
                {KIND_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
