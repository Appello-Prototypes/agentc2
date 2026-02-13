"use client";

const ADMIN_AUTH_COOKIE = "admin-auth-token";

/**
 * Client-side admin auth helpers.
 */
export async function adminSignIn(
    email: string,
    password: string
): Promise<{ success: boolean; error?: string }> {
    const res = await fetch("/admin/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include"
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || "Login failed" };
    }

    return { success: true };
}

export async function adminSignOut(): Promise<void> {
    await fetch("/admin/api/auth/logout", {
        method: "POST",
        credentials: "include"
    });
}

export async function getAdminSession(): Promise<{
    authenticated: boolean;
    admin?: {
        id: string;
        email: string;
        name: string;
        role: string;
    };
} | null> {
    try {
        const res = await fetch("/admin/api/auth/session", {
            credentials: "include"
        });
        if (!res.ok) return { authenticated: false };
        return await res.json();
    } catch {
        return { authenticated: false };
    }
}

export { ADMIN_AUTH_COOKIE };
