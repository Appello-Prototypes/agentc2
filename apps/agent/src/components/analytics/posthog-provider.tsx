"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect, type ReactNode } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export function PostHogProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        if (!POSTHOG_KEY) return;

        posthog.init(POSTHOG_KEY, {
            api_host: POSTHOG_HOST,
            person_profiles: "identified_only",
            capture_pageview: true,
            capture_pageleave: true,
            autocapture: false,
            persistence: "localStorage+cookie",
            opt_out_capturing_by_default: false,
            respect_dnt: true,
            disable_session_recording: true
        });
    }, []);

    if (!POSTHOG_KEY) {
        return <>{children}</>;
    }

    return <PHProvider client={posthog}>{children}</PHProvider>;
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
    if (!POSTHOG_KEY) return;
    posthog.identify(userId, properties);
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
    if (!POSTHOG_KEY) return;
    posthog.capture(event, properties);
}

export function resetAnalytics() {
    if (!POSTHOG_KEY) return;
    posthog.reset();
}
