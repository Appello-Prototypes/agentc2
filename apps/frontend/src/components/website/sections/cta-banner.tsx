"use client";

import Link from "next/link";
import { cn, buttonVariants } from "@repo/ui";

export interface CTABannerProps {
    title: string;
    description?: string;
    primaryCta: { label: string; href: string };
    secondaryCta?: { label: string; href: string };
}

export function CTABanner({ title, description, primaryCta, secondaryCta }: CTABannerProps) {
    return (
        <section className="py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="from-primary/10 via-primary/5 relative overflow-hidden rounded-3xl bg-linear-to-br to-transparent px-8 py-16 text-center md:px-16 md:py-20">
                    <div className="bg-primary/10 pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl" />
                    <div className="bg-primary/5 pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full blur-3xl" />

                    <div className="relative">
                        <h2 className="text-foreground mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                            {title}
                        </h2>
                        {description && (
                            <p className="text-muted-foreground mx-auto mb-8 max-w-xl text-lg">
                                {description}
                            </p>
                        )}
                        <div
                            className={cn(
                                "flex flex-col items-center justify-center gap-3 sm:flex-row",
                                !description && "mt-4"
                            )}
                        >
                            <Link
                                href={primaryCta.href}
                                className={cn(buttonVariants({ size: "lg" }))}
                            >
                                {primaryCta.label}
                            </Link>
                            {secondaryCta && (
                                <Link
                                    href={secondaryCta.href}
                                    className={cn(
                                        buttonVariants({
                                            variant: "outline",
                                            size: "lg"
                                        })
                                    )}
                                >
                                    {secondaryCta.label}
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
