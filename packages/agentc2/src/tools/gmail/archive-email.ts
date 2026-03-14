import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { callGmailApi, resolveGmailAddress } from "./shared";

export const gmailArchiveEmailTool = createTool({
    id: "gmail-archive-email",
    description:
        "Archive a Gmail email by removing it from the inbox. Provide the message ID and the Gmail address.",
    inputSchema: z.object({
        messageId: z.string().describe("The Gmail message ID to archive"),
        gmailAddress: z
            .string()
            .default("")
            .describe("Google account email. Leave empty to auto-detect from connected account.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        messageId: z.string(),
        error: z.string().optional()
    }),
    execute: async ({ messageId, gmailAddress }) => {
        const address = await resolveGmailAddress(gmailAddress);
        try {
            const response = await callGmailApi(
                address,
                `/users/me/messages/${messageId}/modify`,
                {
                    method: "POST",
                    body: { removeLabelIds: ["INBOX"] }
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    messageId,
                    error: `Gmail API error ${response.status}: ${errorText}`
                };
            }

            return { success: true, messageId };
        } catch (error) {
            return {
                success: false,
                messageId,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
