#!/usr/bin/env bun
/**
 * Seed Test User
 *
 * Upserts an E2E test user with Better Auth scrypt hashing,
 * adds membership to all organizations, and marks onboarding complete.
 *
 * Usage: bun run db:seed-test-user
 */

import { prisma } from "../packages/database/src";

async function hashPassword(password: string): Promise<string> {
    const { scrypt, randomBytes } = await import("node:crypto");
    const { promisify } = await import("node:util");
    const scryptAsync = promisify(scrypt);

    const salt = randomBytes(16).toString("hex");
    const derivedKey = (await scryptAsync(password.normalize("NFKC"), salt, 64, {
        N: 16384,
        r: 16,
        p: 1,
        maxmem: 128 * 16384 * 16 * 2
    })) as Buffer;
    return `${salt}:${derivedKey.toString("hex")}`;
}

async function main() {
    const email = process.env.TEST_USER_EMAIL || "e2e-test@catalyst.local";
    const password = process.env.TEST_USER_PASSWORD || "E2ETestPassword123!";
    const name = "E2E Test User";

    console.log(`Seeding test user: ${email}`);

    const hashedPassword = await hashPassword(password);

    // Upsert user
    const user = await prisma.user.upsert({
        where: { email },
        update: {
            name,
            emailVerified: true,
            onboardingCompleted: true
        },
        create: {
            name,
            email,
            emailVerified: true,
            onboardingCompleted: true
        }
    });

    console.log(`  User: ${user.id}`);

    // Upsert credential account
    const existingAccount = await prisma.account.findFirst({
        where: { userId: user.id, providerId: "credential" }
    });

    if (existingAccount) {
        await prisma.account.update({
            where: { id: existingAccount.id },
            data: { password: hashedPassword, accountId: email }
        });
    } else {
        await prisma.account.create({
            data: {
                accountId: email,
                providerId: "credential",
                userId: user.id,
                password: hashedPassword
            }
        });
    }

    // Add membership to all orgs
    const allOrgs = await prisma.organization.findMany({ select: { id: true, slug: true } });
    let added = 0;

    for (const org of allOrgs) {
        const exists = await prisma.member.findFirst({
            where: { userId: user.id, organizationId: org.id }
        });
        if (!exists) {
            await prisma.member.create({
                data: {
                    userId: user.id,
                    organizationId: org.id,
                    role: "admin"
                }
            });
            added++;
            console.log(`  + Added to ${org.slug}`);
        }
    }

    console.log(
        `\n✅ Test user seeded (${allOrgs.length} orgs, ${added} new memberships, onboarding complete)`
    );
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
