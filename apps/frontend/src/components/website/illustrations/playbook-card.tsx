import { cn } from "@repo/ui";

const BotIcon = () => (
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
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
    </svg>
);
const FlowIcon = () => (
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
            d="M13 10V3L4 14h7v7l9-11h-7z"
        />
    </svg>
);
const NetworkIcon = () => (
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
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
        />
    </svg>
);
const ToolIcon = () => (
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
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
    </svg>
);
const StarIcon = () => (
    <svg className="h-3 w-3 text-amber-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
);

const components = [
    { label: "3 Agents", icon: BotIcon },
    { label: "2 Workflows", icon: FlowIcon },
    { label: "1 Network", icon: NetworkIcon },
    { label: "12 Skills", icon: ToolIcon }
];

export function PlaybookCardIllustration({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "border-border/60 bg-card overflow-hidden rounded-2xl border p-4 md:p-6",
                className
            )}
        >
            <div className="border-border/40 mb-3 flex items-center gap-2 border-b pb-3">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    MARKETPLACE
                </span>
                <span className="text-foreground text-xs font-semibold tracking-wider uppercase">
                    Playbook
                </span>
            </div>

            <div className="bg-muted/30 rounded-xl p-4">
                <h3 className="text-foreground text-sm font-semibold">
                    Sales Pipeline Accelerator
                </h3>
                <p className="text-muted-foreground text-[10px]">by AgentC2 Team</p>
                <div className="mt-3 space-y-1.5">
                    {components.map(({ label, icon: Icon }) => (
                        <div
                            key={label}
                            className="text-muted-foreground flex items-center gap-2 text-[10px]"
                        >
                            <Icon />
                            {label}
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                        <StarIcon key={i} />
                    ))}
                    <span className="text-muted-foreground text-[10px]">(47)</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                    <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                        Free
                    </span>
                    <button
                        type="button"
                        className="bg-primary text-primary-foreground rounded-lg px-3 py-1 text-[10px] font-medium"
                    >
                        Install
                    </button>
                </div>
            </div>
        </div>
    );
}
