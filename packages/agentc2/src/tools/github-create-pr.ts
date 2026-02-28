/**
 * GitHub Create Pull Request Tool
 *
 * Creates a pull request via the GitHub REST API.
 * Used by SDLC workflows to open a PR from a fix branch,
 * linking it back to the originating issue with "Fixes #N".
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
    resolveGitHubToken,
    parseRepoOwnerName,
    githubFetch,
    buildSignatureFooter
} from "./github-helpers";

export const githubCreatePullRequestTool = createTool({
    id: "github-create-pull-request",
    description:
        "Create a GitHub pull request from a head branch into a base branch. " +
        "Returns the PR number and URL. Include 'Fixes #N' in the body to " +
        "auto-close the linked issue on merge.",
    inputSchema: z.object({
        repository: z.string().describe("GitHub repository in owner/repo format or full URL"),
        head: z.string().describe("Branch containing the changes"),
        base: z.string().optional().describe("Target branch to merge into (default: 'main')"),
        title: z.string().describe("Pull request title"),
        body: z
            .string()
            .optional()
            .describe("Pull request body (Markdown). Include 'Fixes #N' to link an issue."),
        draft: z.boolean().optional().describe("Create as draft PR (default: false)"),
        organizationId: z.string().optional().describe("Organization ID for credential lookup"),
        workflowSlug: z.string().optional().describe("Workflow slug (for attribution footer)"),
        runId: z.string().optional().describe("Workflow run ID (for attribution footer)"),
        stepId: z.string().optional().describe("Workflow step ID (for attribution footer)"),
        agentSlug: z.string().optional().describe("Agent slug (for attribution footer)")
    }),
    outputSchema: z.object({
        prNumber: z.number(),
        prUrl: z.string(),
        htmlUrl: z.string()
    }),
    execute: async ({
        repository,
        head,
        base,
        title,
        body,
        draft,
        organizationId,
        workflowSlug,
        runId,
        stepId,
        agentSlug
    }) => {
        const token = await resolveGitHubToken(organizationId);
        const { owner, repo } = parseRepoOwnerName(repository);
        const footer = buildSignatureFooter({ workflowSlug, runId, stepId, agentSlug });

        const response = await githubFetch(`/repos/${owner}/${repo}/pulls`, token, {
            method: "POST",
            body: JSON.stringify({
                title,
                body: (body || "") + footer,
                head,
                base: base || "main",
                draft: draft || false
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`GitHub API error (${response.status}): ${errorBody}`);
        }

        const data = (await response.json()) as {
            number: number;
            url: string;
            html_url: string;
        };

        return {
            prNumber: data.number,
            prUrl: data.url,
            htmlUrl: data.html_url
        };
    }
});
