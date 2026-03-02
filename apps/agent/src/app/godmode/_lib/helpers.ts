import { AGENT_COLORS } from "./constants";
import type { ActivityEvent } from "./types";

export type UrgencyLevel = "critical" | "action" | "review" | "info";

export interface EventInsight {
    urgency: UrgencyLevel;
    soWhat: string;
    actions: EventAction[];
}

export interface EventAction {
    label: string;
    kind: "view-run" | "trace-chain" | "retry" | "dismiss";
    variant: "default" | "destructive" | "outline";
}

const URGENCY_CONFIG: Record<UrgencyLevel, { badge: string; badgeBg: string; dot: string }> = {
    critical: {
        badge: "text-red-700 dark:text-red-300",
        badgeBg: "bg-red-100 dark:bg-red-900/40",
        dot: "bg-red-500"
    },
    action: {
        badge: "text-amber-700 dark:text-amber-300",
        badgeBg: "bg-amber-100 dark:bg-amber-900/40",
        dot: "bg-amber-500"
    },
    review: {
        badge: "text-blue-700 dark:text-blue-300",
        badgeBg: "bg-blue-100 dark:bg-blue-900/40",
        dot: "bg-blue-500"
    },
    info: {
        badge: "text-gray-500 dark:text-gray-400",
        badgeBg: "bg-gray-100 dark:bg-gray-900/40",
        dot: "bg-gray-400"
    }
};

export function getUrgencyStyles(level: UrgencyLevel) {
    return URGENCY_CONFIG[level];
}

export function getEventInsight(event: ActivityEvent): EventInsight {
    const metadata = event.metadata as Record<string, unknown> | null;
    const toolCount = (metadata?.toolsUsed as string[] | undefined)?.length ?? 0;
    const costThreshold = 0.5;
    const isExpensive = (event.costUsd ?? 0) > costThreshold;

    switch (event.type) {
        case "RUN_FAILED":
            return {
                urgency: "critical",
                soWhat: "Agent run failed — investigate the cause and retry if needed",
                actions: [
                    { label: "Inspect Run", kind: "view-run", variant: "destructive" },
                    { label: "Dismiss", kind: "dismiss", variant: "outline" }
                ]
            };
        case "WORKFLOW_FAILED":
            return {
                urgency: "critical",
                soWhat: "Workflow failed — downstream steps won't execute",
                actions: [{ label: "View Details", kind: "view-run", variant: "destructive" }]
            };
        case "TASK_FAILED":
            return {
                urgency: "critical",
                soWhat: "Task failed — check if it needs to be retried or reassigned",
                actions: [{ label: "View Task", kind: "view-run", variant: "destructive" }]
            };
        case "HEARTBEAT_ALERT":
            return {
                urgency: "critical",
                soWhat: "Health check detected an issue — agent may be degraded",
                actions: [{ label: "Investigate", kind: "view-run", variant: "destructive" }]
            };
        case "GUARDRAIL_TRIGGERED":
            return {
                urgency: "action",
                soWhat: "A safety guardrail blocked an agent action — review if correct",
                actions: [{ label: "Review", kind: "view-run", variant: "default" }]
            };
        case "WORKFLOW_SUSPENDED":
            return {
                urgency: "action",
                soWhat: "Workflow is paused — waiting for your approval to continue",
                actions: [{ label: "Resume / Approve", kind: "view-run", variant: "default" }]
            };
        case "RUN_STARTED":
            return {
                urgency: "info",
                soWhat:
                    toolCount > 0
                        ? `Agent is running with ${toolCount} tool${toolCount > 1 ? "s" : ""} — no action needed`
                        : "Agent run started — no action needed",
                actions: [{ label: "Watch Live", kind: "view-run", variant: "outline" }]
            };
        case "RUN_COMPLETED":
            if (isExpensive) {
                return {
                    urgency: "review",
                    soWhat: `Completed but expensive (${formatCost(event.costUsd)}) — review if this is expected`,
                    actions: [{ label: "View Run", kind: "view-run", variant: "default" }]
                };
            }
            return {
                urgency: "info",
                soWhat: "Completed successfully — no action needed",
                actions: [{ label: "View Run", kind: "view-run", variant: "outline" }]
            };
        case "TASK_CREATED":
            return {
                urgency: "info",
                soWhat: "New task added to the agent's backlog",
                actions: [{ label: "View Task", kind: "view-run", variant: "outline" }]
            };
        case "TASK_COMPLETED":
            return {
                urgency: "info",
                soWhat: "Task completed — deliverable is ready",
                actions: [{ label: "View Result", kind: "view-run", variant: "outline" }]
            };
        case "NETWORK_ROUTED":
            return {
                urgency: "info",
                soWhat: "Work was routed to another agent in the network",
                actions: [{ label: "View Chain", kind: "trace-chain", variant: "outline" }]
            };
        case "NETWORK_COMPLETED":
            return {
                urgency: "info",
                soWhat: "Network execution finished — all steps done",
                actions: [{ label: "View Chain", kind: "trace-chain", variant: "outline" }]
            };
        case "CAMPAIGN_STARTED":
            return {
                urgency: "review",
                soWhat: "A multi-step campaign kicked off — monitor for progress",
                actions: []
            };
        case "CAMPAIGN_COMPLETED":
            return {
                urgency: "info",
                soWhat: "Campaign finished — review results",
                actions: [{ label: "View Results", kind: "view-run", variant: "outline" }]
            };
        case "SLACK_MESSAGE_HANDLED":
            return {
                urgency: "info",
                soWhat: "Agent responded to a Slack message",
                actions: [{ label: "View Reply", kind: "view-run", variant: "outline" }]
            };
        case "EMAIL_PROCESSED":
            return {
                urgency: "info",
                soWhat: "Email was processed by the agent",
                actions: [{ label: "View Run", kind: "view-run", variant: "outline" }]
            };
        case "TRIGGER_FIRED":
            return {
                urgency: "review",
                soWhat: "A trigger fired — check if the resulting action was correct",
                actions: [{ label: "View Run", kind: "view-run", variant: "outline" }]
            };
        case "SCHEDULE_EXECUTED":
            return {
                urgency: "info",
                soWhat: "Scheduled run executed on time",
                actions: [{ label: "View Run", kind: "view-run", variant: "outline" }]
            };
        case "HEARTBEAT_RAN":
            return {
                urgency: "info",
                soWhat: "Routine health check — all clear",
                actions: []
            };
        case "WORKFLOW_STARTED":
            return {
                urgency: "info",
                soWhat: "Workflow kicked off — will progress through steps automatically",
                actions: [{ label: "Watch", kind: "view-run", variant: "outline" }]
            };
        case "WORKFLOW_COMPLETED":
            return {
                urgency: "info",
                soWhat: "Workflow completed all steps successfully",
                actions: [{ label: "View Result", kind: "view-run", variant: "outline" }]
            };
        default: {
            if (event.status === "failure") {
                return {
                    urgency: "critical",
                    soWhat: "Something failed — review the details",
                    actions: [{ label: "Investigate", kind: "view-run", variant: "destructive" }]
                };
            }
            if (metadata?.toolHealthIssues) {
                return {
                    urgency: "action",
                    soWhat: "Tool health issue — some tools may be unavailable",
                    actions: [{ label: "View Details", kind: "view-run", variant: "default" }]
                };
            }
            return {
                urgency: "info",
                soWhat: event.summary,
                actions: []
            };
        }
    }
}

export function getAgentColor(slug: string | null): string {
    if (!slug) return "from-gray-400 to-gray-500";
    let hash = 0;
    for (let i = 0; i < slug.length; i++) {
        hash = slug.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length]!;
}

export function getAgentInitials(name: string | null, slug: string | null): string {
    const val = name || slug || "?";
    const parts = val.split(/[\s-_]+/);
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return val.slice(0, 2).toUpperCase();
}

export function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 5) return "just now";
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

export function formatDuration(ms: number | null): string {
    if (ms === null) return "";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60_000).toFixed(1)}m`;
}

export function formatCost(value: number | null): string {
    if (value === null || value === 0) return "";
    return value < 1 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

export function formatTokens(value: number | null): string {
    if (value === null || value === 0) return "";
    return `${value.toLocaleString()} tok`;
}

export function getSourceLabel(source: string | null): string {
    if (!source) return "system";
    return source.toLowerCase();
}

export function getSourceColor(source: string | null): string {
    switch (source?.toLowerCase()) {
        case "slack":
            return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
        case "whatsapp":
            return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
        case "voice":
        case "elevenlabs":
            return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300";
        case "api":
            return "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300";
        case "schedule":
        case "cron":
            return "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300";
        case "webhook":
            return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
        case "campaign":
            return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
        case "heartbeat":
            return "bg-gray-100 text-gray-500 dark:bg-gray-900/40 dark:text-gray-400";
        default:
            return "bg-gray-100 text-gray-600 dark:bg-gray-900/40 dark:text-gray-400";
    }
}
