"use client";

import Link from "next/link";
import { cn, buttonVariants } from "@repo/ui";

export interface PageHeroProps {
    overline?: string;
    title: string;
    description?: string;
    primaryCta?: { label: string; href: string };
    secondaryCta?: { label: string; href: string };
    children?: React.ReactNode;
    centered?: boolean;
}

export function PageHero({
    overline,
    title,
    description,
    primaryCta,
    secondaryCta,
    children,
    centered = false
}: PageHeroProps) {
    const hasVisual = Boolean(children) && !centered;
    const content = (
        <div className={cn(hasVisual && "flex flex-col justify-center", centered && "text-center")}>
            {overline && (
                <span className="text-primary mb-4 block text-xs font-semibold tracking-wider uppercase">
                    {overline}
                </span>
            )}
            <h1 className="text-foreground text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                {title}
            </h1>
            {description && (
                <p
                    className={cn(
                        "text-muted-foreground mt-4 max-w-2xl text-lg leading-relaxed",
                        centered && "mx-auto"
                    )}
                >
                    {description}
                </p>
            )}
            {(primaryCta || secondaryCta) && (
                <div className={cn("mt-8 flex flex-row gap-3", centered && "justify-center")}>
                    {primaryCta && (
                        <Link href={primaryCta.href} className={cn(buttonVariants({ size: "lg" }))}>
                            {primaryCta.label}
                        </Link>
                    )}
                    {secondaryCta && (
                        <Link
                            href={secondaryCta.href}
                            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                        >
                            {secondaryCta.label}
                        </Link>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <section className="py-20 md:py-28 lg:py-32">
            <div className="mx-auto max-w-7xl px-6">
                {hasVisual ? (
                    <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                        {content}
                        <div className="flex items-center justify-center">{children}</div>
                    </div>
                ) : (
                    content
                )}
            </div>
        </section>
    );
}
