import { handleWorkflowStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";
import { mastra } from "@repo/mastra";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";

/**
 * POST /api/workflow
 * Executes the analysis workflow and streams results
 * Requires authentication
 */
export async function POST(req: Request) {
  // Authenticate the request
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized - please sign in" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { inputData } = body;

    if (!inputData?.query) {
      return NextResponse.json(
        { error: "Missing required field: inputData.query" },
        { status: 400 }
      );
    }

    const stream = await handleWorkflowStream({
      mastra,
      workflowId: "analysis-workflow",
      params: {
        inputData,
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("Workflow API error:", error);
    return NextResponse.json(
      { error: "Failed to execute workflow" },
      { status: 500 }
    );
  }
}
