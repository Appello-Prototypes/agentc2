import Link from "next/link";
import { cn } from "@repo/ui";

const stats = [
    { value: "200+", label: "MCP Tools" },
    { value: "40+", label: "Integration Blueprints" },
    { value: "7", label: "Deployment Channels" },
    { value: "AES-256", label: "Credential Encryption" },
    { value: "GDPR", label: "& CCPA Compliant" },
    { value: "SOC 2", label: "Operational Readiness" }
];

const links = [
    { href: "/trust-center", label: "Trust Center" },
    { href: "/security", label: "Security Policy" },
    { href: "/ai-transparency", label: "AI Transparency" }
];

export function TrustBar() {
    return (
        <section className="border-border/40 border-y py-16">
            <div className="mx-auto max-w-7xl px-6">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-6">
                    {stats.map((stat, index) => (
                        <div key={index} className="text-center">
                            <div className="text-foreground text-2xl font-bold md:text-3xl">
                                {stat.value}
                            </div>
                            <div className="text-muted-foreground mt-1 text-sm">{stat.label}</div>
                        </div>
                    ))}
                </div>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn("text-primary text-sm hover:underline")}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
