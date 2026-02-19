import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/landing/footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen">
            <SiteHeader />
            {children}
            <Footer />
        </div>
    );
}
