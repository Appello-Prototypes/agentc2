"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@repo/auth/client";
import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";
import { MICROSOFT_OAUTH_SCOPES } from "@repo/auth/microsoft-scopes";
import { Button, Input, Field, FieldError, FieldLabel } from "@repo/ui";
import Link from "next/link";

function GoogleLogo({ className }: { className?: string }) {
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

function MicrosoftLogo({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#F25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
            <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
        </svg>
    );
}

export function SignInForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/workspace";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(() => {
        const errorParam = searchParams.get("error");
        if (errorParam === "no_account") {
            return "No account found. Please sign up first.";
        }
        return "";
    });
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const result = await signIn.email({
                email,
                password
            });

            if (result.error) {
                setError(result.error.message || "Failed to sign in");
                return;
            }

            router.push(callbackUrl);
            router.refresh();
        } catch (err) {
            setError("An unexpected error occurred");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSocialSignIn = async (provider: "google" | "microsoft") => {
        setError("");
        setSocialLoading(true);

        try {
            const scopes =
                provider === "google" ? [...GOOGLE_OAUTH_SCOPES] : [...MICROSOFT_OAUTH_SCOPES];
            await signIn.social({
                provider,
                callbackURL: callbackUrl,
                errorCallbackURL: "/login?error=no_account",
                scopes
            });
        } catch (err) {
            setError("An unexpected error occurred");
            console.error(err);
            setSocialLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Social sign-in buttons */}
            <div className="space-y-2">
                <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="relative w-full justify-center gap-3 border-slate-200 py-5 text-sm font-medium shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                    onClick={() => handleSocialSignIn("google")}
                    disabled={loading || socialLoading}
                >
                    <GoogleLogo className="size-5" />
                    {socialLoading ? "Connecting..." : "Continue with Google"}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="relative w-full justify-center gap-3 border-slate-200 py-5 text-sm font-medium shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                    onClick={() => handleSocialSignIn("microsoft")}
                    disabled={loading || socialLoading}
                >
                    <MicrosoftLogo className="size-5" />
                    {socialLoading ? "Connecting..." : "Continue with Microsoft"}
                </Button>
            </div>

            {/* Divider */}
            <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="text-muted-foreground bg-background px-2">
                        or continue with email
                    </span>
                </div>
            </div>

            {/* Email form */}
            <form onSubmit={handleSubmit} className="space-y-3">
                <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        placeholder="you@example.com"
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        placeholder="••••••••"
                    />
                </Field>

                {error && <FieldError>{error}</FieldError>}

                <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={loading || socialLoading}
                >
                    {loading ? "Signing in..." : "Sign in"}
                </Button>
            </form>

            <p className="text-muted-foreground text-center text-sm">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-primary font-medium hover:underline">
                    Sign up free
                </Link>
            </p>
        </div>
    );
}
