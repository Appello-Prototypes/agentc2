import { cn } from "@repo/ui";

export interface LogoGridProps {
    logos: Array<{ name: string; category?: string }>;
    className?: string;
}

export function LogoGrid({ logos, className }: LogoGridProps) {
    return (
        <div
            className={cn(
                "grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10",
                className
            )}
        >
            {logos.map((logo, index) => (
                <div
                    key={index}
                    className="border-border/40 bg-card/50 hover:border-primary/20 flex flex-col items-center justify-center rounded-xl border p-3 transition-colors"
                >
                    <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold">
                        {logo.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-muted-foreground mt-1.5 w-full truncate text-center text-[10px]">
                        {logo.name}
                    </span>
                </div>
            ))}
        </div>
    );
}
