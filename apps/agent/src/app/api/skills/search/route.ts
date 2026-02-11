/**
 * POST /api/skills/search
 *
 * Search available skills by natural language queries.
 * Used by the search-skills meta-tool for progressive skill discovery.
 *
 * Returns skill descriptions (manifests) without loading tools.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { queries } = body as { queries?: string[] };

        if (!queries || !Array.isArray(queries) || queries.length === 0) {
            return NextResponse.json(
                { error: "queries must be a non-empty array of strings" },
                { status: 400 }
            );
        }

        // Get all skills with their tool counts
        const allSkills = await prisma.skill.findMany({
            where: { type: { in: ["SYSTEM", "USER"] } },
            select: {
                slug: true,
                name: true,
                description: true,
                category: true,
                tags: true,
                _count: { select: { tools: true } }
            },
            orderBy: { name: "asc" }
        });

        // Simple keyword/semantic matching across queries
        // Score each skill by how well it matches the queries
        const queryTerms = queries.flatMap((q) =>
            q
                .toLowerCase()
                .split(/\s+/)
                .filter((t) => t.length > 2)
        );

        const scoredSkills = allSkills
            .map((skill) => {
                const searchText = [
                    skill.name,
                    skill.description || "",
                    skill.category || "",
                    ...(skill.tags || [])
                ]
                    .join(" ")
                    .toLowerCase();

                // Score: count how many query terms appear in the skill's text
                let score = 0;
                for (const term of queryTerms) {
                    if (searchText.includes(term)) {
                        score++;
                    }
                }

                // Boost for exact slug match
                for (const q of queries) {
                    if (skill.slug.includes(q.toLowerCase().replace(/\s+/g, "-"))) {
                        score += 5;
                    }
                }

                return {
                    slug: skill.slug,
                    name: skill.name,
                    description: skill.description,
                    category: skill.category,
                    toolCount: skill._count.tools,
                    relevanceScore: score
                };
            })
            .filter((s) => s.relevanceScore > 0)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 10);

        // If no keyword matches, return all skills as a fallback
        const results =
            scoredSkills.length > 0
                ? scoredSkills
                : allSkills.slice(0, 15).map((s) => ({
                      slug: s.slug,
                      name: s.name,
                      description: s.description,
                      category: s.category,
                      toolCount: s._count.tools,
                      relevanceScore: 0
                  }));

        return NextResponse.json({
            skills: results,
            totalAvailable: allSkills.length,
            queriesUsed: queries
        });
    } catch (error) {
        console.error("[Skills Search] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Search failed" },
            { status: 500 }
        );
    }
}
