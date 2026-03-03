import { cn } from "@repo/ui";

const cards = [
    {
        title: "Models give you intelligence. Not operations.",
        body: "OpenAI and Claude sell tokens. They don't give you multi-tenant governance, budget enforcement, multi-channel deployment, or agents that learn from production."
    },
    {
        title: "Frameworks give you scaffolding. Not a platform.",
        body: "LangChain and CrewAI give you libraries. They don't give you a production system with monitoring, evaluation, compliance, and a marketplace."
    },
    {
        title: "Automation gives you workflows. Not agents.",
        body: "n8n and Zapier execute predefined steps. They don't give you agents that reason, plan, delegate, execute campaigns, and improve autonomously."
    }
];

export function ProblemStatement() {
    return (
        <section className="bg-muted/30 py-24">
            <div className="mx-auto max-w-7xl px-6">
                <h2 className="text-foreground text-center text-2xl font-bold tracking-tight md:text-3xl">
                    The gap between AI models and AI operations is where organizations fail.
                </h2>
                <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {cards.map((card, index) => (
                        <div
                            key={index}
                            className={cn("border-border/60 bg-card rounded-2xl border p-6")}
                        >
                            <h3 className="text-foreground mb-3 text-lg font-semibold">
                                {card.title}
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                {card.body}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
