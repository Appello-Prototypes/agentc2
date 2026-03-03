import { cn } from "@repo/ui";

export interface FlowDiagramProps {
    steps: Array<{
        number?: number;
        title: string;
        description: string;
        icon?: React.ReactNode;
    }>;
    className?: string;
}

export function FlowDiagram({ steps, className }: FlowDiagramProps) {
    return (
        <div className={cn("relative grid gap-8 md:grid-cols-3", className)}>
            {steps.map((step, index) => (
                <div key={index} className="relative">
                    {/* Connector line between steps (desktop only) */}
                    {index < steps.length - 1 && (
                        <div
                            className="border-border absolute top-12 left-full hidden h-0.5 w-8 -translate-y-1/2 border-t-2 border-dashed md:block"
                            aria-hidden
                        />
                    )}

                    <div className="bg-card border-border/60 relative rounded-2xl border p-6 text-center">
                        {step.icon ? (
                            <div className="mb-4 flex justify-center">{step.icon}</div>
                        ) : (
                            <div className="bg-primary text-primary-foreground mx-auto mb-4 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                                {step.number ?? index + 1}
                            </div>
                        )}
                        <h3 className="text-foreground mb-2 text-lg font-semibold">{step.title}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            {step.description}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
