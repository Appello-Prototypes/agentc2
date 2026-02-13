import { NextRequest, NextResponse } from "next/server";
import { validateAdminSession, getAdminTokenFromRequest } from "@repo/admin-auth";

export async function GET(request: NextRequest) {
    const token = getAdminTokenFromRequest(request);
    if (!token) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const session = await validateAdminSession(token);
    if (!session) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
        authenticated: true,
        admin: {
            id: session.adminUserId,
            email: session.email,
            name: session.name,
            role: session.role
        }
    });
}
