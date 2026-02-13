import type { Metadata } from "next";
import Link from "next/link";
import { AgentC2Logo } from "@repo/ui";

export const metadata: Metadata = {
    title: "Terms of Service",
    description: "AgentC2 Terms of Service — the terms governing your use of the AgentC2 platform."
};

export default function TermsOfServicePage() {
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
                            href="/privacy"
                            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                        >
                            Privacy
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
                    Terms of Service
                </h1>
                <p className="text-muted-foreground mb-12 text-sm">
                    Last updated: February 12, 2026
                </p>

                <div className="max-w-none space-y-10">
                    {/* 1. Acceptance */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            1. Acceptance of Terms
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            By accessing or using the AgentC2 platform at{" "}
                            <a href="https://agentc2.ai" className="text-primary hover:underline">
                                agentc2.ai
                            </a>{" "}
                            (the &quot;Service&quot;), operated by Appello Software Pty Ltd
                            (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;), you agree to be bound
                            by these Terms of Service. If you do not agree to these terms, please do
                            not use the Service.
                        </p>
                    </section>

                    {/* 2. Description */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            2. Description of Service
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            AgentC2 is an AI agent platform that enables you to build, deploy, and
                            orchestrate intelligent AI agents. The platform provides agent creation
                            and configuration tools, visual workflow builders, multi-agent networks,
                            third-party integrations (including Google Gmail, Google Calendar,
                            Google Drive, Microsoft Outlook, Dropbox, HubSpot, Jira, Slack, GitHub,
                            and others), voice agent capabilities, knowledge base management with
                            RAG (Retrieval Augmented Generation), analytics dashboards, continuous
                            learning, and multi-channel deployment.
                        </p>
                    </section>

                    {/* 3. Accounts */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            3. User Accounts
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            You must create an account to use AgentC2. You are responsible for
                            maintaining the confidentiality of your account credentials and for all
                            activities that occur under your account. You agree to notify us
                            immediately at{" "}
                            <a
                                href="mailto:security@agentc2.ai"
                                className="text-primary hover:underline"
                            >
                                security@agentc2.ai
                            </a>{" "}
                            if you become aware of any unauthorized use of your account.
                        </p>
                    </section>

                    {/* 4. Acceptable Use */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            4. Acceptable Use
                        </h2>
                        <p className="text-muted-foreground mb-3 leading-relaxed">
                            You agree not to use AgentC2 to:
                        </p>
                        <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                            <li>Violate any applicable laws or regulations</li>
                            <li>
                                Send spam, phishing, or unsolicited communications via any connected
                                integration (Gmail, Outlook, Slack, or other channels)
                            </li>
                            <li>
                                Attempt to gain unauthorized access to other users&apos; data,
                                accounts, or connected services
                            </li>
                            <li>
                                Use the platform in ways that could harm, overload, or disrupt the
                                Service or third-party services
                            </li>
                            <li>
                                Circumvent usage limits, budget controls, guardrail policies, or
                                rate limits
                            </li>
                            <li>Use agents to generate illegal, harmful, or deceptive content</li>
                            <li>
                                Resell or sublicense access to the Service without our written
                                consent
                            </li>
                        </ul>
                    </section>

                    {/* 5. Third-Party Integrations */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            5. Third-Party Integrations
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            AgentC2 connects to third-party services on your behalf using OAuth or
                            API credentials you provide. By connecting an integration, you authorize
                            AgentC2 to access the relevant data and perform actions as configured by
                            your agents. You are responsible for ensuring your use of these
                            integrations complies with the respective service&apos;s terms of use.
                            You may disconnect any integration at any time from your dashboard,
                            which will immediately revoke access and delete stored credentials.
                        </p>
                    </section>

                    {/* 6. AI and Model Usage */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            6. AI Model Usage and Limitations
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            AgentC2 uses third-party AI models (from OpenAI, Anthropic, and others)
                            to power agent responses. AI-generated outputs may not always be
                            accurate, complete, or up-to-date. You are responsible for reviewing
                            agent outputs before acting on them, especially for high-stakes
                            decisions. Agent actions (such as sending emails, updating CRM records,
                            or creating calendar events) are performed on your behalf based on your
                            configuration — review your agent instructions and test before deploying
                            to production workflows.
                        </p>
                    </section>

                    {/* 7. Intellectual Property */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            7. Intellectual Property
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            You retain ownership of all data and content you provide to AgentC2,
                            including agent instructions, knowledge base documents, workflow
                            configurations, and uploaded files. We do not claim ownership of your
                            content. AgentC2 retains ownership of the platform, its features, user
                            interface, and underlying technology.
                        </p>
                    </section>

                    {/* 8. Data and Privacy */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            8. Data and Privacy
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Your use of the Service is also governed by our{" "}
                            <Link href="/privacy" className="text-primary hover:underline">
                                Privacy Policy
                            </Link>{" "}
                            and{" "}
                            <Link href="/security" className="text-primary hover:underline">
                                Security Policy
                            </Link>
                            , which describe how we collect, use, store, and protect your data,
                            including data from connected third-party services.
                        </p>
                    </section>

                    {/* 9. Service Availability */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            9. Service Availability
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            We strive to maintain high availability but do not guarantee
                            uninterrupted access. The Service may be temporarily unavailable due to
                            maintenance, updates, or factors beyond our control (including
                            third-party service outages). We will make reasonable efforts to notify
                            you of planned downtime.
                        </p>
                    </section>

                    {/* 10. Limitation of Liability */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            10. Limitation of Liability
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            The Service is provided &quot;as is&quot; and &quot;as available.&quot;
                            To the maximum extent permitted by law, we make no warranties, express
                            or implied, regarding the Service&apos;s reliability, accuracy,
                            completeness, or fitness for a particular purpose. We shall not be
                            liable for any indirect, incidental, special, consequential, or punitive
                            damages arising from your use of the Service, including but not limited
                            to damages resulting from actions taken by AI agents you configure.
                        </p>
                    </section>

                    {/* 11. Termination */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            11. Termination
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            We may suspend or terminate your account if you violate these terms or
                            engage in activity that harms the Service or other users. You may
                            request deletion of your account at any time by contacting{" "}
                            <a
                                href="mailto:hello@agentc2.ai"
                                className="text-primary hover:underline"
                            >
                                hello@agentc2.ai
                            </a>
                            . Upon termination, we will delete your data in accordance with our{" "}
                            <Link href="/privacy" className="text-primary hover:underline">
                                Privacy Policy
                            </Link>
                            .
                        </p>
                    </section>

                    {/* 12. Changes */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            12. Changes to Terms
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            We may update these Terms of Service from time to time. We will notify
                            you of material changes by posting the new terms on this page and, for
                            significant changes, via email. Continued use of the platform after
                            changes constitutes acceptance of the updated terms.
                        </p>
                    </section>

                    {/* 13. Governing Law */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            13. Governing Law
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            These Terms are governed by the laws of Queensland, Australia. Any
                            disputes arising from these Terms or your use of the Service will be
                            subject to the exclusive jurisdiction of the courts of Queensland,
                            Australia.
                        </p>
                    </section>

                    {/* 14. Contact */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">14. Contact</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            For questions about these Terms of Service:
                        </p>
                        <div className="text-muted-foreground mt-4 space-y-1 text-sm">
                            <p>
                                <strong className="text-foreground">
                                    Appello Software Pty Ltd
                                </strong>{" "}
                                trading as AgentC2
                            </p>
                            <p>
                                Email:{" "}
                                <a
                                    href="mailto:legal@agentc2.ai"
                                    className="text-primary hover:underline"
                                >
                                    legal@agentc2.ai
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
                            href="/privacy"
                            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                        >
                            Privacy
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
