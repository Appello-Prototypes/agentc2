import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@repo/database";
import { auth } from "@repo/auth";
import { getUserOrganizationId } from "@/lib/organization";

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = await getUserOrganizationId(session.user.id);
    if (!organizationId) {
        return NextResponse.json({ error: "No organization" }, { status: 403 });
    }

    const body = await request.json();
    const { type, title, description, tags } = body;

    if (!type || !title || !description) {
        return NextResponse.json(
            { error: "type, title, and description are required" },
            { status: 400 }
        );
    }

    const validTypes = ["BUG", "FEATURE_REQUEST", "IMPROVEMENT", "QUESTION"];
    if (!validTypes.includes(type)) {
        return NextResponse.json(
            { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
            { status: 400 }
        );
    }

    const ticket = await prisma.supportTicket.create({
        data: {
            type,
            title,
            description,
            tags: Array.isArray(tags) ? tags : [],
            submittedById: session.user.id,
            organizationId
        }
    });

    return NextResponse.json({ success: true, ticket });
}
