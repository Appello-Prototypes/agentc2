import type { IntegrationBlueprint } from "./types";

export const designBlueprints: IntegrationBlueprint[] = [
    {
        providerKey: "figma",
        version: 1,
        skill: {
            slug: "figma-expert",
            name: "Figma Expert",
            description: "Expert knowledge for Figma design management",
            instructions: `You are a Figma expert. Help users manage design files, components, and prototypes.

Key capabilities:
- Search and browse design files
- Get file metadata and components
- List projects and files in teams
- Access design tokens and styles

Best practices:
- Use component names for precise lookups
- Reference specific pages/frames by name
- Track version history for changes`,
            category: "Design",
            tags: ["design", "figma", "ui", "prototyping"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "figma-agent",
            name: "Figma Agent",
            description: "AI agent for Figma design management",
            instructions: `You are a Figma specialist. Help users navigate and manage their design files and components.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.4,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Figma Agent", iconEmoji: ":art:" }
            }
        }
    },
    {
        providerKey: "canva",
        version: 1,
        skill: {
            slug: "canva-expert",
            name: "Canva Expert",
            description: "Expert knowledge for Canva design platform",
            instructions: `You are a Canva expert. Help users manage designs, templates, and brand assets.`,
            category: "Design",
            tags: ["design", "canva", "graphics", "templates"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "canva-agent",
            name: "Canva Agent",
            description: "AI agent for Canva design management",
            instructions: `You are a Canva specialist. Help users manage their designs and brand assets.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.4,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Canva Agent", iconEmoji: ":paintbrush:" }
            }
        }
    },
    {
        providerKey: "cloudinary",
        version: 1,
        skill: {
            slug: "cloudinary-expert",
            name: "Cloudinary Expert",
            description: "Expert knowledge for Cloudinary media management",
            instructions: `You are a Cloudinary expert. Help users manage images, videos, and media assets.`,
            category: "Design",
            tags: ["design", "cloudinary", "media", "images"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "cloudinary-agent",
            name: "Cloudinary Agent",
            description: "AI agent for Cloudinary media management",
            instructions: `You are a Cloudinary specialist. Help users manage media assets and transformations.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.4,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Cloudinary Agent", iconEmoji: ":camera:" }
            }
        }
    }
];
