import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function requirePulseAccess(
    pulseId: string,
    userId: string,
    organizationId: string
): Promise<
    { pulseId: string; response?: undefined } | { pulseId?: undefined; response: NextResponse }
> {
    const pulse = await prisma.pulse.findUnique({
        where: { id: pulseId },
        select: {
            id: true,
            visibility: true,
            createdBy: true,
            workspace: { select: { organizationId: true } }
        }
    });

    if (!pulse) {
        return {
            response: NextResponse.json(
                { success: false, error: "Pulse not found" },
                { status: 404 }
            )
        };
    }

    const allowed =
        pulse.visibility === "PUBLIC" ||
        (pulse.visibility === "PRIVATE" && pulse.createdBy === userId) ||
        (pulse.visibility === "ORGANIZATION" && pulse.workspace?.organizationId === organizationId);

    if (!allowed) {
        return {
            response: NextResponse.json(
                { success: false, error: "Pulse not found" },
                { status: 404 }
            )
        };
    }

    return { pulseId: pulse.id };
}
