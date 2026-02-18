/**
 * Skill Recommender
 *
 * Analyzes an agent's purpose (instructions) and recommends relevant skills.
 * Uses keyword matching and category analysis to suggest skills.
 */

import { prisma } from "@repo/database";

interface SkillRecommendation {
    skillId: string;
    slug: string;
    name: string;
    description: string | null;
    category: string | null;
    toolCount: number;
    confidence: number; // 0-1
    rationale: string;
}

/**
 * Recommend skills for an agent based on its instructions and description.
 *
 * Returns a ranked list of skills with confidence scores and rationale.
 * Does not require an LLM call — uses keyword/semantic matching.
 */
export async function recommendSkills(
    agentInstructions: string,
    options?: {
        agentId?: string;
        maxResults?: number;
        excludeAttached?: boolean;
    }
): Promise<SkillRecommendation[]> {
    const maxResults = options?.maxResults || 10;

    // Get all available skills
    const allSkills = await prisma.skill.findMany({
        select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            instructions: true,
            category: true,
            tags: true,
            _count: { select: { tools: true } }
        }
    });

    // If excludeAttached, filter out skills already attached to the agent
    let excludeSet = new Set<string>();
    if (options?.excludeAttached && options?.agentId) {
        const attached = await prisma.agentSkill.findMany({
            where: { agentId: options.agentId },
            select: { skillId: true }
        });
        excludeSet = new Set(attached.map((a) => a.skillId));
    }

    const instructionsLower = agentInstructions.toLowerCase();

    // Score each skill based on keyword relevance
    const scored = allSkills
        .filter((skill) => !excludeSet.has(skill.id))
        .map((skill) => {
            let score = 0;
            const reasons: string[] = [];

            // Check name match
            const nameTerms = skill.name.toLowerCase().split(/\s+/);
            for (const term of nameTerms) {
                if (term.length > 3 && instructionsLower.includes(term)) {
                    score += 3;
                    reasons.push(`Name term "${term}" found in instructions`);
                }
            }

            // Check tag match
            for (const tag of skill.tags) {
                if (instructionsLower.includes(tag.toLowerCase())) {
                    score += 2;
                    reasons.push(`Tag "${tag}" matches`);
                }
            }

            // Check description keywords
            const descTerms = (skill.description || "")
                .toLowerCase()
                .split(/\s+/)
                .filter((t) => t.length > 4);
            for (const term of descTerms) {
                if (instructionsLower.includes(term)) {
                    score += 1;
                }
            }

            // Category-based boosting
            if (skill.category === "utility") {
                score += 1; // Utility skills are broadly useful
                reasons.push("Utility skill (broadly applicable)");
            }

            // Specific keyword patterns
            const keywordPatterns: Array<{ pattern: RegExp; slug: string; boost: number }> = [
                {
                    pattern: /\b(crm|hubspot|contact|deal|pipeline|sales)\b/i,
                    slug: "mcp-crm-hubspot",
                    boost: 5
                },
                {
                    pattern: /\b(jira|issue|sprint|ticket|project management)\b/i,
                    slug: "mcp-project-jira",
                    boost: 5
                },
                {
                    pattern: /\b(scrape|crawl|web content|firecrawl)\b/i,
                    slug: "mcp-web-firecrawl",
                    boost: 5
                },
                {
                    pattern: /\b(slack|message|channel)\b/i,
                    slug: "mcp-communication-slack",
                    boost: 5
                },
                {
                    pattern: /\b(github|repo|pull request|code review)\b/i,
                    slug: "mcp-code-github",
                    boost: 5
                },
                {
                    pattern: /\b(gdrive|google drive|sheets|docs)\b/i,
                    slug: "mcp-files-gdrive",
                    boost: 5
                },
                {
                    pattern: /\b(meeting|transcript|fathom)\b/i,
                    slug: "mcp-knowledge-fathom",
                    boost: 5
                },
                {
                    pattern: /\b(workflow|automate|trigger)\b/i,
                    slug: "platform-workflow-execution",
                    boost: 3
                },

                {
                    pattern: /\b(document|knowledge|rag|search)\b/i,
                    slug: "platform-knowledge-management",
                    boost: 3
                },
                {
                    pattern: /\b(bim|building|construction|takeoff|clash)\b/i,
                    slug: "bim-engineering",
                    boost: 5
                }
            ];

            for (const kp of keywordPatterns) {
                if (kp.slug === skill.slug && kp.pattern.test(agentInstructions)) {
                    score += kp.boost;
                    reasons.push(`Keyword pattern match for ${skill.name}`);
                }
            }

            // Normalize score to 0-1 confidence
            const confidence = Math.min(1, score / 15);

            return {
                skillId: skill.id,
                slug: skill.slug,
                name: skill.name,
                description: skill.description,
                category: skill.category,
                toolCount: skill._count.tools,
                confidence,
                rationale:
                    reasons.length > 0 ? reasons.slice(0, 3).join("; ") : "Low relevance match"
            };
        })
        .filter((s) => s.confidence > 0.05)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxResults);

    return scored;
}
