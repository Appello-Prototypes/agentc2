/**
 * In-memory rate limiter for admin login hardening.
 *
 * Tracks failed login attempts per IP and per email to prevent brute-force
 * attacks. Uses a sliding-window approach with automatic cleanup.
 *
 * In a multi-instance deployment, replace with Redis-backed rate limiting.
 */

interface AttemptRecord {
    count: number;
    firstAttempt: number;
    lastAttempt: number;
    lockedUntil: number | null;
}

const IP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const IP_MAX_ATTEMPTS = 10; // Max attempts per IP in window
const IP_LOCKOUT_MS = 30 * 60 * 1000; // 30-minute lockout after exceeding

const EMAIL_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const EMAIL_MAX_ATTEMPTS = 5; // Max attempts per email in window
const EMAIL_LOCKOUT_MS = 15 * 60 * 1000; // 15-minute lockout after exceeding

const ipAttempts = new Map<string, AttemptRecord>();
const emailAttempts = new Map<string, AttemptRecord>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Clean up stale entries every 5 minutes

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
    if (cleanupTimer) return;
    cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [key, record] of ipAttempts) {
            if (
                now - record.lastAttempt > IP_WINDOW_MS &&
                (!record.lockedUntil || now > record.lockedUntil)
            ) {
                ipAttempts.delete(key);
            }
        }
        for (const [key, record] of emailAttempts) {
            if (
                now - record.lastAttempt > EMAIL_WINDOW_MS &&
                (!record.lockedUntil || now > record.lockedUntil)
            ) {
                emailAttempts.delete(key);
            }
        }
    }, CLEANUP_INTERVAL_MS);
    if (cleanupTimer.unref) cleanupTimer.unref();
}

function checkLimit(
    store: Map<string, AttemptRecord>,
    key: string,
    windowMs: number,
    maxAttempts: number,
    lockoutMs: number
): { allowed: boolean; retryAfterMs?: number; remainingAttempts: number } {
    ensureCleanup();
    const now = Date.now();
    const record = store.get(key);

    if (!record) {
        return { allowed: true, remainingAttempts: maxAttempts };
    }

    if (record.lockedUntil && now < record.lockedUntil) {
        return {
            allowed: false,
            retryAfterMs: record.lockedUntil - now,
            remainingAttempts: 0
        };
    }

    if (record.lockedUntil && now >= record.lockedUntil) {
        store.delete(key);
        return { allowed: true, remainingAttempts: maxAttempts };
    }

    if (now - record.firstAttempt > windowMs) {
        store.delete(key);
        return { allowed: true, remainingAttempts: maxAttempts };
    }

    const remaining = maxAttempts - record.count;
    return { allowed: remaining > 0, remainingAttempts: Math.max(0, remaining) };
}

function recordAttempt(
    store: Map<string, AttemptRecord>,
    key: string,
    windowMs: number,
    maxAttempts: number,
    lockoutMs: number
): void {
    const now = Date.now();
    const record = store.get(key);

    if (!record || now - record.firstAttempt > windowMs) {
        store.set(key, {
            count: 1,
            firstAttempt: now,
            lastAttempt: now,
            lockedUntil: null
        });
        return;
    }

    record.count++;
    record.lastAttempt = now;

    if (record.count >= maxAttempts) {
        record.lockedUntil = now + lockoutMs;
    }
}

export interface RateLimitResult {
    allowed: boolean;
    retryAfterMs?: number;
    remainingAttempts: number;
    reason?: string;
}

/**
 * Check if a login attempt is allowed for the given IP and email.
 * Call this BEFORE attempting authentication.
 */
export function checkLoginRateLimit(ip: string, email?: string): RateLimitResult {
    const ipCheck = checkLimit(ipAttempts, ip, IP_WINDOW_MS, IP_MAX_ATTEMPTS, IP_LOCKOUT_MS);
    if (!ipCheck.allowed) {
        return {
            allowed: false,
            retryAfterMs: ipCheck.retryAfterMs,
            remainingAttempts: 0,
            reason: "Too many login attempts from this IP address"
        };
    }

    if (email) {
        const emailCheck = checkLimit(
            emailAttempts,
            email.toLowerCase(),
            EMAIL_WINDOW_MS,
            EMAIL_MAX_ATTEMPTS,
            EMAIL_LOCKOUT_MS
        );
        if (!emailCheck.allowed) {
            return {
                allowed: false,
                retryAfterMs: emailCheck.retryAfterMs,
                remainingAttempts: 0,
                reason: "Too many login attempts for this account"
            };
        }
        return {
            allowed: true,
            remainingAttempts: Math.min(ipCheck.remainingAttempts, emailCheck.remainingAttempts)
        };
    }

    return { allowed: true, remainingAttempts: ipCheck.remainingAttempts };
}

/**
 * Record a failed login attempt for rate limiting.
 * Call this AFTER a failed authentication attempt.
 */
export function recordFailedLogin(ip: string, email?: string): void {
    recordAttempt(ipAttempts, ip, IP_WINDOW_MS, IP_MAX_ATTEMPTS, IP_LOCKOUT_MS);
    if (email) {
        recordAttempt(
            emailAttempts,
            email.toLowerCase(),
            EMAIL_WINDOW_MS,
            EMAIL_MAX_ATTEMPTS,
            EMAIL_LOCKOUT_MS
        );
    }
}

/**
 * Clear rate limit records for a successful login.
 * Resets the attempt counter so legitimate users aren't locked out
 * after a successful login.
 */
export function clearLoginRateLimit(ip: string, email?: string): void {
    ipAttempts.delete(ip);
    if (email) {
        emailAttempts.delete(email.toLowerCase());
    }
}
