import { cn } from "@repo/ui";

const guardrails = [
    { label: "PII Blocking", desc: "Block emails, phones, SSN", status: "emerald" },
    { label: "Prompt Injection", desc: "Detect manipulation attempts", status: "emerald" },
    { label: "Toxicity Filter", desc: "Block harmful content", status: "emerald" },
    { label: "Egress Control", desc: "Allowlist mode: 12 domains", status: "amber" },
    { label: "Cost Limit", desc: "$5.00 per run", status: "emerald" }
];

function ToggleOn({ variant = "emerald" }: { variant?: "emerald" | "amber" }) {
    const bgClass = variant === "amber" ? "bg-amber-500/20" : "bg-emerald-500/20";
    const dotClass = variant === "amber" ? "bg-amber-400" : "bg-emerald-400";
    return (
        <div className={cn("flex h-5 w-9 items-center justify-end rounded-full pr-1", bgClass)}>
            <div className={cn("h-3.5 w-3.5 rounded-full", dotClass)} aria-hidden />
        </div>
    );
}

export function GuardrailPanelIllustration({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "border-border/60 bg-card overflow-hidden rounded-2xl border p-4 md:p-6",
                className
            )}
        >
            <div className="border-border/40 mb-3 flex items-center gap-2 border-b pb-3">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    GUARDRAILS
                </span>
                <span className="text-foreground text-xs font-semibold">Security Policy</span>
            </div>

            <div className="space-y-0">
                {guardrails.map(({ label, desc, status }) => (
                    <div
                        key={label}
                        className="border-border/20 flex items-center gap-3 border-b py-2.5 last:border-0"
                    >
                        <ToggleOn variant={status === "amber" ? "amber" : "emerald"} />
                        <div className="min-w-0 flex-1">
                            <span className="text-foreground block text-xs font-medium">
                                {label}
                            </span>
                            <span className="text-muted-foreground text-[10px]">{desc}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
