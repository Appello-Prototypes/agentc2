"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface SearchEntry {
    slug: string;
    title: string;
    section: string;
    description: string;
}

export function DocsSearch({ entries }: { entries: SearchEntry[] }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchEntry[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const openSearch = useCallback(() => {
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
    }, []);

    const closeSearch = useCallback(() => {
        setOpen(false);
        setQuery("");
        setResults([]);
        setSelectedIndex(0);
    }, []);

    const toggleSearch = useCallback(() => {
        setOpen((prev) => {
            if (prev) {
                setQuery("");
                setResults([]);
                setSelectedIndex(0);
                return false;
            }
            setTimeout(() => inputRef.current?.focus(), 50);
            return true;
        });
    }, []);

    const handleSearch = useCallback(
        (term: string) => {
            setQuery(term);
            if (!term.trim()) {
                setResults([]);
                setSelectedIndex(0);
                return;
            }

            const lower = term.toLowerCase();
            const matched = entries.filter(
                (e) =>
                    e.title.toLowerCase().includes(lower) ||
                    e.description.toLowerCase().includes(lower) ||
                    e.section.toLowerCase().includes(lower)
            );
            setResults(matched.slice(0, 10));
            setSelectedIndex(0);
        },
        [entries]
    );

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                toggleSearch();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggleSearch]);

    const navigate = useCallback(
        (slug: string) => {
            closeSearch();
            router.push(`/docs/${slug}`);
        },
        [router, closeSearch]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => Math.max(prev - 1, 0));
            } else if (e.key === "Enter" && results[selectedIndex]) {
                navigate(results[selectedIndex].slug);
            } else if (e.key === "Escape") {
                closeSearch();
            }
        },
        [results, selectedIndex, navigate, closeSearch]
    );

    return (
        <>
            <button
                onClick={openSearch}
                className="text-muted-foreground hidden items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors hover:border-white/30 sm:flex"
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                </svg>
                Search docs...
                <kbd className="bg-muted ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium">
                    ⌘K
                </kbd>
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={closeSearch}
                    />
                    <div className="relative w-full max-w-lg rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl">
                        <div className="flex items-center border-b border-white/10 px-4">
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-muted-foreground mr-3 shrink-0"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(e) => handleSearch(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Search documentation..."
                                className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/40"
                            />
                        </div>

                        {results.length > 0 && (
                            <ul className="max-h-80 overflow-y-auto p-2">
                                {results.map((result, index) => (
                                    <li key={result.slug}>
                                        <button
                                            onClick={() => navigate(result.slug)}
                                            className={`flex w-full flex-col items-start rounded-lg px-3 py-2 text-left ${
                                                index === selectedIndex
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground hover:bg-white/5"
                                            }`}
                                        >
                                            <span className="text-sm font-medium">
                                                {result.title}
                                            </span>
                                            <span className="mt-0.5 text-xs opacity-60">
                                                {result.section} &middot;{" "}
                                                {result.description.slice(0, 80)}
                                                {result.description.length > 80 ? "..." : ""}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {query && results.length === 0 && (
                            <p className="text-muted-foreground p-4 text-center text-sm">
                                No results found for &ldquo;{query}&rdquo;
                            </p>
                        )}

                        {!query && (
                            <p className="text-muted-foreground p-4 text-center text-sm">
                                Type to search across all documentation pages
                            </p>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
