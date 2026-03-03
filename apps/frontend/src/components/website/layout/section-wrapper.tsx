import { cn } from "@repo/ui";

interface SectionWrapperProps {
    children: React.ReactNode;
    className?: string;
    muted?: boolean;
    id?: string;
}

export function SectionWrapper({ children, className, muted, id }: SectionWrapperProps) {
    return (
        <section id={id} className={cn("py-24", muted && "bg-muted/30", className)}>
            <div className="mx-auto max-w-7xl px-6">{children}</div>
        </section>
    );
}
