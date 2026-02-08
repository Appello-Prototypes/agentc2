type InputMapping = {
    template?: string;
    field?: string;
    jsonPath?: string;
    config?: Record<string, unknown>;
};

const normalizePath = (path: string) => path.replace(/^\$\./, "");

const getValueAtPath = (payload: Record<string, unknown>, path: string) => {
    const normalized = normalizePath(path);
    return normalized.split(".").reduce<unknown>((acc, key) => {
        if (!acc || typeof acc !== "object") return undefined;
        return (acc as Record<string, unknown>)[key];
    }, payload);
};

const parseEmailList = (value: unknown) => {
    if (Array.isArray(value)) {
        return value.filter((item) => typeof item === "string") as string[];
    }
    if (typeof value !== "string") return [];
    const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
    return matches ? matches.map((email) => email.toLowerCase()) : [];
};

const matchesKeywordFilter = (payload: Record<string, unknown>, keywords: string[]) => {
    const haystack = [payload.subject, payload.snippet, payload.bodyText, payload.bodyHtml]
        .filter((value) => typeof value === "string")
        .join(" ")
        .toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
};

const computeBusinessHoursMatch = (
    payload: Record<string, unknown>,
    config: { start?: number; end?: number; timezone?: string; enabled?: boolean }
) => {
    const receivedAt = typeof payload.receivedAt === "string" ? new Date(payload.receivedAt) : null;
    if (!receivedAt || Number.isNaN(receivedAt.getTime())) {
        return false;
    }

    const timezone = config.timezone || "UTC";
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        hour12: false
    });
    const hour = Number(formatter.format(receivedAt));
    const start = typeof config.start === "number" ? config.start : 9;
    const end = typeof config.end === "number" ? config.end : 17;
    const inBusinessHours = hour >= start && hour < end;
    const expected = typeof config.enabled === "boolean" ? config.enabled : true;
    return inBusinessHours === expected;
};

const matchesFilterValue = (candidate: unknown, value: unknown) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        const operator = value as Record<string, unknown>;
        if ("$contains" in operator && typeof operator.$contains === "string") {
            if (typeof candidate !== "string") return false;
            return candidate.toLowerCase().includes(operator.$contains.toLowerCase());
        }
        if ("$in" in operator && Array.isArray(operator.$in)) {
            return operator.$in.includes(candidate);
        }
        if ("$exists" in operator && typeof operator.$exists === "boolean") {
            return operator.$exists ? candidate !== undefined : candidate === undefined;
        }
        if ("$includes" in operator && Array.isArray(operator.$includes)) {
            if (!Array.isArray(candidate)) return false;
            return operator.$includes.some((entry) => candidate.includes(entry));
        }
    }

    if (Array.isArray(value)) {
        if (Array.isArray(candidate)) {
            return value.some((entry) => candidate.includes(entry));
        }
        return value.includes(candidate);
    }

    return candidate === value;
};

export function matchesTriggerFilter(
    payload: Record<string, unknown>,
    filter?: Record<string, unknown> | null
) {
    if (!filter) return true;

    return Object.entries(filter).every(([key, value]) => {
        if (key === "keywords") {
            const keywords = Array.isArray(value)
                ? value.filter((entry) => typeof entry === "string")
                : typeof value === "string"
                  ? [value]
                  : [];
            if (keywords.length === 0) return true;
            return matchesKeywordFilter(payload, keywords);
        }

        if (key === "ccIncludes") {
            const candidates = parseEmailList(payload.cc ?? payload.parsedCc);
            const required = parseEmailList(value);
            if (required.length === 0) return true;
            return required.some((email) => candidates.includes(email));
        }

        if (key === "businessHours" && value && typeof value === "object") {
            return computeBusinessHoursMatch(
                payload,
                value as { start?: number; end?: number; timezone?: string; enabled?: boolean }
            );
        }

        const candidate = key.includes(".") ? getValueAtPath(payload, key) : payload[key];
        return matchesFilterValue(candidate, value);
    });
}

export function resolveTriggerInput(
    payload: Record<string, unknown>,
    inputMapping?: InputMapping | null,
    fallbackLabel?: string
) {
    if (inputMapping?.template) {
        return inputMapping.template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
            const value = getValueAtPath(payload, key);
            return value === undefined ? "" : String(value);
        });
    }

    if (inputMapping?.field) {
        const value = getValueAtPath(payload, inputMapping.field);
        return value === undefined ? JSON.stringify(payload) : String(value);
    }

    if (inputMapping?.jsonPath) {
        const value = getValueAtPath(payload, inputMapping.jsonPath);
        return value === undefined ? JSON.stringify(payload) : String(value);
    }

    if (fallbackLabel) {
        return `${fallbackLabel}: ${JSON.stringify(payload)}`;
    }

    return JSON.stringify(payload);
}
