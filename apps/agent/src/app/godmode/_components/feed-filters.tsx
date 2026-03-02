"use client";

import {
    Button,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@repo/ui";

export function FeedFilters({
    searchQuery,
    typeFilter,
    selectedAgent,
    onSearchChange,
    onTypeFilterChange,
    onClear
}: {
    searchQuery: string;
    typeFilter: string;
    selectedAgent: string | null;
    onSearchChange: (value: string) => void;
    onTypeFilterChange: (value: string) => void;
    onClear: () => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="max-w-sm min-w-[200px] flex-1">
                <Input
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="h-9"
                />
            </div>
            <Select value={typeFilter} onValueChange={(val) => onTypeFilterChange(val ?? "all")}>
                <SelectTrigger className="h-9 w-[180px]">
                    <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="RUN_STARTED,RUN_COMPLETED,RUN_FAILED">Agent Runs</SelectItem>
                    <SelectItem value="WORKFLOW_STARTED,WORKFLOW_COMPLETED,WORKFLOW_FAILED,WORKFLOW_SUSPENDED">
                        Workflows
                    </SelectItem>
                    <SelectItem value="NETWORK_ROUTED,NETWORK_COMPLETED">Networks</SelectItem>
                    <SelectItem value="TASK_CREATED,TASK_COMPLETED,TASK_FAILED">Tasks</SelectItem>
                    <SelectItem value="CAMPAIGN_STARTED,CAMPAIGN_COMPLETED,CAMPAIGN_FAILED,MISSION_COMPLETED">
                        Campaigns
                    </SelectItem>
                    <SelectItem value="SLACK_MESSAGE_HANDLED,EMAIL_PROCESSED">
                        Communication
                    </SelectItem>
                    <SelectItem value="TRIGGER_FIRED,SCHEDULE_EXECUTED">Triggers</SelectItem>
                    <SelectItem value="HEARTBEAT_RAN,HEARTBEAT_ALERT">Heartbeats</SelectItem>
                </SelectContent>
            </Select>
            {(selectedAgent || typeFilter !== "all" || searchQuery) && (
                <Button variant="ghost" size="sm" onClick={onClear}>
                    Clear filters
                </Button>
            )}
        </div>
    );
}
