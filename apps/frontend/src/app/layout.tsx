import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, DM_Sans } from "next/font/google";
import "@/styles/globals.css";
import { AppProvidersWrapper } from "@/components/AppProvidersWrapper";

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
        "AgentC2 is an AI agent platform that lets you build, deploy, and orchestrate intelligent agents. Connect to Gmail, Google Calendar, Google Drive, HubSpot, Jira, Slack, and 10+ integrations. Visual workflows, voice agents, and enterprise-grade security.",
    metadataBase: new URL("https://agentc2.ai"),
    openGraph: {
        title: "AgentC2 - Your AI Workforce, Orchestrated",
        description:
            "Build, deploy, and orchestrate intelligent AI agents that connect to your tools, learn from experience, and work across every channel.",
        url: "https://agentc2.ai",
        siteName: "AgentC2",
        type: "website"
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
                <AppProvidersWrapper>{children}</AppProvidersWrapper>
            </body>
        </html>
    );
}
