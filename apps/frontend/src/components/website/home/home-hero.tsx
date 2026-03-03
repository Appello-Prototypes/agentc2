"use client";

import Link from "next/link";
import { cn, buttonVariants } from "@repo/ui";
import { AgentChatIllustration } from "@/components/website/illustrations";

export function HomeHero() {
    return (
        <section className="py-20 md:py-28 lg:py-32">
            <div className="mx-auto max-w-7xl px-6">
                <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
                    <div>
                        <span className="text-primary mb-4 block text-xs font-semibold tracking-wider uppercase">
                            AI AGENT OPERATIONS PLATFORM
                        </span>
                        <h1 className="text-foreground text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                            The AI Operating System for Your Organization
                        </h1>
                        <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed">
                            Build, deploy, and govern intelligent AI agents across web, Slack,
                            WhatsApp, voice, and more — with enterprise security, a playbook
                            marketplace, and the only cross-organization federation in the market.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }))}>
                                Get Started Free
                            </Link>
                            <Link
                                href="#how-it-works"
                                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                            >
                                See How It Works
                            </Link>
                        </div>
                    </div>
                    <div className="hidden items-center justify-center lg:flex">
                        <AgentChatIllustration className="w-full max-w-md" />
                    </div>
                </div>
            </div>
        </section>
    );
}
