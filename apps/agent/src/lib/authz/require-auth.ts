import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";

export type AuthContext = {
    userId: string;
    organizationId: string;
};

export async function requireAuth(
    request: NextRequest
): Promise<
    { context: AuthContext; response?: undefined } | { context?: undefined; response: NextResponse }
> {
    const context = await authenticateRequest(request);
    if (!context) {
        return {
            response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        };
    }
    return { context };
}
