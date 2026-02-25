/**
 * Tenant Lifecycle Actions
 *
 * Core business logic for tenant CRUD and status changes.
 * Called by API routes and Inngest functions.
 */

import { prisma } from "@repo/database";

// ── Create ───────────────────────────────────────────────────────────────

export interface CreateTenantInput {
    name: string;
    slug: string;
    description?: string;
    status?: string;
    maxAgents?: number | null;
    maxWorkspaces?: number | null;
    maxRunsPerMonth?: number | null;
    maxSeats?: number | null;
    timezone?: string;
}

export async function createTenant(input: CreateTenantInput, performedBy: string) {
    const existing = await prisma.organization.findUnique({
        where: { slug: input.slug },
        select: { id: true }
    });
    if (existing) throw new Error(`Slug "${input.slug}" is already in use`);

    const org = await prisma.organization.create({
        data: {
            name: input.name,
            slug: input.slug,
            description: input.description,
            status: input.status || "active",
            maxAgents: input.maxAgents,
            maxWorkspaces: input.maxWorkspaces,
            maxRunsPerMonth: input.maxRunsPerMonth,
            maxSeats: input.maxSeats,
            timezone: input.timezone
        }
    });

    await prisma.tenantLifecycleEvent.create({
        data: {
            organizationId: org.id,
            fromStatus: "provisioning",
            toStatus: org.status,
            reason: "Created by admin",
            performedBy
        }
    });

    return org;
}

// ── Update ───────────────────────────────────────────────────────────────

export interface UpdateTenantInput {
    name?: string;
    slug?: string;
    description?: string | null;
    timezone?: string | null;
    maxAgents?: number | null;
    maxWorkspaces?: number | null;
    maxRunsPerMonth?: number | null;
    maxSeats?: number | null;
}

export async function updateTenant(orgId: string, input: UpdateTenantInput) {
    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, slug: true }
    });
    if (!org) throw new Error("Organization not found");

    if (input.slug && input.slug !== org.slug) {
        const conflict = await prisma.organization.findUnique({
            where: { slug: input.slug },
            select: { id: true }
        });
        if (conflict) throw new Error(`Slug "${input.slug}" is already in use`);
    }

    const updated = await prisma.organization.update({
        where: { id: orgId },
        data: {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.slug !== undefined && { slug: input.slug }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.timezone !== undefined && { timezone: input.timezone }),
            ...(input.maxAgents !== undefined && { maxAgents: input.maxAgents }),
            ...(input.maxWorkspaces !== undefined && { maxWorkspaces: input.maxWorkspaces }),
            ...(input.maxRunsPerMonth !== undefined && { maxRunsPerMonth: input.maxRunsPerMonth }),
            ...(input.maxSeats !== undefined && { maxSeats: input.maxSeats })
        }
    });

    return updated;
}

// ── Delete (soft) ────────────────────────────────────────────────────────

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
