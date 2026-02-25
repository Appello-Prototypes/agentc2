import { prisma } from "@repo/database";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_EMBED_CONFIG = {
    greeting: "",
    suggestions: [] as string[],
    theme: "dark" as const,
    showToolActivity: true,
    poweredByBadge: true,
    maxMessagesPerSession: 50
};

export type NetworkEmbedConfig = typeof DEFAULT_EMBED_CONFIG;

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        const { searchParams } = new URL(request.url);
        const token = searchParams.get("token");
        const format = searchParams.get("format");

        if (!token) {
            return NextResponse.json(
                { success: false, error: "Missing token parameter" },
                { status: 401 }
            );
        }

        const network = await prisma.network.findFirst({
            where: {
                slug,
                visibility: "PUBLIC",
                publicToken: token,
                isActive: true
            },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                metadata: true,
                publicToken: true
            }
        });

        if (!network) {
            return NextResponse.json(
                { success: false, error: "Invalid token or network not public" },
                { status: 403 }
            );
        }

        const metadata = network.metadata as Record<string, unknown> | null;
        const storedConfig = (metadata?.publicEmbed as Partial<NetworkEmbedConfig>) || {};

        const config: NetworkEmbedConfig = {
            ...DEFAULT_EMBED_CONFIG,
            greeting: storedConfig.greeting || `Hi, I'm ${network.name}. How can I help you?`,
            ...storedConfig
        };

        if (format === "embed-code") {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agentc2.ai";
            const embedUrl = `${baseUrl}/embed/network/${network.slug}?token=${network.publicToken}`;
            const snippet = `<iframe\n  src="${embedUrl}"\n  width="100%" height="600"\n  style="border:none; border-radius:12px;"\n  allow="clipboard-write"\n></iframe>`;

            return NextResponse.json({ embedUrl, embedCode: snippet });
        }

        return NextResponse.json({
            slug: network.slug,
            name: network.name,
            description: network.description,
            config
        });
    } catch (error) {
        console.error("[Network Embed Config] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch embed config"
            },
            { status: 500 }
        );
    }
}
