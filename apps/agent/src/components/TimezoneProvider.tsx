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
            if (!document.cookie.includes("better-auth.session_data")) {
                if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
                return;
            }
            try {
                const res = await fetch(`${getApiBase()}/api/user/timezone`);
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled && data.success) {
                    setState({
                        timezone: data.timezone,
                        source: data.source,
                        loading: false
                    });
                }
            } catch {
                // Silently fail — browser timezone is already set as default
            } finally {
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
