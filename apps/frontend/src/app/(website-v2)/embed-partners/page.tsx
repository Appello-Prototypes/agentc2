import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/website/sections/page-hero";
import { SectionWrapper } from "@/components/website/layout/section-wrapper";
import { SectionHeader } from "@/components/website/sections/section-header";
import { Breadcrumbs } from "@/components/website/sections/breadcrumbs";
import { CTABanner } from "@/components/website/sections/cta-banner";
import { FeatureGrid } from "@/components/website/sections/feature-grid";
import { RelatedPages } from "@/components/website/sections/related-pages";
import { StyledLink } from "@/components/website/layout/styled-link";
import { EmbedWidgetIllustration } from "@/components/website/illustrations";

export const metadata: Metadata = buildPageMetadata({
    title: "Embed Partners — White-Label AI Agents in Your Product",
    description:
        "Embed AgentC2 agents directly into your SaaS, consulting portal, or internal tools. White-label chat widgets, full workspaces, and secure HMAC authentication — ready in minutes.",
    path: "/embed-partners",
    keywords: [
        "white-label AI agents",
        "embed AI chatbot",
        "AI agent SDK",
        "SaaS AI integration",
        "embedded AI workspace"
    ]
});

export default function EmbedPartnersPage() {
    return (
        <>
            <SectionWrapper className="pt-8 pb-0">
                <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Embed Partners" }]} />
            </SectionWrapper>

            {/* ---------- Hero ---------- */}
            <PageHero
                overline="Embed Partners"
                title="White-label AI agents in your product"
                description="Drop a script tag, configure your brand, and give every customer their own AI agent — powered by AgentC2, branded as you. No infrastructure to manage, no models to host."
                primaryCta={{
                    label: "Apply for Partner Program",
                    href: "/contact"
                }}
                secondaryCta={{
                    label: "View Integration Guide",
                    href: "/docs"
                }}
            >
                <EmbedWidgetIllustration className="w-full max-w-md" />
            </PageHero>

            {/* ---------- What is Embed ---------- */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Overview"
                    title="What is AgentC2 Embed?"
                    description="AgentC2 Embed is a partner program that lets SaaS vendors, consulting firms, and agencies offer AI agents to their own customers without building an AI platform from scratch."
                />
                <div className="mt-12 grid gap-8 lg:grid-cols-2">
                    <div className="border-border/60 bg-card rounded-2xl border p-8">
                        <h3 className="text-foreground mb-3 text-lg font-semibold">
                            For Your Customers
                        </h3>
                        <ul className="text-muted-foreground space-y-2 text-sm leading-relaxed">
                            <li>
                                AI agents that understand your product&apos;s domain and your
                                customer&apos;s data.
                            </li>
                            <li>
                                A seamless experience — no separate login, no new tool to learn.
                            </li>
                            <li>
                                Conversations, tool calls, and memory scoped to each customer&apos;s
                                account.
                            </li>
                        </ul>
                    </div>
                    <div className="border-border/60 bg-card rounded-2xl border p-8">
                        <h3 className="text-foreground mb-3 text-lg font-semibold">For You</h3>
                        <ul className="text-muted-foreground space-y-2 text-sm leading-relaxed">
                            <li>
                                A new revenue stream — charge per seat, per agent, or per
                                conversation.
                            </li>
                            <li>
                                Full control over which agents, tools, and models each customer can
                                access.
                            </li>
                            <li>
                                Zero AI infrastructure to build or maintain. AgentC2 handles
                                orchestration, scaling, and updates.
                            </li>
                        </ul>
                    </div>
                </div>
            </SectionWrapper>

            {/* ---------- Deployment Modes ---------- */}
            <SectionWrapper>
                <SectionHeader
                    overline="Deployment Modes"
                    title="Three ways to embed"
                    description="Choose the integration depth that fits your product — from a lightweight chat widget to a full white-label workspace."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Chat Widget",
                            description:
                                "A floating chat bubble that loads in an iframe. Add a single script tag to any page. Supports custom colors, position, avatar, and welcome message. Ideal for support and onboarding flows."
                        },
                        {
                            title: "Embedded Agent",
                            description:
                                "Mount a full agent conversation panel inside your app layout using the React SDK. Access to tool results, streaming responses, and conversation history. Best for in-app copilots and workflow assistants."
                        },
                        {
                            title: "Full Workspace",
                            description:
                                "Give each customer their own AgentC2 workspace with multiple agents, playbooks, and integrations — all rendered under your domain with your branding. Perfect for platforms selling AI-as-a-service."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* ---------- Feature Presets ---------- */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Configuration"
                    title="Feature presets for every tier"
                    description="Control exactly what each customer can do. Feature presets map to your pricing tiers so you can gate capabilities without writing custom code."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={2}
                    features={[
                        {
                            title: "Agent Limits",
                            description:
                                "Set the maximum number of agents, conversations per day, and tokens per month for each customer. Overages can be blocked or billed automatically."
                        },
                        {
                            title: "Tool Access",
                            description:
                                "Choose which MCP tools are available — give Starter customers web search, Pro customers CRM access, and Enterprise customers the full tool catalog."
                        },
                        {
                            title: "Model Selection",
                            description:
                                "Pin customers to specific models or let them choose. Route cost-sensitive tiers to GPT-4o Mini and premium tiers to Claude Sonnet or GPT-4o."
                        },
                        {
                            title: "Branding & Theming",
                            description:
                                "Override colors, logos, fonts, and the agent avatar per customer. The &quot;Powered by AgentC2&quot; badge is removable on paid partner plans."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* ---------- Security ---------- */}
            <SectionWrapper>
                <SectionHeader
                    overline="Security"
                    title="HMAC-SHA256 authentication"
                    description="Every embed session is cryptographically signed. Your server generates a hash from the customer's identity and a shared secret — AgentC2 verifies it before granting access."
                />
                <div className="border-border/60 bg-card mx-auto mt-12 max-w-3xl rounded-2xl border p-6 md:p-8">
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-foreground mb-2 text-sm font-semibold">
                                How it works
                            </h4>
                            <ol className="text-muted-foreground list-inside list-decimal space-y-2 text-sm leading-relaxed">
                                <li>
                                    Your backend creates a JSON payload with the user&apos;s ID,
                                    org, and permissions.
                                </li>
                                <li>
                                    It signs the payload with your embed secret using HMAC-SHA256.
                                </li>
                                <li>
                                    The signed token is passed to the embed widget on the client
                                    side.
                                </li>
                                <li>
                                    AgentC2 verifies the signature, extracts the identity, and
                                    scopes the session accordingly.
                                </li>
                            </ol>
                        </div>
                        <div>
                            <h4 className="text-foreground mb-2 text-sm font-semibold">
                                Security guarantees
                            </h4>
                            <ul className="text-muted-foreground space-y-1 text-sm">
                                <li>
                                    ✓ Tokens are short-lived (configurable TTL, default 15 minutes).
                                </li>
                                <li>✓ Replay attacks are prevented with one-time-use nonces.</li>
                                <li>
                                    ✓ Customer data is isolated — one customer&apos;s agent cannot
                                    access another&apos;s memory or tools.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </SectionWrapper>

            {/* ---------- Business Model ---------- */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Revenue"
                    title="A business model that scales with you"
                    description="AgentC2 Embed is priced on platform usage — you set your own margins. No per-seat licensing, no revenue share on your customer contracts."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Usage-Based Platform Fee",
                            description:
                                "Pay AgentC2 based on tokens consumed and tool calls executed. Predictable unit economics you can model against your own pricing tiers."
                        },
                        {
                            title: "Set Your Own Prices",
                            description:
                                "Charge your customers per seat, per conversation, per agent, or a flat monthly fee. AgentC2 has no opinion on your pricing model."
                        },
                        {
                            title: "Volume Discounts",
                            description:
                                "As your embedded usage grows, your per-unit cost decreases. Partners processing 10M+ tokens/month qualify for custom pricing."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* ---------- Use Cases ---------- */}
            <SectionWrapper>
                <SectionHeader
                    overline="Use Cases"
                    title="Who embeds AgentC2?"
                    description="From vertical SaaS to global consulting firms — partners embed AI agents wherever their customers need intelligent automation."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={2}
                    features={[
                        {
                            title: "SaaS Platforms",
                            description:
                                "Add an AI copilot to your existing product. Help users navigate complex workflows, answer questions from your knowledge base, and automate repetitive tasks — all without leaving your UI."
                        },
                        {
                            title: "Consulting Firms",
                            description:
                                "Deploy custom AI agents for each client engagement. Agents inherit the firm&apos;s methodology, access client-specific documents via RAG, and operate under the firm&apos;s compliance policies."
                        },
                        {
                            title: "Agencies & Resellers",
                            description:
                                "Build a portfolio of AI solutions for your clients. White-label the entire platform, configure per-client agents, and manage all deployments from a single partner dashboard."
                        },
                        {
                            title: "Internal Tools",
                            description:
                                "Embed agents inside internal portals, ERPs, or CRMs. Give operations teams an AI assistant that connects to your existing systems via MCP — no context switching, no separate app."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* ---------- Technical Integration ---------- */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Integration"
                    title="Production-ready in under an hour"
                    description="The embed SDK is framework-agnostic and ships with React, Vue, and vanilla JS bindings. Three steps to go live."
                />
                <div className="mx-auto mt-12 max-w-3xl">
                    <div className="space-y-8">
                        <div className="flex gap-4">
                            <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                                1
                            </div>
                            <div>
                                <h4 className="text-foreground text-base font-semibold">
                                    Register your embed app
                                </h4>
                                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                                    Create an embed application in the AgentC2 dashboard.
                                    You&apos;ll receive a public app ID and a secret key for HMAC
                                    signing.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                                2
                            </div>
                            <div>
                                <h4 className="text-foreground text-base font-semibold">
                                    Add the embed snippet
                                </h4>
                                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                                    Drop a script tag or install the npm package. Configure
                                    branding, position, and the agents you want to expose. Pass the
                                    signed identity token from your backend.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                                3
                            </div>
                            <div>
                                <h4 className="text-foreground text-base font-semibold">Go live</h4>
                                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                                    Your customers see a branded AI agent inside your product.
                                    Conversations, memory, and tool access are scoped per customer
                                    automatically.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-10 flex justify-center">
                    <StyledLink href="/docs" variant="outline" size="lg">
                        Read the Integration Docs →
                    </StyledLink>
                </div>
            </SectionWrapper>

            {/* ---------- CTA ---------- */}
            <CTABanner
                title="Ready to embed AI agents in your product?"
                description="Apply to the AgentC2 Embed Partner Program and start white-labeling agents in under an hour."
                primaryCta={{
                    label: "Apply Now",
                    href: "/contact"
                }}
                secondaryCta={{
                    label: "View Pricing",
                    href: "/pricing"
                }}
            />

            {/* ---------- Related Pages ---------- */}
            <SectionWrapper>
                <RelatedPages
                    title="Explore More"
                    pages={[
                        {
                            title: "Enterprise",
                            description:
                                "Multi-tenant architecture, SSO, RBAC, and governance for organizations at scale.",
                            href: "/enterprise"
                        },
                        {
                            title: "Platform Overview",
                            description:
                                "The full AgentC2 architecture — agents, workflows, integrations, and observability.",
                            href: "/platform"
                        },
                        {
                            title: "Use Cases",
                            description:
                                "See how teams across Sales, Support, Engineering, and Operations deploy AI agents.",
                            href: "/use-cases"
                        }
                    ]}
                />
            </SectionWrapper>
        </>
    );
}
