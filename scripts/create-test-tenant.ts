/**
 * Create a test tenant for SDLC Flywheel playbook deployment verification.
 *
 * Creates:
 * 1. A test user (or reuses existing)
 * 2. A new organization "Flywheel Demo"
 * 3. A default workspace "production"
 * 4. Membership linking user as owner
 *
 * Usage: bun run scripts/create-test-tenant.ts
 */

import { prisma } from "../packages/database/src/index";

const TEST_USER_EMAIL = "sdlc-test@agentc2.ai";
const TEST_ORG_SLUG = "flywheel-demo";
const TEST_ORG_NAME = "Flywheel Demo";

async function main() {
    console.log("Creating test tenant for SDLC Flywheel verification...\n");

    let user = await prisma.user.findFirst({
        where: { email: TEST_USER_EMAIL }
    });
    if (!user) {
        user = await prisma.user.create({
            data: {
                name: "SDLC Test User",
                email: TEST_USER_EMAIL,
                emailVerified: true
            }
        });
        console.log("Created test user:", user.id, "(", user.email, ")");
    } else {
        console.log("Test user exists:", user.id, "(", user.email, ")");
    }

    let org = await prisma.organization.findUnique({
        where: { slug: TEST_ORG_SLUG }
    });
    if (!org) {
        org = await prisma.organization.create({
            data: {
                name: TEST_ORG_NAME,
                slug: TEST_ORG_SLUG,
                description:
                    "Test tenant for verifying SDLC Flywheel playbook deployment and multi-tenant isolation",
                status: "active"
            }
        });
        console.log("Created org:", org.id, "(", org.slug, ")");
    } else {
        console.log("Org exists:", org.id, "(", org.slug, ")");
    }

    const existingMembership = await prisma.membership.findFirst({
        where: { userId: user.id, organizationId: org.id }
    });
    if (!existingMembership) {
        await prisma.membership.create({
            data: {
                userId: user.id,
                organizationId: org.id,
                role: "owner"
            }
        });
        console.log("Created membership: user", user.id, "-> org", org.id, "(owner)");
    } else {
        console.log("Membership exists:", existingMembership.id);
    }

    let workspace = await prisma.workspace.findFirst({
        where: { organizationId: org.id, isDefault: true }
    });
    if (!workspace) {
        workspace = await prisma.workspace.create({
            data: {
                organizationId: org.id,
                name: "Production",
                slug: "production",
                environment: "production",
                isDefault: true
            }
        });
        console.log("Created workspace:", workspace.id, "(", workspace.slug, ")");
    } else {
        console.log("Workspace exists:", workspace.id, "(", workspace.slug, ")");
    }

    console.log("\n--- Test Tenant Summary ---");
    console.log("User ID:        ", user.id);
    console.log("User Email:     ", user.email);
    console.log("Org ID:         ", org.id);
    console.log("Org Slug:       ", org.slug);
    console.log("Workspace ID:   ", workspace.id);
    console.log("Workspace Slug: ", workspace.slug);
    console.log("\nUse these IDs for playbook deployment.");
}

main().catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
});
