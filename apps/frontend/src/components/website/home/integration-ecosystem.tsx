"use client";

import Link from "next/link";
import { cn, buttonVariants } from "@repo/ui";

const CATEGORIES = [
    "CRM",
    "Communication",
    "Productivity",
    "File Storage",
    "Automation",
    "Voice",
    "Commerce",
    "Cloud",
    "Web"
];

const INTEGRATIONS = [
    "HubSpot",
    "Salesforce",
    "Pipedrive",
    "Slack",
    "Gmail",
    "Outlook",
    "WhatsApp",
    "Telegram",
    "Twilio",
    "Jira",
    "GitHub",
    "Linear",
    "Notion",
    "Asana",
    "Monday",
    "Google Drive",
    "Dropbox",
    "Box",
    "Zapier",
    "Make",
    "ElevenLabs",
    "Stripe",
    "Shopify",
    "AWS",
    "Azure",
    "GCP",
    "Playwright",
    "Firecrawl",
    "Intercom",
    "ClickUp"
];

export function IntegrationEcosystem() {
    return (
        <section className="py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="text-center">
                    <span className="text-primary text-xs font-semibold tracking-wider uppercase">
                        INTEGRATIONS
                    </span>
                    <h2 className="text-foreground mt-4 text-2xl font-bold tracking-tight md:text-3xl">
                        Connected to 200+ tools via MCP
                    </h2>
                    <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
                        MCP (Model Context Protocol) is the open standard for connecting AI agents
                        to external tools. AgentC2 supports 40+ integration blueprints with OAuth
                        and API key authentication.
                    </p>
                </div>

                <div className="mt-8 flex flex-wrap justify-center gap-2">
                    {CATEGORIES.map((category) => (
                        <button
                            key={category}
                            type="button"
                            className="border-border/40 text-muted-foreground rounded-full border px-3 py-1 text-xs font-medium"
                        >
                            {category}
                        </button>
                    ))}
                </div>

                <div className="mt-8 grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                    {INTEGRATIONS.map((name) => (
                        <div
                            key={name}
                            className="border-border/40 bg-card/50 hover:border-primary/20 flex flex-col items-center justify-center rounded-xl border p-3 transition-colors"
                        >
                            <div className="text-primary bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold">
                                {name.charAt(0)}
                            </div>
                            <span className="text-muted-foreground mt-1.5 w-full truncate text-center text-[10px]">
                                {name}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="mt-8 flex justify-center">
                    <Link href="/docs" className={cn(buttonVariants({ variant: "link" }))}>
                        See All Integrations →
                    </Link>
                </div>
            </div>
        </section>
    );
}
