"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
    content: string;
    className?: string;
}

export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
    return (
        <div className={className}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => (
                        <h1 className="mt-5 mb-3 text-xl font-bold text-zinc-100 first:mt-0">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="mt-4 mb-2 text-lg font-semibold text-zinc-100 first:mt-0">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="mt-3 mb-2 text-base font-semibold text-zinc-200 first:mt-0">
                            {children}
                        </h3>
                    ),
                    h4: ({ children }) => (
                        <h4 className="mt-2 mb-1 text-sm font-semibold text-zinc-200 first:mt-0">
                            {children}
                        </h4>
                    ),
                    p: ({ children }) => (
                        <p className="mb-3 leading-relaxed last:mb-0">{children}</p>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-semibold text-zinc-100">{children}</strong>
                    ),
                    em: ({ children }) => <em className="text-zinc-300 italic">{children}</em>,
                    ul: ({ children }) => (
                        <ul className="mb-3 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="mb-3 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>
                    ),
                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                    blockquote: ({ children }) => (
                        <blockquote className="my-3 border-l-2 border-violet-500/40 pl-3 text-zinc-400 italic">
                            {children}
                        </blockquote>
                    ),
                    code: ({ className: codeClassName, children, ...props }) => {
                        const isInline = !codeClassName;
                        if (isInline) {
                            return (
                                <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-violet-300">
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <code
                                className={`block overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-300 ${codeClassName ?? ""}`}
                                {...props}
                            >
                                {children}
                            </code>
                        );
                    },
                    pre: ({ children }) => (
                        <pre className="my-3 overflow-x-auto rounded-md bg-zinc-900 last:mb-0">
                            {children}
                        </pre>
                    ),
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 underline decoration-violet-400/30 underline-offset-2 transition-colors hover:text-violet-300 hover:decoration-violet-300/50"
                        >
                            {children}
                        </a>
                    ),
                    hr: () => <hr className="my-4 border-zinc-800" />,
                    table: ({ children }) => (
                        <div className="my-3 overflow-x-auto">
                            <table className="w-full border-collapse text-sm">{children}</table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="border-b border-zinc-700">{children}</thead>
                    ),
                    th: ({ children }) => (
                        <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="border-t border-zinc-800/60 px-3 py-2 text-zinc-400">
                            {children}
                        </td>
                    )
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

export function stripMarkdown(text: string): string {
    return text
        .replace(/#{1,6}\s+/g, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/__(.+?)__/g, "$1")
        .replace(/_(.+?)_/g, "$1")
        .replace(/~~(.+?)~~/g, "$1")
        .replace(/`{3}[\s\S]*?`{3}/g, "")
        .replace(/`(.+?)`/g, "$1")
        .replace(/\[(.+?)\]\(.+?\)/g, "$1")
        .replace(/!\[.*?\]\(.+?\)/g, "")
        .replace(/^\s*[-*+]\s+/gm, "")
        .replace(/^\s*\d+\.\s+/gm, "")
        .replace(/^\s*>\s+/gm, "")
        .replace(/---+/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
