import { AGENT_COLORS } from "./constants";

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
