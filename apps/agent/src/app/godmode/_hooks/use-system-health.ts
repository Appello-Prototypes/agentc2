"use client";

import { useCallback, useEffect, useState } from "react";
import { getHealthStatus, type HealthStatus } from "@repo/ui/lib/health";
import { getApiBase } from "@/lib/utils";

interface KindSummary {
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    runningRuns: number;
    successRate: number;
    totalCostUsd: number;
    avgLatencyMs: number;
}

export interface SystemHealthData {
    agents: KindSummary & { perAgent: AgentHealth[] };
    workflows: KindSummary;
    networks: KindSummary;
    grandTotal: {
        allRuns: number;
        allCompleted: number;
        allFailed: number;
        allRunning: number;
    };
    overallHealth: HealthStatus;
    loading: boolean;
}

export interface AgentHealth {
    agentId: string;
    agentName: string;
    agentSlug: string;
    totalRuns: number;
    successRate: number;
    health: HealthStatus;
}

export function useSystemHealth(pollIntervalMs = 30_000): SystemHealthData {
    const [data, setData] = useState<SystemHealthData>({
        agents: {
            totalRuns: 0,
            completedRuns: 0,
            failedRuns: 0,
            runningRuns: 0,
            successRate: 0,
            totalCostUsd: 0,
            avgLatencyMs: 0,
            perAgent: []
        },
        workflows: {
            totalRuns: 0,
            completedRuns: 0,
            failedRuns: 0,
            runningRuns: 0,
            successRate: 0,
            totalCostUsd: 0,
            avgLatencyMs: 0
        },
        networks: {
            totalRuns: 0,
            completedRuns: 0,
            failedRuns: 0,
            runningRuns: 0,
            successRate: 0,
            totalCostUsd: 0,
            avgLatencyMs: 0
        },
        grandTotal: { allRuns: 0, allCompleted: 0, allFailed: 0, allRunning: 0 },
        overallHealth: "healthy",
        loading: true
    });

    const fetchMetrics = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/live/metrics`);
            if (!res.ok) return;

            const json = await res.json();
            if (!json.success) return;

            const perAgent: AgentHealth[] = (json.perAgent ?? []).map(
                (a: {
                    agentId: string;
                    agentName: string;
                    agentSlug: string;
                    totalRuns: number;
                    successRate: number;
                }) => ({
                    agentId: a.agentId,
                    agentName: a.agentName,
                    agentSlug: a.agentSlug,
                    totalRuns: a.totalRuns,
                    successRate: a.successRate,
                    health: getHealthStatus(a.successRate)
                })
            );

            const agentSummary: KindSummary & { perAgent: AgentHealth[] } = {
                totalRuns: json.summary.totalRuns,
                completedRuns: json.summary.completedRuns,
                failedRuns: json.summary.failedRuns,
                runningRuns: json.summary.runningRuns,
                successRate: json.summary.successRate,
                totalCostUsd: json.summary.totalCostUsd ?? 0,
                avgLatencyMs: json.summary.avgLatencyMs ?? 0,
                perAgent
            };

            const wf = json.workflowSummary ?? {};
            const net = json.networkSummary ?? {};

            const allSuccess =
                json.grandTotal.allRuns > 0
                    ? Math.round((json.grandTotal.allCompleted / json.grandTotal.allRuns) * 100)
                    : 100;

            setData({
                agents: agentSummary,
                workflows: {
                    totalRuns: wf.totalRuns ?? 0,
                    completedRuns: wf.completedRuns ?? 0,
                    failedRuns: wf.failedRuns ?? 0,
                    runningRuns: wf.runningRuns ?? 0,
                    successRate: wf.successRate ?? 0,
                    totalCostUsd: wf.totalCostUsd ?? 0,
                    avgLatencyMs: wf.avgLatencyMs ?? 0
                },
                networks: {
                    totalRuns: net.totalRuns ?? 0,
                    completedRuns: net.completedRuns ?? 0,
                    failedRuns: net.failedRuns ?? 0,
                    runningRuns: net.runningRuns ?? 0,
                    successRate: net.successRate ?? 0,
                    totalCostUsd: net.totalCostUsd ?? 0,
                    avgLatencyMs: net.avgLatencyMs ?? 0
                },
                grandTotal: json.grandTotal,
                overallHealth: getHealthStatus(allSuccess),
                loading: false
            });
        } catch {
            // keep previous data on error
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchMetrics();
        const timer = setInterval(fetchMetrics, pollIntervalMs);
        return () => clearInterval(timer);
    }, [fetchMetrics, pollIntervalMs]);

    return data;
}
