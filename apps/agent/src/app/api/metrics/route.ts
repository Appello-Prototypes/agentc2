import { NextResponse } from "next/server";
import { register } from "@/lib/prometheus";

const ALLOWED_IPS = (process.env.METRICS_ALLOWED_IPS || "127.0.0.1,::1").split(",");

export async function GET(request: Request) {
    if (process.env.NODE_ENV === "production") {
        const forwarded = request.headers.get("x-forwarded-for");
        const ip = forwarded?.split(",")[0]?.trim() || "unknown";
        if (!ALLOWED_IPS.includes(ip)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }

    const metrics = await register.metrics();
    return new Response(metrics, {
        headers: { "Content-Type": register.contentType }
    });
}
