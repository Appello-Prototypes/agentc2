import { NextResponse } from "next/server";
import { memory } from "@repo/agentc2/core";
import { getDemoSession } from "@/lib/standalone-auth";
import { getUserOrganizationId } from "@/lib/organization";
import { orgScopedResourceId } from "@repo/agentc2/tenant-scope";

export async function GET() {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const orgId = await getUserOrganizationId(userId);
        const resourceId = orgScopedResourceId(orgId || "", userId);
        const threadId = orgId ? `${orgId}:memory-demo-${userId}` : `memory-demo-${userId}`;

        const workingMemory = await memory.getWorkingMemory({
            threadId,
            resourceId
        });

        return NextResponse.json({
            workingMemory,
            resourceId
        });
    } catch (error) {
        console.error("Working memory error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get working memory" },
            { status: 500 }
        );
    }
}
