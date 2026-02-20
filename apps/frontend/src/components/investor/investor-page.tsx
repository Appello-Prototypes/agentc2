"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

function useInView(threshold = 0.15) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) {
                    setVisible(true);
                    obs.disconnect();
                }
            },
            { threshold }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [threshold]);
    return { ref, visible };
}

function Section({
    children,
    className = "",
    id
}: {
    children: React.ReactNode;
    className?: string;
    id?: string;
}) {
    const { ref, visible } = useInView();
    return (
        <section
            ref={ref}
            id={id}
            className={`transition-all duration-700 ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"} ${className}`}
        >
            {children}
        </section>
    );
}

function StatCard({
    value,
    label,
    accent = false
}: {
    value: string;
    label: string;
    accent?: boolean;
}) {
    return (
        <div
            className={`rounded-2xl border p-6 text-center ${accent ? "border-primary/30 bg-primary/5" : "border-border/60 bg-card"}`}
        >
            <div
                className={`text-3xl font-bold tracking-tight md:text-4xl ${accent ? "text-primary" : "text-foreground"}`}
            >
                {value}
            </div>
            <div className="text-muted-foreground mt-1 text-sm">{label}</div>
        </div>
    );
}

export function InvestorPage() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <div className="bg-background text-foreground min-h-screen">
            {/* Nav */}
            <header
                className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
                    scrolled
                        ? "border-border/50 bg-background/80 border-b backdrop-blur-xl"
                        : "bg-transparent"
                }`}
            >
                <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
                    <Link href="/" className="flex items-center gap-2">
                        <Image
                            src="/c2-icon.png"
                            alt="AgentC2"
                            width={28}
                            height={28}
                            className="rounded-md"
                        />
                        <span className="text-lg font-semibold tracking-tight">AgentC2</span>
                    </Link>
                    <div className="hidden items-center gap-8 md:flex">
                        <a
                            href="#problem"
                            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                        >
                            Problem
                        </a>
                        <a
                            href="#solution"
                            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                        >
                            Solution
                        </a>
                        <a
                            href="#market"
                            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                        >
                            Market
                        </a>
                        <a
                            href="#traction"
                            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                        >
                            Traction
                        </a>
                        <a
                            href="#business"
                            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                        >
                            Business
                        </a>
                    </div>
                    <a
                        href="mailto:corey@agentc2.ai"
                        className="bg-primary text-primary-foreground hidden rounded-lg px-4 py-2 text-sm font-medium md:inline-flex"
                    >
                        Get in Touch
                    </a>
                </nav>
            </header>

            {/* ===== HERO ===== */}
            <section className="relative overflow-hidden pt-16">
                <div className="pointer-events-none absolute inset-0 -z-10">
                    <div className="from-primary/8 via-primary/3 absolute inset-0 bg-linear-to-br to-transparent" />
                    <div className="bg-primary/6 absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full blur-3xl" />
                    <div className="bg-primary/4 absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full blur-3xl" />
                </div>

                <div className="mx-auto max-w-7xl px-6 py-24 md:py-32 lg:py-40">
                    <div className="mx-auto max-w-4xl text-center">
                        <span className="text-primary mb-6 inline-block rounded-full border border-current/20 bg-current/5 px-4 py-1.5 text-xs font-semibold tracking-wider uppercase">
                            Investor Overview &mdash; February 2026
                        </span>

                        <h1 className="text-foreground mb-6 text-4xl leading-tight font-bold tracking-tight md:text-6xl lg:text-7xl">
                            AI Agents That Deliver <span className="text-primary">Results,</span>
                            <br />
                            Not Just Responses.
                        </h1>

                        <p className="text-muted-foreground mx-auto mb-10 max-w-2xl text-lg leading-relaxed md:text-xl">
                            The only AI agent platform with paying customers in a proven vertical,
                            zero churn, and a horizontal platform that launches in parallel &mdash;
                            two revenue tracks from one codebase.
                        </p>

                        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
                            <StatCard value="35" label="Companies" accent />
                            <StatCard value="0%" label="Churn" accent />
                            <StatCard value="$218" label="Total AI Cost" />
                            <StatCard value="90%" label="Gross Margin" />
                        </div>
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className="flex justify-center pb-8">
                    <div className="border-border/60 flex h-8 w-5 items-start justify-center rounded-full border p-1">
                        <div className="bg-primary h-2 w-1 animate-bounce rounded-full" />
                    </div>
                </div>
            </section>

            {/* ===== THE PROBLEM ===== */}
            <Section id="problem" className="py-24">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="mb-4 text-center">
                        <span className="text-primary text-sm font-semibold tracking-wider uppercase">
                            The Problem
                        </span>
                    </div>
                    <h2 className="text-foreground mb-6 text-center text-3xl font-bold tracking-tight md:text-4xl">
                        The AI Trust Cliff
                    </h2>
                    <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center text-lg">
                        Enterprises are experimenting with AI agents everywhere. Almost nobody has
                        made them work.
                    </p>

                    <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
                        <div className="border-border/60 bg-card rounded-2xl border p-8 text-center">
                            <div className="text-primary mb-2 text-5xl font-bold">62%</div>
                            <div className="text-foreground mb-2 text-base font-semibold">
                                Experimenting
                            </div>
                            <p className="text-muted-foreground text-sm">
                                of organizations are actively experimenting with AI agents in 2026
                            </p>
                        </div>
                        <div className="border-border/60 bg-card rounded-2xl border p-8 text-center">
                            <div className="text-destructive mb-2 text-5xl font-bold">2%</div>
                            <div className="text-foreground mb-2 text-base font-semibold">
                                Scaled
                            </div>
                            <p className="text-muted-foreground text-sm">
                                have achieved scaled deployment with measurable, repeatable outcomes
                            </p>
                        </div>
                        <div className="border-border/60 bg-card rounded-2xl border p-8 text-center">
                            <div className="text-primary mb-2 text-5xl font-bold">60%</div>
                            <div className="text-foreground mb-2 text-base font-semibold">
                                The Gap
                            </div>
                            <p className="text-muted-foreground text-sm">
                                of organizations are stuck in the middle &mdash; the trust cliff
                                AgentC2 is built to cross
                            </p>
                        </div>
                    </div>

                    <div className="from-primary/5 mx-auto mt-12 max-w-3xl rounded-2xl bg-linear-to-r to-transparent p-8">
                        <h3 className="text-foreground mb-3 text-lg font-semibold">Why the gap?</h3>
                        <div className="text-muted-foreground space-y-2 text-sm leading-relaxed">
                            <p>
                                Today&apos;s AI agent platforms sell{" "}
                                <strong className="text-foreground">hypotheses</strong>, not
                                results. They give you a builder and say &ldquo;imagine what AI
                                could do.&rdquo; But a VP of Sales doesn&apos;t want to build agents
                                &mdash; they want their pipeline auto-updated after every meeting.
                            </p>
                            <p>
                                The market is crowded with tools that connect to everything but
                                solve nothing specific. Zapier has 8,000 integrations with if/then
                                logic. Relevance AI has 100+ templates with no proof they work.
                                ChatGPT answers questions but can&apos;t run your operations.
                            </p>
                        </div>
                    </div>
                </div>
            </Section>

            {/* ===== THE SOLUTION ===== */}
            <Section id="solution" className="py-24">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="mb-4 text-center">
                        <span className="text-primary text-sm font-semibold tracking-wider uppercase">
                            The Solution
                        </span>
                    </div>
                    <h2 className="text-foreground mb-6 text-center text-3xl font-bold tracking-tight md:text-4xl">
                        AgentC2: AI Workforce Command &amp; Control
                    </h2>
                    <p className="text-muted-foreground mx-auto mb-16 max-w-3xl text-center text-lg">
                        AgentC2 deploys autonomous AI across the tools a business already uses
                        &mdash; and measures exactly what it saves. Pre-built recipes, not blank
                        canvases. Documented ROI, not marketing promises.
                    </p>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            {
                                title: "25+ Pre-Built Recipes",
                                desc: "Outcome-oriented solutions by department. Deploy in minutes with documented ROI per recipe.",
                                icon: (
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                        <line x1="3" y1="9" x2="21" y2="9" />
                                        <line x1="9" y1="21" x2="9" y2="9" />
                                    </svg>
                                )
                            },
                            {
                                title: "30+ MCP Integrations",
                                desc: "Gmail, HubSpot, Slack, Jira, GitHub, Fathom, ElevenLabs and more via Model Context Protocol.",
                                icon: (
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                                    </svg>
                                )
                            },
                            {
                                title: "Multi-Agent Networks",
                                desc: "Specialized agents collaborate: research, draft, update, notify. Orchestrated by an LLM routing layer.",
                                icon: (
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <circle cx="12" cy="5" r="3" />
                                        <circle cx="5" cy="19" r="3" />
                                        <circle cx="19" cy="19" r="3" />
                                        <line x1="12" y1="8" x2="5" y2="16" />
                                        <line x1="12" y1="8" x2="19" y2="16" />
                                        <line x1="5" y1="19" x2="19" y2="19" />
                                    </svg>
                                )
                            },
                            {
                                title: "Voice Agents",
                                desc: "ElevenLabs-powered natural voice. Answer calls, book appointments, conduct surveys. Category-defining.",
                                icon: (
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                                        <path d="M19 10v2a7 7 0 01-14 0v-2" />
                                        <line x1="12" y1="19" x2="12" y2="23" />
                                        <line x1="8" y1="23" x2="16" y2="23" />
                                    </svg>
                                )
                            }
                        ].map((item) => (
                            <div
                                key={item.title}
                                className="border-border/60 bg-card hover:border-primary/20 group rounded-2xl border p-6 transition-all duration-300"
                            >
                                <div className="bg-primary/10 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
                                    {item.icon}
                                </div>
                                <h3 className="text-foreground mb-2 text-base font-semibold">
                                    {item.title}
                                </h3>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    {item.desc}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Additional capabilities */}
                    <div className="border-border/60 bg-card mx-auto mt-12 max-w-5xl rounded-2xl border p-8">
                        <h3 className="text-foreground mb-6 text-center text-lg font-semibold">
                            Full-Stack Enterprise Platform
                        </h3>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            {[
                                "Knowledge Base (RAG)",
                                "Continuous Learning",
                                "Enterprise Governance",
                                "Execution Traces",
                                "Budget Controls",
                                "Guardrail Policies",
                                "RBAC & SSO",
                                "Canvas Dashboards"
                            ].map((feat) => (
                                <div key={feat} className="flex items-center gap-2">
                                    <div className="bg-primary h-1.5 w-1.5 shrink-0 rounded-full" />
                                    <span className="text-muted-foreground text-sm">{feat}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Section>

            {/* ===== WHAT MAKES IT DIFFERENT ===== */}
            <Section className="py-24">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="mb-4 text-center">
                        <span className="text-primary text-sm font-semibold tracking-wider uppercase">
                            Positioning
                        </span>
                    </div>
                    <h2 className="text-foreground mb-6 text-center text-3xl font-bold tracking-tight md:text-4xl">
                        Every Other Platform Sells a Hypothesis.
                        <br />
                        <span className="text-primary">AgentC2 Sells a Result.</span>
                    </h2>
                    <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center text-lg">
                        No other platform sits at the intersection of vertical proof + horizontal
                        platform + recipe ecosystem + MCP breadth + voice + multi-agent
                        orchestration.
                    </p>

                    <div className="mx-auto max-w-5xl overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-border/60 border-b">
                                    <th className="text-muted-foreground py-3 pr-4 text-left font-medium">
                                        Capability
                                    </th>
                                    <th className="text-primary px-4 py-3 text-center font-semibold">
                                        AgentC2
                                    </th>
                                    <th className="text-muted-foreground px-4 py-3 text-center font-medium">
                                        Zapier
                                    </th>
                                    <th className="text-muted-foreground px-4 py-3 text-center font-medium">
                                        Relevance AI
                                    </th>
                                    <th className="text-muted-foreground px-4 py-3 text-center font-medium">
                                        Lindy AI
                                    </th>
                                    <th className="text-muted-foreground px-4 py-3 text-center font-medium">
                                        OpenAI
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    ["Multi-agent orchestration", true, false, false, false, false],
                                    ["Pre-built recipes", true, "partial", true, "partial", false],
                                    ["30+ MCP integrations", true, false, false, false, false],
                                    ["Voice agents (included)", true, false, false, "paid", false],
                                    ["Knowledge base (RAG)", true, false, "partial", false, false],
                                    ["Continuous learning", true, false, false, false, false],
                                    ["Enterprise governance", true, false, false, false, false],
                                    [
                                        "Vertical proof (paying customers)",
                                        true,
                                        false,
                                        false,
                                        false,
                                        false
                                    ]
                                ].map(([label, ...vals]) => (
                                    <tr
                                        key={label as string}
                                        className="border-border/30 border-b last:border-0"
                                    >
                                        <td className="text-foreground py-3 pr-4 font-medium">
                                            {label as string}
                                        </td>
                                        {(vals as (boolean | string)[]).map((v, i) => (
                                            <td key={i} className="px-4 py-3 text-center">
                                                {v === true ? (
                                                    <span className="text-primary text-lg">
                                                        &#10003;
                                                    </span>
                                                ) : v === false ? (
                                                    <span className="text-muted-foreground/40 text-lg">
                                                        &mdash;
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">
                                                        {v}
                                                    </span>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Key vs statements */}
                    <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
                        {[
                            {
                                vs: "vs. Zapier",
                                line: "8,000 shallow connections vs. 30 deep MCP integrations with AI reasoning at every step."
                            },
                            {
                                vs: "vs. Relevance AI",
                                line: "Named products with documented ROI from 35 real companies, not blank-canvas builders."
                            },
                            {
                                vs: "vs. OpenAI / ChatGPT",
                                line: "Cross-tool orchestration that runs without a human in the loop. Not a chatbot."
                            },
                            {
                                vs: "vs. Salesforce AgentForce",
                                line: "Works across any tool stack. SMB-friendly pricing. Deploys in minutes, not months."
                            }
                        ].map((item) => (
                            <div key={item.vs} className="border-border/40 rounded-xl border p-5">
                                <div className="text-primary mb-1 text-xs font-semibold uppercase">
                                    {item.vs}
                                </div>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    {item.line}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </Section>

            {/* ===== MARKET OPPORTUNITY ===== */}
            <Section id="market" className="py-24">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="mb-4 text-center">
                        <span className="text-primary text-sm font-semibold tracking-wider uppercase">
                            Market Opportunity
                        </span>
                    </div>
                    <h2 className="text-foreground mb-6 text-center text-3xl font-bold tracking-tight md:text-4xl">
                        The AI Agent Platform Market
                    </h2>
                    <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center text-lg">
                        A rapidly growing market where the winners won&apos;t be the ones with the
                        most features &mdash; they&apos;ll be the ones with the most proof.
                    </p>

                    <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
                        <div className="from-primary/10 rounded-2xl bg-linear-to-br to-transparent p-8 text-center">
                            <div className="text-foreground mb-1 text-4xl font-bold">$8-11B</div>
                            <div className="text-primary mb-2 text-sm font-semibold">
                                2026 Market Size
                            </div>
                            <p className="text-muted-foreground text-xs">
                                AI agent platform market valuation
                            </p>
                        </div>
                        <div className="from-primary/10 rounded-2xl bg-linear-to-br to-transparent p-8 text-center">
                            <div className="text-foreground mb-1 text-4xl font-bold">40-45%</div>
                            <div className="text-primary mb-2 text-sm font-semibold">CAGR</div>
                            <p className="text-muted-foreground text-xs">
                                Compound annual growth rate
                            </p>
                        </div>
                        <div className="from-primary/10 rounded-2xl bg-linear-to-br to-transparent p-8 text-center">
                            <div className="text-foreground mb-1 text-4xl font-bold">$50-200B</div>
                            <div className="text-primary mb-2 text-sm font-semibold">2030-2034</div>
                            <p className="text-muted-foreground text-xs">
                                Projected market size at maturity
                            </p>
                        </div>
                    </div>

                    {/* Market position */}
                    <div className="border-border/60 bg-card mx-auto mt-12 max-w-4xl rounded-2xl border p-8">
                        <h3 className="text-foreground mb-6 text-center text-lg font-semibold">
                            Competitive Landscape Map
                        </h3>
                        <div className="relative mx-auto aspect-16/10 max-w-2xl">
                            {/* Axes */}
                            <div className="border-border/40 absolute inset-x-0 top-1/2 border-t" />
                            <div className="border-border/40 absolute inset-y-0 left-1/2 border-l" />

                            {/* Labels */}
                            <div className="text-muted-foreground absolute top-0 left-1/2 -translate-x-1/2 text-[10px] font-medium tracking-wider uppercase">
                                Enterprise
                            </div>
                            <div className="text-muted-foreground absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] font-medium tracking-wider uppercase">
                                SMB / Consumer
                            </div>
                            <div className="text-muted-foreground absolute top-1/2 left-0 -translate-y-1/2 -rotate-90 text-[10px] font-medium tracking-wider uppercase">
                                Vertical
                            </div>
                            <div className="text-muted-foreground absolute top-1/2 right-0 -translate-y-1/2 rotate-90 text-[10px] font-medium tracking-wider uppercase">
                                Horizontal
                            </div>

                            {/* Competitor dots */}
                            {[
                                { name: "OpenAI", x: "70%", y: "15%", size: "sm" },
                                { name: "Salesforce", x: "25%", y: "10%", size: "sm" },
                                { name: "Zapier", x: "80%", y: "60%", size: "sm" },
                                { name: "Relevance", x: "75%", y: "65%", size: "sm" },
                                { name: "Lindy", x: "72%", y: "72%", size: "sm" },
                                { name: "n8n", x: "65%", y: "55%", size: "sm" },
                                { name: "CrewAI", x: "78%", y: "78%", size: "sm" }
                            ].map((c) => (
                                <div
                                    key={c.name}
                                    className="absolute flex flex-col items-center"
                                    style={{ left: c.x, top: c.y }}
                                >
                                    <div className="bg-muted-foreground/30 h-2.5 w-2.5 rounded-full" />
                                    <span className="text-muted-foreground mt-0.5 text-[9px]">
                                        {c.name}
                                    </span>
                                </div>
                            ))}

                            {/* AgentC2 - highlighted */}
                            <div
                                className="absolute flex flex-col items-center"
                                style={{ left: "42%", top: "42%" }}
                            >
                                <div className="border-primary bg-primary/20 relative h-8 w-8 rounded-full border-2">
                                    <div className="bg-primary/30 absolute inset-0 animate-ping rounded-full" />
                                </div>
                                <span className="text-primary mt-1 text-xs font-bold">AgentC2</span>
                            </div>
                        </div>
                        <p className="text-muted-foreground mt-4 text-center text-xs">
                            AgentC2 uniquely combines vertical proof with horizontal platform
                            ambition &mdash; no competitor occupies this position.
                        </p>
                    </div>
                </div>
            </Section>

            {/* ===== TRACTION / PROOF ===== */}
            <Section id="traction" className="py-24">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="mb-4 text-center">
                        <span className="text-primary text-sm font-semibold tracking-wider uppercase">
                            Traction
                        </span>
                    </div>
                    <h2 className="text-foreground mb-6 text-center text-3xl font-bold tracking-tight md:text-4xl">
                        Proven in Production. Zero Churn.
                    </h2>
                    <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center text-lg">
                        While competitors demo hypotheticals, AgentC2 runs inside real businesses
                        every day &mdash; with documented, named case studies.
                    </p>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard value="35" label="Paying Companies" accent />
                        <StatCard value="0%" label="Churn (3+ years)" accent />
                        <StatCard value="10+" label="Hrs/Week Saved (avg)" />
                        <StatCard value="40+" label="Agents in Production" />
                    </div>

                    {/* Case studies */}
                    <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {[
                            {
                                company: "Vanos Insulations",
                                industry: "Mechanical Insulation",
                                result: "3 payroll admins reduced to 1",
                                detail: "Founding customer. Zero churn, 3+ years."
                            },
                            {
                                company: "R.A. Barnes Electrical",
                                industry: "Electrical",
                                result: "50% admin time reduction",
                                detail: "Eliminated a full-time admin role."
                            },
                            {
                                company: "All Temp Insulations",
                                industry: "Mechanical Insulation",
                                result: "30% overhead reduction",
                                detail: '"My little command center."'
                            },
                            {
                                company: "Appello (Internal)",
                                industry: "SaaS Operations",
                                result: "40+ agents, $218 total AI cost",
                                detail: "Runs its own operations on AgentC2."
                            }
                        ].map((cs) => (
                            <div
                                key={cs.company}
                                className="border-border/60 bg-card rounded-2xl border p-6"
                            >
                                <div className="text-foreground mb-1 text-sm font-semibold">
                                    {cs.company}
                                </div>
                                <div className="text-muted-foreground mb-3 text-xs">
                                    {cs.industry}
                                </div>
                                <div className="text-primary mb-2 text-sm font-bold">
                                    {cs.result}
                                </div>
                                <p className="text-muted-foreground text-xs">{cs.detail}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </Section>

            {/* ===== THE STORY ===== */}
            <Section className="py-24">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="from-primary/5 mx-auto max-w-4xl rounded-3xl bg-linear-to-br to-transparent p-10 md:p-16">
                        <div className="mb-4">
                            <span className="text-primary text-sm font-semibold tracking-wider uppercase">
                                The Origin Story
                            </span>
                        </div>
                        <h2 className="text-foreground mb-8 text-2xl font-bold tracking-tight md:text-3xl">
                            From Construction Software to AI Platform
                        </h2>
                        <div className="text-muted-foreground space-y-4 text-sm leading-relaxed md:text-base md:leading-relaxed">
                            <p>
                                Three years ago, Corey Shelson built{" "}
                                <strong className="text-foreground">Appello</strong> because he
                                watched construction companies drown in paper. Timesheets on
                                dashboards of pickup trucks. Safety forms in filing cabinets.
                                Dispatchers untangling yesterday&apos;s mess on a whiteboard.
                            </p>
                            <p>
                                He built it. It worked.{" "}
                                <strong className="text-foreground">
                                    35 companies signed up. Zero left.
                                </strong>{" "}
                                Vanos Insulations went from three payroll administrators to one. The
                                product hit $400K in annual revenue with a 10-person team.
                            </p>
                            <p>
                                Then Corey kept building. While his team shipped features by day, he
                                spent nights wiring 30 integrations through Model Context Protocol
                                so AI agents could read, search, and act across every system the
                                business touches. He built 40 agents. Total AI cost:{" "}
                                <strong className="text-foreground">$218</strong>.
                            </p>
                            <p>
                                The obvious question:{" "}
                                <em>
                                    if this works for us, why wouldn&apos;t it work for our
                                    customers?
                                </em>
                            </p>
                            <p>
                                The construction vertical isn&apos;t the business. It&apos;s the{" "}
                                <strong className="text-primary">proof</strong>. The business is
                                AgentC2: a public platform where anyone can browse pre-built
                                recipes, connect their tools with one click, and have an AI agent
                                running in five minutes.
                            </p>
                        </div>
                    </div>
                </div>
            </Section>

            {/* ===== BUSINESS MODEL ===== */}
            <Section id="business" className="py-24">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="mb-4 text-center">
                        <span className="text-primary text-sm font-semibold tracking-wider uppercase">
                            Business Model
                        </span>
                    </div>
                    <h2 className="text-foreground mb-6 text-center text-3xl font-bold tracking-tight md:text-4xl">
                        Two Revenue Tracks. One Codebase.
                    </h2>
                    <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center text-lg">
                        Vertical proof feeds horizontal scale. Construction customers become case
                        studies that sell the platform to every industry.
                    </p>

                    <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
                        {/* Track A */}
                        <div className="border-primary/30 bg-primary/5 rounded-2xl border p-8">
                            <div className="text-primary mb-1 text-xs font-semibold tracking-wider uppercase">
                                Track A
                            </div>
                            <h3 className="text-foreground mb-4 text-xl font-bold">
                                Appello Intelligence
                            </h3>
                            <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                                AI layer on top of existing Appello construction software. Bundled
                                on existing bills. Zero CAC on first 20 customers.
                            </p>
                            <div className="space-y-3">
                                <div className="border-border/40 flex items-center justify-between border-b pb-2">
                                    <span className="text-muted-foreground text-sm">Starter</span>
                                    <span className="text-foreground text-sm font-semibold">
                                        $250/mo
                                    </span>
                                </div>
                                <div className="border-border/40 flex items-center justify-between border-b pb-2">
                                    <span className="text-muted-foreground text-sm">Pro</span>
                                    <span className="text-foreground text-sm font-semibold">
                                        $500/mo
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-sm">
                                        Enterprise
                                    </span>
                                    <span className="text-foreground text-sm font-semibold">
                                        $1,000/mo
                                    </span>
                                </div>
                            </div>
                            <div className="border-border/40 mt-6 border-t pt-4">
                                <div className="text-primary text-2xl font-bold">$210K ARR</div>
                                <div className="text-muted-foreground text-xs">
                                    Target by December 2026 (35 customers)
                                </div>
                            </div>
                        </div>

                        {/* Track B */}
                        <div className="border-border/60 bg-card rounded-2xl border p-8">
                            <div className="text-primary mb-1 text-xs font-semibold tracking-wider uppercase">
                                Track B
                            </div>
                            <h3 className="text-foreground mb-4 text-xl font-bold">
                                AgentC2 Public Platform
                            </h3>
                            <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                                Self-serve platform at agentc2.ai for any business. Recipe gallery,
                                one-click deployment, usage-based tiers.
                            </p>
                            <div className="space-y-3">
                                <div className="border-border/40 flex items-center justify-between border-b pb-2">
                                    <span className="text-muted-foreground text-sm">Free</span>
                                    <span className="text-foreground text-sm font-semibold">
                                        $0/mo
                                    </span>
                                </div>
                                <div className="border-border/40 flex items-center justify-between border-b pb-2">
                                    <span className="text-muted-foreground text-sm">Starter</span>
                                    <span className="text-foreground text-sm font-semibold">
                                        $29/mo
                                    </span>
                                </div>
                                <div className="border-border/40 flex items-center justify-between border-b pb-2">
                                    <span className="text-muted-foreground text-sm">Pro</span>
                                    <span className="text-foreground text-sm font-semibold">
                                        $79/mo
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-sm">Business</span>
                                    <span className="text-foreground text-sm font-semibold">
                                        $199/mo
                                    </span>
                                </div>
                            </div>
                            <div className="border-border/40 mt-6 border-t pt-4">
                                <div className="text-primary text-2xl font-bold">$120K ARR</div>
                                <div className="text-muted-foreground text-xs">
                                    Target by December 2026 (self-serve)
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Section>

            {/* ===== UNIT ECONOMICS ===== */}
            <Section className="py-24">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="mb-4 text-center">
                        <span className="text-primary text-sm font-semibold tracking-wider uppercase">
                            Unit Economics
                        </span>
                    </div>
                    <h2 className="text-foreground mb-6 text-center text-3xl font-bold tracking-tight md:text-4xl">
                        Economics That Don&apos;t Exist Anywhere Else in SaaS
                    </h2>
                    <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center text-lg">
                        Zero acquisition cost on the first 20 customers. 90% gross margins.
                        Immediate payback. This is what it looks like when the vertical wedge works.
                    </p>

                    <div className="mx-auto max-w-5xl overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-border/60 border-b">
                                    <th className="text-muted-foreground py-3 pr-4 text-left font-medium">
                                        Metric
                                    </th>
                                    <th className="text-primary px-4 py-3 text-center font-semibold">
                                        Construction (Track A)
                                    </th>
                                    <th className="text-primary px-4 py-3 text-center font-semibold">
                                        Platform (Track B)
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    ["CAC", "~$0 (existing) → $500", "~$200 → $2,000"],
                                    ["ARPU", "$500/mo ($6,000/yr)", "$79-199/mo"],
                                    ["LTV", "$30,000+ (zero churn)", "$3,000-6,000"],
                                    ["LTV:CAC", "60:1", "15:1 (self-serve)"],
                                    ["Payback", "Immediate", "2-4 months"],
                                    ["Gross Margin", "~90%", "~85%"]
                                ].map(([metric, trackA, trackB]) => (
                                    <tr
                                        key={metric}
                                        className="border-border/30 border-b last:border-0"
                                    >
                                        <td className="text-foreground py-3 pr-4 font-medium">
                                            {metric}
                                        </td>
                                        <td className="text-muted-foreground px-4 py-3 text-center">
                                            {trackA}
                                        </td>
                                        <td className="text-muted-foreground px-4 py-3 text-center">
                                            {trackB}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Revenue targets */}
                    <div className="mx-auto mt-12 max-w-4xl">
                        <h3 className="text-foreground mb-6 text-center text-lg font-semibold">
                            Revenue Trajectory
                        </h3>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            {[
                                { period: "Q2 2026", value: "$18K", label: "ARR" },
                                { period: "Q3 2026", value: "$110K", label: "ARR" },
                                { period: "Q4 2026", value: "$330K", label: "ARR" },
                                { period: "Mid 2027", value: "$1M+", label: "Combined ARR" }
                            ].map((item) => (
                                <div
                                    key={item.period}
                                    className="border-border/60 rounded-xl border p-4 text-center"
                                >
                                    <div className="text-muted-foreground mb-1 text-xs font-medium">
                                        {item.period}
                                    </div>
                                    <div className="text-foreground text-xl font-bold">
                                        {item.value}
                                    </div>
                                    <div className="text-muted-foreground text-[10px]">
                                        {item.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-muted-foreground mt-6 text-center text-sm">
                            $330K new ARR + $400K Appello base = $730K total. Path to{" "}
                            <strong className="text-foreground">
                                $1M+ combined ARR by mid-2027
                            </strong>
                            . At 10x AI-SaaS multiple ={" "}
                            <strong className="text-primary">$13M valuation</strong>.
                        </p>
                    </div>
                </div>
            </Section>

            {/* ===== AI OPERATING SYSTEM VISION ===== */}
            <Section className="py-24">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="mb-4 text-center">
                        <span className="text-primary text-sm font-semibold tracking-wider uppercase">
                            The Vision
                        </span>
                    </div>
                    <h2 className="text-foreground mb-6 text-center text-3xl font-bold tracking-tight md:text-4xl">
                        The AI-Native Operating Company
                    </h2>
                    <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center text-lg">
                        AgentC2 doesn&apos;t just sell AI agents. It runs on them. Seven autonomous
                        engine networks operate Appello&apos;s entire business &mdash; and each
                        engine becomes a product for customers.
                    </p>

                    <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {[
                            {
                                engine: "Revenue Engine",
                                desc: "Pipeline intelligence, lead scoring, automated follow-ups",
                                savings: "~12 hrs/week"
                            },
                            {
                                engine: "Customer Success",
                                desc: "Health monitoring, proactive outreach, onboarding tracking",
                                savings: "~8 hrs/week"
                            },
                            {
                                engine: "Product Engine",
                                desc: "Spec drafting, release management, QA test generation",
                                savings: "~15 hrs/week"
                            },
                            {
                                engine: "People Ops",
                                desc: "Standup orchestration, meeting processing, capacity planning",
                                savings: "~5 hrs/week"
                            },
                            {
                                engine: "Finance Engine",
                                desc: "Revenue tracking, investor updates, cost analysis",
                                savings: "~15 hrs/month"
                            },
                            {
                                engine: "Platform Ops",
                                desc: "Security monitoring, uptime tracking, deployment watching",
                                savings: "~3 hrs/week"
                            },
                            {
                                engine: "Dark Factory",
                                desc: "Autonomous coding pipeline with risk-aware control gates",
                                savings: "2x throughput"
                            }
                        ].map((e) => (
                            <div
                                key={e.engine}
                                className="border-border/60 bg-card rounded-xl border p-5"
                            >
                                <h4 className="text-foreground mb-1 text-sm font-semibold">
                                    {e.engine}
                                </h4>
                                <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
                                    {e.desc}
                                </p>
                                <div className="text-primary text-xs font-bold">{e.savings}</div>
                            </div>
                        ))}
                        <div className="border-primary/30 bg-primary/5 flex items-center justify-center rounded-xl border p-5 text-center">
                            <div>
                                <div className="text-primary text-2xl font-bold">$500-700</div>
                                <div className="text-muted-foreground text-xs">
                                    /month total AI cost
                                </div>
                                <div className="text-foreground mt-2 text-xs font-medium">
                                    vs. $12K-18K for equivalent FTEs
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Section>

            {/* ===== ROADMAP ===== */}
            <Section className="py-24">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="mb-4 text-center">
                        <span className="text-primary text-sm font-semibold tracking-wider uppercase">
                            Roadmap
                        </span>
                    </div>
                    <h2 className="text-foreground mb-16 text-center text-3xl font-bold tracking-tight md:text-4xl">
                        Key Milestones
                    </h2>

                    <div className="mx-auto max-w-3xl">
                        {[
                            {
                                date: "March 2026",
                                items: [
                                    "Appello MCP server live (20 tools)",
                                    "Public landing page with recipe gallery"
                                ]
                            },
                            {
                                date: "April 2026",
                                items: [
                                    "5 construction pilots on Intelligence",
                                    "Free tier + self-serve signup"
                                ]
                            },
                            {
                                date: "May 2026",
                                items: ["Product Hunt launch"]
                            },
                            {
                                date: "July 2026",
                                items: ["20 construction customers on Intelligence"]
                            },
                            {
                                date: "December 2026",
                                items: ["35 construction + 500 platform users", "$330K new ARR"]
                            },
                            {
                                date: "Q1 2027",
                                items: [
                                    "Second vertical (Property Management or Professional Services)"
                                ]
                            }
                        ].map((milestone, idx) => (
                            <div key={milestone.date} className="flex gap-6">
                                {/* Timeline line */}
                                <div className="flex flex-col items-center">
                                    <div className="bg-primary h-3 w-3 shrink-0 rounded-full" />
                                    {idx < 5 && <div className="bg-border/40 w-px flex-1" />}
                                </div>

                                <div className="pb-10">
                                    <div className="text-primary mb-2 text-sm font-bold">
                                        {milestone.date}
                                    </div>
                                    {milestone.items.map((item) => (
                                        <div
                                            key={item}
                                            className="text-muted-foreground mb-1 text-sm"
                                        >
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Section>

            {/* ===== WHY NOW ===== */}
            <Section className="py-24">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="from-primary/10 via-primary/5 relative overflow-hidden rounded-3xl bg-linear-to-br to-transparent px-8 py-16 text-center md:px-16 md:py-20">
                        <div className="bg-primary/10 pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl" />
                        <div className="bg-primary/5 pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full blur-3xl" />

                        <div className="relative">
                            <h2 className="text-foreground mb-6 text-3xl font-bold tracking-tight md:text-4xl">
                                The Window Is Open.
                            </h2>
                            <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg leading-relaxed">
                                By the end of 2026, three to five platforms will dominate the AI
                                agent space. The ones that win won&apos;t be the ones with the most
                                features or the biggest models. They&apos;ll be the ones with the
                                most proof.
                            </p>
                            <div className="mx-auto max-w-xl space-y-4 text-left">
                                {[
                                    "35 customers who've never churned",
                                    "40+ agents running in production for $218 total",
                                    "Proprietary MCP integration no competitor can replicate",
                                    "Two revenue tracks from one codebase",
                                    "$1M combined ARR path by mid-2027"
                                ].map((point) => (
                                    <div key={point} className="flex items-start gap-3">
                                        <span className="text-primary mt-0.5 text-lg">
                                            &#10003;
                                        </span>
                                        <span className="text-foreground text-sm font-medium">
                                            {point}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-10">
                                <a
                                    href="mailto:corey@agentc2.ai"
                                    className="bg-primary text-primary-foreground inline-flex rounded-xl px-8 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                                >
                                    Schedule a Conversation
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </Section>

            {/* ===== FOOTER ===== */}
            <footer className="border-border/40 border-t">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8">
                    <div className="flex items-center gap-2">
                        <Image
                            src="/c2-icon.png"
                            alt="AgentC2"
                            width={20}
                            height={20}
                            className="rounded-sm"
                        />
                        <span className="text-muted-foreground text-xs">
                            &copy; {new Date().getFullYear()} AgentC2. Confidential.
                        </span>
                    </div>
                    <a
                        href="https://agentc2.ai"
                        className="text-muted-foreground hover:text-primary text-xs transition-colors"
                    >
                        agentc2.ai
                    </a>
                </div>
            </footer>
        </div>
    );
}
