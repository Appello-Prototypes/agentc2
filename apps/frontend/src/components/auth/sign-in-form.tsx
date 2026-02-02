"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@repo/auth/client";
import { Button, Input, Field, FieldError, FieldLabel } from "@repo/ui";
import Link from "next/link";

export function SignInForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

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

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
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

            <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
            </Button>

            <p className="text-muted-foreground text-center text-sm">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-primary hover:underline">
                    Sign up
                </Link>
            </p>
        </form>
    );
}
