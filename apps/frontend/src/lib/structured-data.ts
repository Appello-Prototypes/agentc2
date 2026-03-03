import { SITE_NAME, SITE_URL, absoluteUrl } from "./seo";

export function generateWebPageSchema(params: { title: string; description: string; url: string }) {
    return {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: params.title,
        description: params.description,
        url: params.url.startsWith("http") ? params.url : absoluteUrl(params.url),
        isPartOf: {
            "@type": "WebSite",
            name: SITE_NAME,
            url: SITE_URL
        },
        publisher: {
            "@type": "Organization",
            name: SITE_NAME,
            url: SITE_URL
        }
    };
}

export function generateProductSchema(params: {
    name: string;
    description: string;
    offers?: Array<{
        name: string;
        price: string;
        priceCurrency?: string;
    }>;
}) {
    return {
        "@context": "https://schema.org",
        "@type": "Product",
        name: params.name,
        description: params.description,
        brand: {
            "@type": "Organization",
            name: SITE_NAME
        },
        ...(params.offers && {
            offers: params.offers.map((offer) => ({
                "@type": "Offer",
                name: offer.name,
                price: offer.price,
                priceCurrency: offer.priceCurrency || "USD"
            }))
        })
    };
}

export function generateComparisonSchema(params: {
    title: string;
    description: string;
    url: string;
    competitor: string;
}) {
    return {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: params.title,
        description: params.description,
        url: params.url.startsWith("http") ? params.url : absoluteUrl(params.url),
        about: [
            { "@type": "SoftwareApplication", name: SITE_NAME },
            { "@type": "SoftwareApplication", name: params.competitor }
        ],
        isPartOf: {
            "@type": "WebSite",
            name: SITE_NAME,
            url: SITE_URL
        }
    };
}
