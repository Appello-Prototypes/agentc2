"use client";

import Link from "next/link";
import { useState } from "react";

const links = [
    { href: "/docs", label: "Docs" },
    { href: "/blog", label: "Blog" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/security", label: "Security" },
    { href: "/login", label: "Log in" }
];

export function HomeNavMenu() {
    const [open, setOpen] = useState(false);

    return (
        <div className="pointer-events-none fixed top-4 right-4 left-4 z-50 flex items-start justify-between">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                aria-label="Open navigation menu"
                className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/20 bg-black/70 text-white backdrop-blur-sm transition-colors hover:bg-black/85"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    {open ? (
                        <>
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </>
                    ) : (
                        <>
                            <line x1="4" y1="7" x2="20" y2="7" />
                            <line x1="4" y1="12" x2="20" y2="12" />
                            <line x1="4" y1="17" x2="20" y2="17" />
                        </>
                    )}
                </svg>
            </button>

            <nav className="pointer-events-auto flex items-center gap-2">
                <Link
                    href="/docs"
                    className="rounded-md border border-white/15 bg-black/55 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-black/75 hover:text-white"
                >
                    Docs
                </Link>
                <Link
                    href="/blog"
                    className="rounded-md border border-white/15 bg-black/55 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-black/75 hover:text-white"
                >
                    Blog
                </Link>
            </nav>

            {open ? (
                <nav className="pointer-events-auto absolute top-12 left-0 mt-2 w-48 rounded-md border border-white/10 bg-black/90 p-2 shadow-xl backdrop-blur-sm">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setOpen(false)}
                            className="block rounded px-3 py-2 text-sm text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>
            ) : null}
        </div>
    );
}
