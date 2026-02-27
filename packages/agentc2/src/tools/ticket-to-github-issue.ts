/**
 * Ticket-to-GitHub-Issue Tool
 *
 * Creates a GitHub issue from a ticket (SupportTicket, BacklogTask, or manual input).
 * Uses the org's GitHub MCP connection to create the issue and links it back to the
 * CodingPipelineRun if one exists.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const ticketToGithubIssueTool = createTool({
    id: "ticket-to-github-issue",
    description:
        "Create a GitHub issue from a ticket. Takes ticket title, description, labels, " +
        "and target repo. Returns the created issue number and URL. Optionally links " +
        "the issue back to a CodingPipelineRun.",
    inputSchema: z.object({
        title: z.string().describe("Issue title"),
        description: z.string().describe("Issue body/description (Markdown supported)"),
        repository: z
            .string()
            .describe("Target GitHub repository in owner/repo format (e.g. 'myorg/myrepo')"),
        labels: z
            .array(z.string())
            .optional()
            .describe("GitHub labels to apply (e.g. ['bug', 'priority:high'])"),
        sourceTicketId: z
            .string()
            .optional()
            .describe("Original SupportTicket or BacklogTask ID for back-linking"),
        pipelineRunId: z
            .string()
            .optional()
            .describe("CodingPipelineRun ID to update with the GitHub issue URL"),
        organizationId: z.string().optional().describe("Organization ID for MCP connection lookup"),
        existingIssueUrl: z
            .string()
            .optional()
            .describe(
                "If provided, skip issue creation and return this existing issue. " +
                    "Use when the workflow was triggered from an existing GitHub Issue."
            ),
        existingIssueNumber: z
            .number()
            .optional()
            .describe("Issue number of the existing issue (used with existingIssueUrl)")
    }),
    outputSchema: z.object({
        issueNumber: z.number(),
        issueUrl: z.string(),
        repository: z.string(),
        linked: z.boolean()
    }),
    execute: async ({
        title,
        description,
        repository,
        labels,
        sourceTicketId,
        pipelineRunId,
        organizationId,
        existingIssueUrl,
        existingIssueNumber
    }) => {
        if (existingIssueUrl) {
            const issueNumber =
                existingIssueNumber ?? (Number(existingIssueUrl.split("/").pop()) || 0);
            return {
                issueNumber,
                issueUrl: existingIssueUrl,
                repository,
                linked: false
            };
        }

        const { getToolsByNamesAsync } = await import("./registry");

        const [owner, repo] = repository.split("/");
        if (!owner || !repo) {
            throw new Error(`Invalid repository format "${repository}". Expected "owner/repo".`);
        }

        const footer = sourceTicketId
            ? `\n\n---\n_Created from ticket \`${sourceTicketId}\` via AgentC2 SDLC Pipeline_`
            : "";

        const tools = await getToolsByNamesAsync(["github_create_issue"], organizationId);
        const createIssueTool = tools["github_create_issue"];

        let issueNumber: number;
        let issueUrl: string;

        if (createIssueTool) {
            const handler =
                createIssueTool.execute ||
                createIssueTool.invoke ||
                createIssueTool.run ||
                createIssueTool;
            if (typeof handler !== "function") {
                throw new Error("GitHub create_issue tool found but has no callable handler");
            }

            const result = await handler({
                owner,
                repo,
                title,
                body: description + footer,
                labels: labels || []
            });

            const parsed = result && typeof result === "object" ? result : {};
            const data = (parsed as Record<string, unknown>).content
                ? JSON.parse(
                      (
                          (parsed as Record<string, unknown[]>).content?.find(
                              (c: unknown) => (c as Record<string, string>).type === "text"
                          ) as Record<string, string>
                      )?.text || "{}"
                  )
                : parsed;

            issueNumber = (data as Record<string, number>).number || 0;
            issueUrl =
                (data as Record<string, string>).html_url ||
                `https://github.com/${repository}/issues/${issueNumber}`;
        } else {
            throw new Error(
                "GitHub MCP connection not available. Connect GitHub in the integrations page."
            );
        }

        let linked = false;
        if (pipelineRunId) {
            try {
                const { prisma } = await import("@repo/database");
                await prisma.codingPipelineRun.update({
                    where: { id: pipelineRunId },
                    data: {
                        prUrl: issueUrl
                    }
                });
                linked = true;
            } catch {
                // Non-critical — log but don't fail
                console.warn(
                    `[ticket-to-github-issue] Could not link issue to pipeline run ${pipelineRunId}`
                );
            }
        }

        return {
            issueNumber,
            issueUrl,
            repository,
            linked
        };
    }
});
