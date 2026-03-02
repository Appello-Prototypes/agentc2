"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiBase } from "@/lib/utils";
import type { ActivityEvent, FeedMetrics, GroupedEventsResponse } from "../_lib/types";
import { POLL_INTERVAL_MS } from "../_lib/constants";

export function useActivityFeed({
    selectedAgent,
    typeFilter,
    searchQuery,
    grouped = false
}: {
    selectedAgent: string | null;
    typeFilter: string;
    searchQuery: string;
    grouped?: boolean;
}) {
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [groupedEvents, setGroupedEvents] = useState<GroupedEventsResponse | null>(null);
    const [metrics, setMetrics] = useState<FeedMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [isLive, setIsLive] = useState(true);
    const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
    const lastTimestampRef = useRef<string | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const initialLoadRef = useRef(true);

    const fetchEvents = useCallback(
        async (opts?: { since?: string; append?: boolean }) => {
            try {
                const params = new URLSearchParams();
                params.set("limit", "50");
                if (opts?.since) params.set("since", opts.since);
                if (selectedAgent) params.set("agentSlug", selectedAgent);
                if (typeFilter !== "all") params.set("type", typeFilter);
                if (searchQuery) params.set("search", searchQuery);
                if (grouped) params.set("grouped", "true");

                const res = await fetch(`${getApiBase()}/api/activity?${params.toString()}`);
                if (!res.ok) return;

                const data = await res.json();
                if (!data.success) return;

                if (grouped && data.groupedEvents) {
                    setGroupedEvents(data.groupedEvents as GroupedEventsResponse);
                    const allEvents = [
                        ...(data.groupedEvents.groups || []).flatMap(
                            (g: { events: ActivityEvent[] }) => g.events
                        ),
                        ...(data.groupedEvents.ungrouped || [])
                    ] as ActivityEvent[];
                    setEvents(allEvents);
                    if (allEvents.length > 0) {
                        lastTimestampRef.current = allEvents[0]!.timestamp;
                    }
                } else {
                    const incoming: ActivityEvent[] = data.events || [];
                    setGroupedEvents(null);

                    if (opts?.append) {
                        if (incoming.length > 0) {
                            const incomingIds = new Set(incoming.map((e: ActivityEvent) => e.id));
                            setNewEventIds(incomingIds);
                            setTimeout(() => setNewEventIds(new Set()), 2000);

                            setEvents((prev) => {
                                const existingIds = new Set(prev.map((e) => e.id));
                                const deduped = incoming.filter(
                                    (e: ActivityEvent) => !existingIds.has(e.id)
                                );
                                return [...deduped, ...prev].slice(0, 200);
                            });
                            lastTimestampRef.current = incoming[0]!.timestamp;
                        }
                    } else {
                        setEvents(incoming);
                        if (incoming.length > 0) {
                            lastTimestampRef.current = incoming[0]!.timestamp;
                        }
                    }
                }

                if (data.fullMetrics) {
                    setMetrics(data.fullMetrics);
                } else if (!opts?.append) {
                    setMetrics(data.metrics);
                }
            } catch (err) {
                console.error("[GodMode] Failed to fetch events:", err);
            } finally {
                setLoading(false);
                initialLoadRef.current = false;
            }
        },
        [selectedAgent, typeFilter, searchQuery, grouped]
    );

    useEffect(() => {
        setLoading(true);
        initialLoadRef.current = true;
        fetchEvents();
    }, [fetchEvents]);

    useEffect(() => {
        if (!isLive) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            return;
        }

        pollingRef.current = setInterval(() => {
            if (lastTimestampRef.current) {
                fetchEvents({ since: lastTimestampRef.current, append: true });
            } else {
                fetchEvents();
            }
        }, POLL_INTERVAL_MS);

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [isLive, fetchEvents]);

    const resetTimestamp = useCallback(() => {
        lastTimestampRef.current = null;
    }, []);

    const activeAgents = useMemo(() => {
        return metrics?.byAgent ?? [];
    }, [metrics]);

    return {
        events,
        groupedEvents,
        metrics,
        loading,
        isLive,
        setIsLive,
        newEventIds,
        activeAgents,
        initialLoadDone: !initialLoadRef.current,
        resetTimestamp
    };
}
