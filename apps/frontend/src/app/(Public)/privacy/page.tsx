import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description:
        "AgentC2 Privacy Policy — Learn how we collect, use, and protect your data. GDPR and CCPA compliant.",
    alternates: {
        canonical: "https://agentc2.ai/privacy"
    }
};

export default function PrivacyPolicyPage() {
    return (
        <main className="mx-auto max-w-4xl px-6 py-16">
            <h1 className="text-foreground mb-2 text-4xl font-bold tracking-tight">
                Privacy Policy
            </h1>
            <p className="text-muted-foreground mb-4 text-sm">Effective Date: February 13, 2026</p>
            <p className="text-muted-foreground mb-12 text-sm">Last updated: February 13, 2026</p>

            <div className="max-w-none space-y-10">
                {/* 1. Introduction */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">1. Introduction</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        AgentC2 (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is operated by
                        Appello Software Pty Ltd (ABN 62 641 990 128), a company registered in
                        Queensland, Australia. We operate the AgentC2 AI agent platform at{" "}
                        <a href="https://agentc2.ai" className="text-primary hover:underline">
                            agentc2.ai
                        </a>
                        . This Privacy Policy explains what data we collect, the legal bases for
                        processing it, how we use and protect it, your rights regarding your data,
                        and how to contact us. We are committed to transparency and to protecting
                        your privacy in accordance with the Australian Privacy Act 1988, the EU
                        General Data Protection Regulation (GDPR), the California Consumer Privacy
                        Act (CCPA), and other applicable privacy laws.
                    </p>
                </section>

                {/* 2. Data Controller */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        2. Data Controller
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Appello Software Pty Ltd is the data controller responsible for your
                        personal data processed through the AgentC2 platform. For questions about
                        data processing or to exercise your rights, contact us at{" "}
                        <a
                            href="mailto:privacy@agentc2.ai"
                            className="text-primary hover:underline"
                        >
                            privacy@agentc2.ai
                        </a>
                        .
                    </p>
                </section>

                {/* 3. What AgentC2 Does */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        3. What AgentC2 Does
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        AgentC2 is a platform that lets you build, deploy, and manage AI agents.
                        These agents connect to your existing business tools — email, calendar, CRM,
                        project management, file storage, and communication platforms — and perform
                        tasks on your behalf based on instructions you configure. Agents can read
                        and send emails, manage calendar events, search files, update CRM records,
                        post messages, and more. The platform supports multiple AI model providers
                        (OpenAI, Anthropic), workflow automation, voice agents, knowledge base
                        management, and multi-channel deployment (Slack, email, voice, web, API).
                    </p>
                </section>

                {/* 4. Information We Collect */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        4. Information We Collect
                    </h2>

                    <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">
                        4.1 Account Information
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        When you create an account, we collect your name, email address, and
                        authentication credentials. If you sign in with Google or another OAuth
                        provider, we receive your basic profile information (name, email address,
                        profile photo) as provided by the identity provider.
                    </p>

                    <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">
                        4.2 Google User Data
                    </h3>
                    <p className="text-muted-foreground mb-3 leading-relaxed">
                        When you connect Google services to AgentC2, we request the following OAuth
                        scopes depending on which integrations you enable. We only request scopes
                        needed for the features you activate:
                    </p>

                    <div className="border-border/60 mb-4 rounded-xl border">
                        <div className="border-border/40 border-b px-5 py-3">
                            <h4 className="text-foreground text-sm font-semibold">
                                Gmail Integration
                            </h4>
                        </div>
                        <div className="px-5 py-4">
                            <p className="text-muted-foreground mb-2 text-sm font-medium">
                                Scopes requested:
                            </p>
                            <ul className="text-muted-foreground mb-3 ml-5 list-disc space-y-1 text-sm">
                                <li>
                                    <code className="text-foreground/80 text-xs">gmail.modify</code>{" "}
                                    — Read, label, and archive email messages
                                </li>
                                <li>
                                    <code className="text-foreground/80 text-xs">gmail.send</code> —
                                    Send emails and drafts on your behalf
                                </li>
                            </ul>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                <strong className="text-foreground">Purpose:</strong> AI agents read
                                incoming emails for triage and classification, draft and send
                                responses, archive processed messages, and power email-based
                                workflows you configure. We only access Gmail data when you
                                explicitly enable the Gmail integration and instruct an agent to
                                interact with your email.
                            </p>
                        </div>
                    </div>

                    <div className="border-border/60 mb-4 rounded-xl border">
                        <div className="border-border/40 border-b px-5 py-3">
                            <h4 className="text-foreground text-sm font-semibold">
                                Google Calendar Integration
                            </h4>
                        </div>
                        <div className="px-5 py-4">
                            <p className="text-muted-foreground mb-2 text-sm font-medium">
                                Scopes requested:
                            </p>
                            <ul className="text-muted-foreground mb-3 ml-5 list-disc space-y-1 text-sm">
                                <li>
                                    <code className="text-foreground/80 text-xs">
                                        calendar.readonly
                                    </code>{" "}
                                    — Read calendar events and free/busy information
                                </li>
                            </ul>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                <strong className="text-foreground">Purpose:</strong> AI agents read
                                your calendar events to check availability, coordinate meeting
                                schedules, and support calendar-aware workflows. The readonly scope
                                means agents can view but cannot create or modify Google Calendar
                                events.
                            </p>
                        </div>
                    </div>

                    <div className="border-border/60 mb-4 rounded-xl border">
                        <div className="border-border/40 border-b px-5 py-3">
                            <h4 className="text-foreground text-sm font-semibold">
                                Google Drive Integration (via MCP)
                            </h4>
                        </div>
                        <div className="px-5 py-4">
                            <p className="text-muted-foreground mb-2 text-sm font-medium">
                                Access via:
                            </p>
                            <ul className="text-muted-foreground mb-3 ml-5 list-disc space-y-1 text-sm">
                                <li>
                                    Google Drive MCP server using service-account or user-delegated
                                    credentials
                                </li>
                            </ul>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                <strong className="text-foreground">Purpose:</strong> AI agents
                                search and read documents (Google Docs, Sheets, Slides, PDFs) from
                                your Drive to power knowledge base ingestion, document retrieval,
                                and RAG (Retrieval Augmented Generation) workflows. Drive access is
                                read-only.
                            </p>
                        </div>
                    </div>

                    <div className="border-border/60 mb-4 rounded-xl border">
                        <div className="border-border/40 border-b px-5 py-3">
                            <h4 className="text-foreground text-sm font-semibold">
                                Google Profile Information
                            </h4>
                        </div>
                        <div className="px-5 py-4">
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                <strong className="text-foreground">Purpose:</strong> We access your
                                basic profile (name, email, profile photo) for authentication and to
                                identify you within the platform. This is standard for Google
                                Sign-In.
                            </p>
                        </div>
                    </div>

                    <div className="bg-muted/30 border-primary/20 mb-6 rounded-xl border px-5 py-4">
                        <p className="text-foreground text-sm leading-relaxed">
                            <strong>Google API Services User Data Policy Compliance:</strong>{" "}
                            <span className="text-muted-foreground">
                                AgentC2&apos;s use and transfer to any other app of information
                                received from Google APIs will adhere to the{" "}
                                <a
                                    href="https://developers.google.com/terms/api-services-user-data-policy"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    Google API Services User Data Policy
                                </a>
                                , including the Limited Use requirements. Specifically:
                            </span>
                        </p>
                        <ul className="text-muted-foreground mt-3 ml-5 list-disc space-y-2 text-sm leading-relaxed">
                            <li>
                                We limit our use of Google user data to providing and improving the
                                AgentC2 platform features you explicitly enable
                            </li>
                            <li>We do not use Google user data for serving advertisements</li>
                            <li>
                                We do not allow humans to read your Google data except: (a) with
                                your express affirmative consent; (b) as necessary for security
                                purposes such as investigating abuse; (c) to comply with applicable
                                law; or (d) when the data is aggregated and anonymized for internal
                                operations
                            </li>
                            <li>
                                We do not transfer or sell Google user data to third parties except
                                as necessary to provide the Service (e.g., sending data to AI model
                                providers for agent responses) or as required by law
                            </li>
                        </ul>
                    </div>

                    <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">
                        4.3 Microsoft User Data
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        When you connect Microsoft 365, we request the following Microsoft Graph API
                        permissions:
                    </p>
                    <ul className="text-muted-foreground mt-2 ml-5 list-disc space-y-1 text-sm">
                        <li>
                            <code className="text-foreground/80 text-xs">Mail.Read</code>,{" "}
                            <code className="text-foreground/80 text-xs">Mail.ReadWrite</code>,{" "}
                            <code className="text-foreground/80 text-xs">Mail.Send</code> — Read,
                            manage, and send Outlook emails
                        </li>
                        <li>
                            <code className="text-foreground/80 text-xs">Calendars.Read</code>,{" "}
                            <code className="text-foreground/80 text-xs">Calendars.ReadWrite</code>{" "}
                            — Read and manage Outlook calendar events
                        </li>
                        <li>
                            <code className="text-foreground/80 text-xs">User.Read</code> — Read
                            your basic profile (name, email)
                        </li>
                    </ul>
                    <p className="text-muted-foreground mt-2 leading-relaxed">
                        <strong className="text-foreground">Purpose:</strong> AI agents read,
                        archive, and send Outlook emails, and create, update, and read calendar
                        events for scheduling workflows.
                    </p>

                    <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">
                        4.4 Dropbox User Data
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        When you connect Dropbox, we use OAuth2 with PKCE to request access to your
                        files. AI agents can list, read, upload, and search files in your Dropbox,
                        as well as access sharing links. This supports document workflows, file
                        retrieval, and knowledge base ingestion.
                    </p>

                    <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">
                        4.5 Other Third-Party Integration Data
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        When you connect services such as HubSpot, Jira, Slack, GitHub, Fathom, or
                        JustCall, we store encrypted OAuth tokens or API keys and access only the
                        data necessary to execute the agent tasks you configure. These integrations
                        connect via MCP (Model Context Protocol) servers. All credentials are
                        encrypted at rest using AES-256-GCM encryption (see our{" "}
                        <Link href="/security" className="text-primary hover:underline">
                            Security Policy
                        </Link>{" "}
                        for details).
                    </p>

                    <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">
                        4.6 Usage and Operational Data
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        We collect data about how you use the platform: agent run logs, workflow
                        execution traces, tool call metadata (which tools were called and when),
                        model usage statistics, token counts, cost data, and performance metrics.
                        This data powers the analytics dashboards, evaluation scoring, and
                        continuous learning features visible in your account.
                    </p>

                    <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">
                        4.7 Conversation and Knowledge Base Data
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        Messages exchanged with AI agents, conversation history, agent instructions,
                        and documents you upload to the knowledge base are stored in our database to
                        provide persistent memory, semantic recall across sessions, and the
                        continuous learning feature.
                    </p>

                    <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">
                        4.8 Technical and Device Data
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        When you access the Service, we automatically collect certain technical
                        information including your IP address, browser type and version, operating
                        system, device type, referring URL, pages viewed, and timestamps. This data
                        is used for security monitoring, performance optimization, and
                        troubleshooting.
                    </p>
                </section>

                {/* 5. Legal Basis for Processing */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        5. Legal Basis for Processing (GDPR)
                    </h2>
                    <p className="text-muted-foreground mb-3 leading-relaxed">
                        If you are located in the European Economic Area (EEA), United Kingdom, or
                        other jurisdictions that require a legal basis for processing personal data,
                        we rely on the following:
                    </p>
                    <div className="border-border/60 rounded-xl border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-border/40 border-b">
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Legal Basis
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Applies To
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-border/40 divide-y">
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Contract Performance
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Processing necessary to provide the Service you requested
                                        (account management, agent execution, integration
                                        connectivity)
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Consent
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        When you explicitly connect a Third-Party Service (e.g.,
                                        authorizing Gmail access via OAuth); you may withdraw
                                        consent by disconnecting the integration at any time
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Legitimate Interest
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Security monitoring, fraud prevention, service improvement,
                                        analytics, and troubleshooting, balanced against your
                                        privacy rights
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Legal Obligation
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Compliance with applicable laws, regulations, or valid legal
                                        processes
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* 6. How We Use Your Information */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        6. How We Use Your Information
                    </h2>
                    <p className="text-muted-foreground mb-3 leading-relaxed">
                        We use the information we collect to:
                    </p>
                    <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                        <li>
                            Provide, operate, and maintain the AgentC2 platform and the agent
                            features you configure
                        </li>
                        <li>
                            Execute agent tasks: reading/sending emails, managing calendar events,
                            searching files, updating CRM data, posting Slack messages, creating
                            Jira tickets, and other actions you instruct your agents to perform
                        </li>
                        <li>
                            Store conversation history and agent memory to provide continuity across
                            sessions
                        </li>
                        <li>
                            Power continuous learning — analyzing agent performance to generate
                            improvement proposals, run A/B experiments, and promote winning agent
                            configurations (with your approval for high-risk changes)
                        </li>
                        <li>
                            Generate analytics, run traces, cost reports, and evaluation scores
                            visible in your dashboard
                        </li>
                        <li>
                            Authenticate your identity, manage your account, and enforce
                            workspace-level access controls
                        </li>
                        <li>
                            Detect, prevent, and address fraud, abuse, security incidents, and
                            technical issues
                        </li>
                        <li>
                            Send service-related communications (account verification, security
                            alerts, service updates, policy changes)
                        </li>
                        <li>Comply with legal obligations</li>
                    </ul>

                    <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">
                        What We Do Not Do
                    </h3>
                    <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                        <li>
                            We do <strong className="text-foreground">not</strong> sell your
                            personal data or any user data from connected services to third parties
                        </li>
                        <li>
                            We do <strong className="text-foreground">not</strong> use your data for
                            advertising, ad targeting, ad profiling, or data brokering
                        </li>
                        <li>
                            We do <strong className="text-foreground">not</strong> share Google user
                            data with third parties except as necessary to provide the Service
                            (e.g., sending prompts to OpenAI/Anthropic for agent responses) or as
                            required by law
                        </li>
                        <li>
                            We do <strong className="text-foreground">not</strong> train
                            general-purpose AI models on your private data — your data is used only
                            for your agents within your account
                        </li>
                        <li>
                            We do <strong className="text-foreground">not</strong> allow human
                            employees to read your Google data except with your explicit affirmative
                            agreement, for security investigation, or as required by law
                        </li>
                    </ul>
                </section>

                {/* 7. Data Sharing */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        7. Data Sharing with Third Parties
                    </h2>
                    <p className="text-muted-foreground mb-3 leading-relaxed">
                        To provide the Service, your data may be transmitted to the following
                        categories of third-party services. We only share the minimum data necessary
                        for each service to function:
                    </p>
                    <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                        <li>
                            <strong className="text-foreground">AI Model Providers</strong> (OpenAI,
                            Anthropic): Conversation messages and context are sent to these
                            providers to generate agent responses. These providers process data
                            according to their own privacy policies and data processing agreements.
                            We use API endpoints that do not use your data for model training.
                        </li>
                        <li>
                            <strong className="text-foreground">Voice Providers</strong>{" "}
                            (ElevenLabs): When voice agent features are enabled, text is sent for
                            speech synthesis and voice data is processed for speech-to-text.
                        </li>
                        <li>
                            <strong className="text-foreground">Integration Providers</strong>{" "}
                            (Google, Microsoft, HubSpot, Jira, Slack, GitHub, Dropbox, Fathom,
                            JustCall): Data is transmitted to and from these services when agents
                            execute tasks via their APIs, as configured by you.
                        </li>
                        <li>
                            <strong className="text-foreground">Infrastructure Providers</strong>{" "}
                            (Supabase for database hosting, Digital Ocean for application hosting):
                            Your data is stored on infrastructure operated by these providers,
                            subject to their security practices and data processing agreements.
                        </li>
                    </ul>
                    <p className="text-muted-foreground mt-3 leading-relaxed">
                        We do not share your data with any other third parties for their own
                        marketing or commercial purposes. We may disclose your data if required by
                        law, legal process, or government request, or to protect the rights,
                        property, or safety of AgentC2, our users, or the public.
                    </p>
                </section>

                {/* 8. International Data Transfers */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        8. International Data Transfers
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Our servers are hosted in data centers operated by Digital Ocean and
                        Supabase, which may be located outside your country of residence. AI model
                        providers (OpenAI, Anthropic) process data in the United States. When your
                        data is transferred to jurisdictions that may not have equivalent data
                        protection laws, we take appropriate safeguards including:
                    </p>
                    <ul className="text-muted-foreground mt-2 ml-5 list-disc space-y-2 text-sm leading-relaxed">
                        <li>
                            Standard Contractual Clauses (SCCs) or equivalent mechanisms where
                            required
                        </li>
                        <li>Data processing agreements with all sub-processors</li>
                        <li>Technical measures including encryption in transit and at rest</li>
                        <li>
                            Contractual commitments from sub-processors to maintain appropriate data
                            protection standards
                        </li>
                    </ul>
                </section>

                {/* 9. Cookies and Tracking */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        9. Cookies and Tracking Technologies
                    </h2>
                    <p className="text-muted-foreground mb-3 leading-relaxed">
                        We use a limited set of cookies strictly necessary for the operation of the
                        Service:
                    </p>
                    <div className="border-border/60 rounded-xl border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-border/40 border-b">
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Cookie Type
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Purpose
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Duration
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-border/40 divide-y">
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Session Cookie
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Authentication and session management (HttpOnly, Secure,
                                        SameSite)
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Session / 30 days
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        CSRF Token
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Cross-site request forgery protection
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">Session</td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        OAuth State
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Temporary state parameter during OAuth flows
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">10 minutes</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="text-muted-foreground mt-3 leading-relaxed">
                        We do not use advertising cookies, tracking pixels, or third-party analytics
                        services that track you across websites. We do not participate in cross-site
                        tracking or behavioral advertising.
                    </p>
                </section>

                {/* 10. Data Storage and Security */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        10. Data Storage and Security
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Your data is stored in PostgreSQL databases hosted on Supabase, with the
                        application server hosted on Digital Ocean. For a detailed description of
                        our security practices, please see our{" "}
                        <Link href="/security" className="text-primary hover:underline">
                            Security Policy
                        </Link>
                        . Key measures include:
                    </p>
                    <ul className="text-muted-foreground mt-2 ml-5 list-disc space-y-2 text-sm leading-relaxed">
                        <li>
                            AES-256-GCM encryption for all stored OAuth tokens and integration
                            credentials
                        </li>
                        <li>HTTPS/TLS encryption for all data in transit</li>
                        <li>
                            PKCE (Proof Key for Code Exchange) for all OAuth2 authorization flows
                        </li>
                        <li>
                            Session-based authentication via Better Auth with secure, HttpOnly
                            cookies
                        </li>
                        <li>Multi-tenant workspace isolation with role-based access controls</li>
                        <li>Comprehensive audit logging of administrative actions</li>
                        <li>Database not directly accessible from the public internet</li>
                        <li>SSH key-based server access only (no password authentication)</li>
                    </ul>
                </section>

                {/* 11. Data Retention */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        11. Data Retention
                    </h2>
                    <p className="text-muted-foreground mb-3 leading-relaxed">
                        We retain your data for as long as your account is active or as needed to
                        provide our services. Specific retention periods:
                    </p>
                    <div className="border-border/60 rounded-xl border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-border/40 border-b">
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Data Type
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Retention Period
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-border/40 divide-y">
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Account data
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Until you request account deletion
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Integration credentials
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Deleted immediately when you disconnect an integration
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Agent run logs and traces
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Retained while your account is active; deleted within 30
                                        days of account deletion
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Conversation history
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Retained for persistent agent memory while your account is
                                        active; deleted within 30 days of account deletion
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Knowledge base documents
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Retained until you delete them or request account deletion
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Audit logs
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Retained for 12 months for security and compliance purposes
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-foreground px-5 py-3 font-medium">
                                        Technical/server logs
                                    </td>
                                    <td className="text-muted-foreground px-5 py-3">
                                        Retained for 90 days for troubleshooting and security
                                        monitoring
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="text-muted-foreground mt-3 leading-relaxed">
                        You may request deletion of your account and all associated data at any time
                        by contacting{" "}
                        <a
                            href="mailto:privacy@agentc2.ai"
                            className="text-primary hover:underline"
                        >
                            privacy@agentc2.ai
                        </a>
                        . We will process deletion requests within 30 days and confirm completion.
                        Some data may be retained longer if required by law or for legitimate
                        business purposes (e.g., resolving disputes, enforcing agreements).
                    </p>
                </section>

                {/* 12. Your Rights */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">12. Your Rights</h2>
                    <p className="text-muted-foreground mb-3 leading-relaxed">
                        Depending on your jurisdiction, you may have the following rights regarding
                        your personal data:
                    </p>
                    <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                        <li>
                            <strong className="text-foreground">Right of Access</strong> — Request a
                            copy of the personal data we hold about you
                        </li>
                        <li>
                            <strong className="text-foreground">Right to Rectification</strong> —
                            Request correction of inaccurate or incomplete data
                        </li>
                        <li>
                            <strong className="text-foreground">Right to Erasure</strong> — Request
                            deletion of your account and all associated data
                        </li>
                        <li>
                            <strong className="text-foreground">
                                Right to Restrict Processing
                            </strong>{" "}
                            — Request that we limit how we use your data in certain circumstances
                        </li>
                        <li>
                            <strong className="text-foreground">Right to Data Portability</strong> —
                            Request your data in a structured, machine-readable format
                        </li>
                        <li>
                            <strong className="text-foreground">Right to Object</strong> — Object to
                            processing based on legitimate interests
                        </li>
                        <li>
                            <strong className="text-foreground">Right to Withdraw Consent</strong> —
                            Withdraw consent at any time where processing is based on consent (e.g.,
                            disconnecting an integration)
                        </li>
                        <li>
                            <strong className="text-foreground">Disconnect Integrations</strong> —
                            Disconnect any third-party integration at any time from your dashboard,
                            which immediately deletes stored credentials and ceases access
                        </li>
                        <li>
                            <strong className="text-foreground">Revoke Google Access</strong> —
                            Revoke access at any time via your{" "}
                            <a
                                href="https://myaccount.google.com/permissions"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                            >
                                Google Account permissions page
                            </a>
                        </li>
                        <li>
                            <strong className="text-foreground">Revoke Microsoft Access</strong> —
                            Revoke access via your{" "}
                            <a
                                href="https://account.microsoft.com/privacy/app-access"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                            >
                                Microsoft privacy dashboard
                            </a>
                        </li>
                    </ul>
                    <p className="text-muted-foreground mt-3 leading-relaxed">
                        To exercise any of these rights, contact us at{" "}
                        <a
                            href="mailto:privacy@agentc2.ai"
                            className="text-primary hover:underline"
                        >
                            privacy@agentc2.ai
                        </a>
                        . We will respond to your request within 30 days (or sooner as required by
                        applicable law). We will not discriminate against you for exercising your
                        privacy rights.
                    </p>
                </section>

                {/* 13. California Privacy Rights (CCPA) */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        13. California Privacy Rights (CCPA/CPRA)
                    </h2>
                    <p className="text-muted-foreground mb-3 leading-relaxed">
                        If you are a California resident, the California Consumer Privacy Act (CCPA)
                        and California Privacy Rights Act (CPRA) provide you with additional rights:
                    </p>
                    <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                        <li>
                            <strong className="text-foreground">Right to Know</strong> — You can
                            request information about the categories and specific pieces of personal
                            information we have collected, the sources, the business purpose, and
                            the categories of third parties with whom we share it
                        </li>
                        <li>
                            <strong className="text-foreground">Right to Delete</strong> — You can
                            request deletion of personal information we have collected from you
                        </li>
                        <li>
                            <strong className="text-foreground">Right to Opt-Out of Sale</strong> —
                            We do not sell your personal information. We do not share your personal
                            information for cross-context behavioral advertising
                        </li>
                        <li>
                            <strong className="text-foreground">Right to Non-Discrimination</strong>{" "}
                            — We will not discriminate against you for exercising any of your
                            CCPA/CPRA rights
                        </li>
                    </ul>
                    <p className="text-muted-foreground mt-3 leading-relaxed">
                        To exercise your California privacy rights, contact us at{" "}
                        <a
                            href="mailto:privacy@agentc2.ai"
                            className="text-primary hover:underline"
                        >
                            privacy@agentc2.ai
                        </a>
                        . We will verify your identity before processing your request.
                    </p>
                </section>

                {/* 14. Do Not Track */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        14. Do Not Track Signals
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Our Service does not track users across third-party websites and therefore
                        does not respond to Do Not Track (DNT) signals. We do not use third-party
                        tracking cookies or participate in cross-site tracking.
                    </p>
                </section>

                {/* 15. Children's Privacy */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        15. Children&apos;s Privacy
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        AgentC2 is a business tool not intended for use by individuals under the age
                        of 18. We do not knowingly collect personal information from children under
                        18 (or under 16 in the EEA). If we learn that we have collected data from a
                        child under the applicable age threshold, we will delete it promptly. If you
                        believe we have inadvertently collected such data, please contact us at{" "}
                        <a
                            href="mailto:privacy@agentc2.ai"
                            className="text-primary hover:underline"
                        >
                            privacy@agentc2.ai
                        </a>
                        .
                    </p>
                </section>

                {/* 16. Changes to This Policy */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        16. Changes to This Policy
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We may update this Privacy Policy from time to time. We will notify you of
                        material changes by: (a) posting the updated policy on this page with a new
                        &quot;Last updated&quot; date; and (b) for significant changes, sending
                        notice via email or an in-app notification at least 30 days before the
                        changes take effect. We encourage you to review this policy periodically.
                        Continued use of the Service after the effective date of changes constitutes
                        acceptance of the updated policy.
                    </p>
                </section>

                {/* 17. Complaints */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">17. Complaints</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        If you are unsatisfied with our response to a privacy concern, you have the
                        right to lodge a complaint with the relevant data protection authority in
                        your jurisdiction:
                    </p>
                    <ul className="text-muted-foreground mt-2 ml-5 list-disc space-y-2 text-sm leading-relaxed">
                        <li>
                            <strong className="text-foreground">Australia:</strong> Office of the
                            Australian Information Commissioner (OAIC) —{" "}
                            <a
                                href="https://www.oaic.gov.au"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                            >
                                oaic.gov.au
                            </a>
                        </li>
                        <li>
                            <strong className="text-foreground">EU/EEA:</strong> Your local Data
                            Protection Authority (DPA)
                        </li>
                        <li>
                            <strong className="text-foreground">UK:</strong> Information
                            Commissioner&apos;s Office (ICO) —{" "}
                            <a
                                href="https://ico.org.uk"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                            >
                                ico.org.uk
                            </a>
                        </li>
                    </ul>
                </section>

                {/* 18. Contact Us */}
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">18. Contact Us</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        If you have questions or concerns about this Privacy Policy or our data
                        practices:
                    </p>
                    <div className="text-muted-foreground mt-4 space-y-1 text-sm">
                        <p>
                            <strong className="text-foreground">Appello Software Pty Ltd</strong>{" "}
                            (ABN 62 641 990 128), trading as AgentC2
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
                            Security concerns:{" "}
                            <a
                                href="mailto:security@agentc2.ai"
                                className="text-primary hover:underline"
                            >
                                security@agentc2.ai
                            </a>
                        </p>
                        <p>
                            General contact:{" "}
                            <a
                                href="mailto:hello@agentc2.ai"
                                className="text-primary hover:underline"
                            >
                                hello@agentc2.ai
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
