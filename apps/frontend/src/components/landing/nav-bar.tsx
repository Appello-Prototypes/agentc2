"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@repo/ui";
import { cn } from "@repo/ui";

export function NavBar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header
            className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
                scrolled
                    ? "border-border/50 bg-background/80 border-b backdrop-blur-xl"
                    : "bg-transparent"
            }`}
        >
            <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <Image
                        src="/c2-icon.png"
                        alt="AgentC2"
                        width={28}
                        height={28}
                        className="rounded-md"
                    />
                    <span className="text-lg font-semibold tracking-tight">AgentC2</span>
                </Link>

                {/* Desktop links */}
                <div className="hidden items-center gap-8 md:flex">
                    <Link
                        href="#features"
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                        Platform
                    </Link>
                    <Link
                        href="#capabilities"
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                        Solutions
                    </Link>
                    <Link
                        href="#pricing"
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                        Pricing
                    </Link>
                    <Link
                        href="#faq"
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                        FAQ
                    </Link>
                    <Link
                        href="/docs"
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                        Docs
                    </Link>
                    <Link
                        href="/blog"
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                        Blog
                    </Link>
                    <Link
                        href="/privacy"
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                        Privacy
                    </Link>
                </div>

                {/* Desktop CTAs */}
                <div className="hidden items-center gap-3 md:flex">
                    <a
                        href="#hero"
                        className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
                    >
                        Log In
                    </a>
                    <Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>
                        Get Started
                    </Link>
                </div>

                {/* Mobile menu button */}
                <button
                    className="text-foreground md:hidden"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-label="Toggle menu"
                >
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        {mobileOpen ? (
                            <>
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </>
                        ) : (
                            <>
                                <line x1="4" y1="8" x2="20" y2="8" />
                                <line x1="4" y1="16" x2="20" y2="16" />
                            </>
                        )}
                    </svg>
                </button>
            </nav>

            {/* Mobile menu */}
            {mobileOpen && (
                <div className="border-border/50 bg-background/95 border-t backdrop-blur-xl md:hidden">
                    <div className="flex flex-col gap-4 px-6 py-6">
                        <Link
                            href="#features"
                            className="text-foreground text-sm font-medium"
                            onClick={() => setMobileOpen(false)}
                        >
                            Platform
                        </Link>
                        <Link
                            href="#capabilities"
                            className="text-foreground text-sm font-medium"
                            onClick={() => setMobileOpen(false)}
                        >
                            Solutions
                        </Link>
                        <Link
                            href="#pricing"
                            className="text-foreground text-sm font-medium"
                            onClick={() => setMobileOpen(false)}
                        >
                            Pricing
                        </Link>
                        <Link
                            href="#faq"
                            className="text-foreground text-sm font-medium"
                            onClick={() => setMobileOpen(false)}
                        >
                            FAQ
                        </Link>
                        <Link
                            href="/docs"
                            className="text-foreground text-sm font-medium"
                            onClick={() => setMobileOpen(false)}
                        >
                            Docs
                        </Link>
                        <Link
                            href="/blog"
                            className="text-foreground text-sm font-medium"
                            onClick={() => setMobileOpen(false)}
                        >
                            Blog
                        </Link>
                        <Link
                            href="/privacy"
                            className="text-foreground text-sm font-medium"
                            onClick={() => setMobileOpen(false)}
                        >
                            Privacy
                        </Link>
                        <div className="border-border/50 flex flex-col gap-3 border-t pt-4">
                            <a
                                href="#hero"
                                className="text-muted-foreground text-sm font-medium"
                                onClick={() => setMobileOpen(false)}
                            >
                                Log In
                            </a>
                            <Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>
                                Get Started
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
