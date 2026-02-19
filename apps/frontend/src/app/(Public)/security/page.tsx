import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Security Policy",
    description:
        "AgentC2 Security Policy — How we protect your data, credentials, and integrations.",
    alternates: {
        canonical: "https://agentc2.ai/security"
    }
};

export default function SecurityPolicyPage() {
    return (
        <main className="mx-auto max-w-4xl px-6 py-16">
            <h1 className="text-foreground mb-2 text-4xl font-bold tracking-tight">
                Security Policy
            </h1>
            <p className="text-muted-foreground mb-4 text-sm">Effective Date: February 13, 2026</p>
            <p className="text-muted-foreground mb-12 text-sm">Last updated: February 13, 2026</p>

            <div className="max-w-none space-y-10">
                {/* 1. Overview */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">1. Overview</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        AgentC2 is an AI agent platform that connects to your business tools —
                        email, calendar, CRM, project management, file storage, and communication
                        services. Because our platform handles sensitive integration credentials and
                        accesses third-party services on your behalf, security is foundational to
                        how we build and operate the system. This policy describes the specific
                        technical measures we implement to protect your data.
                    </p>
                </section>

                {/* 2. Credential Encryption */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        2. Credential Encryption at Rest
                    </h2>
                    <p className="text-muted-foreground mb-3 leading-relaxed">
                        All third-party integration credentials (OAuth access tokens, refresh
                        tokens, API keys) are encrypted before storage using industry-standard
                        encryption:
                    </p>
                    <div className="border-border/60 rounded-xl border">
                        <table className="w-full text-sm">
                            <tbody className="divide-border/40 divide-y">
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Algorithm
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        AES-256-GCM (Advanced Encryption Standard, 256-bit key,
                                        Galois/Counter Mode)
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Key Size
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        256 bits (32 bytes), derived from a hex-encoded environment
                                        variable
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        IV (Initialization Vector)
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        12 bytes, randomly generated per encryption operation using{" "}
                                        <code className="text-foreground/80 text-xs">
                                            crypto.randomBytes()
                                        </code>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Authentication
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        GCM authentication tag stored alongside ciphertext, ensuring
                                        tamper detection
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Storage Format
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Encrypted payload stored as a JSON object with version tag,
                                        base64-encoded IV, authentication tag, and ciphertext
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="text-muted-foreground mt-3 leading-relaxed">
                        Credentials are encrypted immediately upon receipt (e.g., after an OAuth
                        callback) and decrypted only at the moment of use (e.g., when making an API
                        call to a third-party service). The encryption key is stored as a
                        server-side environment variable and is never exposed to client-side code or
                        API responses.
                    </p>
                </section>

                {/* 3. OAuth Security */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        3. OAuth and Authentication Security
                    </h2>

                    <h3 className="text-foreground mt-4 mb-2 text-lg font-medium">
                        OAuth2 with PKCE
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        All OAuth2 authorization flows that support it use PKCE (Proof Key for Code
                        Exchange, RFC 7636) to prevent authorization code interception attacks. This
                        applies to our Microsoft and Dropbox integrations, which generate a random
                        code verifier and SHA-256 code challenge for every authorization request.
                    </p>

                    <h3 className="text-foreground mt-4 mb-2 text-lg font-medium">
                        Automatic Token Refresh
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        Access tokens are automatically refreshed before expiry (with a 5-minute
                        buffer) and on 401 responses. If a refresh permanently fails (e.g., the user
                        revoked consent), the integration connection is automatically marked
                        inactive and no further API calls are attempted until the user
                        re-authenticates.
                    </p>

                    <h3 className="text-foreground mt-4 mb-2 text-lg font-medium">
                        Session-Based Authentication
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        User authentication is handled by Better Auth, which provides session-based
                        authentication with secure, HttpOnly, SameSite cookies. Sessions are stored
                        server-side in the database. We do not use client-side JWTs for
                        authentication.
                    </p>

                    <h3 className="text-foreground mt-4 mb-2 text-lg font-medium">
                        Slack Webhook Verification
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        Incoming Slack webhook events are verified using the Slack signing secret
                        (HMAC-SHA256) to ensure requests originate from Slack and have not been
                        tampered with.
                    </p>
                </section>

                {/* 4. Transport Security */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        4. Transport Security
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        All data transmitted between your browser and our servers is encrypted using
                        HTTPS/TLS. In production, TLS termination is handled by Caddy with automatic
                        certificate management (via Let&apos;s Encrypt). All API calls to
                        third-party services (Google, Microsoft, HubSpot, Slack, etc.) are made over
                        HTTPS.
                    </p>
                </section>

                {/* 5. Infrastructure Security */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        5. Infrastructure Security
                    </h2>
                    <ul className="text-muted-foreground ml-5 list-disc space-y-3 text-sm leading-relaxed">
                        <li>
                            <strong className="text-foreground">Database:</strong> PostgreSQL hosted
                            on Supabase with connection-level encryption. The database is not
                            directly accessible from the public internet.
                        </li>
                        <li>
                            <strong className="text-foreground">Application Server:</strong> Hosted
                            on Digital Ocean with SSH key-based access only (no password
                            authentication). Process management via PM2 with automatic restarts.
                        </li>
                        <li>
                            <strong className="text-foreground">Reverse Proxy:</strong> Caddy
                            handles TLS termination, request routing, and HTTPS enforcement. HTTP
                            requests are automatically redirected to HTTPS.
                        </li>
                        <li>
                            <strong className="text-foreground">Environment Variables:</strong> All
                            secrets (API keys, encryption keys, OAuth credentials) are stored as
                            environment variables on the server, never committed to source control
                            or exposed to client-side code.
                        </li>
                    </ul>
                </section>

                {/* 6. Access Controls */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        6. Access Controls and Multi-Tenancy
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        AgentC2 implements multi-tenant architecture with organization and workspace
                        isolation:
                    </p>
                    <ul className="text-muted-foreground mt-2 ml-5 list-disc space-y-2 text-sm leading-relaxed">
                        <li>
                            Each organization has its own agents, integrations, workflows, and data
                            — fully isolated from other organizations
                        </li>
                        <li>
                            Integration credentials are scoped to organizations. One organization
                            cannot access another&apos;s credentials or connected services
                        </li>
                        <li>
                            Role-based access controls within organizations govern who can configure
                            agents, manage integrations, and view analytics
                        </li>
                        <li>
                            Agent budget controls and guardrail policies limit per-agent spend and
                            enforce content safety rules
                        </li>
                    </ul>
                </section>

                {/* 7. Audit Logging */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        7. Audit Logging
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        All administrative actions are recorded in an audit log, including:
                    </p>
                    <ul className="text-muted-foreground mt-2 ml-5 list-disc space-y-2 text-sm leading-relaxed">
                        <li>Agent creation, updates, and version changes</li>
                        <li>Integration connections and disconnections</li>
                        <li>Workflow and network modifications</li>
                        <li>User and organization management changes</li>
                        <li>Agent run execution, including tool calls and model interactions</li>
                    </ul>
                    <p className="text-muted-foreground mt-2 leading-relaxed">
                        Audit logs include timestamps, actor identity, action type, and entity
                        details. These logs are available to organization administrators through the
                        platform dashboard.
                    </p>
                </section>

                {/* 8. Data Minimization */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        8. Data Minimization
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We follow the principle of least privilege for all integrations:
                    </p>
                    <ul className="text-muted-foreground mt-2 ml-5 list-disc space-y-2 text-sm leading-relaxed">
                        <li>
                            OAuth scopes are requested per-integration, not globally. We only
                            request the scopes necessary for the features you enable.
                        </li>
                        <li>
                            Integration data is accessed only when agents actively execute tasks,
                            not continuously or in bulk
                        </li>
                        <li>
                            When you disconnect an integration, stored OAuth tokens are deleted and
                            all API access ceases immediately
                        </li>
                        <li>
                            Google Calendar access uses{" "}
                            <code className="text-foreground/80 text-xs">calendar.readonly</code>{" "}
                            rather than full write access, reflecting actual feature requirements
                        </li>
                    </ul>
                </section>

                {/* 9. Incident Response */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        9. Incident Response
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        In the event of a security incident affecting user data:
                    </p>
                    <ul className="text-muted-foreground mt-2 ml-5 list-disc space-y-2 text-sm leading-relaxed">
                        <li>We will investigate and contain the incident as quickly as possible</li>
                        <li>
                            Affected users will be notified within 72 hours of confirmed impact,
                            including details of what data was affected and what steps we are taking
                        </li>
                        <li>
                            We will revoke compromised credentials and rotate encryption keys as
                            necessary
                        </li>
                        <li>Relevant authorities will be notified as required by applicable law</li>
                    </ul>
                </section>

                {/* 10. Vulnerability Disclosure */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        10. Vulnerability Reporting
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        If you discover a security vulnerability in AgentC2, please report it
                        responsibly by emailing{" "}
                        <a
                            href="mailto:security@agentc2.ai"
                            className="text-primary hover:underline"
                        >
                            security@agentc2.ai
                        </a>
                        . We ask that you:
                    </p>
                    <ul className="text-muted-foreground mt-2 ml-5 list-disc space-y-2 text-sm leading-relaxed">
                        <li>Provide enough detail to reproduce the issue</li>
                        <li>Avoid accessing or modifying other users&apos; data</li>
                        <li>
                            Allow us reasonable time to investigate and patch before public
                            disclosure
                        </li>
                    </ul>
                    <p className="text-muted-foreground mt-2 leading-relaxed">
                        We take all security reports seriously and will acknowledge receipt within
                        48 hours.
                    </p>
                </section>

                {/* 11. Contact */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">11. Contact</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        For security questions or concerns:
                    </p>
                    <div className="text-muted-foreground mt-4 space-y-1 text-sm">
                        <p>
                            <strong className="text-foreground">Appello Software Pty Ltd</strong>{" "}
                            trading as AgentC2
                        </p>
                        <p>
                            Security:{" "}
                            <a
                                href="mailto:security@agentc2.ai"
                                className="text-primary hover:underline"
                            >
                                security@agentc2.ai
                            </a>
                        </p>
                        <p>
                            Privacy:{" "}
                            <a
                                href="mailto:privacy@agentc2.ai"
                                className="text-primary hover:underline"
                            >
                                privacy@agentc2.ai
                            </a>
                        </p>
                        <p>
                            Website:{" "}
                            <a href="https://agentc2.ai" className="text-primary hover:underline">
                                https://agentc2.ai
                            </a>
                        </p>
                    </div>
                </section>
            </div>
        </main>
    );
}
