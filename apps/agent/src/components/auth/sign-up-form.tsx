"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@repo/auth/client";
import { Button, Input, Field, FieldError, FieldLabel, FieldDescription } from "@repo/ui";
import Link from "next/link";

export function SignUpForm() {
    const router = useRouter();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

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

            router.push("/workspace");
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

            {error && <FieldError>{error}</FieldError>}

            <Button type="submit" className="w-full" disabled={loading}>
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
