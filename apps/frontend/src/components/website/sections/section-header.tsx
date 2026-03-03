import { cn } from "@repo/ui";

export interface SectionHeaderProps {
    overline?: string;
    title: string;
    description?: string;
    centered?: boolean;
    className?: string;
}

export function SectionHeader({
    overline,
    title,
    description,
    centered = true,
    className
}: SectionHeaderProps) {
    return (
        <div className={cn(centered && "text-center", className)}>
            {overline && (
                <span className="text-primary text-xs font-semibold tracking-wider uppercase">
                    {overline}
                </span>
            )}
            <h2 className="text-foreground mt-4 text-2xl font-bold tracking-tight md:text-3xl">
                {title}
            </h2>
            {description && (
                <p
                    className={cn(
                        "text-muted-foreground mt-4 max-w-2xl text-lg",
                        centered && "mx-auto"
                    )}
                >
                    {description}
                </p>
            )}
        </div>
    );
}
