import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

interface TopologyNode {
    id: string;
    name: string;
    type: string;
    isGate: boolean;
}

interface TopologyEdge {
    from: string;
    to: string;
}

interface WorkflowTopology {
    slug: string;
    name: string;
    nodes: TopologyNode[];
    edges: TopologyEdge[];
    activeRunCount: number;
}

const GATE_PATTERNS = ["suspend", "human", "approval", "review", "gate"];

function isGateNode(node: { type?: string; data?: Record<string, unknown> }): boolean {
    const typeStr = (node.type || "").toLowerCase();
    const label = String(node.data?.label || node.data?.name || "").toLowerCase();
    return GATE_PATTERNS.some((p) => typeStr.includes(p) || label.includes(p));
}

/**
 * GET /api/workflows/topology
 *
 * Returns the step graph topology for active workflows with active run counts.
 */
export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const workflows = await prisma.workflow.findMany({
            where: {
                workspace: { organizationId: authContext.organizationId },
                isActive: true,
                isArchived: false
            },
            select: {
                id: true,
                slug: true,
                name: true,
                definitionJson: true,
                _count: {
                    select: {
                        runs: {
                            where: {
                                status: { in: ["RUNNING", "QUEUED"] }
                            }
                        }
                    }
                }
            }
        });

        const result: WorkflowTopology[] = [];

        for (const wf of workflows) {
            const def = wf.definitionJson as { nodes?: unknown[]; edges?: unknown[] } | null;
            if (!def || !Array.isArray(def.nodes)) continue;

            const nodes: TopologyNode[] = (
                def.nodes as { id: string; type?: string; data?: Record<string, unknown> }[]
            ).map((n) => ({
                id: n.id,
                name: String(n.data?.label || n.data?.name || n.id),
                type: n.type || "step",
                isGate: isGateNode(n)
            }));

            const edges: TopologyEdge[] = Array.isArray(def.edges)
                ? (def.edges as { source: string; target: string }[]).map((e) => ({
                      from: e.source,
                      to: e.target
                  }))
                : [];

            result.push({
                slug: wf.slug,
                name: wf.name,
                nodes,
                edges,
                activeRunCount: wf._count.runs
            });
        }

        return NextResponse.json({ success: true, workflows: result });
    } catch (error) {
        console.error("[topology] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch topology" },
            { status: 500 }
        );
    }
}
