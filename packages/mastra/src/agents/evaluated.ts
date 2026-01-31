import { Agent } from "@mastra/core/agent";
import {
    relevancyScorer,
    toxicityScorer,
    completenessScorer,
    helpfulnessScorer,
    codeQualityScorer
} from "../scorers";

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
- Helpfulness and actionability
- Absence of toxic content
- Code quality (when providing code)

Strive to provide excellent responses that score well on all metrics.`,
    model: "anthropic/claude-sonnet-4-20250514",

    scorers: {
        relevancy: {
            scorer: relevancyScorer,
            sampling: { type: "ratio", rate: 1.0 }
        },
        toxicity: {
            scorer: toxicityScorer,
            sampling: { type: "ratio", rate: 1.0 }
        },
        completeness: {
            scorer: completenessScorer,
            sampling: { type: "ratio", rate: 1.0 }
        },
        helpfulness: {
            scorer: helpfulnessScorer,
            sampling: { type: "ratio", rate: 1.0 }
        },
        codeQuality: {
            scorer: codeQualityScorer,
            sampling: { type: "ratio", rate: 1.0 }
        }
    }
});
