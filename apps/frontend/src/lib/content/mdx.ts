import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface DocFrontmatter {
    title: string;
    description: string;
    section: string;
    order?: number;
    primaryKeyword?: string;
    secondaryKeywords?: string[];
    searchIntent?: "informational" | "commercial" | "transactional";
    pageType?: "concept" | "how-to" | "reference" | "tutorial";
    ctaLabel?: string;
    ctaHref?: string;
    relatedSlugs?: string[];
}

export interface DocPage {
    slug: string;
    frontmatter: DocFrontmatter;
    content: string;
}

export interface TocEntry {
    id: string;
    label: string;
    level: number;
}

const CONTENT_DIR = path.join(process.cwd(), "content", "docs");

export function getAllDocSlugs(): string[] {
    const slugs: string[] = [];

    if (!fs.existsSync(CONTENT_DIR)) {
        return slugs;
    }

    const sections = fs
        .readdirSync(CONTENT_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory());

    for (const section of sections) {
        const sectionPath = path.join(CONTENT_DIR, section.name);
        const files = fs.readdirSync(sectionPath).filter((f) => f.endsWith(".mdx"));
        for (const file of files) {
            slugs.push(`${section.name}/${file.replace(".mdx", "")}`);
        }
    }

    return slugs;
}

export function getDocPage(slug: string): DocPage | null {
    const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);

    if (!fs.existsSync(filePath)) {
        return null;
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);

    const parts = slug.split("/");

    return {
        slug,
        frontmatter: {
            title: data.title ?? "Untitled",
            description: data.description ?? "",
            section: data.section ?? parts[0] ?? "",
            order: data.order,
            primaryKeyword: data.primaryKeyword,
            secondaryKeywords: data.secondaryKeywords,
            searchIntent: data.searchIntent,
            pageType: data.pageType,
            ctaLabel: data.ctaLabel ?? "Launch AgentC2 Workspace",
            ctaHref: data.ctaHref ?? "/workspace",
            relatedSlugs: data.relatedSlugs ?? []
        },
        content
    };
}

export function getDocSections(): Array<{
    slug: string;
    title: string;
    pages: Array<{ slug: string; title: string; order: number }>;
}> {
    if (!fs.existsSync(CONTENT_DIR)) {
        return [];
    }

    const sectionDirs = fs
        .readdirSync(CONTENT_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory());

    const sectionOrder = [
        "getting-started",
        "agents",
        "skills",
        "workflows",
        "networks",
        "integrations",
        "channels",
        "knowledge",
        "campaigns",
        "platform",
        "api-reference",
        "guides"
    ];

    return sectionDirs
        .map((dir) => {
            const sectionPath = path.join(CONTENT_DIR, dir.name);
            const files = fs.readdirSync(sectionPath).filter((f) => f.endsWith(".mdx"));

            const pages = files.map((file) => {
                const slug = `${dir.name}/${file.replace(".mdx", "")}`;
                const raw = fs.readFileSync(path.join(sectionPath, file), "utf-8");
                const { data } = matter(raw);
                return {
                    slug,
                    title: (data.title as string) ?? titleFromSlug(file.replace(".mdx", "")),
                    order: (data.order as number) ?? 999
                };
            });

            pages.sort((a, b) => a.order - b.order);

            return {
                slug: dir.name,
                title: titleFromSlug(dir.name),
                pages
            };
        })
        .sort((a, b) => {
            const ai = sectionOrder.indexOf(a.slug);
            const bi = sectionOrder.indexOf(b.slug);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
}

export function getTableOfContents(content: string): TocEntry[] {
    const headingRegex = /^(#{2,3})\s+(.+)$/gm;
    const entries: TocEntry[] = [];
    let match: RegExpExecArray | null;

    while ((match = headingRegex.exec(content)) !== null) {
        const level = match[1]!.length;
        const label = match[2]!.trim();
        const id = label
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-");
        entries.push({ id, label, level });
    }

    return entries;
}

function titleFromSlug(slug: string): string {
    return slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}
