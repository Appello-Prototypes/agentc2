import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/integrations/providers/[providerKey]/used-by
 *
 * Returns agents, skills, and playbook installations that reference tools from this provider.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ providerKey: string }> }
) {
    try {
        const authContext = await authenticateRequest(request as NextRequest);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
        const organizationId = authContext.organizationId;

        const { providerKey } = await params;
        const prefix = `${providerKey}_`;

        // Agents using tools from this provider
        const agentTools = await prisma.agentTool.findMany({
            where: {
                toolId: { startsWith: prefix },
                agent: { workspaceId: organizationId }
            },
            include: {
                agent: { select: { id: true, name: true, slug: true } }
            }
        });

        const agentMap = new Map<
            string,
            { id: string; name: string; slug: string; toolIds: string[] }
        >();
        for (const at of agentTools) {
            const existing = agentMap.get(at.agent.id);
            if (existing) {
                existing.toolIds.push(at.toolId);
            } else {
                agentMap.set(at.agent.id, {
                    id: at.agent.id,
                    name: at.agent.name,
                    slug: at.agent.slug,
                    toolIds: [at.toolId]
                });
            }
        }

        // Skills using tools from this provider
        const skillTools = await prisma.skillTool.findMany({
            where: {
                toolId: { startsWith: prefix },
                skill: { workspaceId: organizationId }
            },
            include: {
                skill: { select: { id: true, name: true, slug: true } }
            }
        });

        const skillMap = new Map<
            string,
            { id: string; name: string; slug: string; toolIds: string[] }
        >();
        for (const st of skillTools) {
            const existing = skillMap.get(st.skill.id);
            if (existing) {
                existing.toolIds.push(st.toolId);
            } else {
                skillMap.set(st.skill.id, {
                    id: st.skill.id,
                    name: st.skill.name,
                    slug: st.skill.slug,
                    toolIds: [st.toolId]
                });
            }
        }

        // Playbook installations that require this provider
        const playbookInstallations = await prisma.playbookInstallation.findMany({
            where: {
                targetOrgId: organizationId,
                status: { not: "UNINSTALLED" }
            },
            include: {
                playbook: {
                    select: { id: true, name: true, slug: true, requiredIntegrations: true }
                }
            }
        });

        const playbookItems = playbookInstallations
            .filter((pi) => {
                const reqs = pi.playbook.requiredIntegrations;
                return Array.isArray(reqs) && reqs.includes(providerKey);
            })
            .map((pi) => ({
                type: "playbook" as const,
                id: pi.playbook.id,
                name: pi.playbook.name,
                slug: pi.playbook.slug,
                toolIds: [] as string[]
            }));

        const items = [
            ...Array.from(agentMap.values()).map((a) => ({ type: "agent" as const, ...a })),
            ...Array.from(skillMap.values()).map((s) => ({ type: "skill" as const, ...s })),
            ...playbookItems
        ];

        return NextResponse.json({
            success: true,
            providerKey,
            items,
            summary: {
                agents: agentMap.size,
                skills: skillMap.size,
                playbooks: playbookItems.length
            }
        });
    } catch (error) {
        console.error("[Integrations Providers] Used-by error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get used-by data"
            },
            { status: 500 }
        );
    }
}
