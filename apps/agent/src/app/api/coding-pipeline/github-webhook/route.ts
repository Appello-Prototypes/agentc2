import { NextRequest, NextResponse } from "next/server";

/**
 * @deprecated This endpoint is fully replaced by the generic trigger system
 * at /api/webhooks/[path]. The GitHub webhook should point to
 * /api/webhooks/sdlc-github instead.
 *
 * This stub remains to return a clear error if any old integrations still hit it.
 */
export async function POST(_request: NextRequest) {
    console.error(
        "[REMOVED] /api/coding-pipeline/github-webhook is removed. " +
            "Use the generic trigger system at /api/webhooks/[path] instead."
    );

    return NextResponse.json(
        {
            error:
                "This endpoint is deprecated and disabled. " +
                "Use the generic trigger system at /api/webhooks/sdlc-github instead.",
            migration:
                "Update your GitHub webhook URL to: https://agentc2.ai/api/webhooks/sdlc-github"
        },
        { status: 410 }
    );
}
