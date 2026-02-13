import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function HomePage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (session) {
        redirect("/workspace");
    }

    // Fetch the welcome agent's public token for the embed
    const welcomeAgent = await prisma.agent.findUnique({
        where: { slug: "welcome" },
        select: { publicToken: true, isPublic: true }
    });

    const token = welcomeAgent?.isPublic ? welcomeAgent.publicToken : null;

    if (!token) {
        // Fallback: show a simple message if welcome agent isn't configured
        return (
            <main className="flex h-dvh w-full items-center justify-center bg-black text-white">
                <p className="text-muted-foreground text-sm">AgentC2 is loading...</p>
            </main>
        );
    }

    // Determine agent app base URL:
    // - Behind Caddy/production: relative URL works (Caddy routes /embed/* to agent app)
    // - Direct dev (localhost:3000): point to agent app on port 3001
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const agentBase = appUrl.includes("localhost:3000") ? "http://localhost:3001" : "";

    return (
        <main className="h-dvh w-full bg-black">
            <iframe
                src={`${agentBase}/embed/welcome?token=${token}&internal=true`}
                className="h-full w-full border-0"
                allow="clipboard-write"
            />
        </main>
    );
}
