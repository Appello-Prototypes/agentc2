import { NextRequest, NextResponse } from "next/server";
import { adminLogin, AdminAuthError, ADMIN_COOKIE_NAME } from "@repo/admin-auth";

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Email and password required" }, { status: 400 });
        }

        const ipAddress =
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const userAgent = request.headers.get("user-agent") || undefined;

        const { token, session } = await adminLogin(email, password, ipAddress, userAgent);

        const response = NextResponse.json({
            success: true,
            admin: {
                id: session.adminUserId,
                email: session.email,
                name: session.name,
                role: session.role
            }
        });

        // Set session cookie
        response.cookies.set(ADMIN_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 12 * 60 * 60 // 12 hours
        });

        return response;
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Login] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
