export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

export const severitySortOrder: Record<SeverityLevel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4
};

/**
 * Derive a severity level from a numeric score (0–100) or from
 * well-known status strings.
 */
export function getSeverity(input: number | string | null | undefined): SeverityLevel {
    if (input == null) return "info";

    if (typeof input === "string") {
        const lower = input.toLowerCase();
        if (lower === "critical" || lower === "error" || lower === "failed") return "critical";
        if (lower === "high" || lower === "warning") return "high";
        if (lower === "medium" || lower === "moderate") return "medium";
        if (lower === "low") return "low";
        return "info";
    }

    if (input >= 90) return "critical";
    if (input >= 70) return "high";
    if (input >= 40) return "medium";
    if (input >= 20) return "low";
    return "info";
}

interface SeverityStyles {
    bg: string;
    text: string;
    border: string;
    dot: string;
    badge: string;
}

const STYLES: Record<SeverityLevel, SeverityStyles> = {
    critical: {
        bg: "bg-red-500/10",
        text: "text-red-400",
        border: "border-red-500/30",
        dot: "bg-red-500",
        badge: "bg-red-500/20 text-red-400 border-red-500/30"
    },
    high: {
        bg: "bg-orange-500/10",
        text: "text-orange-400",
        border: "border-orange-500/30",
        dot: "bg-orange-500",
        badge: "bg-orange-500/20 text-orange-400 border-orange-500/30"
    },
    medium: {
        bg: "bg-yellow-500/10",
        text: "text-yellow-400",
        border: "border-yellow-500/30",
        dot: "bg-yellow-500",
        badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    },
    low: {
        bg: "bg-blue-500/10",
        text: "text-blue-400",
        border: "border-blue-500/30",
        dot: "bg-blue-500",
        badge: "bg-blue-500/20 text-blue-400 border-blue-500/30"
    },
    info: {
        bg: "bg-zinc-500/10",
        text: "text-zinc-400",
        border: "border-zinc-500/30",
        dot: "bg-zinc-500",
        badge: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
    }
};

export function getSeverityStyles(level: SeverityLevel): SeverityStyles {
    return STYLES[level];
}
