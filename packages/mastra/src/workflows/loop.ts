import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

/**
 * Batch Lead Enrichment Workflow - Foreach Loop Demo
 *
 * Scenario: Process a list of sales leads - enrich each with company info,
 * score by potential, and generate personalized outreach suggestions.
 *
 * This demonstrates scalable batch processing with configurable concurrency.
 */

// Schema for enriched lead data
const enrichedLeadSchema = z.object({
    companyName: z.string(),
    industry: z.string(),
    estimatedSize: z.enum(["startup", "small", "medium", "large", "enterprise"]),
    website: z.string(),
    leadScore: z.number(),
    scoreFactors: z.array(z.string()),
    personalizedOutreach: z.string(),
    recommendedChannel: z.enum(["email", "linkedin", "phone", "event"])
});

/**
 * Prepare Step - Parse and validate lead list
 */
const prepareStep = createStep({
    id: "prepare",
    description: "Prepare and validate the list of leads for processing",
    inputSchema: z.object({
        companies: z.array(z.string()).describe("List of company names to enrich")
    }),
    outputSchema: z.array(
        z.object({
            companyName: z.string(),
            index: z.number()
        })
    ),
    execute: async ({ inputData }) => {
        // Clean and deduplicate company names
        const cleaned = inputData.companies
            .map((name) => name.trim())
            .filter((name) => name.length > 0)
            .filter((name, index, self) => self.indexOf(name) === index);

        return cleaned.map((companyName, index) => ({ companyName, index }));
    }
});

/**
 * Process Lead Step - Enrich a single lead with AI
 */
const processLeadStep = createStep({
    id: "process-lead",
    description: "Enrich a single lead with company information and scoring",
    inputSchema: z.object({
        companyName: z.string(),
        index: z.number()
    }),
    outputSchema: enrichedLeadSchema,
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        const response = await agent.generate(
            `You are a sales intelligence assistant. Enrich this lead with realistic business data.

Company Name: ${inputData.companyName}

Generate realistic (but fictional) enrichment data for this company. Make educated guesses based on the company name about their likely industry and size.

Respond with ONLY a JSON object (no markdown):
{
  "industry": "e.g., Technology, Healthcare, Finance, Retail, Manufacturing",
  "estimatedSize": "startup" | "small" | "medium" | "large" | "enterprise",
  "website": "www.companyname.com",
  "leadScore": 1-100 (higher = better prospect),
  "scoreFactors": ["reason for score", "another reason"],
  "personalizedOutreach": "A brief, personalized outreach message for this company",
  "recommendedChannel": "email" | "linkedin" | "phone" | "event"
}`
        );

        try {
            const text = response.text || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    companyName: inputData.companyName,
                    industry: parsed.industry || "Unknown",
                    estimatedSize: parsed.estimatedSize || "medium",
                    website:
                        parsed.website ||
                        `www.${inputData.companyName.toLowerCase().replace(/\s+/g, "")}.com`,
                    leadScore: parsed.leadScore || 50,
                    scoreFactors: parsed.scoreFactors || [],
                    personalizedOutreach: parsed.personalizedOutreach || "",
                    recommendedChannel: parsed.recommendedChannel || "email"
                };
            }
        } catch {
            // Fallback
        }

        return {
            companyName: inputData.companyName,
            industry: "Unknown",
            estimatedSize: "medium" as const,
            website: `www.${inputData.companyName.toLowerCase().replace(/\s+/g, "")}.com`,
            leadScore: 50,
            scoreFactors: ["Default scoring applied"],
            personalizedOutreach: `Hello ${inputData.companyName} team, I'd love to connect about how we can help your business grow.`,
            recommendedChannel: "email" as const
        };
    }
});

/**
 * Aggregate Step - Compile results and generate insights
 */
const aggregateStep = createStep({
    id: "aggregate",
    description: "Aggregate all enriched leads and generate summary insights",
    inputSchema: z.array(enrichedLeadSchema),
    outputSchema: z.object({
        leads: z.array(enrichedLeadSchema),
        summary: z.object({
            totalLeads: z.number(),
            averageScore: z.number(),
            topLeads: z.array(z.string()),
            industryBreakdown: z.record(z.number()),
            sizeBreakdown: z.record(z.number()),
            recommendedPriority: z.array(
                z.object({
                    companyName: z.string(),
                    score: z.number(),
                    reason: z.string()
                })
            )
        })
    }),
    execute: async ({ inputData }) => {
        // Sort by lead score descending
        const sortedLeads = [...inputData].sort((a, b) => b.leadScore - a.leadScore);

        // Calculate average score
        const totalScore = inputData.reduce((sum, lead) => sum + lead.leadScore, 0);
        const averageScore = inputData.length > 0 ? Math.round(totalScore / inputData.length) : 0;

        // Top leads (score > 70)
        const topLeads = sortedLeads.filter((l) => l.leadScore >= 70).map((l) => l.companyName);

        // Industry breakdown
        const industryBreakdown: Record<string, number> = {};
        inputData.forEach((lead) => {
            industryBreakdown[lead.industry] = (industryBreakdown[lead.industry] || 0) + 1;
        });

        // Size breakdown
        const sizeBreakdown: Record<string, number> = {};
        inputData.forEach((lead) => {
            sizeBreakdown[lead.estimatedSize] = (sizeBreakdown[lead.estimatedSize] || 0) + 1;
        });

        // Recommended priority (top 3)
        const recommendedPriority = sortedLeads.slice(0, 3).map((lead) => ({
            companyName: lead.companyName,
            score: lead.leadScore,
            reason: lead.scoreFactors[0] || "High potential lead"
        }));

        return {
            leads: sortedLeads,
            summary: {
                totalLeads: inputData.length,
                averageScore,
                topLeads,
                industryBreakdown,
                sizeBreakdown,
                recommendedPriority
            }
        };
    }
});

export const foreachWorkflow = createWorkflow({
    id: "foreach-loop",
    description: "Batch lead enrichment - process and score multiple sales leads with AI",
    inputSchema: z.object({
        companies: z.array(z.string()).describe("List of company names to enrich")
    }),
    outputSchema: z.object({
        leads: z.array(enrichedLeadSchema),
        summary: z.object({
            totalLeads: z.number(),
            averageScore: z.number(),
            topLeads: z.array(z.string()),
            industryBreakdown: z.record(z.number()),
            sizeBreakdown: z.record(z.number()),
            recommendedPriority: z.array(
                z.object({
                    companyName: z.string(),
                    score: z.number(),
                    reason: z.string()
                })
            )
        })
    })
})
    .then(prepareStep)
    .foreach(processLeadStep, { concurrency: 3 })
    .then(aggregateStep)
    .commit();

// ============================================================================
// DoWhile Loop Demo - Progress Counter
// ============================================================================

const incrementStep = createStep({
    id: "increment",
    description: "Increment counter",
    inputSchema: z.object({
        count: z.number(),
        target: z.number()
    }),
    outputSchema: z.object({
        count: z.number(),
        target: z.number(),
        progress: z.number()
    }),
    execute: async ({ inputData }) => ({
        count: inputData.count + 1,
        target: inputData.target,
        progress: Math.round(((inputData.count + 1) / inputData.target) * 100)
    })
});

export const doWhileWorkflow = createWorkflow({
    id: "dowhile-loop",
    description: "Count up to a target using dowhile loop",
    inputSchema: z.object({
        count: z.number().default(0),
        target: z.number().describe("Target count to reach")
    }),
    outputSchema: z.object({
        count: z.number(),
        target: z.number(),
        progress: z.number()
    })
})
    .dowhile(incrementStep, async ({ inputData }) => inputData.count < inputData.target)
    .commit();
