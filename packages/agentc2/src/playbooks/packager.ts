import { prisma, Prisma, type PlaybookComponentType } from "@repo/database";
import type {
    PackagePlaybookOptions,
    PlaybookManifest,
    AgentSnapshot,
    SkillSnapshot,
    DocumentSnapshot,
    WorkflowSnapshot,
    NetworkSnapshot,
    GuardrailSnapshot,
    TestCaseSnapshot,
    ScorecardSnapshot
} from "./types";
import { sanitizeManifest, detectHardcodedUrls } from "./sanitizer";
import { validateManifest } from "./manifest";

const MCP_TOOL_PREFIX_PATTERN = /^([a-zA-Z0-9_-]+)\./;

function extractIntegrationFromToolId(toolId: string): string | null {
    const match = toolId.match(MCP_TOOL_PREFIX_PATTERN);
    if (!match) return null;
    const prefix = match[1]!;
    const knownPrefixes = new Set([
        "hubspot",
        "jira",
        "firecrawl",
        "playwright",
        "justcall",
        "fathom",
        "slack",
        "github",
        "linear",
        "notion",
        "asana",
        "monday",
        "airtable",
        "stripe",
        "shopify",
        "salesforce",
        "intercom",
        "confluence"
    ]);
    return knownPrefixes.has(prefix) ? prefix : null;
}

async function snapshotAgent(agentId: string): Promise<{
    agent: AgentSnapshot;
    skillIds: string[];
    documentIds: string[];
}> {
    const record = await prisma.agent.findUniqueOrThrow({
        where: { id: agentId },
        include: {
            tools: true,
            skills: { include: { skill: true } },
            guardrailPolicy: true,
            testCases: true,
            scorecard: true
        }
    });

    const skillIds = record.skills.map((as) => as.skillId);

    const guardrail: GuardrailSnapshot | null = record.guardrailPolicy
        ? {
              agentSlug: record.slug,
              configJson: record.guardrailPolicy.configJson,
              version: record.guardrailPolicy.version
          }
        : null;

    const testCases: TestCaseSnapshot[] = record.testCases.map((tc) => ({
        agentSlug: record.slug,
        name: tc.name,
        inputText: tc.inputText,
        expectedOutput: tc.expectedOutput,
        tags: tc.tags
    }));

    const scorecard: ScorecardSnapshot | null = record.scorecard
        ? {
              agentSlug: record.slug,
              criteria: record.scorecard.criteria,
              version: record.scorecard.version,
              samplingRate: record.scorecard.samplingRate,
              auditorModel: record.scorecard.auditorModel,
              evaluateTurns: record.scorecard.evaluateTurns
          }
        : null;

    const agent: AgentSnapshot = {
        slug: record.slug,
        name: record.name,
        description: record.description,
        instructions: record.instructions,
        instructionsTemplate: record.instructionsTemplate,
        modelProvider: record.modelProvider,
        modelName: record.modelName,
        temperature: record.temperature,
        maxTokens: record.maxTokens,
        modelConfig: record.modelConfig,
        routingConfig: record.routingConfig,
        contextConfig: record.contextConfig,
        subAgents: record.subAgents,
        workflows: record.workflows,
        memoryEnabled: record.memoryEnabled,
        memoryConfig: record.memoryConfig,
        maxSteps: record.maxSteps,
        visibility: record.visibility,
        requiresApproval: record.requiresApproval,
        maxSpendUsd: record.maxSpendUsd,
        autoVectorize: record.autoVectorize,
        deploymentMode: record.deploymentMode,
        metadata: record.metadata,
        version: record.version,
        tools: record.tools.map((t) => ({ toolId: t.toolId, config: t.config })),
        skills: record.skills.map((as) => as.skill.slug),
        guardrail,
        testCases,
        scorecard
    };

    const documentIds: string[] = [];
    for (const as of record.skills) {
        const skillDocs = await prisma.skillDocument.findMany({
            where: { skillId: as.skillId }
        });
        for (const sd of skillDocs) {
            if (!documentIds.includes(sd.documentId)) {
                documentIds.push(sd.documentId);
            }
        }
    }

    return { agent, skillIds, documentIds };
}

async function snapshotSkill(skillId: string): Promise<{
    skill: SkillSnapshot;
    documentIds: string[];
}> {
    const record = await prisma.skill.findUniqueOrThrow({
        where: { id: skillId },
        include: { tools: true, documents: true }
    });

    const skill: SkillSnapshot = {
        slug: record.slug,
        name: record.name,
        description: record.description,
        instructions: record.instructions,
        examples: record.examples,
        category: record.category,
        tags: record.tags,
        metadata: record.metadata,
        version: record.version,
        tools: record.tools.map((t) => ({ toolId: t.toolId })),
        documents: record.documents.map((d) => d.documentId)
    };

    return { skill, documentIds: record.documents.map((d) => d.documentId) };
}

async function snapshotDocument(documentId: string): Promise<DocumentSnapshot> {
    const record = await prisma.document.findUniqueOrThrow({
        where: { id: documentId }
    });

    return {
        slug: record.slug,
        name: record.name,
        description: record.description,
        content: record.content,
        contentType: record.contentType,
        category: record.category,
        tags: record.tags,
        metadata: record.metadata,
        version: record.version
    };
}

async function snapshotWorkflow(workflowId: string): Promise<WorkflowSnapshot> {
    const record = await prisma.workflow.findUniqueOrThrow({
        where: { id: workflowId }
    });

    return {
        slug: record.slug,
        name: record.name,
        description: record.description,
        definitionJson: record.definitionJson,
        inputSchemaJson: record.inputSchemaJson,
        outputSchemaJson: record.outputSchemaJson,
        maxSteps: record.maxSteps,
        timeout: record.timeout,
        retryConfig: record.retryConfig,
        version: record.version
    };
}

async function snapshotNetwork(networkId: string): Promise<{
    network: NetworkSnapshot;
    agentIds: string[];
    workflowIds: string[];
}> {
    const record = await prisma.network.findUniqueOrThrow({
        where: { id: networkId },
        include: {
            primitives: {
                include: { agent: true, workflow: true }
            }
        }
    });

    const agentIds: string[] = [];
    const workflowIds: string[] = [];

    const network: NetworkSnapshot = {
        slug: record.slug,
        name: record.name,
        description: record.description,
        instructions: record.instructions,
        modelProvider: record.modelProvider,
        modelName: record.modelName,
        temperature: record.temperature,
        topologyJson: record.topologyJson,
        memoryConfig: record.memoryConfig,
        maxSteps: record.maxSteps,
        version: record.version,
        primitives: record.primitives.map((p) => {
            if (p.agentId) agentIds.push(p.agentId);
            if (p.workflowId) workflowIds.push(p.workflowId);
            return {
                primitiveType: p.primitiveType,
                agentSlug: p.agent?.slug ?? null,
                workflowSlug: p.workflow?.slug ?? null,
                toolId: p.toolId,
                description: p.description,
                position: p.position
            };
        })
    };

    return { network, agentIds, workflowIds };
}

export async function packagePlaybook(opts: PackagePlaybookOptions) {
    const allAgentSnapshots: AgentSnapshot[] = [];
    const allSkillSnapshots: SkillSnapshot[] = [];
    const allDocumentSnapshots: DocumentSnapshot[] = [];
    const allWorkflowSnapshots: WorkflowSnapshot[] = [];
    const allNetworkSnapshots: NetworkSnapshot[] = [];
    const processedAgentIds = new Set<string>();
    const processedSkillIds = new Set<string>();
    const processedDocumentIds = new Set<string>();
    const processedWorkflowIds = new Set<string>();
    const processedNetworkIds = new Set<string>();

    let entryPoint: PlaybookManifest["entryPoint"];

    async function processAgent(agentId: string) {
        if (processedAgentIds.has(agentId)) return;
        processedAgentIds.add(agentId);

        const { agent, skillIds, documentIds } = await snapshotAgent(agentId);
        allAgentSnapshots.push(agent);

        if (opts.includeSkills !== false) {
            for (const skillId of skillIds) {
                await processSkill(skillId);
            }
        }

        if (opts.includeDocuments !== false) {
            for (const docId of documentIds) {
                await processDocument(docId);
            }
        }
    }

    async function processSkill(skillId: string) {
        if (processedSkillIds.has(skillId)) return;
        processedSkillIds.add(skillId);

        const { skill, documentIds } = await snapshotSkill(skillId);
        allSkillSnapshots.push(skill);

        if (opts.includeDocuments !== false) {
            for (const docId of documentIds) {
                await processDocument(docId);
            }
        }
    }

    async function processDocument(documentId: string) {
        if (processedDocumentIds.has(documentId)) return;
        processedDocumentIds.add(documentId);

        const doc = await snapshotDocument(documentId);
        allDocumentSnapshots.push(doc);
    }

    // Process entry point and walk the graph
    if (opts.entryNetworkId) {
        const { network, agentIds, workflowIds } = await snapshotNetwork(opts.entryNetworkId);
        allNetworkSnapshots.push(network);
        processedNetworkIds.add(opts.entryNetworkId);
        entryPoint = { type: "network", slug: network.slug };

        for (const agentId of agentIds) {
            await processAgent(agentId);
        }
        for (const wfId of workflowIds) {
            if (!processedWorkflowIds.has(wfId)) {
                processedWorkflowIds.add(wfId);
                allWorkflowSnapshots.push(await snapshotWorkflow(wfId));
            }
        }
    } else if (opts.entryWorkflowId) {
        processedWorkflowIds.add(opts.entryWorkflowId);
        const wf = await snapshotWorkflow(opts.entryWorkflowId);
        allWorkflowSnapshots.push(wf);
        entryPoint = { type: "workflow", slug: wf.slug };
    } else if (opts.entryAgentId) {
        await processAgent(opts.entryAgentId);
        const agent = allAgentSnapshots.find((a) => processedAgentIds.has(opts.entryAgentId!));
        entryPoint = { type: "agent", slug: agent!.slug };
    } else {
        throw new Error("Must provide entryAgentId, entryNetworkId, or entryWorkflowId");
    }

    // Process additional workflows
    if (opts.includeWorkflows) {
        for (const wfId of opts.includeWorkflows) {
            if (!processedWorkflowIds.has(wfId)) {
                processedWorkflowIds.add(wfId);
                allWorkflowSnapshots.push(await snapshotWorkflow(wfId));
            }
        }
    }

    // Process additional networks
    if (opts.includeNetworks) {
        for (const netId of opts.includeNetworks) {
            if (!processedNetworkIds.has(netId)) {
                const { network, agentIds, workflowIds } = await snapshotNetwork(netId);
                allNetworkSnapshots.push(network);
                processedNetworkIds.add(netId);
                for (const agentId of agentIds) await processAgent(agentId);
                for (const wfId of workflowIds) {
                    if (!processedWorkflowIds.has(wfId)) {
                        processedWorkflowIds.add(wfId);
                        allWorkflowSnapshots.push(await snapshotWorkflow(wfId));
                    }
                }
            }
        }
    }

    // Detect required integrations from tool references
    const requiredIntegrations = new Set<string>();
    for (const agent of allAgentSnapshots) {
        for (const tool of agent.tools) {
            const integration = extractIntegrationFromToolId(tool.toolId);
            if (integration) requiredIntegrations.add(integration);
        }
    }
    for (const skill of allSkillSnapshots) {
        for (const tool of skill.tools) {
            const integration = extractIntegrationFromToolId(tool.toolId);
            if (integration) requiredIntegrations.add(integration);
        }
    }

    // Collect all guardrails, test cases, and scorecards
    const allGuardrails: GuardrailSnapshot[] = allAgentSnapshots
        .filter((a) => a.guardrail)
        .map((a) => a.guardrail!);

    const allTestCases: TestCaseSnapshot[] = allAgentSnapshots.flatMap((a) => a.testCases);
    const allScorecards: ScorecardSnapshot[] = allAgentSnapshots
        .filter((a) => a.scorecard)
        .map((a) => a.scorecard!);

    const rawManifest: PlaybookManifest = {
        version: "1.0",
        agents: allAgentSnapshots,
        skills: allSkillSnapshots,
        documents: allDocumentSnapshots,
        workflows: allWorkflowSnapshots,
        networks: allNetworkSnapshots,
        campaignTemplates: [],
        guardrails: allGuardrails,
        testCases: allTestCases,
        scorecards: allScorecards,
        requiredIntegrations: Array.from(requiredIntegrations),
        entryPoint: entryPoint!
    };

    // Sanitize
    const { manifest: sanitizedManifest, warnings: sanitizeWarnings } = sanitizeManifest(
        rawManifest,
        opts.organizationId
    );

    // Check for hardcoded URLs
    const urlWarnings = detectHardcodedUrls(sanitizedManifest);

    // Validate manifest structure
    const validatedManifest = validateManifest(sanitizedManifest);

    // Generate slug for the playbook
    const slug = opts.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    // Create playbook, components, and first version in a transaction
    const playbook = await prisma.$transaction(async (tx) => {
        const pb = await tx.playbook.create({
            data: {
                slug,
                name: opts.name,
                tagline: opts.tagline ?? null,
                description: opts.description,
                category: opts.category,
                tags: opts.tags ?? [],
                coverImageUrl: opts.coverImageUrl ?? null,
                iconUrl: opts.iconUrl ?? null,
                publisherOrgId: opts.organizationId,
                publishedByUserId: opts.userId,
                pricingModel: opts.pricingModel ?? "FREE",
                priceUsd: opts.priceUsd ?? null,
                monthlyPriceUsd: opts.monthlyPriceUsd ?? null,
                perUsePriceUsd: opts.perUsePriceUsd ?? null,
                requiredIntegrations: Array.from(requiredIntegrations)
            }
        });

        // Create version 1
        await tx.playbookVersion.create({
            data: {
                playbookId: pb.id,
                version: 1,
                manifest: validatedManifest as unknown as Record<string, unknown>,
                createdBy: opts.userId
            }
        });

        // Create component records
        const componentData: Array<{
            playbookId: string;
            componentType: PlaybookComponentType;
            sourceEntityId: string;
            sourceSlug: string;
            configSnapshot: Prisma.InputJsonValue;
            isEntryPoint: boolean;
            sortOrder: number;
        }> = [];

        let sortOrder = 0;
        for (const agent of validatedManifest.agents) {
            componentData.push({
                playbookId: pb.id,
                componentType: "AGENT",
                sourceEntityId: Array.from(processedAgentIds)[sortOrder] ?? agent.slug,
                sourceSlug: agent.slug,
                configSnapshot: { modelProvider: agent.modelProvider, modelName: agent.modelName },
                isEntryPoint: entryPoint!.type === "agent" && entryPoint!.slug === agent.slug,
                sortOrder: sortOrder++
            });
        }
        for (const skill of validatedManifest.skills) {
            componentData.push({
                playbookId: pb.id,
                componentType: "SKILL",
                sourceEntityId:
                    Array.from(processedSkillIds)[
                        componentData.length - allAgentSnapshots.length
                    ] ?? skill.slug,
                sourceSlug: skill.slug,
                configSnapshot: { category: skill.category },
                isEntryPoint: false,
                sortOrder: sortOrder++
            });
        }
        for (const doc of validatedManifest.documents) {
            componentData.push({
                playbookId: pb.id,
                componentType: "DOCUMENT",
                sourceEntityId: doc.slug,
                sourceSlug: doc.slug,
                configSnapshot: { contentType: doc.contentType },
                isEntryPoint: false,
                sortOrder: sortOrder++
            });
        }
        for (const wf of validatedManifest.workflows) {
            componentData.push({
                playbookId: pb.id,
                componentType: "WORKFLOW",
                sourceEntityId: wf.slug,
                sourceSlug: wf.slug,
                configSnapshot: { maxSteps: wf.maxSteps },
                isEntryPoint: entryPoint!.type === "workflow" && entryPoint!.slug === wf.slug,
                sortOrder: sortOrder++
            });
        }
        for (const net of validatedManifest.networks) {
            componentData.push({
                playbookId: pb.id,
                componentType: "NETWORK",
                sourceEntityId: net.slug,
                sourceSlug: net.slug,
                configSnapshot: {
                    modelProvider: net.modelProvider,
                    primitiveCount: net.primitives.length
                },
                isEntryPoint: entryPoint!.type === "network" && entryPoint!.slug === net.slug,
                sortOrder: sortOrder++
            });
        }

        if (componentData.length > 0) {
            await tx.playbookComponent.createMany({ data: componentData });
        }

        return pb;
    });

    return {
        playbook,
        manifest: validatedManifest,
        warnings: [...sanitizeWarnings, ...urlWarnings]
    };
}
