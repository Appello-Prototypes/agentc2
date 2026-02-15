import { prisma } from "@repo/database";
import WelcomeEmbed from "@/components/WelcomeEmbed";
import type { EmbedConfig } from "@/components/WelcomeEmbed";

/**
 * Default embed configuration — same defaults used by the /api/agents/[id]/embed route.
 */
const DEFAULT_EMBED_CONFIG: EmbedConfig = {
    greeting: "",
    suggestions: [],
    theme: "dark",
    showToolActivity: true,
    showModeSelector: false,
    showModelSelector: false,
    showFileUpload: false,
    showVoiceInput: false,
    showConversationSidebar: false,
    showSignupCTA: false,
    signupProviders: ["google"],
    poweredByBadge: true,
    maxMessagesPerSession: 50
};

/**
 * Root page — resolves the welcome-v2 agent's embed config server-side
 * and renders the chat UI directly.  No redirects, no token in the URL,
 * no extra client-side API fetch.
 *
 * This page is excluded from proxy auth (see proxy.ts matcher) so
 * unauthenticated visitors can access the public landing experience.
 */
export default async function RootPage() {
    const agent = await prisma.agent.findFirst({
        where: { slug: "welcome-v2", isPublic: true, isActive: true },
        select: {
            slug: true,
            name: true,
            publicToken: true,
            metadata: true
        }
    });

    // Graceful fallback — if the welcome agent isn't configured, show a
    // simple branded placeholder instead of an error page.
    if (!agent || !agent.publicToken) {
        return (
            <div className="flex h-dvh flex-col items-center justify-center bg-black text-white">
                <h1 className="text-2xl font-semibold tracking-tight">AgentC2</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    The platform is being configured. Check back shortly.
                </p>
                <a
                    href="/login"
                    className="mt-6 inline-flex items-center rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-white/90"
                >
                    Log in
                </a>
            </div>
        );
    }

    // Resolve embed config server-side (same merge logic as the embed API route)
    const metadata = agent.metadata as Record<string, unknown> | null;
    const storedConfig = (metadata?.publicEmbed as Partial<EmbedConfig>) || {};

    const config: EmbedConfig = {
        ...DEFAULT_EMBED_CONFIG,
        greeting: storedConfig.greeting || `Hi, I'm ${agent.name}. How can I help you?`,
        ...storedConfig
    };

    return (
        <WelcomeEmbed
            embedData={{ slug: agent.slug, name: agent.name, config }}
            token={agent.publicToken}
        />
    );
}
