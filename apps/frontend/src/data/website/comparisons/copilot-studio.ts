import type { ComparisonData } from "@/components/website/comparison/comparison-page-template"

export const copilotStudioData: ComparisonData = {
    slug: "copilot-studio",
    competitor: "Microsoft Copilot Studio",
    competitorUrl: "https://www.microsoft.com/en-us/microsoft-copilot/microsoft-copilot-studio",
    heroSubtitle:
        "Microsoft-locked vs. ecosystem-agnostic — enterprise AI should not require vendor lock-in",
    tldr: {
        them: "Microsoft's low-code platform for building copilots within the Microsoft 365 and Power Platform ecosystem. Deep integration with Azure, Teams, Dynamics 365, and SharePoint.",
        us: "Ecosystem-agnostic agent operations platform that integrates with any tool, any model provider, and any channel — without locking you into a single vendor's cloud.",
        difference:
            "Copilot Studio is Microsoft's AI. AgentC2 is your AI."
    },
    dimensions: [
        {
            name: "Ecosystem & vendor lock-in",
            them: "Deeply coupled to Microsoft 365, Azure AI, and Power Platform. Runs on Azure infrastructure. Data stays in the Microsoft ecosystem. Switching providers requires rebuilding from scratch.",
            us: "Vendor-agnostic. Deploy on any cloud or on-premises. Use any model provider. Connect to any tool via MCP. Your agents are not locked to a single vendor's roadmap.",
            whyItMatters:
                "Vendor lock-in trades short-term convenience for long-term inflexibility. When your AI strategy is tied to one vendor, you lose negotiating power, model choice, and architectural freedom."
        },
        {
            name: "Voice & conversational AI",
            them: "Voice capabilities limited to Power Virtual Agents legacy flows and Teams integration. No native integration with leading voice AI providers like ElevenLabs.",
            us: "Native voice support via ElevenLabs (studio-quality voices, cloning) and OpenAI Realtime API. Voice agents deploy alongside text agents on the same platform.",
            whyItMatters:
                "Voice is the fastest-growing AI interaction channel. Platform-native voice — not bolted-on telephony — delivers the quality and latency users expect."
        },
        {
            name: "Channels & reach",
            them: "Primary deployment is Microsoft Teams. Additional channels (web chat, custom) are available but secondary. Non-Microsoft channels require Azure Bot Service.",
            us: "Seven channels built in: web chat, voice, Slack, API, embeddable widget, SMS, and email. No dependency on a separate bot framework.",
            whyItMatters:
                "Not every organization lives in Teams. Agents need to reach users on the platforms they actually use — including non-Microsoft tools."
        },
        {
            name: "Federation & cross-org",
            them: "Cross-tenant sharing requires Azure AD B2B and complex guest access configurations. No native federation protocol for agent-to-agent collaboration across organizations.",
            us: "Encrypted cross-organization federation with scoped trust policies. Agents in different organizations can collaborate, share tools, and exchange data with audit trails.",
            whyItMatters:
                "Enterprise AI spans organizational boundaries — partners, suppliers, customers. Federation should be a platform primitive, not a custom Azure AD project."
        },
        {
            name: "Learning & improvement",
            them: "Analytics dashboards show conversation metrics. Improvement requires manual topic editing. No automated signal extraction or A/B experimentation for agent instructions.",
            us: "Automated learning pipeline: extract signals from runs, generate instruction improvements, run experiments, and apply approved changes — all governed by human oversight.",
            whyItMatters:
                "Copilots that do not learn stagnate. Manual prompt tuning does not scale across dozens of agents serving different functions."
        },
        {
            name: "Developer experience",
            them: "Low-code visual builder with Power Fx expressions. Custom code requires Azure Functions or Power Automate cloud flows. Limited TypeScript/JavaScript support.",
            us: "TypeScript-native with full code-first support plus an admin UI for no-code configuration. Build in code, manage in UI, or mix both — no proprietary expression language required.",
            whyItMatters:
                "Developers want real programming languages. Operators want visual tools. A platform should support both without forcing either into an unfamiliar paradigm."
        },
        {
            name: "Marketplace & templates",
            them: "Microsoft provides pre-built copilot templates within the Power Platform ecosystem. Templates are Microsoft-ecosystem-specific.",
            us: "Playbook Marketplace for ecosystem-agnostic agent configurations — instructions, tools, guardrails, and eval criteria — as importable, production-ready packages.",
            whyItMatters:
                "Templates tied to one ecosystem limit reuse. A vendor-neutral marketplace lets you adopt patterns regardless of your infrastructure choices."
        }
    ],
    featureTable: [
        {
            feature: "Ecosystem dependency",
            us: "Agnostic",
            them: "Microsoft 365"
        },
        {
            feature: "Model providers",
            us: "OpenAI + Anthropic + more",
            them: "Azure OpenAI"
        },
        {
            feature: "Multi-agent orchestration",
            us: "Networks + Campaigns",
            them: "Limited"
        },
        { feature: "Visual builder", us: true, them: true },
        { feature: "Code-first development", us: "TypeScript", them: "Power Fx" },
        { feature: "Multi-tenant governance", us: true, them: "Per-tenant" },
        { feature: "Budget controls (per-agent)", us: true, them: false },
        {
            feature: "Voice agents",
            us: "ElevenLabs + OpenAI",
            them: "Limited"
        },
        {
            feature: "Deployment channels",
            us: "7+ built-in",
            them: "Teams-primary"
        },
        { feature: "Marketplace", us: "Playbook Marketplace", them: "Templates" },
        { feature: "Federation", us: true, them: "Azure AD B2B" },
        { feature: "Self-improving agents", us: true, them: false },
        { feature: "Self-hosted option", us: true, them: false },
        { feature: "Open source core", us: true, them: false }
    ],
    problemWeSolve:
        "Microsoft Copilot Studio is powerful within the Microsoft ecosystem, but it creates deep vendor lock-in. Organizations that use non-Microsoft tools, need model flexibility, or want to deploy agents beyond Teams find themselves building custom bridges and workarounds. AgentC2 provides the same enterprise agent capabilities — governance, channels, marketplace — without tying your AI strategy to a single vendor.",
    whoShouldChooseThem:
        "Copilot Studio is the right choice for organizations fully committed to the Microsoft 365 ecosystem. If your team lives in Teams, uses Dynamics 365, stores data in SharePoint, and runs on Azure, Copilot Studio's deep integration provides a low-friction path to agent deployment within that ecosystem.",
    whoShouldChooseUs:
        "AgentC2 is built for organizations that value flexibility. If you use a mix of tools (Slack, HubSpot, Jira, custom systems), need model provider choice, want to deploy agents on any channel, or require cross-organization federation without Azure AD complexity — AgentC2 gives you enterprise-grade agent operations without vendor lock-in.",
    faqs: [
        {
            question: "Can AgentC2 integrate with Microsoft 365?",
            answer: "Yes. AgentC2 supports Microsoft integrations via native OAuth (Outlook Mail and Calendar via Graph API) and MCP tools. You get Microsoft integration without Microsoft lock-in."
        },
        {
            question:
                "Is Copilot Studio cheaper since it is included in some Microsoft licenses?",
            answer: "Copilot Studio is included in some Microsoft 365 plans, but advanced features require separate licensing. AgentC2's pricing is transparent and usage-based. The total cost of ownership should account for vendor lock-in costs, model flexibility, and the engineering effort required to build non-Microsoft integrations in Copilot Studio."
        },
        {
            question: "Can I migrate copilots from Copilot Studio to AgentC2?",
            answer: "Yes. Copilot topics, trigger phrases, and response logic can be mapped to AgentC2 agent instructions and tool configurations. The migration is primarily a configuration mapping exercise."
        },
        {
            question:
                "Does AgentC2 support Teams as a deployment channel?",
            answer: "AgentC2 supports Slack, web chat, voice, API, embeddable widget, SMS, and email as built-in channels. Teams integration can be added via the Microsoft Bot Framework connector or a custom MCP tool."
        },
        {
            question:
                "Which platform has better enterprise security?",
            answer: "Both platforms offer enterprise-grade security. Copilot Studio inherits Azure's compliance certifications. AgentC2 provides encrypted federation, role-based access, and comprehensive audit logging — plus the option to self-host for full data control."
        }
    ]
}
