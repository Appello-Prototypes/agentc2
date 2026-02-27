/**
 * Ticket-to-GitHub-Issue Tool
 *
 * Creates a GitHub issue from a ticket (SupportTicket, BacklogTask, or manual input).
 * Resolves the GitHub PAT from the org's integration connection and calls the
 * GitHub REST API directly (no MCP client needed).
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

async function resolveGitHubToken(organizationId?: string): Promise<string> {
    const { prisma } = await import("@repo/database");
    const { decryptCredentials } = await import("../crypto");

    if (organizationId) {
        const connection = await prisma.integrationConnection.findFirst({
            where: {
                organizationId,
                provider: { key: "github" },
                isActive: true
            },
            include: { provider: true }
        });
        if (connection) {
            const creds = decryptCredentials(connection.credentials);
            const token =
                (creds as Record<string, string>)?.GITHUB_PERSONAL_ACCESS_TOKEN ||
                (creds as Record<string, string>)?.GITHUB_TOKEN;
            if (token) return token;
        }
    }

    if (process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
        return process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    }

    throw new Error(
        "GitHub credentials not available. Connect GitHub in the integrations page " +
            "or set GITHUB_PERSONAL_ACCESS_TOKEN environment variable."
    );
}

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
        organizationId: z.string().optional().describe("Organization ID for credential lookup"),
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

        const [owner, repo] = repository.split("/");
        if (!owner || !repo) {
            throw new Error(`Invalid repository format "${repository}". Expected "owner/repo".`);
        }

        const token = await resolveGitHubToken(organizationId);
        const footer = sourceTicketId
            ? `\n\n---\n_Created from ticket \`${sourceTicketId}\` via AgentC2 SDLC Pipeline_`
            : "";

        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title,
                body: description + footer,
                labels: labels || []
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(
                `GitHub API error (${response.status}): ${errorBody}`
            );
        }

        const data = (await response.json()) as { number: number; html_url: string };
        const issueNumber = data.number || 0;
        const issueUrl = data.html_url || `https://github.com/${repository}/issues/${issueNumber}`;

        let linked = false;
        if (pipelineRunId) {
            try {
                const { prisma } = await import("@repo/database");
                await prisma.codingPipelineRun.update({
                    where: { id: pipelineRunId },
                    data: { prUrl: issueUrl }
                });
                linked = true;
            } catch {
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
