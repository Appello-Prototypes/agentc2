"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function GoogleAnalytics() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (!MEASUREMENT_ID || typeof window.gtag !== "function") {
            return;
        }

        const query = searchParams.toString();
        const pagePath = query ? `${pathname}?${query}` : pathname;

        window.gtag("event", "page_view", {
            page_path: pagePath,
            page_title: document.title
        });
    }, [pathname, searchParams]);

    if (!MEASUREMENT_ID) {
        return null;
    }

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}
                strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    window.gtag = gtag;
                    gtag("js", new Date());
                    gtag("config", "${MEASUREMENT_ID}", { send_page_view: false });
                `}
            </Script>
        </>
    );
}
