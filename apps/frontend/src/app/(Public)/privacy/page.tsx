import type { Metadata } from "next";
import Link from "next/link";
import { AgentC2Logo } from "@repo/ui";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description: "AgentC2 Privacy Policy — Learn how we collect, use, and protect your data."
};

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen">
            {/* Nav */}
            <header className="border-border/50 border-b">
                <nav className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
                    <Link href="/" className="flex items-center gap-2">
                        <AgentC2Logo size={28} />
                        <span className="text-lg font-semibold tracking-tight">AgentC2</span>
                    </Link>
                    <div className="flex items-center gap-6">
                        <Link
                            href="/terms"
                            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                        >
                            Terms
                        </Link>
                        <Link
                            href="/security"
                            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                        >
                            Security
                        </Link>
                        <Link
                            href="/"
                            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                        >
                            Home
                        </Link>
                    </div>
                </nav>
            </header>

            {/* Content */}
            <main className="mx-auto max-w-4xl px-6 py-16">
                <h1 className="text-foreground mb-2 text-4xl font-bold tracking-tight">
                    Privacy Policy
                </h1>
                <p className="text-muted-foreground mb-12 text-sm">
                    Last updated: February 12, 2026
                </p>

                <div className="max-w-none space-y-10">
                    {/* 1. Introduction */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            1. Introduction
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            AgentC2 (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is operated
                            by Appello Software Pty Ltd (ABN 62 641 990 128). We operate the AgentC2
                            AI agent platform at{" "}
                            <a href="https://agentc2.ai" className="text-primary hover:underline">
                                agentc2.ai
                            </a>
                            . This Privacy Policy explains what data we collect, why we collect it,
                            how we use it, and how we protect it when you use our platform. We are
                            committed to transparency and to protecting your privacy.
                        </p>
                    </section>

                    {/* 2. What AgentC2 Does */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            2. What AgentC2 Does
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            AgentC2 is a platform that lets you build, deploy, and manage AI agents.
                            These agents connect to your existing business tools — email, calendar,
                            CRM, project management, file storage, and communication platforms — and
                            perform tasks on your behalf based on instructions you configure. Agents
                            can read and send emails, manage calendar events, search files, update
                            CRM records, and more. The platform supports multiple AI model providers
                            (OpenAI, Anthropic), workflow automation, voice agents, knowledge base
                            management, and multi-channel deployment (Slack, email, voice, API).
                        </p>
                    </section>

                    {/* 3. Information We Collect */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            3. Information We Collect
                        </h2>

                        <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">
                            3.1 Account Information
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                            When you create an account, we collect your name, email address, and
                            authentication credentials. If you sign in with Google, we receive your
                            basic profile (name, email address, profile photo) via Google OAuth.
                        </p>

                        <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">
                            3.2 Google User Data
                        </h3>
                        <p className="text-muted-foreground mb-3 leading-relaxed">
                            When you connect Google services to AgentC2, we request the following
                            OAuth scopes depending on which integrations you enable. We only request
                            scopes needed for the features you activate:
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
                                        <code className="text-foreground/80 text-xs">
                                            gmail.modify
                                        </code>{" "}
                                        — Read, label, and archive email messages
                                    </li>
                                    <li>
                                        <code className="text-foreground/80 text-xs">
                                            gmail.send
                                        </code>{" "}
                                        — Send emails and drafts on your behalf
                                    </li>
                                </ul>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    <strong className="text-foreground">Purpose:</strong> AI agents
                                    read incoming emails for triage and classification, draft and
                                    send responses, archive processed messages, and power
                                    email-based workflows you configure. We only access Gmail data
                                    when you explicitly enable the Gmail integration and instruct an
                                    agent to interact with your email.
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
                                    <strong className="text-foreground">Purpose:</strong> AI agents
                                    read your calendar events to check availability, coordinate
                                    meeting schedules, and support calendar-aware workflows. The
                                    readonly scope means agents can view but cannot create or modify
                                    Google Calendar events.
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
                                        Google Drive MCP server using service-account or
                                        user-delegated credentials
                                    </li>
                                </ul>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    <strong className="text-foreground">Purpose:</strong> AI agents
                                    search and read documents (Google Docs, Sheets, Slides, PDFs)
                                    from your Drive to power knowledge base ingestion, document
                                    retrieval, and RAG (Retrieval Augmented Generation) workflows.
                                    Drive access is read-only.
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
                                    <strong className="text-foreground">Purpose:</strong> We access
                                    your basic profile (name, email, profile photo) for
                                    authentication and to identify you within the platform. This is
                                    standard for Google Sign-In.
                                </p>
                            </div>
                        </div>

                        <div className="bg-muted/30 border-primary/20 mb-6 rounded-xl border px-5 py-4">
                            <p className="text-foreground text-sm leading-relaxed">
                                <strong>Google API Limited Use Disclosure:</strong>{" "}
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
                                    , including the Limited Use requirements. Specifically, we limit
                                    our use of Google user data to providing and improving the
                                    AgentC2 platform features you enable. We do not use Google data
                                    for serving advertisements. We do not allow humans to read your
                                    Google data except (a) with your express consent, (b) as needed
                                    for security purposes (investigating abuse), or (c) to comply
                                    with applicable law.
                                </span>
                            </p>
                        </div>

                        <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">
                            3.3 Microsoft User Data
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                            When you connect Microsoft 365, we request the following Microsoft Graph
                            API permissions:
                        </p>
                        <ul className="text-muted-foreground mt-2 ml-5 list-disc space-y-1 text-sm">
                            <li>
                                <code className="text-foreground/80 text-xs">Mail.Read</code>,{" "}
                                <code className="text-foreground/80 text-xs">Mail.ReadWrite</code>,{" "}
                                <code className="text-foreground/80 text-xs">Mail.Send</code> —
                                Read, manage, and send Outlook emails
                            </li>
                            <li>
                                <code className="text-foreground/80 text-xs">Calendars.Read</code>,{" "}
                                <code className="text-foreground/80 text-xs">
                                    Calendars.ReadWrite
                                </code>{" "}
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
                            3.4 Dropbox User Data
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                            When you connect Dropbox, we use OAuth2 with PKCE to request access to
                            your files. AI agents can list, read, upload, and search files in your
                            Dropbox, as well as access sharing links. This supports document
                            workflows, file retrieval, and knowledge base ingestion.
                        </p>

                        <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">
                            3.5 Other Third-Party Integration Data
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                            When you connect services such as HubSpot, Jira, Slack, GitHub, Fathom,
                            or JustCall, we store encrypted OAuth tokens or API keys and access only
                            the data necessary to execute the agent tasks you configure. These
                            integrations connect via MCP (Model Context Protocol) servers. All
                            credentials are encrypted at rest using AES-256-GCM encryption (see our{" "}
                            <Link href="/security" className="text-primary hover:underline">
                                Security Policy
                            </Link>{" "}
                            for details).
                        </p>

                        <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">
                            3.6 Usage and Operational Data
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                            We collect data about how you use the platform: agent run logs, workflow
                            execution traces, tool call metadata (which tools were called and when),
                            model usage statistics, token counts, cost data, and performance
                            metrics. This data powers the analytics dashboards, evaluation scoring,
                            and continuous learning features visible in your account.
                        </p>

                        <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">
                            3.7 Conversation and Knowledge Base Data
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                            Messages exchanged with AI agents, conversation history, agent
                            instructions, and documents you upload to the knowledge base are stored
                            in our database to provide persistent memory, semantic recall across
                            sessions, and the continuous learning feature.
                        </p>
                    </section>

                    {/* 4. How We Use Your Information */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            4. How We Use Your Information
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
                                Execute agent tasks: reading/sending emails, managing calendar
                                events, searching files, updating CRM data, posting Slack messages,
                                creating Jira tickets, and other actions you instruct your agents to
                                perform
                            </li>
                            <li>
                                Store conversation history and agent memory to provide continuity
                                across sessions
                            </li>
                            <li>
                                Power continuous learning — analyzing agent performance to generate
                                improvement proposals, run A/B experiments, and promote winning
                                agent configurations (with your approval for high-risk changes)
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
                                Send service-related communications (account verification, security
                                alerts, service updates)
                            </li>
                            <li>Comply with legal obligations</li>
                        </ul>

                        <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">
                            What We Do Not Do
                        </h3>
                        <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                            <li>
                                We do <strong className="text-foreground">not</strong> sell your
                                personal data or any user data from connected services to third
                                parties
                            </li>
                            <li>
                                We do <strong className="text-foreground">not</strong> use your data
                                for advertising, ad targeting, or ad profiling
                            </li>
                            <li>
                                We do <strong className="text-foreground">not</strong> share Google
                                user data with third parties except as necessary to provide the
                                service (e.g., sending prompts to OpenAI/Anthropic for agent
                                responses) or as required by law
                            </li>
                            <li>
                                We do <strong className="text-foreground">not</strong> train
                                general-purpose AI models on your private data. Your data is used
                                only for your agents within your account.
                            </li>
                            <li>
                                We do <strong className="text-foreground">not</strong> allow human
                                employees to read your Google data except with your explicit
                                affirmative agreement, for security investigation, or as required by
                                law
                            </li>
                        </ul>
                    </section>

                    {/* 5. Data Sharing */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            5. Data Sharing with Third Parties
                        </h2>
                        <p className="text-muted-foreground mb-3 leading-relaxed">
                            To provide the service, your data may be transmitted to the following
                            categories of third-party services. We only share the minimum data
                            necessary for each service to function:
                        </p>
                        <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                            <li>
                                <strong className="text-foreground">AI Model Providers</strong>{" "}
                                (OpenAI, Anthropic): Conversation messages and context are sent to
                                these providers to generate agent responses. These providers process
                                data according to their own privacy policies and data processing
                                agreements.
                            </li>
                            <li>
                                <strong className="text-foreground">Voice Providers</strong>{" "}
                                (ElevenLabs): When voice agent features are enabled, text is sent
                                for speech synthesis and voice data is processed for speech-to-text.
                            </li>
                            <li>
                                <strong className="text-foreground">Integration Providers</strong>{" "}
                                (Google, Microsoft, HubSpot, Jira, Slack, GitHub, Dropbox, Fathom,
                                JustCall): Data is transmitted to and from these services when
                                agents execute tasks via their APIs.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Infrastructure Providers
                                </strong>{" "}
                                (Supabase for database hosting, Digital Ocean for server hosting):
                                Your data is stored on infrastructure operated by these providers.
                            </li>
                        </ul>
                        <p className="text-muted-foreground mt-3 leading-relaxed">
                            We do not share your data with any other third parties for their own
                            marketing or commercial purposes.
                        </p>
                    </section>

                    {/* 6. Data Storage and Security */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            6. Data Storage and Security
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Your data is stored in PostgreSQL databases hosted on Supabase, with the
                            application server hosted on Digital Ocean. For a detailed description
                            of our security practices, please see our{" "}
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
                                PKCE (Proof Key for Code Exchange) for all OAuth2 authorization
                                flows (Microsoft, Dropbox)
                            </li>
                            <li>
                                Session-based authentication via Better Auth with secure, HttpOnly
                                cookies
                            </li>
                            <li>
                                Multi-tenant workspace isolation with role-based access controls
                            </li>
                            <li>Comprehensive audit logging of administrative actions</li>
                        </ul>
                    </section>

                    {/* 7. Data Retention */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            7. Data Retention
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            We retain your data for as long as your account is active or as needed
                            to provide our services. Specifically:
                        </p>
                        <ul className="text-muted-foreground mt-2 ml-5 list-disc space-y-2 text-sm leading-relaxed">
                            <li>
                                <strong className="text-foreground">Account data</strong> is
                                retained until you request account deletion
                            </li>
                            <li>
                                <strong className="text-foreground">Integration credentials</strong>{" "}
                                (OAuth tokens) are deleted when you disconnect an integration
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Agent run logs and traces
                                </strong>{" "}
                                are retained for analytics and continuous learning while your
                                account is active
                            </li>
                            <li>
                                <strong className="text-foreground">Conversation history</strong> is
                                retained to provide persistent agent memory
                            </li>
                        </ul>
                        <p className="text-muted-foreground mt-3 leading-relaxed">
                            You may request deletion of your account and all associated data at any
                            time by contacting{" "}
                            <a
                                href="mailto:privacy@agentc2.ai"
                                className="text-primary hover:underline"
                            >
                                privacy@agentc2.ai
                            </a>
                            .
                        </p>
                    </section>

                    {/* 8. Your Rights */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            8. Your Rights
                        </h2>
                        <p className="text-muted-foreground mb-3 leading-relaxed">
                            You have the right to:
                        </p>
                        <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                            <li>
                                <strong className="text-foreground">Access</strong> the personal
                                data we hold about you
                            </li>
                            <li>
                                <strong className="text-foreground">Correct</strong> inaccurate data
                            </li>
                            <li>
                                <strong className="text-foreground">Delete</strong> your account and
                                all associated data
                            </li>
                            <li>
                                <strong className="text-foreground">Disconnect</strong> any
                                third-party integration at any time from your dashboard, which
                                immediately deletes stored credentials and ceases access
                            </li>
                            <li>
                                <strong className="text-foreground">Revoke Google access</strong> at
                                any time via your{" "}
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
                                <strong className="text-foreground">Revoke Microsoft access</strong>{" "}
                                via your{" "}
                                <a
                                    href="https://account.microsoft.com/privacy/app-access"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    Microsoft privacy dashboard
                                </a>
                            </li>
                            <li>
                                <strong className="text-foreground">Export</strong> your data upon
                                request
                            </li>
                        </ul>
                    </section>

                    {/* 9. Children's Privacy */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            9. Children&apos;s Privacy
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            AgentC2 is a business tool not intended for use by individuals under the
                            age of 18. We do not knowingly collect personal information from
                            children. If we learn that we have collected data from a child under 18,
                            we will delete it promptly.
                        </p>
                    </section>

                    {/* 10. Changes */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            10. Changes to This Policy
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            We may update this Privacy Policy from time to time. We will notify you
                            of material changes by posting the updated policy on this page with a
                            new &quot;Last updated&quot; date. For significant changes, we will also
                            notify you via email or an in-app notification.
                        </p>
                    </section>

                    {/* 11. Contact */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            11. Contact Us
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            If you have questions or concerns about this Privacy Policy or our data
                            practices:
                        </p>
                        <div className="text-muted-foreground mt-4 space-y-1 text-sm">
                            <p>
                                <strong className="text-foreground">
                                    Appello Software Pty Ltd
                                </strong>{" "}
                                trading as AgentC2
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
                                <a
                                    href="https://agentc2.ai"
                                    className="text-primary hover:underline"
                                >
                                    https://agentc2.ai
                                </a>
                            </p>
                        </div>
                    </section>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-border/40 border-t">
                <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-8">
                    <p className="text-muted-foreground text-xs">
                        &copy; {new Date().getFullYear()} AgentC2 (Appello Software Pty Ltd). All
                        rights reserved.
                    </p>
                    <div className="flex gap-6">
                        <Link
                            href="/terms"
                            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                        >
                            Terms
                        </Link>
                        <Link
                            href="/security"
                            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                        >
                            Security
                        </Link>
                        <Link
                            href="/"
                            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                        >
                            Home
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
