import type { ComparisonData } from "@/components/website/comparison/comparison-page-template";

import { copilotStudioData } from "./copilot-studio";
import { crewaiData } from "./crewai";
import { langchainData } from "./langchain";
import { mastraData } from "./mastra";
import { n8nData } from "./n8n";
import { openaiData } from "./openai";
import { relevanceAiData } from "./relevance-ai";

export const allComparisons: Record<string, ComparisonData> = {
    langchain: langchainData,
    n8n: n8nData,
    crewai: crewaiData,
    openai: openaiData,
    "copilot-studio": copilotStudioData,
    "relevance-ai": relevanceAiData,
    mastra: mastraData
};

export const comparisonSlugs = Object.keys(allComparisons);

export {
    copilotStudioData,
    crewaiData,
    langchainData,
    mastraData,
    n8nData,
    openaiData,
    relevanceAiData
};
