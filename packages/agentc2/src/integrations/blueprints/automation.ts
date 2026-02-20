import type { IntegrationBlueprint } from "./types";

export const automationBlueprints: IntegrationBlueprint[] = [
    {
        providerKey: "zapier",
        version: 1,
        skill: {
            slug: "zapier-expert",
            name: "Zapier Expert",
            description: "Expert at Zapier workflow automation across 8000+ apps",
            instructions: `You are a Zapier automation expert. Help users trigger and manage Zaps and workflow automations.

Key capabilities:
- Trigger existing Zap actions
- List available apps and actions
- Search for automation patterns
- Manage workflow connections
- Debug and optimize Zaps`,
            category: "Automation",
            tags: ["automation", "zapier", "workflow", "integration"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "zapier-agent",
            name: "Zapier Agent",
            description: "AI agent for Zapier workflow automation",
            instructions: `You are a Zapier automation specialist. Help users trigger workflows, manage app connections, and build automation chains.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Zapier Agent", iconEmoji: ":zap:" }
            }
        }
    },
    {
        providerKey: "make",
        version: 1,
        skill: {
            slug: "make-expert",
            name: "Make Expert",
            description: "Expert at Make (Integromat) visual workflow automation",
            instructions: `You are a Make automation expert. Help users build and manage visual workflow scenarios.

Key capabilities:
- Create and trigger scenarios
- Connect modules across services
- Manage data stores and data structures
- Monitor scenario execution and errors
- Optimize and debug workflows`,
            category: "Automation",
            tags: ["automation", "make", "integromat", "workflow"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "make-agent",
            name: "Make Agent",
            description: "AI agent for Make workflow automation",
            instructions: `You are a Make (Integromat) automation specialist. Help users create and manage visual workflow automations.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Make Agent", iconEmoji: ":gear:" }
            }
        }
    },
    {
        providerKey: "atlas",
        version: 1,
        skill: {
            slug: "atlas-expert",
            name: "ATLAS Expert",
            description: "Expert at n8n/ATLAS workflow automation",
            instructions: `You are an ATLAS (n8n) workflow expert. Help users trigger and manage n8n workflows via MCP.

Key capabilities:
- Trigger n8n workflows with parameters
- List available workflows and their status
- Monitor execution results
- Debug workflow failures`,
            category: "Automation",
            tags: ["automation", "n8n", "atlas", "workflow"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "atlas-agent",
            name: "ATLAS Agent",
            description: "AI agent for ATLAS/n8n workflows",
            instructions: `You are an ATLAS/n8n workflow specialist. Help users trigger, monitor, and debug n8n workflow automations.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "ATLAS Agent", iconEmoji: ":robot_face:" }
            }
        }
    }
];
