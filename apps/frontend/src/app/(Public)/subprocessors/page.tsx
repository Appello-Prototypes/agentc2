import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Subprocessors",
    description:
        "AgentC2 Subprocessor List — third-party services that process data on behalf of our customers.",
    alternates: {
        canonical: "https://agentc2.ai/subprocessors"
    }
};

const subprocessors = [
    {
        name: "Supabase",
        service: "PostgreSQL database hosting",
        dataProcessed: "All application data, credentials (encrypted)",
        location: "United States (AWS us-east-1)",
        soc2: true
    },
    {
        name: "OpenAI",
        service: "LLM inference (GPT-4o)",
        dataProcessed: "User prompts, agent responses",
        location: "United States",
        soc2: true
    },
    {
        name: "Anthropic",
        service: "LLM inference (Claude)",
        dataProcessed: "User prompts, agent responses",
        location: "United States",
        soc2: true
    },
    {
        name: "Digital Ocean",
        service: "Application hosting",
        dataProcessed: "Application runtime, logs",
        location: "United States",
        soc2: true
    },
    {
        name: "ElevenLabs",
        service: "Voice synthesis, live agents",
        dataProcessed: "Voice audio, text prompts",
        location: "United States / EU",
        soc2: false
    },
    {
        name: "Inngest",
        service: "Background job processing",
        dataProcessed: "Event payloads, function metadata",
        location: "United States",
        soc2: false
    }
];

const customerDirected = [
    {
        name: "Google (Gmail, Calendar, Drive)",
        service: "Email, calendar, file storage",
        location: "United States / Global"
    },
    {
        name: "Microsoft (Outlook, Calendar)",
        service: "Email, calendar via Graph API",
        location: "United States / Global"
    },
    {
        name: "Slack",
        service: "Messaging and communication",
        location: "United States"
    },
    {
        name: "HubSpot",
        service: "CRM integration",
        location: "United States"
    },
    {
        name: "Atlassian (Jira)",
        service: "Project management",
        location: "United States / Global"
    },
    {
        name: "GitHub",
        service: "Repository management",
        location: "United States"
    },
    {
        name: "Dropbox",
        service: "File storage",
        location: "United States"
    },
    {
        name: "Fathom",
        service: "Meeting transcripts",
        location: "United States"
    },
    {
        name: "JustCall",
        service: "Phone and SMS",
        location: "United States"
    }
];

export default function SubprocessorsPage() {
    return (
        <main className="mx-auto max-w-4xl px-6 py-16">
            <h1 className="text-foreground mb-2 text-4xl font-bold tracking-tight">
                Subprocessor List
            </h1>
            <p className="text-muted-foreground mb-4 text-sm">Last updated: February 21, 2026</p>
            <p className="text-muted-foreground mb-12 leading-relaxed">
                AgentC2 uses the following third-party service providers (subprocessors) to deliver
                our platform. Per our Data Processing Addendum (DPA), we provide 30 days&apos;
                advance notice of any changes to this list.
            </p>

            <div className="max-w-none space-y-12">
                <section>
                    <h2 className="text-foreground mb-4 text-2xl font-semibold">
                        Infrastructure Subprocessors
                    </h2>
                    <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                        These providers process data as part of AgentC2&apos;s core platform
                        operations.
                    </p>
                    <div className="border-border/60 overflow-x-auto rounded-xl border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-border/40 border-b">
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Subprocessor
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Service
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Data Processed
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Location
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        SOC 2
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-border/40 divide-y">
                                {subprocessors.map((sp) => (
                                    <tr key={sp.name}>
                                        <td className="text-foreground px-5 py-3 font-medium">
                                            {sp.name}
                                        </td>
                                        <td className="text-muted-foreground px-5 py-3">
                                            {sp.service}
                                        </td>
                                        <td className="text-muted-foreground px-5 py-3">
                                            {sp.dataProcessed}
                                        </td>
                                        <td className="text-muted-foreground px-5 py-3">
                                            {sp.location}
                                        </td>
                                        <td className="px-5 py-3">
                                            {sp.soc2 ? (
                                                <span className="text-green-600 dark:text-green-400">
                                                    Yes
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h2 className="text-foreground mb-4 text-2xl font-semibold">
                        Customer-Directed Integrations
                    </h2>
                    <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                        These services are connected at the customer&apos;s direction. AgentC2 acts
                        as a conduit processing data per customer instructions. These are{" "}
                        <strong className="text-foreground">not</strong> subprocessors of AgentC2 —
                        the customer directly authorizes these integrations.
                    </p>
                    <div className="border-border/60 overflow-x-auto rounded-xl border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-border/40 border-b">
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Service
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Function
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Location
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-border/40 divide-y">
                                {customerDirected.map((cd) => (
                                    <tr key={cd.name}>
                                        <td className="text-foreground px-5 py-3 font-medium">
                                            {cd.name}
                                        </td>
                                        <td className="text-muted-foreground px-5 py-3">
                                            {cd.service}
                                        </td>
                                        <td className="text-muted-foreground px-5 py-3">
                                            {cd.location}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        AI Provider Data Commitments
                    </h2>
                    <div className="bg-muted/30 border-primary/20 rounded-xl border px-5 py-4">
                        <ul className="text-muted-foreground space-y-2 text-sm leading-relaxed">
                            <li>
                                <strong className="text-foreground">OpenAI:</strong> API data is not
                                used for model training. Data retained for 30 days for abuse
                                monitoring only. SOC 2 Type II certified.
                            </li>
                            <li>
                                <strong className="text-foreground">Anthropic:</strong> API data is
                                not used for model training. Data retained for 30 days for safety
                                monitoring only. SOC 2 Type II certified.
                            </li>
                            <li>
                                <strong className="text-foreground">ElevenLabs:</strong> Voice data
                                processed for text-to-speech synthesis. Data handling per ElevenLabs
                                terms.
                            </li>
                        </ul>
                    </div>
                </section>

                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        Change Notification
                    </h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        Per our DPA, we provide <strong className="text-foreground">30 days</strong>{" "}
                        advance notice before adding or changing subprocessors. Customers may object
                        to new subprocessors within 30 days of notification. Subscribe to updates by
                        contacting{" "}
                        <a
                            href="mailto:privacy@agentc2.ai"
                            className="text-primary hover:underline"
                        >
                            privacy@agentc2.ai
                        </a>
                        .
                    </p>
                </section>
            </div>
        </main>
    );
}
