import Link from "next/link";
import { buttonVariants, cn } from "@repo/ui";

export function CtaBanner() {
    return (
        <section className="py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="from-primary/10 via-primary/5 relative overflow-hidden rounded-3xl bg-linear-to-br to-transparent px-8 py-16 text-center md:px-16 md:py-20">
                    {/* Decorative blobs */}
                    <div className="bg-primary/10 pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl" />
                    <div className="bg-primary/5 pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full blur-3xl" />

                    <div className="relative">
                        <h2 className="text-foreground mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                            2026 is the year of the agent. Is your company ready?
                        </h2>
                        <p className="text-muted-foreground mx-auto mb-8 max-w-xl text-lg">
                            Deploy AI agents that connect to your business systems, automate real
                            workflows, and scale with enterprise-grade security and observability.
                        </p>
                        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }))}>
                                Start Free Trial
                            </Link>
                            <Link
                                href="mailto:sales@agentc2.com"
                                className={cn(
                                    buttonVariants({
                                        variant: "outline",
                                        size: "lg"
                                    })
                                )}
                            >
                                Book a Demo
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
