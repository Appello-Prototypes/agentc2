/**
 * A2A-compatible Agent Card generation.
 *
 * Generates discoverable Agent Cards for agents exposed through federation.
 * Compatible with Google's A2A protocol specification.
 */

import { prisma } from "@repo/database";
import type { AgentCard, AgentCardSkill } from "./types";

const PLATFORM_URL = process.env.NEXT_PUBLIC_APP_URL || "https://agentc2.ai";

/**
 * Generate Agent Cards for all agents a partner org has exposed to the requesting org.
 */
export async function getExposedAgentCards(
    agreementId: string,
    requestingOrgId: string
): Promise<AgentCard[]> {
    const agreement = await prisma.federationAgreement.findUnique({
        where: { id: agreementId },
        select: {
            id: true,
            status: true,
            initiatorOrgId: true,
            responderOrgId: true,
            dataClassification: true,
            maxRequestsPerHour: true,
            exposures: {
                where: {
                    enabled: true,
                    ownerOrgId: { not: requestingOrgId }
                },
                include: {
                    agent: {
                        select: {
                            id: true,
                            slug: true,
                            name: true,
                            description: true,
                            tools: { select: { toolId: true } }
                        }
                    },
                    ownerOrg: {
                        select: { id: true, name: true, slug: true }
                    }
                }
            }
        }
    });

    if (!agreement || agreement.status !== "active") return [];

    return agreement.exposures.map((exposure: Parameters<typeof buildAgentCard>[0]) =>
        buildAgentCard(exposure, agreement.dataClassification, agreement.maxRequestsPerHour)
    );
}

/**
 * Generate a single Agent Card for a specific exposure.
 */
function buildAgentCard(
    exposure: {
        id: string;
        exposedSkills: string[];
        accessSummary: string | null;
        maxRequestsPerHour: number | null;
        agent: {
            id: string;
            slug: string;
            name: string;
            description: string | null;
            tools: { toolId: string }[];
        };
        ownerOrg: { id: string; name: string; slug: string };
    },
    dataClassification: string,
    defaultRateLimit: number
): AgentCard {
    const skills: AgentCardSkill[] = exposure.agent.tools
        .filter(
            (t) => exposure.exposedSkills.length === 0 || exposure.exposedSkills.includes(t.toolId)
        )
        .map((t) => ({
            id: t.toolId,
            name: t.toolId,
            description: `Tool: ${t.toolId}`,
            tags: [],
            inputModes: ["text"],
            outputModes: ["text", "application/json"]
        }));

    return {
        name: exposure.agent.name,
        description: exposure.agent.description,
        provider: {
            organization: exposure.ownerOrg.name,
            orgSlug: exposure.ownerOrg.slug,
            platform: "AgentC2",
            url: PLATFORM_URL
        },
        url: `${PLATFORM_URL}/agent/api/federation/invoke`,
        version: "1.0.0",
        capabilities: {
            streaming: false,
            pushNotifications: false,
            stateTransitionHistory: true
        },
        authentication: {
            schemes: ["AgentC2-Federation"],
            federationAgreementRequired: true
        },
        skills,
        agentc2: {
            agentSlug: exposure.agent.slug,
            agentId: exposure.agent.id,
            exposureId: exposure.id,
            exposedSkills: exposure.exposedSkills,
            dataClassification,
            rateLimit: {
                requestsPerHour: exposure.maxRequestsPerHour ?? defaultRateLimit
            }
        }
    };
}

/**
 * Discover all agents available to an org through its active federation agreements.
 * Returns a flat list of Agent Cards from all connected partner orgs.
 */
export async function discoverFederatedAgents(orgId: string): Promise<AgentCard[]> {
    const agreements = await prisma.federationAgreement.findMany({
        where: {
            OR: [{ initiatorOrgId: orgId }, { responderOrgId: orgId }],
            status: "active"
        },
        select: { id: true }
    });

    const cardPromises = agreements.map((a: { id: string }) => getExposedAgentCards(a.id, orgId));
    const cardArrays = await Promise.all(cardPromises);
    return cardArrays.flat();
}
