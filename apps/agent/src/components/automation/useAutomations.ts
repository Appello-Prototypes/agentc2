"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiBase } from "@/lib/utils";
import type { AgentOption, Automation, AutomationSummary } from "./types";

interface UseAutomationsOpts {
    primitiveType?: string;
    entityId?: string;
    entitySlug?: string;
    includeArchived?: boolean;
    pollIntervalMs?: number;
}

interface UseAutomationsReturn {
    automations: Automation[];
    summary: AutomationSummary | null;
    agents: AgentOption[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
    setAutomations: React.Dispatch<React.SetStateAction<Automation[]>>;
    setSummary: React.Dispatch<React.SetStateAction<AutomationSummary | null>>;
}

export function useAutomations(opts?: UseAutomationsOpts): UseAutomationsReturn {
    const apiBase = getApiBase();
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [summary, setSummary] = useState<AutomationSummary | null>(null);
    const [agents, setAgents] = useState<AgentOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAutomations = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (opts?.includeArchived) params.set("includeArchived", "true");
            if (opts?.primitiveType) params.set("primitiveType", opts.primitiveType);
            if (opts?.entityId) params.set("entityId", opts.entityId);
            if (opts?.entitySlug) params.set("entitySlug", opts.entitySlug);
            const qs = params.toString();
            const url = `${apiBase}/api/live/automations${qs ? `?${qs}` : ""}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setAutomations(data.automations || []);
                setSummary(data.summary || null);
            } else {
                setError(data.error || "Failed to load automations");
            }
        } catch (fetchError) {
            setError(
                fetchError instanceof Error ? fetchError.message : "Failed to load automations"
            );
        } finally {
            setLoading(false);
        }
    }, [apiBase, opts?.includeArchived, opts?.primitiveType, opts?.entityId, opts?.entitySlug]);

    const fetchAgents = useCallback(async () => {
        try {
            const res = await fetch(`${apiBase}/api/agents`);
            const data = await res.json();
            if (data.success) {
                setAgents(
                    (data.agents || []).map((a: AgentOption) => ({
                        id: a.id,
                        slug: a.slug,
                        name: a.name
                    }))
                );
            }
        } catch {
            /* silently handle */
        }
    }, [apiBase]);

    useEffect(() => {
        fetchAutomations();
    }, [fetchAutomations]);

    useEffect(() => {
        fetchAgents();
    }, [fetchAgents]);

    useEffect(() => {
        const interval = setInterval(fetchAutomations, opts?.pollIntervalMs ?? 30000);
        return () => clearInterval(interval);
    }, [fetchAutomations, opts?.pollIntervalMs]);

    const refetch = useCallback(() => {
        setLoading(true);
        fetchAutomations();
    }, [fetchAutomations]);

    return {
        automations,
        summary,
        agents,
        loading,
        error,
        refetch,
        setAutomations,
        setSummary
    };
}
