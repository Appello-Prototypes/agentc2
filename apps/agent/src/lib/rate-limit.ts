type RateLimitOptions = {
    windowMs: number;
    max: number;
};

type RateLimitState = {
    count: number;
    resetAt: number;
};

const buckets = new Map<string, RateLimitState>();

const upstashRestUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashRestToken = process.env.UPSTASH_REDIS_REST_TOKEN;

function getBucketKey(key: string, resetAt: number) {
    return `ratelimit:${key}:${Math.floor(resetAt / 1000)}`;
}

async function checkDistributedRateLimit(key: string, options: RateLimitOptions) {
    if (!upstashRestUrl || !upstashRestToken) {
        return null;
    }

    const now = Date.now();
    const resetAt = now - (now % options.windowMs) + options.windowMs;
    const bucketKey = getBucketKey(key, resetAt);
    const ttlSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

    try {
        const res = await fetch(`${upstashRestUrl}/pipeline`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${upstashRestToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify([
                ["INCR", bucketKey],
                ["EXPIRE", bucketKey, ttlSeconds],
                ["GET", bucketKey]
            ])
        });
        if (!res.ok) {
            return null;
        }
        const payload = (await res.json()) as Array<{ result: string | number | null }>;
        const count = Number(payload?.[2]?.result ?? payload?.[0]?.result ?? 0);
        return {
            allowed: count <= options.max,
            remaining: Math.max(0, options.max - count),
            resetAt
        };
    } catch {
        return null;
    }
}

export async function checkRateLimit(key: string, options: RateLimitOptions) {
    const distributed = await checkDistributedRateLimit(key, options);
    if (distributed) {
        return distributed;
    }

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
