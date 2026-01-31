import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const prepareActionStep = createStep({
    id: "prepare-action",
    description: "Prepare the action that requires approval",
    inputSchema: z.object({
        action: z.string(),
        recipient: z.string(),
        message: z.string()
    }),
    outputSchema: z.object({
        action: z.string(),
        recipient: z.string(),
        message: z.string(),
        preview: z.string(),
        requiresApproval: z.boolean()
    }),
    execute: async ({ inputData }) => ({
        ...inputData,
        preview: `Action: ${inputData.action}\nTo: ${inputData.recipient}\nMessage: ${inputData.message}`,
        requiresApproval: true
    })
});

const approvalStep = createStep({
    id: "human-approval",
    description: "Wait for human approval before proceeding",
    inputSchema: z.object({
        action: z.string(),
        recipient: z.string(),
        message: z.string(),
        preview: z.string(),
        requiresApproval: z.boolean()
    }),
    outputSchema: z.object({
        action: z.string(),
        recipient: z.string(),
        message: z.string(),
        approved: z.boolean(),
        approvedBy: z.string().optional(),
        approvedAt: z.string().optional()
    }),
    resumeSchema: z.object({
        approved: z.boolean(),
        approvedBy: z.string().optional()
    }),
    suspendSchema: z.object({
        reason: z.string(),
        preview: z.string(),
        actionType: z.string()
    }),
    execute: async ({ inputData, resumeData, suspend }) => {
        if (resumeData?.approved !== undefined) {
            return {
                action: inputData.action,
                recipient: inputData.recipient,
                message: inputData.message,
                approved: resumeData.approved,
                approvedBy: resumeData.approvedBy,
                approvedAt: new Date().toISOString()
            };
        }

        return await suspend({
            reason: "Human approval required before proceeding",
            preview: inputData.preview,
            actionType: inputData.action
        });
    }
});

const executeActionStep = createStep({
    id: "execute-action",
    description: "Execute the action if approved",
    inputSchema: z.object({
        action: z.string(),
        recipient: z.string(),
        message: z.string(),
        approved: z.boolean(),
        approvedBy: z.string().optional(),
        approvedAt: z.string().optional()
    }),
    outputSchema: z.object({
        success: z.boolean(),
        executed: z.boolean(),
        result: z.string(),
        details: z.object({
            action: z.string(),
            recipient: z.string(),
            approved: z.boolean(),
            approvedBy: z.string().optional()
        })
    }),
    execute: async ({ inputData }) => {
        if (!inputData.approved) {
            return {
                success: false,
                executed: false,
                result: "Action was rejected by human reviewer",
                details: {
                    action: inputData.action,
                    recipient: inputData.recipient,
                    approved: false,
                    approvedBy: inputData.approvedBy
                }
            };
        }

        console.log(`Executing ${inputData.action} to ${inputData.recipient}`);

        return {
            success: true,
            executed: true,
            result: `Successfully sent ${inputData.action} to ${inputData.recipient}`,
            details: {
                action: inputData.action,
                recipient: inputData.recipient,
                approved: true,
                approvedBy: inputData.approvedBy
            }
        };
    }
});

export const humanApprovalWorkflow = createWorkflow({
    id: "human-approval",
    description: "Send a message after getting human approval",
    inputSchema: z.object({
        action: z.enum(["email", "slack", "sms"]).describe("Type of message to send"),
        recipient: z.string().describe("Recipient email/phone/channel"),
        message: z.string().describe("Message content")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        executed: z.boolean(),
        result: z.string(),
        details: z.object({
            action: z.string(),
            recipient: z.string(),
            approved: z.boolean(),
            approvedBy: z.string().optional()
        })
    })
})
    .then(prepareActionStep)
    .then(approvalStep)
    .then(executeActionStep)
    .commit();
