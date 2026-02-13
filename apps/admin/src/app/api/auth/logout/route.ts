import { NextRequest, NextResponse } from "next/server";
import { adminLogout, getAdminTokenFromRequest, ADMIN_COOKIE_NAME } from "@repo/admin-auth";

export async function POST(request: NextRequest) {
    const token = getAdminTokenFromRequest(request);
    if (token) {
        await adminLogout(token);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0
    });

    return response;
}
