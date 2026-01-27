"use client";

import { Component, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertTriangle, Refresh } from "@hugeicons/core-free-icons";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree and displays a fallback UI.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error to console in development
        if (process.env.NODE_ENV === "development") {
            console.error("ErrorBoundary caught an error:", error, errorInfo);
        }

        // Call optional error handler
        this.props.onError?.(error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            // Render custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <DefaultErrorFallback
                    error={this.state.error}
                    reset={() => this.setState({ hasError: false, error: null })}
                />
            );
        }

        return this.props.children;
    }
}

/**
 * Default Error Fallback Component
 *
 * Displayed when an error is caught by the ErrorBoundary.
 */
export function DefaultErrorFallback({ error, reset }: { error: Error | null; reset: () => void }) {
    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={AlertTriangle} className="text-destructive size-6" />
                        <CardTitle>Something went wrong</CardTitle>
                    </div>
                    <CardDescription>
                        An unexpected error occurred. Please try refreshing the page.
                    </CardDescription>
                </CardHeader>
                {process.env.NODE_ENV === "development" && error && (
                    <CardContent>
                        <div className="bg-muted rounded-lg p-4">
                            <p className="text-destructive font-mono text-sm">{error.message}</p>
                            {error.stack && (
                                <pre className="text-muted-foreground mt-2 max-h-40 overflow-auto text-xs">
                                    {error.stack}
                                </pre>
                            )}
                        </div>
                    </CardContent>
                )}
                <CardFooter className="flex gap-2">
                    <Button onClick={reset} variant="outline">
                        <HugeiconsIcon icon={Refresh} className="mr-2 size-4" />
                        Try again
                    </Button>
                    <Button onClick={() => (window.location.href = "/")}>Go to Home</Button>
                </CardFooter>
            </Card>
        </div>
    );
}
