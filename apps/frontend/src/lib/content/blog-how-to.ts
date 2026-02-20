import type { BlogPost } from "./blog";

const author = "AgentC2 Editorial Team";

export const HOWTO_POSTS: BlogPost[] = [
    {
        slug: "how-to-build-first-ai-agent-5-minutes",
        title: "How to Build Your First AI Agent in 5 Minutes",
        description:
            "Zero-to-deployed AI agent tutorial. Connect tools, write instructions, test, and deploy your first autonomous agent on AgentC2.",
        category: "tutorial",
        primaryKeyword: "build ai agent",
        secondaryKeywords: ["create ai agent", "ai agent tutorial", "getting started ai agent"],
        publishedAt: "2026-02-19",
        updatedAt: "2026-02-19",
        author,
        readMinutes: 8,
        relatedDocs: [
            "getting-started/quickstart",
            "agents/creating-agents",
            "agents/configuration"
        ],
        relatedPosts: [
            "deploying-ai-agents-to-production-checklist",
            "best-ai-agent-platform-enterprise-2026",
            "how-to-connect-ai-agents-existing-tools"
        ],
        faqItems: [
            {
                question: "Do I need to write code to build an AI agent?",
                answer: "No. AgentC2 provides a visual interface for creating agents. You define the agent's name, instructions, model, and tools through the platform UI. No coding required for standard deployments."
            },
            {
                question: "What model should I use for my first agent?",
                answer: "Start with GPT-4o for the best balance of capability and cost. For simpler tasks where cost efficiency matters more, GPT-4o-mini provides excellent performance at significantly lower token costs."
            },
            {
                question: "How do I test my agent before deploying?",
                answer: "Use the built-in chat interface to test your agent interactively. Send test messages, verify tool calls are working correctly, and review execution traces to understand the agent's reasoning before setting it live."
            }
        ],
        sections: [
            {
                heading: "What you will build",
                paragraphs: [
                    "In this tutorial, you will create an AI agent that monitors your business tools and delivers proactive intelligence. By the end, you will have a working agent connected to at least one integration, configured with clear instructions, and running on a schedule. The entire process takes about 5 minutes for the initial setup.",
                    "This is not a toy demo. The agent you build here is the same architecture used in production by companies processing thousands of agent runs per day. You are building on a platform designed for enterprise deployment, starting with the simplest possible configuration and expanding from there."
                ]
            },
            {
                heading: "Step 1: Create your workspace",
                paragraphs: [
                    "Sign up at agentc2.ai and create your first workspace. A workspace is an isolated environment for your agents, integrations, and data. Everything within a workspace is separated from other workspaces, ensuring data isolation and independent configuration.",
                    "Choose a workspace name that reflects its purpose: Marketing Agents, Sales Operations, or Engineering Automation. You can create multiple workspaces later for different teams or projects."
                ]
            },
            {
                heading: "Step 2: Connect your first integration",
                paragraphs: [
                    "Navigate to Integrations and connect one of the available tools. For your first agent, we recommend Slack because it provides both input and output capability. The OAuth connection flow handles credential management, token refresh, and encrypted storage automatically. No API keys to manage manually.",
                    "Other excellent first integrations include Gmail for email monitoring, HubSpot for CRM intelligence, or Jira for project management awareness. Each integration takes under 60 seconds to connect."
                ]
            },
            {
                heading: "Step 3: Create your agent",
                paragraphs: [
                    "Navigate to Agents and click Create Agent. Give your agent a descriptive name like Morning Briefing or Pipeline Monitor. Select GPT-4o as the model provider. Write clear instructions that define what the agent should do, what data sources to check, and how to format its output.",
                    "Good instructions are specific and structured. Instead of monitor my business, write each morning, check the Slack channels for overnight messages, summarize any urgent items, identify action items for me, and post a briefing to my direct messages. Specificity produces better results."
                ]
            },
            {
                heading: "Step 4: Assign tools and test",
                paragraphs: [
                    "Assign the tools your agent needs from the connected integrations. For a Slack-based agent, assign the Slack tools for reading messages and posting updates. Test the agent using the built-in chat interface. Send a test prompt and verify the agent correctly uses its tools and follows your instructions.",
                    "Review the execution trace for your test run. The trace shows every tool call, every piece of data read, and the complete reasoning chain. This transparency helps you debug and refine your agent's behavior before going live."
                ]
            },
            {
                heading: "Step 5: Deploy and schedule",
                paragraphs: [
                    "Set a schedule for your agent. For a morning briefing, configure a cron schedule to run at 6 AM on weekdays. For real-time monitoring, set an hourly or event-triggered schedule. Enable execution tracing and set a budget limit to control costs.",
                    "Your agent is now live. Tomorrow morning, your first automated briefing will arrive. From here, you can expand the agent's capabilities, add more integrations, create additional agents, and build multi-agent networks as your needs grow."
                ]
            }
        ]
    },
    {
        slug: "how-to-connect-ai-agents-existing-tools",
        title: "How to Connect AI Agents to Your Existing Tools (Without Writing Code)",
        description:
            "Walk through the OAuth connection flow for HubSpot, Gmail, Slack, Jira, and more. One-click integrations, no API keys required.",
        category: "tutorial",
        primaryKeyword: "connect ai agent",
        secondaryKeywords: ["ai agent integrations", "no-code ai agent"],
        publishedAt: "2026-02-19",
        updatedAt: "2026-02-19",
        author,
        readMinutes: 9,
        relatedDocs: ["integrations/overview", "integrations/hubspot", "integrations/slack"],
        relatedPosts: [
            "how-to-build-first-ai-agent-5-minutes",
            "model-context-protocol-mcp-guide",
            "ai-agent-tool-calling-patterns"
        ],
        faqItems: [
            {
                question: "Do I need API keys for each integration?",
                answer: "No. Most integrations use OAuth authorization flows that handle credential management automatically. You click Connect, authorize in the service's UI, and the platform manages tokens, refresh, and encryption. No manual API key management."
            },
            {
                question: "How many integrations can I connect?",
                answer: "There is no limit on the number of integrations per workspace. Connect as many tools as your agents need. Each integration is connected once and available to all agents in the workspace based on their configured tool permissions."
            },
            {
                question: "Are my credentials secure?",
                answer: "Credentials are encrypted at rest using AES-256-GCM encryption. OAuth tokens are automatically refreshed before expiration. Credentials are stored in the platform's encrypted credential store and never exposed in logs, traces, or API responses."
            }
        ],
        sections: [
            {
                heading: "The integration advantage",
                paragraphs: [
                    "The value of an AI agent is directly proportional to the tools it can access. An agent with no integrations is just a chatbot. An agent connected to your CRM, email, project management, and communication tools becomes an autonomous operator that reads data, takes action, and delivers results across your entire stack.",
                    "AgentC2 connects to 30+ business tools through the Model Context Protocol (MCP), an open standard developed by Anthropic. Each integration provides a set of tools that agents can use: reading contacts, sending messages, creating tickets, querying data, and modifying records."
                ]
            },
            {
                heading: "The OAuth connection flow",
                paragraphs: [
                    "Most integrations use OAuth, the same authorization standard that powers Sign in with Google and Connect to Slack buttons across the web. The flow is simple: click Connect in the AgentC2 integrations page, authorize access in the service's own interface, and you are done. The platform handles token storage, automatic refresh, and encrypted credential management.",
                    "This approach is significantly more secure than manually copying API keys. OAuth tokens are scoped to specific permissions, automatically rotated, and revocable at any time through the service's settings."
                ]
            },
            {
                heading: "Available integrations",
                paragraphs: [
                    "AgentC2 provides native integrations for the most common business tools. CRM: HubSpot for contacts, deals, companies, and pipeline management. Communication: Slack for messaging, Gmail for email, Microsoft Outlook for enterprise email and calendar. Project management: Jira for issues and sprints, GitHub for repositories and code. Knowledge: Google Drive for documents, Fathom for meeting transcripts, Firecrawl for web content. Voice: ElevenLabs for natural voice synthesis.",
                    "Each integration is listed with the specific tools it provides. HubSpot includes 15+ tools for searching, reading, creating, and updating CRM objects. Slack includes tools for listing channels, reading messages, posting updates, and managing threads."
                ]
            },
            {
                heading: "Connecting your first integration step by step",
                paragraphs: [
                    "Navigate to Settings then Integrations in your workspace. Browse the available providers or search for the tool you want to connect. Click the Connect button next to the integration. You will be redirected to the service's authorization page where you grant specific permissions. After authorization, you are redirected back to AgentC2 with the integration active.",
                    "Once connected, the integration's tools appear in the tool selection when creating or editing agents. Assign relevant tools to each agent based on its purpose. A CRM agent gets HubSpot tools. A communication agent gets Slack and Gmail tools. Each agent gets only the tools it needs."
                ]
            },
            {
                heading: "Managing and monitoring integrations",
                paragraphs: [
                    "Connected integrations are visible in the Integrations dashboard with their status, last-used timestamp, and token health. If an integration's credentials expire or are revoked, the platform alerts you and provides a re-authorization flow. Active integrations require no ongoing maintenance.",
                    "You can disconnect integrations at any time, which revokes the platform's access to that service. Agents that depend on disconnected integrations will fail gracefully with clear error messages indicating the missing integration."
                ]
            }
        ]
    },
    {
        slug: "how-to-build-multi-agent-network",
        title: "How to Build a Multi-Agent Network That Collaborates Like a Team",
        description:
            "Build a 3-agent sales network: researcher, outreach writer, and CRM updater. Learn routing, shared context, and network topology.",
        category: "tutorial",
        primaryKeyword: "multi-agent ai",
        secondaryKeywords: ["ai agent network", "multi-agent orchestration"],
        publishedAt: "2026-02-19",
        updatedAt: "2026-02-19",
        author,
        readMinutes: 13,
        relatedDocs: ["networks/overview", "networks/creating-networks", "networks/topology"],
        relatedPosts: [
            "multi-agent-networks-orchestrating-ai-teams",
            "what-is-ai-agent-orchestration",
            "how-to-build-first-ai-agent-5-minutes"
        ],
        faqItems: [
            {
                question: "How many agents can be in a network?",
                answer: "There is no hard limit. Networks typically contain 2-8 agents for practical use cases. Larger networks are possible but should be designed with clear routing logic to avoid unnecessary complexity."
            },
            {
                question: "How does routing work in a network?",
                answer: "A router agent analyzes each incoming message and determines which specialist agent should handle it based on message content, intent, and the capabilities of each agent in the network. Routing can be configured as sequential (pipeline), parallel (fan-out), or conditional (dynamic selection)."
            },
            {
                question: "Can agents in a network share context?",
                answer: "Yes. Agents in a network share execution context including the original input, intermediate results from other agents, and any shared memory configured at the network level. This shared context enables collaboration where each agent builds on the work of others."
            }
        ],
        sections: [
            {
                heading: "Why multi-agent networks outperform single agents",
                paragraphs: [
                    "A single agent trying to do everything suffers from instruction overload. Its instructions become long, contradictory, and difficult to optimize. A network of specialized agents, each focused on one task with clear instructions, produces better results because each agent can be independently tuned, evaluated, and improved.",
                    "According to research from Microsoft Research published in 2025, multi-agent systems outperform single-agent systems by 35-60 percent on complex tasks that require diverse skills. The benefit comes from specialization: each agent can use the optimal model, tools, and instructions for its specific role."
                ]
            },
            {
                heading: "Designing the network topology",
                paragraphs: [
                    "Start by identifying the distinct tasks in your workflow. For a sales outreach pipeline: research prospects (gather data), write outreach (craft messages), and update CRM (record activity). Each task becomes an agent. The network topology defines how messages flow between agents.",
                    "AgentC2 supports three topology patterns. Sequential pipelines pass output from one agent to the next in order. Parallel fan-out sends the same input to multiple agents simultaneously. Conditional routing uses a router agent to direct messages to the most appropriate specialist. Choose the topology that matches your workflow's natural structure."
                ]
            },
            {
                heading: "Building a sales outreach network",
                paragraphs: [
                    "Create three agents: Prospect Researcher with Firecrawl and web search tools, Outreach Writer with email drafting capabilities, and CRM Updater with HubSpot tools. Each agent has focused instructions for its specific role. The Researcher gathers company data, recent news, and decision-maker profiles. The Writer crafts personalized outreach based on research findings. The CRM Updater records all activity in HubSpot.",
                    "Create a network with these three agents and configure a sequential topology: input flows from Researcher to Writer to CRM Updater. Each agent receives the output of the previous agent as context. The result is a complete prospect research and outreach pipeline that runs with a single trigger."
                ]
            },
            {
                heading: "Configuring routing and context passing",
                paragraphs: [
                    "For conditional routing, add a Router agent that analyzes incoming messages and directs them to the appropriate specialist. The router's instructions define the routing logic: research requests go to the Researcher, writing requests go to the Writer, and CRM queries go to the Updater.",
                    "Context passing ensures each agent has access to relevant information from earlier stages. In a sequential pipeline, each agent receives the full conversation history including previous agents' outputs. Configure what context is shared to avoid information overload while ensuring each agent has what it needs."
                ]
            },
            {
                heading: "Testing and deploying the network",
                paragraphs: [
                    "Test the network by sending sample inputs and reviewing the end-to-end trace. The trace shows how the input was routed, what each agent produced, and how the final output was assembled. Verify that context passes correctly between agents and that the output meets your quality expectations.",
                    "Deploy the network with a trigger or schedule. For sales outreach, configure a daily schedule that processes a batch of prospects. For customer support, configure a webhook trigger that routes incoming tickets through the triage network. Monitor network performance through the platform's analytics dashboard."
                ]
            },
            {
                heading: "Advanced network patterns",
                paragraphs: [
                    "As your network matures, add advanced patterns. Feedback loops allow downstream agents to request additional information from upstream agents. Parallel branches process different aspects of a task simultaneously. Human-in-the-loop checkpoints pause the pipeline for approval at critical decision points.",
                    "The most sophisticated networks combine all three patterns: parallel research agents gather data simultaneously, a synthesis agent combines findings, a human reviews the recommendation, and an action agent executes the approved plan. These patterns mirror how effective human teams collaborate, with each member playing a specialized role."
                ]
            }
        ]
    },
    {
        slug: "how-to-add-ai-to-slack-10-minutes",
        title: "How to Add AI to Your Slack Workspace in 10 Minutes",
        description:
            "Deploy an AI agent in Slack that delivers morning briefings, answers questions, and automates workflows. Step-by-step setup guide.",
        category: "tutorial",
        primaryKeyword: "ai slack bot",
        secondaryKeywords: ["add ai to slack", "slack ai assistant"],
        publishedAt: "2026-02-19",
        updatedAt: "2026-02-19",
        author,
        readMinutes: 9,
        relatedDocs: ["integrations/slack", "channels/slack", "agents/creating-agents"],
        relatedPosts: [
            "build-ai-slack-bot-agent",
            "slack-ai-agent-operations-center",
            "how-to-build-first-ai-agent-5-minutes"
        ],
        faqItems: [
            {
                question: "Does this require Slack admin permissions?",
                answer: "You need permission to install Slack apps in your workspace. This is typically available to workspace admins. If your organization restricts app installation, request approval from your Slack admin."
            },
            {
                question: "Can the AI agent respond to @mentions?",
                answer: "Yes. When configured, the agent responds to @mentions in any channel it has been added to. It also handles direct messages for private interactions."
            },
            {
                question: "Is there a message limit?",
                answer: "There is no limit on the number of messages the agent can process. Costs are based on the LLM tokens consumed per interaction. Set a budget limit on the agent to control spending."
            }
        ],
        sections: [
            {
                heading: "Why Slack is the ideal AI agent interface",
                paragraphs: [
                    "Slack is where your team already communicates, collaborates, and coordinates work. Adding AI agents to Slack eliminates the context-switching that kills adoption of separate AI tools. Instead of learning a new interface, team members interact with agents in the same workspace where they message colleagues.",
                    "According to Slack's 2025 productivity data, teams that integrate AI into Slack see 3.2x higher adoption rates than those that deploy AI in standalone interfaces. The lesson is clear: reduce friction to zero by meeting users where they already are."
                ]
            },
            {
                heading: "Step 1: Create the Slack App",
                paragraphs: [
                    "Go to api.slack.com/apps and create a new app from scratch. Name it something descriptive like AgentC2 Assistant. Add the required bot permissions: chat:write, app_mentions:read, im:history, im:read, im:write, and channels:history. Install the app to your workspace and copy the Bot User OAuth Token.",
                    "These permissions allow the agent to read messages when mentioned, send responses, and maintain conversation context in threads. The permissions are scoped: the agent can only see messages in channels where it is explicitly added."
                ]
            },
            {
                heading: "Step 2: Connect Slack to AgentC2",
                paragraphs: [
                    "In your AgentC2 workspace, navigate to Integrations and connect Slack using the OAuth token from Step 1. Configure the event subscription URL to receive Slack events. The platform provides the webhook URL that Slack sends events to.",
                    "Once connected, Slack tools become available to your agents: listing channels, reading messages, posting messages, and managing threads."
                ]
            },
            {
                heading: "Step 3: Configure your agent for Slack",
                paragraphs: [
                    "Create an agent or modify an existing one to work with Slack. Assign Slack tools and update the instructions to include Slack-specific behavior: how to format messages, which channels to post to, and how to handle @mentions versus direct messages.",
                    "For a Daily Briefing agent, add instructions like post a morning summary to the #briefings channel at 6 AM on weekdays. Include revenue metrics, pipeline changes, and today's priority items. For a conversational agent, add when mentioned in a channel, respond helpfully in a thread."
                ]
            },
            {
                heading: "Step 4: Test and deploy",
                paragraphs: [
                    "Test by @mentioning your agent in a Slack channel. Verify it responds in a thread with accurate, well-formatted content. Test different types of queries to ensure the agent handles your use cases correctly.",
                    "Once validated, the agent is live. Team members can @mention it for on-demand questions, and scheduled tasks deliver proactive intelligence without any user interaction. The entire setup from Slack App creation to live agent takes approximately 10 minutes."
                ]
            }
        ]
    },
    {
        slug: "how-to-build-ai-email-agent",
        title: "How to Build an AI Agent That Emails on Your Behalf",
        description:
            "Build an AI email agent with human-approval flow. Drafts contextual follow-ups after meetings and sends only with your confirmation.",
        category: "tutorial",
        primaryKeyword: "ai email agent",
        secondaryKeywords: ["ai that sends emails", "email automation ai"],
        publishedAt: "2026-02-19",
        updatedAt: "2026-02-19",
        author,
        readMinutes: 10,
        relatedDocs: [
            "integrations/gmail",
            "workflows/human-in-the-loop",
            "agents/creating-agents"
        ],
        relatedPosts: [
            "ai-agent-gmail-email-automation",
            "gmail-ai-agent-inbox-zero",
            "human-in-the-loop-ai-approval-workflows"
        ],
        faqItems: [
            {
                question: "Will the AI send emails without my approval?",
                answer: "Not by default. The agent drafts emails and queues them for your review. You can optionally enable auto-send for specific categories like meeting confirmations, but substantive communications always require human approval unless you explicitly configure otherwise."
            },
            {
                question: "Can the agent match my writing style?",
                answer: "Yes. Include examples of your writing style in the agent's instructions. The agent learns your tone, vocabulary, and formatting preferences. Over time, the continuous learning system further refines style matching based on your edits to drafted emails."
            },
            {
                question: "What email providers are supported?",
                answer: "Gmail through Google OAuth and Microsoft Outlook through Microsoft Graph API. Both integrations handle credential management, token refresh, and encrypted storage automatically."
            }
        ],
        sections: [
            {
                heading: "The follow-up problem",
                paragraphs: [
                    "The gap between a great meeting and a closed deal often comes down to follow-up speed and quality. According to InsideSales research, leads contacted within 5 minutes of expressing interest are 100x more likely to convert than those contacted after 30 minutes. Yet the average follow-up email takes 2-4 hours to send because reps are pulled into other tasks immediately after meetings.",
                    "An AI email agent closes this gap by drafting contextual follow-ups within minutes of the meeting ending. The draft incorporates meeting context, CRM history, and agreed next steps. You review, edit if needed, and send."
                ]
            },
            {
                heading: "Step 1: Configure the email agent",
                paragraphs: [
                    "Create an agent with Gmail or Outlook integration. The instructions should specify: after each meeting, draft a follow-up email to attendees that summarizes key discussion points, references specific commitments made, and proposes the agreed next step. Match my professional but warm communication style.",
                    "Assign email tools (send, draft, read), Fathom tools (meeting transcripts), and optionally CRM tools (HubSpot for deal context). This tool combination gives the agent the context it needs to draft relevant, personalized emails."
                ]
            },
            {
                heading: "Step 2: Set up the human-approval workflow",
                paragraphs: [
                    "Configure a workflow with a human-in-the-loop approval step. The agent drafts the email and creates a review request. You receive a Slack notification with the draft and can approve, edit, or reject. Only approved drafts are sent.",
                    "This approval flow is essential for email communication where tone, timing, and content directly affect relationships. The agent handles 90 percent of the work; you provide the 10 percent of judgment that ensures quality."
                ]
            },
            {
                heading: "Step 3: Train with your style",
                paragraphs: [
                    "Include 5-10 example emails in your agent's instructions or knowledge base. These examples teach the agent your preferred greeting, closing, paragraph structure, and level of formality. The more specific your examples, the more accurately the agent matches your voice.",
                    "Over time, use the continuous learning system to refine style matching. When you edit a draft before sending, the agent records the difference between its draft and your final version, using this feedback to improve future drafts."
                ]
            },
            {
                heading: "Step 4: Deploy and iterate",
                paragraphs: [
                    "Start with post-meeting follow-ups as the first use case. After each meeting, the agent drafts a follow-up email within 5 minutes. Review the draft quality over the first week and adjust instructions based on the edits you make most frequently.",
                    "Expand to additional email types: project status updates, meeting scheduling requests, and information requests. Each email type may benefit from different instructions or templates. Configure the agent to detect the email type and adapt its approach accordingly."
                ]
            },
            {
                heading: "Measuring email agent impact",
                paragraphs: [
                    "Track three metrics: time from meeting end to follow-up sent (target: under 15 minutes), draft acceptance rate (target: 80+ percent without edits), and response rates on agent-drafted versus manually written emails. Most users find that agent-drafted emails match or exceed their manual quality while being sent 10x faster.",
                    "The compound effect is significant. Faster follow-ups improve response rates. Higher response rates accelerate deal velocity. Better CRM documentation improves pipeline accuracy. The email agent creates a positive feedback loop across the entire customer engagement process."
                ]
            }
        ]
    },
    {
        slug: "how-to-build-rag-knowledge-base-tutorial",
        title: "How to Give Your AI Agent a Knowledge Base (RAG Tutorial)",
        description:
            "Step-by-step RAG tutorial: upload documents, chunk, embed, and query. Build an AI agent that answers questions from your company docs.",
        category: "tutorial",
        primaryKeyword: "rag tutorial",
        secondaryKeywords: ["ai knowledge base", "retrieval augmented generation"],
        publishedAt: "2026-02-19",
        updatedAt: "2026-02-19",
        author,
        readMinutes: 12,
        relatedDocs: ["knowledge/document-ingestion", "knowledge/vector-search", "agents/overview"],
        relatedPosts: [
            "rag-retrieval-augmented-generation-ai-agents",
            "vector-search-vs-keyword-search-ai-agents",
            "google-drive-ai-agent-semantic-search"
        ],
        faqItems: [
            {
                question: "What is RAG?",
                answer: "RAG stands for Retrieval Augmented Generation. It is a technique where an AI agent retrieves relevant information from a knowledge base before generating a response. This grounds the agent's answers in your actual documents rather than relying solely on the model's training data."
            },
            {
                question: "What documents can I ingest?",
                answer: "AgentC2's RAG pipeline supports text documents, PDFs, Google Docs, Notion pages, Markdown files, and web pages. Documents are automatically converted to text, chunked into semantically meaningful segments, and embedded for vector search."
            },
            {
                question: "How accurate are RAG-powered answers?",
                answer: "Accuracy depends on knowledge base quality and query specificity. With a comprehensive, well-organized knowledge base, RAG-powered agents achieve 85-95 percent accuracy on factual questions. The agent cites source documents, allowing users to verify answers."
            },
            {
                question: "How much does vector storage cost?",
                answer: "Vector storage for a typical company knowledge base (1,000-5,000 documents) is included in the platform subscription. Storage scales automatically as you ingest more documents. There is no separate vector database to manage or pay for."
            }
        ],
        sections: [
            {
                heading: "Why your agent needs a knowledge base",
                paragraphs: [
                    "Without a knowledge base, your AI agent can only answer questions from its training data, which may be outdated, inaccurate for your specific context, or completely lacking your proprietary information. RAG bridges this gap by giving the agent access to your actual documents, policies, procedures, and institutional knowledge.",
                    "The difference is dramatic. Ask an agent without RAG about your vacation policy and it will hallucinate a generic answer. Ask an agent with RAG the same question and it quotes your actual policy document with the specific section that applies. Grounding answers in real documents eliminates hallucination for factual queries."
                ]
            },
            {
                heading: "Step 1: Prepare your documents",
                paragraphs: [
                    "Identify the documents that contain the knowledge your agent needs to access. Common sources include company policies, product documentation, process guides, FAQ collections, training materials, and architectural decision records. Organize documents by topic or category for easier management.",
                    "Quality matters more than quantity. A well-organized knowledge base with 200 clear, accurate documents outperforms a chaotic collection of 2,000 unstructured files. Remove outdated documents, consolidate duplicates, and ensure content accuracy before ingestion."
                ]
            },
            {
                heading: "Step 2: Ingest documents into the RAG pipeline",
                paragraphs: [
                    "Use the RAG ingestion tool to upload documents. Each document is processed through the pipeline: text extraction converts the document to plain text, chunking splits the text into semantically meaningful segments (typically 500-1,000 tokens each), embedding generates vector representations using a high-quality embedding model, and indexing stores the vectors in the searchable database.",
                    "For large document collections, batch ingestion processes multiple documents in parallel. Google Drive and Notion integrations can automatically ingest entire folders or workspaces, keeping the knowledge base synchronized with your document sources."
                ]
            },
            {
                heading: "Step 3: Configure your agent with knowledge base access",
                paragraphs: [
                    "Create or modify an agent and enable knowledge base access in its configuration. The agent's instructions should include guidance on when and how to use the knowledge base: always search the knowledge base before answering factual questions, cite the source document in your response, and indicate when the knowledge base does not contain relevant information.",
                    "The agent uses semantic search to find relevant document chunks. Unlike keyword search, semantic search understands meaning: a question about remote work flexibility matches a document titled Hybrid Work Policy even though the exact words do not appear in the query."
                ]
            },
            {
                heading: "Step 4: Test and refine",
                paragraphs: [
                    "Test the agent with a variety of questions that your knowledge base should be able to answer. Verify that answers are accurate, properly cited, and drawn from the correct documents. Test edge cases where the knowledge base does not have the answer, ensuring the agent acknowledges gaps rather than hallucinating.",
                    "Review retrieval quality in the execution traces. The trace shows which document chunks were retrieved for each query and how the agent used them to construct its answer. If the wrong chunks are being retrieved, refine document organization or adjust chunking parameters."
                ]
            },
            {
                heading: "Step 5: Deploy and maintain",
                paragraphs: [
                    "Deploy the agent via Slack, the platform interface, or API. Team members can query the knowledge base in natural language and receive accurate, cited answers instantly. Monitor usage patterns to identify the most common queries and ensure the knowledge base covers them well.",
                    "Schedule periodic re-ingestion to keep the knowledge base current as documents are updated. Flag queries that return no results, as these reveal knowledge gaps that should be addressed with new documentation. The knowledge base improves continuously through use."
                ]
            }
        ]
    },
    {
        slug: "how-to-schedule-ai-agents-cron-triggers",
        title: "How to Schedule AI Agents to Run Automatically (Cron, Triggers, and Webhooks)",
        description:
            "Configure time-based, event-based, and condition-based automation for AI agents. Cron schedules, webhooks, and smart triggers explained.",
        category: "tutorial",
        primaryKeyword: "schedule ai agent",
        secondaryKeywords: ["ai agent automation", "cron ai agent"],
        publishedAt: "2026-02-19",
        updatedAt: "2026-02-19",
        author,
        readMinutes: 10,
        relatedDocs: ["platform/triggers-and-schedules", "agents/overview", "agents/configuration"],
        relatedPosts: [
            "proactive-ai-agent-heartbeat-pattern",
            "build-proactive-ai-agent-notifications",
            "deploying-ai-agents-to-production-checklist"
        ],
        faqItems: [
            {
                question: "What is a cron schedule?",
                answer: "A cron schedule uses a standard expression to define when an agent runs. For example, 0 6 * * 1-5 means run at 6 AM every weekday. Cron schedules are timezone-aware and support any frequency from every minute to once per year."
            },
            {
                question: "What is the difference between a trigger and a schedule?",
                answer: "Schedules are time-based: the agent runs at defined times regardless of external events. Triggers are event-based: the agent runs in response to something happening, like a new error in Sentry, an email arriving, or a deal changing stage in the CRM."
            },
            {
                question: "Can I combine schedules and triggers?",
                answer: "Yes. An agent can have both a cron schedule for periodic checks and event triggers for real-time responses. For example, a daily summary schedule at 6 AM plus a webhook trigger for critical alerts creates a hybrid pattern."
            }
        ],
        sections: [
            {
                heading: "Three automation patterns",
                paragraphs: [
                    "AI agents become truly autonomous when they run without human initiation. AgentC2 supports three automation patterns: time-based schedules that run agents at specific intervals, event-based triggers that run agents in response to external events, and condition-based triggers that evaluate criteria before deciding whether to run.",
                    "Each pattern serves different use cases. Schedules work for periodic tasks like daily briefings and weekly reports. Event triggers work for real-time responses like error handling and lead processing. Condition triggers work for smart monitoring where the agent should only act when specific criteria are met."
                ]
            },
            {
                heading: "Time-based scheduling with cron",
                paragraphs: [
                    "Cron expressions define precise schedules. Common patterns: 0 6 * * 1-5 (6 AM weekdays), 0 * * * * (every hour), 0 9 * * 1 (9 AM every Monday), and 0 6 1 * * (6 AM first day of each month). All schedules are timezone-aware, so a schedule set for 6 AM Eastern runs at 6 AM Eastern regardless of server location.",
                    "To create a schedule, navigate to the agent's configuration, click Add Schedule, enter a name, define the cron expression, set the timezone, and specify the input prompt the agent receives on each scheduled run. The schedule activates immediately and runs at the defined times."
                ]
            },
            {
                heading: "Event-based triggers with webhooks",
                paragraphs: [
                    "Event triggers fire the agent when something happens in an external system. A new error in Sentry, a deal stage change in HubSpot, a new message in a Slack channel, or a payment event in Stripe can all trigger agent execution. The event data is passed to the agent as context.",
                    "Configure event triggers by creating a webhook URL in the agent's trigger settings. Point your external system's webhook to this URL. When the external system sends an event, the agent processes it automatically. Each trigger event is logged and traceable."
                ]
            },
            {
                heading: "Condition-based smart triggers",
                paragraphs: [
                    "Condition triggers add intelligence to event processing. Instead of firing on every event, the trigger evaluates the event against defined conditions and only fires the agent when the conditions are met. For example: fire on new Sentry errors only if severity is critical and affected users exceed 100.",
                    "Condition triggers reduce noise and cost by filtering out events that do not require agent action. The evaluation is fast and deterministic, consuming no LLM tokens for events that do not meet the criteria."
                ]
            },
            {
                heading: "Best practices for agent scheduling",
                paragraphs: [
                    "Match the frequency to the use case. Daily briefings run once per morning. Real-time error handling triggers on every critical error. Weekly reports run Friday afternoons. Over-scheduling wastes tokens; under-scheduling misses signals.",
                    "Set budget limits on scheduled agents to prevent runaway costs. A bug in an hourly agent that suddenly generates expensive LLM calls can accumulate significant costs overnight. Budget limits create a safety net that caps spending regardless of execution frequency."
                ]
            }
        ]
    },
    {
        slug: "how-to-build-crm-update-agent-meetings",
        title: "How to Build an AI Agent That Updates Your CRM After Every Meeting",
        description:
            "Tutorial: meeting ends, transcript is processed, contacts extracted, HubSpot updated, follow-up drafted. All in under 5 minutes.",
        category: "tutorial",
        primaryKeyword: "ai crm update",
        secondaryKeywords: ["automatic crm update", "crm automation ai"],
        publishedAt: "2026-02-19",
        updatedAt: "2026-02-19",
        author,
        readMinutes: 11,
        relatedDocs: ["integrations/hubspot", "integrations/fathom", "agents/creating-agents"],
        relatedPosts: [
            "ai-agents-for-sales-crm-pipeline",
            "connect-ai-agent-to-hubspot-crm",
            "fathom-ai-agent-meeting-actions"
        ],
        faqItems: [
            {
                question: "What meeting tools work with this?",
                answer: "Fathom provides the best integration with speaker identification and structured transcripts. The pattern also works with Otter.ai, Fireflies.ai, or any tool that provides API access to meeting transcripts."
            },
            {
                question: "Which CRM fields does the agent update?",
                answer: "The agent updates deal notes, contact activity, deal stage, next activity date, and any custom fields you configure. It can also create new contacts discovered during meetings and associate them with existing deals."
            },
            {
                question: "How does the agent know which deal to update?",
                answer: "The agent matches meeting attendees against HubSpot contacts. When a match is found, it identifies associated deals and updates the most relevant one. For new contacts or unassociated meetings, the agent creates new records or flags for manual association."
            }
        ],
        sections: [
            {
                heading: "The post-meeting CRM gap",
                paragraphs: [
                    "The data that matters most for pipeline accuracy, the nuanced context from sales conversations, is also the data least likely to make it into the CRM. According to Gartner's 2025 Sales Productivity report, only 18 percent of relevant meeting information is captured in CRM records. The other 82 percent exists only in the rep's memory, where it degrades rapidly.",
                    "This tutorial shows you how to build an agent that captures 95+ percent of meeting information in CRM records automatically, within minutes of the meeting ending."
                ]
            },
            {
                heading: "Architecture of the CRM update pipeline",
                paragraphs: [
                    "The pipeline connects three systems: Fathom for meeting transcripts, HubSpot for CRM records, and Slack for notifications. When a meeting ends, Fathom generates the transcript. The agent processes the transcript to extract structured data. The extracted data is written to HubSpot. A summary is posted to Slack.",
                    "The agent performs four extraction tasks: identify attendees and match to CRM contacts, extract key discussion topics and decisions, identify commitments and next steps with owners, and detect deal signals like budget mentions, timeline changes, or competitive references."
                ]
            },
            {
                heading: "Building the agent step by step",
                paragraphs: [
                    "Create a new agent with Fathom, HubSpot, and Slack tools assigned. Write instructions that specify the extraction format: for each meeting, extract attendee names and roles, topics discussed with key points, commitments made with responsible parties and deadlines, deal signals including budget, timeline, competition, and urgency indicators, and a recommended next step.",
                    "Configure a trigger that fires after each meeting, or set a schedule to process recent meetings at regular intervals. The trigger approach provides faster CRM updates; the schedule approach batches processing for efficiency."
                ]
            },
            {
                heading: "Handling edge cases",
                paragraphs: [
                    "Not every meeting is a sales call. Configure the agent to distinguish between internal meetings, customer meetings, and other meeting types. For non-sales meetings, the agent can extract action items without CRM updates. For sales meetings, it performs the full extraction and CRM update pipeline.",
                    "Handle new contacts gracefully. When the agent encounters attendees not in HubSpot, it can create new contact records with the information gathered from the meeting. Flag these for sales rep verification to ensure data accuracy."
                ]
            },
            {
                heading: "Validation and continuous improvement",
                paragraphs: [
                    "Run the agent for two weeks and compare its CRM updates against what sales reps would have entered manually. Measure completeness (how many fields updated), accuracy (do the extracted details match the actual conversation), and timeliness (how quickly after the meeting are records updated).",
                    "Use the continuous learning system to improve extraction quality. When a rep corrects an agent-generated CRM update, the correction feeds back into the learning system, refining the agent's extraction patterns for future meetings."
                ]
            }
        ]
    },
    {
        slug: "how-to-set-budget-limits-ai-agents",
        title: "How to Set Budget Limits on AI Agents (So You Don't Get a Surprise Bill)",
        description:
            "Configure AgentC2's 4-level budget hierarchy: subscription, org, user, and agent limits. Set caps, alerts, and hard stops.",
        category: "tutorial",
        primaryKeyword: "ai agent cost control",
        secondaryKeywords: ["ai budget management", "limit ai spending"],
        publishedAt: "2026-02-19",
        updatedAt: "2026-02-19",
        author,
        readMinutes: 9,
        relatedDocs: ["agents/budgets-and-costs", "agents/configuration", "platform/observability"],
        relatedPosts: [
            "ai-agent-cost-management-llm-spend-control",
            "stop-ai-agent-high-api-costs",
            "openclaw-cost-total-ownership"
        ],
        faqItems: [
            {
                question: "What happens when an agent hits its budget limit?",
                answer: "Depends on configuration. With a soft limit, the agent continues but triggers an alert. With a hard limit, the agent's execution is stopped mid-run if the budget is exhausted, preventing any further token consumption. Hard limits guarantee spending caps."
            },
            {
                question: "Can I set different budgets for different agents?",
                answer: "Yes. Each agent has its own budget configuration independent of other agents. A high-priority sales agent might have a $100/month budget while a low-priority monitoring agent has a $10/month budget."
            },
            {
                question: "How is cost tracked?",
                answer: "Cost is calculated per run based on the model used, tokens consumed (input and output), and tool calls made. The platform tracks cumulative spending at the agent, user, and organization levels with real-time visibility in the dashboard."
            }
        ],
        sections: [
            {
                heading: "Why budget controls matter",
                paragraphs: [
                    "AI agents consume LLM tokens with every execution. Without budget controls, a misbehaving agent, a prompt injection attack, or an unexpectedly complex task can consume hundreds of dollars in minutes. According to a16z's 2025 AI Infrastructure report, 34 percent of organizations that deployed AI agents experienced at least one budget overrun in the first year.",
                    "AgentC2's four-level budget hierarchy prevents surprise bills by enforcing spending limits at every level of the organization. From the subscription cap down to individual agent limits, each level provides independent protection."
                ]
            },
            {
                heading: "Level 1: Subscription limits",
                paragraphs: [
                    "The subscription level sets the maximum monthly spend for your entire AgentC2 account. This is the outer boundary that cannot be exceeded regardless of how many agents are running. The subscription limit is set based on your plan and can be adjusted through the billing settings.",
                    "When the subscription limit is reached, all agent execution stops until the billing period resets. This protects against scenarios where multiple agents simultaneously hit their individual limits at the same time."
                ]
            },
            {
                heading: "Level 2: Organization and user limits",
                paragraphs: [
                    "Within the subscription limit, you can set per-organization and per-user spending caps. If your account serves multiple organizations, each organization has its own budget. Within each organization, individual users have spending limits that prevent any single user's agents from consuming the entire organization's budget.",
                    "User limits are particularly useful for teams where multiple people create and manage agents. A new team member experimenting with agent configurations cannot accidentally exhaust the team's monthly budget."
                ]
            },
            {
                heading: "Level 3: Per-agent budgets",
                paragraphs: [
                    "Each agent has its own budget configuration with three parameters: monthly limit (maximum spend per month), alert threshold (percentage at which you receive a warning), and hard limit toggle (whether to stop execution or just alert when the limit is reached).",
                    "Configure budgets based on the agent's expected usage pattern. A Daily Briefing that runs once per day and consumes minimal tokens might have a $10/month budget. A Bug Bouncer that processes hundreds of errors might need $50/month. A research agent handling complex queries might need $100/month."
                ]
            },
            {
                heading: "Monitoring and alerting",
                paragraphs: [
                    "The platform provides real-time budget monitoring at every level. Dashboards show current spending versus limits for each agent, user, and organization. Alert thresholds trigger Slack notifications when spending approaches configured levels, giving you time to investigate before limits are reached.",
                    "Per-run cost tracking shows exactly how much each execution consumed, broken down by model, tokens, and tool calls. This granular visibility helps you optimize agent configurations for cost efficiency without sacrificing quality."
                ]
            }
        ]
    },
    {
        slug: "how-to-build-voice-ai-phone-agent",
        title: "How to Build a Voice AI Agent That Answers Phone Calls",
        description:
            "Tutorial: ElevenLabs + AgentC2 voice receptionist. Natural conversation, appointment scheduling, CRM capture, and team notification.",
        category: "tutorial",
        primaryKeyword: "build voice ai agent",
        secondaryKeywords: ["ai phone agent", "voice ai tutorial"],
        publishedAt: "2026-02-19",
        updatedAt: "2026-02-19",
        author,
        readMinutes: 11,
        relatedDocs: ["integrations/elevenlabs", "agents/creating-agents", "agents/tools"],
        relatedPosts: [
            "elevenlabs-ai-voice-receptionist",
            "ai-agents-real-estate-voice-receptionist",
            "how-to-build-first-ai-agent-5-minutes"
        ],
        faqItems: [
            {
                question: "What phone numbers can the voice agent use?",
                answer: "The voice agent works with any telephony provider that supports SIP or WebRTC. You can use your existing business phone number and route calls to the agent during after-hours, overflow, or as the primary receptionist."
            },
            {
                question: "Can the agent transfer calls to humans?",
                answer: "Yes. The agent can transfer calls based on caller intent, issue complexity, or explicit request. The transfer includes a summary of the conversation so the human recipient has full context."
            },
            {
                question: "What languages are supported?",
                answer: "ElevenLabs supports 29 languages with natural voice quality. The agent can be configured for multilingual support, detecting the caller's language and responding accordingly."
            }
        ],
        sections: [
            {
                heading: "Voice AI is production-ready",
                paragraphs: [
                    "Voice AI has crossed the quality threshold where callers frequently cannot distinguish AI from human receptionists. ElevenLabs' latest voice models include natural breathing, emotional inflection, conversational pacing, and contextual emphasis. Combined with AgentC2's reasoning and tool-calling capabilities, the result is a voice receptionist that sounds human, understands context, and takes meaningful action.",
                    "According to Grand View Research, the AI voice agent market is growing at 23 percent CAGR and is projected to reach $47 billion by 2028. Businesses across healthcare, real estate, legal, and professional services are deploying voice agents for appointment scheduling, lead capture, and customer service."
                ]
            },
            {
                heading: "Architecture overview",
                paragraphs: [
                    "The voice agent combines three layers. The telephony layer handles phone calls through SIP or WebRTC integration. The voice layer uses ElevenLabs for speech-to-text and text-to-speech conversion with natural voice quality. The reasoning layer uses AgentC2's agent framework for understanding intent, accessing tools, and generating appropriate responses.",
                    "When a call comes in, speech is transcribed in real time, processed by the agent for intent and response, and converted back to natural speech for delivery. The round-trip latency is under 500 milliseconds, creating a natural conversational experience."
                ]
            },
            {
                heading: "Step 1: Configure ElevenLabs",
                paragraphs: [
                    "Set up your ElevenLabs account and configure your preferred voice. ElevenLabs offers pre-built voices and custom voice cloning. Choose a voice that matches your brand personality: professional and warm for a law firm, friendly and energetic for a real estate agency, calm and reassuring for a medical practice.",
                    "Connect ElevenLabs to your AgentC2 workspace through the integrations page. The platform handles API credential management and voice model selection."
                ]
            },
            {
                heading: "Step 2: Build the voice agent",
                paragraphs: [
                    "Create a new agent with voice capabilities enabled. Write instructions that define the agent's personality, knowledge scope, and capabilities. Include scripts for common conversation flows: greeting, intent identification, information provision, appointment scheduling, and call transfer.",
                    "Assign tools for the actions the agent should take: CRM tools for lead capture, calendar tools for scheduling, and notification tools for team alerts. Each tool call happens transparently during the conversation."
                ]
            },
            {
                heading: "Step 3: Test and deploy",
                paragraphs: [
                    "Test with internal calls first. Have team members call the agent with different scenarios: appointment requests, general questions, complex inquiries, and transfer requests. Review conversation transcripts and agent behavior for quality.",
                    "Deploy incrementally. Start with after-hours calls only. Monitor conversation quality and caller satisfaction. Expand to overflow handling during peak hours. Finally, deploy as the primary receptionist with human transfer capability for complex situations."
                ]
            },
            {
                heading: "Monitoring voice agent performance",
                paragraphs: [
                    "Track call completion rate (calls handled without transfer), caller satisfaction (post-call surveys), lead capture accuracy, appointment scheduling success rate, and average call duration. These metrics inform ongoing optimization.",
                    "Review conversation transcripts regularly for quality. Identify patterns where the agent struggles and refine instructions accordingly. The continuous learning system improves performance over time based on successful and unsuccessful call patterns."
                ]
            }
        ]
    },
    {
        slug: "how-to-evaluate-ai-agent-performance",
        title: "How to Evaluate AI Agent Performance (Scorers, Evals, and Metrics)",
        description:
            "Measure whether your AI agent is actually helping. Configure scorers, run A/B experiments, and implement continuous learning loops.",
        category: "tutorial",
        primaryKeyword: "evaluate ai agent",
        secondaryKeywords: ["ai agent metrics", "ai agent testing"],
        publishedAt: "2026-02-19",
        updatedAt: "2026-02-19",
        author,
        readMinutes: 11,
        relatedDocs: ["agents/evaluations", "agents/learning", "agents/simulations"],
        relatedPosts: [
            "ai-agent-evaluation-how-to-measure-performance",
            "ab-test-ai-agent-configuration",
            "self-improving-ai-agents-with-learning"
        ],
        faqItems: [
            {
                question: "What is an AI agent scorer?",
                answer: "A scorer is a function that evaluates the quality of an agent's output against specific criteria. Scorers can measure relevance, accuracy, helpfulness, tone, and completeness. Multiple scorers can be applied to each agent run to build a comprehensive quality picture."
            },
            {
                question: "How do A/B experiments work for agents?",
                answer: "Two versions of an agent with different configurations process the same inputs. Their outputs are compared using scorers to determine which configuration performs better. The winning configuration is promoted and the experiment concludes."
            },
            {
                question: "What is continuous learning?",
                answer: "Continuous learning is an automated system that extracts quality signals from production runs, generates improvement proposals, validates them through controlled experiments, and promotes winners with human approval. It creates a flywheel where agents improve over time."
            }
        ],
        sections: [
            {
                heading: "Why evaluation matters",
                paragraphs: [
                    "Deploying an AI agent without evaluation is like launching a product without analytics. You have no way to know whether the agent is helping, hurting, or making no difference. According to MIT's 2025 AI deployment study, 40 percent of deployed AI systems underperform expectations because organizations lack evaluation frameworks to detect and correct quality issues.",
                    "Evaluation transforms agent management from guesswork into data-driven optimization. With systematic scoring, you know which agents perform well, which need improvement, and whether changes make things better or worse."
                ]
            },
            {
                heading: "Setting up scorers",
                paragraphs: [
                    "AgentC2 provides pre-built scorers that evaluate common quality dimensions: relevance (does the response address the input), completeness (does the response cover all aspects), accuracy (are facts and references correct), and helpfulness (does the response provide actionable value).",
                    "Configure scorers on your agent by selecting the relevant pre-built options or defining custom scoring criteria. Each agent run is automatically scored, creating a quality dataset that tracks performance over time."
                ]
            },
            {
                heading: "Running A/B experiments",
                paragraphs: [
                    "When you want to test a change, such as new instructions, a different model, or additional tools, create an A/B experiment. The experiment creates two agent versions that process the same inputs. Scorers evaluate both versions, and the platform generates a comparison report showing which version performs better on each quality dimension.",
                    "Run experiments for at least 50-100 interactions to achieve statistical significance. The platform handles traffic splitting, score collection, and statistical analysis. You review the results and promote the winning configuration."
                ]
            },
            {
                heading: "Implementing continuous learning",
                paragraphs: [
                    "Enable continuous learning on your agent to create an automated improvement loop. The system monitors production runs, identifies quality patterns, generates improvement proposals (instruction refinements, tool adjustments, model changes), and tests proposals through automated experiments.",
                    "Crucially, all proposed changes require human approval before being promoted. This ensures that the agent improves within organizational guardrails rather than evolving in unexpected directions. The learning system suggests; humans decide."
                ]
            },
            {
                heading: "Key metrics to track",
                paragraphs: [
                    "Beyond scorer-based quality metrics, track operational metrics: average response time, tool call success rate, budget consumption per run, and user feedback scores. These operational metrics complement quality scores to provide a complete picture of agent performance.",
                    "Create a monthly agent performance review cadence. Review quality trends, identify degrading metrics, investigate root causes, and implement improvements. This systematic approach to agent management ensures quality stays high as your deployment scales."
                ]
            }
        ]
    },
    {
        slug: "how-to-build-ai-content-writing-agent",
        title: "How to Build an AI Agent That Writes and Publishes Content",
        description:
            "Content Engine tutorial: research, draft, human review, and publish pipeline. Quality controls and human-in-the-loop for content production.",
        category: "tutorial",
        primaryKeyword: "ai content agent",
        secondaryKeywords: ["ai blog writer", "automated content creation"],
        publishedAt: "2026-02-19",
        updatedAt: "2026-02-19",
        author,
        readMinutes: 11,
        relatedDocs: [
            "workflows/overview",
            "workflows/human-in-the-loop",
            "integrations/firecrawl"
        ],
        relatedPosts: [
            "ai-agents-marketing-content-automation",
            "how-to-build-multi-agent-network",
            "build-ai-research-assistant-citations"
        ],
        faqItems: [
            {
                question: "Does Google penalize AI-generated content?",
                answer: "Google evaluates content based on quality, relevance, and helpfulness regardless of production method. Their 2025 guidelines explicitly state that AI-assisted content is acceptable when it provides genuine value. The key is human review and original insights, not whether AI assisted in production."
            },
            {
                question: "How do you ensure content quality?",
                answer: "The pipeline includes a mandatory human review step. An editor reviews every piece for accuracy, brand voice, original insights, and editorial quality before publication. The AI handles research and drafting; humans ensure quality."
            },
            {
                question: "Can the agent handle different content formats?",
                answer: "Yes. The agent can produce blog posts, whitepapers, case studies, email newsletters, social media posts, and product documentation. Each format has different instructions and quality criteria configured in the agent's settings."
            }
        ],
        sections: [
            {
                heading: "The content production bottleneck",
                paragraphs: [
                    "Content marketing requires consistent, high-quality output. According to the Content Marketing Institute, organizations that publish 4+ pieces per week generate 3.5x more traffic than those publishing weekly. But most content teams cannot sustain that volume alongside their other responsibilities.",
                    "The Content Engine solves this by automating research, drafting, and SEO optimization while keeping human editors in the quality loop. The result is 4-8x content output with the same team, without sacrificing the quality that drives organic traffic."
                ]
            },
            {
                heading: "Building the content pipeline",
                paragraphs: [
                    "Create three agents in a network: the Research Agent uses Firecrawl to gather source material, analyze competitor content, and identify supporting data. The Drafting Agent synthesizes research into structured articles following your brand guidelines and SEO requirements. The Review Agent checks drafts for accuracy, brand voice consistency, and SEO optimization.",
                    "Connect the agents in a sequential workflow: Research produces a brief, Drafting produces a draft from the brief, and Review produces a quality assessment. The draft and assessment are presented to the human editor for final review."
                ]
            },
            {
                heading: "Configuring SEO optimization",
                paragraphs: [
                    "Include SEO requirements in the Drafting Agent's instructions: target primary and secondary keywords, structure content with proper heading hierarchy, include internal links to related content, write meta descriptions within character limits, and add FAQ sections for featured snippet targeting.",
                    "The agent uses keyword data from your content strategy to optimize each piece. Provide the target keyword, secondary keywords, and any specific SEO requirements in the content brief that initiates the pipeline."
                ]
            },
            {
                heading: "Human-in-the-loop quality control",
                paragraphs: [
                    "Every piece goes through human review before publication. The editor's workflow shifts from writing from scratch to curating and enhancing AI-produced drafts. The editor adds original insights, personal anecdotes, customer quotes, and proprietary data that AI cannot generate.",
                    "Configure a workflow with a human approval step. The editor receives the draft and review assessment via Slack or email, makes edits, and approves for publication. This ensures that every published piece meets your editorial standards."
                ]
            },
            {
                heading: "Measuring content engine performance",
                paragraphs: [
                    "Track output volume, editor time per piece, time-to-publish, organic traffic per piece, and conversion rate. Compare these metrics before and after Content Engine deployment. Most teams see 4-8x output increase with 60-70 percent reduction in per-piece production time.",
                    "Monitor content quality through organic search performance. Pieces that rank well validate the quality. Pieces that underperform suggest areas for improvement in the agent's instructions or the editor's review process."
                ]
            }
        ]
    },
    {
        slug: "how-to-build-competitive-intelligence-agent",
        title: "How to Build a Competitive Intelligence Agent That Monitors Your Market",
        description:
            "Firecrawl-powered competitive monitoring: scrape competitor sites, detect changes, build a RAG knowledge base, and deliver weekly reports.",
        category: "tutorial",
        primaryKeyword: "competitive intelligence ai",
        secondaryKeywords: ["ai market monitoring", "competitor tracking ai"],
        publishedAt: "2026-02-19",
        updatedAt: "2026-02-19",
        author,
        readMinutes: 10,
        relatedDocs: [
            "integrations/firecrawl",
            "knowledge/document-ingestion",
            "platform/triggers-and-schedules"
        ],
        relatedPosts: [
            "build-ai-research-assistant-citations",
            "ai-agents-marketing-content-automation",
            "how-to-build-rag-knowledge-base-tutorial"
        ],
        faqItems: [
            {
                question: "Is web scraping for competitive intelligence legal?",
                answer: "Scraping publicly available information for competitive analysis is generally permissible. However, respect robots.txt directives, terms of service, and applicable laws. Firecrawl handles robots.txt compliance automatically."
            },
            {
                question: "How often should the agent check competitors?",
                answer: "Weekly monitoring is sufficient for most businesses. High-velocity markets may benefit from daily checks. Configure the schedule based on how quickly your competitive landscape changes."
            },
            {
                question: "Can the agent detect pricing changes?",
                answer: "Yes. The agent compares current page content against previous captures to identify changes. Pricing updates, new feature announcements, messaging changes, and new content are all detectable through content comparison."
            }
        ],
        sections: [
            {
                heading: "Why manual competitive intelligence fails",
                paragraphs: [
                    "Most competitive intelligence is ad hoc: someone checks a competitor's website before a sales call or stumbles across an announcement on LinkedIn. According to Crayon's 2025 State of Competitive Intelligence report, 65 percent of organizations lack a systematic approach to competitive monitoring. Those that do have formal programs report 2.4x higher win rates in competitive deals.",
                    "AI agents make continuous competitive monitoring practical and affordable. The agent checks competitor websites, social channels, and review sites on a regular schedule, detects changes, and delivers structured intelligence reports."
                ]
            },
            {
                heading: "Building the competitive intelligence agent",
                paragraphs: [
                    "Create an agent with Firecrawl tools for web scraping and RAG tools for knowledge management. The agent's instructions define which competitor URLs to monitor, what content to extract, and how to format intelligence reports.",
                    "Configure a weekly schedule that processes each competitor's key pages: homepage, pricing page, product pages, blog, and press releases. The agent extracts content, compares it against the previous capture, and flags changes."
                ]
            },
            {
                heading: "Building a competitive knowledge base",
                paragraphs: [
                    "Ingest competitor content into a RAG knowledge base. Over time, this creates a searchable repository of competitor positioning, pricing history, feature announcements, and messaging evolution. Team members can query the knowledge base: what is Competitor X's positioning on enterprise security or when did Competitor Y last change their pricing.",
                    "The knowledge base becomes a strategic asset. Sales teams use it for competitive positioning. Product teams use it for feature prioritization. Marketing teams use it for messaging differentiation. Executive teams use it for strategic planning."
                ]
            },
            {
                heading: "Automated intelligence reports",
                paragraphs: [
                    "Weekly reports summarize competitive changes: new features announced, pricing changes detected, messaging shifts, new content published, and hiring patterns (visible through careers pages). Each change includes a recommended response or talking point.",
                    "Reports are delivered via Slack to the competitive intelligence channel. Urgent changes, like a direct competitor launching a feature your customers have been requesting, trigger immediate alerts outside the weekly cadence."
                ]
            },
            {
                heading: "Getting started",
                paragraphs: [
                    "List your top 3-5 competitors and their key URLs. Configure the agent with these URLs and a weekly schedule. Run the first capture to establish a baseline. From the second week onward, the agent reports changes against the baseline.",
                    "Start simple and expand. Begin with competitor websites, then add their blog RSS feeds, social media profiles, job postings pages, and review site listings. Each additional source deepens your competitive intelligence without additional manual effort."
                ]
            }
        ]
    },
    {
        slug: "how-to-build-ai-agent-guardrails",
        title: "How to Build an AI Agent With Guardrails (PII Detection, Hallucination Filtering)",
        description:
            "Configure layered guardrails for production AI agents: PII detection, hallucination filtering, budget controls, and content safety policies.",
        category: "tutorial",
        primaryKeyword: "ai guardrails",
        secondaryKeywords: ["ai safety", "prevent ai hallucination"],
        publishedAt: "2026-02-19",
        updatedAt: "2026-02-19",
        author,
        readMinutes: 11,
        relatedDocs: ["agents/guardrails", "agents/budgets-and-costs", "platform/observability"],
        relatedPosts: [
            "guardrails-for-production-ai-agents",
            "reduce-ai-agent-hallucinations-production",
            "ai-agent-security-cve-2026-25253"
        ],
        faqItems: [
            {
                question: "What types of PII can guardrails detect?",
                answer: "The PII detection layer identifies and can redact or block social security numbers, credit card numbers, phone numbers, email addresses, physical addresses, dates of birth, and custom patterns you define. Detection operates on both agent inputs and outputs."
            },
            {
                question: "Can guardrails be customized per agent?",
                answer: "Yes. Each agent has its own guardrail configuration. A customer-facing agent might have strict content filtering and PII detection. An internal research agent might have looser restrictions but strict budget controls. Guardrails are configured independently per agent."
            },
            {
                question: "Do guardrails slow down agent responses?",
                answer: "Guardrail evaluation adds minimal latency, typically under 100 milliseconds. The checks are deterministic rule-based evaluations, not LLM calls, so they execute quickly and predictably."
            }
        ],
        sections: [
            {
                heading: "Why guardrails are non-negotiable for production",
                paragraphs: [
                    "Every production AI agent needs guardrails. Without them, agents can leak PII in responses, hallucinate incorrect information, consume excessive resources, and produce content that violates organizational policies. According to OWASP's 2025 LLM Top 10, inadequate output handling is the third most common vulnerability in production LLM applications.",
                    "Guardrails are not about restricting agent capability. They are about ensuring that agent actions stay within defined boundaries. A well-guardrailed agent is actually more useful because users trust it for sensitive tasks."
                ]
            },
            {
                heading: "Layer 1: Input validation",
                paragraphs: [
                    "Input guardrails sanitize data before it reaches the LLM. This includes detecting prompt injection patterns, filtering malicious content, validating input format, and enforcing length limits. Input validation is the first line of defense against adversarial inputs.",
                    "Configure input validation rules in the agent's guardrail settings. Define patterns to detect and block, maximum input lengths, and handling rules for suspicious content (block, flag, or sanitize). These rules execute deterministically without LLM involvement."
                ]
            },
            {
                heading: "Layer 2: Tool permission policies",
                paragraphs: [
                    "Define exactly which tools each agent can use and with what parameters. A support agent should read customer data but not modify financial records. A drafting agent should compose text but not send emails without approval. Tool permissions enforce the principle of least privilege.",
                    "Permission policies are checked independently of the LLM's reasoning. Even if the model decides a tool call is appropriate, the policy engine validates it against the configured permissions before execution proceeds."
                ]
            },
            {
                heading: "Layer 3: Output validation",
                paragraphs: [
                    "Output guardrails scan the agent's response before it reaches the user. PII detection identifies personal information that should not be in the response. Hallucination filtering flags statements that contradict the knowledge base. Content policies enforce brand guidelines and communication standards.",
                    "When output validation catches a violation, the response is either modified (PII redacted), flagged for human review, or blocked entirely based on severity. The violation is logged in the audit trail for compliance review."
                ]
            },
            {
                heading: "Layer 4: Budget and execution controls",
                paragraphs: [
                    "Budget guardrails cap the cost of each execution and the monthly cumulative spend. Execution controls limit the number of tool calls per run, the maximum execution time, and the types of actions that can be performed autonomously versus those requiring approval.",
                    "These controls create a safety net against runaway executions. A bug or adversarial input that causes the agent to enter a loop is stopped by the execution limit before it consumes excessive resources."
                ]
            },
            {
                heading: "Implementing guardrails in practice",
                paragraphs: [
                    "Start with conservative guardrails and loosen them as you build confidence. Enable PII detection, set strict budget limits, require human approval for external communications, and enable full execution tracing. After observing agent behavior for one to two weeks, adjust guardrail sensitivity based on false positive rates and operational needs.",
                    "Review guardrail events regularly. Each time a guardrail triggers, the event is logged with context about what was caught and why. These logs inform guardrail tuning and provide compliance evidence for audit purposes."
                ]
            }
        ]
    },
    {
        slug: "how-to-build-self-improving-ai-agent",
        title: "How to Build an AI Agent That Learns and Improves Over Time",
        description:
            "Configure continuous learning: signal extraction, improvement proposals, A/B experiments, and human-approved optimizations for AI agents.",
        category: "tutorial",
        primaryKeyword: "ai agent learning",
        secondaryKeywords: ["self-improving ai", "ai continuous improvement"],
        publishedAt: "2026-02-19",
        updatedAt: "2026-02-19",
        author,
        readMinutes: 12,
        relatedDocs: ["agents/learning", "agents/evaluations", "agents/simulations"],
        relatedPosts: [
            "self-improving-ai-agents-with-learning",
            "ab-test-ai-agent-configuration",
            "how-to-evaluate-ai-agent-performance"
        ],
        faqItems: [
            {
                question: "Can the agent change its own instructions?",
                answer: "The continuous learning system generates instruction improvement proposals based on performance data. These proposals are presented for human review and require explicit approval before being applied. The agent cannot modify itself without human authorization."
            },
            {
                question: "How long until the agent starts improving?",
                answer: "The learning system needs a minimum of 50-100 production runs to extract meaningful quality signals. Most agents show measurable improvement after 2-4 weeks of production operation. The improvement rate depends on run volume and the diversity of inputs."
            },
            {
                question: "What if a learning proposal makes things worse?",
                answer: "Proposals are validated through A/B experiments before being promoted. If the experiment shows degradation, the proposal is rejected. Additionally, all changes are version-controlled with instant rollback, so any negative impact can be reversed immediately."
            }
        ],
        sections: [
            {
                heading: "The improvement flywheel",
                paragraphs: [
                    "The most valuable AI agents are not the ones that perform best on day one. They are the ones that improve fastest over time. AgentC2's continuous learning system creates an automated improvement flywheel: the agent runs in production, the system extracts quality signals from runs, generates improvement proposals, validates proposals through experiments, and promotes winners with human approval.",
                    "This flywheel means that your agents compound in value. An agent deployed today is better next month, and better still the month after. According to research from Google DeepMind published in 2025, AI systems with continuous learning loops outperform static systems by 25-40 percent within six months of deployment."
                ]
            },
            {
                heading: "Step 1: Enable evaluation scorers",
                paragraphs: [
                    "The foundation of continuous learning is quality measurement. Configure scorers on your agent that evaluate response relevance, accuracy, helpfulness, and any domain-specific criteria. These scorers run automatically on every production run, creating the quality dataset that the learning system analyzes.",
                    "Start with pre-built scorers for general quality dimensions. Add custom scorers for domain-specific criteria: a sales agent might be scored on CRM update completeness, a support agent on resolution accuracy, a research agent on citation quality."
                ]
            },
            {
                heading: "Step 2: Collect production signals",
                paragraphs: [
                    "Beyond automated scorers, collect human feedback signals. User thumbs-up and thumbs-down ratings, explicit feedback comments, and behavioral signals like whether users acted on agent recommendations all contribute to the quality dataset.",
                    "The learning system correlates these signals with agent configuration: which instructions produced the best scores, which model settings correlated with higher user satisfaction, and which tool combinations led to the most complete outputs."
                ]
            },
            {
                heading: "Step 3: Review improvement proposals",
                paragraphs: [
                    "After accumulating sufficient data, the learning system generates improvement proposals. These might include instruction refinements (adding specificity to reduce hallucination), model parameter adjustments (changing temperature for more consistent outputs), or tool configuration changes (adding or removing tools based on usage patterns).",
                    "Each proposal includes the evidence that supports it: the quality signals that identified the improvement opportunity, the expected impact based on historical data, and the specific changes proposed. Review proposals and approve those that align with your quality goals."
                ]
            },
            {
                heading: "Step 4: Validate through experiments",
                paragraphs: [
                    "Approved proposals are validated through A/B experiments. The current agent configuration and the proposed improvement process the same inputs. Scorers evaluate both versions. If the proposed version performs better, it is promoted. If not, it is rejected.",
                    "Experiments run for a configured number of interactions (typically 50-100) to achieve statistical significance. The platform handles traffic splitting, data collection, and statistical analysis. You review the results and make the final promotion decision."
                ]
            },
            {
                heading: "Step 5: Monitor and iterate",
                paragraphs: [
                    "Continuous learning is ongoing, not one-time. Monitor improvement trends over time. Review the velocity of proposals: more proposals indicate more learning opportunities. Review the acceptance rate: low acceptance suggests the learning system needs calibration. Review quality trends: are scores improving over time?",
                    "The best-performing agents maintain a steady cadence of small improvements. Major breakthroughs are rare; consistent marginal gains compound into significant performance differences over months. Treat continuous learning as an operational practice, not a project with an end date."
                ]
            }
        ]
    }
];
