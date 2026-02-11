const integrations = [
    "HubSpot",
    "Jira",
    "Slack",
    "GitHub",
    "Google Drive",
    "Gmail",
    "Outlook",
    "Dropbox",
    "Fathom",
    "Playwright"
];

export function IntegrationBar() {
    // Duplicate for seamless infinite scroll
    const items = [...integrations, ...integrations];

    return (
        <section className="border-border/40 border-y py-10">
            <div className="mx-auto max-w-7xl px-6">
                <p className="text-muted-foreground mb-8 text-center text-sm font-medium">
                    Connects to the tools you already use
                </p>
            </div>

            {/* Scrolling track */}
            <div className="relative overflow-hidden">
                {/* Fade edges */}
                <div className="from-background pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-24 bg-linear-to-r to-transparent" />
                <div className="from-background pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-24 bg-linear-to-l to-transparent" />

                <div className="animate-landing-scroll flex w-max gap-12">
                    {items.map((name, i) => (
                        <div
                            key={`${name}-${i}`}
                            className="text-muted-foreground/60 flex shrink-0 items-center gap-2 px-4"
                        >
                            <IntegrationIcon name={name} />
                            <span className="text-sm font-medium whitespace-nowrap">{name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function IntegrationIcon({ name }: { name: string }) {
    // Simple icon placeholders using first letter with distinct styling
    const colors: Record<string, string> = {
        HubSpot: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
        Jira: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
        Slack: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
        GitHub: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
        "Google Drive": "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
        Gmail: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
        Outlook: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
        Dropbox: "bg-blue-100 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400",
        Fathom: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
        Playwright: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
    };

    return (
        <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${colors[name] ?? "bg-muted text-muted-foreground"}`}
        >
            {name.charAt(0)}
        </div>
    );
}
