import { WebsiteHeader } from "@/components/website/layout/website-header";
import { WebsiteFooter } from "@/components/website/layout/website-footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen">
            <WebsiteHeader />
            <main>{children}</main>
            <WebsiteFooter />
        </div>
    );
}
