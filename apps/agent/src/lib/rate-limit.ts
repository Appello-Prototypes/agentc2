type RateLimitOptions = {
    windowMs: number;
    max: number;
};

type RateLimitState = {
    count: number;
    resetAt: number;
};

const buckets = new Map<string, RateLimitState>();

export function checkRateLimit(key: string, options: RateLimitOptions) {
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
        const resetAt = now + options.windowMs;
        buckets.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: options.max - 1, resetAt };
    }

    const nextCount = existing.count + 1;
    existing.count = nextCount;
    buckets.set(key, existing);

    return {
        allowed: nextCount <= options.max,
        remaining: Math.max(0, options.max - nextCount),
        resetAt: existing.resetAt
    };
}
