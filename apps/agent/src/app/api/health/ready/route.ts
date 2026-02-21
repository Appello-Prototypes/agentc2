import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return NextResponse.json({ status: "ready" }, { status: 200 });
    } catch {
        return NextResponse.json({ status: "not_ready" }, { status: 503 });
    }
}
