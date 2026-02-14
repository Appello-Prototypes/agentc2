import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        const workflow = await prisma.workflow.findFirst({
            where: { OR: [{ slug }, { id: slug }] }
        });
        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        const testCases = await prisma.workflowTestCase.findMany({
            where: { workflowId: workflow.id },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ success: true, testCases });
    } catch (error) {
        console.error("[Workflow TestCases] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to list test cases" },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const body = await request.json();

        const workflow = await prisma.workflow.findFirst({
            where: { OR: [{ slug }, { id: slug }] }
        });
        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        const testCase = await prisma.workflowTestCase.create({
            data: {
                workflowId: workflow.id,
                name: body.name || "Unnamed test",
                inputJson: body.inputJson || body.input || {},
                expectedOutput: body.expectedOutput
                    ? (body.expectedOutput as Prisma.InputJsonValue)
                    : undefined,
                tags: body.tags || [],
                createdBy: body.createdBy
            }
        });

        return NextResponse.json({ success: true, testCase }, { status: 201 });
    } catch (error) {
        console.error("[Workflow TestCases Create] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to create test case" },
            { status: 500 }
        );
    }
}
