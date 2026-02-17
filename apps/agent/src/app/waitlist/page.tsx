"use client";

import { useState } from "react";
import { AgentBrand } from "@/components/AgentBrand";
import { Button, Input, Field, FieldLabel, FieldError } from "@repo/ui";
import Link from "next/link";
import { BotIcon, GitBranchIcon, NetworkIcon, PlugIcon, CheckCircle2Icon } from "lucide-react";

const PLATFORM_FEATURES = [
    {
        icon: BotIcon,
        title: "AI Agents",
        description: "Build agents that use tools, remember context, and take action"
    },
    {
        icon: GitBranchIcon,
        title: "Workflows",
        description: "Multi-step automations with logic, approvals, and branching"
    },
    {
        icon: NetworkIcon,
        title: "Agent Networks",
        description: "Orchestrate multiple agents to collaborate on complex tasks"
    },
    {
        icon: PlugIcon,
        title: "40+ Integrations",
        description: "HubSpot, Jira, Slack, GitHub, Gmail, and more via MCP"
    }
];

export default function WaitlistPage() {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await fetch("/api/waitlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email.trim(),
                    name: name.trim() || undefined,
                    source: "landing"
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                setError(result.error || "Something went wrong. Please try again.");
                return;
            }

            setSubmitted(true);
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* Left panel - Value proposition (hidden on mobile) */}
            <div className="hidden bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12">
                <div>
                    <AgentBrand />
                </div>

                <div className="space-y-8">
                    <div className="space-y-4">
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Your AI agent platform.
                            <br />
                            <span className="bg-linear-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                                Coming soon.
                            </span>
                        </h1>
                        <p className="max-w-md text-lg leading-relaxed text-slate-300">
                            Build, deploy, and orchestrate AI agents that connect to your tools and
                            automate real work. Join the waitlist for early access.
                        </p>
                    </div>

                    {/* Feature list */}
                    <div className="grid gap-4">
                        {PLATFORM_FEATURES.map((feature) => (
                            <div key={feature.title} className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                                    <feature.icon className="size-4.5 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">
                                        {feature.title}
                                    </p>
                                    <p className="text-sm leading-relaxed text-slate-400">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div />
            </div>

            {/* Right panel - Waitlist form */}
            <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
                <div className="mx-auto w-full max-w-[420px]">
                    {/* Mobile-only brand */}
                    <div className="mb-8 flex items-center justify-center lg:hidden">
                        <AgentBrand />
                    </div>

                    {submitted ? (
                        /* Success state */
                        <div className="space-y-6 text-center">
                            <div className="flex justify-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/50">
                                    <CheckCircle2Icon className="size-8 text-emerald-500" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h1 className="text-2xl font-bold tracking-tight">
                                    You&apos;re on the list!
                                </h1>
                                <p className="text-muted-foreground text-sm">
                                    Thanks for your interest. We&apos;ll send you an invite when
                                    your spot is ready.
                                </p>
                            </div>
                            <div className="border-t pt-4">
                                <p className="text-muted-foreground text-sm">
                                    Already have an invite code?{" "}
                                    <Link
                                        href="/signup"
                                        className="text-primary font-medium hover:underline"
                                    >
                                        Sign up here
                                    </Link>
                                </p>
                            </div>
                        </div>
                    ) : (
                        /* Form state */
                        <>
                            {/* Early access badge */}
                            <div className="mb-6 flex justify-center lg:justify-start">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-400">
                                    <span className="inline-block size-1.5 rounded-full bg-blue-500" />
                                    Invite-only early access
                                </span>
                            </div>

                            {/* Heading */}
                            <div className="mb-8 space-y-2">
                                <h1 className="text-2xl font-bold tracking-tight">
                                    Join the Waitlist
                                </h1>
                                <p className="text-muted-foreground text-sm">
                                    We&apos;re onboarding new teams in batches. Leave your email and
                                    we&apos;ll send you an invite when your spot is ready.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
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
                                    <FieldLabel htmlFor="name">
                                        Name{" "}
                                        <span className="text-muted-foreground font-normal">
                                            (optional)
                                        </span>
                                    </FieldLabel>
                                    <Input
                                        id="name"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        autoComplete="name"
                                        placeholder="Jane Smith"
                                    />
                                </Field>

                                {error && <FieldError>{error}</FieldError>}

                                <Button
                                    type="submit"
                                    className="w-full"
                                    size="lg"
                                    disabled={loading}
                                >
                                    {loading ? "Joining..." : "Join the Waitlist"}
                                </Button>
                            </form>

                            <div className="mt-8 space-y-4">
                                <div className="border-t pt-4">
                                    <p className="text-muted-foreground text-center text-sm">
                                        Already have an account?{" "}
                                        <Link
                                            href="/login"
                                            className="text-primary font-medium hover:underline"
                                        >
                                            Log in
                                        </Link>
                                    </p>
                                    <p className="text-muted-foreground mt-2 text-center text-sm">
                                        Have an invite code?{" "}
                                        <Link
                                            href="/signup"
                                            className="text-primary font-medium hover:underline"
                                        >
                                            Sign up
                                        </Link>
                                    </p>
                                </div>

                                {/* What to expect - mobile */}
                                <div className="rounded-lg border border-dashed p-3 lg:hidden">
                                    <p className="text-muted-foreground mb-2 text-xs font-medium">
                                        What you&apos;ll get:
                                    </p>
                                    <ul className="text-muted-foreground space-y-1 text-xs">
                                        <li className="flex items-center gap-2">
                                            <span className="text-emerald-500">&#10003;</span>
                                            AI agents with 40+ tool integrations
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="text-emerald-500">&#10003;</span>
                                            Workflows and agent networks
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="text-emerald-500">&#10003;</span>
                                            Built-in memory and RAG
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="text-emerald-500">&#10003;</span>
                                            Ready-to-use templates
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
