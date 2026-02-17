"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signUp } from "@repo/auth/client";
import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";
import { Button, Input, Field, FieldError, FieldLabel, FieldDescription } from "@repo/ui";
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

interface SignUpFormProps {
    requireInviteCode?: boolean;
}

export function SignUpForm({ requireInviteCode = false }: SignUpFormProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState(false);
    const [showEmailForm, setShowEmailForm] = useState(false);

    useEffect(() => {
        const invite = searchParams.get("invite");
        if (invite) {
            setInviteCode(invite);
        }
    }, [searchParams]);

    const handleGoogleSignUp = async () => {
        if (requireInviteCode && !inviteCode.trim()) {
            setError("An invite code is required to sign up.");
            return;
        }
        setError("");
        setSocialLoading(true);

        try {
            // Store invite code in sessionStorage so the onboarding page can use it
            if (inviteCode.trim()) {
                sessionStorage.setItem("pendingInviteCode", inviteCode.trim());
            }
            await signIn.social({
                provider: "google",
                requestSignUp: true,
                callbackURL: "/onboarding",
                scopes: [...GOOGLE_OAUTH_SCOPES]
            });
        } catch (err) {
            setError("An unexpected error occurred");
            console.error(err);
            setSocialLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (requireInviteCode && !inviteCode.trim()) {
            setError("An invite code is required to sign up.");
            return;
        }

        setError("");
        setLoading(true);

        try {
            const result = await signUp.email({
                name,
                email,
                password
            });

            if (result.error) {
                setError(result.error.message || "Failed to create account");
                return;
            }

            const bootstrapResponse = await fetch("/api/auth/bootstrap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    inviteCode: inviteCode.trim() || undefined
                })
            });

            const bootstrapResult = await bootstrapResponse.json();
            if (!bootstrapResponse.ok || !bootstrapResult.success) {
                setError(bootstrapResult.error || "Failed to set up organization");
                return;
            }

            router.push("/onboarding");
            router.refresh();
        } catch (err) {
            setError("An unexpected error occurred");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Invite code field (above Google button when required) */}
            {requireInviteCode && (
                <Field>
                    <FieldLabel htmlFor="inviteCodeTop">Invite code</FieldLabel>
                    <Input
                        id="inviteCodeTop"
                        type="text"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        placeholder="Enter your invite code"
                        autoComplete="off"
                        required
                    />
                </Field>
            )}

            {/* Google sign-up - primary CTA */}
            <Button
                type="button"
                variant="outline"
                size="lg"
                className="relative w-full justify-center gap-3 border-slate-200 py-5 text-sm font-medium shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                onClick={handleGoogleSignUp}
                disabled={loading || socialLoading}
            >
                <GoogleLogo className="size-5" />
                {socialLoading ? "Connecting to Google..." : "Continue with Google"}
            </Button>

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

            {/* Email form - collapsible for cleaner initial view */}
            {!showEmailForm ? (
                <Button
                    type="button"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground w-full text-sm"
                    onClick={() => setShowEmailForm(true)}
                    disabled={loading || socialLoading}
                >
                    Sign up with email instead
                </Button>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                    <Field>
                        <FieldLabel htmlFor="name">Full name</FieldLabel>
                        <Input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            autoComplete="name"
                            placeholder="Jane Smith"
                        />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="email">Work email</FieldLabel>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            placeholder="jane@company.com"
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
                            autoComplete="new-password"
                            placeholder="••••••••"
                            minLength={8}
                        />
                        <FieldDescription>At least 8 characters</FieldDescription>
                    </Field>

                    {!requireInviteCode && inviteCode !== "" && (
                        <Field>
                            <FieldLabel htmlFor="inviteCode">Invite code</FieldLabel>
                            <Input
                                id="inviteCode"
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                placeholder="Enter invite code"
                                autoComplete="off"
                            />
                        </Field>
                    )}

                    {error && <FieldError>{error}</FieldError>}

                    <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        disabled={loading || socialLoading}
                    >
                        {loading ? "Creating account..." : "Create free account"}
                    </Button>
                </form>
            )}

            {error && !showEmailForm && <FieldError>{error}</FieldError>}

            {/* Sign in link */}
            <p className="text-muted-foreground text-center text-sm">
                Already have an account?{" "}
                <Link href="/login" className="text-primary font-medium hover:underline">
                    Sign in
                </Link>
            </p>
        </div>
    );
}
