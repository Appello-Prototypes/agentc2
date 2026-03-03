/**
 * Live Database Tenant Isolation Tests
 *
 * These tests run against the REAL database to prove that Prisma queries
 * correctly isolate data between organizations. They are skipped if the
 * database is not accessible.
 *
 * Run explicitly:  bunx vitest run tests/integration/api/tenant-isolation-live.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../../../.env"), override: true });

import { PrismaClient } from "@repo/database";

const TEST_PREFIX = "__iso_test_";
const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL
});

let canConnect = false;
try {
    await prisma.$queryRaw`SELECT 1`;
    canConnect = true;
} catch {
    console.warn("Skipping live DB tests: database not accessible");
}

let orgAlphaId: string;
let orgBetaId: string;
let userAlphaId: string;
let userBetaId: string;
let userBothId: string;
let wsAlphaId: string;
let wsBetaId: string;
let agentAlphaId: string;
let agentBetaId: string;
let docAlphaId: string;
let docBetaId: string;

async function seedTestData() {
    const orgAlpha = await prisma.organization.create({
        data: {
            name: `${TEST_PREFIX}Alpha Corp`,
            slug: `${TEST_PREFIX}alpha`
        }
    });
    const orgBeta = await prisma.organization.create({
        data: {
            name: `${TEST_PREFIX}Beta Corp`,
            slug: `${TEST_PREFIX}beta`
        }
    });
    orgAlphaId = orgAlpha.id;
    orgBetaId = orgBeta.id;

    const uAlpha = await prisma.user.create({
        data: {
            name: `${TEST_PREFIX}Alpha User`,
            email: `${TEST_PREFIX}alpha@test.local`
        }
    });
    const uBeta = await prisma.user.create({
        data: {
            name: `${TEST_PREFIX}Beta User`,
            email: `${TEST_PREFIX}beta@test.local`
        }
    });
    const uBoth = await prisma.user.create({
        data: {
            name: `${TEST_PREFIX}Both User`,
            email: `${TEST_PREFIX}both@test.local`
        }
    });
    userAlphaId = uAlpha.id;
    userBetaId = uBeta.id;
    userBothId = uBoth.id;

    await prisma.membership.createMany({
        data: [
            { userId: userAlphaId, organizationId: orgAlphaId, role: "owner" },
            { userId: userBetaId, organizationId: orgBetaId, role: "owner" },
            { userId: userBothId, organizationId: orgAlphaId, role: "member" },
            { userId: userBothId, organizationId: orgBetaId, role: "member" }
        ]
    });

    const wsA = await prisma.workspace.create({
        data: {
            organizationId: orgAlphaId,
            name: `${TEST_PREFIX}Alpha WS`,
            slug: `${TEST_PREFIX}alpha-ws`,
            isDefault: true
        }
    });
    const wsB = await prisma.workspace.create({
        data: {
            organizationId: orgBetaId,
            name: `${TEST_PREFIX}Beta WS`,
            slug: `${TEST_PREFIX}beta-ws`,
            isDefault: true
        }
    });
    wsAlphaId = wsA.id;
    wsBetaId = wsB.id;

    const aA = await prisma.agent.create({
        data: {
            slug: `${TEST_PREFIX}alpha-agent`,
            name: `${TEST_PREFIX}Alpha Agent`,
            instructions: "test agent alpha",
            modelProvider: "openai",
            modelName: "gpt-4o",
            workspaceId: wsAlphaId,
            ownerId: userAlphaId
        }
    });
    const aB = await prisma.agent.create({
        data: {
            slug: `${TEST_PREFIX}beta-agent`,
            name: `${TEST_PREFIX}Beta Agent`,
            instructions: "test agent beta",
            modelProvider: "openai",
            modelName: "gpt-4o",
            workspaceId: wsBetaId,
            ownerId: userBetaId
        }
    });
    agentAlphaId = aA.id;
    agentBetaId = aB.id;

    const dA = await prisma.document.create({
        data: {
            slug: `${TEST_PREFIX}alpha-doc`,
            name: `${TEST_PREFIX}Alpha Doc`,
            content: "Alpha secret content",
            organizationId: orgAlphaId,
            workspaceId: wsAlphaId
        }
    });
    const dB = await prisma.document.create({
        data: {
            slug: `${TEST_PREFIX}beta-doc`,
            name: `${TEST_PREFIX}Beta Doc`,
            content: "Beta secret content",
            organizationId: orgBetaId,
            workspaceId: wsBetaId
        }
    });
    docAlphaId = dA.id;
    docBetaId = dB.id;
}

async function cleanupTestData() {
    await prisma.document.deleteMany({
        where: { slug: { startsWith: TEST_PREFIX } }
    });
    await prisma.agent.deleteMany({
        where: { slug: { startsWith: TEST_PREFIX } }
    });
    await prisma.workspace.deleteMany({
        where: { slug: { startsWith: TEST_PREFIX } }
    });
    await prisma.membership.deleteMany({
        where: { organization: { slug: { startsWith: TEST_PREFIX } } }
    });
    await prisma.user.deleteMany({
        where: { email: { startsWith: TEST_PREFIX } }
    });
    await prisma.organization.deleteMany({
        where: { slug: { startsWith: TEST_PREFIX } }
    });
}

beforeAll(async () => {
    if (!canConnect) return;
    await cleanupTestData();
    await seedTestData();
});

afterAll(async () => {
    if (canConnect) {
        await cleanupTestData();
    }
    await prisma.$disconnect();
});

describe("Live DB: Cross-Org Data Isolation", () => {
    // ─── Agent isolation ────────────────────────────────────────────

    describe("Agent isolation", () => {
        it.skipIf(!canConnect)(
            "agents scoped to Org Alpha do not include Org Beta agents",
            async () => {
                const agents = await prisma.agent.findMany({
                    where: {
                        workspace: { organizationId: orgAlphaId },
                        slug: { startsWith: TEST_PREFIX }
                    }
                });

                expect(agents.length).toBe(1);
                expect(agents[0]!.id).toBe(agentAlphaId);
                expect(agents.some((a) => a.id === agentBetaId)).toBe(false);
            }
        );

        it.skipIf(!canConnect)(
            "agents scoped to Org Beta do not include Org Alpha agents",
            async () => {
                const agents = await prisma.agent.findMany({
                    where: {
                        workspace: { organizationId: orgBetaId },
                        slug: { startsWith: TEST_PREFIX }
                    }
                });

                expect(agents.length).toBe(1);
                expect(agents[0]!.id).toBe(agentBetaId);
                expect(agents.some((a) => a.id === agentAlphaId)).toBe(false);
            }
        );

        it.skipIf(!canConnect)(
            "resolving Beta agent slug with Alpha org filter returns nothing",
            async () => {
                const agent = await prisma.agent.findFirst({
                    where: {
                        slug: `${TEST_PREFIX}beta-agent`,
                        workspace: { organizationId: orgAlphaId }
                    }
                });

                expect(agent).toBeNull();
            }
        );
    });

    // ─── Document isolation ─────────────────────────────────────────

    describe("Document isolation", () => {
        it.skipIf(!canConnect)(
            "documents scoped to Org Alpha do not include Org Beta docs",
            async () => {
                const docs = await prisma.document.findMany({
                    where: {
                        organizationId: orgAlphaId,
                        slug: { startsWith: TEST_PREFIX }
                    }
                });

                expect(docs.length).toBe(1);
                expect(docs[0]!.id).toBe(docAlphaId);
                expect(docs.some((d) => d.id === docBetaId)).toBe(false);
            }
        );

        it.skipIf(!canConnect)("getDocument with wrong org returns null", async () => {
            const doc = await prisma.document.findFirst({
                where: {
                    OR: [{ id: docBetaId }, { slug: `${TEST_PREFIX}beta-doc` }],
                    organizationId: orgAlphaId
                }
            });

            expect(doc).toBeNull();
        });

        it.skipIf(!canConnect)("getDocument with correct org returns the document", async () => {
            const doc = await prisma.document.findFirst({
                where: {
                    OR: [{ id: docAlphaId }, { slug: `${TEST_PREFIX}alpha-doc` }],
                    organizationId: orgAlphaId
                }
            });

            expect(doc).not.toBeNull();
            expect(doc!.id).toBe(docAlphaId);
        });
    });

    // ─── Workspace isolation ────────────────────────────────────────

    describe("Workspace isolation", () => {
        it.skipIf(!canConnect)(
            "workspaces for Org Alpha do not include Org Beta workspaces",
            async () => {
                const workspaces = await prisma.workspace.findMany({
                    where: {
                        organizationId: orgAlphaId,
                        slug: { startsWith: TEST_PREFIX }
                    }
                });

                expect(workspaces.length).toBe(1);
                expect(workspaces[0]!.id).toBe(wsAlphaId);
            }
        );
    });

    // ─── Multi-org user membership resolution ───────────────────────

    describe("Multi-org user membership resolution", () => {
        it.skipIf(!canConnect)(
            "user with memberships in both orgs can be verified for Alpha",
            async () => {
                const membership = await prisma.membership.findUnique({
                    where: {
                        userId_organizationId: {
                            userId: userBothId,
                            organizationId: orgAlphaId
                        }
                    }
                });

                expect(membership).not.toBeNull();
                expect(membership!.organizationId).toBe(orgAlphaId);
            }
        );

        it.skipIf(!canConnect)(
            "user with memberships in both orgs can be verified for Beta",
            async () => {
                const membership = await prisma.membership.findUnique({
                    where: {
                        userId_organizationId: {
                            userId: userBothId,
                            organizationId: orgBetaId
                        }
                    }
                });

                expect(membership).not.toBeNull();
                expect(membership!.organizationId).toBe(orgBetaId);
            }
        );

        it.skipIf(!canConnect)("Alpha-only user has no membership in Beta", async () => {
            const membership = await prisma.membership.findUnique({
                where: {
                    userId_organizationId: {
                        userId: userAlphaId,
                        organizationId: orgBetaId
                    }
                }
            });

            expect(membership).toBeNull();
        });

        it.skipIf(!canConnect)(
            "default workspace for multi-org user respects org selection",
            async () => {
                const wsForAlpha = await prisma.workspace.findFirst({
                    where: { organizationId: orgAlphaId, isDefault: true },
                    orderBy: { createdAt: "asc" }
                });

                const wsForBeta = await prisma.workspace.findFirst({
                    where: { organizationId: orgBetaId, isDefault: true },
                    orderBy: { createdAt: "asc" }
                });

                expect(wsForAlpha!.id).toBe(wsAlphaId);
                expect(wsForBeta!.id).toBe(wsBetaId);
                expect(wsForAlpha!.id).not.toBe(wsForBeta!.id);
            }
        );
    });

    // ─── Cross-org agent access via workspace scoping ───────────────

    describe("Cross-org agent access prevention", () => {
        it.skipIf(!canConnect)(
            "querying agent by ID with wrong org workspace returns nothing",
            async () => {
                const agent = await prisma.agent.findFirst({
                    where: {
                        id: agentBetaId,
                        workspace: { organizationId: orgAlphaId }
                    }
                });

                expect(agent).toBeNull();
            }
        );

        it.skipIf(!canConnect)(
            "querying agent by ID with correct org workspace returns the agent",
            async () => {
                const agent = await prisma.agent.findFirst({
                    where: {
                        id: agentBetaId,
                        workspace: { organizationId: orgBetaId }
                    }
                });

                expect(agent).not.toBeNull();
                expect(agent!.id).toBe(agentBetaId);
            }
        );
    });
});
