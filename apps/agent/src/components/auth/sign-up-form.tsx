"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signUp } from "@repo/auth/client";
import { Button, Input, Field, FieldError, FieldLabel, FieldDescription } from "@repo/ui";
import Link from "next/link";

const GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar.readonly"
];

export function SignUpForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState(false);

    useEffect(() => {
        const invite = searchParams.get("invite");
        if (invite) {
            setInviteCode(invite);
        }
    }, [searchParams]);

    const handleGoogleSignUp = async () => {
        setError("");
        setSocialLoading(true);

        try {
            await signIn.social({
                provider: "google",
                requestSignUp: true,
                callbackURL: "/onboarding",
                scopes: GMAIL_SCOPES
            });
        } catch (err) {
            setError("An unexpected error occurred");
            console.error(err);
            setSocialLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
        <form onSubmit={handleSubmit} className="space-y-4">
            <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignUp}
                disabled={loading || socialLoading}
            >
                {socialLoading ? "Connecting to Google..." : "Sign Up with Google"}
            </Button>

            <div className="text-muted-foreground text-center text-xs">or</div>

            <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="John Doe"
                />
            </Field>

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
                    autoComplete="new-password"
                    placeholder="••••••••"
                    minLength={8}
                />
                <FieldDescription>Password must be at least 8 characters long</FieldDescription>
            </Field>

            <Field>
                <FieldLabel htmlFor="inviteCode">Invite Code (optional)</FieldLabel>
                <Input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Enter invite code"
                    autoComplete="off"
                />
            </Field>

            {error && <FieldError>{error}</FieldError>}

            <Button type="submit" className="w-full" disabled={loading || socialLoading}>
                {loading ? "Creating account..." : "Sign Up"}
            </Button>

            <p className="text-muted-foreground text-center text-sm">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline">
                    Sign in
                </Link>
            </p>
        </form>
    );
}
