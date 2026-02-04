import "@/styles/globals.css";

export const metadata = {
    title: "Get Started | AgentC2"
};

/**
 * Onboarding layout - minimal header, no sidebar
 * Clean experience for first-time users
 */
export default function OnboardingLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="bg-background min-h-screen">
            {/* Main content */}
            <main className="container mx-auto px-4 py-8">{children}</main>
        </div>
    );
}
