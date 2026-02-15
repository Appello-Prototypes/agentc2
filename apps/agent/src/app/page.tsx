import { redirect } from "next/navigation";
import { prisma } from "@repo/database";

/**
 * Root page — fetches the welcome-v2 agent's public token and redirects
 * to the V2 embed page with the token.
 *
 * This page is excluded from proxy auth (see proxy.ts matcher) so
 * unauthenticated visitors can access the public landing experience.
 */
export default async function RootPage() {
    const welcomeAgent = await prisma.agent.findFirst({
        where: { slug: "welcome-v2" },
        select: { publicToken: true, isPublic: true }
    });

    const token = welcomeAgent?.isPublic ? welcomeAgent.publicToken : null;

    if (token) {
        redirect(`/embed-v2/welcome-v2?token=${token}`);
    }

    // Fallback: redirect without token (will show "Missing token" but shouldn't happen
    // if the welcome-v2 agent is properly configured as public in the database)
    redirect("/embed-v2/welcome-v2");
}
