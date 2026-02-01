/**
 * Scorer Registry
 *
 * Central registry of all available scorers that can be attached to agents.
 * Scorers are referenced by their registry key (e.g., "relevancy", "toxicity").
 */

import { relevancyScorer, toxicityScorer, completenessScorer, toneScorer } from "./index";

/**
 * Scorer registry mapping names to scorer instances.
 * Add new scorers here to make them available for database-driven agents.
 */
export const scorerRegistry = {
    relevancy: relevancyScorer,
    toxicity: toxicityScorer,
    completeness: completenessScorer,
    tone: toneScorer
};

/**
 * Scorer info for UI display
 */
export interface ScorerInfo {
    id: string;
    name: string;
    description: string;
}

/**
 * List all available scorers with their metadata
 */
export function listAvailableScorers(): ScorerInfo[] {
    return [
        {
            id: "relevancy",
            name: "Answer Relevancy",
            description:
                "Evaluates how well responses address the input query (0-1, higher is better)"
        },
        {
            id: "toxicity",
            name: "Toxicity",
            description:
                "Detects harmful, offensive, or inappropriate content (0-1, lower is better)"
        },
        {
            id: "completeness",
            name: "Completeness",
            description:
                "Checks if responses include all necessary information (0-1, higher is better)"
        },
        {
            id: "tone",
            name: "Tone Consistency",
            description:
                "Measures consistency in formality, complexity, and style (0-1, higher is better)"
        }
    ];
}

/**
 * Get scorers by their registry names
 *
 * @param names - Array of scorer registry names (e.g., ["relevancy", "toxicity"])
 * @returns Record of scorer configurations ready for agent use
 */
export function getScorersByNames(
    names: string[]
): Record<string, { scorer: unknown; sampling: { type: string; rate: number } }> {
    const result: Record<string, { scorer: unknown; sampling: { type: string; rate: number } }> =
        {};

    for (const name of names) {
        const scorer = scorerRegistry[name as keyof typeof scorerRegistry];
        if (scorer) {
            result[name] = {
                scorer,
                sampling: { type: "ratio", rate: 1.0 }
            };
        }
    }

    return result;
}

/**
 * Check if a scorer exists in the registry
 */
export function hasScorerInRegistry(name: string): boolean {
    return name in scorerRegistry;
}

/**
 * Get a single scorer by name
 */
export function getScorerByName(name: string): unknown | undefined {
    return scorerRegistry[name as keyof typeof scorerRegistry];
}
