"use client";

import { useEffect } from "react";

/**
 * Global Error Boundary
 *
 * This catches errors that occur in the root layout.
 * Note: This only activates in production builds. In development, the error overlay is shown instead.
 */
export default function GlobalError({
    error,
    reset
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log error to console or error reporting service
        console.error("Global error:", error);
    }, [error]);

    return (
        <html>
            <body>
                <div style={{ padding: "2rem", textAlign: "center" }}>
                    <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Something went wrong</h1>
                    <p style={{ marginBottom: "1rem" }}>
                        An unexpected error occurred. Please try refreshing the page.
                    </p>
                    <button
                        onClick={reset}
                        style={{
                            padding: "0.5rem 1rem",
                            background: "#000",
                            color: "#fff",
                            border: "none",
                            borderRadius: "0.25rem",
                            cursor: "pointer"
                        }}
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
