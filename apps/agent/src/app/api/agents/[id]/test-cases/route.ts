import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/test-cases
 *
 * List test cases for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const cursor = searchParams.get("cursor");
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { agentId: agent.id };

        if (cursor) {
            where.id = { lt: cursor };
        }

        // Get test cases
        const testCases = await prisma.agentTestCase.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit + 1,
            include: {
                testRuns: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: {
                        id: true,
                        passed: true,
                        score: true,
                        createdAt: true
                    }
                }
            }
        });

        // Check if there are more results
        const hasMore = testCases.length > limit;
        if (hasMore) {
            testCases.pop();
        }

        return NextResponse.json({
            success: true,
            testCases: testCases.map((tc) => ({
                id: tc.id,
                name: tc.name,
                inputText: tc.inputText,
                expectedOutput: tc.expectedOutput,
                tags: tc.tags,
                createdBy: tc.createdBy,
                createdAt: tc.createdAt,
                updatedAt: tc.updatedAt,
                lastRun: tc.testRuns[0] || null
            })),
            nextCursor: hasMore ? testCases[testCases.length - 1].id : null
        });
    } catch (error) {
        console.error("[Agent Test Cases List] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list test cases"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents/[id]/test-cases
 *
 * Create a new test case
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const { name, inputText, expectedOutput, tags, createdBy } = body;

        if (!name || !inputText) {
            return NextResponse.json(
                { success: false, error: "Missing required fields: name, inputText" },
                { status: 400 }
            );
        }

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Create test case
        const testCase = await prisma.agentTestCase.create({
            data: {
                agentId: agent.id,
                tenantId: agent.tenantId,
                name,
                inputText,
                expectedOutput: expectedOutput || null,
                tags: tags || [],
                createdBy
            }
        });

        return NextResponse.json({
            success: true,
            testCase: {
                id: testCase.id,
                name: testCase.name,
                inputText: testCase.inputText,
                expectedOutput: testCase.expectedOutput,
                tags: testCase.tags,
                createdBy: testCase.createdBy,
                createdAt: testCase.createdAt
            }
        });
    } catch (error) {
        console.error("[Agent Test Case Create] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create test case"
            },
            { status: 500 }
        );
    }
}
