export type TimeRangeOption = "24h" | "7d" | "30d" | "90d" | "all";

export function getDateRange(timeRange: TimeRangeOption): { from: Date | null; to: Date | null } {
    if (timeRange === "all") {
        return { from: null, to: null };
    }

    const to = new Date();
    const from = new Date();

    switch (timeRange) {
        case "24h":
            from.setHours(from.getHours() - 24);
            break;
        case "7d":
            from.setDate(from.getDate() - 7);
            break;
        case "30d":
            from.setDate(from.getDate() - 30);
            break;
        case "90d":
            from.setDate(from.getDate() - 90);
            break;
        default:
            from.setDate(from.getDate() - 7);
    }

    return { from, to };
}
