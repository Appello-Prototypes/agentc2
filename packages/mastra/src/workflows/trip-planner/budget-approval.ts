import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

/**
 * Budget Approval Workflow
 *
 * Human-in-the-loop workflow for budget confirmation before "booking."
 * Flow: Calculate Total → Await Approval → Confirm or Suggest Alternatives
 */

// Input schema for budget approval
const budgetApprovalInputSchema = z.object({
    tripName: z.string().describe("Name/description of the trip"),
    destination: z.string().describe("Destination"),
    dates: z.object({
        start: z.string(),
        end: z.string()
    }),
    travelers: z.number().describe("Number of travelers"),
    costs: z.object({
        transport: z.number().describe("Flight/transport costs"),
        accommodation: z.number().describe("Hotel/lodging costs"),
        activities: z.number().describe("Activities and tours"),
        food: z.number().optional().describe("Estimated food budget"),
        miscellaneous: z.number().optional().describe("Buffer/misc expenses")
    }),
    userBudget: z.number().optional().describe("User's stated budget limit")
});

/**
 * Calculate Total Step - Sum up all costs and compare to budget
 */
const calculateTotalStep = createStep({
    id: "calculate-budget",
    description: "Calculate total trip cost and compare to user budget",
    inputSchema: budgetApprovalInputSchema,
    outputSchema: z.object({
        tripName: z.string(),
        destination: z.string(),
        dates: z.object({
            start: z.string(),
            end: z.string()
        }),
        travelers: z.number(),
        breakdown: z.object({
            transport: z.number(),
            accommodation: z.number(),
            activities: z.number(),
            food: z.number(),
            miscellaneous: z.number()
        }),
        totalCost: z.number(),
        perPerson: z.number(),
        userBudget: z.number().nullable(),
        withinBudget: z.boolean(),
        budgetDifference: z.number()
    }),
    execute: async ({ inputData }) => {
        const { costs, travelers, userBudget } = inputData;

        // Calculate totals
        const food = costs.food || Math.round(costs.accommodation * 0.3); // Estimate if not provided
        const miscellaneous =
            costs.miscellaneous ||
            Math.round((costs.transport + costs.accommodation + costs.activities) * 0.1);

        const totalCost =
            costs.transport + costs.accommodation + costs.activities + food + miscellaneous;
        const perPerson = Math.round(totalCost / travelers);

        const withinBudget = userBudget ? totalCost <= userBudget : true;
        const budgetDifference = userBudget ? totalCost - userBudget : 0;

        return {
            tripName: inputData.tripName,
            destination: inputData.destination,
            dates: inputData.dates,
            travelers,
            breakdown: {
                transport: costs.transport,
                accommodation: costs.accommodation,
                activities: costs.activities,
                food,
                miscellaneous
            },
            totalCost,
            perPerson,
            userBudget: userBudget || null,
            withinBudget,
            budgetDifference
        };
    }
});

/**
 * Await Approval Step - Suspend workflow for user decision
 */
const awaitApprovalStep = createStep({
    id: "await-approval",
    description: "Wait for user to approve or reject the budget",
    inputSchema: z.object({
        tripName: z.string(),
        destination: z.string(),
        dates: z.object({
            start: z.string(),
            end: z.string()
        }),
        travelers: z.number(),
        breakdown: z.object({
            transport: z.number(),
            accommodation: z.number(),
            activities: z.number(),
            food: z.number(),
            miscellaneous: z.number()
        }),
        totalCost: z.number(),
        perPerson: z.number(),
        userBudget: z.number().nullable(),
        withinBudget: z.boolean(),
        budgetDifference: z.number()
    }),
    outputSchema: z.object({
        approved: z.boolean(),
        budgetSummary: z.object({
            tripName: z.string(),
            destination: z.string(),
            totalCost: z.number(),
            perPerson: z.number(),
            breakdown: z.object({
                transport: z.number(),
                accommodation: z.number(),
                activities: z.number(),
                food: z.number(),
                miscellaneous: z.number()
            })
        }),
        feedback: z.string().optional()
    }),
    execute: async ({ inputData, suspend }) => {
        // Suspend workflow for user approval
        const suspendData = {
            message: "Budget approval required",
            budgetSummary: {
                tripName: inputData.tripName,
                destination: inputData.destination,
                totalCost: inputData.totalCost,
                perPerson: inputData.perPerson,
                breakdown: inputData.breakdown,
                withinBudget: inputData.withinBudget,
                budgetDifference: inputData.budgetDifference
            },
            options: ["approve", "reject", "modify"]
        };

        const resumeData = (await suspend(suspendData)) as
            | { approved?: boolean; feedback?: string }
            | undefined;

        // Handle resume with user's decision
        const approved = resumeData?.approved === true;
        const feedback = resumeData?.feedback || "";

        return {
            approved,
            budgetSummary: {
                tripName: inputData.tripName,
                destination: inputData.destination,
                totalCost: inputData.totalCost,
                perPerson: inputData.perPerson,
                breakdown: inputData.breakdown
            },
            feedback
        };
    }
});

/**
 * Process Decision Step - Handle approval or suggest alternatives
 */
const processDecisionStep = createStep({
    id: "process-decision",
    description: "Process the approval decision and generate appropriate response",
    inputSchema: z.object({
        approved: z.boolean(),
        budgetSummary: z.object({
            tripName: z.string(),
            destination: z.string(),
            totalCost: z.number(),
            perPerson: z.number(),
            breakdown: z.object({
                transport: z.number(),
                accommodation: z.number(),
                activities: z.number(),
                food: z.number(),
                miscellaneous: z.number()
            })
        }),
        feedback: z.string().optional()
    }),
    outputSchema: z.object({
        status: z.enum(["confirmed", "alternatives-suggested", "cancelled"]),
        message: z.string(),
        confirmation: z
            .object({
                tripName: z.string(),
                destination: z.string(),
                totalCost: z.number(),
                bookingReference: z.string()
            })
            .optional(),
        alternatives: z
            .array(
                z.object({
                    category: z.string(),
                    suggestion: z.string(),
                    potentialSavings: z.number()
                })
            )
            .optional()
    }),
    execute: async ({ inputData, mastra }) => {
        if (inputData.approved) {
            // Generate confirmation
            const bookingRef = `TRIP-${Date.now().toString(36).toUpperCase()}`;

            return {
                status: "confirmed" as const,
                message: `Your trip to ${inputData.budgetSummary.destination} has been confirmed!`,
                confirmation: {
                    tripName: inputData.budgetSummary.tripName,
                    destination: inputData.budgetSummary.destination,
                    totalCost: inputData.budgetSummary.totalCost,
                    bookingReference: bookingRef
                }
            };
        }

        // Generate budget alternatives
        const { breakdown } = inputData.budgetSummary;
        const alternatives = [];

        // Suggest transport alternatives
        if (breakdown.transport > 500) {
            alternatives.push({
                category: "Transport",
                suggestion: "Consider flexible dates or connecting flights for better prices",
                potentialSavings: Math.round(breakdown.transport * 0.2)
            });
        }

        // Suggest accommodation alternatives
        if (breakdown.accommodation > 300) {
            alternatives.push({
                category: "Accommodation",
                suggestion: "Try vacation rentals or hotels slightly outside city center",
                potentialSavings: Math.round(breakdown.accommodation * 0.3)
            });
        }

        // Suggest activity alternatives
        if (breakdown.activities > 200) {
            alternatives.push({
                category: "Activities",
                suggestion: "Look for free walking tours and city passes for discounts",
                potentialSavings: Math.round(breakdown.activities * 0.25)
            });
        }

        // General savings
        alternatives.push({
            category: "General",
            suggestion: "Travel during shoulder season for lower prices across all categories",
            potentialSavings: Math.round(inputData.budgetSummary.totalCost * 0.15)
        });

        return {
            status: "alternatives-suggested" as const,
            message: `Here are some ways to reduce your trip budget${inputData.feedback ? ` based on your feedback: "${inputData.feedback}"` : ""}`,
            alternatives
        };
    }
});

/**
 * Budget Approval Workflow
 *
 * A human-in-the-loop workflow that:
 * 1. Calculates total trip cost
 * 2. Suspends for user approval
 * 3. Either confirms booking or suggests alternatives
 */
export const budgetApprovalWorkflow = createWorkflow({
    id: "trip-budget-approval",
    description: `Human-in-the-loop workflow for budget approval. Calculates total 
cost, presents breakdown to user, and either confirms or suggests alternatives.`,
    inputSchema: budgetApprovalInputSchema,
    outputSchema: z.object({
        status: z.enum(["confirmed", "alternatives-suggested", "cancelled"]),
        message: z.string(),
        confirmation: z
            .object({
                tripName: z.string(),
                destination: z.string(),
                totalCost: z.number(),
                bookingReference: z.string()
            })
            .optional(),
        alternatives: z
            .array(
                z.object({
                    category: z.string(),
                    suggestion: z.string(),
                    potentialSavings: z.number()
                })
            )
            .optional()
    })
})
    .then(calculateTotalStep)
    .then(awaitApprovalStep)
    .then(processDecisionStep)
    .commit();
