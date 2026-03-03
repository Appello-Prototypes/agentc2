"use client";

import Link from "next/link";
import { cn, buttonVariants } from "@repo/ui";
import { ChannelDeploymentIllustration } from "@/components/website/illustrations";

const channels = [
    "Web Chat",
    "Slack",
    "WhatsApp",
    "Telegram",
    "Voice",
    "Email",
    "White-Label Embed"
];

function CheckIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}

export function ChannelDeployment() {
    return (
        <section className="bg-muted/30 py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
                    <div>
                        <span className="text-primary text-xs font-semibold tracking-wider uppercase">
                            MULTI-CHANNEL
                        </span>
                        <h2 className="text-foreground mt-4 text-2xl font-bold tracking-tight md:text-3xl">
                            Deploy once. Reach everywhere.
                        </h2>
                        <p className="text-muted-foreground mt-4 max-w-lg text-lg leading-relaxed">
                            Your agents aren&apos;t trapped in a chat window. Deploy to every
                            channel your team and customers use — with unified conversation memory,
                            intelligent routing, and per-channel commands.
                        </p>
                        <div className="mt-6 grid grid-cols-2 gap-3">
                            {channels.map((channel, index) => (
                                <div
                                    key={index}
                                    className="text-muted-foreground flex items-center gap-2 text-sm"
                                >
                                    <CheckIcon className="shrink-0 text-emerald-500" />
                                    <span>{channel}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8">
                            <Link
                                href="/platform/channels"
                                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                            >
                                Explore Channels
                            </Link>
                        </div>
                    </div>
                    <div className="hidden items-center justify-center lg:flex">
                        <ChannelDeploymentIllustration className="w-full max-w-md" />
                    </div>
                </div>
            </div>
        </section>
    );
}
