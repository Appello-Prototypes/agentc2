declare global {
    interface Window {
        dataLayer: Record<string, unknown>[];
        gtag: (...args: unknown[]) => void;
    }
}

export type AnalyticsEventName =
    | "docs_page_view"
    | "blog_post_view"
    | "docs_cta_click"
    | "blog_cta_click"
    | "signup_click_from_content"
    | "workspace_click_from_content";

export function trackEvent(eventName: AnalyticsEventName, params?: Record<string, unknown>) {
    if (typeof window === "undefined" || typeof window.gtag !== "function") {
        return;
    }

    window.gtag("event", eventName, params ?? {});
}
