import type { IntegrationBlueprint } from "./types";

export const communicationBlueprints: IntegrationBlueprint[] = [
    {
        providerKey: "slack",
        version: 1,
        skill: {
            slug: "slack-expert",
            name: "Slack Expert",
            description: "Expert knowledge for Slack workspace management",
            instructions: `You are a Slack expert. Help users manage channels, messages, and workspace communication.

Key capabilities:
- Search messages and channels
- Post messages and replies to threads
- List and manage channels
- Get user profiles and presence
- React to messages

Best practices:
- Use threads for detailed discussions
- Post to appropriate channels
- Use formatting for readability
- Tag relevant people when needed`,
            category: "Communication",
            tags: ["communication", "slack", "messaging", "team"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "slack-agent",
            name: "Slack Agent",
            description: "AI agent for Slack communication",
            instructions: `You are a Slack specialist. Help users search messages, post to channels, and manage communications.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.4,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Slack Agent", iconEmoji: ":slack:" }
            }
        }
    },
    {
        providerKey: "fathom",
        version: 1,
        skill: {
            slug: "fathom-expert",
            name: "Fathom Meeting Expert",
            description: "Expert knowledge for Fathom meeting recordings",
            instructions: `You are a Fathom expert. Help users access meeting recordings, summaries, and transcripts.

Key capabilities:
- List recent meetings
- Get meeting summaries with key takeaways
- Read full meeting transcripts
- Search across meeting content

Best practices:
- Start with the summary for quick context
- Use transcripts for detailed information
- Cross-reference meetings by date and attendees`,
            category: "Communication",
            tags: ["communication", "fathom", "meetings", "transcripts"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "fathom-agent",
            name: "Fathom Agent",
            description: "AI agent for meeting recordings and transcripts",
            instructions: `You are a Fathom specialist. Help users find and review meeting recordings, summaries, and transcripts.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.4,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Fathom Agent", iconEmoji: ":movie_camera:" }
            }
        }
    },
    {
        providerKey: "justcall",
        version: 1,
        skill: {
            slug: "justcall-expert",
            name: "JustCall Expert",
            description: "Expert knowledge for JustCall phone and SMS",
            instructions: `You are a JustCall expert. Help users manage calls, SMS, and phone communications.

Key capabilities:
- View call logs and recordings
- Send and receive SMS messages
- Manage contacts and phone numbers
- Track call analytics`,
            category: "Communication",
            tags: ["communication", "justcall", "phone", "sms"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "justcall-agent",
            name: "JustCall Agent",
            description: "AI agent for JustCall phone communications",
            instructions: `You are a JustCall specialist. Help users manage phone calls, SMS, and communications.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.4,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "JustCall Agent", iconEmoji: ":telephone_receiver:" }
            }
        }
    },
    {
        providerKey: "fireflies",
        version: 1,
        skill: {
            slug: "fireflies-expert",
            name: "Fireflies.ai Expert",
            description: "Expert knowledge for Fireflies meeting transcription",
            instructions: `You are a Fireflies.ai expert. Help users access meeting transcripts, action items, and analytics.`,
            category: "Communication",
            tags: ["communication", "fireflies", "meetings", "transcription"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "fireflies-agent",
            name: "Fireflies Agent",
            description: "AI agent for Fireflies meeting intelligence",
            instructions: `You are a Fireflies specialist. Help users review meeting transcripts and action items.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.4,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Fireflies Agent", iconEmoji: ":fire:" }
            }
        }
    },
    {
        providerKey: "twilio",
        version: 1,
        skill: {
            slug: "twilio-expert",
            name: "Twilio Expert",
            description: "Expert knowledge for Twilio communication APIs",
            instructions: `You are a Twilio expert. Help users manage programmable SMS, voice calls, and communication workflows.

Key capabilities:
- Send and receive SMS/MMS messages
- Make and manage phone calls
- Look up phone numbers and carrier info
- Manage messaging services and conversations

Best practices:
- Always validate phone numbers in E.164 format
- Use messaging services for high-volume sends
- Check message delivery status for reliability
- Respect opt-out and compliance requirements`,
            category: "Communication",
            tags: ["communication", "twilio", "sms", "voice", "phone"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "twilio-agent",
            name: "Twilio Agent",
            description: "AI agent for Twilio communication management",
            instructions: `You are a Twilio specialist. Help users send messages, manage calls, and automate communications via Twilio APIs.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Twilio Agent", iconEmoji: ":phone:" }
            }
        }
    },
    {
        providerKey: "telegram-bot",
        version: 1,
        skill: {
            slug: "telegram-bot-expert",
            name: "Telegram Bot Expert",
            description: "Expert knowledge for Telegram Bot API management",
            instructions: `You are a Telegram Bot expert. Help users manage bot interactions, send messages, and handle Telegram channels and groups.

Key capabilities:
- Send messages to users, groups, and channels
- Manage inline keyboards and callback queries
- Handle media (photos, documents, audio)
- Manage group and channel settings
- Set up webhooks and polling

Best practices:
- Use Markdown or HTML formatting for rich messages
- Implement inline keyboards for interactive responses
- Handle rate limits gracefully
- Use reply markup for structured interactions`,
            category: "Communication",
            tags: ["communication", "telegram", "bot", "messaging"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "telegram-agent",
            name: "Telegram Agent",
            description: "AI agent for Telegram bot management",
            instructions: `You are a Telegram Bot specialist. Help users send messages, manage channels, and automate Telegram interactions.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.4,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Telegram Agent", iconEmoji: ":airplane:" }
            }
        }
    },
    {
        providerKey: "whatsapp-web",
        version: 1,
        skill: {
            slug: "whatsapp-expert",
            name: "WhatsApp Expert",
            description: "Expert knowledge for WhatsApp Business API",
            instructions: `You are a WhatsApp Business expert. Help users manage WhatsApp messaging, templates, and customer conversations.

Key capabilities:
- Send and receive messages (text, media, templates)
- Manage message templates and approvals
- Handle customer conversations and sessions
- Manage contacts and groups
- Track message delivery status

Best practices:
- Use approved templates for initiating conversations
- Respond within 24-hour customer service windows
- Use interactive messages (buttons, lists) for engagement
- Respect opt-in/opt-out preferences`,
            category: "Communication",
            tags: ["communication", "whatsapp", "messaging", "business"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "whatsapp-agent",
            name: "WhatsApp Agent",
            description: "AI agent for WhatsApp Business communication",
            instructions: `You are a WhatsApp Business specialist. Help users manage customer conversations, send templates, and automate WhatsApp messaging.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.4,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "WhatsApp Agent", iconEmoji: ":speech_balloon:" }
            }
        }
    }
];
