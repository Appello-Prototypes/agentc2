"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Badge, Button, HugeiconsIcon, Skeleton, cn, icons } from "@repo/ui";
import type { IconName } from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface SkillDetail {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    category?: string | null;
    version: number;
    type: string;
    toolCount: number;
    documentCount: number;
    agentCount: number;
}

const navItems: { id: string; label: string; icon: IconName; path: string }[] = [
    { id: "overview", label: "Overview", icon: "dashboard", path: "" },
    { id: "instructions", label: "Instructions", icon: "file", path: "/instructions" },
    { id: "tools", label: "Tools", icon: "settings", path: "/tools" },
    { id: "documents", label: "Documents", icon: "file", path: "/documents" },
    { id: "usage", label: "Usage", icon: "user", path: "/usage" },
    { id: "versions", label: "Versions", icon: "git-branch", path: "/versions" }
];

export default function SkillLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();
    const skillSlug = params.skillSlug as string;

    const [skill, setSkill] = useState<SkillDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSkill = async () => {
            try {
                const res = await fetch(`${getApiBase()}/api/skills/${skillSlug}`);
                if (res.ok) {
                    const data = await res.json();
                    const s = data.skill || data;
                    setSkill({
                        id: s.id,
                        slug: s.slug,
                        name: s.name,
                        description: s.description,
                        category: s.category,
                        version: s.version,
                        type: s.type,
                        toolCount: s.tools?.length || 0,
                        documentCount: s.documents?.length || 0,
                        agentCount: s.agents?.length || 0
                    });
                } else {
                    setSkill(null);
                }
            } catch (error) {
                console.error("Failed to load skill:", error);
                setSkill(null);
            } finally {
                setLoading(false);
            }
        };
        fetchSkill();
    }, [skillSlug]);

    const activePath = useMemo(() => {
        const basePath = `/skills/${skillSlug}`;
        if (pathname === basePath) return "overview";
        const lastSegment = pathname.replace(basePath, "").split("/").filter(Boolean).pop();
        return lastSegment || "overview";
    }, [pathname, skillSlug]);

    if (loading) {
        return (
            <div className="flex h-full">
                <div className="w-64 border-r p-4">
                    <Skeleton className="mb-4 h-8 w-full" />
                    <Skeleton className="mb-8 h-6 w-3/4" />
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="mb-2 h-10 w-full" />
                    ))}
                </div>
                <div className="flex-1 p-6">
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }

    if (!skill) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <h1 className="mb-2 text-2xl font-bold">Skill Not Found</h1>
                    <p className="text-muted-foreground mb-4">
                        The skill &ldquo;{skillSlug}&rdquo; could not be found.
                    </p>
                    <Button onClick={() => router.push("/skills")}>Back to Skills</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full overflow-hidden">
            <aside className="bg-muted/30 flex w-64 flex-col border-r">
                <div className="border-b p-3">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <div className="text-sm font-semibold">{skill.name}</div>
                            <div className="text-muted-foreground text-xs">
                                {skill.description || "No description"}
                            </div>
                        </div>
                        <Badge
                            variant={skill.type === "SYSTEM" ? "default" : "secondary"}
                            className="h-5 text-[10px]"
                        >
                            {skill.type}
                        </Badge>
                    </div>
                    <div className="text-muted-foreground mt-3 flex flex-wrap gap-2 text-[10px]">
                        <span>v{skill.version}</span>
                        {skill.category && <span>{skill.category}</span>}
                        <span>{skill.toolCount} tools</span>
                        <span>{skill.agentCount} agents</span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={() => router.push("/skills")}
                    >
                        All skills
                    </Button>
                </div>

                <nav className="flex-1 overflow-y-auto p-2">
                    {navItems.map((item) => {
                        const isActive = activePath === item.id;
                        return (
                            <Link
                                key={item.id}
                                href={`/skills/${skill.slug}${item.path}`}
                                className={cn(
                                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <HugeiconsIcon icon={icons[item.icon]!} className="h-4 w-4" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </aside>
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
    );
}
