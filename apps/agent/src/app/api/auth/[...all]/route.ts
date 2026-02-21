import { NextRequest, NextResponse } from "next/server";
import { auth } from "@repo/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { checkRateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit-policy";

const { GET: betterAuthGET, POST: betterAuthPOST } = toNextJsHandler(auth);

export const GET = betterAuthGET;

export async function POST(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await checkRateLimit(`auth:${ip}`, RATE_LIMIT_POLICIES.auth);
    if (!rl.allowed) {
        return NextResponse.json(
            { error: "Too many requests. Try again later." },
            {
                status: 429,
                headers: {
                    "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000))
                }
            }
        );
    }
    return betterAuthPOST(request);
}
