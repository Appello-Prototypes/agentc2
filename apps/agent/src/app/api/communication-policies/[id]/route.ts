import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, description, rules, priority, enabled } = body;

        const existing = await prisma.communicationPolicy.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Policy not found" },
                { status: 404 }
            );
        }

        const policy = await prisma.communicationPolicy.update({
            where: { id },
            data: {
                ...(name !== undefined ? { name } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(rules !== undefined ? { rules } : {}),
                ...(priority !== undefined ? { priority } : {}),
                ...(enabled !== undefined ? { enabled } : {})
            }
        });

        return NextResponse.json({ success: true, policy });
    } catch (error) {
        console.error("[CommPolicy Update] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update policy" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.communicationPolicy.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[CommPolicy Delete] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to delete policy" },
            { status: 500 }
        );
    }
}
