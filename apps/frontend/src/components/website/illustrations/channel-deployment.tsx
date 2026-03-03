import { cn } from "@repo/ui";

const ChatBubbleIcon = () => (
    <svg
        className="text-muted-foreground h-3 w-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
    </svg>
);
const HashIcon = () => (
    <svg
        className="text-muted-foreground h-3 w-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
        />
    </svg>
);
const PhoneIcon = () => (
    <svg
        className="text-muted-foreground h-3 w-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
        />
    </svg>
);
const PaperPlaneIcon = () => (
    <svg
        className="text-muted-foreground h-3 w-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
        />
    </svg>
);
const MailIcon = () => (
    <svg
        className="text-muted-foreground h-3 w-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
    </svg>
);
const CodeIcon = () => (
    <svg
        className="text-muted-foreground h-3 w-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
        />
    </svg>
);
const BotIcon = () => (
    <svg
        className="text-primary mx-auto mb-1 h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
    </svg>
);

const channels = [
    { label: "Web Chat", icon: ChatBubbleIcon },
    { label: "Slack", icon: HashIcon },
    { label: "WhatsApp", icon: PhoneIcon },
    { label: "Telegram", icon: PaperPlaneIcon },
    { label: "Voice", icon: PhoneIcon },
    { label: "Email", icon: MailIcon },
    { label: "Embed", icon: CodeIcon }
];

export function ChannelDeploymentIllustration({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "border-border/60 bg-card overflow-hidden rounded-2xl border p-4 md:p-6",
                className
            )}
        >
            <div className="border-border/40 mb-3 flex items-center gap-2 border-b pb-3">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    CHANNELS
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            </div>

            <div className="relative flex flex-col items-center">
                <div className="bg-primary/10 border-primary/30 min-w-[100px] rounded-2xl border-2 p-3 text-center">
                    <BotIcon />
                    <span className="text-foreground text-[10px] font-medium">Agent Hub</span>
                </div>

                <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
                    <defs>
                        <pattern id="dash" patternUnits="userSpaceOnUse" width="6" height="6">
                            <path
                                d="M 0 3 L 6 3"
                                stroke="currentColor"
                                strokeWidth="1"
                                strokeDasharray="2 2"
                                className="text-border/60"
                            />
                        </pattern>
                    </defs>
                    {channels.map((_, i) => {
                        const angle = (i / channels.length) * 2 * Math.PI - Math.PI / 2;
                        const cx = 50;
                        const cy = 50;
                        const r = 42;
                        const ex = 50 + r * Math.cos(angle);
                        const ey = 50 + r * Math.sin(angle);
                        return (
                            <line
                                key={i}
                                x1={`${cx}%`}
                                y1={`${cy}%`}
                                x2={`${ex}%`}
                                y2={`${ey}%`}
                                stroke="currentColor"
                                strokeWidth={1}
                                strokeDasharray="4 4"
                                className="text-border/50"
                            />
                        );
                    })}
                </svg>

                <div className="mt-6 grid w-full max-w-[240px] grid-cols-2 gap-2 sm:grid-cols-3">
                    {channels.map(({ label, icon: Icon }) => (
                        <div
                            key={label}
                            className="bg-muted/50 text-foreground flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-medium"
                        >
                            <Icon />
                            {label}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
