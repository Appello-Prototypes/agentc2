import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_FRONTEND_SENTRY_DSN,
    enabled: !!process.env.NEXT_PUBLIC_FRONTEND_SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: process.env.NODE_ENV || "development",
    integrations: [Sentry.replayIntegration(), Sentry.browserTracingIntegration()],
    ignoreErrors: [
        "ResizeObserver loop",
        "Non-Error promise rejection",
        /^Loading chunk \d+ failed/
    ]
});
