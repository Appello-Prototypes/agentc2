import Link from "next/link";

const dataCategories = [
    {
        title: "Email Access",
        service: "Gmail & Outlook",
        purpose:
            "AI agents read, classify, and draft emails on your behalf — enabling automated email triage, follow-up workflows, and inbox management.",
        whatWeAccess: [
            "Email messages (subject, body, sender, recipients)",
            "Email labels and folders",
            "Ability to send emails and create drafts"
        ],
        icon: (
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 7l-10 6L2 7" />
            </svg>
        )
    },
    {
        title: "Calendar Access",
        service: "Google Calendar",
        purpose:
            "AI agents manage your schedule — reading events, creating new meetings, checking availability, and coordinating scheduling across participants.",
        whatWeAccess: [
            "Calendar events (title, time, attendees, location)",
            "Free/busy availability",
            "Ability to create, update, and delete events"
        ],
        icon: (
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <rect x="8" y="14" width="2" height="2" rx="0.5" />
                <rect x="14" y="14" width="2" height="2" rx="0.5" />
            </svg>
        )
    },
    {
        title: "File Access",
        service: "Google Drive & Dropbox",
        purpose:
            "AI agents search, read, and retrieve your documents to power knowledge base features, RAG (Retrieval Augmented Generation), and document-based workflows.",
        whatWeAccess: [
            "File metadata (names, types, folders)",
            "Document content (Docs, Sheets, Slides, PDFs)",
            "File search and listing capabilities"
        ],
        icon: (
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                <polyline points="13,2 13,9 20,9" />
                <line x1="9" y1="13" x2="15" y2="13" />
                <line x1="9" y1="17" x2="13" y2="17" />
            </svg>
        )
    },
    {
        title: "CRM & Project Data",
        service: "HubSpot, Jira & more",
        purpose:
            "AI agents interact with your business tools to manage contacts, deals, tickets, and projects — automating routine CRM and project management tasks.",
        whatWeAccess: [
            "Contacts, companies, deals, and tickets",
            "Project issues, sprints, and boards",
            "Ability to create, update, and search records"
        ],
        icon: (
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
        )
    }
];

export function DataTransparency() {
    return (
        <section id="data-use" className="scroll-mt-20 py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="mb-4 text-center">
                    <span className="text-primary text-sm font-semibold tracking-wider uppercase">
                        Data Transparency
                    </span>
                </div>
                <h2 className="text-foreground mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
                    Your data, your control
                </h2>
                <p className="text-muted-foreground mx-auto mb-6 max-w-2xl text-center text-lg">
                    AgentC2 connects to your tools so AI agents can work on your behalf. Here&apos;s
                    exactly what data we access and why.
                </p>
                <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center text-sm">
                    You choose which integrations to connect. We only access data for the services
                    you explicitly enable. You can disconnect any integration at any time.
                </p>

                <div className="grid gap-6 sm:grid-cols-2">
                    {dataCategories.map((cat) => (
                        <div
                            key={cat.title}
                            className="border-border/60 bg-card rounded-2xl border p-6"
                        >
                            <div className="mb-4 flex items-start gap-4">
                                <div className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                                    {cat.icon}
                                </div>
                                <div>
                                    <h3 className="text-foreground text-base font-semibold">
                                        {cat.title}
                                    </h3>
                                    <p className="text-muted-foreground text-xs">
                                        via {cat.service}
                                    </p>
                                </div>
                            </div>

                            <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                                <strong className="text-foreground">Why:</strong> {cat.purpose}
                            </p>

                            <div>
                                <p className="text-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                                    What we access
                                </p>
                                <ul className="space-y-1.5">
                                    {cat.whatWeAccess.map((item) => (
                                        <li
                                            key={item}
                                            className="text-muted-foreground flex items-start gap-2 text-sm"
                                        >
                                            <svg
                                                className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0"
                                                viewBox="0 0 16 16"
                                                fill="currentColor"
                                            >
                                                <circle cx="8" cy="8" r="3" />
                                            </svg>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Security commitments */}
                <div className="mt-12 grid gap-4 sm:grid-cols-3">
                    {[
                        {
                            label: "Encrypted at rest",
                            detail: "All OAuth tokens and credentials encrypted with AES-256-GCM"
                        },
                        {
                            label: "No data selling",
                            detail: "We never sell your data or use it for advertising"
                        },
                        {
                            label: "Revoke anytime",
                            detail: "Disconnect any integration instantly from your dashboard"
                        }
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="border-border/40 rounded-xl border px-5 py-4 text-center"
                        >
                            <p className="text-foreground text-sm font-semibold">{item.label}</p>
                            <p className="text-muted-foreground mt-1 text-xs">{item.detail}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-8 text-center">
                    <Link
                        href="/privacy"
                        className="text-primary hover:text-primary/80 text-sm font-medium underline underline-offset-4 transition-colors"
                    >
                        Read our full Privacy Policy
                    </Link>
                </div>
            </div>
        </section>
    );
}
