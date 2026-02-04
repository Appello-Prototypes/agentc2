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
        default: "AgentC2",
        template: "%s | AgentC2"
    },
    description:
        "Build, deploy, and improve AI agents with workflows, networks, and continuous learning."
};

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={dmSans.variable} suppressHydrationWarning>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <AppProvidersWrapper>{children}</AppProvidersWrapper>
            </body>
        </html>
    );
}
