import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { SectionWrapper } from "@/components/website/layout/section-wrapper";
import { PageHero } from "@/components/website/sections/page-hero";
import { Breadcrumbs } from "@/components/website/sections/breadcrumbs";
import { SectionHeader } from "@/components/website/sections/section-header";
import { FeatureGrid } from "@/components/website/sections/feature-grid";
import { CTABanner } from "@/components/website/sections/cta-banner";
import { RelatedPages } from "@/components/website/sections/related-pages";
import {
    ChannelDeploymentIllustration,
    AgentChatIllustration,
    EmbedWidgetIllustration
} from "@/components/website/illustrations";

export const metadata: Metadata = buildPageMetadata({
    title: "Channels & Voice — AgentC2",
    description:
        "Deploy once. Reach every channel. Web chat, Slack, WhatsApp, Telegram, voice, email, and embeddable widgets — all with unified memory and consistent guardrails.",
    path: "/platform/channels",
    keywords: [
        "multi-channel AI agents",
        "AI voice agents",
        "Slack AI bot",
        "WhatsApp AI",
        "embeddable chat widget",
        "omnichannel AI"
    ]
});

const channels = [
    {
        title: "Web Chat",
        description:
            "A fully customisable chat widget that drops into any website. Supports streaming responses, file uploads, rich cards, and conversation persistence across sessions."
    },
    {
        title: "Slack",
        description:
            "Install the AgentC2 Slack app and @mention any agent in channels or DMs. Thread-based memory, per-agent display names and icons, and multi-agent routing with agent:slug prefixes."
    },
    {
        title: "WhatsApp",
        description:
            "Connect via the WhatsApp Business API. Agents respond in real-time with text, images, and interactive buttons. End-to-end encrypted by default."
    },
    {
        title: "Telegram",
        description:
            "Deploy a Telegram bot backed by any AgentC2 agent. Supports inline keyboards, group conversations, and media attachments."
    },
    {
        title: "Voice",
        description:
            "ElevenLabs and OpenAI Realtime power sub-second voice agents. Agents can answer inbound calls, join meetings, and handle support — with full MCP tool access."
    },
    {
        title: "Email",
        description:
            "Gmail and Microsoft Outlook integrations let agents process inbound email, draft responses, and archive threads. OAuth-secured with automatic token refresh."
    },
    {
        title: "Embed Widget",
        description:
            "A lightweight JavaScript snippet embeds agent conversations into any third-party application. Fully white-labelled — your brand, your domain, your agent."
    }
];

export default function ChannelsPage() {
    return (
        <>
            <SectionWrapper>
                <Breadcrumbs
                    items={[
                        { label: "Home", href: "/" },
                        { label: "Platform", href: "/platform" },
                        { label: "Channels & Voice" }
                    ]}
                    currentPath="/platform/channels"
                />
            </SectionWrapper>

            <PageHero
                overline="Channels"
                title="Deploy once. Reach every channel."
                description="Your customers are on Slack, WhatsApp, email, phone, and your website — sometimes all in the same day. AgentC2 lets you build an agent once and deploy it everywhere, with unified memory and consistent guardrails across every touchpoint."
                primaryCta={{ label: "Start Deploying", href: "/signup" }}
                secondaryCta={{ label: "See All Integrations", href: "/integrations" }}
            >
                <ChannelDeploymentIllustration />
            </PageHero>

            {/* Channel Grid */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Channels"
                    title="Seven Channels, One Agent"
                    description="Every channel shares the same agent config, memory layer, and tool access. No per-channel rewrites. No drift."
                />
                <FeatureGrid className="mt-12" columns={3} features={channels} />
            </SectionWrapper>

            {/* Unified Memory */}
            <SectionWrapper>
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                    <div className="flex flex-col justify-center">
                        <SectionHeader
                            centered={false}
                            overline="Memory"
                            title="Unified Conversation Memory"
                            description="Whether a customer starts on web chat and continues on Slack, the agent remembers the full context. Per-thread and per-user memory ensures continuity without repetition."
                        />
                        <ul className="text-muted-foreground mt-6 space-y-3 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Cross-channel conversation continuity
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Semantic recall via pgvector embeddings
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Configurable context window per agent
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Automatic summarisation for long threads
                            </li>
                        </ul>
                    </div>
                    <div className="flex items-center justify-center">
                        <AgentChatIllustration />
                    </div>
                </div>
            </SectionWrapper>

            {/* Routing & Commands */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Routing"
                    title="Intelligent Routing &amp; Commands"
                    description="Route messages to the right agent automatically. In Slack, prefix with agent:slug to target a specific specialist. Or let the router agent decide based on intent."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Slug-Based Routing",
                            description:
                                "In Slack, type agent:research to route to your research agent, agent:sales for your sales agent. Simple, explicit, no ambiguity."
                        },
                        {
                            title: "Intent-Based Routing",
                            description:
                                "A router agent analyses the incoming message and dispatches to the best specialist — no user prefix required. Configurable fallback chains."
                        },
                        {
                            title: "Help &amp; Discovery",
                            description:
                                "Type help or agent:list in any channel to see all available agents with their descriptions, capabilities, and slugs."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* Voice Deep Dive */}
            <SectionWrapper>
                <SectionHeader
                    overline="Voice"
                    title="Voice Agent Deep Dive"
                    description="Voice is not an afterthought — it's a first-class channel. AgentC2 integrates ElevenLabs conversational AI and OpenAI Realtime to deliver sub-second, natural-sounding voice agents with full tool access."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Sub-Second Latency",
                            description:
                                "OpenAI Realtime API delivers responses in under one second. Conversations feel natural, not robotic."
                        },
                        {
                            title: "Voice Cloning",
                            description:
                                "Clone any voice with ElevenLabs. Give each agent a distinct persona — warm for support, professional for sales, authoritative for compliance."
                        },
                        {
                            title: "MCP Tools in Voice",
                            description:
                                "Voice agents access the same 200+ MCP tools as text agents. Look up a CRM record, create a Jira ticket, or send an email — all mid-conversation."
                        },
                        {
                            title: "Webhook Integration",
                            description:
                                "ElevenLabs live agents call back to AgentC2 via secure ngrok webhooks. Tool results are streamed back to the caller in real time."
                        },
                        {
                            title: "Call Recording &amp; Transcription",
                            description:
                                "Every voice conversation is recorded and transcribed. Transcripts feed into the Learning Pipeline for continuous improvement."
                        },
                        {
                            title: "Inbound &amp; Outbound",
                            description:
                                "Handle inbound support calls or initiate outbound campaigns. JustCall integration provides phone numbers and SMS alongside voice."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* Embed System */}
            <SectionWrapper muted>
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                    <div className="flex items-center justify-center lg:order-1">
                        <EmbedWidgetIllustration />
                    </div>
                    <div className="flex flex-col justify-center lg:order-2">
                        <SectionHeader
                            centered={false}
                            overline="Embed"
                            title="Embeddable Agent Widget"
                            description="Drop a lightweight JavaScript snippet into any website or web app to add an AgentC2 agent. Fully white-labelled — customise colours, fonts, position, and behaviour."
                        />
                        <ul className="text-muted-foreground mt-6 space-y-3 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                One-line script tag installation
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Custom branding: logo, colours, greeting
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Session persistence across page navigations
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Responsive design for mobile and desktop
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                CSP-compatible with configurable CORS origins
                            </li>
                        </ul>
                    </div>
                </div>
            </SectionWrapper>

            <CTABanner
                title="Deploy your agent to every channel today"
                description="Create a free workspace and push your first agent to Slack, web chat, or voice in minutes."
                primaryCta={{ label: "Get Started Free", href: "/signup" }}
                secondaryCta={{ label: "Talk to Sales", href: "/contact" }}
            />

            <SectionWrapper>
                <RelatedPages
                    title="More Platform Pages"
                    pages={[
                        {
                            title: "Platform Overview",
                            description: "The complete AI agent operations platform at a glance.",
                            href: "/platform"
                        },
                        {
                            title: "How It Works",
                            description: "Six steps from zero to production agents.",
                            href: "/platform/how-it-works"
                        },
                        {
                            title: "Architecture",
                            description: "Open-source foundations and multi-tenant security.",
                            href: "/platform/architecture"
                        }
                    ]}
                />
            </SectionWrapper>
        </>
    );
}
