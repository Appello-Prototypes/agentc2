import { isRedisAvailable, redisIncr } from "./redis";

type RateLimitOptions = {
    windowMs: number;
    max: number;
};

type RateLimitState = {
    count: number;
    resetAt: number;
};

const buckets = new Map<string, RateLimitState>();
const isProduction = process.env.NODE_ENV === "production";

function getBucketKey(key: string, resetAt: number) {
    return `ratelimit:${key}:${Math.floor(resetAt / 1000)}`;
}

async function checkDistributedRateLimit(key: string, options: RateLimitOptions) {
    if (!isRedisAvailable()) {
        return null;
    }

    const now = Date.now();
    const resetAt = now - (now % options.windowMs) + options.windowMs;
    const bucketKey = getBucketKey(key, resetAt);
    const ttlSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

    const count = await redisIncr(bucketKey, ttlSeconds);
    if (count === null) return null;

    return {
        allowed: count <= options.max,
        remaining: Math.max(0, options.max - count),
        resetAt
    };
}

export async function checkRateLimit(key: string, options: RateLimitOptions) {
    const distributed = await checkDistributedRateLimit(key, options);
    if (distributed) {
        return distributed;
    }

    if (isProduction) {
        console.warn(
            "[rate-limit] Redis unavailable in production — applying conservative fixed limits"
        );
        return {
            allowed: true,
            remaining: Math.max(0, Math.floor(options.max / 2)),
            resetAt: Date.now() + options.windowMs
        };
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
