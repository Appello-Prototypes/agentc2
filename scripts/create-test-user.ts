#!/usr/bin/env bun
/**
 * Create E2E Test User
 *
 * This script creates a test user for Playwright E2E tests.
 * Run with: bun run scripts/create-test-user.ts
 */

import { prisma } from "../packages/database/src";

// Better Auth uses scrypt for password hashing
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

    console.log(`Creating test user: ${email}`);

    try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
            include: { accounts: true }
        });

        if (existingUser) {
            console.log("Test user already exists, updating password...");

            // Update the password in the account
            const hashedPassword = await hashPassword(password);

            const existingAccount = existingUser.accounts.find(
                (a) => a.providerId === "credential"
            );

            if (existingAccount) {
                await prisma.account.update({
                    where: { id: existingAccount.id },
                    data: {
                        password: hashedPassword,
                        accountId: email
                    }
                });
                console.log("Password updated for existing test user");
            } else {
                // Create credential account
                await prisma.account.create({
                    data: {
                        accountId: email,
                        providerId: "credential",
                        userId: existingUser.id,
                        password: hashedPassword
                    }
                });
                console.log("Created credential account for existing user");
            }
        } else {
            // Create new user
            const hashedPassword = await hashPassword(password);

            const user = await prisma.user.create({
                data: {
                    name,
                    email,
                    emailVerified: true,
                    accounts: {
                        create: {
                            accountId: email,
                            providerId: "credential",
                            password: hashedPassword
                        }
                    }
                }
            });

            console.log(`Created test user with id: ${user.id}`);
        }

        console.log("\n✅ Test user ready for E2E tests");
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
    } catch (error) {
        console.error("Failed to create test user:", error);
        process.exit(1);
    } finally {
        // Prisma instance is shared, no need to disconnect
    }
}

main();
