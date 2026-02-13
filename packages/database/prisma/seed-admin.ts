/**
 * Seed script for the first Super Admin user.
 *
 * Usage:
 *   bun run db:seed-admin
 *
 * This creates the initial Super Admin account with a randomly generated
 * secure password. The password is printed to stdout ONCE.
 */
import { prisma } from "../src/index";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@agentc2.ai";
const ADMIN_NAME = process.env.ADMIN_NAME || "Super Admin";

async function main() {
    console.log("╔══════════════════════════════════════════════╗");
    console.log("║     Admin Portal — Seed Super Admin User     ║");
    console.log("╚══════════════════════════════════════════════╝\n");

    // Check if admin already exists
    const existing = await prisma.adminUser.findUnique({
        where: { email: ADMIN_EMAIL }
    });

    if (existing) {
        console.log(`⚠️  Admin user already exists: ${ADMIN_EMAIL}`);
        console.log(`   Role: ${existing.role}`);
        console.log(`   Active: ${existing.isActive}`);
        console.log(`   Created: ${existing.createdAt.toISOString()}\n`);
        console.log("To reset the password, delete the user and re-run this script.");
        return;
    }

    // Generate a secure random password
    const password = crypto.randomBytes(16).toString("base64url");
    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await prisma.adminUser.create({
        data: {
            email: ADMIN_EMAIL,
            name: ADMIN_NAME,
            password: hashedPassword,
            role: "super_admin",
            isActive: true,
            mfaEnabled: false
        }
    });

    console.log("✅ Super Admin user created successfully!\n");
    console.log("┌─────────────────────────────────────────────┐");
    console.log(`│  Email:    ${ADMIN_EMAIL.padEnd(34)}│`);
    console.log(`│  Password: ${password.padEnd(34)}│`);
    console.log(`│  Role:     super_admin${" ".repeat(23)}│`);
    console.log(`│  ID:       ${admin.id.padEnd(34)}│`);
    console.log("└─────────────────────────────────────────────┘\n");
    console.log("⚠️  SAVE THIS PASSWORD. It will NOT be shown again.");
    console.log("   Change it immediately after first login.\n");
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
