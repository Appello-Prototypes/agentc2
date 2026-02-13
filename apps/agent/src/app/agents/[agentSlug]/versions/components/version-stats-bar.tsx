import { VersionStats } from "./types";

interface VersionStatsBarProps {
    stats: VersionStats;
}

export function VersionStatsBar({ stats }: VersionStatsBarProps) {
    const items = [
        { label: "Runs", value: stats.runs.toString() },
        { label: "Success Rate", value: `${stats.successRate}%` },
        { label: "Quality", value: `${stats.avgQuality}%` },
        {
            label: "Total Cost",
            value: stats.totalCost > 0 ? `$${stats.totalCost.toFixed(4)}` : "$0"
        },
        {
            label: "Avg Latency",
            value: stats.avgDurationMs ? `${(stats.avgDurationMs / 1000).toFixed(1)}s` : "-"
        },
        {
            label: "Feedback",
            value:
                stats.feedbackSummary.thumbsUp + stats.feedbackSummary.thumbsDown > 0
                    ? `${stats.feedbackSummary.thumbsUp}↑ ${stats.feedbackSummary.thumbsDown}↓`
                    : "-"
        }
    ];

    return (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {items.map((item) => (
                <div key={item.label} className="bg-muted rounded-lg p-2 text-center">
                    <p className="text-muted-foreground text-[10px]">{item.label}</p>
                    <p className="text-sm font-semibold">{item.value}</p>
                </div>
            ))}
        </div>
    );
}
