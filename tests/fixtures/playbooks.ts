import { faker } from "@faker-js/faker";

export const mockOrganization = {
    id: "org-publisher-uuid",
    name: "Publisher Org",
    slug: "publisher-org",
    status: "active",
    stripeConnectAccountId: null,
    stripeConnectStatus: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01")
};

export const mockBuyerOrg = {
    id: "org-buyer-uuid",
    name: "Buyer Org",
    slug: "buyer-org",
    status: "active",
    stripeConnectAccountId: null,
    stripeConnectStatus: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01")
};

export const mockWorkspace = {
    id: "workspace-publisher-uuid",
    organizationId: "org-publisher-uuid",
    name: "Default",
    slug: "default",
    isDefault: true,
    environment: "production",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01")
};

export const mockBuyerWorkspace = {
    id: "workspace-buyer-uuid",
    organizationId: "org-buyer-uuid",
    name: "Default",
    slug: "default",
    isDefault: true,
    environment: "production",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01")
};

export const mockPlaybook = {
    id: "playbook-uuid",
    slug: "customer-support-network",
    name: "Customer Support Network",
    tagline: "Multi-agent support with smart routing",
    description: "A 3-agent customer support network with router, FAQ, and escalation.",
    longDescription: null,
    category: "support",
    tags: ["support", "customer-service", "multi-agent"],
    coverImageUrl: null,
    iconUrl: null,
    publisherOrgId: "org-publisher-uuid",
    publishedByUserId: "test-user-id",
    status: "DRAFT" as const,
    pricingModel: "FREE" as const,
    priceUsd: null,
    monthlyPriceUsd: null,
    perUsePriceUsd: null,
    installCount: 0,
    averageRating: null,
    reviewCount: 0,
    trustScore: null,
    requiredIntegrations: [] as string[],
    version: 1,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01")
};

export const mockPublishedPlaybook = {
    ...mockPlaybook,
    id: "playbook-published-uuid",
    slug: "published-support-network",
    status: "PUBLISHED" as const,
    installCount: 5,
    averageRating: 4.5,
    reviewCount: 3,
    trustScore: 85.2
};

export const mockPaidPlaybook = {
    ...mockPublishedPlaybook,
    id: "playbook-paid-uuid",
    slug: "paid-support-network",
    pricingModel: "ONE_TIME" as const,
    priceUsd: 1.0
};

export const mockPlaybookVersion = {
    id: "version-uuid",
    playbookId: "playbook-uuid",
    version: 1,
    manifest: {
        version: "1.0",
        agents: [
            {
                slug: "support-router",
                name: "Router Agent",
                instructions: "Route customer inquiries.",
                modelProvider: "anthropic",
                modelName: "claude-sonnet-4-20250514",
                temperature: 0.3,
                tools: [],
                guardrails: { input: { filters: [] }, output: { filters: [] } }
            }
        ],
        skills: [],
        documents: [],
        workflows: [],
        networks: [
            {
                slug: "customer-support-network",
                name: "Customer Support Network",
                topologyJson: {
                    nodes: [{ id: "router", type: "agent", agentSlug: "support-router" }],
                    edges: []
                }
            }
        ],
        guardrails: [],
        testCases: [],
        scorecards: [],
        requiredIntegrations: [],
        entryPoint: { type: "network" as const, slug: "customer-support-network" }
    },
    changelog: "Initial version",
    createdAt: new Date("2024-01-01"),
    createdBy: "test-user-id"
};

export const mockPlaybookComponent = {
    id: "component-uuid",
    playbookId: "playbook-uuid",
    componentType: "AGENT" as const,
    sourceEntityId: "agent-router-uuid",
    sourceSlug: "support-router",
    configSnapshot: {},
    isEntryPoint: false,
    sortOrder: 0
};

export const mockPlaybookPurchase = {
    id: "purchase-uuid",
    playbookId: "playbook-published-uuid",
    buyerOrgId: "org-buyer-uuid",
    buyerUserId: "buyer-user-id",
    status: "COMPLETED" as const,
    pricingModel: "FREE" as const,
    amountUsd: 0,
    platformFeeUsd: 0,
    sellerPayoutUsd: 0,
    stripePaymentIntentId: null,
    stripeSubscriptionId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01")
};

export const mockPlaybookInstallation = {
    id: "installation-uuid",
    playbookId: "playbook-published-uuid",
    purchaseId: "purchase-uuid",
    targetOrgId: "org-buyer-uuid",
    targetWorkspaceId: "workspace-buyer-uuid",
    installedByUserId: "buyer-user-id",
    versionInstalled: 1,
    status: "ACTIVE" as const,
    createdAgentIds: ["deployed-agent-1", "deployed-agent-2", "deployed-agent-3"],
    createdSkillIds: ["deployed-skill-1"],
    createdDocumentIds: ["deployed-doc-1", "deployed-doc-2"],
    createdWorkflowIds: [] as string[],
    createdNetworkIds: ["deployed-network-1"],
    customizations: null,
    testResults: { passed: 5, failed: 0, total: 5 },
    integrationStatus: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01")
};

export const mockPlaybookReview = {
    id: "review-uuid",
    playbookId: "playbook-published-uuid",
    reviewerOrgId: "org-buyer-uuid",
    reviewerUserId: "buyer-user-id",
    rating: 5,
    title: "Works great",
    body: "Deployed in minutes and handled our support tickets immediately.",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01")
};

export function generatePlaybook(overrides: Partial<typeof mockPlaybook> = {}) {
    return {
        ...mockPlaybook,
        id: faker.string.uuid(),
        slug: faker.helpers.slugify(faker.lorem.words(3)).toLowerCase(),
        name: faker.lorem.words(3),
        description: faker.lorem.sentence(),
        category: faker.helpers.arrayElement(["support", "sales", "marketing", "operations"]),
        tags: [faker.lorem.word(), faker.lorem.word()],
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent(),
        ...overrides
    };
}

export function generatePlaybooks(count: number, overrides: Partial<typeof mockPlaybook> = {}) {
    return Array.from({ length: count }, () => generatePlaybook(overrides));
}

export function generateReview(overrides: Partial<typeof mockPlaybookReview> = {}) {
    return {
        ...mockPlaybookReview,
        id: faker.string.uuid(),
        rating: faker.number.int({ min: 1, max: 5 }),
        title: faker.lorem.sentence(),
        body: faker.lorem.paragraph(),
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent(),
        ...overrides
    };
}
