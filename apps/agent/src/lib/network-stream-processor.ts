/**
 * App-level network stream processor wrapper.
 * Adds agent sub-run recording on top of the core stream processor from @repo/agentc2.
 */

import { prisma } from "@repo/database";
import {
    processNetworkStream as coreProcess,
    type NetworkCapturedStep,
    type NetworkStreamResult,
    type StreamProcessorOptions
} from "@repo/agentc2/networks";
import { startRun } from "./run-recorder";

export type { NetworkCapturedStep, NetworkStreamResult, StreamProcessorOptions };
export { coreProcess as processNetworkStream };

export interface AgentSubRunOptions {
    networkRunId: string;
    networkSlug: string;
    tenantId?: string;
    inputMessage: string;
}

/**
 * Process a network stream AND record agent sub-runs for agent-type steps.
 * Returns the stream result with agentRunId populated on agent steps.
 */
export async function processNetworkStreamWithSubRuns(
    stream: AsyncIterable<unknown>,
    subRunOptions: AgentSubRunOptions,
    streamOptions?: StreamProcessorOptions
): Promise<NetworkStreamResult> {
    const result = await coreProcess(stream, streamOptions);

    const stepAgentRunIds = new Map<number, string>();
    for (const step of result.steps) {
        if (step.stepType === "agent" && step.primitiveId) {
            try {
                const agentRecord = await prisma.agent.findFirst({
                    where: { OR: [{ id: step.primitiveId }, { slug: step.primitiveId }] },
                    select: { id: true, slug: true }
                });
                if (agentRecord) {
                    const inputStr =
                        step.inputJson && typeof step.inputJson === "object"
                            ? JSON.stringify(step.inputJson).slice(0, 2000)
                            : subRunOptions.inputMessage.slice(0, 2000);
                    const handle = await startRun({
                        agentId: agentRecord.id,
                        agentSlug: agentRecord.slug,
                        input: inputStr,
                        source: "network",
                        tenantId: subRunOptions.tenantId,
                        metadata: {
                            networkRunId: subRunOptions.networkRunId,
                            networkSlug: subRunOptions.networkSlug
                        }
                    });
                    const outputStr =
                        step.outputJson && typeof step.outputJson === "object"
                            ? JSON.stringify(step.outputJson).slice(0, 5000)
                            : "";
                    await handle.complete({ output: outputStr });
                    stepAgentRunIds.set(step.stepNumber, handle.runId);
                    step.agentRunId = handle.runId;
                }
            } catch (err) {
                console.warn(
                    `[Network Stream] Failed to create agent sub-run for step ${step.stepNumber}:`,
                    err
                );
            }
        }
    }

    return result;
}
