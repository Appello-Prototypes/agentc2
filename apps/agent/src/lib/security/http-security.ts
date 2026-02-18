import { NextRequest, NextResponse } from "next/server";

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

export function getCorsHeaders(origin: string | null): Record<string, string> {
    const allowedOrigin =
        origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))
            ? origin
            : allowedOrigins[0] || "";
    return {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-API-Key, X-Organization-Slug",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    };
}

export function enforceCsrf(request: NextRequest): {
    response?: NextResponse;
    responseHeaders?: Record<string, string>;
} {
    const apiKey = request.headers.get("x-api-key") || request.headers.get("authorization");
    if (apiKey) {
        return {};
    }

    const origin = request.headers.get("origin");
    if (!origin) {
        return {};
    }
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost || request.headers.get("host");
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "");

    const expectedOrigins = new Set<string>();
    if (host) {
        expectedOrigins.add(`${protocol}://${host}`);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
        expectedOrigins.add(appUrl.replace(/\/+$/, ""));
    }

    if (!expectedOrigins.has(origin)) {
        return {
            response: NextResponse.json(
                { success: false, error: "CSRF origin mismatch" },
                { status: 403 }
            )
        };
    }
    return {};
}
