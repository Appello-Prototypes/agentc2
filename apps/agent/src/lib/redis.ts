/**
 * Centralized Redis client for AgentC2.
 *
 * Uses Upstash Redis REST API for compatibility with edge/serverless.
 * In production, Redis is REQUIRED — the app will fail to start without it.
 * In development, operations silently no-op and return null.
 */

const restUrl = process.env.UPSTASH_REDIS_REST_URL;
const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && (!restUrl || !restToken)) {
    console.error(
        "[FATAL] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production. " +
            "All in-memory state must be backed by Redis for cluster mode safety."
    );
}

export function isRedisAvailable(): boolean {
    return !!(restUrl && restToken);
}

async function redisCommand<T = unknown>(
    commands: Array<[string, ...Array<string | number>]>
): Promise<T[] | null> {
    if (!restUrl || !restToken) return null;

    try {
        const res = await fetch(`${restUrl}/pipeline`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${restToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(commands)
        });
        if (!res.ok) return null;
        const payload = (await res.json()) as Array<{ result: T }>;
        return payload.map((p) => p.result);
    } catch {
        return null;
    }
}

export async function redisGet(key: string): Promise<string | null> {
    const results = await redisCommand<string | null>([["GET", key]]);
    return results?.[0] ?? null;
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    const cmd: Array<[string, ...Array<string | number>]> = ttlSeconds
        ? [["SET", key, value, "EX", ttlSeconds]]
        : [["SET", key, value]];
    const results = await redisCommand(cmd);
    return results !== null;
}

export async function redisDel(key: string): Promise<boolean> {
    const results = await redisCommand([["DEL", key]]);
    return results !== null;
}

export async function redisIncr(key: string, ttlSeconds?: number): Promise<number | null> {
    const cmds: Array<[string, ...Array<string | number>]> = [["INCR", key]];
    if (ttlSeconds) cmds.push(["EXPIRE", key, ttlSeconds]);
    const results = await redisCommand<number>(cmds);
    return results?.[0] ?? null;
}

export async function redisSetJson<T>(
    key: string,
    value: T,
    ttlSeconds?: number
): Promise<boolean> {
    return redisSet(key, JSON.stringify(value), ttlSeconds);
}

export async function redisGetJson<T>(key: string): Promise<T | null> {
    const raw = await redisGet(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}
