import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Trust Center",
    description:
        "AgentC2 Trust Center — security certifications, compliance status, and enterprise documentation.",
    alternates: {
        canonical: "https://agentc2.ai/trust-center"
    }
};

const certifications = [
    {
        name: "SOC 2 Type I",
        status: "In Progress",
        target: "Q4 2026",
        color: "text-yellow-500"
    },
    {
        name: "SOC 2 Type II",
        status: "Planned",
        target: "Q2 2027",
        color: "text-muted-foreground"
    },
    {
        name: "GDPR Compliance",
        status: "Implemented",
        target: "",
        color: "text-green-500"
    },
    {
        name: "CCPA/CPRA Compliance",
        status: "Implemented",
        target: "",
        color: "text-green-500"
    },
    {
        name: "PIPEDA Compliance",
        status: "Implemented",
        target: "",
        color: "text-green-500"
    }
];

const securityControls = [
    { control: "Encryption at Rest", detail: "AES-256-GCM for all credentials and sensitive data" },
    { control: "Encryption in Transit", detail: "TLS 1.2+ on all connections, HSTS with preload" },
    {
        control: "Access Control",
        detail: "RBAC with Owner / Admin / Member / Viewer roles"
    },
    { control: "Multi-Factor Auth", detail: "Two-factor authentication supported" },
    {
        control: "Multi-Tenant Isolation",
        detail: "Organization-scoped data, credentials, and agents"
    },
    { control: "Audit Logging", detail: "Comprehensive audit trail for all write operations" },
    {
        control: "AI Guardrails",
        detail: "Per-agent and org-wide input/output content filtering"
    },
    {
        control: "Budget Controls",
        detail: "Per-agent, per-org, and per-user spending limits"
    },
    { control: "Rate Limiting", detail: "Per-endpoint rate limiting on all critical APIs" },
    {
        control: "Vulnerability Scanning",
        detail: "Secret scanning in CI; SCA tooling in progress"
    },
    {
        control: "Penetration Testing",
        detail: "Annual third-party testing (first test Q2 2026)"
    }
];

const documents = [
    {
        name: "Data Processing Addendum (DPA)",
        description: "GDPR-compliant DPA covering data processing obligations",
        availability: "Available on request"
    },
    {
        name: "Security Overview",
        description: "Detailed overview of security architecture and controls",
        availability: "Available on request"
    },
    {
        name: "Subprocessor List",
        description: "Current list of all data sub-processors",
        availability: "Public"
    },
    {
        name: "AI Transparency Statement",
        description: "Disclosure of AI model usage, data processing, and governance",
        availability: "Public"
    },
    {
        name: "SOC 2 Report",
        description: "Independent audit of security controls",
        availability: "Available upon completion (Q4 2026)"
    },
    {
        name: "Penetration Test Summary",
        description: "Executive summary of third-party penetration test findings",
        availability: "Available upon completion (Q2 2026)"
    }
];

export default function TrustCenterPage() {
    return (
        <main className="mx-auto max-w-4xl px-6 py-16">
            <h1 className="text-foreground mb-2 text-4xl font-bold tracking-tight">Trust Center</h1>
            <p className="text-muted-foreground mb-12 leading-relaxed">
                AgentC2 is built with enterprise-grade security. This page provides transparency
                into our security posture, compliance certifications, and available documentation
                for enterprise procurement and security review.
            </p>

            <div className="max-w-none space-y-12">
                <section>
                    <h2 className="text-foreground mb-4 text-2xl font-semibold">
                        Compliance & Certifications
                    </h2>
                    <div className="border-border/60 rounded-xl border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-border/40 border-b">
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Certification
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Status
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Target Date
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-border/40 divide-y">
                                {certifications.map((cert) => (
                                    <tr key={cert.name}>
                                        <td className="text-foreground px-5 py-3 font-medium">
                                            {cert.name}
                                        </td>
                                        <td className={`px-5 py-3 font-medium ${cert.color}`}>
                                            {cert.status}
                                        </td>
                                        <td className="text-muted-foreground px-5 py-3">
                                            {cert.target || "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h2 className="text-foreground mb-4 text-2xl font-semibold">
                        Security Controls
                    </h2>
                    <div className="border-border/60 rounded-xl border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-border/40 border-b">
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Control
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Detail
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-border/40 divide-y">
                                {securityControls.map((item) => (
                                    <tr key={item.control}>
                                        <td className="text-foreground px-5 py-3 font-medium">
                                            {item.control}
                                        </td>
                                        <td className="text-muted-foreground px-5 py-3">
                                            {item.detail}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h2 className="text-foreground mb-4 text-2xl font-semibold">
                        Infrastructure Overview
                    </h2>
                    <div className="border-border/60 rounded-xl border">
                        <table className="w-full text-sm">
                            <tbody className="divide-border/40 divide-y">
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Application Hosting
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Digital Ocean (dedicated compute, isolated infrastructure)
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Database
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        PostgreSQL on Supabase (AWS us-east-1), SOC 2 Type II
                                        certified
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        AI Providers
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        OpenAI and Anthropic (both SOC 2 Type II, no customer data
                                        used for training)
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        TLS/HTTPS
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Caddy with automatic Let&apos;s Encrypt certificates, HSTS
                                        preload
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Data Residency
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        United States (primary)
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h2 className="text-foreground mb-4 text-2xl font-semibold">
                        Available Documentation
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {documents.map((doc) => (
                            <div
                                key={doc.name}
                                className="border-border/60 rounded-xl border px-5 py-4"
                            >
                                <h3 className="text-foreground mb-1 text-sm font-semibold">
                                    {doc.name}
                                </h3>
                                <p className="text-muted-foreground mb-2 text-xs leading-relaxed">
                                    {doc.description}
                                </p>
                                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                    {doc.availability}
                                </span>
                            </div>
                        ))}
                    </div>
                    <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                        To request documentation, contact{" "}
                        <a
                            href="mailto:security@agentc2.ai"
                            className="text-primary hover:underline"
                        >
                            security@agentc2.ai
                        </a>
                        . We respond to security questionnaires and procurement requests within 5
                        business days.
                    </p>
                </section>

                <section>
                    <h2 className="text-foreground mb-4 text-2xl font-semibold">Related Pages</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Link
                            href="/privacy"
                            className="border-border/60 hover:border-primary/40 rounded-xl border px-5 py-4 transition-colors"
                        >
                            <span className="text-foreground text-sm font-semibold">
                                Privacy Policy
                            </span>
                            <p className="text-muted-foreground mt-1 text-xs">
                                How we collect, use, and protect your data
                            </p>
                        </Link>
                        <Link
                            href="/security"
                            className="border-border/60 hover:border-primary/40 rounded-xl border px-5 py-4 transition-colors"
                        >
                            <span className="text-foreground text-sm font-semibold">
                                Security Policy
                            </span>
                            <p className="text-muted-foreground mt-1 text-xs">
                                Technical security measures and practices
                            </p>
                        </Link>
                        <Link
                            href="/subprocessors"
                            className="border-border/60 hover:border-primary/40 rounded-xl border px-5 py-4 transition-colors"
                        >
                            <span className="text-foreground text-sm font-semibold">
                                Subprocessors
                            </span>
                            <p className="text-muted-foreground mt-1 text-xs">
                                List of third-party data processors
                            </p>
                        </Link>
                        <Link
                            href="/ai-transparency"
                            className="border-border/60 hover:border-primary/40 rounded-xl border px-5 py-4 transition-colors"
                        >
                            <span className="text-foreground text-sm font-semibold">
                                AI Transparency
                            </span>
                            <p className="text-muted-foreground mt-1 text-xs">
                                AI model usage, governance, and limitations
                            </p>
                        </Link>
                    </div>
                </section>

                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">Contact</h2>
                    <div className="text-muted-foreground space-y-1 text-sm">
                        <p>
                            Security inquiries:{" "}
                            <a
                                href="mailto:security@agentc2.ai"
                                className="text-primary hover:underline"
                            >
                                security@agentc2.ai
                            </a>
                        </p>
                        <p>
                            Privacy inquiries:{" "}
                            <a
                                href="mailto:privacy@agentc2.ai"
                                className="text-primary hover:underline"
                            >
                                privacy@agentc2.ai
                            </a>
                        </p>
                        <p>
                            Vulnerability reports:{" "}
                            <a
                                href="mailto:security@agentc2.ai"
                                className="text-primary hover:underline"
                            >
                                security@agentc2.ai
                            </a>
                        </p>
                    </div>
                </section>
            </div>
        </main>
    );
}
