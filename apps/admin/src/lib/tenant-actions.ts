/**
 * Tenant Lifecycle Actions
 *
 * Core business logic for tenant status changes.
 * Called by API routes and Inngest functions.
 */

import { prisma } from "@repo/database";

export async function suspendTenant(orgId: string, reason: string, performedBy: string) {
    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { status: true }
    });

    if (!org) throw new Error("Organization not found");
    if (org.status === "suspended") throw new Error("Already suspended");

    const previousStatus = org.status;

    // Update org status
    const updated = await prisma.organization.update({
        where: { id: orgId },
        data: {
            status: "suspended",
            suspendedAt: new Date(),
            suspendedReason: reason
        }
    });

    // Record lifecycle event
    await prisma.tenantLifecycleEvent.create({
        data: {
            organizationId: orgId,
            fromStatus: previousStatus,
            toStatus: "suspended",
            reason,
            performedBy
        }
    });

    return { previousStatus, updated };
}

export async function reactivateTenant(orgId: string, performedBy: string) {
    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { status: true }
    });

    if (!org) throw new Error("Organization not found");
    if (org.status !== "suspended") throw new Error("Not currently suspended");

    const previousStatus = org.status;

    const updated = await prisma.organization.update({
        where: { id: orgId },
        data: {
            status: "active",
            suspendedAt: null,
            suspendedReason: null
        }
    });

    await prisma.tenantLifecycleEvent.create({
        data: {
            organizationId: orgId,
            fromStatus: previousStatus,
            toStatus: "active",
            reason: "Reactivated by admin",
            performedBy
        }
    });

    return { previousStatus, updated };
}

export async function requestTenantDeletion(orgId: string, reason: string, performedBy: string) {
    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { status: true }
    });

    if (!org) throw new Error("Organization not found");

    const previousStatus = org.status;

    const updated = await prisma.organization.update({
        where: { id: orgId },
        data: {
            status: "deactivated",
            deletedAt: new Date()
        }
    });

    await prisma.tenantLifecycleEvent.create({
        data: {
            organizationId: orgId,
            fromStatus: previousStatus,
            toStatus: "deactivated",
            reason,
            performedBy,
            metadata: { retentionDays: 30 }
        }
    });

    return { previousStatus, updated };
}
