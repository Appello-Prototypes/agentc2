import { NextResponse } from "next/server";
import { isGoogleSsoEnabled } from "@repo/admin-auth";

export async function GET() {
    return NextResponse.json({ enabled: isGoogleSsoEnabled() });
}
