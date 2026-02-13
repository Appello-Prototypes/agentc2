"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Skeleton,
    Sheet,
    SheetContent
} from "@repo/ui";
import { PlusIcon, SearchIcon } from "lucide-react";
import { SkillBuilderPanel } from "@/components/skills/SkillBuilderPanel";

interface SkillSummary {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    category: string | null;
    tags: string[];
    version: number;
    type: string;
    documents: Array<{ documentId: string }>;
    tools: Array<{ toolId: string }>;
    agents: Array<{ agentId: string }>;
}

const CATEGORIES = [
    "all",
    "builder",
    "operations",
    "integration",
    "utility",
    "domain",
    "admin",
    "knowledge"
];

export default function SkillsPage() {
    const [skills, setSkills] = useState<SkillSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [builderOpen, setBuilderOpen] = useState(false);

    const fetchSkills = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (categoryFilter !== "all") params.set("category", categoryFilter);
            if (typeFilter !== "all") params.set("type", typeFilter);
            const url = `${getApiBase()}/api/skills?${params.toString()}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setSkills(data.skills || []);
            }
        } catch (err) {
            console.error("Failed to fetch skills:", err);
        } finally {
            setLoading(false);
        }
    }, [categoryFilter, typeFilter]);

    useEffect(() => {
        fetchSkills();
    }, [fetchSkills]);

    const filtered = skills.filter((s) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            s.name.toLowerCase().includes(q) ||
            s.slug.toLowerCase().includes(q) ||
            s.description?.toLowerCase().includes(q)
        );
    });

    // Summary stats
    const totalSkills = skills.length;
    const systemSkills = skills.filter((s) => s.type === "SYSTEM").length;
    const userSkills = skills.filter((s) => s.type === "USER").length;
    const totalTools = skills.reduce((sum, s) => sum + s.tools.length, 0);
    const inUse = skills.filter((s) => s.agents.length > 0).length;
    const integrationSkills = skills.filter((s) => s.category === "integration").length;

    return (
        <div className="container mx-auto space-y-6 py-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Skills</h1>
                    <p className="text-muted-foreground text-sm">
                        Composable capability bundles that group tools, instructions, and knowledge
                        for agents.
                    </p>
                </div>
                <Sheet open={builderOpen} onOpenChange={setBuilderOpen}>
                    <Button onClick={() => setBuilderOpen(true)}>
                        <PlusIcon className="mr-1.5 h-4 w-4" />
                        Create Skill
                    </Button>
                    <SheetContent className="w-full p-0 sm:w-[480px] sm:max-w-[480px]">
                        <SkillBuilderPanel
                            agentId=""
                            agentSlug=""
                            onSkillCreated={() => {
                                setBuilderOpen(false);
                                fetchSkills();
                            }}
                        />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-muted-foreground text-xs font-medium">Total Skills</p>
                        <p className="text-2xl font-bold">{totalSkills}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-muted-foreground text-xs font-medium">System</p>
                        <p className="text-2xl font-bold">{systemSkills}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-muted-foreground text-xs font-medium">User</p>
                        <p className="text-2xl font-bold">{userSkills}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-muted-foreground text-xs font-medium">Total Tools</p>
                        <p className="text-2xl font-bold">{totalTools}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-muted-foreground text-xs font-medium">In Use</p>
                        <p className="text-2xl font-bold">{inUse}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-muted-foreground text-xs font-medium">Integrations</p>
                        <p className="text-2xl font-bold">{integrationSkills}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <div className="relative max-w-sm flex-1">
                    <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                        placeholder="Search skills..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                        {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                                {c === "all" ? "All Categories" : c}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
                    <SelectTrigger className="w-32">
                        <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="SYSTEM">System</SelectItem>
                        <SelectItem value="USER">User</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Skills Grid */}
            {loading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-40 w-full rounded-lg" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground text-sm">
                            {search
                                ? "No skills match your search."
                                : "No skills found. Create one to get started."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((skill) => (
                        <Link key={skill.id} href={`/skills/${skill.slug}`}>
                            <Card className="hover:border-primary/50 h-full cursor-pointer transition-colors">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="text-sm">{skill.name}</CardTitle>
                                        <div className="flex items-center gap-1">
                                            <Badge variant="outline" className="text-[10px]">
                                                v{skill.version}
                                            </Badge>
                                            <Badge
                                                variant={
                                                    skill.type === "SYSTEM"
                                                        ? "default"
                                                        : "secondary"
                                                }
                                                className="text-[10px]"
                                            >
                                                {skill.type}
                                            </Badge>
                                        </div>
                                    </div>
                                    {skill.description && (
                                        <CardDescription className="line-clamp-2 text-xs">
                                            {skill.description}
                                        </CardDescription>
                                    )}
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="flex flex-wrap gap-1.5">
                                        {skill.category && (
                                            <Badge variant="outline" className="text-[10px]">
                                                {skill.category}
                                            </Badge>
                                        )}
                                        {skill.tags.slice(0, 3).map((tag) => (
                                            <Badge
                                                key={tag}
                                                variant="secondary"
                                                className="text-[10px]"
                                            >
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                    <div className="text-muted-foreground mt-3 flex gap-4 text-[11px]">
                                        <span>{skill.tools.length} tools</span>
                                        <span>{skill.agents.length} agents</span>
                                        <span>{skill.documents.length} docs</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
