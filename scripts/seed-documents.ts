/**
 * Seed Documents Script
 *
 * Ingests existing docs/*.md files as Document records with automatic RAG embedding.
 * Run with: bun run scripts/seed-documents.ts
 */

import { prisma } from "@repo/database";
import { createDocument } from "../packages/agentc2/src/documents/service";
import { readdir, readFile } from "fs/promises";
import { join, basename, extname } from "path";

const DOCS_DIR = join(import.meta.dirname, "..", "docs");

function slugify(filename: string): string {
    return basename(filename, extname(filename))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function titleize(slug: string): string {
    return slug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

async function main() {
    console.log("Seeding documents from docs/ directory...\n");

    const files = await readdir(DOCS_DIR);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    console.log(`Found ${mdFiles.length} markdown files.\n`);

    let created = 0;
    let skipped = 0;

    for (const file of mdFiles) {
        const slug = slugify(file);
        const name = titleize(slug);
        const filepath = join(DOCS_DIR, file);

        // Check if already exists
        const existing = await prisma.document.findUnique({
            where: { slug }
        });

        if (existing) {
            console.log(`  SKIP: ${file} (slug "${slug}" already exists)`);
            skipped++;
            continue;
        }

        const content = await readFile(filepath, "utf-8");

        try {
            const doc = await createDocument({
                slug,
                name,
                content,
                contentType: "markdown",
                category: "internal-docs",
                tags: ["seed", "docs"],
                type: "SYSTEM",
                createdBy: "seed-script"
            });

            console.log(
                `  OK: ${file} -> "${doc.name}" (${doc.chunkCount} chunks, ${doc.vectorIds.length} vectors)`
            );
            created++;
        } catch (error) {
            console.error(`  FAIL: ${file} - ${error instanceof Error ? error.message : error}`);
        }
    }

    console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);

    await prisma.$disconnect();
}

main().catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
});
