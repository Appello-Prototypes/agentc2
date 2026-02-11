import type { Metadata } from "next";
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

export const metadata: Metadata = {
    title: {
        default: "AgentC2 - Your AI Workforce, Orchestrated",
        template: "%s | AgentC2"
    },
    description:
        "Build, deploy, and orchestrate intelligent AI agents that connect to your tools, learn from experience, and work across every channel. 10+ integrations, visual workflows, voice agents, and more."
};

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={`${dmSans.variable} scroll-smooth`} suppressHydrationWarning>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <AppProvidersWrapper>{children}</AppProvidersWrapper>
            </body>
        </html>
    );
}
