/**
 * GitHub Issue Comment Tool
 *
 * Posts a comment on a GitHub issue via the REST API.
 * Used by SDLC workflows to publish analysis, status updates,
 * and audit results directly on the tracking issue.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { resolveGitHubToken, parseRepoOwnerName, githubFetch } from "./github-helpers";

export const githubAddIssueCommentTool = createTool({
    id: "github-add-issue-comment",
    description:
        "Post a comment on a GitHub issue. Supports full Markdown. " +
        "Returns the created comment ID and URL.",
    inputSchema: z.object({
        repository: z.string().describe("GitHub repository in owner/repo format or full URL"),
        issueNumber: z.number().describe("Issue number to comment on"),
        body: z.string().describe("Comment body (Markdown supported)"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup")
    }),
    outputSchema: z.object({
        commentId: z.number(),
        commentUrl: z.string()
    }),
    execute: async ({ repository, issueNumber, body, organizationId }) => {
        const token = await resolveGitHubToken(organizationId);
        const { owner, repo } = parseRepoOwnerName(repository);

        const response = await githubFetch(
            `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
            token,
            {
                method: "POST",
                body: JSON.stringify({ body })
            }
        );

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`GitHub API error (${response.status}): ${errorBody}`);
        }

        const data = (await response.json()) as { id: number; html_url: string };

        return {
            commentId: data.id,
            commentUrl: data.html_url
        };
    }
});
