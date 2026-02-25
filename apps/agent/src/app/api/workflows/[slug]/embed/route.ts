import { prisma } from "@repo/database";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_EMBED_CONFIG = {
    theme: "dark" as const,
    showToolActivity: true,
    poweredByBadge: true
};

export type WorkflowEmbedConfig = typeof DEFAULT_EMBED_CONFIG;

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

        const workflow = await prisma.workflow.findFirst({
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
                publicToken: true,
                inputSchemaJson: true,
                outputSchemaJson: true
            }
        });

        if (!workflow) {
            return NextResponse.json(
                { success: false, error: "Invalid token or workflow not public" },
                { status: 403 }
            );
        }

        const metadata = workflow.metadata as Record<string, unknown> | null;
        const storedConfig = (metadata?.publicEmbed as Partial<WorkflowEmbedConfig>) || {};

        const config: WorkflowEmbedConfig = {
            ...DEFAULT_EMBED_CONFIG,
            ...storedConfig
        };

        if (format === "embed-code") {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agentc2.ai";
            const embedUrl = `${baseUrl}/embed/workflow/${workflow.slug}?token=${workflow.publicToken}`;
            const snippet = `<iframe\n  src="${embedUrl}"\n  width="100%" height="600"\n  style="border:none; border-radius:12px;"\n  allow="clipboard-write"\n></iframe>`;

            return NextResponse.json({ embedUrl, embedCode: snippet });
        }

        return NextResponse.json({
            slug: workflow.slug,
            name: workflow.name,
            description: workflow.description,
            inputSchema: workflow.inputSchemaJson,
            outputSchema: workflow.outputSchemaJson,
            config
        });
    } catch (error) {
        console.error("[Workflow Embed Config] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch embed config"
            },
            { status: 500 }
        );
    }
}
