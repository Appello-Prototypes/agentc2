import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/website/sections/page-hero";
import { SectionWrapper } from "@/components/website/layout/section-wrapper";
import { SectionHeader } from "@/components/website/sections/section-header";
import { Breadcrumbs } from "@/components/website/sections/breadcrumbs";
import { CTABanner } from "@/components/website/sections/cta-banner";
import { FeatureGrid } from "@/components/website/sections/feature-grid";
import { RelatedPages } from "@/components/website/sections/related-pages";
import { StyledLink } from "@/components/website/layout/styled-link";
import {
    BudgetHierarchyIllustration,
    GuardrailPanelIllustration
} from "@/components/website/illustrations";

export const metadata: Metadata = buildPageMetadata({
    title: "Enterprise — AgentC2 for Organizations",
    description:
        "Multi-tenant architecture, SSO, RBAC, governance guardrails, and federated agent networks — AgentC2 is built for organizations that demand security, compliance, and scale.",
    path: "/enterprise",
    keywords: [
        "enterprise AI agents",
        "multi-tenant AI",
        "AI governance",
        "SSO RBAC AI",
        "enterprise agent platform"
    ]
});

export default function EnterprisePage() {
    return (
        <>
            <SectionWrapper className="pt-8 pb-0">
                <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Enterprise" }]} />
            </SectionWrapper>

            {/* ---------- Hero ---------- */}
            <PageHero
                overline="Enterprise"
                title="Built for organizations, not individuals"
                description="AgentC2 gives every team its own workspace, every workspace its own agents, and every agent its own guardrails — all under a single subscription you can audit, govern, and scale."
                primaryCta={{ label: "Request a Demo", href: "/contact" }}
                secondaryCta={{
                    label: "View Platform Overview",
                    href: "/platform"
                }}
            >
                <BudgetHierarchyIllustration className="w-full max-w-md" />
            </PageHero>

            {/* ---------- Multi-Tenant Architecture ---------- */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Architecture"
                    title="Multi-tenant by design"
                    description="A four-tier hierarchy — Subscription → Organization → Workspace → Agent — isolates data, budgets, and permissions at every level."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Organization Isolation",
                            description:
                                "Each organization operates in a fully isolated partition with its own users, agents, and integrations. Cross-org data access is impossible without explicit federation."
                        },
                        {
                            title: "Workspace Scoping",
                            description:
                                "Within an organization, workspaces group agents by team, department, or project. Budget limits, tool permissions, and guardrails are set per workspace."
                        },
                        {
                            title: "Hierarchical Budgets",
                            description:
                                "Set spending caps at the subscription, org, workspace, user, and individual agent level. Overages are blocked in real time — no surprise invoices."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* ---------- Authentication & Identity ---------- */}
            <SectionWrapper>
                <SectionHeader
                    overline="Identity"
                    title="Authentication & access control"
                    description="Enterprise-grade identity powered by Better Auth with support for SSO, MFA, and fine-grained role-based access control."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Single Sign-On (SSO)",
                            description:
                                "SAML 2.0 and OIDC federation let your team log in with their existing identity provider — Okta, Azure AD, Google Workspace, and more."
                        },
                        {
                            title: "Role-Based Access Control",
                            description:
                                "Built-in roles (Owner, Admin, Member, Viewer) control who can create agents, approve workflows, manage integrations, and view audit logs."
                        },
                        {
                            title: "API Key Management",
                            description:
                                "Scoped API keys with per-key rate limits, IP allowlists, and automatic rotation policies. Every key action is logged to the audit trail."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* ---------- Admin Portal ---------- */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Administration"
                    title="A control plane for AI"
                    description="The AgentC2 Admin Portal gives platform operators full visibility and control over every organization, user, and agent on the platform."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={2}
                    features={[
                        {
                            title: "User & Org Management",
                            description:
                                "Invite users, manage roles, suspend accounts, and transfer ownership — all from a unified dashboard. Bulk operations via CSV or API."
                        },
                        {
                            title: "Agent Registry",
                            description:
                                "Browse every agent across all organizations. Inspect configuration, review run history, compare evaluation scores, and enforce version pinning."
                        },
                        {
                            title: "Usage Analytics",
                            description:
                                "Real-time dashboards for token consumption, tool invocations, latency percentiles, and cost attribution — filterable by org, workspace, or agent."
                        },
                        {
                            title: "Platform Health",
                            description:
                                "Monitor MCP server connectivity, database pool utilization, Inngest queue depth, and webhook delivery rates with built-in alerting."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* ---------- Governance & Compliance ---------- */}
            <SectionWrapper>
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                    <div className="flex flex-col justify-center">
                        <SectionHeader
                            overline="Governance"
                            title="Guardrails that enforce policy automatically"
                            description="Define security policies once and AgentC2 enforces them on every agent run — PII blocking, prompt injection detection, toxicity filtering, egress control, and per-run cost limits."
                            centered={false}
                        />
                        <ul className="text-muted-foreground mt-8 space-y-3 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5">✓</span>
                                <span>
                                    PII scanner detects and redacts emails, phone numbers, and
                                    government IDs before they leave the platform.
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5">✓</span>
                                <span>
                                    Prompt injection classifier rejects manipulated inputs with
                                    configurable sensitivity thresholds.
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5">✓</span>
                                <span>
                                    Egress allowlists restrict which external domains an agent can
                                    contact — no unauthorized data exfiltration.
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5">✓</span>
                                <span>
                                    Immutable audit trail captures every decision, tool call, and
                                    policy evaluation for SOC 2 and ISO 27001 evidence.
                                </span>
                            </li>
                        </ul>
                    </div>
                    <div className="flex items-center justify-center">
                        <GuardrailPanelIllustration className="w-full max-w-md" />
                    </div>
                </div>
            </SectionWrapper>

            {/* ---------- Scalability ---------- */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Scale"
                    title="From ten agents to ten thousand"
                    description="AgentC2's architecture scales horizontally. Add organizations, workspaces, and agents without re-architecting your deployment."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Horizontal Scaling",
                            description:
                                "Stateless Next.js workers behind a load balancer. Add capacity by increasing replicas — no sticky sessions required."
                        },
                        {
                            title: "Background Job Processing",
                            description:
                                "Inngest handles long-running workflows, retries, and fan-out patterns. Learning sessions, RAG ingestion, and batch evaluations run without blocking the API."
                        },
                        {
                            title: "Connection Pooling",
                            description:
                                "PgBouncer-compatible pooling ensures database connections are reused efficiently even under high agent concurrency."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* ---------- Deployment Options ---------- */}
            <SectionWrapper>
                <SectionHeader
                    overline="Deployment"
                    title="Deploy your way"
                    description="Run AgentC2 as a managed service, in your own cloud, or on-premises — with the same feature set everywhere."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Managed Cloud",
                            description:
                                "Zero-ops deployment on AgentC2&apos;s infrastructure. We handle updates, scaling, and uptime so your team can focus on building agents."
                        },
                        {
                            title: "Self-Hosted (VPC)",
                            description:
                                "Deploy inside your own AWS, GCP, or Azure VPC. Data never leaves your perimeter. Terraform modules and Helm charts are included."
                        },
                        {
                            title: "Air-Gapped / On-Prem",
                            description:
                                "For regulated industries that require full data sovereignty. Offline-capable with local LLM support and no external network calls."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* ---------- Federation Teaser ---------- */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Federation"
                    title="Agents that cross organizational boundaries"
                    description="AgentC2 is the only platform where agents from separate organizations can collaborate securely — with end-to-end encryption, policy enforcement, and a complete audit trail."
                />
                <div className="mt-8 flex justify-center">
                    <StyledLink href="/platform/federation" variant="outline" size="lg">
                        Explore Federation →
                    </StyledLink>
                </div>
            </SectionWrapper>

            {/* ---------- Support & SLA ---------- */}
            <SectionWrapper>
                <SectionHeader
                    overline="Support"
                    title="Enterprise support that matches enterprise expectations"
                    description="Dedicated account management, guaranteed response times, and migration assistance — because deploying AI agents is too important to go unsupported."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Dedicated CSM",
                            description:
                                "A named Customer Success Manager who understands your deployment, reviews your agents quarterly, and escalates issues internally."
                        },
                        {
                            title: "99.9% Uptime SLA",
                            description:
                                "Contractual availability guarantees backed by service credits. Incident communication via a private Slack channel or email."
                        },
                        {
                            title: "Migration & Onboarding",
                            description:
                                "White-glove onboarding includes agent design workshops, integration setup, guardrail configuration, and team training sessions."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* ---------- CTA ---------- */}
            <CTABanner
                title="Ready to deploy AI agents at enterprise scale?"
                description="Talk to our team about multi-tenant architecture, SSO, guardrails, and federation for your organization."
                primaryCta={{
                    label: "Request a Demo",
                    href: "/contact"
                }}
                secondaryCta={{
                    label: "Read the Docs",
                    href: "/docs"
                }}
            />

            {/* ---------- Related Pages ---------- */}
            <SectionWrapper>
                <RelatedPages
                    title="Explore More"
                    pages={[
                        {
                            title: "Platform Overview",
                            description:
                                "See the full AgentC2 architecture — agents, workflows, integrations, and the learning loop.",
                            href: "/platform"
                        },
                        {
                            title: "Embed Partners",
                            description:
                                "White-label AI agents inside your own product with the AgentC2 embed SDK.",
                            href: "/embed-partners"
                        },
                        {
                            title: "Federation",
                            description:
                                "Cross-organization agent collaboration with end-to-end encryption and policy enforcement.",
                            href: "/platform/federation"
                        }
                    ]}
                />
            </SectionWrapper>
        </>
    );
}
