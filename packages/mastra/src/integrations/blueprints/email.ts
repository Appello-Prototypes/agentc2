import type { IntegrationBlueprint } from "./types";

export const emailBlueprints: IntegrationBlueprint[] = [
    {
        providerKey: "gmail",
        version: 1,
        skill: {
            slug: "gmail-expert",
            name: "Gmail Expert",
            description: "Expert knowledge for Gmail email management",
            instructions: `You are a Gmail expert. Help users manage their email, labels, filters, and contacts.

Key capabilities:
- Search emails with Gmail query syntax
- Read, send, and draft emails
- Manage labels and organize messages
- Create and manage filters
- Handle attachments

Best practices:
- Use search operators for precise queries (from:, to:, subject:, has:attachment)
- Keep inbox organized with labels and filters
- Use drafts for important emails before sending
- Archive instead of delete when possible`,
            category: "Email",
            tags: ["email", "gmail", "google", "communication"],
            toolDiscovery: "static",
            staticTools: [
                "gmail-search",
                "gmail-read",
                "gmail-send",
                "gmail-draft",
                "gmail-archive",
                "gmail-label"
            ]
        },
        agent: {
            slug: "gmail-agent",
            name: "Gmail Agent",
            description: "AI agent for Gmail email management",
            instructions: `You are a Gmail specialist. Help users search, read, compose, and organize their email. Always confirm before sending emails.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Gmail Agent", iconEmoji: ":email:" }
            }
        }
    },
    {
        providerKey: "microsoft",
        version: 1,
        skill: {
            slug: "microsoft-expert",
            name: "Microsoft 365 Expert",
            description: "Expert knowledge for Outlook Mail and Calendar",
            instructions: `You are a Microsoft 365 expert. Help users manage Outlook email and calendar.

Key capabilities:
- Search and read emails
- Send and draft emails
- Create, update, and delete calendar events
- View free/busy schedules
- Manage email folders

Best practices:
- Use categories for email organization
- Check calendar availability before scheduling
- Include clear subjects and context in emails`,
            category: "Email",
            tags: ["email", "microsoft", "outlook", "calendar"],
            toolDiscovery: "static",
            staticTools: [
                "microsoft-mail-list",
                "microsoft-mail-read",
                "microsoft-mail-send",
                "microsoft-mail-archive",
                "microsoft-calendar-list",
                "microsoft-calendar-create",
                "microsoft-calendar-update",
                "microsoft-calendar-delete"
            ]
        },
        agent: {
            slug: "microsoft-agent",
            name: "Microsoft 365 Agent",
            description: "AI agent for Outlook and Calendar",
            instructions: `You are a Microsoft 365 specialist. Help users manage Outlook email and calendar events.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Microsoft Agent", iconEmoji: ":office:" }
            }
        }
    },
    {
        providerKey: "google-calendar",
        version: 1,
        skill: {
            slug: "google-calendar-expert",
            name: "Google Calendar Expert",
            description: "Expert knowledge for Google Calendar management",
            instructions: `You are a Google Calendar expert. Help users manage events, schedules, and availability.

Key capabilities:
- List and search calendar events
- Create, update, and delete events
- Check free/busy availability
- Manage multiple calendars

Best practices:
- Check availability before scheduling
- Include location and description in events
- Use recurring events for regular meetings`,
            category: "Email",
            tags: ["calendar", "google", "scheduling", "events"],
            toolDiscovery: "static",
            staticTools: [
                "google-calendar-list",
                "google-calendar-create",
                "google-calendar-update",
                "google-calendar-delete",
                "google-calendar-freebusy"
            ]
        },
        agent: {
            slug: "google-calendar-agent",
            name: "Google Calendar Agent",
            description: "AI agent for Google Calendar",
            instructions: `You are a Google Calendar specialist. Help users manage events and scheduling.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Calendar Agent", iconEmoji: ":calendar:" }
            }
        }
    },
    {
        providerKey: "google-drive",
        version: 1,
        skill: {
            slug: "google-drive-expert",
            name: "Google Drive Expert",
            description: "Expert knowledge for Google Drive file management",
            instructions: `You are a Google Drive expert. Help users find, read, and manage files in Drive.`,
            category: "Storage",
            tags: ["storage", "google-drive", "files", "documents"],
            toolDiscovery: "static",
            staticTools: [
                "google-drive-search",
                "google-drive-list",
                "google-drive-read-file",
                "google-drive-create-doc"
            ]
        },
        agent: {
            slug: "google-drive-agent",
            name: "Google Drive Agent",
            description: "AI agent for Google Drive management",
            instructions: `You are a Google Drive specialist. Help users find and manage their files and documents.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Drive Agent", iconEmoji: ":file_folder:" }
            }
        }
    },
    {
        providerKey: "dropbox",
        version: 1,
        skill: {
            slug: "dropbox-expert",
            name: "Dropbox Expert",
            description: "Expert knowledge for Dropbox file management",
            instructions: `You are a Dropbox expert. Help users manage files, folders, and sharing in Dropbox.`,
            category: "Storage",
            tags: ["storage", "dropbox", "files", "cloud"],
            toolDiscovery: "static",
            staticTools: [
                "dropbox-list",
                "dropbox-read",
                "dropbox-upload",
                "dropbox-search",
                "dropbox-sharing-link"
            ]
        },
        agent: {
            slug: "dropbox-agent",
            name: "Dropbox Agent",
            description: "AI agent for Dropbox file management",
            instructions: `You are a Dropbox specialist. Help users manage their files and shared content.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Dropbox Agent", iconEmoji: ":dropbox:" }
            }
        }
    }
];
