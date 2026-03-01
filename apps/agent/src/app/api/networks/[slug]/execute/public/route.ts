import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma, RunStatus } from "@repo/database";
import { buildNetworkAgent } from "@repo/agentc2/networks";
import { refreshNetworkMetrics } from "@/lib/metrics";
import { processNetworkStreamWithSubRuns } from "@/lib/network-stream-processor";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxPerMinute: number): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
        return { allowed: true, remaining: maxPerMinute - 1 };
    }

    if (entry.count >= maxPerMinute) {
        return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: maxPerMinute - entry.count };
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;

        const authHeader = request.headers.get("authorization");
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

        if (!token) {
            return NextResponse.json(
                { success: false, error: "Missing authorization token" },
                { status: 401 }
            );
        }

        const network = await prisma.network.findFirst({
            where: {
                slug,
                visibility: "PUBLIC",
                publicToken: token,
                isActive: true
            },
            include: { workspace: { select: { organizationId: true } } }
        });

        if (!network) {
            return NextResponse.json(
                { success: false, error: "Invalid token or network not public" },
                { status: 403 }
            );
        }

        const metadata = network.metadata as Record<string, unknown> | null;
        const embedConfig = metadata?.publicEmbed as Record<string, unknown> | undefined;
        const rateLimit = (embedConfig?.rateLimit as number) || 20;
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const { allowed, remaining } = checkRateLimit(ip, rateLimit);

        if (!allowed) {
            return NextResponse.json(
                { success: false, error: "Rate limit exceeded" },
                { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
            );
        }

        const body = await request.json();
        const message = body.message || body.input;

        if (!message) {
            return NextResponse.json(
                { success: false, error: "Message is required" },
                { status: 400 }
            );
        }

        const networkOrgId = network.workspace?.organizationId || "";
        const { agent } = await buildNetworkAgent(network.id);

        const threadId = body.threadId
            ? networkOrgId
                ? `${networkOrgId}:embed:${body.threadId}`
                : `embed:${body.threadId}`
            : networkOrgId
              ? `${networkOrgId}:embed:${Date.now()}`
              : `embed:${Date.now()}`;

        const run = await prisma.networkRun.create({
            data: {
                networkId: network.id,
                status: RunStatus.RUNNING,
                inputText: message,
                threadId,
                source: "embed"
            }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (agent as any).network(message, {
            maxSteps: network.maxSteps,
            memory: {
                thread: threadId,
                resource: networkOrgId ? `${networkOrgId}:embed` : "embed"
            }
        });

        const { outputText, outputJson, steps, totalTokens } =
            await processNetworkStreamWithSubRuns(result, {
                networkRunId: run.id,
                networkSlug: network.slug,
                tenantId: networkOrgId || undefined,
                inputMessage: message
            });

        if (steps.length > 0) {
            await prisma.networkRunStep.createMany({
                data: steps.map((step) => ({
                    runId: run.id,
                    stepNumber: step.stepNumber,
                    stepType: step.stepType,
                    primitiveType: step.primitiveType,
                    primitiveId: step.primitiveId,
                    routingDecision: step.routingDecision
                        ? (step.routingDecision as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                    inputJson: step.inputJson
                        ? (step.inputJson as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                    outputJson: step.outputJson
                        ? (step.outputJson as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                    status: step.status,
                    agentRunId: step.agentRunId || undefined
                }))
            });
        }

        const completedAt = new Date();
        const durationMs = completedAt.getTime() - run.createdAt.getTime();

        await prisma.networkRun.update({
            where: { id: run.id },
            data: {
                status: RunStatus.COMPLETED,
                outputText,
                outputJson: outputJson ? (outputJson as Prisma.InputJsonValue) : Prisma.DbNull,
                completedAt,
                durationMs,
                stepsExecuted: steps.length,
                totalTokens: totalTokens > 0 ? totalTokens : undefined
            }
        });
        refreshNetworkMetrics(network.id, new Date()).catch(() => {});

        const response = NextResponse.json({
            success: true,
            runId: run.id,
            outputText,
            outputJson,
            steps: steps.length
        });
        response.headers.set("X-RateLimit-Remaining", String(remaining));

        return response;
    } catch (error) {
        console.error("[Network Public Execute] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Execute failed" },
            { status: 500 }
        );
    }
}
