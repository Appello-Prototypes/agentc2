import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { validateWorkflowDefinition } from "@/lib/workflow-validation";
import { authenticateRequest } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        let { definitionJson } = body;
        const { workflowSlug } = body;

        if (!definitionJson && workflowSlug) {
            const authContext = await authenticateRequest(request);
            if (!authContext) {
                return NextResponse.json(
                    { success: false, error: "Authentication required when using workflowSlug" },
                    { status: 401 }
                );
            }

            const workflow = await prisma.workflow.findFirst({
                where: {
                    OR: [{ slug: workflowSlug }, { id: workflowSlug }],
                    workspace: { organizationId: authContext.organizationId }
                },
                select: { id: true, slug: true, name: true, definitionJson: true }
            });

            if (!workflow) {
                return NextResponse.json(
                    { success: false, error: `Workflow not found: ${workflowSlug}` },
                    { status: 404 }
                );
            }

            definitionJson = workflow.definitionJson;

            const validation = validateWorkflowDefinition(definitionJson);
            return NextResponse.json({
                success: true,
                workflowSlug: workflow.slug,
                workflowName: workflow.name,
                ...validation
            });
        }

        if (!definitionJson) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Provide either definitionJson or workflowSlug"
                },
                { status: 400 }
            );
        }

        const validation = validateWorkflowDefinition(definitionJson);

        return NextResponse.json({
            success: true,
            ...validation
        });
    } catch (error) {
        console.error("[Workflow Validate] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to validate workflow" },
            { status: 500 }
        );
    }
}
