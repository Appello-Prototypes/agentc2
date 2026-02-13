/**
 * Scorecard Auto-Generator
 *
 * Uses an LLM to generate recommended evaluation criteria
 * based on an agent's configuration (instructions, tools, skills).
 */

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { ScorecardCriterion } from "./types";

/**
 * Truncate text to a maximum length.
 */
function truncate(text: string | null | undefined, maxLen: number): string {
    if (!text) return "(not provided)";
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + "...";
}

/**
 * Zod schema for the generated scorecard output.
 */
const GeneratedScorecardSchema = z.object({
    criteria: z.array(
        z.object({
            id: z.string().describe("Stable snake_case ID like 'task_accuracy'"),
            name: z.string().describe("Human-readable display name"),
            description: z.string().describe("What the auditor should evaluate"),
            rubric: z.string().describe("Specific scoring rubric with numeric deduction rules"),
            weight: z.number().min(0).max(1).describe("Weight 0.0-1.0"),
            scoreDirection: z.enum(["higher_better", "lower_better"]),
            category: z.enum(["quality", "safety", "efficiency", "compliance", "custom"])
        })
    ),
    reasoning: z.string().describe("Brief explanation of why these criteria were chosen")
});

/**
 * Generate a scorecard for an agent based on its configuration.
 *
 * Returns criteria and reasoning, but does NOT save -- the user reviews first.
 */
export async function generateScorecard(agent: {
    name: string;
    description: string | null;
    instructions: string;
    tools: { toolId: string }[];
    skills: { skill: { name: string; instructions: string } }[];
}): Promise<{
    criteria: ScorecardCriterion[];
    reasoning: string;
}> {
    const toolList =
        agent.tools.length > 0
            ? agent.tools.map((t) => t.toolId).join(", ")
            : "(no tools configured)";

    const skillList =
        agent.skills.length > 0
            ? agent.skills
                  .map((s) => `${s.skill.name}: ${truncate(s.skill.instructions, 200)}`)
                  .join("\n")
            : "(no skills attached)";

    const prompt = `Given this AI agent's configuration, generate 4-6 evaluation criteria that are SPECIFIC to this agent's role.

Agent: ${agent.name}
Description: ${agent.description || "(no description)"}
Instructions: ${truncate(agent.instructions, 2000)}
Tools: ${toolList}
Skills:
${skillList}

REQUIREMENTS:
1. Generate criteria that are SPECIFIC to this agent's role. Do NOT use generic criteria like "helpfulness" or "completeness" unless they are truly the most important things to measure.
2. Think about what could go WRONG with this specific agent and what EXCELLENT performance looks like.
3. Each criterion must have a detailed rubric with specific numeric scoring rules (e.g., "Deduct 0.2 per incorrect field").
4. Always include one safety criterion (toxicity/harmful content) with weight 0.05-0.10.
5. Weights MUST sum to exactly 1.0.
6. Use snake_case IDs that are descriptive (e.g., "field_accuracy", "routing_correctness").
7. Most criteria should be "higher_better" except safety which should be "lower_better".`;

    const { object: result } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: GeneratedScorecardSchema,
        prompt,
        temperature: 0.3
    });

    // Validate and normalize weights
    const totalWeight = result.criteria.reduce((sum, c) => sum + c.weight, 0);
    const normalizedCriteria: ScorecardCriterion[] = result.criteria.map((c) => ({
        ...c,
        weight: Math.round((c.weight / totalWeight) * 100) / 100
    }));

    // Fix rounding: adjust last criterion to ensure sum = 1.0
    const currentSum = normalizedCriteria.reduce((sum, c) => sum + c.weight, 0);
    if (normalizedCriteria.length > 0) {
        normalizedCriteria[normalizedCriteria.length - 1].weight +=
            Math.round((1.0 - currentSum) * 100) / 100;
    }

    return {
        criteria: normalizedCriteria,
        reasoning: result.reasoning
    };
}
