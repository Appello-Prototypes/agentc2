"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiBase } from "@/lib/utils";
import type { ReviewItem, StepData } from "../types";

const MAX_CONCURRENT = 5;
const RUNNING_POLL_MS = 30_000;

export function useStepPrefetch(reviews: ReviewItem[]) {
    const [stepCache, setStepCache] = useState<Map<string, StepData[]>>(new Map());
    const [loading, setLoading] = useState(false);
    const inflightRef = useRef<Set<string>>(new Set());
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const fetchStepsForReview = useCallback(
        async (reviewId: string): Promise<StepData[] | null> => {
            try {
                const res = await fetch(`${getApiBase()}/api/reviews/${reviewId}/steps`);
                const data = await res.json();
                if (data.success && Array.isArray(data.steps)) {
                    return data.steps as StepData[];
                }
            } catch {
                /* non-critical */
            }
            return null;
        },
        []
    );

    const fetchBatch = useCallback(
        async (reviewIds: string[]) => {
            if (reviewIds.length === 0) return;
            setLoading(true);

            const chunks: string[][] = [];
            for (let i = 0; i < reviewIds.length; i += MAX_CONCURRENT) {
                chunks.push(reviewIds.slice(i, i + MAX_CONCURRENT));
            }

            for (const chunk of chunks) {
                if (!mountedRef.current) break;

                const idsToFetch = chunk.filter((id) => !inflightRef.current.has(id));
                idsToFetch.forEach((id) => inflightRef.current.add(id));

                const results = await Promise.all(
                    idsToFetch.map(async (id) => {
                        const steps = await fetchStepsForReview(id);
                        return { id, steps };
                    })
                );

                if (!mountedRef.current) break;

                setStepCache((prev) => {
                    const next = new Map(prev);
                    for (const { id, steps } of results) {
                        if (steps) next.set(id, steps);
                    }
                    return next;
                });

                idsToFetch.forEach((id) => inflightRef.current.delete(id));
            }

            if (mountedRef.current) setLoading(false);
        },
        [fetchStepsForReview]
    );

    useEffect(() => {
        const newIds = reviews.filter((r) => !stepCache.has(r.id)).map((r) => r.id);
        if (newIds.length > 0) {
            fetchBatch(newIds);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reviews.map((r) => r.id).join(",")]);

    useEffect(() => {
        const runningIds = reviews
            .filter((r) => r.runStatus === "RUNNING" || r.status === "pending")
            .map((r) => r.id);

        if (runningIds.length === 0) return;

        const interval = setInterval(() => {
            fetchBatch(runningIds);
        }, RUNNING_POLL_MS);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reviews.map((r) => r.id).join(","), fetchBatch]);

    return { stepCache, loading };
}
