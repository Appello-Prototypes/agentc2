import "@/styles/globals.css";
import { AgentC2Logo } from "@repo/ui";

export const metadata = {
    title: "Get Started | AgentC2"
};

/**
 * Onboarding layout - minimal branded header, no sidebar
 * Clean, focused experience for first-time users
 */
export default function OnboardingLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="bg-background flex min-h-screen flex-col">
            {/* Minimal branded header */}
            <header className="flex shrink-0 items-center justify-center border-b px-4 py-3">
                <div className="flex items-center gap-[2px]">
                    <span className="text-base font-semibold">Agent</span>
                    <AgentC2Logo size={26} />
                </div>
            </header>

            {/* Main content - vertically centered */}
            <main className="flex flex-1 flex-col items-center overflow-y-auto px-4 py-8">
                <div className="w-full max-w-2xl">{children}</div>
            </main>
        </div>
    );
}
