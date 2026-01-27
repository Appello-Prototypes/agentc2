"use client";

import { useEffect } from "react";
import { DefaultErrorFallback } from "@repo/ui";

export default function Error({
    error,
    reset
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log error to console or error reporting service
        console.error("Frontend app error:", error);
    }, [error]);

    return <DefaultErrorFallback error={error} reset={reset} />;
}
