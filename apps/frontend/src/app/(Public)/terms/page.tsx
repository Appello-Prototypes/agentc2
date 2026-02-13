import type { Metadata } from "next";
import Link from "next/link";
import { AgentC2Logo } from "@repo/ui";

export const metadata: Metadata = {
    title: "Terms of Service",
    description:
        "AgentC2 Terms of Service — the terms governing your use of the AgentC2 AI agent platform.",
    alternates: {
        canonical: "https://agentc2.ai/terms"
    }
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
                <p className="text-muted-foreground mb-4 text-sm">
                    Effective Date: February 13, 2026
                </p>
                <p className="text-muted-foreground mb-12 text-sm">
                    Last updated: February 13, 2026
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
                            (the &quot;Service&quot;), operated by Appello Software Pty Ltd (ABN 62
                            641 990 128) (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or
                            &quot;our&quot;), you agree to be bound by these Terms of Service
                            (&quot;Terms&quot;), our{" "}
                            <Link href="/privacy" className="text-primary hover:underline">
                                Privacy Policy
                            </Link>
                            , and our{" "}
                            <Link href="/security" className="text-primary hover:underline">
                                Security Policy
                            </Link>
                            , which are incorporated by reference. If you are accepting these Terms
                            on behalf of an organization, you represent and warrant that you have
                            the authority to bind that organization, and references to
                            &quot;you&quot; or &quot;your&quot; include that organization. If you do
                            not agree to these Terms, do not use the Service.
                        </p>
                    </section>

                    {/* 2. Definitions */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            2. Definitions
                        </h2>
                        <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                            <li>
                                <strong className="text-foreground">&quot;Agent&quot;</strong> means
                                an AI-powered software agent configured within the Service to
                                perform tasks on your behalf.
                            </li>
                            <li>
                                <strong className="text-foreground">&quot;Content&quot;</strong>{" "}
                                means any data, text, files, documents, instructions,
                                configurations, or other materials you upload, create, or provide
                                through the Service.
                            </li>
                            <li>
                                <strong className="text-foreground">&quot;Integration&quot;</strong>{" "}
                                means a connection between the Service and a Third-Party Service,
                                authorized by you through OAuth, API key, or other authentication
                                mechanism.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    &quot;Third-Party Service&quot;
                                </strong>{" "}
                                means any external service (such as Google Gmail, Google Calendar,
                                Google Drive, Microsoft Outlook, Dropbox, HubSpot, Jira, Slack,
                                GitHub, Fathom, or JustCall) that you connect to AgentC2.
                            </li>
                            <li>
                                <strong className="text-foreground">&quot;Workspace&quot;</strong>{" "}
                                means an isolated environment within an Organization containing
                                agents, workflows, integrations, and data.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    &quot;Organization&quot;
                                </strong>{" "}
                                means the entity (company, team, or individual) that owns one or
                                more Workspaces within AgentC2.
                            </li>
                        </ul>
                    </section>

                    {/* 3. Eligibility */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            3. Eligibility
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            You must be at least 18 years of age and capable of forming a binding
                            contract to use the Service. By using the Service, you represent and
                            warrant that you meet these requirements. The Service is designed for
                            business and professional use.
                        </p>
                    </section>

                    {/* 4. Description of Service */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            4. Description of Service
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            AgentC2 is an AI agent platform that enables you to build, deploy, and
                            orchestrate intelligent AI agents. The platform provides:
                        </p>
                        <ul className="text-muted-foreground mt-3 ml-5 list-disc space-y-2 text-sm leading-relaxed">
                            <li>
                                Agent creation, configuration, and management with multiple AI model
                                providers
                            </li>
                            <li>Visual workflow builders and multi-agent networks</li>
                            <li>
                                Third-party integrations via OAuth and API connections (Google,
                                Microsoft, Dropbox, HubSpot, Jira, Slack, GitHub, and others)
                            </li>
                            <li>Voice agent capabilities</li>
                            <li>
                                Knowledge base management with RAG (Retrieval Augmented Generation)
                            </li>
                            <li>
                                Analytics dashboards, evaluation scoring, and continuous learning
                            </li>
                            <li>Multi-channel deployment (Slack, email, voice, web, API)</li>
                        </ul>
                    </section>

                    {/* 5. User Accounts */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            5. User Accounts
                        </h2>
                        <p className="text-muted-foreground mb-3 leading-relaxed">
                            You must create an account to use AgentC2. When creating and maintaining
                            your account, you agree to:
                        </p>
                        <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                            <li>
                                Provide accurate, current, and complete information during
                                registration
                            </li>
                            <li>Maintain and promptly update your account information</li>
                            <li>
                                Maintain the confidentiality of your account credentials and not
                                share them with any third party
                            </li>
                            <li>
                                Accept responsibility for all activities that occur under your
                                account
                            </li>
                            <li>
                                Notify us immediately at{" "}
                                <a
                                    href="mailto:security@agentc2.ai"
                                    className="text-primary hover:underline"
                                >
                                    security@agentc2.ai
                                </a>{" "}
                                if you become aware of any unauthorized access or use of your
                                account
                            </li>
                        </ul>
                        <p className="text-muted-foreground mt-3 leading-relaxed">
                            We reserve the right to suspend or disable accounts that we reasonably
                            believe have been compromised.
                        </p>
                    </section>

                    {/* 6. Acceptable Use */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            6. Acceptable Use
                        </h2>
                        <p className="text-muted-foreground mb-3 leading-relaxed">
                            You agree not to use AgentC2 to:
                        </p>
                        <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                            <li>
                                Violate any applicable local, state, national, or international law
                                or regulation
                            </li>
                            <li>
                                Send spam, phishing, or unsolicited communications via any connected
                                integration (Gmail, Outlook, Slack, or other channels)
                            </li>
                            <li>
                                Attempt to gain unauthorized access to other users&apos; data,
                                accounts, or connected services
                            </li>
                            <li>
                                Use the platform in ways that could harm, overload, impair, or
                                disrupt the Service, its infrastructure, or connected Third-Party
                                Services
                            </li>
                            <li>
                                Circumvent usage limits, budget controls, guardrail policies, rate
                                limits, or any other safeguards
                            </li>
                            <li>
                                Use agents to generate, distribute, or facilitate illegal, harmful,
                                abusive, harassing, defamatory, or deceptive content
                            </li>
                            <li>
                                Reverse engineer, decompile, disassemble, or otherwise attempt to
                                discover the source code or algorithms of the Service
                            </li>
                            <li>
                                Resell, sublicense, or provide access to the Service to third
                                parties without our prior written consent
                            </li>
                            <li>Use the Service to build a competitive product or service</li>
                            <li>
                                Remove, alter, or obscure any proprietary notices, labels, or marks
                                on the Service
                            </li>
                            <li>
                                Use the Service to process, store, or transmit protected health
                                information (PHI) regulated by HIPAA without a separate Business
                                Associate Agreement
                            </li>
                        </ul>
                    </section>

                    {/* 7. Third-Party Integrations */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            7. Third-Party Integrations
                        </h2>
                        <p className="text-muted-foreground mb-3 leading-relaxed">
                            AgentC2 connects to Third-Party Services on your behalf using OAuth or
                            API credentials you provide. When you connect an Integration, you:
                        </p>
                        <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                            <li>
                                Authorize AgentC2 to access the relevant data and perform actions as
                                configured by your agents and workflows
                            </li>
                            <li>
                                Acknowledge that your use of each Third-Party Service is also
                                subject to that service&apos;s own terms of service and privacy
                                policy
                            </li>
                            <li>
                                Accept responsibility for ensuring that your agent configurations
                                comply with the terms and policies of the connected Third-Party
                                Services
                            </li>
                            <li>
                                Understand that Third-Party Services may change, restrict, or
                                discontinue their APIs, which may affect functionality available
                                through AgentC2
                            </li>
                        </ul>
                        <p className="text-muted-foreground mt-3 leading-relaxed">
                            You may disconnect any Integration at any time from your dashboard.
                            Disconnecting immediately revokes access and deletes stored credentials
                            from our systems. You may also revoke access directly from the
                            Third-Party Service&apos;s account settings (e.g., Google Account
                            permissions, Microsoft privacy dashboard).
                        </p>
                    </section>

                    {/* 8. Google API Services */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            8. Google API Services
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            AgentC2&apos;s use and transfer to any other app of information received
                            from Google APIs will adhere to the{" "}
                            <a
                                href="https://developers.google.com/terms/api-services-user-data-policy"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                            >
                                Google API Services User Data Policy
                            </a>
                            , including the Limited Use requirements. We only request Google OAuth
                            scopes necessary for the features you choose to enable. We do not use
                            Google user data for serving advertisements. For full details on how we
                            handle Google data, see our{" "}
                            <Link href="/privacy" className="text-primary hover:underline">
                                Privacy Policy
                            </Link>
                            .
                        </p>
                    </section>

                    {/* 9. AI Model Usage */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            9. AI Model Usage and Limitations
                        </h2>
                        <p className="text-muted-foreground mb-3 leading-relaxed">
                            AgentC2 uses third-party AI models (from providers such as OpenAI and
                            Anthropic) to power agent responses. You acknowledge and agree that:
                        </p>
                        <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                            <li>
                                AI-generated outputs may not always be accurate, complete, current,
                                or free from bias
                            </li>
                            <li>
                                You are solely responsible for reviewing and validating agent
                                outputs before acting on them, especially for consequential or
                                high-stakes decisions
                            </li>
                            <li>
                                Agent actions (such as sending emails, updating CRM records,
                                creating calendar events, or posting messages) are performed on your
                                behalf based on your configuration — you should thoroughly test
                                agents before deploying them to production workflows
                            </li>
                            <li>
                                The availability, capabilities, and performance of underlying AI
                                models are subject to change by their respective providers
                            </li>
                            <li>
                                Data sent to AI model providers is processed according to those
                                providers&apos; terms and policies
                            </li>
                        </ul>
                    </section>

                    {/* 10. Intellectual Property */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            10. Intellectual Property
                        </h2>

                        <h3 className="text-foreground mt-4 mb-2 text-lg font-medium">
                            Your Content
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                            You retain all ownership rights to Content you provide to AgentC2,
                            including agent instructions, knowledge base documents, workflow
                            configurations, and uploaded files. By using the Service, you grant us a
                            limited, non-exclusive, worldwide license to use, process, store, and
                            display your Content solely for the purpose of providing and improving
                            the Service for you. This license terminates when you delete your
                            Content or close your account.
                        </p>

                        <h3 className="text-foreground mt-4 mb-2 text-lg font-medium">
                            Our Service
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                            AgentC2 and its original content (excluding Content provided by users),
                            features, functionality, user interface, underlying technology, and
                            documentation are and will remain the exclusive property of Appello
                            Software Pty Ltd and its licensors. The Service is protected by
                            copyright, trademark, trade secret, and other intellectual property
                            laws.
                        </p>

                        <h3 className="text-foreground mt-4 mb-2 text-lg font-medium">Feedback</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            If you provide feedback, suggestions, or recommendations about the
                            Service, you grant us an unrestricted, irrevocable, perpetual license to
                            use that feedback for any purpose without obligation to you.
                        </p>
                    </section>

                    {/* 11. Data and Privacy */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            11. Data and Privacy
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
                            , which describe how we collect, use, store, share, and protect your
                            data, including data from connected Third-Party Services. By using the
                            Service, you consent to the collection and use of information as
                            described in those policies.
                        </p>
                    </section>

                    {/* 12. Confidentiality */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            12. Confidentiality
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Each party agrees to maintain the confidentiality of the other
                            party&apos;s confidential information. We will treat your Content, agent
                            configurations, integration credentials, and business data as
                            confidential. We will not disclose your confidential information to
                            third parties except (a) as necessary to provide the Service (e.g.,
                            sending data to AI model providers), (b) with your consent, or (c) as
                            required by law. Our confidential information includes our proprietary
                            technology, security practices, and business information.
                        </p>
                    </section>

                    {/* 13. Service Availability */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            13. Service Availability
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            We strive to maintain high availability but do not guarantee
                            uninterrupted, timely, or error-free access to the Service. The Service
                            may be temporarily unavailable due to scheduled maintenance, updates,
                            emergency patches, or factors beyond our control (including Third-Party
                            Service outages, internet disruptions, or force majeure events). We will
                            make commercially reasonable efforts to provide advance notice of
                            planned maintenance that may affect availability.
                        </p>
                    </section>

                    {/* 14. Disclaimer of Warranties */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            14. Disclaimer of Warranties
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS
                            AVAILABLE&quot; BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
                            IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL
                            WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
                            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND
                            ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE. WE DO
                            NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR
                            ERROR-FREE, THAT DEFECTS WILL BE CORRECTED, OR THAT AI-GENERATED OUTPUTS
                            WILL BE ACCURATE OR COMPLETE.
                        </p>
                    </section>

                    {/* 15. Limitation of Liability */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            15. Limitation of Liability
                        </h2>
                        <p className="text-muted-foreground mb-3 leading-relaxed">
                            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
                        </p>
                        <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                            <li>
                                WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
                                CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO
                                LOSS OF PROFITS, DATA, BUSINESS OPPORTUNITIES, OR GOODWILL, ARISING
                                FROM YOUR USE OF OR INABILITY TO USE THE SERVICE
                            </li>
                            <li>
                                WE SHALL NOT BE LIABLE FOR DAMAGES RESULTING FROM ACTIONS TAKEN BY
                                AI AGENTS YOU CONFIGURE, INCLUDING EMAILS SENT, CRM RECORDS
                                MODIFIED, CALENDAR EVENTS CREATED, OR OTHER AUTOMATED ACTIONS
                            </li>
                            <li>
                                OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING FROM THESE
                                TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT
                                YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) AUD $100
                            </li>
                        </ul>
                        <p className="text-muted-foreground mt-3 leading-relaxed">
                            Some jurisdictions do not allow the exclusion or limitation of certain
                            warranties or damages. In such jurisdictions, our liability is limited
                            to the maximum extent permitted by law.
                        </p>
                    </section>

                    {/* 16. Indemnification */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            16. Indemnification
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            You agree to indemnify, defend, and hold harmless Appello Software Pty
                            Ltd, its officers, directors, employees, and agents from and against any
                            claims, liabilities, damages, losses, and expenses (including reasonable
                            legal fees) arising from: (a) your use of the Service; (b) your
                            violation of these Terms; (c) your violation of any third-party rights,
                            including the terms of any Third-Party Service; (d) Content you provide
                            to the Service; or (e) actions taken by agents you configure on the
                            platform.
                        </p>
                    </section>

                    {/* 17. Termination */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            17. Termination
                        </h2>

                        <h3 className="text-foreground mt-4 mb-2 text-lg font-medium">By You</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            You may stop using the Service at any time. You may request deletion of
                            your account and all associated data by contacting{" "}
                            <a
                                href="mailto:hello@agentc2.ai"
                                className="text-primary hover:underline"
                            >
                                hello@agentc2.ai
                            </a>
                            .
                        </p>

                        <h3 className="text-foreground mt-4 mb-2 text-lg font-medium">By Us</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            We may suspend or terminate your account if: (a) you materially breach
                            these Terms; (b) you engage in activity that harms the Service or other
                            users; (c) your account has been inactive for an extended period; or (d)
                            we are required to do so by law. We will provide reasonable notice
                            before termination unless immediate action is necessary to prevent harm
                            to the Service or comply with legal obligations.
                        </p>

                        <h3 className="text-foreground mt-4 mb-2 text-lg font-medium">
                            Effect of Termination
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                            Upon termination: (a) your right to use the Service ceases immediately;
                            (b) we will delete your Content and data in accordance with our{" "}
                            <Link href="/privacy" className="text-primary hover:underline">
                                Privacy Policy
                            </Link>
                            ; (c) all Integration credentials will be deleted; and (d) the following
                            sections survive termination: Intellectual Property, Confidentiality,
                            Disclaimer of Warranties, Limitation of Liability, Indemnification,
                            Dispute Resolution, and Governing Law.
                        </p>
                    </section>

                    {/* 18. Force Majeure */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            18. Force Majeure
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Neither party shall be liable for any failure or delay in performing its
                            obligations under these Terms where such failure or delay results from
                            circumstances beyond the reasonable control of that party, including but
                            not limited to: acts of God, natural disasters, pandemics, government
                            actions, war, terrorism, riots, power failures, internet or
                            telecommunications outages, cyberattacks, or Third-Party Service
                            outages.
                        </p>
                    </section>

                    {/* 19. Dispute Resolution */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            19. Dispute Resolution
                        </h2>
                        <p className="text-muted-foreground mb-3 leading-relaxed">
                            If a dispute arises from these Terms or your use of the Service, the
                            parties agree to first attempt to resolve it through good-faith
                            negotiation. Either party may initiate this process by sending written
                            notice to the other party. If the dispute is not resolved within 30
                            days, either party may proceed to mediation or litigation.
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                            Any formal legal proceedings shall be brought exclusively in the courts
                            of Queensland, Australia, and both parties consent to the personal
                            jurisdiction of such courts.
                        </p>
                    </section>

                    {/* 20. Changes to Terms */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            20. Changes to Terms
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            We may update these Terms from time to time. We will notify you of
                            material changes by: (a) posting the new Terms on this page with an
                            updated &quot;Last updated&quot; date; and (b) for significant changes,
                            sending notice via email or an in-app notification at least 30 days
                            before the changes take effect. If you do not agree to the revised
                            Terms, you must stop using the Service before the changes take effect.
                            Continued use of the Service after the effective date constitutes
                            acceptance of the updated Terms.
                        </p>
                    </section>

                    {/* 21. Governing Law */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            21. Governing Law
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            These Terms are governed by and construed in accordance with the laws of
                            Queensland, Australia, without regard to conflict of law principles. The
                            United Nations Convention on Contracts for the International Sale of
                            Goods does not apply to these Terms.
                        </p>
                    </section>

                    {/* 22. General Provisions */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">
                            22. General Provisions
                        </h2>

                        <h3 className="text-foreground mt-4 mb-2 text-lg font-medium">
                            Entire Agreement
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                            These Terms, together with the Privacy Policy and Security Policy,
                            constitute the entire agreement between you and us regarding the Service
                            and supersede all prior agreements, communications, and understandings.
                        </p>

                        <h3 className="text-foreground mt-4 mb-2 text-lg font-medium">
                            Severability
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                            If any provision of these Terms is held to be invalid, illegal, or
                            unenforceable, the remaining provisions shall continue in full force and
                            effect. The invalid provision shall be modified to the minimum extent
                            necessary to make it valid and enforceable while preserving its original
                            intent.
                        </p>

                        <h3 className="text-foreground mt-4 mb-2 text-lg font-medium">Waiver</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            Our failure to enforce any right or provision of these Terms shall not
                            constitute a waiver of that right or provision. Any waiver must be in
                            writing and signed by us.
                        </p>

                        <h3 className="text-foreground mt-4 mb-2 text-lg font-medium">
                            Assignment
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                            You may not assign or transfer these Terms or any rights hereunder
                            without our prior written consent. We may assign these Terms in
                            connection with a merger, acquisition, reorganization, or sale of all or
                            substantially all of our assets, with notice to you.
                        </p>

                        <h3 className="text-foreground mt-4 mb-2 text-lg font-medium">Notices</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            Notices to you may be sent to the email address associated with your
                            account. Notices to us should be sent to{" "}
                            <a
                                href="mailto:legal@agentc2.ai"
                                className="text-primary hover:underline"
                            >
                                legal@agentc2.ai
                            </a>
                            .
                        </p>
                    </section>

                    {/* 23. Contact */}
                    <section>
                        <h2 className="text-foreground mb-3 text-2xl font-semibold">23. Contact</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            For questions about these Terms of Service:
                        </p>
                        <div className="text-muted-foreground mt-4 space-y-1 text-sm">
                            <p>
                                <strong className="text-foreground">
                                    Appello Software Pty Ltd
                                </strong>{" "}
                                (ABN 62 641 990 128), trading as AgentC2
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
