import { cn } from "@repo/ui";

const LockIcon = () => (
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
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
    </svg>
);

const tools = [
    "get_contacts",
    "create_deal",
    "update_company",
    "search_deals",
    "get_pipeline",
    "list_owners"
];

export function McpIntegrationIllustration({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "border-border/60 bg-card overflow-hidden rounded-2xl border p-4 md:p-6",
                className
            )}
        >
            <div className="border-border/40 mb-3 flex items-center gap-2 border-b pb-3">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    MCP SERVER
                </span>
                <span className="text-foreground text-xs font-semibold">HubSpot CRM</span>
            </div>

            <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground text-xs">Connection</span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                    <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                        Connected
                    </span>
                </span>
            </div>

            <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground text-xs">Auth</span>
                <span className="text-foreground flex items-center gap-1 text-xs font-medium">
                    OAuth 2.0
                    <LockIcon />
                </span>
            </div>

            <div className="mt-4">
                <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
                    Available Tools (12)
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                    {tools.map((tool) => (
                        <span
                            key={tool}
                            className="bg-muted/50 text-muted-foreground rounded px-2 py-1 font-mono text-[10px]"
                        >
                            {tool}
                        </span>
                    ))}
                </div>
            </div>

            <p className="text-muted-foreground mt-4 text-[10px]">Last synced: 2 min ago</p>
        </div>
    );
}
