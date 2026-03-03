export const TIMEZONE_COOKIE = "admin-timezone";

export const TIMEZONE_OPTIONS = [
    { value: "America/New_York", label: "Eastern (ET)" },
    { value: "America/Chicago", label: "Central (CT)" },
    { value: "America/Denver", label: "Mountain (MT)" },
    { value: "America/Los_Angeles", label: "Pacific (PT)" },
    { value: "America/Anchorage", label: "Alaska (AKT)" },
    { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
    { value: "UTC", label: "UTC" },
    { value: "Europe/London", label: "London (GMT/BST)" },
    { value: "Europe/Paris", label: "Central Europe (CET)" },
    { value: "Europe/Berlin", label: "Berlin (CET)" },
    { value: "Europe/Moscow", label: "Moscow (MSK)" },
    { value: "Asia/Dubai", label: "Dubai (GST)" },
    { value: "Asia/Kolkata", label: "India (IST)" },
    { value: "Asia/Shanghai", label: "China (CST)" },
    { value: "Asia/Tokyo", label: "Tokyo (JST)" },
    { value: "Asia/Seoul", label: "Seoul (KST)" },
    { value: "Australia/Sydney", label: "Sydney (AEST)" },
    { value: "Pacific/Auckland", label: "Auckland (NZST)" }
];

export function formatDate(date: Date | string, timezone: string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", { timeZone: timezone });
}

export function formatDateLong(date: Date | string, timezone: string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
        timeZone: timezone,
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

export function formatDateTime(date: Date | string, timezone: string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("en-US", { timeZone: timezone });
}

export function formatTime(date: Date | string, timezone: string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleTimeString("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit"
    });
}

export function formatISOTz(date: Date | string, timezone: string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("sv-SE", { timeZone: timezone }).replace(" ", "T");
}

export function formatRelativeTime(date: Date | string, timezone: string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return formatDate(d, timezone);
}
