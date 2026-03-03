"use client";

import Link from "next/link";
import { cn, buttonVariants } from "@repo/ui";
import type { ComponentProps } from "react";

type ButtonVariant = "default" | "outline" | "ghost" | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

interface StyledLinkProps extends Omit<ComponentProps<typeof Link>, "className"> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    className?: string;
}

export function StyledLink({
    variant = "default",
    size = "default",
    className,
    ...props
}: StyledLinkProps) {
    return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
