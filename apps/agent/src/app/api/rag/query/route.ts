import { NextRequest, NextResponse } from "next/server";
import { queryRag, ragGenerate, mastra } from "@repo/mastra";
import { auth } from "@repo/auth";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { query, topK, minScore, generateResponse } = await req.json();

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        if (generateResponse) {
            const agent = mastra.getAgent("assistant");
            const result = await ragGenerate(query, agent, { topK, minScore });
            return NextResponse.json(result);
        }

        const results = await queryRag(query, { topK, minScore });
        return NextResponse.json({ results });
    } catch (error) {
        console.error("RAG query error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Query failed" },
            { status: 500 }
        );
    }
}
