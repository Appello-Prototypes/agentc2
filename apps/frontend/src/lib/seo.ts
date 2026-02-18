import type { Metadata } from "next";

export const SITE_NAME = "AgentC2";
export const SITE_URL = "https://agentc2.ai";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph-image`;

interface PageMetadataOptions {
    title: string;
    description: string;
    path: string;
    keywords?: string[];
}

export function absoluteUrl(path: string): string {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${SITE_URL}${normalized}`;
}

export function buildPageMetadata(options: PageMetadataOptions): Metadata {
    const canonical = absoluteUrl(options.path);
    const pagePath = options.path.startsWith("/") ? options.path : `/${options.path}`;
    const ogImageUrl =
        pagePath === "/"
            ? DEFAULT_OG_IMAGE
            : pagePath === "/docs"
              ? absoluteUrl("/docs/opengraph-image")
              : pagePath.startsWith("/docs/")
                ? absoluteUrl("/docs/opengraph-image")
                : pagePath === "/blog"
                  ? absoluteUrl("/blog/opengraph-image")
                  : pagePath.startsWith("/blog/")
                    ? absoluteUrl(`${pagePath}/opengraph-image`)
                    : DEFAULT_OG_IMAGE;

    return {
        title: options.title,
        description: options.description,
        keywords: options.keywords,
        alternates: {
            canonical
        },
        openGraph: {
            title: options.title,
            description: options.description,
            url: canonical,
            siteName: SITE_NAME,
            type: "article",
            images: [
                {
                    url: ogImageUrl,
                    width: 1200,
                    height: 630,
                    alt: `${SITE_NAME} Open Graph Image`
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: options.title,
            description: options.description,
            images: [ogImageUrl],
            site: "@agentc2ai"
        }
    };
}

export function organizationJsonLd() {
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/favicon.ico`,
        sameAs: ["https://agentc2.ai"],
        contactPoint: [
            {
                "@type": "ContactPoint",
                contactType: "customer support",
                email: "hello@agentc2.ai"
            }
        ]
    };
}

export function softwareApplicationJsonLd() {
    return {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        description:
            "AgentC2 is an AI agent orchestration platform for building, deploying, and managing production AI agents with workflows, guardrails, and integrations.",
        offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD"
        }
    };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: absoluteUrl(item.path)
        }))
    };
}
