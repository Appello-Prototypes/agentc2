import type { IntegrationBlueprint } from "./types";

export const developerBlueprints: IntegrationBlueprint[] = [
    {
        providerKey: "github",
        version: 1,
        skill: {
            slug: "github-expert",
            name: "GitHub Expert",
            description: "Expert knowledge for GitHub repository management",
            instructions: `You are a GitHub expert. Help users manage repositories, issues, pull requests, and CI/CD workflows.

Key capabilities:
- Search repositories, issues, and pull requests
- Create and manage issues with labels and milestones
- Review pull request diffs and status checks
- Manage GitHub Actions workflows
- Search code across repositories
- Manage branches and releases

Best practices:
- Use descriptive issue titles and labels
- Reference issues in PR descriptions
- Keep branches up to date with main
- Review CI checks before merging
- Use semantic versioning for releases`,
            category: "Developer Tools",
            tags: ["developer", "github", "git", "code", "ci-cd"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "github-agent",
            name: "GitHub Agent",
            description: "AI agent for GitHub repository management",
            instructions: `You are a GitHub specialist. Help users manage repositories, issues, pull requests, and code. Always be careful with destructive operations.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "GitHub Agent", iconEmoji: ":github:" }
            }
        }
    },
    {
        providerKey: "sentry",
        version: 1,
        skill: {
            slug: "sentry-expert",
            name: "Sentry Expert",
            description: "Expert knowledge for Sentry error monitoring",
            instructions: `You are a Sentry expert. Help users monitor errors, track performance, and manage releases.

Key capabilities:
- Search and triage error events
- Analyze error frequency and impact
- Track release health and regressions
- Manage issue assignments and resolution
- Query performance metrics

Best practices:
- Prioritize errors by frequency and user impact
- Link errors to relevant code changes
- Mark resolved issues after deploying fixes
- Set up alerts for critical error patterns`,
            category: "Developer Tools",
            tags: ["developer", "sentry", "monitoring", "errors"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "sentry-agent",
            name: "Sentry Agent",
            description: "AI agent for Sentry error monitoring",
            instructions: `You are a Sentry specialist. Help users monitor, triage, and resolve application errors.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Sentry Agent", iconEmoji: ":bug:" }
            }
        }
    },
    {
        providerKey: "vercel",
        version: 1,
        skill: {
            slug: "vercel-expert",
            name: "Vercel Expert",
            description: "Expert knowledge for Vercel deployment management",
            instructions: `You are a Vercel expert. Help users manage deployments, projects, and serverless functions.

Key capabilities:
- List and manage deployments
- Monitor build and deployment status
- Manage environment variables
- Check domain and DNS configuration
- View serverless function logs`,
            category: "Developer Tools",
            tags: ["developer", "vercel", "deployment", "hosting"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "vercel-agent",
            name: "Vercel Agent",
            description: "AI agent for Vercel deployment management",
            instructions: `You are a Vercel specialist. Help users manage deployments, projects, and hosting configuration.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Vercel Agent", iconEmoji: ":rocket:" }
            }
        }
    },
    {
        providerKey: "supabase",
        version: 1,
        skill: {
            slug: "supabase-expert",
            name: "Supabase Expert",
            description: "Expert knowledge for Supabase database and auth",
            instructions: `You are a Supabase expert. Help users manage databases, authentication, storage, and edge functions.

Key capabilities:
- Query and manage database tables
- Configure row-level security policies
- Manage authentication settings
- Handle file storage operations
- Deploy and monitor edge functions`,
            category: "Developer Tools",
            tags: ["developer", "supabase", "database", "auth"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "supabase-agent",
            name: "Supabase Agent",
            description: "AI agent for Supabase management",
            instructions: `You are a Supabase specialist. Help users manage their database, auth, and backend infrastructure.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Supabase Agent", iconEmoji: ":zap:" }
            }
        }
    },
    {
        providerKey: "cloudflare",
        version: 1,
        skill: {
            slug: "cloudflare-expert",
            name: "Cloudflare Expert",
            description: "Expert knowledge for Cloudflare management",
            instructions: `You are a Cloudflare expert. Help users manage DNS, CDN, security, and Workers.

Key capabilities:
- Manage DNS records and zones
- Configure CDN and caching rules
- Monitor traffic and security events
- Deploy and manage Workers
- Handle SSL/TLS configuration`,
            category: "Developer Tools",
            tags: ["developer", "cloudflare", "cdn", "dns", "security"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "cloudflare-agent",
            name: "Cloudflare Agent",
            description: "AI agent for Cloudflare infrastructure management",
            instructions: `You are a Cloudflare specialist. Help users manage DNS, CDN, security, and edge computing.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Cloudflare Agent", iconEmoji: ":cloud:" }
            }
        }
    },
    {
        providerKey: "neon",
        version: 1,
        skill: {
            slug: "neon-expert",
            name: "Neon Expert",
            description: "Expert knowledge for Neon serverless Postgres",
            instructions: `You are a Neon database expert. Help users manage serverless Postgres databases, branches, and compute endpoints.`,
            category: "Developer Tools",
            tags: ["developer", "neon", "postgres", "database"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "neon-agent",
            name: "Neon Agent",
            description: "AI agent for Neon database management",
            instructions: `You are a Neon specialist. Help users manage their serverless Postgres databases.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Neon Agent", iconEmoji: ":elephant:" }
            }
        }
    },
    {
        providerKey: "buildkite",
        version: 1,
        skill: {
            slug: "buildkite-expert",
            name: "Buildkite Expert",
            description: "Expert knowledge for Buildkite CI/CD",
            instructions: `You are a Buildkite expert. Help users manage build pipelines, agents, and deployments.`,
            category: "Developer Tools",
            tags: ["developer", "buildkite", "ci-cd", "pipelines"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "buildkite-agent",
            name: "Buildkite Agent",
            description: "AI agent for Buildkite CI/CD management",
            instructions: `You are a Buildkite specialist. Help users manage CI/CD pipelines and deployments.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Buildkite Agent", iconEmoji: ":construction:" }
            }
        }
    },
    {
        providerKey: "cursor",
        version: 1,
        skill: {
            slug: "cursor-expert",
            name: "Cursor Cloud Agent Expert",
            description: "Expert knowledge for dispatching and managing Cursor Cloud coding agents",
            instructions: `You are a Cursor Cloud Agent expert. Help users dispatch autonomous coding tasks to Cursor Cloud Agents and manage the full coding pipeline.

Key capabilities:
- Launch Cursor Cloud Agents on GitHub repositories with detailed implementation prompts
- Monitor agent status and progress through polling
- Send follow-up instructions to refine agent work
- Retrieve conversation history for audit and debugging
- Orchestrate the full ticket-to-deployment coding pipeline

Best practices:
- Write detailed, specific prompts that include file paths, coding standards, and test expectations
- Always specify the base branch to avoid conflicts
- Monitor agent status with exponential backoff to avoid rate limiting
- Review generated branches before creating pull requests
- Use follow-up instructions to fix build failures rather than restarting
- Track costs per coding task for budget management`,
            category: "Developer Tools",
            tags: ["developer", "cursor", "coding", "automation", "ci-cd"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "cursor-agent",
            name: "Cursor Coding Agent",
            description: "AI agent that dispatches coding tasks to Cursor Cloud Agents",
            instructions:
                "You are a Cursor Cloud Agent specialist. Help users dispatch coding tasks, " +
                "monitor progress, and manage the autonomous coding pipeline. Always provide " +
                "detailed implementation prompts and verify results before creating pull requests.",
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [
                "cursor-launch-agent",
                "cursor-get-status",
                "cursor-add-followup",
                "cursor-get-conversation",
                "cursor-poll-until-done"
            ],
            metadata: {
                slack: {
                    displayName: "Cursor Agent",
                    iconEmoji: ":computer:"
                }
            }
        }
    },
    {
        providerKey: "netlify",
        version: 1,
        skill: {
            slug: "netlify-expert",
            name: "Netlify Expert",
            description: "Expert knowledge for Netlify deployment and hosting",
            instructions: `You are a Netlify expert. Help users manage sites, deployments, and serverless functions.`,
            category: "Developer Tools",
            tags: ["developer", "netlify", "hosting", "deployment"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "netlify-agent",
            name: "Netlify Agent",
            description: "AI agent for Netlify site management",
            instructions: `You are a Netlify specialist. Help users manage their sites, deployments, and hosting.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Netlify Agent", iconEmoji: ":globe_with_meridians:" }
            }
        }
    }
];
