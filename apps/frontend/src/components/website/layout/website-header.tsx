"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { buttonVariants, cn } from "@repo/ui";

const PLATFORM_LINKS = [
    {
        label: "Platform Overview",
        href: "/platform",
        description: "The complete agent operations platform"
    },
    {
        label: "How It Works",
        href: "/platform/how-it-works",
        description: "Step-by-step product walkthrough"
    },
    {
        label: "Architecture",
        href: "/platform/architecture",
        description: "Technical stack and infrastructure"
    },
    {
        label: "Channels & Voice",
        href: "/platform/channels",
        description: "Multi-channel deployment"
    },
    {
        label: "Federation",
        href: "/platform/federation",
        description: "Cross-organization collaboration"
    },
    {
        label: "Mission Command",
        href: "/platform/mission-command",
        description: "Autonomous campaign execution"
    },
    {
        label: "Dark Factory",
        href: "/platform/dark-factory",
        description: "Autonomous coding pipeline"
    },
    { label: "Marketplace", href: "/platform/marketplace", description: "Playbook marketplace" }
];

const SOLUTIONS_LINKS = [
    {
        label: "Sales & Revenue",
        href: "/use-cases/sales",
        description: "CRM agents and pipeline automation"
    },
    {
        label: "Customer Support",
        href: "/use-cases/support",
        description: "Multi-channel support agents"
    },
    {
        label: "Engineering & DevOps",
        href: "/use-cases/engineering",
        description: "Coding pipeline and triage"
    },
    {
        label: "Construction & AEC",
        href: "/use-cases/construction",
        description: "BIM agents and field coordination"
    },
    {
        label: "Operations",
        href: "/use-cases/operations",
        description: "Campaign execution and observability"
    },
    {
        label: "Partner Networks",
        href: "/use-cases/partner-networks",
        description: "Federated agent collaboration"
    }
];

const DEVELOPERS_LINKS = [
    { label: "Documentation", href: "/docs", description: "Full platform documentation" },
    {
        label: "API Reference",
        href: "/developers/api",
        description: "REST API endpoints and examples"
    },
    {
        label: "MCP Integration",
        href: "/developers/mcp",
        description: "Connect custom MCP servers"
    },
    {
        label: "GitHub",
        href: "https://github.com/agentc2",
        description: "Source code and examples",
        external: true
    }
];

type DropdownKey = "platform" | "solutions" | "developers" | null;

export function WebsiteHeader() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<DropdownKey>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const headerRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
                setActiveDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function handleMouseEnter(key: DropdownKey) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setActiveDropdown(key);
    }

    function handleMouseLeave() {
        timeoutRef.current = setTimeout(() => setActiveDropdown(null), 150);
    }

    return (
        <header
            ref={headerRef}
            className={cn(
                "fixed top-0 right-0 left-0 z-50 transition-all duration-300",
                scrolled
                    ? "border-border/50 bg-background/80 border-b backdrop-blur-xl"
                    : "bg-transparent"
            )}
        >
            <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
                <Link href="/" className="relative z-10 flex shrink-0 items-center gap-2">
                    <Image
                        src="/c2-icon.png"
                        alt="AgentC2"
                        width={28}
                        height={28}
                        className="rounded-md"
                    />
                    <span className="text-lg font-semibold tracking-tight">AgentC2</span>
                </Link>

                {/* Desktop navigation */}
                <div className="hidden items-center gap-1 lg:flex">
                    <DropdownTrigger
                        label="Platform"
                        isActive={activeDropdown === "platform"}
                        onMouseEnter={() => handleMouseEnter("platform")}
                        onMouseLeave={handleMouseLeave}
                    />
                    <DropdownTrigger
                        label="Solutions"
                        isActive={activeDropdown === "solutions"}
                        onMouseEnter={() => handleMouseEnter("solutions")}
                        onMouseLeave={handleMouseLeave}
                    />
                    <DropdownTrigger
                        label="Developers"
                        isActive={activeDropdown === "developers"}
                        onMouseEnter={() => handleMouseEnter("developers")}
                        onMouseLeave={handleMouseLeave}
                    />
                    <Link
                        href="/compare"
                        className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2 text-sm transition-colors"
                    >
                        Compare
                    </Link>
                    <Link
                        href="/pricing"
                        className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2 text-sm transition-colors"
                    >
                        Pricing
                    </Link>
                    <Link
                        href="/blog"
                        className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2 text-sm transition-colors"
                    >
                        Blog
                    </Link>
                </div>

                {/* Desktop CTAs */}
                <div className="hidden items-center gap-3 lg:flex">
                    <Link
                        href="/signup"
                        className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
                    >
                        Log In
                    </Link>
                    <Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>
                        Get Started
                    </Link>
                </div>

                {/* Mobile menu button */}
                <button
                    className="text-foreground lg:hidden"
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

            {/* Desktop dropdown panels */}
            {activeDropdown === "platform" && (
                <DropdownPanel
                    links={PLATFORM_LINKS}
                    onMouseEnter={() => handleMouseEnter("platform")}
                    onMouseLeave={handleMouseLeave}
                />
            )}
            {activeDropdown === "solutions" && (
                <DropdownPanel
                    links={SOLUTIONS_LINKS}
                    onMouseEnter={() => handleMouseEnter("solutions")}
                    onMouseLeave={handleMouseLeave}
                />
            )}
            {activeDropdown === "developers" && (
                <DropdownPanel
                    links={DEVELOPERS_LINKS}
                    onMouseEnter={() => handleMouseEnter("developers")}
                    onMouseLeave={handleMouseLeave}
                />
            )}

            {/* Mobile menu */}
            {mobileOpen && (
                <div className="border-border/50 bg-background/95 max-h-[calc(100dvh-4rem)] overflow-y-auto border-t backdrop-blur-xl lg:hidden">
                    <div className="flex flex-col gap-1 px-6 py-4">
                        <MobileSection
                            title="Platform"
                            links={PLATFORM_LINKS}
                            onNavigate={() => setMobileOpen(false)}
                        />
                        <MobileSection
                            title="Solutions"
                            links={SOLUTIONS_LINKS}
                            onNavigate={() => setMobileOpen(false)}
                        />
                        <MobileSection
                            title="Developers"
                            links={DEVELOPERS_LINKS}
                            onNavigate={() => setMobileOpen(false)}
                        />
                        <Link
                            href="/compare"
                            className="text-foreground rounded-lg px-3 py-2.5 text-sm font-medium"
                            onClick={() => setMobileOpen(false)}
                        >
                            Compare
                        </Link>
                        <Link
                            href="/pricing"
                            className="text-foreground rounded-lg px-3 py-2.5 text-sm font-medium"
                            onClick={() => setMobileOpen(false)}
                        >
                            Pricing
                        </Link>
                        <Link
                            href="/blog"
                            className="text-foreground rounded-lg px-3 py-2.5 text-sm font-medium"
                            onClick={() => setMobileOpen(false)}
                        >
                            Blog
                        </Link>
                        <div className="border-border/50 mt-2 flex flex-col gap-3 border-t pt-4">
                            <Link
                                href="/signup"
                                className="text-muted-foreground px-3 text-sm font-medium"
                                onClick={() => setMobileOpen(false)}
                            >
                                Log In
                            </Link>
                            <Link
                                href="/signup"
                                className={cn(buttonVariants({ size: "sm" }))}
                                onClick={() => setMobileOpen(false)}
                            >
                                Get Started
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

function DropdownTrigger({
    label,
    isActive,
    onMouseEnter,
    onMouseLeave
}: {
    label: string;
    isActive: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}) {
    return (
        <button
            className={cn(
                "flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={() => onMouseEnter()}
        >
            {label}
            <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn("transition-transform", isActive && "rotate-180")}
            >
                <path d="M3 4.5L6 7.5L9 4.5" />
            </svg>
        </button>
    );
}

function DropdownPanel({
    links,
    onMouseEnter,
    onMouseLeave
}: {
    links: Array<{ label: string; href: string; description: string; external?: boolean }>;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}) {
    return (
        <div
            className="border-border/50 bg-background/95 hidden border-t backdrop-blur-xl lg:block"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className="mx-auto max-w-7xl px-6 py-4">
                <div className="grid grid-cols-2 gap-1 lg:grid-cols-4">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            target={link.external ? "_blank" : undefined}
                            rel={link.external ? "noopener noreferrer" : undefined}
                            className="hover:bg-muted/50 rounded-xl p-3 transition-colors"
                        >
                            <span className="text-foreground text-sm font-medium">
                                {link.label}
                            </span>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                                {link.description}
                            </p>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

function MobileSection({
    title,
    links,
    onNavigate
}: {
    title: string;
    links: Array<{ label: string; href: string; description: string; external?: boolean }>;
    onNavigate: () => void;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div>
            <button
                className="text-foreground flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium"
                onClick={() => setOpen(!open)}
            >
                {title}
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cn("transition-transform", open && "rotate-180")}
                >
                    <path d="M3 4.5L6 7.5L9 4.5" />
                </svg>
            </button>
            {open && (
                <div className="flex flex-col gap-0.5 pb-2 pl-3">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            target={link.external ? "_blank" : undefined}
                            rel={link.external ? "noopener noreferrer" : undefined}
                            className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2 text-sm transition-colors"
                            onClick={onNavigate}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
