"use client";

import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";
import { trackEvent, type AnalyticsEventName } from "@/lib/analytics";

interface TrackedLinkProps extends LinkProps {
    children: ReactNode;
    className?: string;
    eventName?: AnalyticsEventName;
    eventParams?: Record<string, unknown>;
}

export function TrackedLink({
    children,
    eventName,
    eventParams,
    onClick,
    ...props
}: TrackedLinkProps & { onClick?: React.MouseEventHandler<HTMLAnchorElement> }) {
    return (
        <Link
            {...props}
            onClick={(event) => {
                onClick?.(event);
                if (eventName) {
                    trackEvent(eventName, eventParams);
                }
            }}
        >
            {children}
        </Link>
    );
}
