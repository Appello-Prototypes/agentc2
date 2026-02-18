"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield } from "lucide-react";

function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
            />
            <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
            />
            <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
            />
            <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
            />
        </svg>
    );
}

export default function AdminLoginPage() {
    return (
        <Suspense>
            <AdminLoginForm />
        </Suspense>
    );
}

function AdminLoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [googleEnabled, setGoogleEnabled] = useState(false);

    useEffect(() => {
        const oauthError = searchParams.get("error");
        if (oauthError) {
            setError(oauthError);
        }

        fetch("/admin/api/auth/google/enabled")
            .then((r) => r.json())
            .then((data) => setGoogleEnabled(data.enabled))
            .catch(() => {});
    }, [searchParams]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/admin/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
                credentials: "include"
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 429) {
                    setError(data.error || "Too many login attempts. Please try again later.");
                } else {
                    setError(data.error || "Login failed");
                }
                return;
            }

            const callbackUrl = searchParams.get("callbackUrl") || "/";
            router.push(callbackUrl);
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    function handleGoogleSignIn() {
        const callbackUrl = searchParams.get("callbackUrl") || "/";
        window.location.href = `/admin/api/auth/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    }

    return (
        <div className="w-full max-w-sm space-y-6">
            <div className="text-center">
                <Shield className="text-primary mx-auto h-10 w-10" />
                <h1 className="mt-4 text-2xl font-bold">Admin Portal</h1>
                <p className="text-muted-foreground mt-1 text-sm">Internal access only</p>
            </div>

            {error && (
                <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                    {error}
                </div>
            )}

            {googleEnabled && (
                <>
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors"
                    >
                        <GoogleIcon className="h-5 w-5" />
                        Sign in with Google
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="border-border w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background text-muted-foreground px-2">or</span>
                        </div>
                    </div>
                </>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        placeholder="admin@company.com"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
                >
                    {loading ? "Signing in..." : "Sign In"}
                </button>
            </form>
        </div>
    );
}
