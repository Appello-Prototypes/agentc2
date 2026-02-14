import type { IntegrationBlueprint } from "./types";

export const dataBlueprints: IntegrationBlueprint[] = [
    {
        providerKey: "google-bigquery",
        version: 1,
        skill: {
            slug: "bigquery-expert",
            name: "BigQuery Expert",
            description: "Expert knowledge for Google BigQuery analytics",
            instructions: `You are a BigQuery expert. Help users query datasets, manage tables, and analyze data at scale.`,
            category: "Data & Analytics",
            tags: ["data", "bigquery", "sql", "analytics"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "bigquery-agent",
            name: "BigQuery Agent",
            description: "AI agent for BigQuery data analytics",
            instructions: `You are a BigQuery specialist. Help users write SQL queries and analyze data.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.2,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "BigQuery Agent", iconEmoji: ":bar_chart:" }
            }
        }
    },
    {
        providerKey: "google-maps",
        version: 1,
        skill: {
            slug: "google-maps-expert",
            name: "Google Maps Expert",
            description: "Expert knowledge for Google Maps and Places API",
            instructions: `You are a Google Maps expert. Help users with geocoding, directions, place search, and mapping data.`,
            category: "Data & Analytics",
            tags: ["data", "google-maps", "location", "geolocation"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "google-maps-agent",
            name: "Google Maps Agent",
            description: "AI agent for Google Maps data",
            instructions: `You are a Google Maps specialist. Help users with location data, directions, and place information.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Maps Agent", iconEmoji: ":world_map:" }
            }
        }
    },
    {
        providerKey: "apify",
        version: 1,
        skill: {
            slug: "apify-expert",
            name: "Apify Expert",
            description: "Expert knowledge for Apify web scraping platform",
            instructions: `You are an Apify expert. Help users run actors, manage datasets, and automate web scraping tasks.`,
            category: "Data & Analytics",
            tags: ["data", "apify", "scraping", "automation"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "apify-agent",
            name: "Apify Agent",
            description: "AI agent for Apify web scraping",
            instructions: `You are an Apify specialist. Help users manage web scraping actors and datasets.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Apify Agent", iconEmoji: ":spider:" }
            }
        }
    },
    {
        providerKey: "playwright",
        version: 1,
        skill: {
            slug: "playwright-expert",
            name: "Playwright Expert",
            description: "Expert knowledge for Playwright browser automation",
            instructions: `You are a Playwright expert. Help users automate browsers, take screenshots, and interact with web pages.

Key capabilities:
- Navigate to URLs and take screenshots
- Click elements and fill forms
- Extract page content and data
- Run JavaScript in browser context

Best practices:
- Use CSS selectors for precise targeting
- Wait for elements before interacting
- Take screenshots to verify state`,
            category: "Data & Analytics",
            tags: ["data", "playwright", "browser", "automation"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "playwright-agent",
            name: "Playwright Agent",
            description: "AI agent for Playwright browser automation",
            instructions: `You are a Playwright specialist. Help users automate browser interactions and extract web data.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Playwright Agent", iconEmoji: ":computer:" }
            }
        }
    },
    {
        providerKey: "box",
        version: 1,
        skill: {
            slug: "box-expert",
            name: "Box Expert",
            description: "Expert knowledge for Box cloud storage",
            instructions: `You are a Box expert. Help users manage files, folders, and collaboration in Box.`,
            category: "Storage",
            tags: ["storage", "box", "files", "cloud"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "box-agent",
            name: "Box Agent",
            description: "AI agent for Box file management",
            instructions: `You are a Box specialist. Help users manage files, folders, and shared content.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Box Agent", iconEmoji: ":file_folder:" }
            }
        }
    },
    {
        providerKey: "airtable",
        version: 1,
        skill: {
            slug: "airtable-expert",
            name: "Airtable Expert",
            description: "Expert at Airtable databases and workflow automation",
            instructions: `You are an Airtable expert. Help users manage bases, tables, records, and views.

Key capabilities:
- Create and manage bases and tables
- CRUD operations on records
- Configure views, filters, and sorts
- Manage field types and formulas
- Automate workflows with Airtable automations`,
            category: "Data",
            tags: ["data", "airtable", "database", "spreadsheet"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "airtable-agent",
            name: "Airtable Agent",
            description: "AI agent for Airtable databases",
            instructions: `You are an Airtable database specialist. Help users manage their bases, create records, and organize data.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Airtable Agent", iconEmoji: ":card_file_box:" }
            }
        }
    },
    {
        providerKey: "shopify",
        version: 1,
        skill: {
            slug: "shopify-expert",
            name: "Shopify Expert",
            description: "Expert at Shopify e-commerce operations",
            instructions: `You are a Shopify e-commerce expert. Help manage products, orders, customers, and store operations.

Key capabilities:
- Manage products, variants, and inventory
- Process and track orders
- Manage customers and segments
- Handle fulfillment and shipping
- Analyze sales and conversion data`,
            category: "E-Commerce",
            tags: ["ecommerce", "shopify", "orders", "products"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "shopify-agent",
            name: "Shopify Agent",
            description: "AI agent for Shopify e-commerce",
            instructions: `You are a Shopify e-commerce specialist. Help users manage their online store, products, orders, and customers.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Shopify Agent", iconEmoji: ":shopping_bags:" }
            }
        }
    }
];
