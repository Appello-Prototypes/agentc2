import { cn } from "@repo/ui";
import { Breadcrumbs } from "@/components/website/sections/breadcrumbs";
import { PageHero } from "@/components/website/sections/page-hero";
import { SectionWrapper } from "@/components/website/layout/section-wrapper";
import { SectionHeader } from "@/components/website/sections/section-header";
import { LogoGrid } from "@/components/website/sections/logo-grid";
import { CTABanner } from "@/components/website/sections/cta-banner";

export interface UseCaseData {
    slug: string;
    vertical: string;
    heroTitle: string;
    heroDescription: string;
    painPoints: Array<{ title: string; description: string }>;
    solution: { description: string; capabilities: string[] };
    agentExamples: Array<{
        name: string;
        description: string;
        tools: string[];
        channels: string[];
        guardrails?: string[];
    }>;
    integrations: string[];
    ctaTitle: string;
}

export function UseCasePageTemplate({ data }: { data: UseCaseData }) {
    return (
        <>
            <div className="mx-auto max-w-7xl px-6 pt-8">
                <Breadcrumbs
                    items={[
                        { label: "Home", href: "/" },
                        { label: "Use Cases", href: "/use-cases" },
                        { label: data.vertical }
                    ]}
                />
            </div>

            <PageHero
                overline={data.vertical}
                title={data.heroTitle}
                description={data.heroDescription}
                primaryCta={{ label: "Start Free Trial", href: "/signup" }}
                secondaryCta={{
                    label: "Talk to Sales",
                    href: "/enterprise"
                }}
            />

            {/* Pain Points */}
            <SectionWrapper muted>
                <SectionHeader overline="The Problem" title="Why teams struggle today" />
                <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {data.painPoints.map((point, i) => (
                        <div key={i} className="border-border/60 bg-card rounded-2xl border p-6">
                            <div className="bg-destructive/10 text-destructive mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold">
                                {i + 1}
                            </div>
                            <h3 className="text-foreground mb-2 text-lg font-semibold">
                                {point.title}
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                {point.description}
                            </p>
                        </div>
                    ))}
                </div>
            </SectionWrapper>

            {/* Solution Overview */}
            <SectionWrapper>
                <SectionHeader
                    overline="The Solution"
                    title={`How AgentC2 transforms ${data.vertical.toLowerCase()}`}
                />
                <div className="border-border/60 bg-card mt-12 rounded-2xl border p-8 md:p-12">
                    <p className="text-foreground mb-8 text-lg leading-relaxed">
                        {data.solution.description}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {data.solution.capabilities.map((cap, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <span className="text-primary mt-0.5 text-sm font-bold">✓</span>
                                <span className="text-muted-foreground text-sm">{cap}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </SectionWrapper>

            {/* Agent Examples */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Agent Examples"
                    title="Pre-built agents you can deploy today"
                />
                <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {data.agentExamples.map((agent, i) => (
                        <div key={i} className="border-border/60 bg-card rounded-2xl border p-6">
                            <div className="bg-primary/10 text-primary mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold">
                                {agent.name.charAt(0)}
                            </div>
                            <h3 className="text-foreground mb-2 text-lg font-semibold">
                                {agent.name}
                            </h3>
                            <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                                {agent.description}
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <span className="text-foreground text-xs font-semibold tracking-wider uppercase">
                                        Tools
                                    </span>
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                        {agent.tools.map((tool) => (
                                            <span
                                                key={tool}
                                                className="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-xs"
                                            >
                                                {tool}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <span className="text-foreground text-xs font-semibold tracking-wider uppercase">
                                        Channels
                                    </span>
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                        {agent.channels.map((ch) => (
                                            <span
                                                key={ch}
                                                className="border-border/60 text-muted-foreground rounded-md border px-2 py-0.5 text-xs"
                                            >
                                                {ch}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {agent.guardrails && agent.guardrails.length > 0 && (
                                    <div>
                                        <span className="text-foreground text-xs font-semibold tracking-wider uppercase">
                                            Guardrails
                                        </span>
                                        <div className="mt-1 flex flex-wrap gap-1.5">
                                            {agent.guardrails.map((g) => (
                                                <span
                                                    key={g}
                                                    className={cn(
                                                        "rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400"
                                                    )}
                                                >
                                                    {g}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </SectionWrapper>

            {/* Integration Spotlight */}
            <SectionWrapper>
                <SectionHeader overline="Integrations" title="Connects to your existing stack" />
                <div className="mt-12">
                    <LogoGrid logos={data.integrations.map((name) => ({ name }))} />
                </div>
            </SectionWrapper>

            <CTABanner
                title={data.ctaTitle}
                description="Deploy production-ready AI agents in minutes, not months."
                primaryCta={{ label: "Start Free Trial", href: "/signup" }}
                secondaryCta={{
                    label: "Talk to Sales",
                    href: "/enterprise"
                }}
            />
        </>
    );
}
