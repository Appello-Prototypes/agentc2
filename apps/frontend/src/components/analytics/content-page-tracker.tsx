"use client";

import { useEffect } from "react";
import { trackEvent, type AnalyticsEventName } from "@/lib/analytics";

interface ContentPageTrackerProps {
    eventName: AnalyticsEventName;
    params: Record<string, unknown>;
}

export function ContentPageTracker({ eventName, params }: ContentPageTrackerProps) {
    useEffect(() => {
        trackEvent(eventName, params);
    }, [eventName, params]);

    return null;
}
