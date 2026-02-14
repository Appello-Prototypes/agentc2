import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        const network = await prisma.network.findFirst({
            where: { OR: [{ slug }, { id: slug }] }
        });
        if (!network) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        const testCases = await prisma.networkTestCase.findMany({
            where: { networkId: network.id },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ success: true, testCases });
    } catch (error) {
        console.error("[Network TestCases] Error:", error);
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

        const network = await prisma.network.findFirst({
            where: { OR: [{ slug }, { id: slug }] }
        });
        if (!network) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        const testCase = await prisma.networkTestCase.create({
            data: {
                networkId: network.id,
                name: body.name || "Unnamed test",
                inputText: body.inputText || body.input || "",
                expectedOutput: body.expectedOutput,
                tags: body.tags || [],
                createdBy: body.createdBy
            }
        });

        return NextResponse.json({ success: true, testCase }, { status: 201 });
    } catch (error) {
        console.error("[Network TestCases Create] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to create test case" },
            { status: 500 }
        );
    }
}
