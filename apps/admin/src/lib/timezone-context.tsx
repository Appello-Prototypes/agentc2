"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { TIMEZONE_COOKIE } from "./timezone";

interface TimezoneContextValue {
    timezone: string;
    setTimezone: (tz: string) => void;
    formatDate: (date: Date | string) => string;
    formatDateLong: (date: Date | string) => string;
    formatDateTime: (date: Date | string) => string;
    formatTime: (date: Date | string) => string;
}

const TimezoneContext = createContext<TimezoneContextValue | null>(null);

export function TimezoneProvider({
    initialTimezone,
    children
}: {
    initialTimezone: string;
    children: ReactNode;
}) {
    const [timezone, setTimezoneState] = useState(initialTimezone);

    const setTimezone = useCallback((tz: string) => {
        setTimezoneState(tz);
        document.cookie = `${TIMEZONE_COOKIE}=${tz};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
        window.location.reload();
    }, []);

    const formatDate = useCallback(
        (date: Date | string) => {
            const d = typeof date === "string" ? new Date(date) : date;
            return d.toLocaleDateString("en-US", { timeZone: timezone });
        },
        [timezone]
    );

    const formatDateLong = useCallback(
        (date: Date | string) => {
            const d = typeof date === "string" ? new Date(date) : date;
            return d.toLocaleDateString("en-US", {
                timeZone: timezone,
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric"
            });
        },
        [timezone]
    );

    const formatDateTime = useCallback(
        (date: Date | string) => {
            const d = typeof date === "string" ? new Date(date) : date;
            return d.toLocaleString("en-US", { timeZone: timezone });
        },
        [timezone]
    );

    const formatTime = useCallback(
        (date: Date | string) => {
            const d = typeof date === "string" ? new Date(date) : date;
            return d.toLocaleTimeString("en-US", {
                timeZone: timezone,
                hour: "numeric",
                minute: "2-digit"
            });
        },
        [timezone]
    );

    return (
        <TimezoneContext.Provider
            value={{
                timezone,
                setTimezone,
                formatDate,
                formatDateLong,
                formatDateTime,
                formatTime
            }}
        >
            {children}
        </TimezoneContext.Provider>
    );
}

export function useTimezone() {
    const ctx = useContext(TimezoneContext);
    if (!ctx) throw new Error("useTimezone must be used within TimezoneProvider");
    return ctx;
}
