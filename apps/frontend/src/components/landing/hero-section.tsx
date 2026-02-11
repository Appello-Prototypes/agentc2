"use client";

import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";

export function HeroSection() {
    return (
        <section id="hero" className="relative overflow-hidden pt-16">
            {/* Background gradient */}
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="from-primary/5 via-primary/3 absolute inset-0 bg-linear-to-br to-transparent" />
                <div className="bg-primary/5 absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full blur-3xl" />
                <div className="bg-primary/3 absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full blur-3xl" />
            </div>

            <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 md:py-28 lg:grid-cols-2 lg:gap-16 lg:py-36">
                {/* Left: Copy + Login */}
                <div className="flex flex-col justify-center">
                    <span className="text-primary mb-4 inline-block w-fit rounded-full border border-current/20 bg-current/5 px-3 py-1 text-xs font-semibold tracking-wider uppercase">
                        AI Agent Platform
                    </span>

                    <h1 className="text-foreground mb-6 text-4xl leading-tight font-bold tracking-tight md:text-5xl lg:text-6xl">
                        Your AI workforce, <span className="text-primary">orchestrated.</span>
                    </h1>

                    <p className="text-muted-foreground mb-10 max-w-lg text-lg leading-relaxed">
                        Build, deploy, and manage intelligent agents that connect to your tools,
                        learn from experience, and work across every channel.
                    </p>

                    {/* Login form */}
                    <div className="border-border/60 bg-card w-full max-w-md rounded-2xl border p-6 shadow-lg shadow-black/5">
                        <p className="text-foreground mb-4 text-sm font-medium">
                            Get started for free
                        </p>
                        <Suspense fallback={<div className="h-48" />}>
                            <SignInForm />
                        </Suspense>
                    </div>
                </div>

                {/* Right: Abstract agent network visual */}
                <div className="hidden items-center justify-center lg:flex">
                    <div className="relative h-[480px] w-full max-w-[520px]">
                        {/* Central hub */}
                        <div className="bg-primary/10 border-primary/20 absolute top-1/2 left-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-3xl border-2 shadow-xl">
                            <div className="text-primary text-2xl font-bold">C2</div>
                        </div>

                        {/* Orbiting agent nodes */}
                        {[
                            {
                                label: "CRM",
                                x: "15%",
                                y: "20%",
                                delay: "0s"
                            },
                            {
                                label: "Slack",
                                x: "75%",
                                y: "15%",
                                delay: "0.5s"
                            },
                            {
                                label: "Voice",
                                x: "85%",
                                y: "55%",
                                delay: "1s"
                            },
                            {
                                label: "Jira",
                                x: "70%",
                                y: "85%",
                                delay: "1.5s"
                            },
                            {
                                label: "Email",
                                x: "20%",
                                y: "80%",
                                delay: "2s"
                            },
                            {
                                label: "RAG",
                                x: "5%",
                                y: "50%",
                                delay: "2.5s"
                            }
                        ].map((node) => (
                            <div
                                key={node.label}
                                className="animate-landing-float absolute"
                                style={{
                                    left: node.x,
                                    top: node.y,
                                    animationDelay: node.delay
                                }}
                            >
                                <div className="bg-background border-border flex h-14 w-14 items-center justify-center rounded-2xl border shadow-md">
                                    <span className="text-foreground text-xs font-semibold">
                                        {node.label}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {/* Connection lines (SVG) */}
                        <svg
                            className="pointer-events-none absolute inset-0 h-full w-full"
                            viewBox="0 0 520 480"
                        >
                            {/* Lines from center (260, 240) to each node */}
                            {[
                                [78, 96],
                                [390, 72],
                                [442, 264],
                                [364, 408],
                                [104, 384],
                                [26, 240]
                            ].map(([x, y], i) => (
                                <line
                                    key={i}
                                    x1="260"
                                    y1="240"
                                    x2={x}
                                    y2={y}
                                    stroke="currentColor"
                                    strokeWidth="1"
                                    className="text-border"
                                    strokeDasharray="4 4"
                                    opacity="0.5"
                                />
                            ))}
                        </svg>
                    </div>
                </div>
            </div>
        </section>
    );
}
