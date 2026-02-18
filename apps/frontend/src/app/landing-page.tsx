"use client";

import { NavBar } from "@/components/landing/nav-bar";
import { HeroSection } from "@/components/landing/hero-section";
import { IntegrationBar } from "@/components/landing/integration-bar";
import { FeatureAccordion } from "@/components/landing/feature-accordion";
import { HowItWorks } from "@/components/landing/how-it-works";
import { CapabilityGrid } from "@/components/landing/capability-grid";
import { DataTransparency } from "@/components/landing/data-transparency";
import { PricingSection } from "@/components/landing/pricing-section";
import { FaqSection } from "@/components/landing/faq-section";
import { landingFaqs } from "@/components/landing/faq-section";
import { CtaBanner } from "@/components/landing/cta-banner";
import { Footer } from "@/components/landing/footer";

export function LandingPage() {
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: landingFaqs.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer
            }
        }))
    };

    return (
        <div className="min-h-screen">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />
            <NavBar />
            <HeroSection />
            <IntegrationBar />
            <FeatureAccordion />
            <HowItWorks />
            <CapabilityGrid />
            <DataTransparency />
            <PricingSection />
            <FaqSection />
            <CtaBanner />
            <Footer />
        </div>
    );
}
