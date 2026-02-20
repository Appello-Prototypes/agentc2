import { InvestorPage } from "@/components/investor/investor-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "AgentC2 — Investor Overview",
    description:
        "The only AI agent platform with paying customers in a proven vertical, zero churn, and a horizontal platform launching in parallel.",
    robots: { index: false, follow: false }
};

export default function InvestorPageRoute() {
    return <InvestorPage />;
}
