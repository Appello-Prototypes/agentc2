import { cn } from "@repo/ui";

const stats = [
    { label: "Total Runs", value: "12,847", valueClass: "text-foreground", showTrend: true },
    { label: "Success Rate", value: "98.2%", valueClass: "text-emerald-400", showTrend: false },
    { label: "Avg Latency", value: "1.4s", valueClass: "text-amber-400", showTrend: false },
    { label: "Total Cost", value: "$847.20", valueClass: "text-sky-400", showTrend: false }
];

const TrendArrow = () => (
    <svg
        className="h-3 w-3 text-emerald-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
        />
    </svg>
);

export function ObservabilityIllustration({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "border-border/60 bg-card overflow-hidden rounded-2xl border p-4 md:p-6",
                className
            )}
        >
            <div className="border-border/40 mb-3 flex items-center gap-2 border-b pb-3">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    OBSERVABILITY
                </span>
                <span className="text-foreground text-xs font-semibold tracking-wider uppercase">
                    Dashboard
                </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {stats.map(({ label, value, valueClass, showTrend }) => (
                    <div key={label} className="bg-muted/30 rounded-xl p-3">
                        <div className="flex items-center gap-1">
                            <span className={cn("text-lg font-bold", valueClass)}>{value}</span>
                            {showTrend && <TrendArrow />}
                        </div>
                        <span className="text-muted-foreground text-[10px]">{label}</span>
                    </div>
                ))}
            </div>

            <svg viewBox="0 0 200 40" className="mt-3 h-10 w-full" aria-hidden>
                <polyline
                    points="0,30 20,25 40,28 60,20 80,15 100,18 120,12 140,10 160,8 180,5 200,3"
                    fill="none"
                    stroke="currentColor"
                    className="text-primary"
                    strokeWidth="2"
                />
            </svg>
        </div>
    );
}
