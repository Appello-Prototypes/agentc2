/**
 * Timezone-aware date formatting utilities.
 *
 * All functions accept an IANA timezone string (e.g. "America/New_York").
 * When no timezone is provided they fall back to the browser's local timezone.
 */

// ─── Absolute formatters ────────────────────────────────────────────────────

export function formatDate(dateInput: string | Date | null | undefined, timezone?: string): string {
    if (!dateInput) return "-";
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        ...(timezone ? { timeZone: timezone } : {})
    });
}

export function formatDateLong(
    dateInput: string | Date | null | undefined,
    timezone?: string
): string {
    if (!dateInput) return "-";
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        ...(timezone ? { timeZone: timezone } : {})
    });
}

export function formatDateTime(
    dateInput: string | Date | null | undefined,
    timezone?: string
): string {
    if (!dateInput) return "-";
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        ...(timezone ? { timeZone: timezone } : {})
    });
}

export function formatTime(dateInput: string | Date | null | undefined, timezone?: string): string {
    if (!dateInput) return "-";
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        ...(timezone ? { timeZone: timezone } : {})
    });
}

// ─── Relative formatter ─────────────────────────────────────────────────────

export function formatRelativeTime(
    dateInput: string | Date | null | undefined,
    timezone?: string
): string {
    if (!dateInput) return "Never";
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return "Never";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(date, timezone);
}

// ─── Common IANA timezone list for UI pickers ───────────────────────────────

export const COMMON_TIMEZONES = [
    { value: "Pacific/Honolulu", label: "(UTC-10:00) Hawaii" },
    { value: "America/Anchorage", label: "(UTC-09:00) Alaska" },
    { value: "America/Los_Angeles", label: "(UTC-08:00) Pacific Time" },
    { value: "America/Denver", label: "(UTC-07:00) Mountain Time" },
    { value: "America/Chicago", label: "(UTC-06:00) Central Time" },
    { value: "America/New_York", label: "(UTC-05:00) Eastern Time" },
    { value: "America/Halifax", label: "(UTC-04:00) Atlantic Time" },
    { value: "America/Sao_Paulo", label: "(UTC-03:00) Brasilia" },
    { value: "Atlantic/South_Georgia", label: "(UTC-02:00) Mid-Atlantic" },
    { value: "Atlantic/Azores", label: "(UTC-01:00) Azores" },
    { value: "UTC", label: "(UTC+00:00) UTC" },
    { value: "Europe/London", label: "(UTC+00:00) London" },
    { value: "Europe/Paris", label: "(UTC+01:00) Central European Time" },
    { value: "Europe/Helsinki", label: "(UTC+02:00) Eastern European Time" },
    { value: "Europe/Moscow", label: "(UTC+03:00) Moscow" },
    { value: "Asia/Dubai", label: "(UTC+04:00) Gulf Standard Time" },
    { value: "Asia/Karachi", label: "(UTC+05:00) Pakistan" },
    { value: "Asia/Kolkata", label: "(UTC+05:30) India" },
    { value: "Asia/Dhaka", label: "(UTC+06:00) Bangladesh" },
    { value: "Asia/Bangkok", label: "(UTC+07:00) Indochina" },
    { value: "Asia/Shanghai", label: "(UTC+08:00) China" },
    { value: "Asia/Singapore", label: "(UTC+08:00) Singapore" },
    { value: "Asia/Tokyo", label: "(UTC+09:00) Japan" },
    { value: "Australia/Sydney", label: "(UTC+10:00) Sydney" },
    { value: "Pacific/Auckland", label: "(UTC+12:00) New Zealand" }
] as const;
