import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/website/sections/page-hero";
import { SectionWrapper } from "@/components/website/layout/section-wrapper";
import { SectionHeader } from "@/components/website/sections/section-header";
import { Breadcrumbs } from "@/components/website/sections/breadcrumbs";
import { CTABanner } from "@/components/website/sections/cta-banner";
import { FeatureGrid } from "@/components/website/sections/feature-grid";
import { RelatedPages } from "@/components/website/sections/related-pages";
import { FederationIllustration } from "@/components/website/illustrations";

export const metadata: Metadata = buildPageMetadata({
    title: "Federation — Cross-Organization Agent Collaboration",
    description:
        "AgentC2 Federation lets agents from separate organizations collaborate securely with AES-GCM encryption, Ed25519 signatures, policy enforcement, and a complete audit trail.",
    path: "/platform/federation",
    keywords: [
        "AI agent federation",
        "cross-org AI",
        "multi-org AI agents",
        "secure agent collaboration",
        "federated AI platform"
    ]
});

export default function FederationPage() {
    return (
        <>
            <SectionWrapper className="pt-8 pb-0">
                <Breadcrumbs
                    items={[
                        { label: "Home", href: "/" },
                        { label: "Platform", href: "/platform" },
                        { label: "Federation" }
                    ]}
                />
            </SectionWrapper>

            {/* ---------- Hero ---------- */}
            <PageHero
                overline="Federation"
                title="The only platform where agents cross organizational boundaries — securely"
                description="Most AI platforms stop at the org boundary. AgentC2 Federation lets agents from separate organizations discover, authenticate, and collaborate — with end-to-end encryption, policy enforcement, and a cryptographically verifiable audit trail."
                primaryCta={{ label: "Request a Demo", href: "/contact" }}
                secondaryCta={{
                    label: "Read the Architecture",
                    href: "/docs"
                }}
            >
                <FederationIllustration className="w-full max-w-md" />
            </PageHero>

            {/* ---------- Why Federation Matters ---------- */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="The Problem"
                    title="Why federation matters"
                    description="AI agents are powerful inside a single organization — but business doesn't stop at the firewall."
                />
                <div className="mx-auto mt-12 max-w-3xl space-y-6">
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h4 className="text-foreground mb-2 font-semibold">Today&apos;s reality</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            When a supply chain manager needs demand forecasts from a supplier, they
                            export a CSV, email it, wait for a response, and manually reconcile the
                            data. When a consulting firm delivers agent-powered insights to a
                            client, they copy outputs into slide decks. When a franchise
                            headquarters pushes a new playbook to franchisees, they publish a PDF
                            and hope it gets read.
                        </p>
                    </div>
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h4 className="text-foreground mb-2 font-semibold">The federated future</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            With AgentC2 Federation, the supply chain manager&apos;s agent queries
                            the supplier&apos;s forecasting agent directly — over an encrypted
                            channel, governed by both organizations&apos; policies, with every
                            interaction logged. No CSVs, no emails, no waiting. The consulting
                            firm&apos;s agent pushes real-time recommendations into the
                            client&apos;s workspace. The franchise HQ agent deploys a playbook to
                            every franchisee agent simultaneously.
                        </p>
                    </div>
                </div>
            </SectionWrapper>

            {/* ---------- How It Works ---------- */}
            <SectionWrapper>
                <SectionHeader
                    overline="Architecture"
                    title="How federation works"
                    description="A five-step protocol that establishes trust, enforces policy, and encrypts every byte in transit."
                />
                <div className="mx-auto mt-12 max-w-3xl space-y-8">
                    {[
                        {
                            step: 1,
                            title: "Channel Request",
                            body: "Organization A submits a federation request specifying which agents it wants to expose, the data classifications allowed, and the proposed rate limits. The request is signed with Org A\u2019s Ed25519 private key."
                        },
                        {
                            step: 2,
                            title: "Policy Negotiation",
                            body: "Organization B reviews the request against its own federation policies. Rules like \u201Cno PII sharing,\u201D \u201Cmax 100 requests/hour,\u201D and \u201CConfidential data class only\u201D are evaluated automatically. If policies conflict, the stricter policy wins."
                        },
                        {
                            step: 3,
                            title: "Key Exchange",
                            body: "Both organizations exchange AES-256-GCM session keys wrapped with the peer\u2019s Ed25519 public key. From this point forward, all messages between agents are encrypted end-to-end \u2014 AgentC2\u2019s infrastructure cannot read the payload."
                        },
                        {
                            step: 4,
                            title: "Agent Discovery",
                            body: "Each organization publishes a capability manifest \u2014 a machine-readable description of which agents are available, what tools they can execute, and what data they accept. Agents on both sides can discover and invoke each other\u2019s capabilities without manual configuration."
                        },
                        {
                            step: 5,
                            title: "Execution & Audit",
                            body: "Federated agent calls are executed through the encrypted channel. Every request and response is logged to both organizations\u2019 audit trails with a cryptographic hash chain \u2014 providing tamper-evident proof of every interaction."
                        }
                    ].map(({ step, title, body }) => (
                        <div key={step} className="flex gap-4">
                            <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                                {step}
                            </div>
                            <div>
                                <h4 className="text-foreground text-base font-semibold">{title}</h4>
                                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                                    {body}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </SectionWrapper>

            {/* ---------- Security Model ---------- */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Security"
                    title="Cryptographic trust at every layer"
                    description="Federation security is not an afterthought — it's the foundation. Every message is encrypted, every identity is verified, and every action is auditable."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "AES-256-GCM Encryption",
                            description:
                                "All federated payloads are encrypted with AES-256-GCM using per-session keys. Even if infrastructure is compromised, message contents remain confidential."
                        },
                        {
                            title: "Ed25519 Signatures",
                            description:
                                "Every federation request is signed with the sending organization\u2019s Ed25519 private key. The receiving organization verifies the signature before processing — preventing impersonation and tampering."
                        },
                        {
                            title: "Mutual TLS",
                            description:
                                "The transport layer uses mutual TLS with pinned certificates. Both sides authenticate each other at the connection level before any application data is exchanged."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* ---------- Policy Enforcement ---------- */}
            <SectionWrapper>
                <SectionHeader
                    overline="Governance"
                    title="Policy enforcement without bottlenecks"
                    description="Federation policies are evaluated in real time on every request. Both organizations maintain full sovereignty over what data leaves their boundary."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={2}
                    features={[
                        {
                            title: "PII Scanner",
                            description:
                                "Outbound messages are scanned for personally identifiable information before encryption. If PII is detected and the policy forbids it, the request is blocked and the sender is notified — before any data crosses the boundary."
                        },
                        {
                            title: "Data Classification",
                            description:
                                "Every piece of data carries a classification label (Public, Internal, Confidential, Restricted). Federation channels specify the maximum classification they accept. Mismatches are rejected automatically."
                        },
                        {
                            title: "Rate Limiting",
                            description:
                                "Each federation channel has configurable rate limits — requests per hour, tokens per day, and concurrent connections. Limits are enforced on both sides to prevent abuse from either direction."
                        },
                        {
                            title: "Revocation",
                            description:
                                "Either organization can revoke a federation channel instantly. Revocation invalidates all session keys, terminates active connections, and logs the event to both audit trails."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* ---------- Agent Discovery ---------- */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Discovery"
                    title="Agents find each other automatically"
                    description="Capability manifests let agents discover what a federated partner can do — without human configuration for every new integration."
                />
                <div className="border-border/60 bg-card mx-auto mt-12 max-w-3xl rounded-2xl border p-6 md:p-8">
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-foreground mb-1 text-sm font-semibold">
                                Capability Manifests
                            </h4>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Each organization publishes a manifest describing its federated
                                agents — name, purpose, accepted input schema, output schema, and
                                required data classifications. Manifests are versioned and signed.
                            </p>
                        </div>
                        <div>
                            <h4 className="text-foreground mb-1 text-sm font-semibold">
                                Semantic Matching
                            </h4>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                When an agent needs a capability it doesn&apos;t have locally, it
                                queries the federation registry for matching capabilities across
                                partner organizations. Matching uses both schema compatibility and
                                semantic similarity.
                            </p>
                        </div>
                        <div>
                            <h4 className="text-foreground mb-1 text-sm font-semibold">
                                Approval Workflows
                            </h4>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                New federation connections can require human approval, automatic
                                approval based on trust score, or a combination. Approval workflows
                                are configurable per organization and per data classification level.
                            </p>
                        </div>
                    </div>
                </div>
            </SectionWrapper>

            {/* ---------- Audit Trail ---------- */}
            <SectionWrapper>
                <SectionHeader
                    overline="Compliance"
                    title="A tamper-evident audit trail"
                    description="Every federated interaction is logged with cryptographic integrity — providing the evidence you need for SOC 2, ISO 27001, and regulatory audits."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Hash Chain Integrity",
                            description:
                                "Each audit entry includes a SHA-256 hash of the previous entry, forming an append-only chain. Any tampering breaks the chain and is immediately detectable."
                        },
                        {
                            title: "Dual-Write Logging",
                            description:
                                "Both the sending and receiving organization receive a copy of every audit entry. Neither side can claim an interaction didn\u2019t happen — both have cryptographic proof."
                        },
                        {
                            title: "Export & Retention",
                            description:
                                "Audit logs can be exported to your SIEM (Splunk, Datadog, Elastic) or stored in your own object storage. Retention policies are configurable per organization and per channel."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* ---------- Use Cases ---------- */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Use Cases"
                    title="Where federation creates value"
                    description="Cross-organizational agent collaboration unlocks workflows that were previously impossible without manual intervention."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={2}
                    features={[
                        {
                            title: "Supply Chain Orchestration",
                            description:
                                "A manufacturer\u2019s planning agent queries suppliers\u2019 inventory agents for real-time stock levels, lead times, and pricing — automatically rerouting orders when a supplier signals a shortage. No EDI files, no email chains."
                        },
                        {
                            title: "Consulting Delivery",
                            description:
                                "A consulting firm\u2019s research agent pushes analysis directly into the client\u2019s strategy workspace. The client\u2019s agent can ask follow-up questions, request deeper analysis, and pull in additional data sources — all within the federated channel."
                        },
                        {
                            title: "Platform Ecosystems",
                            description:
                                "A SaaS platform federates with its ISV partners, letting partner agents extend the platform\u2019s capabilities. End users get a unified experience while each ISV maintains control over its own agent logic and data."
                        },
                        {
                            title: "Franchise Networks",
                            description:
                                "Headquarters deploys updated playbooks, pricing rules, and compliance policies to every franchisee\u2019s agents simultaneously. Franchisees\u2019 local agents adapt the playbook to regional context while staying within brand and compliance guardrails."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* ---------- CTA ---------- */}
            <CTABanner
                title="Ready to connect agents across organizations?"
                description="Federation is available for Enterprise customers. Talk to our team about cross-org collaboration, security architecture, and compliance requirements."
                primaryCta={{
                    label: "Request a Demo",
                    href: "/contact"
                }}
                secondaryCta={{
                    label: "Enterprise Overview",
                    href: "/enterprise"
                }}
            />

            {/* ---------- Related Pages ---------- */}
            <SectionWrapper>
                <RelatedPages
                    title="Explore More"
                    pages={[
                        {
                            title: "Enterprise",
                            description:
                                "Multi-tenant architecture, SSO, RBAC, and governance for organizations at scale.",
                            href: "/enterprise"
                        },
                        {
                            title: "Embed Partners",
                            description:
                                "White-label AI agents inside your own product with the AgentC2 embed SDK.",
                            href: "/embed-partners"
                        },
                        {
                            title: "Platform Overview",
                            description:
                                "The full AgentC2 architecture — agents, workflows, integrations, and the learning loop.",
                            href: "/platform"
                        }
                    ]}
                />
            </SectionWrapper>
        </>
    );
}
