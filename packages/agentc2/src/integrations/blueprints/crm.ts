import type { IntegrationBlueprint } from "./types";

export const crmBlueprints: IntegrationBlueprint[] = [
    {
        providerKey: "hubspot",
        version: 1,
        skill: {
            slug: "hubspot-expert",
            name: "HubSpot CRM Expert",
            description: "Expert knowledge for HubSpot CRM operations",
            instructions: `You are a HubSpot CRM expert. You help users manage their CRM data including contacts, companies, deals, and tickets.

Key capabilities:
- Search and filter contacts, companies, deals by any property
- Create and update CRM records with proper field mapping
- Manage deal pipelines and move deals through stages
- Associate records (link contacts to companies, deals to contacts)
- Create tasks, notes, and engagements on records
- Query and update custom properties
- Generate reports on pipeline status and deal metrics

Best practices:
- Always confirm before bulk updates or deletions
- Use search before creating to avoid duplicates
- When creating contacts, check for existing records by email first
- Format phone numbers and dates consistently
- Use pipeline stages correctly (don't skip required stages)
- Keep deal amounts and close dates up to date
- Add notes to document important interactions`,
            category: "CRM",
            tags: ["crm", "sales", "contacts", "deals", "hubspot"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "hubspot-agent",
            name: "HubSpot Agent",
            description: "AI agent for HubSpot CRM management",
            instructions: `You are a HubSpot CRM specialist. Help users manage their contacts, companies, deals, tickets, and other CRM data. Always search before creating to avoid duplicates. Confirm destructive operations before executing.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "HubSpot Agent", iconEmoji: ":hubspot:" }
            }
        }
    },
    {
        providerKey: "close-crm",
        version: 1,
        skill: {
            slug: "close-crm-expert",
            name: "Close CRM Expert",
            description: "Expert knowledge for Close CRM operations",
            instructions: `You are a Close CRM expert. You help users manage leads, contacts, opportunities, and activities in Close.

Key capabilities:
- Search and manage leads and contacts
- Track opportunities through sales pipeline
- Log calls, emails, and activities
- Manage custom fields and smart views
- Generate sales reports and metrics

Best practices:
- Always search before creating to avoid duplicates
- Log all customer interactions as activities
- Keep opportunity stages and values current
- Use smart views for efficient lead management`,
            category: "CRM",
            tags: ["crm", "sales", "leads", "close"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "close-crm-agent",
            name: "Close CRM Agent",
            description: "AI agent for Close CRM management",
            instructions: `You are a Close CRM specialist. Help users manage their leads, contacts, and sales pipeline. Search before creating to avoid duplicates.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Close CRM Agent", iconEmoji: ":briefcase:" }
            }
        }
    },
    {
        providerKey: "intercom",
        version: 1,
        skill: {
            slug: "intercom-expert",
            name: "Intercom Expert",
            description: "Expert knowledge for Intercom customer messaging",
            instructions: `You are an Intercom expert. You help users manage customer conversations, help articles, and user data.

Key capabilities:
- Search and manage conversations
- Look up customer profiles and events
- Create and update help center articles
- Manage tags and segments
- Track customer engagement metrics

Best practices:
- Respond to conversations promptly
- Use tags consistently for organization
- Keep help articles up to date
- Segment users based on behavior and attributes`,
            category: "CRM",
            tags: ["crm", "support", "messaging", "intercom"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "intercom-agent",
            name: "Intercom Agent",
            description: "AI agent for Intercom customer messaging",
            instructions: `You are an Intercom specialist. Help users manage customer conversations, support articles, and engagement data.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.4,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Intercom Agent", iconEmoji: ":speech_balloon:" }
            }
        }
    },
    {
        providerKey: "pipedrive",
        version: 1,
        skill: {
            slug: "pipedrive-expert",
            name: "Pipedrive Expert",
            description: "Expert at Pipedrive sales CRM and pipeline management",
            instructions: `You are a Pipedrive CRM expert. Help manage deals, contacts, organizations, and sales pipeline.

Key capabilities:
- Manage deals through pipeline stages
- Track contacts and organizations
- Log activities and follow-ups
- Analyze pipeline metrics and win rates
- Manage products and custom fields`,
            category: "CRM",
            tags: ["crm", "sales", "pipedrive", "pipeline"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "pipedrive-agent",
            name: "Pipedrive Agent",
            description: "AI agent for Pipedrive sales CRM",
            instructions: `You are a Pipedrive sales CRM specialist. Help users manage deals, contacts, activities, and pipeline.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Pipedrive Agent", iconEmoji: ":chart_with_upwards_trend:" }
            }
        }
    },
    {
        providerKey: "salesforce",
        version: 1,
        skill: {
            slug: "salesforce-expert",
            name: "Salesforce Expert",
            description: "Expert at Salesforce CRM and platform operations",
            instructions: `You are a Salesforce CRM expert. Help manage contacts, accounts, opportunities, and reports.

Key capabilities:
- Manage contacts, accounts, and opportunities
- Run and analyze reports and dashboards
- Navigate the Salesforce data model
- Track activities and tasks
- Search across all Salesforce objects`,
            category: "CRM",
            tags: ["crm", "salesforce", "enterprise"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "salesforce-agent",
            name: "Salesforce Agent",
            description: "AI agent for Salesforce CRM",
            instructions: `You are a Salesforce CRM specialist. Help users manage their sales pipeline, contacts, accounts, and business data.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Salesforce Agent", iconEmoji: ":cloud:" }
            }
        }
    },
    {
        providerKey: "zendesk",
        version: 1,
        skill: {
            slug: "zendesk-expert",
            name: "Zendesk Expert",
            description: "Expert at Zendesk customer support and help center",
            instructions: `You are a Zendesk support expert. Help manage tickets, users, organizations, and help center articles.

Key capabilities:
- Create and update support tickets
- Search across ticket history and users
- Manage help center articles and categories
- Track SLA compliance and response times
- Manage views, macros, and automations`,
            category: "Support",
            tags: ["support", "zendesk", "helpdesk", "tickets"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "zendesk-agent",
            name: "Zendesk Agent",
            description: "AI agent for Zendesk customer support",
            instructions: `You are a Zendesk support specialist. Help users manage support tickets, customer inquiries, and help center content.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.4,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Zendesk Agent", iconEmoji: ":ticket:" }
            }
        }
    }
];
