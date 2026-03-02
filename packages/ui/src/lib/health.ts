export type HealthStatus = "healthy" | "degrading" | "unstable" | "failing";

export const healthSortOrder: Record<HealthStatus, number> = {
    failing: 0,
    unstable: 1,
    degrading: 2,
    healthy: 3
};

/**
 * Derive entity health status from a rolling success rate (0–100%).
 *
 * Thresholds:
 *   healthy   >= 95%
 *   degrading >= 80%
 *   unstable  >= 60%
 *   failing   <  60%
 */
export function getHealthStatus(successRate: number): HealthStatus {
    if (successRate >= 95) return "healthy";
    if (successRate >= 80) return "degrading";
    if (successRate >= 60) return "unstable";
    return "failing";
}

interface HealthStyles {
    bg: string;
    text: string;
    border: string;
    dot: string;
    badge: string;
}

const STYLES: Record<HealthStatus, HealthStyles> = {
    healthy: {
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        border: "border-emerald-500/30",
        dot: "bg-emerald-500",
        badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    },
    degrading: {
        bg: "bg-yellow-500/10",
        text: "text-yellow-400",
        border: "border-yellow-500/30",
        dot: "bg-yellow-500",
        badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    },
    unstable: {
        bg: "bg-orange-500/10",
        text: "text-orange-400",
        border: "border-orange-500/30",
        dot: "bg-orange-500",
        badge: "bg-orange-500/20 text-orange-400 border-orange-500/30"
    },
    failing: {
        bg: "bg-red-500/10",
        text: "text-red-400",
        border: "border-red-500/30",
        dot: "bg-red-500",
        badge: "bg-red-500/20 text-red-400 border-red-500/30"
    }
};

export function getHealthStyles(status: HealthStatus): HealthStyles {
    return STYLES[status];
}
