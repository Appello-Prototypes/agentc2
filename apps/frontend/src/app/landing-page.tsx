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
import { CtaBanner } from "@/components/landing/cta-banner";
import { Footer } from "@/components/landing/footer";

export function LandingPage() {
    return (
        <div className="min-h-screen">
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
