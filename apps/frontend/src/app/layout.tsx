import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, DM_Sans } from "next/font/google";
import "@/styles/globals.css";
import { AppProvidersWrapper } from "@/components/AppProvidersWrapper";
import { organizationJsonLd, softwareApplicationJsonLd } from "@/lib/seo";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"]
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"]
});

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1
};

export const metadata: Metadata = {
    title: {
        default: "AgentC2 - Your AI Workforce, Orchestrated",
        template: "%s | AgentC2"
    },
    description:
        "Agent C2 is your command and control center for the agentic world. Build and deploy AI agents that connect to your tools at scale. Gmail, Google Calendar, Slack, HubSpot, Jira, and 10+ integrations. Visual workflows, voice agents, and enterprise-grade security.",
    metadataBase: new URL("https://agentc2.ai"),
    openGraph: {
        title: "AgentC2 - Your AI Workforce, Orchestrated",
        description:
            "Your command and control center for the agentic world. Build and deploy AI agents that connect to your tools at scale.",
        url: "https://agentc2.ai",
        siteName: "AgentC2",
        type: "website"
    },
    twitter: {
        card: "summary_large_image",
        title: "AgentC2 - Your AI Workforce, Orchestrated",
        description:
            "Build and deploy AI agents that connect to your tools at scale with workflows, guardrails, and enterprise controls.",
        images: ["https://agentc2.ai/opengraph-image"],
        site: "@agentc2ai"
    }
};

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            className={`dark ${dmSans.variable} scroll-smooth`}
            suppressHydrationWarning
        >
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
                />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(softwareApplicationJsonLd())
                    }}
                />
                <AppProvidersWrapper>{children}</AppProvidersWrapper>
                <Suspense fallback={null}>
                    <GoogleAnalytics />
                </Suspense>
            </body>
        </html>
    );
}
