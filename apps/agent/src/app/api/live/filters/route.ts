import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/live/filters
 *
 * Returns distinct filter values for the Live Runs dashboard.
 *
 * Query Parameters:
 * - runType: Filter values by run type (PROD, TEST, AB, all)
 * - from/to: Date range filter (ISO)
 */
export async function GET(request: NextRequest) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const runType = searchParams.get("runType") || "PROD";
        const from = searchParams.get("from");
        const to = searchParams.get("to");

        const baseWhere: Prisma.AgentRunWhereInput = {
            agent: { workspace: { organizationId: authContext.organizationId } }
        };
        const startedAtFilter: Prisma.DateTimeFilter = {};

        if (runType && runType.toLowerCase() !== "all") {
            baseWhere.runType = runType.toUpperCase() as Prisma.EnumRunTypeFilter;
        }

        if (from) {
            startedAtFilter.gte = new Date(from);
        }

        if (to) {
            startedAtFilter.lte = new Date(to);
        }

        if (Object.keys(startedAtFilter).length > 0) {
            baseWhere.startedAt = startedAtFilter;
        }

        const runTypeWhere: Prisma.AgentRunWhereInput = { ...baseWhere };
        if (runTypeWhere.runType) {
            delete runTypeWhere.runType;
        }

        const [agentIdRows, versionIdRows, sourceRows, modelRows, runTypeRows, toolRows] =
            await Promise.all([
                prisma.agentRun.findMany({
                    where: baseWhere,
                    distinct: ["agentId"],
                    select: { agentId: true }
                }),
                prisma.agentRun.findMany({
                    where: { ...baseWhere, versionId: { not: null } },
                    distinct: ["versionId"],
                    select: { versionId: true }
                }),
                prisma.agentRun.groupBy({
                    by: ["source"],
                    where: { ...baseWhere, source: { not: null } },
                    _count: { _all: true }
                }),
                prisma.agentRun.groupBy({
                    by: ["modelName", "modelProvider"],
                    where: { ...baseWhere, modelName: { not: null } },
                    _count: { _all: true }
                }),
                prisma.agentRun.groupBy({
                    by: ["runType"],
                    where: runTypeWhere,
                    _count: { _all: true }
                }),
                prisma.agentToolCall.findMany({
                    where: { run: baseWhere },
                    distinct: ["toolKey"],
                    select: { toolKey: true }
                })
            ]);

        const agentIds = agentIdRows.map((row) => row.agentId);
        const versionIds = versionIdRows
            .map((row) => row.versionId)
            .filter((id): id is string => Boolean(id));

        const [agents, versions] = await Promise.all([
            agentIds.length > 0
                ? prisma.agent.findMany({
                      where: { id: { in: agentIds } },
                      select: {
                          id: true,
                          slug: true,
                          name: true,
                          isActive: true,
                          version: true
                      }
                  })
                : Promise.resolve([]),
            versionIds.length > 0
                ? prisma.agentVersion.findMany({
                      where: { id: { in: versionIds } },
                      select: {
                          id: true,
                          agentId: true,
                          version: true,
                          modelProvider: true,
                          modelName: true,
                          createdAt: true
                      }
                  })
                : Promise.resolve([])
        ]);

        // Workflow filter options
        const workflows = await prisma.workflow.findMany({
            where: { workspace: { organizationId: authContext.organizationId } },
            select: { id: true, slug: true, name: true },
            orderBy: { name: "asc" }
        });

        // Network filter options
        const networks = await prisma.network.findMany({
            where: { workspace: { organizationId: authContext.organizationId } },
            select: { id: true, slug: true, name: true },
            orderBy: { name: "asc" }
        });

        return NextResponse.json({
            success: true,
            filters: {
                agents,
                workflows,
                networks,
                versions,
                sources: sourceRows.map((row) => ({
                    source: row.source,
                    count: row._count._all
                })),
                models: modelRows.map((row) => ({
                    modelName: row.modelName,
                    modelProvider: row.modelProvider,
                    count: row._count._all
                })),
                tools: toolRows.map((row) => row.toolKey),
                runTypes: runTypeRows.map((row) => ({
                    runType: row.runType,
                    count: row._count._all
                })),
                kinds: [
                    { kind: "agent", label: "Agent" },
                    { kind: "workflow", label: "Workflow" },
                    { kind: "network", label: "Network" }
                ]
            }
        });
    } catch (error) {
        console.error("[Live Filters] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch live filters" },
            { status: 500 }
        );
    }
}
