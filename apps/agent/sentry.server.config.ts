import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_AGENT_SENTRY_DSN,
    enabled: !!process.env.NEXT_PUBLIC_AGENT_SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    environment: process.env.NODE_ENV || "development",
    ignoreErrors: ["NEXT_NOT_FOUND", "NEXT_REDIRECT"]
});
