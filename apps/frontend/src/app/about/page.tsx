import { LandingPage } from "../landing-page";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
    title: "About AgentC2",
    description:
        "Learn about AgentC2, the AI agent orchestration platform for production deployments, enterprise integrations, and governed automation.",
    path: "/about",
    keywords: ["about AgentC2", "AI agent platform", "agent orchestration company"]
});

export default function AboutPage() {
    return <LandingPage />;
}
