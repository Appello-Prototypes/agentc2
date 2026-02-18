import type { ReactNode } from "react";
import { CopyButton } from "./copy-button";

interface CalloutProps {
    type?: "info" | "warning" | "tip";
    children: ReactNode;
}

const calloutStyles: Record<string, { border: string; bg: string; icon: string }> = {
    info: { border: "border-blue-500/40", bg: "bg-blue-500/5", icon: "Info" },
    warning: { border: "border-amber-500/40", bg: "bg-amber-500/5", icon: "Warning" },
    tip: { border: "border-emerald-500/40", bg: "bg-emerald-500/5", icon: "Tip" }
};

export function Callout({ type = "info", children }: CalloutProps) {
    const style = calloutStyles[type] ?? calloutStyles.info!;
    return (
        <div className={`my-4 rounded-lg border-l-4 ${style.border} ${style.bg} px-4 py-3`}>
            <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                {style.icon}
            </p>
            <div className="text-foreground text-sm leading-relaxed [&>p]:m-0">{children}</div>
        </div>
    );
}

export function Steps({ children }: { children: ReactNode }) {
    return (
        <div className="docs-steps my-6 space-y-4 border-l-2 border-white/10 pl-6 [counter-reset:step]">
            {children}
        </div>
    );
}

export function Step({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="relative [counter-increment:step]">
            <div className="bg-background text-primary absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold before:content-[counter(step)]" />
            <h3 className="text-foreground mb-2 text-base font-semibold">{title}</h3>
            <div className="text-muted-foreground text-sm leading-relaxed">{children}</div>
        </div>
    );
}

interface CodeTabsProps {
    labels: string[];
    children: ReactNode;
}

export function CodeTabs({ labels, children }: CodeTabsProps) {
    void labels;
    return <div className="docs-code-tabs my-4">{children}</div>;
}

export function ApiEndpoint({ method, path }: { method: string; path: string }) {
    const methodColors: Record<string, string> = {
        GET: "bg-emerald-500/20 text-emerald-400",
        POST: "bg-blue-500/20 text-blue-400",
        PUT: "bg-amber-500/20 text-amber-400",
        PATCH: "bg-orange-500/20 text-orange-400",
        DELETE: "bg-red-500/20 text-red-400"
    };
    const color = methodColors[method.toUpperCase()] ?? "bg-gray-500/20 text-gray-400";

    return (
        <div className="my-4 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm">
            <span className={`rounded px-2 py-0.5 text-xs font-bold ${color}`}>
                {method.toUpperCase()}
            </span>
            <span className="text-foreground">{path}</span>
        </div>
    );
}

export function ParamTable({ children }: { children: ReactNode }) {
    return (
        <div className="my-4 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-sm">{children}</table>
        </div>
    );
}

export function Card({
    title,
    description,
    href
}: {
    title: string;
    description: string;
    href: string;
}) {
    return (
        <a
            href={href}
            className="border-border hover:border-primary/50 block rounded-lg border p-4 transition-colors"
        >
            <p className="text-foreground text-sm font-semibold">{title}</p>
            <p className="text-muted-foreground mt-1 text-xs">{description}</p>
        </a>
    );
}

export function CardGrid({ children }: { children: ReactNode }) {
    return <div className="my-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function extractTextContent(node: ReactNode): string {
    if (typeof node === "string") return node;
    if (typeof node === "number") return String(node);
    if (!node) return "";
    if (Array.isArray(node)) return node.map(extractTextContent).join("");
    if (typeof node === "object" && "props" in node) {
        const el = node as { props: { children?: ReactNode } };
        return extractTextContent(el.props.children);
    }
    return "";
}

function Pre({ children, ...props }: React.ComponentPropsWithoutRef<"pre">) {
    const text = extractTextContent(children);
    return (
        <div className="group relative my-4">
            <pre
                {...props}
                className="overflow-x-auto rounded-lg border border-white/10 bg-[#0d1117] p-4 text-sm leading-relaxed"
            >
                {children}
            </pre>
            <CopyButton text={text} />
        </div>
    );
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
}

function H2({ children, ...props }: React.ComponentPropsWithoutRef<"h2">) {
    const text = extractTextContent(children);
    const id = slugify(text);
    return (
        <h2
            id={id}
            className="text-foreground mt-10 mb-4 scroll-mt-20 text-2xl font-semibold"
            {...props}
        >
            <a href={`#${id}`} className="hover:text-primary no-underline">
                {children}
            </a>
        </h2>
    );
}

function H3({ children, ...props }: React.ComponentPropsWithoutRef<"h3">) {
    const text = extractTextContent(children);
    const id = slugify(text);
    return (
        <h3
            id={id}
            className="text-foreground mt-8 mb-3 scroll-mt-20 text-xl font-semibold"
            {...props}
        >
            <a href={`#${id}`} className="hover:text-primary no-underline">
                {children}
            </a>
        </h3>
    );
}

function Table({ children, ...props }: React.ComponentPropsWithoutRef<"table">) {
    return (
        <div className="my-4 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-sm" {...props}>
                {children}
            </table>
        </div>
    );
}

function Th({ children, ...props }: React.ComponentPropsWithoutRef<"th">) {
    return (
        <th
            className="bg-muted/50 border-b border-white/10 px-4 py-2 text-xs font-semibold tracking-wide uppercase"
            {...props}
        >
            {children}
        </th>
    );
}

function Td({ children, ...props }: React.ComponentPropsWithoutRef<"td">) {
    return (
        <td className="text-muted-foreground border-b border-white/5 px-4 py-2" {...props}>
            {children}
        </td>
    );
}

function Anchor({ children, ...props }: React.ComponentPropsWithoutRef<"a">) {
    return (
        <a className="text-primary hover:text-primary/80 underline underline-offset-2" {...props}>
            {children}
        </a>
    );
}

function Paragraph({ children, ...props }: React.ComponentPropsWithoutRef<"p">) {
    return (
        <p className="text-muted-foreground my-3 leading-relaxed" {...props}>
            {children}
        </p>
    );
}

function Ul({ children, ...props }: React.ComponentPropsWithoutRef<"ul">) {
    return (
        <ul
            className="text-muted-foreground my-3 list-disc space-y-1.5 pl-6 text-sm leading-relaxed"
            {...props}
        >
            {children}
        </ul>
    );
}

function Ol({ children, ...props }: React.ComponentPropsWithoutRef<"ol">) {
    return (
        <ol
            className="text-muted-foreground my-3 list-decimal space-y-1.5 pl-6 text-sm leading-relaxed"
            {...props}
        >
            {children}
        </ol>
    );
}

function Code({ children, ...props }: React.ComponentPropsWithoutRef<"code">) {
    const isInline = !("data-language" in props || "data-theme" in props);
    if (isInline) {
        return (
            <code
                className="rounded bg-white/10 px-1.5 py-0.5 text-[0.85em] text-white/80"
                {...props}
            >
                {children}
            </code>
        );
    }
    return <code {...props}>{children}</code>;
}

function Blockquote({ children, ...props }: React.ComponentPropsWithoutRef<"blockquote">) {
    return (
        <blockquote
            className="text-muted-foreground my-4 border-l-2 border-white/20 pl-4 text-sm italic"
            {...props}
        >
            {children}
        </blockquote>
    );
}

function Hr() {
    return <hr className="my-8 border-white/10" />;
}

function Strong({ children, ...props }: React.ComponentPropsWithoutRef<"strong">) {
    return (
        <strong className="text-foreground font-semibold" {...props}>
            {children}
        </strong>
    );
}

export const mdxComponents = {
    h2: H2,
    h3: H3,
    pre: Pre,
    code: Code,
    table: Table,
    th: Th,
    td: Td,
    a: Anchor,
    p: Paragraph,
    ul: Ul,
    ol: Ol,
    blockquote: Blockquote,
    hr: Hr,
    strong: Strong,
    Callout,
    Steps,
    Step,
    CodeTabs,
    ApiEndpoint,
    ParamTable,
    Card,
    CardGrid
};
