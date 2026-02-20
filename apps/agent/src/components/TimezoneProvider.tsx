"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getApiBase } from "@/lib/utils";

interface TimezoneContextValue {
    timezone: string;
    source: "user" | "organization" | "browser" | "default";
    loading: boolean;
}

const TimezoneContext = createContext<TimezoneContextValue>({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    source: "browser",
    loading: true
});

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<TimezoneContextValue>({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        source: "browser",
        loading: true
    });

    useEffect(() => {
        let cancelled = false;

        async function fetchTimezone() {
            try {
                const res = await fetch(`${getApiBase()}/api/user/timezone`);
                if (!res.ok) throw new Error("Failed to fetch timezone");
                const data = await res.json();
                if (!cancelled && data.success) {
                    setState({
                        timezone: data.timezone,
                        source: data.source,
                        loading: false
                    });
                }
            } catch {
                if (!cancelled) {
                    setState((prev) => ({ ...prev, loading: false }));
                }
            }
        }

        fetchTimezone();
        return () => {
            cancelled = true;
        };
    }, []);

    return <TimezoneContext.Provider value={state}>{children}</TimezoneContext.Provider>;
}

export function useTimezone(): string {
    return useContext(TimezoneContext).timezone;
}

export function useTimezoneContext(): TimezoneContextValue {
    return useContext(TimezoneContext);
}
