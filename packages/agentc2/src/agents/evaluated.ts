import { Agent } from "@mastra/core/agent";
import { toxicityScorer, completenessScorer, toneScorer } from "../scorers";

/**
 * Fully Evaluated Agent
 *
 * Demonstrates comprehensive scoring with all available scorers.
 * Useful for development and testing where you want full visibility.
 */
export const evaluatedAgent = new Agent({
    id: "evaluated-agent",
    name: "Fully Evaluated Agent",
    instructions: `You are a helpful assistant. Your responses are being evaluated for:
- Relevancy to the question
- Completeness of information
- Tone consistency
- Absence of toxic content

Strive to provide excellent responses that score well on all metrics.`,
    model: "anthropic/claude-sonnet-4-20250514",

    scorers: {
        toxicity: {
            scorer: toxicityScorer,
            sampling: { type: "ratio", rate: 1.0 }
        },
        completeness: {
            scorer: completenessScorer,
            sampling: { type: "ratio", rate: 1.0 }
        },
        tone: {
            scorer: toneScorer,
            sampling: { type: "ratio", rate: 1.0 }
        }
    }
});
