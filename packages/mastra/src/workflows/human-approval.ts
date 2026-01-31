import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

/**
 * Content Publishing Workflow - Human-in-the-Loop Demo
 *
 * Scenario: AI generates content (blog post, social media, newsletter) that
 * requires human review and approval before publishing.
 *
 * This demonstrates suspend/resume for human oversight of AI-generated content.
 */

// Content types and their constraints
const contentTypes = {
    blogPost: { minWords: 300, maxWords: 800 },
    tweet: { minWords: 5, maxWords: 50 },
    linkedinPost: { minWords: 50, maxWords: 200 },
    newsletter: { minWords: 200, maxWords: 500 }
};

/**
 * Generate Draft Step - AI creates content based on inputs
 */
const generateDraftStep = createStep({
    id: "generate-draft",
    description: "Generate AI content draft based on topic and parameters",
    inputSchema: z.object({
        contentType: z.enum(["blogPost", "tweet", "linkedinPost", "newsletter"]),
        topic: z.string(),
        tone: z.enum(["professional", "casual", "humorous", "inspirational"])
    }),
    outputSchema: z.object({
        contentType: z.enum(["blogPost", "tweet", "linkedinPost", "newsletter"]),
        topic: z.string(),
        tone: z.enum(["professional", "casual", "humorous", "inspirational"]),
        draft: z.object({
            title: z.string(),
            content: z.string(),
            hashtags: z.array(z.string()),
            wordCount: z.number(),
            readingTime: z.string()
        }),
        metadata: z.object({
            generatedAt: z.string(),
            model: z.string(),
            version: z.number()
        })
    }),
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        const typeConfig = contentTypes[inputData.contentType];
        const contentTypeName = {
            blogPost: "blog post",
            tweet: "tweet",
            linkedinPost: "LinkedIn post",
            newsletter: "newsletter section"
        }[inputData.contentType];

        const response = await agent.generate(
            `You are a professional content writer. Create a ${contentTypeName} with a ${inputData.tone} tone.

Topic: ${inputData.topic}

Requirements:
- Word count: ${typeConfig.minWords}-${typeConfig.maxWords} words
- Tone: ${inputData.tone}
- Include relevant hashtags (3-5)
- Make it engaging and shareable

Respond with ONLY a JSON object (no markdown):
{
  "title": "Compelling title for the content",
  "content": "The full content here...",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
}`
        );

        try {
            const text = response.text || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const content = parsed.content || "";
                const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;

                return {
                    contentType: inputData.contentType,
                    topic: inputData.topic,
                    tone: inputData.tone,
                    draft: {
                        title: parsed.title || `Content about ${inputData.topic}`,
                        content,
                        hashtags: parsed.hashtags || [],
                        wordCount,
                        readingTime: `${Math.ceil(wordCount / 200)} min read`
                    },
                    metadata: {
                        generatedAt: new Date().toISOString(),
                        model: "claude-sonnet",
                        version: 1
                    }
                };
            }
        } catch {
            // Fallback
        }

        return {
            contentType: inputData.contentType,
            topic: inputData.topic,
            tone: inputData.tone,
            draft: {
                title: `Thoughts on ${inputData.topic}`,
                content: `Here are some thoughts about ${inputData.topic}...`,
                hashtags: ["#content", "#ai"],
                wordCount: 10,
                readingTime: "1 min read"
            },
            metadata: {
                generatedAt: new Date().toISOString(),
                model: "claude-sonnet",
                version: 1
            }
        };
    }
});

/**
 * Prepare Review Step - Format content for human review
 */
const prepareReviewStep = createStep({
    id: "prepare-review",
    description: "Prepare the content for human review with metadata",
    inputSchema: z.object({
        contentType: z.enum(["blogPost", "tweet", "linkedinPost", "newsletter"]),
        topic: z.string(),
        tone: z.enum(["professional", "casual", "humorous", "inspirational"]),
        draft: z.object({
            title: z.string(),
            content: z.string(),
            hashtags: z.array(z.string()),
            wordCount: z.number(),
            readingTime: z.string()
        }),
        metadata: z.object({
            generatedAt: z.string(),
            model: z.string(),
            version: z.number()
        })
    }),
    outputSchema: z.object({
        contentType: z.enum(["blogPost", "tweet", "linkedinPost", "newsletter"]),
        topic: z.string(),
        tone: z.enum(["professional", "casual", "humorous", "inspirational"]),
        draft: z.object({
            title: z.string(),
            content: z.string(),
            hashtags: z.array(z.string()),
            wordCount: z.number(),
            readingTime: z.string()
        }),
        metadata: z.object({
            generatedAt: z.string(),
            model: z.string(),
            version: z.number()
        }),
        reviewChecklist: z.array(z.string()),
        preview: z.string()
    }),
    execute: async ({ inputData }) => {
        const reviewChecklist = [
            "Content is accurate and factual",
            "Tone matches brand guidelines",
            "No spelling or grammar errors",
            "Hashtags are relevant and appropriate",
            "Content length is appropriate for platform"
        ];

        const contentTypeName = {
            blogPost: "Blog Post",
            tweet: "Tweet",
            linkedinPost: "LinkedIn Post",
            newsletter: "Newsletter"
        }[inputData.contentType];

        const preview = `
=== ${contentTypeName} Preview ===

Title: ${inputData.draft.title}

${inputData.draft.content}

${inputData.draft.hashtags.join(" ")}

---
Word Count: ${inputData.draft.wordCount} | Reading Time: ${inputData.draft.readingTime}
Generated: ${inputData.metadata.generatedAt}
        `.trim();

        return {
            ...inputData,
            reviewChecklist,
            preview
        };
    }
});

/**
 * Human Approval Step - Suspend for human review
 */
const approvalStep = createStep({
    id: "human-approval",
    description: "Wait for human approval before publishing content",
    inputSchema: z.object({
        contentType: z.enum(["blogPost", "tweet", "linkedinPost", "newsletter"]),
        topic: z.string(),
        tone: z.enum(["professional", "casual", "humorous", "inspirational"]),
        draft: z.object({
            title: z.string(),
            content: z.string(),
            hashtags: z.array(z.string()),
            wordCount: z.number(),
            readingTime: z.string()
        }),
        metadata: z.object({
            generatedAt: z.string(),
            model: z.string(),
            version: z.number()
        }),
        reviewChecklist: z.array(z.string()),
        preview: z.string()
    }),
    outputSchema: z.object({
        contentType: z.enum(["blogPost", "tweet", "linkedinPost", "newsletter"]),
        draft: z.object({
            title: z.string(),
            content: z.string(),
            hashtags: z.array(z.string()),
            wordCount: z.number(),
            readingTime: z.string()
        }),
        approved: z.boolean(),
        approvedBy: z.string().optional(),
        approvedAt: z.string().optional(),
        rejectionReason: z.string().optional(),
        editedContent: z.string().optional()
    }),
    resumeSchema: z.object({
        approved: z.boolean(),
        approvedBy: z.string().optional(),
        rejectionReason: z.string().optional(),
        editedContent: z.string().optional()
    }),
    suspendSchema: z.object({
        reason: z.string(),
        contentType: z.string(),
        title: z.string(),
        content: z.string(),
        hashtags: z.array(z.string()),
        wordCount: z.number(),
        preview: z.string(),
        reviewChecklist: z.array(z.string())
    }),
    execute: async ({ inputData, resumeData, suspend }) => {
        if (resumeData?.approved !== undefined) {
            return {
                contentType: inputData.contentType,
                draft: {
                    ...inputData.draft,
                    // If edited content was provided, update it
                    content: resumeData.editedContent || inputData.draft.content
                },
                approved: resumeData.approved,
                approvedBy: resumeData.approvedBy,
                approvedAt: new Date().toISOString(),
                rejectionReason: resumeData.rejectionReason,
                editedContent: resumeData.editedContent
            };
        }

        return await suspend({
            reason: "Human review required before publishing AI-generated content",
            contentType: inputData.contentType,
            title: inputData.draft.title,
            content: inputData.draft.content,
            hashtags: inputData.draft.hashtags,
            wordCount: inputData.draft.wordCount,
            preview: inputData.preview,
            reviewChecklist: inputData.reviewChecklist
        });
    }
});

/**
 * Publish Step - Execute publishing if approved
 */
const publishStep = createStep({
    id: "publish",
    description: "Publish the approved content or archive if rejected",
    inputSchema: z.object({
        contentType: z.enum(["blogPost", "tweet", "linkedinPost", "newsletter"]),
        draft: z.object({
            title: z.string(),
            content: z.string(),
            hashtags: z.array(z.string()),
            wordCount: z.number(),
            readingTime: z.string()
        }),
        approved: z.boolean(),
        approvedBy: z.string().optional(),
        approvedAt: z.string().optional(),
        rejectionReason: z.string().optional(),
        editedContent: z.string().optional()
    }),
    outputSchema: z.object({
        status: z.enum(["published", "rejected", "archived"]),
        publishedAt: z.string().optional(),
        publishedUrl: z.string().optional(),
        content: z.object({
            title: z.string(),
            content: z.string(),
            hashtags: z.array(z.string())
        }),
        approval: z.object({
            approved: z.boolean(),
            approvedBy: z.string().optional(),
            approvedAt: z.string().optional(),
            rejectionReason: z.string().optional()
        }),
        summary: z.string()
    }),
    execute: async ({ inputData }) => {
        const platformUrls = {
            blogPost: "https://blog.example.com/posts/",
            tweet: "https://twitter.com/example/status/",
            linkedinPost: "https://linkedin.com/posts/",
            newsletter: "https://newsletter.example.com/issues/"
        };

        if (!inputData.approved) {
            return {
                status: "rejected" as const,
                content: {
                    title: inputData.draft.title,
                    content: inputData.draft.content,
                    hashtags: inputData.draft.hashtags
                },
                approval: {
                    approved: false,
                    approvedBy: inputData.approvedBy,
                    approvedAt: inputData.approvedAt,
                    rejectionReason: inputData.rejectionReason
                },
                summary: `Content was rejected by ${inputData.approvedBy || "reviewer"}. Reason: ${inputData.rejectionReason || "No reason provided"}`
            };
        }

        // Simulate publishing
        const publishId = Date.now().toString(36);
        const publishedUrl = `${platformUrls[inputData.contentType]}${publishId}`;

        return {
            status: "published" as const,
            publishedAt: new Date().toISOString(),
            publishedUrl,
            content: {
                title: inputData.draft.title,
                content: inputData.editedContent || inputData.draft.content,
                hashtags: inputData.draft.hashtags
            },
            approval: {
                approved: true,
                approvedBy: inputData.approvedBy,
                approvedAt: inputData.approvedAt
            },
            summary: `Content successfully published to ${inputData.contentType}. View at: ${publishedUrl}`
        };
    }
});

export const humanApprovalWorkflow = createWorkflow({
    id: "human-approval",
    description:
        "Content publishing workflow - AI generates content that requires human approval before publishing",
    inputSchema: z.object({
        contentType: z
            .enum(["blogPost", "tweet", "linkedinPost", "newsletter"])
            .describe("Type of content to create"),
        topic: z.string().describe("Topic or subject for the content"),
        tone: z
            .enum(["professional", "casual", "humorous", "inspirational"])
            .describe("Desired tone of the content")
    }),
    outputSchema: z.object({
        status: z.enum(["published", "rejected", "archived"]),
        publishedAt: z.string().optional(),
        publishedUrl: z.string().optional(),
        content: z.object({
            title: z.string(),
            content: z.string(),
            hashtags: z.array(z.string())
        }),
        approval: z.object({
            approved: z.boolean(),
            approvedBy: z.string().optional(),
            approvedAt: z.string().optional(),
            rejectionReason: z.string().optional()
        }),
        summary: z.string()
    })
})
    .then(generateDraftStep)
    .then(prepareReviewStep)
    .then(approvalStep)
    .then(publishStep)
    .commit();
