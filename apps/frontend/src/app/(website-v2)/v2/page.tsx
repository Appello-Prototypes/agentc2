import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { HomeHero } from "@/components/website/home/home-hero";
import { ProblemStatement } from "@/components/website/home/problem-statement";
import { FivePillars } from "@/components/website/home/five-pillars";
import { ChannelDeployment } from "@/components/website/home/channel-deployment";
import { IntegrationEcosystem } from "@/components/website/home/integration-ecosystem";
import { Differentiators } from "@/components/website/home/differentiators";
import { InteractiveDemo } from "@/components/website/home/interactive-demo";
import { UseCaseTabs } from "@/components/website/home/use-case-tabs";
import { TrustBar } from "@/components/website/home/trust-bar";
import { HowItWorksSection } from "@/components/website/home/how-it-works-section";
import { FooterCta } from "@/components/website/home/footer-cta";

export const metadata: Metadata = buildPageMetadata({
    title: "AgentC2 V2 — The AI Operating System for Your Organization",
    description:
        "Build, deploy, and govern AI agents across web, Slack, WhatsApp, and voice. 200+ MCP tool integrations. Enterprise security. Playbook marketplace. Start free.",
    path: "/v2",
    keywords: [
        "AI agent platform",
        "AI operating system",
        "agent operations",
        "MCP integrations",
        "multi-channel AI agents"
    ]
});

export default function V2HomePage() {
    return (
        <>
            <HomeHero />
            <ProblemStatement />
            <FivePillars />
            <ChannelDeployment />
            <IntegrationEcosystem />
            <Differentiators />
            <InteractiveDemo />
            <UseCaseTabs />
            <TrustBar />
            <HowItWorksSection />
            <FooterCta />
        </>
    );
}
